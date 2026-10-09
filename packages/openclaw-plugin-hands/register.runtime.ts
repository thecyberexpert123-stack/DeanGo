/**
 * @deango/hands — runtime registration (OpenClaw plugin entrypoint).
 *
 * Follows the acpx registration pattern (extensions/acpx/register.runtime.ts):
 * publish an ACP runtime backend immediately, lazily import the heavier
 * service only when a session actually needs the brain.
 *
 * UPDATE-RESILIENCE CONTRACT: this file imports ONLY from openclaw/plugin-sdk/*
 * barrels — the import surface OpenClaw guarantees for plugins (see
 * docs/agent-runtime-architecture.md: plugins "do not import src/** internals").
 * If plugin-sdk ever changes shape, THIS file is the single adapter to adjust.
 */
import {
  getAcpRuntimeBackend,
  registerAcpRuntimeBackend,
  unregisterAcpRuntimeBackend,
} from "openclaw/plugin-sdk/acp-runtime-backend";
import type {
  OpenClawPluginService,
  OpenClawPluginServiceContext,
} from "openclaw/plugin-sdk/core";

/** The brain's runtime id as it appears to OpenClaw (agentRuntime / harness pickers). */
export const HERMES_BACKEND_ID = "hermes";

type HandsServiceModule = typeof import("./src/service.js");
type HandsService = ReturnType<HandsServiceModule["createHandsService"]>;

type DeferredModule = { load(): Promise<HandsServiceModule> };

// Structural stand-in for the SDK's createLazyRuntimeModule helper: deferred
// dynamic import so plugin activation stays cheap. (acpx uses the SDK helper;
// the shape is identical.)
async function loadService(): Promise<HandsServiceModule> {

  return await import("./src/service.js");
}

class HermesBackendProxy {
  readonly id = HERMES_BACKEND_ID;
  #real: HandsService | null = null;
  #starting: Promise<HandsService> | null = null;
  #ctx: OpenClawPluginServiceContext;

  constructor(ctx: OpenClawPluginServiceContext) {
    this.#ctx = ctx;
  }

  async #ensure(): Promise<HandsService> {
    if (this.#real) return this.#real;
    this.#starting ??= (async () => {
      const { createHandsService } = await loadService();
      const svc = createHandsService(this.#ctx, (this.#ctx.pluginConfig ?? {}) as Record<string, unknown>);
      await svc.start();
      this.#real = svc;
      return svc;
    })();
    return this.#starting;
  }

  async health(): Promise<unknown> {
    return (await this.#ensure()).health();
  }

  async stop(): Promise<void> {
    const real = this.#real;
    this.#real = null;
    this.#starting = null;
    if (real) await real.stop();
  }

  // ACP session operations — fanned through to the service with the exact
  // param objects the gateway passes (kept as unknown here on purpose).
  openSession(params: unknown): Promise<unknown> {
    return this.#ensure().then((r) => r.openSession(params));
  }
  resumeSession(params: unknown): Promise<unknown> {
    return this.#ensure().then((r) => r.resumeSession(params));
  }
  prompt(params: unknown): Promise<unknown> {
    return this.#ensure().then((r) => r.prompt(params));
  }
  closeSession(params: unknown): Promise<unknown> {
    return this.#ensure().then((r) => r.closeSession(params));
  }
}

const service: OpenClawPluginService = {
  id: "deango-hands",
  async start(ctx: OpenClawPluginServiceContext): Promise<void> {
    const existing = getAcpRuntimeBackend(HERMES_BACKEND_ID) as { runtime?: unknown } | undefined;
    if (existing?.runtime instanceof HermesBackendProxy) {
      unregisterAcpRuntimeBackend(HERMES_BACKEND_ID);
    }
    registerAcpRuntimeBackend(HERMES_BACKEND_ID, {
      runtime: new HermesBackendProxy(ctx),
    } as never);
    ctx.logger?.info?.("deango-hands: 'hermes' ACP runtime backend registered (brain online-on-demand)");
  },
  async stop(): Promise<void> {
    const existing = getAcpRuntimeBackend(HERMES_BACKEND_ID) as { runtime?: unknown } | undefined;
    if (existing?.runtime instanceof HermesBackendProxy) {
      await (existing.runtime as HermesBackendProxy).stop();
      unregisterAcpRuntimeBackend(HERMES_BACKEND_ID);
    }
  },
};

export default service;
