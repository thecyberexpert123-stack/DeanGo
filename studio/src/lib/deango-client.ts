/**
 * deango-client.ts — browser-side client. Talks only to our own Next.js
 * proxy (same origin), never to the engine directly.
 */

export interface OrganInfo {
  installed?: boolean;
  version?: string;
  home?: string;
  checkout?: string;
  npmGlobal?: string;
  bins?: { name: string; path: string }[];
}

export interface UnitStatus {
  id: string;
  label?: string;
  cmd?: string;
  args?: string[];
  status?: { running?: boolean; pid?: number };
}

export interface OrganismStatus {
  offline?: boolean;
  complete?: boolean;
  det?: { hermes?: OrganInfo; openclaw?: OrganInfo; system?: Record<string, any> };
  units?: UnitStatus[];
  manifest?: {
    versions?: Record<string, any>;
    apply?: boolean;
    createdAt?: string;
  } | null;
  engine?: { mode?: string; binary?: string | null };
  deangoHome?: string;
}

export interface HealthReport {
  healthy?: boolean;
  driftCount?: number;
  drift?: { field: string; was: unknown; now: unknown }[];
  probe?: { cmd?: string; ok?: boolean; ms?: number; error?: string | null };
  healed?: boolean;
  healActions?: Record<string, any>;
  probeAfterHeal?: { cmd?: string; ok?: boolean; error?: string | null };
  checkedAt?: string;
  versions?: { atConnect?: Record<string, any> | null; now?: Record<string, any> };
}

export async function deango<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch('/api/deango' + path, {
    method: method || (body !== undefined ? 'POST' : 'GET'),
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return (await res.json()) as T;
}

export const isOffline = (x: any): boolean => !x || x.offline === true;
