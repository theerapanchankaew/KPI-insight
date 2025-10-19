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
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Type for a corporate KPI
interface CorporateKpi {
  id: string;
  measure: string;
  target: string;
  category: string;
  perspective: string;
  unit?: string;
}

// Type for a cascaded KPI in a department
interface CascadedKpi extends CorporateKpi {
  department: string;
  weight: number;
  departmentTarget: string;
}

const CorporateLevel = ({ onCascadeClick }: { onCascadeClick: (kpi: CorporateKpi) => void }) => {
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
    
    const groupedKpis: { [key: string]: CorporateKpi[] } = corporateKpis.reduce((acc, kpi) => {
        const perspective = kpi.perspective || 'Uncategorized';
        if (!acc[perspective]) acc[perspective] = [];
        acc[perspective].push(kpi);
        return acc;
    }, {} as { [key: string]: CorporateKpi[] });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(groupedKpis).map(([perspective, kpis]) => (
                <Card key={perspective}>
                    <CardHeader><CardTitle>{perspective} KPIs</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {kpis.map(kpi => (
                            <Card key={kpi.id}>
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <span className="font-medium text-gray-800 pr-4">{kpi.measure}</span>
                                        <Badge variant="outline">{kpi.category}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-bold text-gray-800">{kpi.target} {kpi.unit && `(${kpi.unit})`}</span>
                                    </div>
                                    <Progress value={Math.random() * 100} className="h-2 mt-2" />
                                    <div className="flex justify-end mt-4">
                                      <Button size="sm" onClick={() => onCascadeClick(kpi)}>Cascade</Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};


const DepartmentLevel = ({ cascadedKpis }: { cascadedKpis: CascadedKpi[] }) => {
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
    const kpisByDepartment = cascadedKpis.reduce((acc, kpi) => {
        if (!acc[kpi.department]) {
            acc[kpi.department] = [];
        }
        acc[kpi.department].push(kpi);
        return acc;
    }, {} as Record<string, CascadedKpi[]>);


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
                        {kpisByDepartment[dept] && kpisByDepartment[dept].length > 0 ? (
                            kpisByDepartment[dept].map(kpi => (
                                <div key={kpi.id} className="pl-4 border-l-4 border-primary">
                                    <p className="font-medium text-gray-800">{kpi.measure}</p>
                                    <p className="text-sm text-gray-500">Weight: {kpi.weight}%</p>
                                    <p className="text-xl font-bold text-primary">{kpi.departmentTarget}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-gray-500">No KPIs cascaded yet.</p>
                        )}
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

const CascadeDialog = ({
    isOpen,
    onClose,
    kpi,
    departments,
    onConfirm,
}: {
    isOpen: boolean;
    onClose: () => void;
    kpi: CorporateKpi | null;
    departments: string[];
    onConfirm: (cascadedKpi: CascadedKpi) => void;
}) => {
    const [department, setDepartment] = useState('');
    const [target, setTarget] = useState('');
    const [weight, setWeight] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setDepartment('');
            setTarget('');
            setWeight('');
        }
    }, [isOpen]);

    const handleSubmit = () => {
        if (kpi && department && target && weight) {
            onConfirm({
                ...kpi,
                department,
                departmentTarget: target,
                weight: parseInt(weight, 10),
            });
            onClose();
        }
    };

    if (!kpi) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cascade KPI: {kpi.measure}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="department-select">Department</Label>
                        <Select onValueChange={setDepartment} value={department}>
                            <SelectTrigger id="department-select">
                                <SelectValue placeholder="Select a department" />
                            </SelectTrigger>
                            <SelectContent>
                                {departments.map(dept => (
                                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="department-target">Target</Label>
                        <Input id="department-target" value={target} onChange={e => setTarget(e.target.value)} placeholder={`e.g., ${kpi.target}`} />
                    </div>
                    <div className="spacey-y-2">
                        <Label htmlFor="department-weight">Weight (%)</Label>
                        <Input id="department-weight" type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g., 20" />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSubmit}>Confirm Cascade</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function CascadePage() {
  const { setPageTitle } = useAppLayout();
  const { orgData } = useKpiData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<CorporateKpi | null>(null);
  const [cascadedKpis, setCascadedKpis] = useState<CascadedKpi[]>([]);

  useEffect(() => {
    setPageTitle('Cascade KPI');
  }, [setPageTitle]);

  const departments = orgData ? [...new Set(orgData.employees.map(e => e.department))] : [];

  const handleCascadeClick = (kpi: CorporateKpi) => {
      setSelectedKpi(kpi);
      setIsModalOpen(true);
  };

  const handleConfirmCascade = (cascadedKpi: CascadedKpi) => {
      setCascadedKpis(prev => [...prev, cascadedKpi]);
  };

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
          <CorporateLevel onCascadeClick={handleCascadeClick} />
        </TabsContent>
        <TabsContent value="department" className="mt-6">
          <DepartmentLevel cascadedKpis={cascadedKpis} />
        </TabsContent>
        <TabsContent value="individual" className="mt-6">
          <IndividualLevel />
        </TabsContent>
      </Tabs>
      <CascadeDialog 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        kpi={selectedKpi}
        departments={departments}
        onConfirm={handleConfirmCascade}
      />
    </div>
  );
}
