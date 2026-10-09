'use server';
/**
 * @fileOverview A Genkit flow for analyzing real-time system performance metrics.
 *
 * - analyzeSystemPerformance - A function that analyzes system metrics and provides insights/alerts.
 * - SystemPerformanceInput - The input type for the analyzeSystemPerformance function.
 * - SystemPerformanceOutput - The return type for the analyzeSystemPerformance function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { hasGoogleKey, localPerformanceAnalysis } from '@/ai/offline';

const SystemPerformanceInputSchema = z.object({
  cpuUsage: z.number().min(0).max(100).describe('Current CPU usage as a percentage (0-100).'),
  gpuUsage: z.number().min(0).max(100).describe('Current GPU usage as a percentage (0-100).'),
  ramUsage: z.number().min(0).max(100).describe('Current RAM usage as a percentage (0-100).'),
  diskUsage: z.number().min(0).max(100).describe('Current disk usage as a percentage (0-100).'),
  networkInMbps: z.number().min(0).describe('Current network incoming data rate in Mbps.'),
  networkOutMbps: z.number().min(0).describe('Current network outgoing data rate in Mbps.'),
  batteryLevel: z.number().min(0).max(100).describe('Current battery level as a percentage (0-100).'),
  batteryCharging: z.boolean().describe('Whether the battery is currently charging.'),
});
export type SystemPerformanceInput = z.infer<typeof SystemPerformanceInputSchema>;

const SystemPerformanceIssueSchema = z.object({
  category: z.string().describe('The category of the issue (e.g., "CPU", "Memory", "Network", "Battery").'),
  description: z.string().describe('A detailed description of the performance issue or anomaly.'),
  recommendation: z.string().describe('An actionable recommendation to address the issue.'),
});

const SystemPerformanceOutputSchema = z.object({
  hasCriticalIssues: z.boolean().describe('True if any critical performance issues or anomalies were identified.'),
  overallSummary: z.string().describe('A concise overall summary of the system performance.'),
  issues: z.array(SystemPerformanceIssueSchema).describe('A list of identified critical issues with descriptions and recommendations. This array should be empty if hasCriticalIssues is false.'),
});
export type SystemPerformanceOutput = z.infer<typeof SystemPerformanceOutputSchema>;

export async function analyzeSystemPerformance(input: SystemPerformanceInput): Promise<SystemPerformanceOutput> {
  // No Google key configured → never touch the model; this runs on every HUD
  // mount and every 60s, so an unconfigured key would spam server errors.
  if (!hasGoogleKey()) return localPerformanceAnalysis(input);
  return systemPerformanceAnalysisFlow(input);
}

const systemPerformancePrompt = ai.definePrompt({
  name: 'systemPerformancePrompt',
  input: { schema: SystemPerformanceInputSchema },
  output: { schema: SystemPerformanceOutputSchema },
  prompt: `You are an intelligent system performance monitoring AI for the Neon OS, designed to analyze real-time system metrics, identify critical performance issues or anomalies, and proactively surface actionable insights or alerts. Your goal is to help the user quickly understand and address potential problems.\n\nAnalyze the following system metrics:\n- CPU Usage: {{{cpuUsage}}}%\n- GPU Usage: {{{gpuUsage}}}%\n- RAM Usage: {{{ramUsage}}}%\n- Disk Usage: {{{diskUsage}}}%\n- Network In: {{{networkInMbps}}} Mbps\n- Network Out: {{{networkOutMbps}}} Mbps\n- Battery Level: {{{batteryLevel}}}%\n- Battery Charging: {{{batteryCharging}}}\n\nBased on these metrics, determine if there are any critical performance issues or anomalies.\nConsider the following as potential indicators of issues:\n- CPU/GPU/RAM usage consistently above 80-90% might indicate high load.\n- Disk usage consistently above 90% might indicate storage issues.\n- Very high or unusually low network activity might indicate network problems.\n- Low battery level (e.g., below 20%) and not charging, or extremely slow charging.\n\nProvide an 'overallSummary' of the system's performance.\nIf critical issues are found, set 'hasCriticalIssues' to true and list each issue with a 'category', 'description', and 'recommendation'. If no critical issues are found, set 'hasCriticalIssues' to false and provide a positive summary, leaving the 'issues' array empty.`,
});

const systemPerformanceAnalysisFlow = ai.defineFlow(
  {
    name: 'systemPerformanceAnalysisFlow',
    inputSchema: SystemPerformanceInputSchema,
    outputSchema: SystemPerformanceOutputSchema,
  },
  async (input) => {
    const { output } = await systemPerformancePrompt(input);
    return output!;
  }
);
