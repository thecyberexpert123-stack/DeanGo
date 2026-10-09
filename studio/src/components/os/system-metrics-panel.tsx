'use client';

import { Battery, Cpu, Disc, MemoryStick, Network, Zap } from 'lucide-react';
import type { FullSystemMetrics } from '@/hooks/use-system-metrics';
import JarvisPanel from './JarvisPanel';
import MetricGauge from './metric-gauge';

const PowerIndicator = ({ level, charging }: { level: number; charging: boolean }) => (
    <div className="space-y-1 text-xs">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 text-primary/70">
                <Battery size={14} />
                <span>Power Status</span>
            </div>
            <div className="flex items-center gap-1 font-bold text-foreground">
                 {charging && <Zap size={12} className="text-green-400 fill-green-400" />}
                <span>{level.toFixed(0)}%</span>
            </div>
        </div>
        <div className="w-full bg-primary/10 h-1.5 rounded-full overflow-hidden">
            <div 
                className="h-full rounded-full transition-all duration-300" 
                style={{
                    width: `${level}%`,
                    backgroundColor: level < 20 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'
                }}
            />
        </div>
        {charging && <p className="text-green-400 text-right font-bold text-[10px] tracking-wider -mt-0.5">CHARGING</p>}
    </div>
);


const StorageIndicator = ({ diskUsage, total, used }: { diskUsage: number; total: number, used: number }) => (
  <div className="space-y-1 text-xs">
    <div className="flex justify-between items-center">
      <span>Storage Used:</span>
      <span className="font-bold">{used.toFixed(0)} / {total} GB</span>
    </div>
    <div className="w-full bg-primary/10 h-1.5 rounded-full">
        <div className="bg-primary h-full rounded-full" style={{width: `${diskUsage}%`}}/>
    </div>
  </div>
);


const SystemMetricsDisplay = ({ metrics }: { metrics: FullSystemMetrics }) => {
  return (
    <JarvisPanel title="System Diagnostics" className="w-72">
        <div className="space-y-4">
            {/* Core Metrics */}
            <div>
                <h4 className="text-xs text-primary/70 tracking-widest mb-1">CORE METRICS</h4>
                <div className="grid grid-cols-3 gap-1">
                    <MetricGauge name="CPU" value={metrics.cpuUsage} color="hsl(var(--chart-1))" icon={<Cpu size={24} />} compact />
                    <MetricGauge name="GPU" value={metrics.gpuUsage} color="hsl(var(--chart-2))" icon={<Disc size={24} />} compact />
                    <MetricGauge name="RAM" value={metrics.ramUsage} color="hsl(var(--chart-3))" icon={<MemoryStick size={24} />} compact />
                </div>
            </div>

            <div className="h-px w-full bg-primary/10" />

            {/* Sub-Systems */}
             <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs">
                    <Network size={16} className="text-primary flex-shrink-0"/>
                    <div>
                        <p className="text-primary/70">Network Status</p>
                        <p className="font-bold">{metrics.networkInMbps.toFixed(1)} Mbps ↓ / {metrics.networkOutMbps.toFixed(1)} Mbps ↑</p>
                    </div>
                </div>
                <StorageIndicator diskUsage={metrics.diskUsage} total={1024} used={1024 * (metrics.diskUsage / 100)} />
            </div>

            <div className="h-px w-full bg-primary/10" />
            
            {/* Power */}
            <PowerIndicator level={metrics.batteryLevel} charging={metrics.batteryCharging} />
        </div>
    </JarvisPanel>
  );
};

export default SystemMetricsDisplay;
