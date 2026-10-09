'use client';

import { useCallback, useEffect, useState } from 'react';
import { deango, type OrganismStatus, type HealthReport, type UnitStatus } from '@/lib/deango-client';

/** Polls the DeanGo engine (via the Next proxy) for organism status + watchdog health. */
export function useOrganism(pollMs = 5000) {
  const [status, setStatus] = useState<OrganismStatus | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);

  const refresh = useCallback(async () => {
    const [s, h] = await Promise.all([
      deango<OrganismStatus>('/status').catch(() => null),
      deango<HealthReport | null>('/health').catch(() => null),
    ]);
    setStatus(s as OrganismStatus | null);
    if (h && !(h as any).offline) setHealth(h as HealthReport);
    return { s, h };
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);

  return { status, health, refresh };
}

export function useUnits() {
  const [units, setUnits] = useState<UnitStatus[]>([]);
  const refresh = useCallback(async () => {
    const u = await deango<{ units?: UnitStatus[] } | UnitStatus[]>('/units').catch(() => []);
    setUnits(Array.isArray(u) ? u : (u as any)?.units || []);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { units, refresh };
}
