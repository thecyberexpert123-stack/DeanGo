'use client';

import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

/**
 * Boot sequence v2 — a single clock drives the entire show.
 * One requestAnimationFrame loop produces `progress` (0→100 over 8s), and
 * every visual element derives from it: the progress ring, tick ring,
 * phase gating, live log, segmented bar, percentage, ignition. Nothing is
 * left to baked CSS delays, so the choreography can never desync.
 * SSR/hydration safe: initial progress is 0 on both sides; the only
 * randomness is particle geometry, generated client-side post-mount.
 */

const TOTAL_MS = 8000;

const PHASES = [
  { at: 0, code: 'PHASE 01', label: 'BOOTSTRAP SEQUENCE' },
  { at: 14, code: 'PHASE 02', label: 'REACTOR LATTICE ONLINE' },
  { at: 34, code: 'PHASE 03', label: 'HEURISTIC GYRO ALIGNMENT' },
  { at: 56, code: 'PHASE 04', label: 'NEURAL PARTICLE FLUX' },
  { at: 72, code: 'PHASE 05', label: 'CORE IGNITION' },
  { at: 90, code: 'READY', label: 'ALL SYSTEMS NOMINAL' },
];

type LogLevel = 'sys' | 'ok' | 'ai' | 'net' | 'warn' | 'final';
const LOG_STYLE: Record<LogLevel, string> = {
  sys: 'text-primary/70',
  ok: 'text-primary',
  ai: 'text-accent',
  net: 'text-primary/90',
  warn: 'text-amber-400',
  final: 'text-accent font-bold',
};
const LOG_LINES: { t: number; level: LogLevel; text: string }[] = [
  { t: 0, level: 'sys', text: 'NEON OS v1.0 // KERNEL J.A.R.V.I.S.' },
  { t: 3, level: 'ok', text: '[0.241] SECURE CHANNEL..........ENCRYPTED' },
  { t: 8, level: 'ok', text: '[0.640] MEM CHECK 128 ZB..............OK' },
  { t: 14, level: 'ok', text: '[1.122] ARK-2500 REACTOR.........STABLE' },
  { t: 20, level: 'ok', text: '[1.604] THERMAL LATTICE.........NOMINAL' },
  { t: 26, level: 'ai', text: '[2.087] LOADING AI CORE............47%' },
  { t: 34, level: 'ai', text: '[2.723] HEURISTIC MATRICES......ALIGNED' },
  { t: 42, level: 'ai', text: '[3.362] Q-ENTANGLEMENT..........SYNCED' },
  { t: 50, level: 'net', text: '[4.001] SENSORY INPUT...........ONLINE' },
  { t: 56, level: 'net', text: '[4.487] GLOBAL COMMS............ONLINE' },
  { t: 63, level: 'net', text: '[5.044] SATELLITE UPLINK.........LOCKED' },
  { t: 72, level: 'warn', text: '[5.767] CORE IGNITION...........PRIMED' },
  { t: 82, level: 'ok', text: '[6.569] ALL SYSTEMS.............NOMINAL' },
  { t: 93, level: 'final', text: '[7.440] WELCOME, SIR.' },
];

const R_PROGRESS = 186;
const CIRC = 2 * Math.PI * R_PROGRESS;
const TICKS = 72;
const SEGMENTS = 40;
const EQ_BARS = 26;

const StartupAnimation = () => {
  const [progress, setProgress] = useState(0);
  const [particleStyles, setParticleStyles] = useState<React.CSSProperties[]>([]);
  const [burstOn, setBurstOn] = useState(0); // 0 = off, 1 = ignition burst, 2 = re-burst
  const frameRef = useRef(0);

  useEffect(() => {
    // The master clock.
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(100, ((now - t0) / TOTAL_MS) * 100);
      setProgress(p);
      if (p < 100) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  useEffect(() => {
    // Particle geometry is client-only (hydration-safe: array is empty on SSR).
    setParticleStyles(
      Array.from({ length: 30 }).map(() => ({
        '--angle': `${Math.random() * 360}deg`,
        '--delay': `${Math.random() * 2.5}s`,
        '--duration': `${Math.random() * 1.6 + 1.4}s`,
        opacity: 1,
        animationIterationCount: 'infinite',
      } as React.CSSProperties)),
    );
  }, []);

  // Ignition + a second re-flash near the finale (re-mounts restart the CSS).
  useEffect(() => {
    setBurstOn((b) => (progress >= 94 ? 2 : progress >= 72 ? Math.max(b, 1) : b));
  }, [progress]);

  const pct = Math.floor(progress);
  const elapsed = ((progress / 100) * (TOTAL_MS / 1000)).toFixed(3);
  const phase = [...PHASES].reverse().find((p) => progress >= p.at) || PHASES[0];
  const visibleLog = LOG_LINES.filter((l) => l.t <= progress).slice(-7);
  const litTicks = Math.floor((progress / 100) * TICKS);
  const litSegs = Math.floor((progress / 100) * SEGMENTS);
  const showHex = progress >= 14;
  const showGyro = progress >= 34;
  const showFlux = progress >= 56;
  const showCore = progress >= 72;
  const showJarvis = progress >= 78;
  const granted = progress >= 97;

  return (
    <div
      className={cn(
        'relative flex h-screen w-screen flex-col overflow-hidden bg-background text-primary',
        burstOn === 1 && 'animate-boot-screen-shake-now',
      )}
    >
      {/* ── backdrop ─────────────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0 animate-boot-grid-pan opacity-70"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--primary)/0.05) 1px, transparent 1px),
            linear-gradient(to right, hsl(var(--primary)/0.05) 1px, transparent 1px)`,
          backgroundSize: '2rem 2rem, 2rem 2rem',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '100% 3px',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,black_100%)]" />
      <div className="absolute top-0 left-0 h-full w-full animate-boot-scanner bg-gradient-to-b from-primary/10 to-transparent opacity-0" />

      {/* corner brackets */}
      {[
        'top-3 left-3 border-t-2 border-l-2',
        'top-3 right-3 border-t-2 border-r-2',
        'bottom-3 left-3 border-b-2 border-l-2',
        'bottom-3 right-3 border-b-2 border-r-2',
      ].map((c) => (
        <div key={c} className={cn('absolute z-20 h-10 w-10 border-primary/40', c)} />
      ))}

      {/* top progress hairline */}
      <div className="absolute left-0 top-0 z-30 h-[3px] w-full bg-primary/10">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent shadow-[0_0_12px_hsl(var(--primary))] transition-[width] duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── top bar ──────────────────────────────────────────────── */}
      <header className="relative z-20 flex items-center justify-between px-6 pt-5 font-orbitron md:px-10">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center border border-primary/50 shadow-[0_0_15px_hsl(var(--primary)/0.3)]">
            <span className="text-lg font-black">N</span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-[0.3em]">NEON OS</div>
            <div className="text-[10px] tracking-[0.35em] text-primary/60">BOOTLOADER v1.0</div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-[10px] tracking-[0.25em] text-primary/70">
          <span className="hidden items-center gap-2 md:flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-cargo-dot" />
            SECURE // ENCRYPTED
          </span>
          <span className="tabular-nums md:hidden">T+{elapsed}</span>
          <span className="hidden tabular-nums md:block">T+{elapsed}s</span>
        </div>
      </header>

      {/* ── center: reactor core ─────────────────────────────────── */}
      <main className="relative z-10 flex flex-1 items-center justify-center">
        <div className="relative h-[46vh] w-[46vh] max-h-[480px] max-w-[480px] min-h-[300px] min-w-[300px]">
          <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full overflow-visible fill-none">
            <defs>
              <filter id="ultraGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="coreGradient">
                <stop offset="0%" stopColor="hsl(var(--accent))" />
                <stop offset="100%" stopColor="hsl(var(--primary))" />
              </radialGradient>
            </defs>

            {/* tick ring — lights up with progress */}
            <g transform="translate(200 200)" strokeWidth="1.5">
              {Array.from({ length: TICKS }).map((_, i) => {
                const lit = i < litTicks;
                return (
                  <line
                    key={i}
                    x1="0" y1="-164" x2="0" y2={i % 6 === 0 ? '-157' : '-160'}
                    transform={`rotate(${(360 / TICKS) * i})`}
                    stroke={lit ? 'hsl(var(--primary))' : 'hsl(var(--primary)/0.12)'}
                  />
                );
              })}
            </g>

            {/* progress ring */}
            <g transform="translate(200 200) rotate(-90)">
              <circle r={R_PROGRESS} stroke="hsl(var(--primary)/0.12)" strokeWidth="3" />
              <circle
                r={R_PROGRESS}
                stroke="hsl(var(--primary))"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - progress / 100)}
                className="transition-[stroke-dashoffset] duration-100 ease-linear [filter:drop-shadow(0_0_6px_hsl(var(--primary)))]"
              />
            </g>

            {/* flowing segment rings (counter-rotating dash streams) */}
            <g transform="translate(200 200)" className="animate-[spin_18s_linear_infinite]" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
              <circle r="150" stroke="hsl(var(--primary)/0.4)" strokeWidth="1" strokeDasharray="30 20" className="animate-ring-dash-flow" />
            </g>
            <g transform="translate(200 200)" className="animate-[spin_26s_linear_infinite_reverse]" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
              <circle r="138" stroke="hsl(var(--accent)/0.35)" strokeWidth="0.75" strokeDasharray="8 14" />
            </g>

            {/* orbiting satellites */}
            {progress >= 20 && (
              <g transform="translate(200 200)" className="animate-[spin_7s_linear_infinite]" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                <circle cx="150" cy="0" r="2.5" fill="hsl(var(--accent))" />
                <circle cx="-150" cy="0" r="1.5" fill="hsl(var(--primary)/0.7)" />
              </g>
            )}
            {progress >= 45 && (
              <g transform="translate(200 200)" className="animate-[spin_10s_linear_infinite_reverse]" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                <circle cx="0" cy="-138" r="2" fill="hsl(var(--primary))" />
                <circle cx="0" cy="138" r="1.2" fill="hsl(var(--accent)/0.8)" />
              </g>
            )}

            {/* hexa lattice — phase 2 */}
            <g
              filter="url(#ultraGlow)"
              className={cn('transition-opacity duration-700', showHex ? 'opacity-100' : 'opacity-0')}
              stroke="hsl(var(--primary))"
            >
              <path d="M200 50 L329.9 125 L329.9 275 L200 350 L70.1 275 L70.1 125 Z" strokeWidth="3" />
              <path d="M200 80 L295.26 140 L295.26 260 L200 320 L104.74 260 L104.74 140 Z" strokeWidth="1.5" strokeDasharray="4 6" />
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <path
                  key={i}
                  transform={`rotate(${i * 60} 200 200)`}
                  d="M 200 80 L 200 50 M 200 80 L 200 350"
                  strokeWidth="0.75"
                  stroke="hsl(var(--primary)/0.5)"
                />
              ))}
            </g>

            {/* gyro trio — phase 3 */}
            <g
              filter="url(#ultraGlow)"
              stroke="hsl(var(--accent))"
              className={cn(
                'transition-opacity duration-700 [transform-style:preserve-3d] [transform:perspective(600px)]',
                showGyro ? 'opacity-100' : 'opacity-0',
              )}
            >
              <circle cx="200" cy="200" r="100" strokeWidth="2" className="animate-gyro-1" />
              <circle cx="200" cy="200" r="80" strokeWidth="1.5" strokeDasharray="10 10" className="animate-gyro-2" />
              <circle cx="200" cy="200" r="120" strokeWidth="1" strokeDasharray="2 8" className="animate-gyro-3" />
            </g>

            {/* neural particle flux — phase 4 (streams converge on the core) */}
            <g transform="translate(200 200)" fill="hsl(var(--accent))" className={cn('transition-opacity duration-700', showFlux ? 'opacity-100' : 'opacity-0')}>
              {particleStyles.map((style, i) => (
                <circle key={i} r="1.5" className="animate-particle-stream" style={style} />
              ))}
            </g>

            {/* core — phase 5: ignite, shockwaves, burst */}
            {showCore && (
              <g transform="translate(200 200)" key={`core-${burstOn}`}>
                <circle key="shock1" r="0" strokeWidth="3" stroke="hsl(var(--accent))" className="animate-boot-shockwave-1-now" />
                <circle key="shock2" r="0" strokeWidth="2" stroke="hsl(var(--primary))" className="animate-boot-shockwave-2-now" />
                {Array.from({ length: 24 }).map((_, i) => (
                  <circle
                    key={i}
                    r="1.8"
                    fill="hsl(var(--accent))"
                    className="animate-boot-burst-now"
                    style={{ '--angle': `${i * 15}deg`, '--delay': '0s' } as React.CSSProperties}
                  />
                ))}
                <circle r="40" fill="url(#coreGradient)" className="animate-boot-core-ignite-now" style={{ transformOrigin: 'center' }} />
                <circle r="50" stroke="hsl(var(--accent)/0.8)" strokeWidth="1.5" className="animate-boot-core-pulse-now" />
                <circle r="56" stroke="hsl(var(--primary)/0.6)" strokeWidth="0.75" className="animate-boot-core-pulse-now" style={{ animationDelay: '0.4s' }} />
              </g>
            )}
          </svg>

          {/* center readout: percentage → JARVIS */}
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center font-orbitron">
            {!showJarvis ? (
              <>
                <div className="text-5xl font-black tabular-nums [text-shadow:0_0_25px_hsl(var(--primary))]">
                  {pct}
                  <span className="text-2xl text-primary/70">%</span>
                </div>
                <div className="mt-1 text-[10px] tracking-[0.3em] text-primary/60">INITIALIZING</div>
              </>
            ) : (
              <h1
                className="animate-boot-text-glitch-now bg-gradient-to-r from-accent to-primary bg-clip-text text-4xl font-bold tracking-[0.3em] text-transparent"
                style={{ filter: 'drop-shadow(0 0 15px hsl(var(--primary)/0.7))' }}
              >
                JARVIS
              </h1>
            )}
          </div>
        </div>
      </main>

      {/* phase caption */}
      <div className="relative z-20 -mt-10 mb-4 flex flex-col items-center gap-1 font-orbitron">
        <div className="text-[10px] tracking-[0.4em] text-accent/80">{phase.code}</div>
        <div className="text-sm font-bold tracking-[0.25em] text-primary/90">
          {phase.label}
          <span className="ml-2 inline-block w-4 animate-pulse text-accent">▍</span>
        </div>
      </div>

      {/* ── bottom cluster ───────────────────────────────────────── */}
      <footer className="relative z-20 grid grid-cols-1 items-end gap-4 px-6 pb-6 md:grid-cols-3 md:px-10">
        {/* live boot log */}
        <div className="order-2 h-24 overflow-hidden font-code text-[11px] leading-4 md:order-1">
          {visibleLog.map((l, i) => (
            <p key={`${l.t}-${i}`} className={cn('whitespace-nowrap', LOG_STYLE[l.level])}>
              <span className="mr-2 text-primary/40">▸</span>
              {l.text}
            </p>
          ))}
        </div>

        {/* segmented progress bar */}
        <div className="order-1 flex flex-col items-center gap-1 md:order-2">
          <div className="flex items-end gap-[3px]">
            {Array.from({ length: SEGMENTS }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-[7px] transition-all duration-200',
                  i < litSegs
                    ? i === litSegs - 1
                      ? 'h-7 bg-accent shadow-[0_0_10px_hsl(var(--accent))]'
                      : 'h-5 bg-primary/90 shadow-[0_0_6px_hsl(var(--primary)/0.6)]'
                    : 'h-3 bg-primary/15',
                )}
              />
            ))}
          </div>
          <div className="font-orbitron text-[10px] tracking-[0.3em] text-primary/60">SYSTEM LOAD {pct}% / 100</div>
        </div>

        {/* equalizer */}
        <div className="order-3 hidden h-24 items-end justify-end gap-1 md:flex">
          {Array.from({ length: EQ_BARS }).map((_, i) => (
            <div
              key={i}
              className="animate-eq-bar w-1.5 origin-bottom rounded-t-sm bg-gradient-to-t from-primary/60 to-accent"
              style={{
                height: `${18 + ((i * 13) % 52)}px`,
                animationDelay: `${i * 70}ms`,
                animationDuration: `${0.8 + (i % 5) * 0.16}s`,
                opacity: 0.4 + 0.6 * (progress / 100),
              }}
            />
          ))}
        </div>
      </footer>

      {/* ACCESS GRANTED flash */}
      {granted && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <div className="text-center font-orbitron">
            <div className="animate-granted-in text-2xl font-black tracking-[0.4em] text-accent md:text-4xl" style={{ filter: 'drop-shadow(0 0 20px hsl(var(--accent)))' }}>
              ACCESS GRANTED
            </div>
            <div className="mt-2 text-[10px] tracking-[0.5em] text-primary/70">INITIALIZING HUD</div>
          </div>
        </div>
      )}

      {/* exit fade */}
      <div className="pointer-events-none absolute inset-0 z-50 animate-boot-fade-out bg-background opacity-0" style={{ animationDelay: `${(TOTAL_MS - 500) / 1000}s` }} />
    </div>
  );
};

export default StartupAnimation;
