/**
 * deango.ts — server-side bridge from the Neon OS GUI to the DeanGo engine.
 *
 * The browser never talks to the engine directly. Next.js route handlers
 * (src/app/api/deango/[...parts]) proxy every call to the DeanGo console API
 * (`deango gui`, default :7788) — which itself routes through the Go core when
 * built, else the Node core. Set DEANGO_API to point at a remote engine.
 */

export const deangoUpstream = () =>
  (process.env.DEANGO_API || 'http://127.0.0.1:7788').replace(/\/+$/, '');

export interface DeangoOffline {
  offline: true;
  error: string;
  upstream: string;
}

export async function deangoFetch(
  path: string, // path relative to the engine's /api, e.g. "/status"
  init?: { method?: string; body?: unknown; timeoutMs?: number },
): Promise<any | DeangoOffline> {
  try {
    const res = await fetch(`${deangoUpstream()}/api${path}`, {
      method: init?.method || 'GET',
      headers: init?.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(init?.timeoutMs ?? 300_000),
    });
    return await res.json();
  } catch (e) {
    return { offline: true, error: String(e), upstream: deangoUpstream() };
  }
}
