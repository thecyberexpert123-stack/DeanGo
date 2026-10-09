'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { analyzeSystemPerformance, type SystemPerformanceInput, type SystemPerformanceOutput } from '@/ai/flows/system-performance-analysis';

export interface SystemSpecs {
  cpu: string;
  gpu: string;
  ram: string;
  os: string;
}

export type BoostStatus = 'idle' | 'boosting' | 'cooling';

// This combines the AI flow input with the extra data we need for the UI
export type FullSystemMetrics = SystemPerformanceInput & {
  specs: SystemSpecs;
  openedApps: string[];
  boostStatus: BoostStatus;
};

const useSystemMetrics = () => {
  const [metrics, setMetrics] = useState<FullSystemMetrics>({
    cpuUsage: 30,
    gpuUsage: 15,
    ramUsage: 45,
    diskUsage: 50,
    networkInMbps: 25,
    networkOutMbps: 5,
    batteryLevel: 100,
    batteryCharging: true,
    specs: {
      cpu: 'ARK-2500 Reactor',
      gpu: 'Stark Industries GFX-9000',
      ram: '128 ZB',
      os: 'J.A.R.V.I.S. v1.0',
    },
    openedApps: ['AI Core', 'Global Comms', 'Threat Analysis', 'Mark LXXXV Diagnostics'],
    boostStatus: 'idle',
  });

  const [analysis, setAnalysis] = useState<SystemPerformanceOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const timeRef = useRef(0);
  const boostTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const metricsRef = useRef(metrics);

  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  const boostPerformance = useCallback(() => {
    if (metrics.boostStatus !== 'idle') return;

    setMetrics(prev => ({ ...prev, boostStatus: 'boosting' }));
    
    // Store original values before "boosting"
    const originalValues = { cpuUsage: metrics.cpuUsage, gpuUsage: metrics.gpuUsage, ramUsage: metrics.ramUsage };

    // Simulate boost effect by spiking metrics
    setMetrics(prev => ({
        ...prev,
        cpuUsage: Math.min(100, originalValues.cpuUsage + 40),
        gpuUsage: Math.min(100, originalValues.gpuUsage + 50),
        ramUsage: Math.min(100, originalValues.ramUsage + 30),
    }));

    if (boostTimeoutRef.current) clearTimeout(boostTimeoutRef.current);
    boostTimeoutRef.current = setTimeout(() => {
      setMetrics(prev => ({ ...prev, boostStatus: 'cooling' }));
      // Return to normal values after "cooling"
      boostTimeoutRef.current = setTimeout(() => {
        setMetrics(prev => ({
            ...prev,
            boostStatus: 'idle',
            cpuUsage: originalValues.cpuUsage,
            gpuUsage: originalValues.gpuUsage,
            ramUsage: originalValues.ramUsage,
        }));
      }, 3000);
    }, 1500);
  }, [metrics.boostStatus, metrics.cpuUsage, metrics.gpuUsage, metrics.ramUsage]);


  useEffect(() => {
    const updateMetrics = () => {
      // Don't update metrics if a boost is in progress
      if (metricsRef.current.boostStatus !== 'idle') return;

      timeRef.current += 0.5;
      const t = timeRef.current;

      setMetrics(prevMetrics => {
        const newMetrics: FullSystemMetrics = {
          ...prevMetrics,
          cpuUsage: 45 + 40 * Math.sin(t / 5),
          gpuUsage: 30 + 25 * Math.sin(t / 8 + 2),
          ramUsage: 50 + 20 * Math.cos(t / 6),
          networkInMbps: 20 + 18 * Math.abs(Math.sin(t / 3)),
          networkOutMbps: 8 + 7 * Math.abs(Math.cos(t / 4)),
          batteryLevel: prevMetrics.batteryCharging 
            ? Math.min(100, prevMetrics.batteryLevel + 0.1)
            : Math.max(0, prevMetrics.batteryLevel - 0.05),
        };

        if (Math.random() < 0.005) {
          newMetrics.batteryCharging = !newMetrics.batteryCharging;
        }
        
        // Clamp values between 0 and 100 for percentages
        Object.keys(newMetrics).forEach(key => {
            const k = key as keyof SystemPerformanceInput;
            if (typeof newMetrics[k] === 'number' && k.endsWith('Usage') || k.endsWith('Level')) {
              (newMetrics[k] as number) = Math.max(0, Math.min(100, newMetrics[k] as number));
            }
        });
        
        return newMetrics;
      });
    };

    const intervalId = setInterval(updateMetrics, 2000);
    return () => {
      clearInterval(intervalId);
      if(boostTimeoutRef.current) clearTimeout(boostTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const performAnalysis = async () => {
      if (isAnalyzing) return;
      setIsAnalyzing(true);
      try {
        const { specs, openedApps, boostStatus, ...performanceInput } = metricsRef.current;
        const result = await analyzeSystemPerformance(performanceInput);
        setAnalysis(result);
      } catch (error) {
        if (error instanceof Error && error.message.includes('429')) {
          console.warn("AI analysis skipped due to rate limiting.");
        } else {
          console.error("Error analyzing system performance:", error);
        }
      } finally {
        setIsAnalyzing(false);
      }
    };

    performAnalysis(); // Initial analysis
    const analysisIntervalId = setInterval(performAnalysis, 60000); // Analyze every 60 seconds

    return () => clearInterval(analysisIntervalId);
  }, []); // Empty dependency array ensures this runs only on mount

  return { metrics, analysis, isAnalyzing, boostPerformance };
};

export default useSystemMetrics;
