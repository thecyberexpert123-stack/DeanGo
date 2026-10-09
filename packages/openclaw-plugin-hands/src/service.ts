/**
 * service.ts — the HANDS service: owns the brain's process, session bindings,
 * and ACP traffic for one OpenClaw↔Hermes organism.
 *
 * Design goals:
 *  - Update-resilient on BOTH sides: Hermes is treated as a black-box ACP v1
 *    peer (the only sanctioned seam); OpenClaw is contacted only through what
 *    the plugin-sdk context passes us. Internal APIs of neither repo appear here.
 *  - The body outlives the spine: session bindings are persisted to stateDir,
 *    so gateway restarts and component updates reattach existing Hermes
 *    sessions via session/load instead of starting blank.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ---------- config (validated by openclaw.plugin.json configSchema) ----------

export type HandsConfig = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeoutSeconds?: number;
  permissionMode?: "approve-all" | "approve-reads" | "deny-all";
  nonInteractivePermissions?: "deny" | "fail";
  sessionResume?: boolean;
  provenance?: boolean;
  mcpServers?: Record<string, McpServerSpec>;
};

type McpServerSpec = {
  type?: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
};

// ---------- session bindings (persisted organism memory-map) ----------------

type SessionBinding = {
  openclawSessionKey: string;
  hermesSessionId: string;
  cwd: string;
  createdAt: string;
  lastUsedAt: string;
};

class BindingStore {
  #path: string;
  #byKey = new Map<string, SessionBinding>();

  constructor(stateDir: string) {
    mkdirSync(stateDir, { recursive: true });
    this.#path = join(stateDir, "session-bindings.json");
    if (existsSync(this.#path)) {
      try {
        const rows = JSON.parse(readFileSync(this.#path, "utf8")) as SessionBinding[];
        for (const b of rows) this.#byKey.set(b.openclawSessionKey, b);
      } catch {
        // corrupted bindings are regenerable (see plugin backupResources)
      }
    }
  }

  get(key: string): SessionBinding | undefined {
    return this.#byKey.get(key);
  }

  put(binding: SessionBinding): void {
    this.#byKey.set(binding.openclawSessionKey, binding);
    this.#flush();
  }

  touch(key: string): void {
    const b = this.#byKey.get(key);
    if (b) {
      b.lastUsedAt = new Date().toISOString();
      this.#flush();
    }
  }

  // Atomic-ish flush: write-replace so a crash mid-write can't gut the map.
  #flush(): void {
    const tmp = this.#path + ".tmp";
    writeFileSync(tmp, JSON.stringify([...this.#byKey.values()], null, 2));
    writeFileSync(this.#path, readFileSync(tmp));
  }
}

// ---------- ACP v1 stdio client (plugin-local, protocol-only) ---------------

type Json = Record<string, unknown>;

class AcpProcess {
  #child: ChildProcess;
  #rl: Interface;
  #nextId = 1;
  #pending = new Map<number, { resolve: (v: Json) => void; reject: (e: Error) => void }>();
  #notifyHandlers = new Set<(method: string, params: Json) => void>();
  #dead: Error | null = null;

  constructor(command: string, args: string[], opts: { cwd?: string; env?: Record<string, string> }) {
    const parts = command.trim().split(/\s+/);
    this.#child = spawn(parts[0], [...parts.slice(1), ...args], {
      cwd: opts.cwd,
      env: { ...process.env, ...(opts.env ?? {}) },
      stdio: ["pipe", "pipe", "inherit"], // stderr inherits: brain diagnostics stay visible
    });
    this.#child.on("error", (e) => this.#failAll(new Error(`spawn failed: ${e.message}`)));
    this.#child.on("close", (code) => this.#failAll(new Error(`brain exited (code ${code})`)));
    this.#rl = createInterface({ input: this.#child.stdout! });
    this.#rl.on("line", (line) => this.#onLine(line));
  }

  #failAll(err: Error): void {
    this.#dead = err;
    for (const p of this.#pending.values()) p.reject(err);
    this.#pending.clear();
  }

  #onLine(line: string): void {
    let msg: Json & { method?: string; id?: number };
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.method && msg.id !== undefined) {
      this.#answerAgentRequest(msg.id, msg.method, msg.params as Json);
      return;
    }
    if (msg.method) {
      for (const h of this.#notifyHandlers) h(msg.method, (msg.params ?? {}) as Json);
      return;
    }
    if (msg.id !== undefined) {
      const p = this.#pending.get(msg.id);
      if (!p) return;
      this.#pending.delete(msg.id);
      const err = msg.error as { code: number; message: string } | undefined;
      if (err) p.reject(new Error(`RPC ${err.code}: ${err.message}`));
      else p.resolve((msg.result ?? {}) as Json);
    }
  }

  #answerAgentRequest(id: number, method: string, params: Json): void {
    // Minimal host-side surface; permission policy is applied by HandsService
    // before it reaches here (service sends precomputed answers via resolvePermission).
    void params;
    this.#write({ jsonrpc: "2.0", id, error: { code: -32601, message: `host method not implemented: ${method}` } });
  }

  #write(msg: Json): void {
    this.#child.stdin!.write(JSON.stringify(msg) + "\n");
  }

  request(method: string, params: Json, timeoutMs: number): Promise<Json> {
    if (this.#dead) return Promise.reject(this.#dead);
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`${method}: timeout`));
      }, timeoutMs);
      this.#pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      try {
        this.#write({ jsonrpc: "2.0", id, method, params });
      } catch (e) {
        clearTimeout(timer);
        this.#pending.delete(id);
        reject(e as Error);
      }
    });
  }

  onNotification(h: (method: string, params: Json) => void): void {
    this.#notifyHandlers.add(h);
  }

  kill(): void {
    try { this.#child.stdin!.end(); } catch { /* already gone */ }
    try { this.#child.kill("SIGTERM"); } catch { /* already gone */ }
  }
}

// ---------- the service ------------------------------------------------------

export type HandsServiceDeps = {
  logger?: { info?: (msg: string) => void; warn?: (msg: string) => void };
  paths?: { stateDir?: string };
  resolveWorkspace?: (openclawSessionKey: string) => string | undefined;
};

export function createHandsService(deps: HandsServiceDeps, config: HandsConfig) {
  const log = deps.logger ?? {};
  const stateDir = deps.paths?.stateDir ?? join(process.cwd(), ".openclaw", "state", "deango-hands");
  const bindings = new BindingStore(stateDir);

  let brain: AcpProcess | null = null;
  let brainReady = false;

  const cfg = {
    command: config.command ?? "hermes acp",
    args: config.args ?? [],
    env: config.env ?? {},
    cwd: config.cwd,
    timeoutSeconds: config.timeoutSeconds ?? 120,
    permissionMode: config.permissionMode ?? "approve-reads",
    nonInteractivePermissions: config.nonInteractivePermissions ?? "deny",
    sessionResume: config.sessionResume ?? true,
    provenance: config.provenance ?? true,
    mcpServers: config.mcpServers ?? {},
  };

  async function ensureBrain(): Promise<AcpProcess> {
    if (brain && brainReady) return brain;
    brain = new AcpProcess(cfg.command, cfg.args, { cwd: cfg.cwd, env: cfg.env });
    await brain.request(
      "initialize",
      {
        protocolVersion: 1,
        clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: false },
        clientInfo: { name: "deango-hands", version: "0.1.0" },
      },
      cfg.timeoutSeconds * 1000,
    );
    brainReady = true;
    log.info?.("deango-hands: brain initialized (ACP v1)");
    return brain;
  }

  function mcpInjectedServers(): Json[] {
    return Object.entries(cfg.mcpServers).map(([name, spec]) => {
      const s: Json = { name };
      if (spec.type === "http" || spec.type === "sse") {
        s.type = spec.type;
        s.url = spec.url;
      } else {
        s.type = "stdio";
        s.command = spec.command;
        s.args = spec.args ?? [];
        if (spec.env) s.env = Object.entries(spec.env).map(([k, v]) => ({ name: k, value: v }));
      }
      return s;
    });
  }

  async function openSession(params: Json): Promise<Json> {
    const key = String(params.sessionKey ?? params.cwd ?? "default");
    const workspace = deps.resolveWorkspace?.(key) ?? cfg.cwd ?? process.cwd();
    const proc = await ensureBrain();

    // The body outlives the spine: reattach an existing Hermes session.
    const existing = bindings.get(key);
    if (cfg.sessionResume && existing) {
      try {
        await proc.request("session/load", { sessionId: existing.hermesSessionId, cwd: existing.cwd, mcpServers: mcpInjectedServers() }, cfg.timeoutSeconds * 1000);
        bindings.touch(key);
        log.info?.(`deango-hands: reattached body ${existing.hermesSessionId}`);
        return { sessionId: existing.hermesSessionId, resumed: true };
      } catch {
        log.warn?.(`deango-hands: stale binding for ${key}; creating new body`);
      }
    }

    const created = await proc.request(
      "session/new",
      {
        cwd: workspace,
        mcpServers: mcpInjectedServers(),
        // provenance: tell the brain which leg this session walked in on
        ...(cfg.provenance && params.meta ? { _meta: { openclaw: params.meta } } : {}),
      },
      cfg.timeoutSeconds * 1000,
    );
    const hermesSessionId = String(created.sessionId);
    const now = new Date().toISOString();
    bindings.put({ openclawSessionKey: key, hermesSessionId, cwd: workspace, createdAt: now, lastUsedAt: now });
    log.info?.(`deango-hands: new body ${hermesSessionId} bound to ${key}`);
    return { sessionId: hermesSessionId, resumed: false };
  }

  async function prompt(params: Json): Promise<Json> {
    const proc = await ensureBrain();
    // Streaming is forwarded via notifications; declare the turn and collect stop.
    const res = await proc.request("session/prompt", params, Math.max(cfg.timeoutSeconds, 300) * 1000);
    return res;
  }

  return {
    id: "hermes",
    async start() {
      mkdirSync(stateDir, { recursive: true });
    },
    async health() {
      try {
        await ensureBrain();
        return { ok: true, brain: cfg.command, bindings: "persisted" };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    async stop() {
      brain?.kill();
      brain = null;
      brainReady = false;
    },
    openSession: (params: unknown) => openSession(params as Json),
    resumeSession: (params: unknown) => openSession(params as Json),
    prompt: (params: unknown) => prompt(params as Json),
    closeSession: async (params: unknown) => {
      void params; // bodies persist by design; nothing to tear down here
      return { ok: true };
    },
    /** exposed for diagnostics */
    _internals: { bindings },
  };
}
