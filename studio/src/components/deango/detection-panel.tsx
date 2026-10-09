'use client';

import JarvisPanel from '@/components/os/JarvisPanel';
import { Button } from '@/components/ui/button';
import { deango, isOffline, type OrganismStatus } from '@/lib/deango-client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Radar, Wrench } from 'lucide-react';

/**
 * Detection + setup: raw inspection of both bodies, and the official install
 * steps for whatever is missing (plan only — running happens from the CLI).
 */
export default function DetectionPanel({ status, onChanged }: { status: OrganismStatus | null; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [raw, setRaw] = useState<string>('');
  const [setup, setSetup] = useState<string>('');

  const det = status?.det;

  const rescan = async () => {
    setBusy(true);
    const r = (await deango('/scan', {}).catch((e) => ({ offline: true, error: String(e) }))) as any;
    setBusy(false);
    setRaw(JSON.stringify(r, null, 2));
    toast({ title: 'Rescan', description: isOffline(r) ? `engine offline — ${r.error}` : 'detection refreshed', variant: isOffline(r) ? 'destructive' : 'default' });
    onChanged();
  };

  const loadInspection = async () => {
    setBusy(true);
    const r = await deango('/report').catch((e) => ({ error: String(e) }));
    setBusy(false);
    setRaw(JSON.stringify((r as any)?.insp ?? r, null, 2));
  };

  const loadSetup = async () => {
    setBusy(true);
    const r = (await deango('/setup/plan', {}).catch((e) => ({ error: String(e) }))) as any;
    setBusy(false);
    setSetup(
      r?.steps?.length
        ? r.steps.map((s: any) => `# ${s.label}\n${s.command}`).join('\n\n') +
            '\n\n# Execute from the console CLI: deango setup --yes   (interactive steps must be run in your own terminal)'
        : 'nothing to do — both bodies present ✔',
    );
  };

  const organRow = (label: string, o: any) => (
    <tr className="border-b border-primary/5">
      <td className="py-1 pr-3 font-headline uppercase tracking-widest text-primary">{label}</td>
      <td className="py-1 pr-3">
        <span className={o?.installed ? 'text-primary' : 'text-rose-400'}>●</span>{' '}
        <span className="text-foreground/80">{o?.version || 'not installed'}</span>
      </td>
      <td className="truncate py-1 font-mono text-[10px] text-muted-foreground">{o?.home || o?.checkout || '—'}</td>
    </tr>
  );

  return (
    <JarvisPanel title="Detection & Setup" className="w-full">
      <table className="mb-3 w-full text-xs">
        <tbody>
          {organRow('hermes · brain', det?.hermes)}
          {organRow('openclaw · limbs', det?.openclaw)}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={rescan} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/80">
          <Radar size={14} /> rescan
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={loadInspection} className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
          deep inspect
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={loadSetup} className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
          <Wrench size={14} /> setup plan
        </Button>
      </div>
      {raw && <pre className="mt-3 max-h-64 overflow-auto border border-primary/20 bg-black/60 p-3 font-mono text-[10px] text-foreground/80">{raw}</pre>}
      {setup && <pre className="mt-3 max-h-64 overflow-auto border border-primary/20 bg-black/60 p-3 font-mono text-[10px] text-foreground/80">{setup}</pre>}
    </JarvisPanel>
  );
}
