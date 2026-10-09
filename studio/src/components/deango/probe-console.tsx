'use client';

import JarvisPanel from '@/components/os/JarvisPanel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { deango } from '@/lib/deango-client';
import { useState, useRef, useEffect } from 'react';
import { Bot, User, Zap, SendHorizonal } from 'lucide-react';

interface ProbeTurn {
  role: 'user' | 'brain' | 'sys';
  text: string;
  meta?: string;
}

/**
 * The spine console: talk directly to the Hermes brain over ACP.
 * Each prompt rides a full probe (initialize → session/new → session/prompt)
 * so this works with zero state — honest, stateless turns on the live spine.
 */
export default function ProbeConsole({ defaultCmd = 'hermes acp' }: { defaultCmd?: string }) {
  const [cmd, setCmd] = useState(defaultCmd);
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<ProbeTurn[]>([
    { role: 'sys', text: 'Spine console ready. Send a prompt and it rides a live ACP handshake into the brain.' },
  ]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [turns, busy]);

  const send = async (prompt: string | null) => {
    if (busy) return;
    setBusy(true);
    const next: ProbeTurn[] = prompt ? [...turns, { role: 'user', text: prompt }] : turns;
    if (prompt) setTurns(next);
    setInput('');
    const r = (await deango('/acp/probe', { cmd, prompt, permissionPolicy: 'deny' }).catch((e) => ({ offline: true, error: String(e) }))) as any;
    setBusy(false);
    if (r?.offline) {
      setTurns([...next, { role: 'sys', text: `ENGINE OFFLINE — start DeanGo: node deango/bin/deango.mjs gui   (${r.error})` }]);
      return;
    }
    if (!r?.ok) {
      setTurns([...next, { role: 'sys', text: `SPINE HANDSHAKE FAILED — ${r?.error || JSON.stringify(r).slice(0, 300)}` }]);
      return;
    }
    const reply = r.promptError
      ? `brain error: ${r.promptError}`
      : prompt
        ? r.streamedText || `(no streamed text · stopReason=${r.stopReason})`
        : `handshake ok — capabilities: ${JSON.stringify(r.capabilities)}`;
    setTurns([...next, { role: 'brain', text: reply, meta: `stopReason=${r.stopReason ?? '—'} · session ${String(r.sessionId || '').slice(0, 8)}` }]);
  };

  return (
    <JarvisPanel title="Spine Console · ACP" className="w-full">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">agent cmd</span>
        <Input value={cmd} onChange={(e) => setCmd(e.target.value)} className="h-7 border-primary/20 bg-black/40 font-mono text-xs" />
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => send(null)} title="handshake only">
          <Zap size={14} className="text-primary" />
        </Button>
      </div>
      <div className="h-72 space-y-3 overflow-y-auto pr-1">
        {turns.map((t, i) => (
          <div key={i} className={`flex gap-2 ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {t.role !== 'user' && (
              <span className={`mt-0.5 ${t.role === 'sys' ? 'text-amber-400' : 'text-primary'}`}>
                <Bot size={14} />
              </span>
            )}
            <div className="max-w-[85%]">
              <div
                className={`border px-3 py-2 text-xs whitespace-pre-wrap ${
                  t.role === 'user'
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : t.role === 'sys'
                      ? 'border-amber-400/30 bg-amber-400/5 text-amber-300/90'
                      : 'border-primary/20 bg-black/40 text-foreground/90'
                }`}
              >
                {t.text}
              </div>
              {t.meta && <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">{t.meta}</div>}
            </div>
            {t.role === 'user' && (
              <span className="mt-0.5 text-foreground/70">
                <User size={14} />
              </span>
            )}
          </div>
        ))}
        {busy && <div className="text-xs text-primary animate-pulse">▍probing the spine…</div>}
        <div ref={endRef} />
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) send(input.trim());
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say something to the brain — e.g. Reply with exactly: the body is online."
          className="border-primary/20 bg-black/40 text-xs"
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} className="bg-primary text-primary-foreground hover:bg-primary/80">
          <SendHorizonal size={14} />
        </Button>
      </form>
    </JarvisPanel>
  );
}
