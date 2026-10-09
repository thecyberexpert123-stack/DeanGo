'use client';

import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';


// Component for the scrolling system check text
const SystemLog = ({ lines, startDelay }: { lines: string[]; startDelay: number }) => {
    const [visibleLines, setVisibleLines] = useState<string[]>([]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            let i = 0;
            const interval = setInterval(() => {
                if (i < lines.length) {
                    setVisibleLines(prev => [...prev, lines[i]]);
                    i++;
                } else {
                    clearInterval(interval);
                }
            }, 50); // Time between each line appearing

            return () => clearInterval(interval);
        }, startDelay);

        return () => clearTimeout(timeout);
    }, [lines, startDelay]);

    return (
        <div className="relative h-24 w-72 font-code text-xs tracking-wider text-accent/80 overflow-hidden">
            <div className="absolute bottom-0 left-0 w-full animate-log-scroll">
                {visibleLines.map((line, i) => (
                    <p key={i} className="whitespace-nowrap animate-log-line-flicker">
                        {line}
                    </p>
                ))}
            </div>
        </div>
    );
};


const StartupAnimation = () => {
  const [particleStyles, setParticleStyles] = useState<React.CSSProperties[]>([]);

  useEffect(() => {
    // Generate styles for particles on the client side to avoid hydration mismatch
    const newParticleStyles = Array.from({ length: 50 }).map(() => ({
      '--angle': `${Math.random() * 360}deg`,
      '--delay': `${Math.random() * 2 + 2.5}s`, // Delay these to sync with Phase 3
      '--duration': `${Math.random() * 2 + 2}s`,
    } as React.CSSProperties));
    setParticleStyles(newParticleStyles);
  }, []);


  const systemCheckLines = [
    'NEON OS v1.0 KERNEL-J.A.R.V.I.S.',
    '---------------------------------',
    '[0.001] BOOTSTRAP INIT',
    '[0.152] MEM CHECK: 128 ZB ... OK',
    '[0.381] CPU: ARK-2500 REACTOR... OK',
    '[0.455] GPU: STARK GFX-9000... OK',
    '[0.982] LOADING AI CORE...',
    '[1.533] ALIGNING HEURISTIC MATRICES',
    '[2.104] VERIFYING Q-ENTANGLEMENT... SYNCED',
    '[3.561] SENSORY INPUT... ONLINE',
    '[4.012] GLOBAL COMMS... ONLINE',
    '[5.218] UI RENDERER... INITIALIZED',
    '[6.988] ALL SYSTEMS NOMINAL.',
    '[7.500] WELCOME, SIR.',
  ];

  const totalBootTime = 8000;

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-8 overflow-hidden bg-background text-primary animate-boot-screen-shake">
      
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-[-100%] animate-boot-grid-in opacity-0"
            style={{
                backgroundImage: `
                    linear-gradient(hsl(var(--primary)/0.05) 1px, transparent 1px),
                    linear-gradient(to right, hsl(var(--primary)/0.05) 1px, transparent 1px)
                `,
                backgroundSize: '2rem 2rem',
            }}
        />
        <div className="absolute top-0 left-0 h-full w-full animate-boot-scanner bg-gradient-to-b from-primary/10 to-transparent opacity-0" />
      </div>

      <div className="relative h-96 w-96 z-10">
        
        <svg
          viewBox="0 0 400 400"
          className="absolute inset-0 h-full w-full overflow-visible"
          style={{ '--glow-color': 'hsl(var(--primary))' } as React.CSSProperties}
        >
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
            
            <g id="particle-stream">
              {particleStyles.map((style, i) => (
                <circle
                  key={`particle-${i}`}
                  r="1.5"
                  className="animate-particle-stream"
                  style={style}
                  fill="hsl(var(--accent))"
                  />
              ))}
            </g>
            
            <path id="electric-bolt" d="M0,0 l10,5 -10,5 15,7 -12,8 10,6" stroke="hsl(var(--accent))" strokeWidth="1.5" fill="none" />

          </defs>
          
          <g filter="url(#ultraGlow)" className="fill-none stroke-current">
            
            <g className="animate-boot-phase-1-in opacity-0">
                {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
                    <g key={`feed-group-${angle}`} transform={`rotate(${angle} 200 200)`}>
                      <path 
                          d="M 200 0 L 200 80"
                          strokeWidth="1"
                          className="animate-boot-path-draw"
                          stroke="hsl(var(--accent)/0.5)"
                          style={{ strokeDasharray: 80, strokeDashoffset: 80, animationDelay: '0.5s' }}
                      />
                      <use href="#electric-bolt" transform="translate(200 30) scale(1.5)" className="animate-electric-flow" style={{ animationDelay: '0.5s', '--length': 60 } as React.CSSProperties} />
                    </g>
                ))}
                <circle cx="200" cy="200" r="190" strokeWidth="0.5" className="animate-boot-path-draw" style={{ strokeDasharray: 1194, strokeDashoffset: 1194, animationDuration: '2s' }} />
                <circle cx="200" cy="200" r="180" strokeWidth="0.75" strokeDasharray="5 15" className="animate-boot-path-draw animate-[spin_40s_linear_infinite]" style={{ strokeDasharray: 1131, strokeDashoffset: 1131, animationDelay: '0.2s', animationDuration: '2s' }} />
            </g>

            <g className="animate-boot-phase-2-in opacity-0">
                <path d="M200 50 L329.9 125 L329.9 275 L200 350 L70.1 275 L70.1 125 Z" strokeWidth="4" 
                      className="animate-boot-path-draw"
                      style={{ strokeDasharray: 900, strokeDashoffset: 900, animationDelay: '1s', animationDuration: '2s' }}/>
                <path d="M200 80 L295.26 140 L295.26 260 L200 320 L104.74 260 L104.74 140 Z" strokeWidth="2" 
                      className="animate-boot-path-draw"
                      style={{ strokeDasharray: 720, strokeDashoffset: 720, animationDelay: '1.5s', animationDuration: '2.5s' }}/>
                {[0, 1, 2, 3, 4, 5].map(i => (
                    <path key={`hex-connect-${i}`}
                        transform={`rotate(${i * 60} 200 200)`}
                        d="M 200 80 L 200 50 M 200 80 L 200 200"
                        strokeWidth="1"
                        className="animate-boot-path-draw"
                        style={{ strokeDasharray: 150, strokeDashoffset: 150, animationDelay: '2s', animationDuration: '2s' }}
                    />
                ))}
            </g>

            <g className="animate-boot-phase-3-in opacity-0 [transform-style:preserve-3d] [transform:perspective(500px)]">
                <circle cx="200" cy="200" r="100" strokeWidth="2" className="animate-boot-path-draw animate-gyro-1" style={{ strokeDasharray: 628, strokeDashoffset: 628, animationDelay: '2.5s' }}/>
                <circle cx="200" cy="200" r="80" strokeWidth="1.5" strokeDasharray="10 10" className="animate-boot-path-draw animate-gyro-2" style={{ strokeDasharray: 502, strokeDashoffset: 502, animationDelay: '2.8s' }}/>
                <circle cx="200" cy="200" r="120" strokeWidth="1" strokeDasharray="2 8" className="animate-boot-path-draw animate-gyro-3" style={{ strokeDasharray: 754, strokeDashoffset: 754, animationDelay: '3s' }}/>
                
                <g transform="translate(200 200)">
                  <use href="#particle-stream" />
                </g>
            </g>

            <g className="animate-boot-phase-4-in opacity-0">
                <circle cx="200" cy="200" r="40" fill="url(#coreGradient)" className="animate-boot-core-ignite" style={{ transformOrigin: 'center' }} />
                <circle cx="200" cy="200" r="50" strokeWidth="1.5" className="animate-boot-path-draw animate-boot-core-pulse" style={{ strokeDasharray: 314, strokeDashoffset: 314, animationDelay: '5s' }}/>
                <circle cx="200" cy="200" r="55" strokeWidth="0.75" className="animate-boot-path-draw animate-boot-core-pulse" style={{ strokeDasharray: 345, strokeDashoffset: 345, animationDelay: '5.2s', animationDirection: 'reverse' }}/>
                
                <circle cx="200" cy="200" r="0" strokeWidth="3" className="animate-boot-shockwave-1" stroke="hsl(var(--accent))" />
                <circle cx="200" cy="200" r="0" strokeWidth="2" className="animate-boot-shockwave-2" stroke="hsl(var(--primary))" />
                
                 {Array.from({length: 40}).map((_, i) => (
                    <circle
                    key={`burst-${i}`}
                    cx="200" cy="200"
                    r="1.5"
                    fill="hsl(var(--accent))"
                    className="animate-particle-burst"
                    style={{
                        '--angle': `${i * 9}deg`,
                        '--delay': `5.5s`,
                    } as React.CSSProperties}
                    />
                ))}

            </g>
          </g>
        </svg>
      </div>

      <div className={cn("relative z-20 flex h-12 items-center justify-center overflow-hidden", 'font-orbitron')}>
        <h1 className="text-4xl font-bold tracking-[0.3em] text-transparent animate-boot-text-glitch bg-clip-text bg-gradient-to-r from-accent to-primary opacity-0"
            style={{ textShadow: '0 0 15px hsl(var(--primary)/0.7)' }}>
          JARVIS
        </h1>
        <div className="absolute top-0 left-[-10%] h-full w-[120%] animate-boot-text-scanline bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
      </div>

      <div className="z-10 animate-boot-log-appear opacity-0">
        <SystemLog lines={systemCheckLines} startDelay={7000} />
      </div>

      <div className="absolute inset-0 z-30 bg-background animate-boot-fade-out opacity-0" style={{ animationDelay: `${(totalBootTime - 500) / 1000}s` }} />
    </div>
  );
};

export default StartupAnimation;
