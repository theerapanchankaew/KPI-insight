
"use client"

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppLayout } from '../layout';
import { LineChart, CartesianGrid, Tooltip, XAxis, YAxis, Line, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import KpiInsights from './components/kpi-insights';
import { Building2, Target, Edit } from 'lucide-react';
import { useKpiData } from '@/context/KpiDataContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirestore, useMemoFirebase, WithId, setDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { MonthlyKpi, Kpi as CorporateKpi } from '@/context/KpiDataContext';


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

const EditDataDialog = ({
  isOpen,
  onClose,
  monthlyKpi,
  onSave
}: {
  isOpen: boolean;
  onClose: () => void;
  monthlyKpi: WithId<MonthlyKpi> | null;
  onSave: (id: string, actual: number) => void;
}) => {
  const [actualValue, setActualValue] = useState('');

  useEffect(() => {
    if (monthlyKpi) {
      setActualValue(String(monthlyKpi.actual || ''));
    }
  }, [monthlyKpi]);

  const handleSave = () => {
    if (monthlyKpi) {
      onSave(monthlyKpi.id, Number(actualValue));
    }
    onClose();
  };

  if (!monthlyKpi) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Actual for {monthlyKpi.measure}</DialogTitle>
          <DialogDescription>
            Editing data for {MONTH_NAMES[monthlyKpi.month - 1]}, {monthlyKpi.year}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Target</Label>
            <Input value={monthlyKpi.target.toLocaleString()} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="actual-value">Actual</Label>
            <Input
              id="actual-value"
              type="number"
              value={actualValue}
              onChange={(e) => setActualValue(e.target.value)}
              placeholder="Enter actual value"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSave}>Save Actual</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


const KpiCard = ({ kpi, monthlyData }: { kpi: WithId<CorporateKpi>, monthlyData: WithId<MonthlyKpi>[] }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isEditDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedMonthKpi, setSelectedMonthKpi] = useState<WithId<MonthlyKpi> | null>(null);

    const dataForKpi = useMemo(() => {
        return monthlyData.filter(m => m.parentKpiId === kpi.id);
    }, [kpi.id, monthlyData]);

    const chartData = useMemo(() => {
        const dataByMonth = MONTH_NAMES.map((name, index) => {
            const monthData = dataForKpi.find(d => d.month === index + 1);
            return {
                month: name,
                Actual: monthData?.actual ?? null, // Use null for missing data to create gaps
                Target: monthData?.target || 0,
                isEditable: !!monthData,
            };
        });
        return dataByMonth;
    }, [dataForKpi]);
    
    const chartConfig = {
      Actual: { label: 'Actual', color: 'hsl(var(--primary))' },
      Target: { label: 'Target', color: 'hsl(var(--accent))' },
    };

    const totalActual = useMemo(() => chartData.reduce((sum, item) => sum + (item.Actual || 0), 0), [chartData]);
    const yearlyTarget = useMemo(() => {
      const targetValue = typeof kpi.target === 'string' ? parseFloat(kpi.target.replace(/[^0-9.]/g, '')) : kpi.target;
      return isNaN(targetValue) ? 0 : targetValue;
    }, [kpi.target]);

    const achievement = yearlyTarget > 0 ? (totalActual / yearlyTarget) * 100 : 0;
    
    const yAxisMax = useMemo(() => {
        const maxActual = Math.max(...chartData.map(d => d.Actual || 0));
        const maxTarget = Math.max(...chartData.map(d => d.Target || 0));
        const highestValue = Math.max(maxActual, maxTarget);
        return highestValue === 0 ? 100 : highestValue;
    }, [chartData]);

    const handlePointClick = (data: any) => {
        if (data && data.activePayload && data.activePayload.length > 0) {
            const monthName = data.activePayload[0].payload.month;
            const monthIndex = MONTH_NAMES.indexOf(monthName);
            const kpiForMonth = dataForKpi.find(d => d.month === monthIndex + 1);
            if (kpiForMonth) {
                setSelectedMonthKpi(kpiForMonth);
                setEditDialogOpen(true);
            }
        }
    };
    
    const handleSaveActual = (id: string, actual: number) => {
        if (!firestore) return;
        const docRef = doc(firestore, 'monthly_kpis', id);
        setDocumentNonBlocking(docRef, { actual: actual }, { merge: true });
        toast({ title: 'Success', description: 'Actual value has been updated.' });
    };

    return (
        <>
            <Card className="shadow-sm border-gray-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group flex flex-col flex-1 min-w-[320px] md:max-w-md">
                <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                        <CardTitle className="text-base font-semibold">{kpi.measure}</CardTitle>
                        <Badge variant={achievement >= 100 ? 'success' : achievement >= 80 ? 'warning' : 'destructive'}>
                            {achievement.toFixed(0)}%
                        </Badge>
                    </div>
                    <CardDescription>
                        Yearly Target: {(typeof kpi.target === 'string' ? kpi.target : kpi.target.toLocaleString())} {kpi.unit && `(${kpi.unit})`}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex">
                    <div className="h-40 w-full">
                        <ResponsiveContainer>
                            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} onClick={handlePointClick}>
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
                                <Line 
                                    type="monotone" 
                                    dataKey="Actual" 
                                    stroke="hsl(var(--primary))" 
                                    strokeWidth={2}
                                    dot={(props: any) => {
                                        const { cx, cy, payload } = props;
                                        if (payload.isEditable) {
                                            return (
                                                <g key={payload.month} className="cursor-pointer group/dot">
                                                    <circle cx={cx} cy={cy} r={8} fill="hsl(var(--primary))" fillOpacity={0.2} className="transition-opacity opacity-0 group-hover/dot:opacity-100" />
                                                    <circle cx={cx} cy={cy} r={4} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={2} />
                                                </g>
                                            );
                                        }
                                        return null;
                                    }}
                                    connectNulls={false}
                                />
                                <Line type="monotone" dataKey="Target" stroke="hsl(var(--accent))" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
            <EditDataDialog 
                isOpen={isEditDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                monthlyKpi={selectedMonthKpi}
                onSave={handleSaveActual}
            />
        </>
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
    return orgData ? [...new Set(orgData.map(e => e.department))].filter(Boolean) : [];
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
  const { kpiData, isKpiDataLoading, monthlyKpisData, isMonthlyKpisLoading } = useKpiData();
  
  const groupedKpis = useMemo(() => {
    if (!kpiData) return {};
    return kpiData.reduce((acc, kpi) => {
        const perspective = kpi.perspective || 'Uncategorized';
        if (!acc[perspective]) acc[perspective] = [];
        acc[perspective].push(kpi);
        return acc;
    }, {} as { [key: string]: WithId<CorporateKpi>[] });
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
