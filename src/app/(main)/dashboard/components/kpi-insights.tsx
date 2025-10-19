"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateKpiInsights, type GenerateKpiInsightsOutput } from '@/ai/flows/generate-kpi-insights';
import { summaryCardsData, performanceChartData } from '@/lib/data/dashboard-data';
import { Wand2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const iconMap = {
    TrendingUp: {
        component: TrendingUp,
        className: 'text-success bg-success/10'
    },
    TrendingDown: {
        component: TrendingDown,
        className: 'text-destructive bg-destructive/10'
    },
    AlertTriangle: {
        component: AlertTriangle,
        className: 'text-accent bg-accent/10'
    },
};

export default function KpiInsights() {
    const [insights, setInsights] = useState<GenerateKpiInsightsOutput['insights']>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerateInsights = async () => {
        setLoading(true);
        setError(null);
        try {
            const kpiDataForAnalysis = {
                summary: summaryCardsData,
                performance: performanceChartData.data
            };
            const result = await generateKpiInsights({ kpiData: JSON.stringify(kpiDataForAnalysis) });
            setInsights(result.insights);
        } catch (e) {
            console.error(e);
            setError("Failed to generate insights. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        handleGenerateInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const renderContent = () => {
        if (loading) {
            return (
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-start space-x-4">
                            <Skeleton className="h-10 w-10 rounded-lg" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        if (error) {
            return <p className="text-destructive text-sm">{error}</p>;
        }

        if (insights.length > 0) {
            return (
                <div className="space-y-5">
                    {insights.map((insight, index) => {
                        const IconConfig = iconMap[insight.icon];
                        const Icon = IconConfig?.component || AlertTriangle;
                        return (
                            <div key={index} className="flex items-start space-x-4">
                                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", IconConfig?.className)}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-800">{insight.title}</p>
                                    <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                                    <p className="text-sm text-primary font-medium mt-2">Recommendation: <span className="text-gray-700 font-normal">{insight.recommendation}</span></p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        return <p className="text-gray-500 text-sm">Click "Generate Insights" to get an AI-powered analysis of your KPIs.</p>;
    }

    return (
        <Card className="shadow-sm border-gray-200 h-full">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>AI-Powered Insights</CardTitle>
                <Button size="sm" onClick={handleGenerateInsights} disabled={loading}>
                    <Wand2 className="w-4 h-4 mr-2" />
                    {loading ? 'Analyzing...' : 'Regenerate'}
                </Button>
            </CardHeader>
            <CardContent>
                {renderContent()}
            </CardContent>
        </Card>
    );
}
