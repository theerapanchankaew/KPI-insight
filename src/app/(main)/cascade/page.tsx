"use client";

import React, { useEffect, useState } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { kpiCascadeData as staticKpiData } from '@/lib/kpi-data';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useKpiData } from '@/context/KpiDataContext';

const statusMapping: { [key: string]: 'success' | 'warning' | 'destructive' } = {
  'Green': 'success',
  'Amber': 'warning',
  'Red': 'destructive',
};

const CorporateLevel = () => {
    const { kpiData } = useKpiData();

    // Use imported data if available, otherwise fall back to static data.
    const corporateKpis = kpiData?.kpi_catalog || [];
    
    // Simple grouping by perspective. A more robust solution might be needed for complex cases.
    const groupedKpis: { [key: string]: any[] } = corporateKpis.reduce((acc, kpi) => {
        const perspective = kpi.perspective || 'Uncategorized';
        if (!acc[perspective]) {
            acc[perspective] = [];
        }
        acc[perspective].push(kpi);
        return acc;
    }, {} as { [key: string]: any[] });

    if (corporateKpis.length === 0) {
        return (
            <Card>
                <CardContent className="p-6 text-center text-gray-500">
                    <p>No KPI data imported yet.</p>
                    <p>Please go to the "Import KPIs" page to upload a file.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(groupedKpis).map(([perspective, kpis]) => (
                <Card key={perspective}>
                    <CardHeader>
                        <CardTitle>{perspective} KPIs</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {kpis.map(kpi => (
                            <Card key={kpi.id}>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-gray-800">{kpi.measure}</span>
                                        {/* Status is not in the new data, so this is a placeholder */}
                                        <Badge variant="outline">{kpi.category}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-bold text-gray-800">{kpi.unit}</span>
                                        <span className="text-sm text-gray-500">{kpi.target}</span>
                                    </div>
                                    {/* Progress is not in the new data, so this is a placeholder */}
                                    <Progress value={50} className="h-2 mt-2" />
                                </CardContent>
                            </Card>
                        ))}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};


const DepartmentLevel = () => {
    const { kpiData } = useKpiData();
    // Using static data as a placeholder until cascading logic is implemented
    const departmentData = staticKpiData.department;
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {departmentData.map(dept => (
                <Card key={dept.name} className={cn("border-2", dept.borderColor)}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <h4 className="text-lg font-semibold text-gray-800">{dept.name}</h4>
                            <span className={cn("px-3 py-1 rounded-full text-sm font-medium", dept.statusColor)}>{dept.performance}</span>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {dept.kpis.map(kpi => (
                            <div key={kpi.name} className={cn("pl-4", kpi.borderColor)}>
                                <p className="font-medium text-gray-800">{kpi.name}</p>
                                <p className={cn("text-xl font-bold", kpi.borderColor === 'border-primary' ? 'text-primary' : kpi.borderColor === 'border-secondary' ? 'text-secondary' : kpi.borderColor === 'border-accent' ? 'text-accent' : 'text-success')}>{kpi.value}</p>
                                <p className="text-sm text-gray-500">{kpi.parent}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

const IndividualLevel = () => {
    // Using static data as a placeholder
    const individualData = staticKpiData.individual;
    return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
                <CardTitle>Individual Performance</CardTitle>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>KPI</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {individualData.map(person => (
                            <TableRow key={person.name}>
                                <TableCell className="font-medium">{person.name}</TableCell>
                                <TableCell>{person.department}</TableCell>
                                <TableCell>{person.kpi}</TableCell>
                                <TableCell><span className={cn("px-2 py-1 rounded-full text-xs font-medium", person.statusColor)}>{person.status}</span></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
         <Card>
            <CardHeader>
                <CardTitle>KPI Hierarchy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-primary rounded-full"></div>
                        <span className="font-medium text-gray-800">Total Revenue (Corporate)</span>
                    </div>
                </div>
                <div className="ml-6 space-y-2 border-l-2 border-gray-200 pl-6">
                     <div className="bg-blue-50 rounded-lg p-3">
                        <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-secondary rounded-full"></div>
                            <span className="text-sm font-medium text-gray-700">Sales Revenue (Department)</span>
                        </div>
                    </div>
                    <div className="ml-6 border-l-2 border-gray-200 pl-6">
                         <div className="bg-purple-50 rounded-lg p-3">
                            <div className="flex items-center space-x-3">
                                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                                <span className="text-sm text-gray-600">สมชาย - Monthly Revenue</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
);
}


export default function CascadePage() {
  const { setPageTitle } = useAppLayout();

  useEffect(() => {
    setPageTitle('Cascade KPI');
  }, [setPageTitle]);

  return (
    <div className="fade-in space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">KPI Cascade Structure</h3>
        <p className="text-gray-600">โครงสร้าง KPI แบบ 3 ระดับ: องค์กร → ฝ่าย → บุคคล</p>
      </div>
      <Tabs defaultValue="corporate" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="corporate">ระดับองค์กร</TabsTrigger>
          <TabsTrigger value="department">ระดับฝ่าย</TabsTrigger>
          <TabsTrigger value="individual">ระดับบุคคล</TabsTrigger>
        </TabsList>
        <TabsContent value="corporate" className="mt-6">
          <CorporateLevel />
        </TabsContent>
        <TabsContent value="department" className="mt-6">
          <DepartmentLevel />
        </TabsContent>
        <TabsContent value="individual" className="mt-6">
          <IndividualLevel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
