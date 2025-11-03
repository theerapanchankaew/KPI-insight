
"use client"

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppLayout } from '../layout';
import { LineChart, CartesianGrid, Tooltip, XAxis, YAxis, Line, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Building2, Target, Edit, Users, Network, Briefcase } from 'lucide-react';
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

// Helper to get the fiscal year months in order, starting from October
const getFiscalMonthNames = () => {
    const fiscalMonths = [];
    for (let i = 0; i < 12; i++) {
        fiscalMonths.push(MONTH_NAMES[(9 + i) % 12]);
    }
    return fiscalMonths;
};
const FISCAL_MONTH_NAMES = getFiscalMonthNames();


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
        const today = new Date();
        const currentMonth = today.getMonth(); // 0-11
        const currentYear = today.getFullYear();

        // Fiscal year starts in October. If we are in Oct, Nov, Dec, the fiscal year starts this calendar year.
        // If we are in Jan-Sep, the fiscal year started last calendar year.
        const fiscalYearStartYear = currentMonth >= 9 ? currentYear : currentYear - 1;

        return FISCAL_MONTH_NAMES.map((name, index) => {
            const monthIndex1Based = (9 + index) % 12 + 1; // Oct is 10, Jan is 1
            const year = fiscalYearStartYear + (monthIndex1Based < 10 ? 1 : 0);

            const monthData = dataForKpi.find(d => d.month === monthIndex1Based && d.year === year);
            return {
                month: name,
                Actual: monthData?.actual ?? null, // Use null for missing data to create gaps
                Target: monthData?.target || 0,
                isEditable: !!monthData,
            };
        });
    }, [dataForKpi]);
    
    const chartConfig = {
      Actual: { label: 'Actual', color: 'hsl(var(--primary))' },
      Target: { label: 'Target', color: 'hsl(var(--accent))' },
    };

    const totalActual = useMemo(() => dataForKpi.reduce((sum, item) => sum + (item.actual || 0), 0), [dataForKpi]);
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
                    <ChartContainer config={chartConfig} className="h-40 w-full">
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
                    </ChartContainer>
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

const SummaryStatCard = ({ title, value, icon: Icon, isLoading }: { title: string, value: string | number, icon: React.ElementType, isLoading: boolean }) => (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
            <Icon className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {isLoading ? <Skeleton className="h-6 w-12 mt-1" /> : <p className="text-2xl font-bold">{value}</p>}
        </div>
      </CardContent>
    </Card>
);


const DepartmentPerformanceChart = () => {
    const { orgData, cascadedKpis, monthlyKpisData, isOrgDataLoading, isCascadedKpisLoading, isMonthlyKpisLoading } = useKpiData();

    const performanceData = useMemo(() => {
        if (!orgData || !cascadedKpis || !monthlyKpisData) return [];

        const departments = [...new Set(orgData.map(e => e.department).filter(Boolean))];

        const data = departments.map(dept => {
            const deptKpis = cascadedKpis.filter(kpi => kpi.department === dept);
            if (deptKpis.length === 0) {
                return { name: dept, achievement: 0 };
            }
            
            let totalWeightedAchievement = 0;
            let totalWeight = 0;

            deptKpis.forEach(kpi => {
                const relevantMonthly = monthlyKpisData.filter(m => m.parentKpiId === kpi.corporateKpiId);
                const ytdTarget = relevantMonthly.reduce((sum, m) => sum + m.target, 0) * (kpi.weight / 100);
                const ytdActual = relevantMonthly.reduce((sum, m) => sum + m.actual, 0) * (kpi.weight / 100);

                const achievement = ytdTarget > 0 ? (ytdActual / ytdTarget) * 100 : 0;
                
                totalWeightedAchievement += achievement * kpi.weight;
                totalWeight += kpi.weight;
            });
            
            const overallAchievement = totalWeight > 0 ? totalWeightedAchievement / totalWeight : 0;
            return { name: dept, achievement: overallAchievement };
        });

        return data.sort((a,b) => b.achievement - a.achievement);

    }, [orgData, cascadedKpis, monthlyKpisData]);

    const isLoading = isOrgDataLoading || isCascadedKpisLoading || isMonthlyKpisLoading;
    
    const chartConfig = {
      achievement: { label: 'Achievement' },
    };

    const getColor = (value: number) => {
      if (value >= 100) return 'hsl(var(--success))';
      if (value >= 80) return 'hsl(var(--accent))';
      return 'hsl(var(--destructive))';
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>YTD Department Performance</CardTitle>
                <CardDescription>Overall weighted KPI achievement by department.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <Skeleton className="h-64" />
                ) : performanceData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-64 w-full">
                        <ResponsiveContainer>
                            <BarChart data={performanceData} layout="vertical" margin={{ left: 10 }}>
                                <CartesianGrid horizontal={false} />
                                <XAxis type="number" dataKey="achievement" unit="%" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tickMargin={8} width={80} />
                                <Tooltip
                                    cursor={{ fill: 'hsl(var(--muted))' }}
                                    content={<ChartTooltipContent formatter={(value) => `${Number(value).toFixed(1)}%`} />}
                                />
                                <Bar dataKey="achievement" radius={4}>
                                    {performanceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={getColor(entry.achievement)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                ) : (
                    <div className="col-span-3 text-center py-10">
                        <Building2 className="w-12 h-12 text-gray-300 mx-auto" />
                        <h4 className="mt-4 font-semibold text-gray-600">No Department Data</h4>
                        <p className="text-sm text-gray-500">Please import organization data in the "Intake Data" page.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


export default function DashboardPage() {
  const { setPageTitle } = useAppLayout();
  const { kpiData, cascadedKpis, orgData, isKpiDataLoading, isCascadedKpisLoading, isOrgDataLoading, monthlyKpisData, isMonthlyKpisLoading } = useKpiData();
  
  const firestore = useFirestore();
  const individualKpisQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'individual_kpis'), where('status', 'in', [
      'Agreed',
      'In-Progress',
      'Manager Review',
      'Upper Manager Approval',
      'Employee Acknowledged',
      'Closed'
    ]));
  }, [firestore]);

  const { data: individualKpis, isLoading: isIndividualKpisLoading } = useCollection(individualKpisQuery);
  
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
  
  const isLoading = isKpiDataLoading || isMonthlyKpisLoading || isCascadedKpisLoading || isOrgDataLoading || isIndividualKpisLoading;
  
  const summaryStats = useMemo(() => ({
    totalKpis: kpiData?.length ?? 0,
    cascadedKpis: cascadedKpis?.length ?? 0,
    assignedKpis: individualKpis?.length ?? 0,
    totalEmployees: orgData?.length ?? 0,
  }), [kpiData, cascadedKpis, individualKpis, orgData]);

  return (
    <div className="fade-in space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SummaryStatCard title="Total KPIs" value={summaryStats.totalKpis} icon={Target} isLoading={isLoading} />
            <SummaryStatCard title="Cascaded KPIs" value={summaryStats.cascadedKpis} icon={Network} isLoading={isLoading} />
            <SummaryStatCard title="Assigned KPIs" value={summaryStats.assignedKpis} icon={Briefcase} isLoading={isLoading} />
            <SummaryStatCard title="Total Employees" value={summaryStats.totalEmployees} icon={Users} isLoading={isLoading} />
        </div>

        <div className="space-y-6">
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

      <DepartmentPerformanceChart />
    </div>
  );
}

    

    
