/**
 * acp.mjs — DeanGo's ACP v1 stdio client (the spine feeler).
 * Speaks newline-delimited JSON-RPC to an agent process (default: hermes acp),
 * answers client-direction requests with configurable policies, and can run a
 * full probe: initialize → session/new → optional streamed prompt.
 */
import { spawn } from "node:child_process";
import readline from "node:readline";

export const PROTOCOL_VERSION = 1;

export class AcpClient {
  constructor(cmd, args = [], { cwd = process.cwd(), env = {}, permissionPolicy = "deny" } = {}) {
    this.proc = spawn(cmd, args, { cwd, env: { ...process.env, ...env } });
    this.nextId = 1;
    this.pending = new Map();
    this.notificationHandlers = [];
    this.permissionPolicy = permissionPolicy;
    this.agentLog = [];
    this.dead = null; // set once the process is unusable

    // Fail fast when the brain can't start or dies mid-turn: reject every
    // pending RPC instead of letting callers hang until timeout.
    const killPending = (err) => {
      this.dead = err;
      for (const { reject } of this.pending.values()) reject(err);
      this.pending.clear();
    };
    this.proc.on("error", (e) => killPending(new Error(`spawn failed for "${cmd}": ${e.message}`)));
    this.proc.on("close", (code) => killPending(new Error(`agent process exited (code ${code})${this.agentLog.length ? " — last output: " + this.agentLog.at(-1).trim().slice(0, 300) : ""}`)));

    this.proc.stderr?.on("data", (d) => {
      const s = d.toString();
      this.agentLog.push(s);
      if (this.agentLog.length > 200) this.agentLog.shift();
    });

    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on("line", (line) => {
      let msg; try { msg = JSON.parse(line); } catch { return; }
      if (msg.method && msg.id !== undefined) this.#onAgentRequest(msg);
      else if (msg.method) this.notificationHandlers.forEach((h) => h(msg));
      else if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        resolve(msg);
      }
    });
  }

  #write(msg) { this.proc.stdin.write(JSON.stringify(msg) + "\n"); }

  request(method, params = {}, timeoutMs = 60000) {
    if (this.dead) return Promise.reject(this.dead);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method}: timeout`)); }, timeoutMs);
      this.pending.set(id, {
        resolve: (msg) => {
          clearTimeout(timer);
          if (msg.error) reject(new Error(`${method}: RPC ${msg.error.code}: ${msg.error.message}`));
          else resolve(msg.result ?? {});
        },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      try { this.#write({ jsonrpc: "2.0", id, method, params }); }
      catch (e) { clearTimeout(timer); this.pending.delete(id); reject(e); }
    });
  }

  onNotification(handler) { this.notificationHandlers.push(handler); }

  #respond(id, result, error) {
    const msg = { jsonrpc: "2.0", id };
    if (error) msg.error = error; else msg.result = result;
    this.#write(msg);
  }

  #onAgentRequest(msg) {
    const { method, id, params } = msg;
    if (method === "session/request_permission") {
      if (this.permissionPolicy === "allow-once") {
        const optionId = params?.options?.[0]?.id || "allow-once";
        this.#respond(id, { outcome: { outcome: "selected", optionId } });
      } else {
        this.#respond(id, { outcome: { outcome: "cancelled" } });
      }
      return;
    }
    this.#respond(id, null, { code: -32601, message: `not implemented by DeanGo probe: ${method}` });
  }

  close() {
    try { this.proc.stdin?.end(); } catch {}
    try { this.proc.kill("SIGTERM"); } catch {}
    setTimeout(() => { try { this.proc.kill("SIGKILL"); } catch {} }, 3000).unref();
  }
}

/** Full probe used by CLI + GUI. Returns structured result with transcript. */
export async function probeAcp(agentCmd, { prompt = null, listSessions = false, timeoutMs = 90000, permissionPolicy = "deny" } = {}) {
  const [cmd, ...args] = agentCmd.split(" ").filter(Boolean);
  const client = new AcpClient(cmd, args, { permissionPolicy });
  const transcript = [];
  const chunks = [];
  try {
    return await runProbe(client, { prompt, listSessions, timeoutMs, transcript, chunks });
  } catch (e) {
    return { ok: false, error: String(e.message || e), transcript, agentLogTail: client.agentLog.slice(-20) };
  } finally {
    client.close();
  }
}

async function runProbe(client, { prompt, listSessions, timeoutMs, transcript, chunks }) {
    const init = await client.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: false },
      clientInfo: { name: "deango-probe", version: "0.1.0" },
    }, timeoutMs);
    transcript.push({ dir: "→", method: "initialize" }, { dir: "←", result: init });

    let sessions = null;
    if (listSessions) {
      try { sessions = (await client.request("session/list", {}, timeoutMs)).sessions ?? []; }
      catch (e) { sessions = { error: String(e) }; }
    }

    const created = await client.request("session/new", { cwd: process.cwd(), mcpServers: [] }, timeoutMs);
    const sessionId = created.sessionId;

    let stopReason = null, promptError = null;
    if (prompt) {
      client.onNotification((msg) => {
        if (msg.method === "session/update") {
          const u = msg.params?.update || {};
          if (u.sessionUpdate === "agent_message_chunk") chunks.push(u.content?.text || "");
          transcript.push({ dir: "←notify", update: u.sessionUpdate });
        }
      });
      try {
        const res = await client.request("session/prompt", {
          sessionId, prompt: [{ type: "text", text: prompt }],
        }, timeoutMs);
        stopReason = res.stopReason;
      } catch (e) { promptError = String(e); }
    }

    return {
      ok: true,
      initialize: init,
      capabilities: {
        loadSession: !!init.agentCapabilities?.loadSession,
        sessionList: "list" in (init.agentCapabilities?.sessionCapabilities || {}),
        sessionResume: "resume" in (init.agentCapabilities?.sessionCapabilities || {}),
        sessionFork: "fork" in (init.agentCapabilities?.sessionCapabilities || {}),
        mcp: init.agentCapabilities?.mcpCapabilities || null,
        prompt: init.agentCapabilities?.promptCapabilities || null,
        authMethods: (init.authMethods || []).map((a) => a.id),
      },
      sessionId, sessions,
      models: created.models || null, modes: created.modes || null,
      streamedText: chunks.join(""), stopReason, promptError,
      transcript,
    };
}
