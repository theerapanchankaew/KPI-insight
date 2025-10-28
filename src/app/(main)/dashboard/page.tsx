
"use client"

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppLayout } from '../layout';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import KpiInsights from './components/kpi-insights';
import { Building2, Target } from 'lucide-react';
import { useKpiData } from '@/context/KpiDataContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirestore, useMemoFirebase, WithId } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MonthlyKpi {
  id: string;
  parentKpiId: string;
  measure: string;
  year: number;
  month: number; // 1-12
  target: number;
  actual: number;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatYAxis = (tick: number | string) => {
    const num = Number(tick);
    if (isNaN(num)) return tick;

    if (num >= 1000000000) {
        return `${(num / 1000000000).toFixed(0)}B`;
    }
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(0)}M`;
    }
    if (num >= 1000) {
        return `${(num / 1000).toFixed(0)}K`;
    }
    return num.toString();
};

const KpiCard = ({ kpi, monthlyData }: { kpi: WithId<any>, monthlyData: WithId<MonthlyKpi>[] }) => {
    const chartData = useMemo(() => {
        const dataForKpi = monthlyData.filter(m => m.parentKpiId === kpi.id);
        const dataByMonth = MONTH_NAMES.map((name, index) => {
            const monthData = dataForKpi.find(d => d.month === index + 1);
            return {
                month: name,
                Actual: monthData?.actual || 0,
                Target: monthData?.target || 0,
            };
        });
        return dataByMonth;
    }, [kpi.id, monthlyData]);
    
    const chartConfig = {
      Actual: { label: 'Actual', color: 'hsl(var(--chart-1))' },
      Target: { label: 'Target', color: 'hsl(var(--chart-2))' },
    };

    const totalActual = useMemo(() => chartData.reduce((sum, item) => sum + item.Actual, 0), [chartData]);
    const totalTarget = useMemo(() => chartData.reduce((sum, item) => sum + item.Target, 0), [chartData]);
    const achievement = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
    
    const yAxisMax = useMemo(() => {
        const maxActual = Math.max(...chartData.map(d => d.Actual));
        const maxTarget = Math.max(...chartData.map(d => d.Target));
        const highestValue = Math.max(maxActual, maxTarget);
        // Ensure axis is not 0 if all data is 0
        return highestValue === 0 ? 10 : highestValue;
    }, [chartData]);

    return (
        <Card className="shadow-sm border-gray-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group flex flex-col flex-1 min-w-[320px] md:max-w-md">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-semibold">{kpi.measure}</CardTitle>
                    <Badge variant={achievement >= 100 ? "success" : achievement >= 80 ? "warning" : "destructive"}>
                        {achievement.toFixed(0)}%
                    </Badge>
                </div>
                <CardDescription>
                    Target: {kpi.target} {kpi.unit && `(${kpi.unit})`}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex">
                <div className="h-40 w-full">
                     <ChartContainer config={chartConfig} className="h-full w-full">
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={10} />
                            <YAxis 
                                tickLine={false} 
                                axisLine={false} 
                                tickMargin={8} 
                                fontSize={10} 
                                width={40} 
                                tickFormatter={formatYAxis}
                                domain={[0, dataMax => Math.max(yAxisMax, dataMax) * 1.1]}
                            />
                            <Tooltip content={<ChartTooltipContent indicator="dot" />} />
                            <Line type="monotone" dataKey="Actual" stroke="var(--color-Actual)" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="Target" stroke="var(--color-Target)" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                        </LineChart>
                    </ChartContainer>
                </div>
            </CardContent>
        </Card>
    )
}


const DepartmentPerformance = () => {
  const { orgData, isOrgDataLoading, cascadedKpis, isCascadedKpisLoading } = useKpiData();

  const departmentKpiCounts = useMemo(() => {
    if (!cascadedKpis || !orgData) return {};
    
    const departmentSet = new Set(orgData.map(e => e.department));
    const counts: Record<string, number> = {};

    for (const dept of departmentSet) {
      counts[dept] = 0;
    }

    for (const kpi of cascadedKpis) {
      if (counts.hasOwnProperty(kpi.department)) {
        counts[kpi.department]++;
      }
    }
    return counts;
  }, [cascadedKpis, orgData]);
  
  const departments = useMemo(() => {
    return orgData ? [...new Set(orgData.map(e => e.department))] : [];
  }, [orgData]);
  
  const isLoading = isOrgDataLoading || isCascadedKpisLoading;

  return (
    <Card className="shadow-sm border-gray-200 lg:col-span-3">
      <CardHeader>
        <CardTitle>Department Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {departments.length > 0 ? departments.map((dept, index) => (
              <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", 'bg-secondary/10')}>
                  <Building2 className={cn("w-6 h-6", 'text-secondary')} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800">{dept}</h4>
                  <p className={cn("text-xl font-bold", 'text-secondary')}>{departmentKpiCounts[dept] || 0}</p>
                  <p className="text-xs text-gray-500">Cascaded KPIs</p>
                </div>
              </div>
            )) : (
              <div className="col-span-3 text-center py-10">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto" />
                <h4 className="mt-4 font-semibold text-gray-600">No Department Data</h4>
                <p className="text-sm text-gray-500">Please import organization data in the "Intake Data" page.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function DashboardPage() {
  const { setPageTitle } = useAppLayout();
  const { kpiData, isKpiDataLoading } = useKpiData();
  const firestore = useFirestore();

  const monthlyKpisQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Assuming the current year for simplicity. Could be made dynamic.
    const currentYear = new Date().getFullYear();
    return query(collection(firestore, 'monthly_kpis'), where('year', '==', currentYear));
  }, [firestore]);

  const { data: monthlyKpisData, isLoading: isMonthlyKpisLoading } = useCollection<MonthlyKpi>(monthlyKpisQuery);
  
  const groupedKpis = useMemo(() => {
    if (!kpiData) return {};
    return kpiData.reduce((acc, kpi) => {
        const perspective = kpi.perspective || 'Uncategorized';
        if (!acc[perspective]) acc[perspective] = [];
        acc[perspective].push(kpi);
        return acc;
    }, {} as { [key: string]: WithId<any>[] });
  }, [kpiData]);


  useEffect(() => {
    setPageTitle('Dashboard');
  }, [setPageTitle]);
  
  const isLoading = isKpiDataLoading || isMonthlyKpisLoading;

  return (
    <div className="fade-in space-y-6">
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            {isLoading ? (
                [...Array(2)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
                        <CardContent className="flex flex-wrap gap-4">
                            <Skeleton className="h-56 w-full flex-1 min-w-[320px]" />
                            <Skeleton className="h-56 w-full flex-1 min-w-[320px]" />
                        </CardContent>
                    </Card>
                ))
            ) : Object.keys(groupedKpis).length > 0 ? (
                Object.entries(groupedKpis).map(([perspective, kpis]) => (
                    <Collapsible key={perspective} defaultOpen>
                        <CollapsibleTrigger asChild>
                             <div className="flex items-center justify-between p-4 border-b cursor-pointer">
                                <h3 className="text-lg font-semibold text-gray-800">{perspective}</h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>{kpis.length} KPIs</span>
                                    <ChevronsUpDown className="h-4 w-4" />
                                </div>
                            </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="p-4 bg-gray-50/50">
                            <div className="flex flex-wrap gap-6">
                                {kpis.map(kpi => (
                                    <KpiCard key={kpi.id} kpi={kpi} monthlyData={monthlyKpisData || []} />
                                ))}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                ))
            ) : (
                <Card>
                    <CardHeader><CardTitle>No KPI Data</CardTitle></CardHeader>
                    <CardContent className="text-center py-12">
                         <Target className="w-12 h-12 text-gray-300 mx-auto" />
                        <h4 className="mt-4 font-semibold text-gray-600">No Corporate KPIs Found</h4>
                        <p className="text-sm text-gray-500">Please import your KPI catalog on the "Intake Data" page.</p>
                    </CardContent>
                </Card>
            )}
        </div>
        <KpiInsights />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DepartmentPerformance />
      </div>
    </div>
  );
}
