"use client"

import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { summaryCardsData, performanceChartData, ragStatusData, recentAlertsData, departmentPerformanceData } from '@/lib/kpi-data';
import { useAppLayout } from '../layout';
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { ChartConfig, ChartContainer } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';

const SummaryCards = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    {summaryCardsData.map((card, index) => (
      <Card key={index} className="shadow-sm border-gray-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
        <CardHeader className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", {
              'rag-green': card.rag === 'green',
              'rag-yellow': card.rag === 'yellow',
              'rag-red': card.rag === 'red',
            })}>
              <card.icon className="w-6 h-6 text-white" />
            </div>
            <span className={cn("text-xs font-medium", {
              'trend-up': card.trendDirection === 'up',
              'trend-down': card.trendDirection === 'down',
              'trend-stable': card.trendDirection === 'stable',
            })}>
              {card.trendDirection === 'up' && '↗'}
              {card.trendDirection === 'down' && '↘'}
              {card.trendDirection === 'stable' && '→'} {card.trend}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">{card.title}</p>
            <p className="text-2xl font-bold text-gray-800">{card.value}</p>
            <p className="text-xs text-gray-500 mt-1">{card.target}</p>
          </div>
        </CardHeader>
      </Card>
    ))}
  </div>
);

const PerformanceOverview = () => (
  <div className="lg:col-span-2">
    <Card className="shadow-sm border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Performance Overview</CardTitle>
          <div className="flex space-x-1">
            <Button size="sm" className="text-xs">เดือน</Button>
            <Button size="sm" variant="ghost" className="text-xs">ไตรมาส</Button>
            <Button size="sm" variant="ghost" className="text-xs">ปี</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={performanceChartData.config} className="h-64 w-full">
            <LineChart data={performanceChartData.data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis tickLine={false} axisLine={false} tickMargin={10} />
                <Tooltip 
                    contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                    }}
                />
                <Line type="monotone" dataKey="Revenue" stroke="var(--color-Revenue)" strokeWidth={3} dot={false} className="chart-line" />
                <Line type="monotone" dataKey="EBITDA" stroke="var(--color-EBITDA)" strokeWidth={3} dot={false} className="chart-line" />
            </LineChart>
        </ChartContainer>
         <div className="flex items-center justify-center space-x-6 mt-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-primary rounded-full"></div><span className="text-sm text-gray-600">Revenue</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-secondary rounded-full"></div><span className="text-sm text-gray-600">EBITDA</span>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

const RagStatus = () => (
  <Card className="shadow-sm border-gray-200">
    <CardHeader>
      <CardTitle>RAG Status</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        {ragStatusData.statuses.map((status) => (
          <div key={status.name} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={cn("w-4 h-4 rounded-full", status.className)}></div>
              <span className="text-sm font-medium text-gray-700">{status.name}</span>
            </div>
            <span className="text-sm font-bold text-gray-800">{status.count} KPIs</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-center">
        <ChartContainer config={{}} className="h-28 w-28">
            <PieChart>
                <Pie data={ragStatusData.statuses} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={40} paddingAngle={2}>
                    {ragStatusData.statuses.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Pie>
            </PieChart>
        </ChartContainer>
      </div>
    </CardContent>
  </Card>
);

const RecentAlerts = () => (
  <Card className="shadow-sm border-gray-200">
    <CardHeader>
      <CardTitle>Recent Alerts</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {recentAlertsData.map((alert, index) => (
        <div key={index} className={cn("flex items-start space-x-3 p-3 rounded-lg", {
          'bg-destructive/10': alert.level === 'danger',
          'bg-accent/10': alert.level === 'warning',
          'bg-success/10': alert.level === 'success',
        })}>
          <div className={cn("w-2 h-2 rounded-full mt-1.5", {
            'bg-destructive': alert.level === 'danger',
            'bg-accent': alert.level === 'warning',
            'bg-success': alert.level === 'success',
          })}></div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">{alert.message}</p>
            <p className="text-xs text-gray-500">{alert.time}</p>
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

const DepartmentPerformance = () => (
  <Card className="shadow-sm border-gray-200 lg:col-span-3">
    <CardHeader>
      <CardTitle>Department Performance</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {departmentPerformanceData.map((dept, index) => (
          <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
            <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3", dept.bgClass)}>
              <dept.icon className={cn("w-8 h-8", dept.colorClass)} />
            </div>
            <h4 className="font-semibold text-gray-800">{dept.name}</h4>
            <p className={cn("text-2xl font-bold mt-2", dept.colorClass)}>{dept.percentage}</p>
            <p className="text-sm text-gray-500">{dept.kpis}</p>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  const { setPageTitle } = useAppLayout();

  useEffect(() => {
    setPageTitle('Dashboard');
  }, [setPageTitle]);

  return (
    <div className="fade-in space-y-8">
      <SummaryCards />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <PerformanceOverview />
        <div className="space-y-6">
          <RagStatus />
          <RecentAlerts />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DepartmentPerformance />
      </div>
    </div>
  );
}
