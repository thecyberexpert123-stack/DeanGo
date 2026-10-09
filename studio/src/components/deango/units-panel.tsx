'use client';

import JarvisPanel from '@/components/os/JarvisPanel';
import { Button } from '@/components/ui/button';
import { deango, type UnitStatus } from '@/lib/deango-client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Play, Square, ScrollText, Cpu } from 'lucide-react';

const Dot = ({ on }: { on: boolean | undefined }) => (
  <span className={`inline-block h-2 w-2 rounded-full ${on ? 'bg-primary shadow-[0_0_8px_hsl(var(--primary))]' : 'bg-rose-500'}`} />
);

export default function UnitsPanel({ units, onChanged }: { units: UnitStatus[]; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string>('');
  const [logUnit, setLogUnit] = useState<string>('');
  const [logText, setLogText] = useState<string>('');

  const act = async (unit: UnitStatus, action: 'start' | 'stop') => {
    setBusy(unit.id + action);
    const r = (await deango(`/unit/${action}`, { id: unit.id }).catch((e) => ({ error: String(e) }))) as any;
    setBusy('');
    toast({
      title: `${action} · ${unit.label || unit.id}`,
      description: r?.error ? String(r.error).slice(0, 140) : 'ok',
      variant: r?.error ? 'destructive' : 'default',
    });
    onChanged();
  };

  const tailLog = async (unit: UnitStatus) => {
    setLogUnit(unit.id);
    const r = (await deango(`/unit/log?id=${encodeURIComponent(unit.id)}&lines=120`).catch((e) => ({ log: String(e) }))) as any;
    setLogText(r?.log || '(empty)');
  };

  return (
    <JarvisPanel title="Processes" className="w-full">
      {!units.length && (
        <p className="text-xs text-muted-foreground">
          No supervised units yet — build the connection first, then the organism’s processes appear here.
        </p>
      )}
      <div className="space-y-3">
        {units.map((u) => (
          <div key={u.id} className="border border-primary/10 p-3">
            <div className="flex items-center gap-3">
              <Dot on={u.status?.running} />
              <div className="flex-1 min-w-0">
                <div className="text-xs tracking-widest text-primary truncate">{u.label || u.id}</div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">
                  {u.cmd} {(u.args || []).join(' ')} {u.status?.pid ? `· pid ${u.status.pid}` : ''}
                </div>
              </div>
              <Button size="icon" variant="ghost" disabled={busy !== ''} onClick={() => act(u, 'start')} title="start">
                <Play size={14} className="text-primary" />
              </Button>
              <Button size="icon" variant="ghost" disabled={busy !== ''} onClick={() => act(u, 'stop')} title="stop">
                <Square size={14} className="text-rose-400" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => tailLog(u)} title="tail log">
                <ScrollText size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>
      {logUnit && (
        <pre className="mt-3 max-h-56 overflow-auto border border-primary/20 bg-black/60 p-3 font-mono text-[10px] text-foreground/80">
          <Cpu size={12} className="mb-1 text-primary" /> {logUnit}
          {'\n'}
          {logText}
        </pre>
      )}
    </JarvisPanel>
  );
}
