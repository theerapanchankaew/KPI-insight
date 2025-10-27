

"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useKpiData, type Kpi, type Employee } from '@/context/KpiDataContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronsUpDown, PlusCircle, Trash2 } from 'lucide-react';
import { WithId } from '@/firebase';


// Type for a corporate KPI
type CorporateKpi = WithId<Kpi>;

// Type for a cascaded KPI in a department
interface CascadedKpi extends CorporateKpi {
  department: string;
  weight: number;
  departmentTarget: string;
}

// Base type for any individual KPI
interface IndividualKpiBase {
    employeeId: string;
    kpiId: string;
    kpiMeasure: string;
    weight: number;
}

// Type for individual KPI assignment from a cascaded KPI
interface AssignedCascadedKpi extends IndividualKpiBase {
    type: 'cascaded';
    target: string;
}

// Type for a new, committed KPI
interface CommittedKpi extends IndividualKpiBase {
    type: 'committed';
    task: string;
    targets: {
        level1: string;
        level2: string;
        level3: string;
        level4: string;
        level5: string;
    };
}

type IndividualKpi = AssignedCascadedKpi | CommittedKpi;


const CorporateLevel = ({ onCascadeClick }: { onCascadeClick: (kpi: CorporateKpi) => void }) => {
    const { kpiData, isKpiDataLoading } = useKpiData();
    
    if (isKpiDataLoading) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Corporate KPIs</CardTitle>
                </CardHeader>
                <CardContent className="p-6 text-center text-gray-500">
                    <p>Loading KPI data from Firestore...</p>
                </CardContent>
            </Card>
        )
    }

    if (!kpiData || kpiData.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Corporate KPIs</CardTitle>
                </CardHeader>
                <CardContent className="p-6 text-center text-gray-500">
                    <p>No KPI data has been imported.</p>
                    <p className="mt-2">Please go to the "Intake Data" page to upload a KPI data file.</p>
                </CardContent>
            </Card>
        );
    }
    
    const groupedKpis: { [key: string]: CorporateKpi[] } = kpiData.reduce((acc, kpi) => {
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
                                    <Progress value={75} className="h-2 mt-2" />
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
    const { orgData, isOrgDataLoading } = useKpiData();

     if (isOrgDataLoading) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Department Performance</CardTitle>
                </CardHeader>
                <CardContent className="p-6 text-center text-gray-500">
                    <p>Loading Organization data from Firestore...</p>
                </CardContent>
            </Card>
        )
    }

    if (!orgData || orgData.length === 0) {
         return (
            <Card>
                <CardHeader>
                    <CardTitle>Department Performance</CardTitle>
                </CardHeader>
                <CardContent className="p-6 text-center text-gray-500">
                    <p>No Organization data has been imported.</p>
                    <p className="mt-2">Please go to the "Intake Data" page to upload an organization data file.</p>
                </CardContent>
            </Card>
        );
    }
    
    const departments = [...new Set(orgData.map(e => e.department))];
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

const AssignedKpiGrid = ({ kpis }: { kpis: IndividualKpi[] }) => {
    const summary = useMemo(() => {
        const totalWeight = kpis.reduce((sum, kpi) => sum + kpi.weight, 0);
        const cascadedCount = kpis.filter(kpi => kpi.type === 'cascaded').length;
        const committedCount = kpis.filter(kpi => kpi.type === 'committed').length;
        return { totalWeight, cascadedCount, committedCount };
    }, [kpis]);

    return (
    <div className="px-6 py-4 bg-gray-50/50">
        {kpis.length > 0 ? (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>KPI/Task</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Weight</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {kpis.map(kpi => (
                        <TableRow key={kpi.kpiId}>
                            <TableCell>
                                <Badge variant={kpi.type === 'cascaded' ? 'secondary' : 'default'}>{kpi.type}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                                {kpi.type === 'committed' ? kpi.task : kpi.kpiMeasure}
                            </TableCell>
                            <TableCell>
                                {kpi.type === 'cascaded' ? kpi.target : "5-level scale"}
                            </TableCell>
                            <TableCell>{kpi.weight}%</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        ) : (
            <p className="text-sm text-center text-gray-500 py-4">No KPIs assigned to this individual yet.</p>
        )}
        <div className="mt-4 p-4 border-t">
            <div className="flex justify-between items-center text-sm">
                <div className="flex space-x-4">
                    <span>Cascaded: <span className="font-bold">{summary.cascadedCount}</span></span>
                    <span>Committed: <span className="font-bold">{summary.committedCount}</span></span>
                </div>
                <div className={cn("font-bold", summary.totalWeight > 100 ? "text-destructive" : "text-gray-800")}>
                    Total Weight: {summary.totalWeight}%
                </div>
            </div>
        </div>
    </div>
);
}


const IndividualLevel = ({ cascadedKpis, individualKpis, onAssignKpi }: { cascadedKpis: CascadedKpi[], individualKpis: IndividualKpi[], onAssignKpi: (employee: WithId<Employee>) => void }) => {
    const { orgData, isOrgDataLoading } = useKpiData();

    if (isOrgDataLoading) {
        return (
             <Card>
                <CardHeader><CardTitle>Individual Performance</CardTitle></CardHeader>
                <CardContent className="p-6 text-center text-gray-500">
                   <p>Loading Organization data from Firestore...</p>
                </CardContent>
            </Card>
        )
    }

    if (!orgData || orgData.length === 0) {
         return (
            <Card>
                <CardHeader><CardTitle>Individual Performance</CardTitle></Header>
                <CardContent className="p-6 text-center text-gray-500">
                    <p>No Organization data has been imported.</p>
                    <p className="mt-2">Please go to the "Intake Data" page to upload an organization data file.</p>
                </CardContent>
            </Card>
        );
    }
    
    const managers = [...new Set(orgData.map(e => e.manager))].filter(Boolean); // Filter out empty manager names

    return (
        <div className="space-y-8">
            {managers.map(manager => {
                const directReports = orgData.filter(e => e.manager === manager);
                const managerAsEmployee = orgData.find(e => e.name === manager);
                
                const team = managerAsEmployee ? [managerAsEmployee, ...directReports] : directReports;

                return (
                    <Card key={manager}>
                        <CardHeader>
                            <CardTitle>Team: {manager}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 divide-y">
                            {team.map(person => {
                                const assignedForPerson = individualKpis.filter(ik => ik.employeeId === person.id);
                                return (
                                    <Collapsible key={person.id}>
                                        <CollapsibleTrigger className="w-full">
                                            <div className="flex items-center justify-between p-4 hover:bg-gray-50/80 transition-colors w-full text-left">
                                                <div className="grid grid-cols-4 gap-4 flex-1">
                                                    <span className="font-medium">{person.name} {person.name === manager && <Badge variant="secondary" className="ml-2">Manager</Badge>}</span>
                                                    <span>{person.position}</span>
                                                    <span>{person.department}</span>
                                                    <Badge variant="outline" className="w-fit">{assignedForPerson.length} KPIs</Badge>
                                                </div>
                                                <ChevronsUpDown className="h-4 w-4 text-gray-500 ml-4" />
                                            </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <AssignedKpiGrid kpis={assignedForPerson} />
                                            <div className="p-4 bg-gray-50/50 border-t flex justify-end">
                                                 <Button variant="outline" size="sm" onClick={() => onAssignKpi(person)}>
                                                    Assign KPI
                                                </Button>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                )
                            })}
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    );
};

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
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
    const [target, setTarget] = useState('');
    const [weight, setWeight] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setSelectedDepartments([]);
            setTarget('');
            setWeight('');
        }
    }, [isOpen]);
    
    const handleDepartmentToggle = (department: string, checked: boolean) => {
        setSelectedDepartments(prev => 
            checked ? [...prev, department] : prev.filter(d => d !== department)
        );
    };

    const handleSubmit = () => {
        if (kpi && selectedDepartments.length > 0 && target && weight) {
            selectedDepartments.forEach(department => {
                onConfirm({
                    ...kpi,
                    department,
                    departmentTarget: target,
                    weight: parseInt(weight, 10),
                });
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
                        <Label>Departments</Label>
                        <ScrollArea className="h-32 w-full rounded-md border p-4">
                            <div className="space-y-2">
                                {departments.map(dept => (
                                    <div key={dept} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`dept-${dept}`}
                                            checked={selectedDepartments.includes(dept)}
                                            onCheckedChange={(checked) => handleDepartmentToggle(dept, !!checked)}
                                        />
                                        <Label htmlFor={`dept-${dept}`} className="font-normal">{dept}</Label>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="department-target">Target</Label>
                        <Input id="department-target" value={target} onChange={e => setTarget(e.target.value)} placeholder={`e.g., ${kpi.target}`} />
                    </div>
                    <div className="space-y-2">
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

const AssignKpiDialog = ({
    isOpen,
    onClose,
    employee,
    departmentKpis,
    onConfirm,
}: {
    isOpen: boolean;
    onClose: () => void;
    employee: WithId<Employee> | null;
    departmentKpis: CascadedKpi[];
    onConfirm: (assignment: IndividualKpi[]) => void;
}) => {
    const [assignmentType, setAssignmentType] = useState<'cascaded' | 'committed'>('cascaded');
    
    // State for assigning cascaded KPI
    type CascadedKpiSelection = { [kpiId: string]: { selected: boolean; weight: string; target: string } };
    const [selectedKpis, setSelectedKpis] = useState<CascadedKpiSelection>({});

    // State for creating a list of committed KPIs
    type CommittedKpiDraft = {
        id: number;
        task: string;
        kpiMeasure: string;
        weight: string;
        targets: { level1: string; level2: string; level3: string; level4: string; level5: string; };
    };
    const [committedKpis, setCommittedKpis] = useState<CommittedKpiDraft[]>([]);

    const relevantKpis = useMemo(() => {
        if (!employee) return [];
        return departmentKpis.filter(kpi => kpi.department === employee.department);
    }, [departmentKpis, employee]);

    useEffect(() => {
        if (isOpen) {
            const initialSelection: CascadedKpiSelection = {};
            relevantKpis.forEach(kpi => {
                initialSelection[kpi.id] = { selected: false, weight: '', target: '' };
            });
            setSelectedKpis(initialSelection);
        } else {
            // Reset all state on close
            setAssignmentType('cascaded');
            setSelectedKpis({});
            setCommittedKpis([]);
        }
    }, [isOpen, relevantKpis]);

    const handleKpiSelectionChange = (kpiId: string, field: 'selected' | 'weight' | 'target', value: string | boolean) => {
        setSelectedKpis(prev => ({
            ...prev,
            [kpiId]: { ...prev[kpiId], [field]: value }
        }));
    };

    const handleAddCommittedKpi = () => {
        setCommittedKpis(prev => [...prev, {
            id: Date.now(),
            task: '',
            kpiMeasure: '',
            weight: '',
            targets: { level1: '', level2: '', level3: '', level4: '', level5: '' }
        }]);
    };

    const handleCommittedKpiChange = (index: number, field: keyof CommittedKpiDraft, value: string) => {
        setCommittedKpis(prev => {
            const newKpis = [...prev];
            (newKpis[index] as any)[field] = value;
            return newKpis;
        });
    };
    
    const handleCommittedTargetChange = (index: number, level: keyof CommittedKpiDraft['targets'], value: string) => {
        setCommittedKpis(prev => {
            const newKpis = [...prev];
            newKpis[index].targets[level] = value;
            return newKpis;
        });
    };

    const handleRemoveCommittedKpi = (id: number) => {
        setCommittedKpis(prev => prev.filter(kpi => kpi.id !== id));
    };
    
    const handleSubmit = () => {
        if (!employee) return;
        
        const cascadedAssignments: AssignedCascadedKpi[] = [];
        for (const kpiId in selectedKpis) {
            const selection = selectedKpis[kpiId];
            if (selection.selected && selection.weight && selection.target) {
                const kpiDetails = relevantKpis.find(k => k.id === kpiId);
                if (kpiDetails) {
                    cascadedAssignments.push({
                        type: 'cascaded',
                        employeeId: employee.id,
                        kpiId: kpiId,
                        kpiMeasure: kpiDetails.measure,
                        target: selection.target,
                        weight: parseInt(selection.weight, 10),
                    });
                }
            }
        }

        const committedAssignments: CommittedKpi[] = committedKpis.map(draft => ({
            type: 'committed',
            employeeId: employee.id,
            kpiId: `committed-${draft.id}`, // Generate a unique ID
            kpiMeasure: draft.kpiMeasure,
            task: draft.task,
            targets: draft.targets,
            weight: parseInt(draft.weight, 10) || 0,
        })).filter(kpi => kpi.task && kpi.kpiMeasure && kpi.weight > 0);
        
        const allAssignments = [...cascadedAssignments, ...committedAssignments];

        if (allAssignments.length > 0) {
            onConfirm(allAssignments);
            onClose();
        }
    };
    
    const cascadedWeight = useMemo(() => {
        return Object.values(selectedKpis).reduce((sum, kpi) => {
            if (kpi.selected && kpi.weight) {
                return sum + (parseInt(kpi.weight, 10) || 0);
            }
            return sum;
        }, 0);
    }, [selectedKpis]);

    const committedWeightTotal = useMemo(() => {
        return committedKpis.reduce((sum, kpi) => sum + (parseInt(kpi.weight, 10) || 0), 0);
    }, [committedKpis]);

    const totalWeight = useMemo(() => {
        return cascadedWeight + committedWeightTotal;
    }, [cascadedWeight, committedWeightTotal]);

    if (!employee) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Assign KPI to {employee.name}</DialogTitle>
                </DialogHeader>
                <Tabs value={assignmentType} onValueChange={(value) => setAssignmentType(value as 'cascaded' | 'committed')} className="w-full pt-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="cascaded">Assign Cascaded KPI</TabsTrigger>
                        <TabsTrigger value="committed">Create Committed KPI</TabsTrigger>
                    </TabsList>
                    <TabsContent value="cascaded" className="mt-6 space-y-4">
                        <p>ควรออกแบบให้เป็นกระดาน หรือ grid table แล้ว tickbox เนื่องจากจะได้ตรวจสอบว่า total weight เกินกว่า 100% หรือไม่</p>
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]"></TableHead>
                                        <TableHead>Department KPI</TableHead>
                                        <TableHead className="w-[150px]">Individual Target</TableHead>
                                        <TableHead className="w-[100px]">Weight (%)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {relevantKpis.length > 0 ? (
                                        relevantKpis.map(kpi => (
                                            <TableRow key={kpi.id} className={cn(selectedKpis[kpi.id]?.selected && "bg-muted/50")}>
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={selectedKpis[kpi.id]?.selected || false}
                                                        onCheckedChange={(checked) => handleKpiSelectionChange(kpi.id, 'selected', !!checked)}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">{kpi.measure}</TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="text"
                                                        placeholder="Enter target"
                                                        value={selectedKpis[kpi.id]?.target || ''}
                                                        onChange={(e) => handleKpiSelectionChange(kpi.id, 'target', e.target.value)}
                                                        disabled={!selectedKpis[kpi.id]?.selected}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        placeholder="e.g., 10"
                                                        value={selectedKpis[kpi.id]?.weight || ''}
                                                        onChange={(e) => handleKpiSelectionChange(kpi.id, 'weight', e.target.value)}
                                                        disabled={!selectedKpis[kpi.id]?.selected}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-gray-500 h-24">
                                                No KPIs cascaded to {employee.department} yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                    <TabsContent value="committed" className="mt-6 space-y-4">
                        <div className="rounded-lg border bg-gray-50/50 p-4">
                            <p className="text-sm font-medium text-gray-600">
                                Cascaded KPIs Weight: <span className="font-bold text-primary">{cascadedWeight}%</span>
                            </p>
                            <p className="text-xs text-gray-500">This is the sum of weights from the 'Assign Cascaded KPI' tab.</p>
                        </div>
                        <ScrollArea className="h-[400px] pr-4">
                           <div className="space-y-4">
                                {committedKpis.map((kpi, index) => (
                                    <Card key={kpi.id} className="relative">
                                        <CardContent className="p-4 space-y-4">
                                            <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => handleRemoveCommittedKpi(kpi.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="md:col-span-2 space-y-2">
                                                    <Label htmlFor={`committed-task-${kpi.id}`}>Task / Project Name</Label>
                                                    <Input id={`committed-task-${kpi.id}`} value={kpi.task} onChange={e => handleCommittedKpiChange(index, 'task', e.target.value)} placeholder="e.g., Monthly Report Submission" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`committed-weight-${kpi.id}`}>Weight (%)</Label>
                                                    <Input id={`committed-weight-${kpi.id}`} type="number" value={kpi.weight} onChange={e => handleCommittedKpiChange(index, 'weight', e.target.value)} placeholder="e.g., 15" />
                                                </div>
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor={`committed-measure-${kpi.id}`}>KPI Measure</Label>
                                                <Input id={`committed-measure-${kpi.id}`} value={kpi.kpiMeasure} onChange={e => handleCommittedKpiChange(index, 'kpiMeasure', e.target.value)} placeholder="e.g., On-time Submission Rate" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>ให้ปรับเป็น ระดับผลงาน</Label>
                                                <div className="grid grid-cols-5 gap-2">
                                                    <Input placeholder="Level 1 (<85%)" value={kpi.targets.level1} onChange={e => handleCommittedTargetChange(index, 'level1', e.target.value)} />
                                                    <Input placeholder="Level 2 (85-95%)" value={kpi.targets.level2} onChange={e => handleCommittedTargetChange(index, 'level2', e.target.value)} />
                                                    <Input placeholder="Level 3 (95-105%)" value={kpi.targets.level3} onChange={e => handleCommittedTargetChange(index, 'level3', e.target.value)} />
                                                    <Input placeholder="Level 4 (105-115%)" value={kpi.targets.level4} onChange={e => handleCommittedTargetChange(index, 'level4', e.target.value)} />
                                                    <Input placeholder="Level 5 (>115%)" value={kpi.targets.level5} onChange={e => handleCommittedTargetChange(index, 'level5', e.target.value)} />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                           </div>
                        </ScrollArea>
                         <div className="flex justify-start">
                            <Button variant="outline" onClick={handleAddCommittedKpi}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add KPI Measure
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
                <DialogFooter className="sm:justify-between items-center pt-4 border-t mt-4">
                     <div className="text-right sm:text-left">
                        <p className={cn("text-lg font-bold", totalWeight > 100 && "text-destructive")}>
                            Total Weight: {totalWeight}%
                        </p>
                        {totalWeight > 100 && <p className="text-xs text-destructive">Total weight cannot exceed 100%</p>}
                    </div>
                    <div className="flex space-x-2">
                       <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                       <Button onClick={handleSubmit} disabled={totalWeight > 100 || totalWeight === 0}>Assign KPIs</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function CascadePage() {
  const { setPageTitle } = useAppLayout();
  const { orgData } = useKpiData();

  const [isCascadeModalOpen, setIsCascadeModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  
  const [selectedKpi, setSelectedKpi] = useState<CorporateKpi | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<WithId<Employee> | null>(null);

  const [cascadedKpis, setCascadedKpis] = useState<CascadedKpi[]>([]);
  const [individualKpis, setIndividualKpis] = useState<IndividualKpi[]>([]);

  useEffect(() => {
    setPageTitle('Cascade KPI');
  }, [setPageTitle]);

  const departments = orgData ? [...new Set(orgData.map(e => e.department))] : [];

  const handleCascadeClick = (kpi: CorporateKpi) => {
      setSelectedKpi(kpi);
      setIsCascadeModalOpen(true);
  };

  const handleAssignKpiClick = (employee: WithId<Employee>) => {
      setSelectedEmployee(employee);
      setIsAssignModalOpen(true);
  };

  const handleConfirmCascade = (cascadedKpi: CascadedKpi) => {
      setCascadedKpis(prev => {
        const existingIndex = prev.findIndex(k => k.id === cascadedKpi.id && k.department === cascadedKpi.department);
        if (existingIndex > -1) {
            const newKpis = [...prev];
            newKpis[existingIndex] = cascadedKpi;
            return newKpis;
        }
        return [...prev, cascadedKpi];
      });
  };

  const handleConfirmAssignment = (assignments: IndividualKpi[]) => {
      setIndividualKpis(prev => {
          const newKpis = [...prev];
          assignments.forEach(assignment => {
              const existingIndex = newKpis.findIndex(k => k.employeeId === assignment.employeeId && k.kpiId === assignment.kpiId);
              if (existingIndex > -1) {
                  newKpis[existingIndex] = assignment;
              } else {
                  newKpis.push(assignment);
              }
          });
          return newKpis;
      });
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
          <IndividualLevel cascadedKpis={cascadedKpis} individualKpis={individualKpis} onAssignKpi={handleAssignKpiClick} />
        </TabsContent>
      </Tabs>
      <CascadeDialog 
        isOpen={isCascadeModalOpen}
        onClose={() => setIsCascadeModalOpen(false)}
        kpi={selectedKpi}
        departments={departments}
        onConfirm={handleConfirmCascade}
      />
      <AssignKpiDialog
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        employee={selectedEmployee}
        departmentKpis={cascadedKpis}
        onConfirm={handleConfirmAssignment}
      />
    </div>
  );
}
