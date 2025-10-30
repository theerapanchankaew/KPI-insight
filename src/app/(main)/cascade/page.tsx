
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useKpiData } from '@/context/KpiDataContext';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Share2, Edit, Trash2, PlusCircle, Save, UserPlus } from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase, WithId, addDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

// ==================== TYPE DEFINITIONS ====================
import type { Employee, Kpi as CorporateKpi, CascadedKpi, MonthlyKpi } from '@/context/KpiDataContext';

// This was missing from the context, let's define it here for this page's purpose
interface IndividualKpiBase {
    employeeId: string;
    kpiId: string; // This would link to a cascadedKpi ID for cascaded, or be its own for committed
    kpiMeasure: string;
    weight: number;
    status: 'Draft' | 'Agreed' | 'In-Progress' | 'Manager Review' | 'Upper Manager Approval' | 'Employee Acknowledged' | 'Closed' | 'Rejected';
    notes?: string;
}

interface AssignedCascadedKpi extends IndividualKpiBase {
    type: 'cascaded';
    target?: string;
    corporateKpiId: string;
    unit?: string;
}

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

type IndividualKpi = (AssignedCascadedKpi | CommittedKpi) & { id: string };


// ==================== UTILITY FUNCTIONS ====================
const getStatusColor = (status: IndividualKpi['status']) => {
    const colors: Record<IndividualKpi['status'], string> = {
      'Draft': 'bg-gray-100 text-gray-800 border-gray-300',
      'Agreed': 'bg-blue-100 text-blue-800 border-blue-300',
      'In-Progress': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Manager Review': 'bg-purple-100 text-purple-800 border-purple-300',
      'Upper Manager Approval': 'bg-indigo-100 text-indigo-800 border-indigo-300',
      'Employee Acknowledged': 'bg-green-100 text-green-800 border-green-300',
      'Closed': 'bg-gray-100 text-gray-800 border-gray-300',
      'Rejected': 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status] || colors['Draft'];
};


// ==================== DIALOGS ====================
const AssignKpiDialog = ({
    isOpen,
    onClose,
    departmentKpi,
    teamMembers,
}: {
    isOpen: boolean;
    onClose: () => void;
    departmentKpi: WithId<CascadedKpi> | null;
    teamMembers: WithId<Employee>[];
}) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [employeeId, setEmployeeId] = useState('');
    const [weight, setWeight] = useState(0);
    const [target, setTarget] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setEmployeeId('');
            setWeight(0);
            setTarget('');
            setNotes('');
        }
    }, [isOpen]);

    const handleSaveAssignment = () => {
        if (!firestore || !departmentKpi || !employeeId) {
            toast({ title: "Missing Information", description: "Please select an employee.", variant: 'destructive'});
            return;
        }

        const individualKpi: Omit<IndividualKpi, 'id'> = {
            employeeId,
            kpiId: departmentKpi.id, // Link to the department KPI
            corporateKpiId: departmentKpi.corporateKpiId,
            kpiMeasure: departmentKpi.measure,
            weight: Number(weight),
            target: target,
            unit: departmentKpi.unit,
            status: 'Draft',
            type: 'cascaded',
            notes, // Manager's initial notes
        };
        
        addDocumentNonBlocking(collection(firestore, 'individual_kpis'), individualKpi);

        toast({ title: 'KPI Assigned', description: `KPI has been assigned to the employee for agreement.`});
        onClose();
    };

    if (!departmentKpi) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Assign KPI to Employee</DialogTitle>
                    <DialogDescription>
                        Assign '<span className="font-semibold">{departmentKpi.measure}</span>' to an employee in the {departmentKpi.department} department.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Employee</Label>
                        <Select value={employeeId} onValueChange={setEmployeeId}>
                            <SelectTrigger><SelectValue placeholder="Select an employee" /></SelectTrigger>
                            <SelectContent>
                                {teamMembers.map(emp => (
                                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label>Weight (%)</Label>
                            <Input type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} placeholder="e.g., 20" />
                        </div>
                        <div className="space-y-2">
                            <Label>Individual Target</Label>
                            <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g., ≥ 5M" />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>Initial Notes (Optional)</Label>
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add instructions or context for the employee" />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleSaveAssignment}>Save Assignment</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const DeployAndCascadeDialog = ({
    isOpen,
    onClose,
    corporateKpi,
    departments,
    existingCascades,
}: {
    isOpen: boolean;
    onClose: () => void;
    corporateKpi: WithId<CorporateKpi> | null;
    departments: string[];
    existingCascades: WithId<CascadedKpi>[];
}) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const [cascades, setCascades] = useState<Partial<CascadedKpi>[]>([]);

    useEffect(() => {
        if (corporateKpi) {
            const initialCascades = existingCascades.length > 0 ? existingCascades : [{ department: '', weight: 0, target: '' }];
            setCascades(initialCascades);
        }
    }, [corporateKpi, existingCascades]);

    if (!corporateKpi) return null;
    
    const totalWeight = cascades.reduce((sum, c) => sum + (c.weight || 0), 0);
    
    const handleCascadeChange = (index: number, field: keyof CascadedKpi, value: string | number) => {
        const newCascades = [...cascades];
        (newCascades[index] as any)[field] = value;
        setCascades(newCascades);
    };

    const addCascade = () => {
        setCascades([...cascades, { department: '', weight: 0, target: '' }]);
    };

    const removeCascade = (index: number) => {
        const cascadeToRemove = cascades[index];
        if (cascadeToRemove && (cascadeToRemove as WithId<CascadedKpi>).id && firestore) {
            deleteDocumentNonBlocking(doc(firestore, 'cascaded_kpis', (cascadeToRemove as WithId<CascadedKpi>).id));
            toast({ title: 'Cascade Removed', description: `Removed cascade for ${cascadeToRemove.department}.`, variant: 'destructive'});
        }
        setCascades(cascades.filter((_, i) => i !== index));
    };
    
    const handleSave = async () => {
        if (!firestore || !corporateKpi || !user) return;

        if (totalWeight > 100) {
            toast({ title: 'Invalid Weight', description: 'Total weight cannot exceed 100%.', variant: 'destructive' });
            return;
        }

        try {
            const batch = writeBatch(firestore);
            
            // Save/Update Cascaded KPIs
            cascades.forEach(c => {
                if (c.department && c.weight && c.target) {
                    const cascadeData: Omit<CascadedKpi, 'id'> = {
                        corporateKpiId: corporateKpi.id,
                        measure: corporateKpi.measure,
                        department: c.department!,
                        weight: Number(c.weight),
                        target: c.target!,
                        unit: corporateKpi.unit,
                        category: corporateKpi.category,
                    };

                    let docRef;
                    if ((c as WithId<CascadedKpi>).id) {
                        docRef = doc(firestore, 'cascaded_kpis', (c as WithId<CascadedKpi>).id);
                        batch.set(docRef, cascadeData, { merge: true });
                    } else {
                        docRef = doc(collection(firestore, 'cascaded_kpis'));
                        batch.set(docRef, cascadeData);
                    }
                }
            });

            // Deploy Monthly KPIs based on Corporate KPI
            const yearlyTargetValue = parseFloat(corporateKpi.target.replace(/[^0-9.]/g, ''));
            const currentYear = new Date().getFullYear();

            for (let i = 1; i <= 12; i++) {
                 const monthlyKpi: Omit<MonthlyKpi, 'id'> = {
                    parentKpiId: corporateKpi.id,
                    measure: corporateKpi.measure,
                    perspective: corporateKpi.perspective,
                    category: corporateKpi.category,
                    year: currentYear,
                    month: i,
                    target: yearlyTargetValue / 12, // Simple equal distribution for now
                    actual: 0, // Default actual to 0
                    progress: 0,
                    percentage: (1/12) * 100,
                    unit: corporateKpi.unit,
                    status: 'Active',
                    distributionStrategy: 'equal',
                    createdAt: serverTimestamp(),
                    createdBy: user.uid,
                 };
                 const monthlyDocRef = doc(collection(firestore, 'monthly_kpis'), `${corporateKpi.id}_${currentYear}_${i}`);
                 batch.set(monthlyDocRef, monthlyKpi, { merge: true });
            }

            await batch.commit();
            toast({ title: 'Success', description: 'KPI cascade and monthly breakdown have been saved.' });
            onClose();
        } catch (error) {
            console.error("Error saving cascades:", error);
            toast({ title: 'Error', description: 'Could not save KPI cascade.', variant: 'destructive' });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Deploy & Cascade KPI</DialogTitle>
                    <DialogDescription>
                        Cascade '<span className="font-semibold text-primary">{corporateKpi.measure}</span>' to departments. The total weight must not exceed 100%. This will also deploy monthly targets.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 max-h-[60vh] overflow-y-auto pr-2">
                    <div className="space-y-4">
                        {cascades.map((cascade, index) => (
                            <div key={index} className="grid grid-cols-12 gap-x-4 items-center p-3 border rounded-lg">
                                <div className="col-span-5">
                                    <Label>Department</Label>
                                    <Select 
                                        value={cascade.department} 
                                        onValueChange={(val) => handleCascadeChange(index, 'department', val)}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                                        <SelectContent>
                                            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-2">
                                    <Label>Weight (%)</Label>
                                    <Input 
                                        type="number" 
                                        value={cascade.weight}
                                        onChange={(e) => handleCascadeChange(index, 'weight', Number(e.target.value))}
                                    />
                                </div>
                                <div className="col-span-4">
                                    <Label>Target</Label>
                                    <Input 
                                        value={cascade.target}
                                        onChange={(e) => handleCascadeChange(index, 'target', e.target.value)}
                                        placeholder="e.g., ≥ 20M"
                                    />
                                </div>
                                <div className="col-span-1 self-end">
                                    <Button variant="ghost" size="icon" onClick={() => removeCascade(index)} disabled={cascades.length <= 1 && !(cascade as WithId<CascadedKpi>).id}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                     <Button variant="outline" size="sm" onClick={addCascade} className="mt-4">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Department
                    </Button>
                </div>
                <DialogFooter>
                    <div className="w-full flex justify-between items-center">
                        <div>
                            <p className="text-sm font-medium">Total Weight: <span className={cn(totalWeight > 100 ? "text-destructive" : "text-primary")}>{totalWeight}%</span> / 100%</p>
                        </div>
                        <div>
                           <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                           <Button onClick={handleSave} className="ml-2">
                                <Save className="mr-2 h-4 w-4" /> Save Cascade
                           </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


// ==================== ROW COMPONENTS FOR HIERARCHICAL TABLE ====================

const IndividualKpiRow = ({ kpi, employee }: { kpi: WithId<IndividualKpi>, employee?: WithId<Employee> }) => (
    <TableRow className="bg-gray-50/50 hover:bg-gray-100/50">
        <TableCell className="pl-24 py-2">
            <div className="font-medium text-gray-800">{employee?.name || kpi.employeeId}</div>
            <div className="text-xs text-gray-500">{kpi.kpiMeasure}</div>
        </TableCell>
        <TableCell className="py-2 text-center">
            <Badge className={cn('text-xs', getStatusColor(kpi.status))}>{kpi.status}</Badge>
        </TableCell>
        <TableCell className="py-2 text-right font-medium">{kpi.weight}%</TableCell>
        <TableCell className="py-2 text-right font-medium">
             {kpi.type === 'cascaded' ? kpi.target : '5-Level'}
        </TableCell>
        <TableCell className="py-2 text-right">-</TableCell>
        <TableCell className="py-2 text-right">-</TableCell>
    </TableRow>
);

const DepartmentKpiRow = ({ 
    kpi, 
    individualKpis, 
    employees, 
    monthlyKpis,
    onOpenAssign,
}: { 
    kpi: WithId<CascadedKpi>, 
    individualKpis: WithId<IndividualKpi>[], 
    employees: Map<string, WithId<Employee>>,
    monthlyKpis: WithId<MonthlyKpi>[],
    onOpenAssign: (kpi: WithId<CascadedKpi>) => void,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const relevantIndividualKpis = individualKpis.filter(indKpi => indKpi.kpiId === kpi.id);

    const { ytdActual, ytdTarget } = useMemo(() => {
        const relevantMonthly = monthlyKpis.filter(m => m.parentKpiId === kpi.corporateKpiId);
        const departmentWeight = (kpi.weight || 100) / 100;
        
        let ytdTarget = 0;
        let ytdActual = 0;
        
        relevantMonthly.forEach(m => {
            ytdTarget += m.target * departmentWeight;
            ytdActual += m.actual * departmentWeight;
        });
        
        return { ytdActual, ytdTarget };
    }, [monthlyKpis, kpi.corporateKpiId, kpi.weight]);

    const achievement = ytdTarget > 0 ? (ytdActual / ytdTarget) * 100 : 0;

    return (
        <>
            <TableRow className="bg-blue-50 hover:bg-blue-100/60 group">
                <TableCell className="pl-12 py-3">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span className="font-semibold text-blue-900">{kpi.department}</span>
                        </div>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onOpenAssign(kpi)}>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Assign
                        </Button>
                    </div>
                </TableCell>
                <TableCell className="py-3 text-center">-</TableCell>
                <TableCell className="py-3 text-right font-semibold">{kpi.weight}%</TableCell>
                <TableCell className="py-3 text-right font-semibold">{kpi.target} {kpi.unit}</TableCell>
                <TableCell className="py-3 text-right font-semibold">{ytdActual.toLocaleString(undefined, {maximumFractionDigits: 0})}</TableCell>
                <TableCell className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                         <span className="font-semibold">{achievement.toFixed(1)}%</span>
                         <Progress value={achievement} className="w-20 h-1.5" />
                    </div>
                </TableCell>
            </TableRow>
            {isOpen && (
                <>
                    {relevantIndividualKpis.length > 0 ? (
                       relevantIndividualKpis.map(indKpi => (
                           <IndividualKpiRow key={indKpi.id} kpi={indKpi} employee={employees.get(indKpi.employeeId)} />
                       ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-sm text-gray-500 py-4 pl-24">
                                No individual KPIs assigned under this department KPI. 
                                <Button variant="link" size="sm" className="p-0 h-auto ml-1" onClick={() => onOpenAssign(kpi)}>Assign one now.</Button>
                            </TableCell>
                        </TableRow>
                    )}
                </>
            )}
        </>
    );
};

const CorporateKpiRow = ({ 
    kpi, 
    cascadedKpis, 
    individualKpis, 
    employees, 
    monthlyKpis,
    onOpenCascade,
    onOpenAssign,
}: { 
    kpi: WithId<CorporateKpi>, 
    cascadedKpis: WithId<CascadedKpi>[], 
    individualKpis: WithId<IndividualKpi>[], 
    employees: Map<string, WithId<Employee>>,
    monthlyKpis: WithId<MonthlyKpi>[],
    onOpenCascade: (kpi: WithId<CorporateKpi>) => void,
    onOpenAssign: (kpi: WithId<CascadedKpi>) => void,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const relevantCascadedKpis = cascadedKpis.filter(cascaded => cascaded.corporateKpiId === kpi.id);
    
    const { ytdActual, ytdTarget } = useMemo(() => {
        const relevantMonthly = monthlyKpis.filter(m => m.parentKpiId === kpi.id);
        const ytdTarget = relevantMonthly.reduce((sum, m) => sum + m.target, 0);
        const ytdActual = relevantMonthly.reduce((sum, m) => sum + m.actual, 0);
        return { ytdActual, ytdTarget };
    }, [monthlyKpis, kpi.id]);

    const achievement = ytdTarget > 0 ? (ytdActual / ytdTarget) * 100 : 0;

    return (
        <>
            <TableRow className="border-b-2 border-gray-300 hover:bg-gray-50 group">
                <TableCell className="font-bold text-gray-900 py-4">
                     <div className="flex items-center justify-between">
                        <span onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 cursor-pointer flex-grow">
                            {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                            {kpi.measure}
                        </span>
                        <div className="flex items-center gap-1">
                           <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenCascade(kpi)}>
                                <Share2 className="h-4 w-4 text-blue-600" />
                           </Button>
                           <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                               <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <Edit className="h-4 w-4 text-gray-600" />
                               </Button>
                               <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                               </Button>
                           </div>
                        </div>
                    </div>
                </TableCell>
                <TableCell className="font-bold text-gray-900 py-4 text-center">
                    <Badge variant="outline">{kpi.perspective}</Badge>
                </TableCell>
                <TableCell className="font-bold text-gray-900 py-4 text-right">100%</TableCell>
                <TableCell className="font-bold text-gray-900 py-4 text-right">{kpi.target} {kpi.unit}</TableCell>
                <TableCell className="font-bold text-primary py-4 text-right">{ytdActual.toLocaleString(undefined, {maximumFractionDigits: 0})}</TableCell>
                <TableCell className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                        <span className="font-bold text-primary">{achievement.toFixed(1)}%</span>
                        <Progress value={achievement} className="w-24 h-2" />
                    </div>
                </TableCell>
            </TableRow>
            {isOpen && (
                <>
                    {relevantCascadedKpis.length > 0 ? (
                       relevantCascadedKpis.map(cascadedKpi => (
                           <DepartmentKpiRow 
                                key={cascadedKpi.id} 
                                kpi={cascadedKpi} 
                                individualKpis={individualKpis} 
                                employees={employees}
                                monthlyKpis={monthlyKpis}
                                onOpenAssign={onOpenAssign}
                            />
                       ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-sm text-gray-500 py-4 pl-12">
                                This KPI has not been cascaded to any departments yet. Click the <Share2 className="inline h-4 w-4 mx-1" /> icon to start.
                            </TableCell>
                        </TableRow>
                    )}
                </>
            )}
        </>
    );
};

// ==================== MAIN COMPONENT ====================

export default function KPICascadeManagement() {
  const { setPageTitle } = useAppLayout();
  
  useEffect(() => {
    setPageTitle("Consolidated KPI View");
  }, [setPageTitle]);

  const firestore = useFirestore();
  const { user } = useUser();

  const [isCascadeDialogOpen, setCascadeDialogOpen] = useState(false);
  const [selectedCorporateKpi, setSelectedCorporateKpi] = useState<WithId<CorporateKpi> | null>(null);

  const [isAssignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedDepartmentKpi, setSelectedDepartmentKpi] = useState<WithId<CascadedKpi> | null>(null);

  // Unified data fetching
  const { 
    kpiData, isKpiDataLoading,
    cascadedKpis, isCascadedKpisLoading,
    orgData: employeesData, isOrgDataLoading,
    monthlyKpisData, isMonthlyKpisLoading,
   } = useKpiData();

  const individualKpisQuery = useMemoFirebase(
    () => (firestore && user ? collection(firestore, 'individual_kpis') : null),
    [firestore, user]
  );
  const { data: individualKpis, isLoading: isIndividualKpisLoading } = useCollection<WithId<IndividualKpi>>(individualKpisQuery);
  
  const employeesMap = useMemo(() => {
    const map = new Map<string, WithId<Employee>>();
    if (employeesData) {
        employeesData.forEach(e => map.set(e.id, e));
    }
    return map;
  }, [employeesData]);
  
  const departmentsList = useMemo(() => {
    if(!employeesData) return [];
    return [...new Set(employeesData.map(e => e.department))].filter(Boolean);
  }, [employeesData]);

  const existingCascadesForSelectedKpi = useMemo(() => {
      if (!selectedCorporateKpi || !cascadedKpis) return [];
      return cascadedKpis.filter(c => c.corporateKpiId === selectedCorporateKpi.id);
  }, [selectedCorporateKpi, cascadedKpis]);

  const teamMembersForSelectedDept = useMemo(() => {
      if (!selectedDepartmentKpi || !employeesData) return [];
      return employeesData.filter(emp => emp.department === selectedDepartmentKpi.department);
  }, [selectedDepartmentKpi, employeesData]);


  const isLoading = isKpiDataLoading || isCascadedKpisLoading || isOrgDataLoading || isIndividualKpisLoading || isMonthlyKpisLoading;
  
  const handleOpenCascadeDialog = (kpi: WithId<CorporateKpi>) => {
      setSelectedCorporateKpi(kpi);
      setCascadeDialogOpen(true);
  };
  
  const handleOpenAssignDialog = (kpi: WithId<CascadedKpi>) => {
      setSelectedDepartmentKpi(kpi);
      setAssignDialogOpen(true);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
              <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      );
    }
    
    if (!kpiData || kpiData.length === 0) {
        return (
             <TableBody>
                <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-gray-500">
                        No corporate KPIs found. Please import data on the "Intake Data" page.
                    </TableCell>
                </TableRow>
            </TableBody>
        )
    }

    return (
      <TableBody>
        {kpiData.map(corpKpi => (
          <CorporateKpiRow 
            key={corpKpi.id} 
            kpi={corpKpi}
            cascadedKpis={cascadedKpis || []}
            individualKpis={individualKpis || []}
            employees={employeesMap}
            monthlyKpis={monthlyKpisData || []}
            onOpenCascade={handleOpenCascadeDialog}
            onOpenAssign={handleOpenAssignDialog}
          />
        ))}
      </TableBody>
    );
  };

  return (
    <>
    <div className="fade-in space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Consolidated KPI Lifecycle</CardTitle>
          <CardDescription>
            A hierarchical view of all KPIs, from corporate objectives down to individual assignments. Click on a row to expand it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100/50">
                  <TableHead className="w-2/5">KPI / Department / Employee</TableHead>
                  <TableHead className="w-1/6 text-center">Status / Perspective</TableHead>
                  <TableHead className="w-1/12 text-right">Weight</TableHead>
                  <TableHead className="w-1/6 text-right">Target</TableHead>
                  <TableHead className="w-1/6 text-right">Actual (YTD)</TableHead>
                  <TableHead className="w-1/6 text-right">Achievement (YTD)</TableHead>
                </TableRow>
              </TableHeader>
              {renderContent()}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
    
    <DeployAndCascadeDialog 
        isOpen={isCascadeDialogOpen}
        onClose={() => setCascadeDialogOpen(false)}
        corporateKpi={selectedCorporateKpi}
        departments={departmentsList}
        existingCascades={existingCascadesForSelectedKpi}
    />
    
    <AssignKpiDialog
        isOpen={isAssignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        departmentKpi={selectedDepartmentKpi}
        teamMembers={teamMembersForSelectedDept}
    />
    </>
  );
}
