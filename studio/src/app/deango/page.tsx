'use client';

import Link from 'next/link';
import { useOrganism } from '@/hooks/use-deango';
import { isOffline } from '@/lib/deango-client';
import OrganMap from '@/components/deango/organ-map';
import UnitsPanel from '@/components/deango/units-panel';
import ProbeConsole from '@/components/deango/probe-console';
import WatchdogPanel from '@/components/deango/watchdog-panel';
import ConnectionPanel from '@/components/deango/connection-panel';
import DetectionPanel from '@/components/deango/detection-panel';
import JarvisPanel from '@/components/os/JarvisPanel';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DeangoConsole() {
  const { status, health, refresh } = useOrganism(5000);

  const engineOff = !status || isOffline(status);
  const det = status?.det || {};
  const units = status?.units || [];
  const gatewayRunning = units.some((u) => u.id === 'openclaw-gateway' && u.status?.running);
  const spineOk = health?.probe?.ok ?? null;
  const alive = !!status?.complete && gatewayRunning;

  const brainStatus = engineOff ? 'engine-off' : spineOk ? 'online' : det.hermes?.installed ? 'standby' : 'offline';
  const limbsStatus = engineOff ? 'engine-off' : gatewayRunning ? 'online' : det.openclaw?.installed ? 'standby' : 'offline';
  const spineCmd = (health?.probe?.cmd && !health.probe.cmd.includes('mock')) ? health.probe.cmd : 'hermes acp';

  return (
    <div className="min-h-screen bg-background p-4 font-headline text-primary/90 md:p-6">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/" className="flex items-center gap-2 border border-primary/30 px-3 py-1.5 text-xs tracking-widest text-primary transition-all hover:bg-primary/10 hover:shadow-[0_0_15px_hsl(var(--primary)/0.3)]">
          <ArrowLeft size={14} /> NEON OS
        </Link>
        <h1 className="text-lg font-bold tracking-[0.2em] text-primary">DEANGO // ORGANISM CONSOLE</h1>
        <span
          className={`border px-2.5 py-1 text-[10px] tracking-widest ${
            alive ? 'border-primary text-primary' : engineOff ? 'border-rose-400/50 text-rose-400' : 'border-amber-400/50 text-amber-400'
          }`}
        >
          {engineOff ? 'ENGINE OFFLINE' : alive ? 'ORGANISM ALIVE' : status?.complete ? 'BODIES FOUND · READY' : 'BODIES MISSING'}
        </span>
        <span className="border border-primary/30 px-2.5 py-1 text-[10px] tracking-widest text-muted-foreground">
          engine: {status?.engine?.mode || '—'}
        </span>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={refresh} className="gap-2 text-primary hover:bg-primary/10">
          <RefreshCw size={14} /> rescan
        </Button>
      </div>

      {engineOff && (
        <div className="mb-4 border border-rose-400/40 bg-rose-400/5 p-4 text-xs text-rose-300">
          <span className="font-bold tracking-widest">DEANGO ENGINE NOT REACHABLE</span>
          <span className="mx-2 text-rose-400/60">·</span>
          start it in a terminal: <code className="font-mono text-primary">node deango/bin/deango.mjs gui --port 7788</code>
          <span className="mx-2 text-rose-400/60">·</span>
          or set <code className="font-mono text-primary">DEANGO_API</code> to a running engine.
          <div className="mt-1 font-mono text-[10px] text-rose-300/60">{(status as any)?.error || 'no response from upstream'}</div>
        </div>
      )}

      {/* the living schematic */}
      <JarvisPanel title="The Organism" className="mb-4 w-full">
        <OrganMap
          brainStatus={brainStatus}
          limbsStatus={limbsStatus}
          spineOk={engineOff ? null : spineOk}
          gatewayRunning={gatewayRunning}
          brainVersion={det.hermes?.version}
          limbsVersion={det.openclaw?.version}
        />
      </JarvisPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ProbeConsole defaultCmd={spineCmd} />
        <div className="space-y-4">
          <UnitsPanel units={units} onChanged={refresh} />
          <WatchdogPanel health={health} onChanged={refresh} />
        </div>
        <ConnectionPanel status={status} onChanged={refresh} />
        <DetectionPanel status={status} onChanged={refresh} />
      </div>

      <div className="mt-6 text-center font-mono text-[10px] tracking-widest text-muted-foreground">
        DEANGO — operator console for the bridged organism · brain=HERMES · limbs=OPENCLAW · spine=ACP/v1 · watchdog=compat
      </div>
    </div>
  );
}
