'use client';

import JarvisPanel from '@/components/os/JarvisPanel';
import { Button } from '@/components/ui/button';
import { deango, isOffline, type HealthReport } from '@/lib/deango-client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Stethoscope, RefreshCw } from 'lucide-react';

/** The update watchdog: drift diff vs the connection manifest + live spine probe + self-heal. */
export default function WatchdogPanel({ health, onChanged }: { health: HealthReport | null; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<'' | 'check' | 'heal'>('');

  const run = async (heal: boolean) => {
    setBusy(heal ? 'heal' : 'check');
    const r = (await deango('/compat',{ heal }).catch((e) => ({ offline: true, error: String(e) }))) as any;
    setBusy('');
    if (isOffline(r)) {
      toast({ title: 'Engine offline', description: r.error, variant: 'destructive' });
    } else {
      toast({
        title: r.healthy ? 'Organism healthy' : r.healed ? 'Heal ran — spine still failing' : 'Drift / spine issue found',
        description: r.healthy
          ? `probe ok in ${r.probe?.ms}ms · ${r.driftCount} drift fields`
          : `probe=${r.probe?.ok ? 'ok' : 'FAIL'} · drift=${r.driftCount}${r.probeAfterHeal ? ' · after heal: ' + (r.probeAfterHeal.ok ? 'ok' : 'BROKEN') : ''}`,
        variant: r.healthy ? 'default' : 'destructive',
      });
    }
    onChanged();
  };

  const h = health;
  const driftRows = (h?.drift || []) as { field: string; was: unknown; now: unknown }[];

  return (
    <JarvisPanel title="Update Watchdog" className="w-full">
      <p className="mb-3 text-xs text-muted-foreground">
        After either body self-updates, DeanGo diffs versions and locations against the connection manifest and
        re-probes the live ACP spine. Heal re-renders every connection file in place — merges are never upgraded
        silently.
      </p>
      <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-3">
        <div className="text-muted-foreground">healthy</div>
        <div className={h?.healthy ? 'text-primary' : 'text-rose-400'}>{h ? String(!!h.healthy) : '—'}</div>
        <div className="text-muted-foreground">drift fields</div>
        <div className={h?.driftCount ? 'text-amber-400' : ''}>{h?.driftCount ?? '—'}</div>
        <div className="text-muted-foreground">spine probe</div>
        <div className={h?.probe?.ok ? 'text-primary' : h ? 'text-rose-400' : ''}>
          {h ? `${h.probe?.ok ? 'ok' : 'FAILED'} · ${h.probe?.ms}ms` : '—'}
        </div>
        <div className="text-muted-foreground">healed</div>
        <div>
          {h ? String(!!h.healed) : '—'}
          {h?.probeAfterHeal ? (h.probeAfterHeal.ok ? ' → ok' : ' → STILL BROKEN') : ''}
        </div>
        <div className="text-muted-foreground">checked at</div>
        <div className="font-mono text-[10px]">{h?.checkedAt || '—'}</div>
        <div className="text-muted-foreground">probe cmd</div>
        <div className="truncate font-mono text-[10px]">{h?.probe?.cmd || '—'}</div>
      </div>
      {driftRows.length > 0 && (
        <div className="mb-3 border border-amber-400/20 bg-amber-400/5 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-amber-300">drift detected</div>
          {driftRows.map((d) => (
            <div key={d.field} className="font-mono text-[10px] text-amber-200/80">
              {d.field}: <span className="text-rose-300/80">{JSON.stringify(d.was)}</span> →{' '}
              <span className="text-primary/90">{JSON.stringify(d.now)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy !== ''} onClick={() => run(false)} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/80">
          <Stethoscope size={14} /> {busy === 'check' ? 'checking…' : 'check'}
        </Button>
        <Button size="sm" variant="outline" disabled={busy !== ''} onClick={() => run(true)} className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
          <RefreshCw size={14} /> {busy === 'heal' ? 'healing…' : 'check + heal'}
        </Button>
      </div>
    </JarvisPanel>
  );
}
