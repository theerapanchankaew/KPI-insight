
"use client";

import React, { useEffect, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Download, FileWarning } from 'lucide-react';
import ExecutiveSummary from './components/executive-summary';
import { useKpiData } from '@/context/KpiDataContext';
import { kpiReportData } from '@/lib/data/report-data'; // Keep for quarterly
import { Skeleton } from '@/components/ui/skeleton';

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const MonthlyReport = () => {
    const { orgData, isOrgDataLoading, cascadedKpis, isCascadedKpisLoading, monthlyKpisData, isMonthlyKpisLoading } = useKpiData();

    const isLoading = isOrgDataLoading || isCascadedKpisLoading || isMonthlyKpisLoading;

    const currentMonthIndex = useMemo(() => {
        if (!monthlyKpisData || monthlyKpisData.length === 0) {
            return new Date().getMonth(); // Default to current month if no data
        }
        // Find the latest month that has an 'actual' value greater than 0
        const latestMonthWithActuals = monthlyKpisData
            .filter(m => m.actual > 0)
            .reduce((latest, m) => m.month > latest ? m.month : latest, 0);
        
        return latestMonthWithActuals > 0 ? latestMonthWithActuals - 1 : new Date().getMonth();
    }, [monthlyKpisData]);
    
    const currentMonthName = MONTH_NAMES[currentMonthIndex];


    const aiInputData = useMemo(() => {
        if (isLoading || !orgData || !cascadedKpis || !monthlyKpisData) return "[]";
        
        const dataForAI = {
            reportMonth: currentMonthName,
            departments: orgData.map(e => e.department),
            cascadedKpis: cascadedKpis.map(kpi => {
                 const monthlyForKpi = monthlyKpisData?.filter(m => m.parentKpiId === kpi.corporateKpiId) || [];
                 const ytdActual = monthlyForKpi.reduce((sum, m) => sum + m.actual, 0);
                 return { ...kpi, ytdActual };
            }),
        };
        
        return JSON.stringify(dataForAI, null, 2);
    }, [orgData, cascadedKpis, monthlyKpisData, isLoading, currentMonthName]);

    const departmentPerformance = useMemo(() => {
        if (!cascadedKpis || !monthlyKpisData || !orgData) return [];

        const departments = [...new Set(orgData.map(e => e.department).filter(Boolean))];
        
        const performance = departments.map(dept => {
            const deptKpis = cascadedKpis.filter(kpi => kpi.department === dept);
            if (deptKpis.length === 0) {
                return { department: dept, achievement: 0 };
            }
            
            let totalWeightedAchievement = 0;
            let totalWeight = 0;

            deptKpis.forEach(kpi => {
                const monthlyForThisKpi = monthlyKpisData.filter(m => m.parentKpiId === kpi.corporateKpiId && m.month <= currentMonthIndex + 1);
                const ytdTarget = monthlyForThisKpi.reduce((sum, m) => sum + m.target, 0);
                const ytdActual = monthlyForThisKpi.reduce((sum, m) => sum + m.actual, 0);
                
                const achievement = ytdTarget > 0 ? (ytdActual / ytdTarget) * 100 : 0;
                const weight = kpi.weight || 0;

                totalWeightedAchievement += achievement * weight;
                totalWeight += weight;
            });
            
            const overallAchievement = totalWeight > 0 ? totalWeightedAchievement / totalWeight : 0;
            return { department: dept, achievement: overallAchievement };
        });

        return performance.sort((a, b) => b.achievement - a.achievement).slice(0, 3);

    }, [cascadedKpis, monthlyKpisData, orgData, currentMonthIndex]);

    const getAchievementBadgeVariant = (achievement: number): "success" | "warning" | "destructive" => {
        if (achievement >= 100) return 'success';
        if (achievement >= 80) return 'warning';
        return 'destructive';
    }


    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ExecutiveSummary kpiData={aiInputData} />
                <Card>
                    <CardHeader>
                        <CardTitle>Top Performers (YTD)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                         {isLoading ? (
                            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
                         ) : departmentPerformance.length > 0 ? departmentPerformance.map((dept, index) => (
                            <div key={dept.department} className={cn("flex items-center justify-between p-3 rounded-lg", 
                                index === 0 ? 'bg-success/10' : index === 1 ? 'bg-blue-50' : 'bg-orange-50'
                            )}>
                                <div>
                                    <p className="font-medium text-gray-800">{dept.department}</p>
                                    <p className="text-sm text-gray-600">Department</p>
                                </div>
                                <span className={cn("text-lg font-bold", 
                                    index === 0 ? 'text-success' : index === 1 ? 'text-blue-600' : 'text-orange-600'
                                )}>
                                    {dept.achievement.toFixed(1)}% 
                                </span>
                            </div>
                        )) : <p className="text-sm text-center text-muted-foreground py-8">No performance data to rank.</p>}
                    </CardContent>
                </Card>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Detailed KPI Performance</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[25%]">KPI</TableHead>
                                <TableHead>Dept</TableHead>
                                <TableHead>Month Target ({currentMonthName})</TableHead>
                                <TableHead>Month Actual ({currentMonthName})</TableHead>
                                <TableHead>Month Ach. %</TableHead>
                                <TableHead>YTD Target</TableHead>
                                <TableHead>YTD Actual</TableHead>
                                <TableHead>YTD Ach. %</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                                    </TableRow>
                                ))
                            ) : cascadedKpis && cascadedKpis.length > 0 ? (
                                cascadedKpis.map(kpi => {
                                    const allMonthlyForKpi = monthlyKpisData?.filter(m => m.parentKpiId === kpi.corporateKpiId) || [];
                                    
                                    const currentMonthData = allMonthlyForKpi.find(m => m.month === currentMonthIndex + 1);
                                    const monthTarget = currentMonthData?.target || 0;
                                    const monthActual = currentMonthData?.actual || 0;
                                    const monthAchievement = monthTarget > 0 ? (monthActual / monthTarget) * 100 : 0;

                                    const ytdMonthlyData = allMonthlyForKpi.filter(m => m.month <= currentMonthIndex + 1);
                                    const ytdTarget = ytdMonthlyData.reduce((sum, m) => sum + m.target, 0);
                                    const ytdActual = ytdMonthlyData.reduce((sum, m) => sum + m.actual, 0);
                                    const ytdAchievement = ytdTarget > 0 ? (ytdActual / ytdTarget) * 100 : 0;
                                    
                                    return (
                                        <TableRow key={kpi.id}>
                                            <TableCell className="font-medium">{kpi.measure}</TableCell>
                                            <TableCell>{kpi.department}</TableCell>
                                            <TableCell>{monthTarget.toLocaleString()}</TableCell>
                                            <TableCell>{monthActual.toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Badge variant={getAchievementBadgeVariant(monthAchievement)} className="w-16 justify-center">
                                                    {monthAchievement.toFixed(0)}%
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{ytdTarget.toLocaleString()}</TableCell>
                                            <TableCell>{ytdActual.toLocaleString()}</TableCell>
                                            <TableCell>
                                                 <Badge variant={getAchievementBadgeVariant(ytdAchievement)} className="w-16 justify-center">
                                                    {ytdAchievement.toFixed(0)}%
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">
                                        No cascaded KPIs to report. Deploy KPIs from the Cascade page.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

const QuarterlyReport = () => {
    const { quarterly } = kpiReportData;
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-r from-primary to-blue-600 text-white">
                <CardContent className="p-6">
                    <h4 className="text-lg font-semibold mb-2">Q4 2024 Performance</h4>
                    <p className="text-3xl font-bold">{quarterly.overall}</p>
                    <p className="text-sm opacity-90">Overall Achievement</p>
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                <CardContent className="p-6">
                    <h4 className="text-lg font-semibold mb-2">KPIs Achieved</h4>
                    <p className="text-3xl font-bold">{quarterly.achieved}</p>
                    <p className="text-sm opacity-90">Total KPIs</p>
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-orange-500 to-amber-600 text-white">
                <CardContent className="p-6">
                    <h4 className="text-lg font-semibold mb-2">Growth Rate</h4>
                    <p className="text-3xl font-bold">{quarterly.growth}</p>
                    <p className="text-sm opacity-90">vs Q3 2024</p>
                </CardContent>
            </Card>
        </div>
    );
}

const YearlyReport = () => (
    <div className="text-center py-12">
        <FileWarning className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h4 className="text-lg font-semibold text-gray-800 mb-2">Annual Report 2024</h4>
        <p className="text-gray-600 mb-4">รายงานประจำปี 2024 จะพร้อมใช้งานในเดือนมกราคม 2025</p>
        <Button>แจ้งเตือนเมื่อพร้อม</Button>
    </div>
);

export default function ReportsPage() {
  const { setPageTitle } = useAppLayout();

  useEffect(() => {
    setPageTitle('Reports');
  }, [setPageTitle]);

  return (
    <div className="fade-in space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">KPI Reports</h3>
          <p className="text-gray-600 mt-1">รายงานผลการดำเนินงาน รายเดือน/ไตรมาส/รายปี</p>
        </div>
        <Button variant="secondary">
          <Download className="w-5 h-5 mr-2" />
          Export All Reports
        </Button>
      </div>

      <Tabs defaultValue="monthly" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monthly">รายเดือน</TabsTrigger>
          <TabsTrigger value="quarterly">รายไตรมาส</TabsTrigger>
          <TabsTrigger value="yearly">รายปี</TabsTrigger>
        </TabsList>
        <TabsContent value="monthly" className="mt-6">
          <MonthlyReport />
        </TabsContent>
        <TabsContent value="quarterly" className="mt-6">
          <QuarterlyReport />
        </TabsContent>
        <TabsContent value="yearly" className="mt-6">
          <YearlyReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
