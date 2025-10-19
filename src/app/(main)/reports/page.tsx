"use client";

import React, { useEffect } from 'react';
import { useAppLayout } from '../layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { kpiReportData } from '@/lib/kpi-data';
import { Download, FileWarning } from 'lucide-react';
import ExecutiveSummary from './components/executive-summary';

const MonthlyReport = () => {
    const { monthly } = kpiReportData;
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ExecutiveSummary kpiData={JSON.stringify(monthly, null, 2)} />
                <Card>
                    <CardHeader>
                        <CardTitle>Top Performers</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {monthly.topPerformers.map(performer => (
                            <div key={performer.name} className={cn("flex items-center justify-between p-3 rounded-lg", 
                                performer.color === 'success' ? 'bg-success/10' : performer.color === 'secondary' ? 'bg-secondary/10' : 'bg-primary/10'
                            )}>
                                <div>
                                    <p className="font-medium text-gray-800">{performer.name}</p>
                                    <p className="text-sm text-gray-600">{performer.department}</p>
                                </div>
                                <span className={cn("text-lg font-bold", 
                                    performer.color === 'success' ? 'text-success' : performer.color === 'secondary' ? 'text-secondary' : 'text-primary'
                                )}>{performer.performance}</span>
                            </div>
                        ))}
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
                                <TableHead>KPI</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Target</TableHead>
                                <TableHead>Actual</TableHead>
                                <TableHead>Achievement</TableHead>
                                <TableHead>Trend</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {monthly.detailed.map(kpi => (
                                <TableRow key={kpi.kpi}>
                                    <TableCell className="font-medium">{kpi.kpi}</TableCell>
                                    <TableCell>{kpi.department}</TableCell>
                                    <TableCell>{kpi.target}</TableCell>
                                    <TableCell>{kpi.actual}</TableCell>
                                    <TableCell>
                                        <Badge variant={kpi.achievement >= 100 ? 'success' : kpi.achievement >= 80 ? 'warning' : 'destructive'}>
                                            {kpi.achievement}%
                                        </Badge>
                                    </TableCell>
                                    <TableCell className={cn('font-medium', `text-${kpi.trendColor}`)}>{kpi.trend}</TableCell>
                                </TableRow>
                            ))}
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
            <Card className="bg-gradient-to-r from-primary to-secondary text-white">
                <CardContent className="p-6">
                    <h4 className="text-lg font-semibold mb-2">Q4 2024 Performance</h4>
                    <p className="text-3xl font-bold">{quarterly.overall}</p>
                    <p className="text-sm opacity-90">Overall Achievement</p>
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-success to-primary text-white">
                <CardContent className="p-6">
                    <h4 className="text-lg font-semibold mb-2">KPIs Achieved</h4>
                    <p className="text-3xl font-bold">{quarterly.achieved}</p>
                    <p className="text-sm opacity-90">Total KPIs</p>
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-secondary to-purple-600 text-white">
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
