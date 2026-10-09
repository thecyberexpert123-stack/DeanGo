'use client';

import { useState, useEffect } from 'react';

const Clock = () => {
  // Mount-gated: server and client would disagree on `new Date()` during
  // hydration (second-granularity mismatch warnings). Render a stable
  // placeholder until the client effect sets the real time.
  const [date, setDate] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDate(new Date());
    const timerId = setInterval(() => setDate(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const time = date ? date.toLocaleTimeString('en-US', { hour12: false }) : '--:--:--';
  const day = date ? date.toLocaleDateString('en-US', { weekday: 'long' }) : '···';
  const month = date ? date.toLocaleDateString('en-US', { month: 'long' }) : '···';
  const dayOfMonth = date ? String(date.getDate()) : '--';

  return (
    <div className="flex items-baseline gap-4 text-primary" suppressHydrationWarning>
        <div className="text-5xl font-bold tabular-nums leading-none">
            {time}
        </div>
        <div className="flex flex-col text-left leading-tight border-l-2 border-primary/50 pl-4">
            <div className="text-2xl font-bold">{mounted ? `${dayOfMonth} ${month.substring(0,3).toUpperCase()}` : '-- ---'}</div>
            <div className="text-xs tracking-widest">{day.toUpperCase()}</div>
        </div>
    </div>
  );
};

export default Clock;
