"use client";

import React, { useEffect, useState } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { kpiCascadeData } from '@/lib/kpi-data';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Network } from 'lucide-react';

const statusClasses = {
  Green: 'bg-success text-success-foreground',
  Amber: 'bg-accent text-accent-foreground',
  Red: 'bg-destructive text-destructive-foreground',
};

const CorporateLevel = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Card className="bg-gradient-to-r from-green-50 to-blue-50">
      <CardContent className="p-6">
        <h4 className="text-lg font-semibold text-gray-800 mb-4">Financial KPIs</h4>
        <div className="space-y-4">
          {kpiCascadeData.corporate.financial.map(kpi => (
            <Card key={kpi.name}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-800">{kpi.name}</span>
                  <Badge variant={kpi.status.toLowerCase() as any}>{kpi.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-gray-800">{kpi.value}</span>
                  <span className="text-sm text-gray-500">{kpi.target}</span>
                </div>
                <Progress value={kpi.progress} className="h-2 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
     <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
      <CardContent className="p-6">
        <h4 className="text-lg font-semibold text-gray-800 mb-4">Operational KPIs</h4>
        <div className="space-y-4">
          {kpiCascadeData.corporate.operational.map(kpi => (
            <Card key={kpi.name}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-800">{kpi.name}</span>
                  <Badge variant={kpi.status.toLowerCase() as any}>{kpi.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-gray-800">{kpi.value}</span>
                  <span className="text-sm text-gray-500">{kpi.target}</span>
                </div>
                <Progress value={kpi.progress} className="h-2 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
    <Card className="lg:col-span-2 bg-gradient-to-r from-green-50 to-emerald-50">
      <CardContent className="p-6">
        <h4 className="text-lg font-semibold text-gray-800 mb-4">ESG KPIs</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {kpiCascadeData.corporate.esg.map(kpi => (
            <Card key={kpi.name}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-800">{kpi.name}</span>
                  <Badge variant={kpi.status.toLowerCase() as any}>{kpi.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-gray-800">{kpi.value}</span>
                  <span className="text-sm text-gray-500">{kpi.target}</span>
                </div>
                <Progress value={kpi.progress} className="h-2 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

const DepartmentLevel = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {kpiCascadeData.department.map(dept => (
            <Card key={dept.name} className={cn("border-2", dept.borderColor)}>
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-800">{dept.name}</h4>
                        <span className={cn("px-3 py-1 rounded-full text-sm font-medium", dept.statusColor)}>{dept.performance}</span>
                    </div>
                    <div className="space-y-4">
                        {dept.kpis.map(kpi => (
                            <div key={kpi.name} className={cn("pl-4", kpi.borderColor)}>
                                <p className="font-medium text-gray-800">{kpi.name}</p>
                                <p className={cn("text-xl font-bold", kpi.borderColor === 'border-primary' ? 'text-primary' : kpi.borderColor === 'border-secondary' ? 'text-secondary' : kpi.borderColor === 'border-accent' ? 'text-accent' : 'text-success')}>{kpi.value}</p>
                                <p className="text-sm text-gray-500">{kpi.parent}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        ))}
    </div>
);

const IndividualLevel = () => (
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
                        {kpiCascadeData.individual.map(person => (
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
