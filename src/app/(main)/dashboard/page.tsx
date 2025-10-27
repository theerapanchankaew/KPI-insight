
"use client"

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { performanceChartData } from '@/lib/data/dashboard-data';
import { useAppLayout } from '../layout';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import KpiInsights from './components/kpi-insights';
import { TrendingUp, TrendingDown, Briefcase, Building2, CheckCircle, Target } from 'lucide-react';
import { useKpiData } from '@/context/KpiDataContext';
import { Skeleton } from '@/components/ui/skeleton';

const SummaryCards = () => {
  const { kpiData, isKpiDataLoading } = useKpiData();

  if (isKpiDataLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}
      </div>
    );
  }

  const displayedKpis = kpiData?.slice(0, 4) || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {displayedKpis.map((kpi) => (
        <Card key={kpi.id} className="shadow-sm border-gray-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group">
          <CardHeader className="p-5">
            <div className="flex items-start justify-between">
              <div className={cn("w-11 h-11 rounded-lg flex items-center justify-center transition-colors bg-primary/10")}>
                <Target className={cn("w-6 h-6 text-primary")} />
              </div>
              <span className={cn("text-xs font-semibold flex items-center text-muted-foreground")}>
                (Live)
              </span>
            </div>
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-500 truncate">{kpi.measure}</p>
              <p className="text-2xl font-bold text-gray-800">{kpi.target}</p>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
             <p className="text-xs text-gray-500">Target Value</p>
          </CardContent>
        </Card>
      ))}
       {displayedKpis.length < 4 && [...Array(4 - displayedKpis.length)].map((_, i) => (
         <Card key={`placeholder-${i}`} className="shadow-sm border-gray-200 flex flex-col items-center justify-center h-40">
           <Briefcase className="w-8 h-8 text-gray-300" />
           <p className="text-sm text-gray-400 mt-2">No KPI Data</p>
           <p className="text-xs text-gray-400">Import in Intake Data</p>
         </Card>
       ))}
    </div>
  )
};

const PerformanceOverview = () => {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <Card className="shadow-sm border-gray-200 lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Performance Overview</CardTitle>
          <div className="flex space-x-1">
            <Button size="sm" variant="outline" className="text-xs h-8">Month</Button>
            <Button size="sm" variant="ghost" className="text-xs h-8">Quarter</Button>
            <Button size="sm" variant="ghost" className="text-xs h-8">Year</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pl-2">
        {isClient && (
          <ChartContainer config={performanceChartData.config} className="h-64 w-full">
              <LineChart data={performanceChartData.data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#e5e7eb' }} tickMargin={10} fontSize={12} />
                  <YAxis tickLine={false} axisLine={{ stroke: '#e5e7eb' }} tickMargin={10} fontSize={12} />
                  <Tooltip 
                      contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '0.75rem',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                      }}
                  />
                  <Line type="monotone" dataKey="Revenue" stroke="var(--color-Revenue)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--color-Revenue)', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="EBITDA" stroke="var(--color-EBITDA)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--color-EBITDA)', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
          </ChartContainer>
        )}
         <div className="flex items-center justify-center space-x-6 mt-4">
          {Object.entries(performanceChartData.config).map(([key, value]) => (
             <div key={key} className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: value.color }}></div>
              <span className="text-xs text-gray-500">{value.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

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

  useEffect(() => {
    setPageTitle('Dashboard');
  }, [setPageTitle]);

  return (
    <div className="fade-in space-y-6">
      <SummaryCards />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PerformanceOverview />
        <KpiInsights />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DepartmentPerformance />
      </div>
    </div>
  );
}
