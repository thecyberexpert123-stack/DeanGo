/**
 * offline.ts — graceful degradation for the Genkit flows.
 *
 * The Google AI flows need GOOGLE_API_KEY (or GEMINI_API_KEY). When none is
 * set, calling generate() throws a server-action error per attempt — this
 * helper lets every flow check first and return a deterministic, in-character
 * local result instead of erroring.
 */

export function hasGoogleKey(): boolean {
  return !!(
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY
  );
}

/** Local, rule-based stand-in for the system-performance analysis flow. */
export function localPerformanceAnalysis(input: {
  cpuUsage: number;
  gpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  networkInMbps: number;
  networkOutMbps: number;
  batteryLevel: number;
  batteryCharging: boolean;
}) {
  const issues: { category: string; description: string; recommendation: string }[] = [];
  const pct = (n: number) => `${Math.round(n)}%`;

  if (input.cpuUsage > 90)
    issues.push({
      category: 'CPU',
      description: `CPU usage is critical at ${pct(input.cpuUsage)} — the core reactor is saturated.`,
      recommendation: 'Suspend non-essential processes or trigger Boost cooldown.',
    });
  if (input.gpuUsage > 90)
    issues.push({
      category: 'GPU',
      description: `GPU is under critical load at ${pct(input.gpuUsage)}.`,
      recommendation: 'Reduce render workload or defer background vision tasks.',
    });
  if (input.ramUsage > 90)
    issues.push({
      category: 'Memory',
      description: `RAM pressure is critical at ${pct(input.ramUsage)}.`,
      recommendation: 'Release cached buffers; consider restarting long-lived apps.',
    });
  if (input.diskUsage > 92)
    issues.push({
      category: 'Storage',
      description: `Disk is nearly full at ${pct(input.diskUsage)}.`,
      recommendation: 'Archive or purge old artifacts from the ledger.',
    });
  if (input.batteryLevel < 20 && !input.batteryCharging)
    issues.push({
      category: 'Battery',
      description: `Battery at ${pct(input.batteryLevel)} and not charging.`,
      recommendation: 'Connect external power before the suit enters low-power mode.',
    });

  return {
    hasCriticalIssues: issues.length > 0,
    overallSummary: issues.length
      ? `${issues.length} critical issue${issues.length > 1 ? 's' : ''} detected — metrics are within tolerance otherwise. (local analysis — GOOGLE_API_KEY not configured)`
      : 'All systems nominal. No critical issues detected. (local analysis — GOOGLE_API_KEY not configured)',
    issues,
  };
}
