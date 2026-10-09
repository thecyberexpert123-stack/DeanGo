'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Orbitron } from 'next/font/google';
import { useVoiceAssistant, type AiStatus } from '@/hooks/use-voice-assistant';

const orbitron = Orbitron({ subsets: ['latin'] });

interface VoiceHUDProps {
  closeDialog: () => void;
}

const VoiceHUD = ({ closeDialog }: VoiceHUDProps) => {
  const [show, setShow] = useState(true);
  const { status, transcript, error, audioDataUri } = useVoiceAssistant(closeDialog);
  
  const [particles, setParticles] = useState<React.CSSProperties[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const newParticles = Array.from({ length: 100 }).map(() => {
      const angle = Math.random() * 2 * Math.PI;
      const radius = 30 + Math.random() * 120;
      return {
        '--size': `${Math.random() * 2 + 1}px`,
        '--x-start': `${Math.cos(angle) * radius}px`,
        '--y-start': `${Math.sin(angle) * radius}px`,
        '--x-end': `${Math.cos(angle + (Math.random() - 0.5) * Math.PI) * radius}px`,
        '--y-end': `${Math.sin(angle + (Math.random() - 0.5) * Math.PI) * radius}px`,
        '--delay': `${Math.random() * 15}s`,
        '--duration': `${Math.random() * 10 + 10}s`,
      } as React.CSSProperties
    });
    setParticles(newParticles);
  }, []);

  // Audio playback effect
  useEffect(() => {
    if (status === 'speaking' && audioDataUri) {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.onended = () => {
                setShow(false);
                // Use a timeout to allow fade-out animation to complete
                setTimeout(() => closeDialog(), 500);
            };
        }
        audioRef.current.src = audioDataUri;
        audioRef.current.play().catch(e => console.error("Audio playback failed", e));
    }
  }, [status, audioDataUri, closeDialog]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!coreRef.current) return;
      const { left, top, width, height } = el.getBoundingClientRect();
      const x = (e.clientX - left) / width - 0.5;
      const y = (e.clientY - top) / height - 0.5;
      coreRef.current.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
    };

    const handleMouseLeave = () => {
      if (coreRef.current) {
        coreRef.current.style.transform = 'rotateY(0deg) rotateX(0deg)';
      }
    };
    
    const overlay = document.querySelector('[data-radix-dialog-overlay]');
    const target = overlay || el;

    target.addEventListener('mousemove', handleMouseMove as EventListener);
    target.addEventListener('mouseleave', handleMouseLeave as EventListener);

    return () => {
      target.removeEventListener('mousemove', handleMouseMove as EventListener);
      target.removeEventListener('mouseleave', handleMouseLeave as EventListener);
    };
  }, []);

  const statusTextMap: Record<AiStatus, string> = {
    idle: 'Initializing...',
    listening: 'Listening...',
    thinking: 'Thinking...',
    speaking: 'Responding...',
    error: error || 'An error occurred.',
  };

  const statusText = statusTextMap[status];

  const Hexagon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn("h-full w-full", className)} {...props}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z" />
    </svg>
  );

  return (
    <div className={cn("relative flex flex-col items-center justify-center transition-opacity duration-500", show ? 'opacity-100' : 'opacity-0')}>
      <div ref={containerRef} className="h-[300px] w-[300px]" style={{ perspective: '1000px' }}>
        <div ref={coreRef} className="relative h-full w-full transition-transform duration-300 ease-out" style={{ transformStyle: 'preserve-3d' }}>
          
          <div className="absolute inset-0 rounded-full bg-primary/5 blur-3xl animate-pulse-slow" style={{ transform: 'translateZ(-150px)' }} />
          <div
            className="absolute inset-0"
            style={{ 
              transform: 'translateZ(-100px)',
              maskImage: 'radial-gradient(circle at center, white 20%, transparent 70%)' 
            }}
          >
            <div className="absolute inset-0 animate-circuit-pulse [background-image:radial-gradient(hsl(var(--primary)/0.1)_1px,transparent_1px)] [background-size:1.5rem_1.5rem]" />
          </div>

          <div className={cn("absolute inset-0 transition-transform duration-1000", status === 'thinking' ? 'animate-particle-swirl' : '')} style={{ transform: 'translateZ(-80px)', transformStyle: 'preserve-3d' }}>
            {particles.slice(0, 40).map((style, i) => (
              <div key={i} className="absolute left-1/2 top-1/2 h-[var(--size)] w-[var(--size)] rounded-full bg-accent/70 animate-particle-drift" style={style} />
            ))}
          </div>

          <div className={cn("absolute inset-0 h-full w-full transition-transform duration-1000", status === 'thinking' ? 'scale-105' : 'scale-100')} style={{ transformStyle: 'preserve-3d' }}>
            <div className={cn("absolute inset-[2%] rounded-full border-2 border-dashed border-primary/10", status === 'thinking' ? 'animate-[spin_10s_linear_infinite]' : 'animate-[spin_40s_linear_infinite]')} style={{ transform: 'translateZ(-40px)' }} />
            <div className="absolute inset-[8%] rounded-full border border-dotted border-accent/20 animate-[spin_30s_linear_infinite_reverse]" style={{ transform: 'translateZ(-30px)' }} />
            <div className="absolute inset-[15%] rounded-full border border-primary/30 animate-flicker" style={{ transform: 'translateZ(0px)' }} />
            <div className={cn("absolute inset-[22%] rounded-full border-2 border-accent/70", status === 'thinking' ? 'animate-[spin_8s_linear_infinite_reverse]' : 'animate-[spin_12s_linear_infinite_reverse]')} style={{ transform: 'translateZ(20px)' }} />
            <div className="absolute inset-[28%] rounded-full border border-dashed border-primary/40 animate-[spin_20s_linear_infinite]" style={{ transform: 'translateZ(40px)' }} />
          </div>

          <div className="absolute inset-0 h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
            <div className={cn("absolute inset-0 transition-opacity duration-500", status === 'idle' || status === 'error' ? 'opacity-100' : 'opacity-0')} />

            <div className={cn("absolute inset-0 transition-opacity duration-500", status === 'listening' ? 'opacity-100' : 'opacity-0')}>
              <svg viewBox="-100 -100 200 200" className="h-full w-full animate-pulse-slow">
                {Array.from({ length: 120 }).map((_, i) => (
                  <rect key={i} x="-1" y="-90" width="2" height="4" rx="1" fill="hsl(var(--accent))" transform={`rotate(${i * 3})`}
                    className="animate-waveform-bar" style={{ animationDelay: `${i * 0.025}s`, animationDuration: '1.5s' }} />
                ))}
              </svg>
              <div className="absolute inset-0">
                {particles.slice(40, 60).map((style, i) => (
                    <div key={i}
                        className="absolute left-1/2 top-1/2 h-[var(--size)] w-[var(--size)] rounded-full bg-accent animate-particle-suck-in"
                        style={{ ...style, animationDuration: `${Math.random() * 2 + 1.5}s`, animationDelay: `${Math.random() * 1.5}s` }} />
                ))}
              </div>
            </div>
            
            <div className={cn("absolute inset-0 transition-opacity duration-500", status === 'thinking' ? 'opacity-100' : 'opacity-0')}>
              <div className="absolute inset-[25%] animate-scanner-line-rotate" style={{'--speed': '4s'} as React.CSSProperties}>
                  <div className="absolute top-0 left-1/2 h-1/2 w-px animate-scanner-line-fade bg-gradient-to-b from-accent/0 to-accent" />
              </div>
              <div className="absolute inset-[25%] animate-scanner-line-rotate" style={{'--speed': '5s', animationDirection: 'reverse'} as React.CSSProperties}>
                  <div className="absolute bottom-0 left-1/2 h-1/2 w-px animate-scanner-line-fade bg-gradient-to-t from-accent/0 to-accent" />
              </div>
               
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="absolute text-primary/30 animate-glyph-float" style={{
                  left: `${10 + i * 13}%`,
                  height: `${15 + (i%3)*5}px`,
                  animationDelay: `${i * 0.5}s`,
                  animationDuration: `${5 + Math.random() * 4}s`,
                  transform: `translateZ(${20 + Math.random()*40}px)`
                }}>
                  <Hexagon />
                </div>
              ))}
            </div>

            <div className={cn("absolute inset-0 transition-opacity duration-500", status === 'speaking' ? 'opacity-100' : 'opacity-0')}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="absolute inset-0 rounded-full border-2 border-primary/70 animate-speaking-ripple" style={{ animationDelay: `${i * 0.5}s` }}/>
              ))}
              <div className="absolute inset-0 rounded-full animate-energy-pulse border-2 border-accent" />
            </div>
          </div>
          
          <div className="absolute inset-[32%] rounded-full" style={{ transform: 'translateZ(60px)', transformStyle: 'preserve-3d' }}>
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-breathing-glow" />
            <div className="absolute inset-0 rounded-full border-2 border-primary animate-holographic-flicker" />
            <div className={cn("absolute inset-0 flex items-center justify-center text-4xl font-bold tracking-[0.2em] text-primary/90 [text-shadow:0_0_15px_hsl(var(--primary))]", orbitron.className)}>
              JARVIS
            </div>
          </div>

          <div className="absolute inset-0" style={{ transform: 'translateZ(80px)', transformStyle: 'preserve-3d' }}>
            {particles.slice(60, 70).map((style, i) => (
              <div key={i} className="absolute inset-0 animate-orbit" style={{ ...style, '--radius': `${130 + i * 2}px`, '--duration': `${10 + i * 2}s` }}>
                <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-accent" style={{ transform: 'translateX(var(--radius))' }} />
              </div>
            ))}
          </div>

        </div>
      </div>
      <div 
        className={cn("absolute -bottom-8 text-center text-accent tracking-widest text-sm animate-fade-in", orbitron.className)}
      >
        {status === 'listening' && transcript ? (
            <span className="text-white/80">{transcript}</span>
        ) : (
            statusText
        )}
      </div>
    </div>
  );
};

export default VoiceHUD;
