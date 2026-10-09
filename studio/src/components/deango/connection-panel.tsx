'use client';

import JarvisPanel from '@/components/os/JarvisPanel';
import { Button } from '@/components/ui/button';
import { deango, isOffline, type OrganismStatus } from '@/lib/deango-client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Hammer, GitMerge, FileJson } from 'lucide-react';

const ORGAN_LINES = [
  ['brain', 'hermes', 'turn loop · memory · 212 skills · learning · persona'],
  ['limbs', 'openclaw', 'channels · devices · approvals · artifacts · ledger'],
  ['hands', 'acpx mcp bridges', 'openClawToolsMcpBridge · pluginToolsMcpBridge'],
  ['legs', 'channels', 'whatsapp · telegram · slack · discord · sms · voice …'],
];

/** Connection: render/build/merge the DeanGo connection files + organism role map. */
export default function ConnectionPanel({ status, onChanged }: { status: OrganismStatus | null; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>('');

  const act = async (path: string, body: any, label: string) => {
    setBusy(true);
    const r = (await deango(path, body).catch((e) => ({ offline: true, error: String(e) }))) as any;
    setBusy(false);
    setResult(JSON.stringify(r, null, 2));
    toast({
      title: label,
      description: isOffline(r) ? `engine offline — ${r.error}` : r?.error ? String(r.error) : r?.written ? `${r.written.length} file(s) · ${r.merges?.length || 0} merge(s)` : 'done',
      variant: isOffline(r) || r?.error ? 'destructive' : 'default',
    });
    onChanged();
  };

  const v = status?.manifest?.versions;

  return (
    <JarvisPanel title="Connection & Organism" className="w-full">
      <div className="mb-3 border border-primary/10 bg-black/30 p-3">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">organism.json — role assignment · spine contract acp/v1</div>
        <table className="w-full text-xs">
          <tbody>
            {ORGAN_LINES.map(([organ, who, does]) => (
              <tr key={organ} className="border-b border-primary/5">
                <td className="py-1 pr-3 font-headline uppercase tracking-widest text-primary">{organ}</td>
                <td className="py-1 pr-3 text-foreground/80">{who}</td>
                <td className="py-1 text-muted-foreground">{does}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {v && (
        <div className="mb-3 font-mono text-[10px] text-muted-foreground">
          snapshot @connect — hermes:{String(v.hermes ?? '—')} openclaw:{String(v.openclaw ?? '—')} home:{String(v.hermesHome ?? '—')}
          {status?.manifest?.apply ? ' · merges applied' : ' · merges NOT applied'}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act('/connection/plan', {}, 'render plan')} className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
          <FileJson size={14} /> plan
        </Button>
        <Button size="sm" disabled={busy} onClick={() => act('/connection/build', { apply: false }, 'build')} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/80">
          <Hammer size={14} /> build → ~/.deango
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act('/connection/build', { apply: true }, 'build + merge')} className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
          <GitMerge size={14} /> build + merge live configs
        </Button>
      </div>
      {result && <pre className="mt-3 max-h-64 overflow-auto border border-primary/20 bg-black/60 p-3 font-mono text-[10px] text-foreground/80">{result}</pre>}
    </JarvisPanel>
  );
}
