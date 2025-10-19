'use server';
/**
 * @fileOverview Generates an executive summary for a monthly KPI report using generative AI.
 *
 * - generateReportExecutiveSummary - A function that generates the executive summary.
 * - GenerateReportExecutiveSummaryInput - The input type for the generateReportExecutiveSummary function.
 * - GenerateReportExecutiveSummaryOutput - The return type for the generateReportExecutiveSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateReportExecutiveSummaryInputSchema = z.object({
  kpiData: z.string().describe('The detailed KPI data for the month.'),
});
export type GenerateReportExecutiveSummaryInput = z.infer<typeof GenerateReportExecutiveSummaryInputSchema>;

const GenerateReportExecutiveSummaryOutputSchema = z.object({
  executiveSummary: z.string().describe('A concise executive summary of the KPI report.'),
});
export type GenerateReportExecutiveSummaryOutput = z.infer<typeof GenerateReportExecutiveSummaryOutputSchema>;

export async function generateReportExecutiveSummary(
  input: GenerateReportExecutiveSummaryInput
): Promise<GenerateReportExecutiveSummaryOutput> {
  return generateReportExecutiveSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateReportExecutiveSummaryPrompt',
  input: {schema: GenerateReportExecutiveSummaryInputSchema},
  output: {schema: GenerateReportExecutiveSummaryOutputSchema},
  prompt: `You are an expert in analyzing KPI data and generating concise executive summaries.

  Given the following KPI data for the month, generate a brief executive summary highlighting the key performance insights:

  {{{kpiData}}}

  The executive summary should be no more than 3-4 sentences long and should focus on the most important trends and achievements.`,
});

const generateReportExecutiveSummaryFlow = ai.defineFlow(
  {
    name: 'generateReportExecutiveSummaryFlow',
    inputSchema: GenerateReportExecutiveSummaryInputSchema,
    outputSchema: GenerateReportExecutiveSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
