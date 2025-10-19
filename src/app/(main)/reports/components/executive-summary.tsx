'use client';

import { useState } from 'react';
import { generateReportExecutiveSummary } from '@/ai/flows/generate-report-executive-summary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ExecutiveSummaryProps {
  kpiData: string;
}

export default function ExecutiveSummary({ kpiData }: ExecutiveSummaryProps) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setSummary('');
    try {
      const result = await generateReportExecutiveSummary({ kpiData });
      setSummary(result.executiveSummary);
    } catch (e) {
      setError('Failed to generate summary. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-gradient-to-r from-green-50 to-blue-50">
        <CardHeader>
            <div className="flex items-center justify-between">
                <CardTitle>Executive Summary - มิถุนายน 2024</CardTitle>
                <Button size="sm" onClick={handleGenerate} disabled={loading}>
                    <Wand2 className="w-4 h-4 mr-2" />
                    {loading ? 'Generating...' : 'Generate Summary'}
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            {loading && (
                <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                </div>
            )}
            {error && <p className="text-destructive text-sm">{error}</p>}
            {summary && <p className="text-gray-700 leading-relaxed">{summary}</p>}
            {!loading && !summary && !error && (
                <p className="text-gray-500 text-sm">Click "Generate Summary" to get an AI-powered overview of this month's performance.</p>
            )}
        </CardContent>
    </Card>
  );
}
