'use server';
/**
 * @fileOverview Generates actionable insights and recommendations from KPI data.
 *
 * - generateKpiInsights - A function that generates insights.
 * - GenerateKpiInsightsInput - The input type for the function.
 * - GenerateKpiInsightsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateKpiInsightsInputSchema = z.object({
  kpiData: z.string().describe('A JSON string representing the KPI data for analysis.'),
});
export type GenerateKpiInsightsInput = z.infer<typeof GenerateKpiInsightsInputSchema>;

const InsightSchema = z.object({
    title: z.string().describe('A short, impactful title for the insight.'),
    description: z.string().describe('A one-sentence explanation of the key observation.'),
    recommendation: z.string().describe('A concise, actionable recommendation.'),
    icon: z.enum(["TrendingUp", "TrendingDown", "AlertTriangle"]).describe("The most relevant icon for the insight: 'TrendingUp' for positive, 'TrendingDown' for negative, 'AlertTriangle' for a warning.")
});

const GenerateKpiInsightsOutputSchema = z.object({
  insights: z.array(InsightSchema).describe('An array of 3-4 key insights derived from the data.'),
});
export type GenerateKpiInsightsOutput = z.infer<typeof GenerateKpiInsightsOutputSchema>;

export async function generateKpiInsights(
  input: GenerateKpiInsightsInput
): Promise<GenerateKpiInsightsOutput> {
  return generateKpiInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateKpiInsightsPrompt',
  input: {schema: GenerateKpiInsightsInputSchema},
  output: {schema: GenerateKpiInsightsOutputSchema},
  prompt: `You are a world-class business analyst. Your task is to analyze a set of Key Performance Indicator (KPI) data and extract the most critical, actionable insights.

Analyze the provided KPI data:
{{{kpiData}}}

From your analysis, generate 3-4 key insights. For each insight, provide:
1.  A short, impactful title (e.g., "Revenue Exceeds Target," "Hiring Outpaces Revenue").
2.  A one-sentence description explaining the core observation.
3.  A concise, actionable recommendation for leadership.
4.  The most appropriate icon ('TrendingUp', 'TrendingDown', or 'AlertTriangle') to visually represent the insight.

Focus on the most significant trends, deviations from targets, and relationships between different KPIs. Your output should be direct, strategic, and immediately useful for executive decision-making.`,
});

const generateKpiInsightsFlow = ai.defineFlow(
  {
    name: 'generateKpiInsightsFlow',
    inputSchema: GenerateKpiInsightsInputSchema,
    outputSchema: GenerateKpiInsightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
