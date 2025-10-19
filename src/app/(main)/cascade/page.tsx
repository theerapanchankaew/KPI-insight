"use client";

import React, { useEffect, useState } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useKpiData } from '@/context/KpiDataContext';

const CorporateLevel = () => {
    const { kpiData } = useKpiData();
    const corporateKpis = kpiData?.kpi_catalog || [];
    
    if (corporateKpis.length === 0) {
        return (
            <Card>
                <CardContent className="p-6 text-center text-gray-500">
                    <p>No KPI data imported yet.</p>
                    <p>Please go to the "Import Data" page to upload a KPI file.</p>
                </CardContent>
            </Card>
        );
    }
    
    // Simple grouping by perspective.
    const groupedKpis: { [key: string]: any[] } = corporateKpis.reduce((acc, kpi) => {
        const perspective = kpi.perspective || 'Uncategorized';
        if (!acc[perspective]) acc[perspective] = [];
        acc[perspective].push(kpi);
        return acc;
    }, {} as { [key: string]: any[] });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(groupedKpis).map(([perspective, kpis]) => (
                <Card key={perspective}>
                    <CardHeader><CardTitle>{perspective} KPIs</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {kpis.map(kpi => (
                            <Card key={kpi.id}>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-gray-800">{kpi.measure}</span>
                                        <Badge variant="outline">{kpi.category}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        {/* Unit not always present, so we check */}
                                        <span className="text-2xl font-bold text-gray-800">{kpi.target} {kpi.unit && `(${kpi.unit})`}</span>
                                    </div>
                                     {/* Progress is a placeholder */}
                                    <Progress value={Math.random() * 100} className="h-2 mt-2" />
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
    const { orgData } = useKpiData();

    if (!orgData || orgData.employees.length === 0) {
         return (
            <Card>
                <CardContent className="p-6 text-center text-gray-500">
                    <p>No Organization data imported yet.</p>
                    <p>Please go to the "Import Data" page to upload an organization file.</p>
                </CardContent>
            </Card>
        );
    }
    
    const departments = [...new Set(orgData.employees.map(e => e.department))];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {departments.map(dept => (
                <Card key={dept}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <h4 className="text-lg font-semibold text-gray-800">{dept}</h4>
                             {/* Placeholder performance */}
                            <Badge variant="outline">Performance: 90%</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         {/* Placeholder KPIs */}
                        <div className="pl-4 border-l-4 border-primary">
                            <p className="font-medium text-gray-800">Department KPI 1</p>
                            <p className="text-xl font-bold text-primary">Value</p>
                        </div>
                        <div className="pl-4 border-l-4 border-secondary">
                            <p className="font-medium text-gray-800">Department KPI 2</p>
                            <p className="text-xl font-bold text-secondary">Value</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

const IndividualLevel = () => {
    const { orgData } = useKpiData();

    if (!orgData || orgData.employees.length === 0) {
         return (
            <Card>
                <CardHeader><CardTitle>Individual Performance</CardTitle></CardHeader>
                <CardContent className="p-6 text-center text-gray-500">
                    <p>No Organization data imported yet.</p>
                </CardContent>
            </Card>
        );
    }
    
    return (
    <div className="grid grid-cols-1 gap-6">
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
                            <TableHead>Position</TableHead>
                            <TableHead>Manager</TableHead>
                            <TableHead>KPIs Assigned</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orgData.employees.map(person => (
                            <TableRow key={person.id}>
                                <TableCell className="font-medium">{person.name}</TableCell>
                                <TableCell>{person.department}</TableCell>
                                <TableCell>{person.position}</TableCell>
                                <TableCell>{person.manager}</TableCell>
                                <TableCell><Badge variant="outline">0 KPIs</Badge></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
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
