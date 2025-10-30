
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

const MonthlyReport = () => {
    const { orgData, isOrgDataLoading, cascadedKpis, isCascadedKpisLoading, monthlyKpisData, isMonthlyKpisLoading } = useKpiData();

    const isLoading = isOrgDataLoading || isCascadedKpisLoading || isMonthlyKpisLoading;

    // Memoize the data for the AI summary to prevent re-generating on every render
    const aiInputData = useMemo(() => {
        if (isLoading || !orgData || !cascadedKpis) return "[]";
        
        const dataForAI = {
            departments: orgData.map(e => e.department),
            cascadedKpis: cascadedKpis,
        };
        
        return JSON.stringify(dataForAI, null, 2);
    }, [orgData, cascadedKpis, isLoading]);

    const departmentPerformance = useMemo(() => {
        if (!cascadedKpis || !monthlyKpisData || !orgData) return [];

        const departments = [...new Set(orgData.map(e => e.department).filter(Boolean))];
        
        const performance = departments.map(dept => {
            const deptKpis = cascadedKpis.filter(kpi => kpi.department === dept);
            if (deptKpis.length === 0) {
                return { department: dept, achievement: 0 };
            }
            
            let totalTarget = 0;
            let totalActual = 0;

            deptKpis.forEach(kpi => {
                const monthlyForThisKpi = monthlyKpisData.filter(m => m.parentKpiId === kpi.corporateKpiId);
                const kpiTotalTarget = monthlyForThisKpi.reduce((sum, m) => sum + m.target, 0);
                const kpiTotalActual = monthlyForThisKpi.reduce((sum, m) => sum + m.actual, 0);
                
                // Weight the KPI's contribution
                const weightPercentage = kpi.weight / 100;
                totalTarget += kpiTotalTarget * weightPercentage;
                totalActual += kpiTotalActual * weightPercentage;
            });
            
            const achievement = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
            return { department: dept, achievement };
        });

        // Sort by achievement descending and take top 3
        return performance.sort((a, b) => b.achievement - a.achievement).slice(0, 3);

    }, [cascadedKpis, monthlyKpisData, orgData]);

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
                        <CardTitle>Top Performers (by Department)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                         {isLoading ? (
                            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
                         ) : departmentPerformance.map((dept, index) => (
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
                        ))}
                    </CardContent>
                </Card>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Detailed KPI Performance (Cascaded)</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>KPI</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Weight</TableHead>
                                <TableHead>Target</TableHead>
                                <TableHead>Actual (YTD)</TableHead>
                                <TableHead>Achievement</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                [...Array(4)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                                    </TableRow>
                                ))
                            ) : cascadedKpis && cascadedKpis.length > 0 ? (
                                cascadedKpis.map(kpi => {
                                    const monthlyForKpi = monthlyKpisData?.filter(m => m.parentKpiId === kpi.corporateKpiId) || [];
                                    const totalTarget = monthlyForKpi.reduce((sum, m) => sum + m.target, 0);
                                    const totalActual = monthlyForKpi.reduce((sum, m) => sum + m.actual, 0);
                                    const achievement = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
                                    
                                    return (
                                        <TableRow key={kpi.id}>
                                            <TableCell className="font-medium">{kpi.measure}</TableCell>
                                            <TableCell>{kpi.department}</TableCell>
                                            <TableCell>{kpi.weight}%</TableCell>
                                            <TableCell>{kpi.target}</TableCell>
                                            <TableCell>{totalActual.toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Badge variant={getAchievementBadgeVariant(achievement)}>
                                                    {achievement.toFixed(1)}%
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        No cascaded KPIs to report.
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
