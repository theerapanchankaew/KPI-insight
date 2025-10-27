
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useKpiData, type Employee, type Kpi } from '@/context/KpiDataContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronsUpDown, PlusCircle, Trash2, Edit, AlertTriangle, MoreVertical, Calendar, TrendingUp, BarChart3, Building, Share2 } from 'lucide-react';
import { WithId, useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, doc } from 'firebase/firestore';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

// ==================== TYPE DEFINITIONS ====================

// Add CascadedKpi to the existing types if not already present
export interface CascadedKpi {
  id?: string;
  corporateKpiId: string;
  measure: string;
  department: string;
  weight: number;
  target: string;
  category?: string;
  unit?: string;
}

type Role = 'Admin' | 'VP' | 'AVP' | 'Manager' | 'Employee' | null;
type CorporateKpi = WithId<Kpi>;

// Monthly Distribution Types
interface MonthlyDistribution {
  month: number;
  monthName: string;
  percentage: number;
  target: number;
  weight?: number;
}

type DistributionStrategy = 'auto' | 'equal' | 'weighted' | 'seasonal' | 'progressive' | 'historical';
type SeasonalPattern = 'tourism' | 'retail' | 'agriculture' | 'custom';
type ProgressiveCurve = 'linear' | 'exponential';

interface MonthlyKpi {
  id?: string;
  parentKpiId: string;
  measure: string;
  perspective: string;
  category: string;
  year: number;
  month: number;
  target: number;
  actual: number;
  progress: number;
  percentage: number;
  unit: string;
  status: 'Active' | 'Completed' | 'Overdue';
  distributionStrategy: string;
  createdAt: any;
  updatedAt?: any;
  createdBy: string;
}

// Individual KPI Types
interface IndividualKpiBase {
  employeeId: string;
  kpiId: string;
  kpiMeasure: string;
  weight: number;
  status: 'Draft' | 'Agreed' | 'In-Progress' | 'Manager Review' | 'Upper Manager Approval' | 'Employee Acknowledged' | 'Closed' | 'Rejected';
  notes?: string;
}

interface AssignedCascadedKpi extends IndividualKpiBase {
  type: 'cascaded';
  target: string;
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

type IndividualKpi = AssignedCascadedKpi | CommittedKpi;


// Types for the Assign Dialog
interface SelectedCascadedKpi {
  kpiId: string;
  weight: number;
}

interface CommittedKpiInput {
  task: string;
  weight: number;
  targets: { level1: string; level2: string; level3: string; level4: string; level5: string; };
}


// ==================== CONSTANTS & UTILITIES ====================

const MONTH_NAMES_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

const DISTRIBUTION_STRATEGIES = {
  equal: (yearlyTarget: number): MonthlyDistribution[] => {
    const monthly = yearlyTarget / 12;
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: MONTH_NAMES_TH[i],
      percentage: 100 / 12,
      target: Number(monthly.toFixed(2)),
    }));
  },

  weighted: (yearlyTarget: number, weights: number[]): MonthlyDistribution[] => {
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    return weights.map((w, i) => ({
      month: i + 1,
      monthName: MONTH_NAMES_TH[i],
      percentage: Number(((w / total) * 100).toFixed(2)),
      target: Number(((yearlyTarget * w) / total).toFixed(2)),
      weight: w,
    }));
  },

  seasonal: (yearlyTarget: number, pattern: SeasonalPattern = 'retail'): MonthlyDistribution[] => {
    const patterns: Record<SeasonalPattern, number[]> = {
      tourism: [6,5,4,4,5,6,8,10,12,14,12,14],
      retail: [8,8,8,9,9,9,10,10,11,12,14,16],
      agriculture: [4,4,6,8,10,12,14,12,10,8,6,6],
      custom: Array(12).fill(1),
    };
    return DISTRIBUTION_STRATEGIES.weighted(yearlyTarget, patterns[pattern] ?? patterns.retail);
  },

  progressive: (yearlyTarget: number, curve: ProgressiveCurve = 'linear'): MonthlyDistribution[] => {
    const weights = curve === 'linear'
      ? Array.from({ length: 12 }, (_, i) => i + 1)
      : Array.from({ length: 12 }, (_, i) => Math.pow(1.2, i));
    return DISTRIBUTION_STRATEGIES.weighted(yearlyTarget, weights);
  },

  historical: (yearlyTarget: number, historicalData: number[][]): MonthlyDistribution[] => {
    if (!historicalData?.length) return DISTRIBUTION_STRATEGIES.equal(yearlyTarget);
    const sums = Array(12).fill(0);
    historicalData.forEach(y => y.forEach((v, m) => { if (m < 12) sums[m] += v; }));
    const avg = sums.map(s => s / historicalData.length);
    const total = avg.reduce((a, b) => a + b, 0) || 1;
    return avg.map((v, i) => ({
      month: i + 1,
      monthName: MONTH_NAMES_TH[i],
      percentage: Number(((v / total) * 100).toFixed(2)),
      target: Number(((yearlyTarget * v) / total).toFixed(2)),
    }));
  },
};

const calculateVariance = (data: number[][]) => {
  const flat = data.flat();
  if (!flat.length) return 0;
  const mean = flat.reduce((a, b) => a + b, 0) / flat.length;
  const varSum = flat.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / flat.length;
  return Math.sqrt(varSum) / (mean || 1);
};

const detectBestStrategy = (kpi: CorporateKpi | null, historicalData?: number[][]): DistributionStrategy => {
  if (!kpi) return 'equal';
  if (historicalData?.length >= 2) {
    const cv = calculateVariance(historicalData);
    if (cv > 0.15) return 'historical';
  }
  const measure = kpi.measure.toLowerCase();
  const seasonalKeywords = ['sale','sales','revenue','customer','order','visitor','ขาย','รายได้','ลูกค้า'];
  if (seasonalKeywords.some(x => measure.includes(x))) return 'seasonal';
  const growthKeywords = ['growth','increase','expand','new','เติบโต','เพิ่ม','ขยาย'];
  if (growthKeywords.some(x => measure.includes(x))) return 'progressive';
  return 'equal';
};

// ==================== DELETE CONFIRMATION DIALOG ====================

const DeleteConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType = 'KPI'
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
  itemType?: string;
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ยืนยันการลบ {itemType}</AlertDialogTitle>
          <AlertDialogDescription>
            คุณแน่ใจหรือไม่ที่จะลบ "{itemName}"? การดำเนินการนี้ไม่สามารถย้อนกลับได้
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className={buttonVariants({ variant: "destructive" })}>
            ลบ
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};


// ==================== DEPLOY AND CASCADE DIALOG (NEW) ====================

interface DepartmentCascadeInput {
  department: string;
  weight: number;
  target: string;
}

const DeployAndCascadeDialog = ({
  kpi, isOpen, onClose, onConfirm, user, departments
}: {
  kpi: CorporateKpi | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (monthlyDist: MonthlyDistribution[], cascadeInputs: DepartmentCascadeInput[], strategy: DistributionStrategy, year: number) => void;
  user: any;
  departments: string[];
}) => {
  // Monthly Distribution State
  const [strategy, setStrategy] = useState<DistributionStrategy>('auto');
  const [seasonalPattern, setSeasonalPattern] = useState<SeasonalPattern>('retail');
  const [progressiveCurve, setProgressiveCurve] = useState<ProgressiveCurve>('linear');
  const [previewData, setPreviewData] = useState<MonthlyDistribution[]>([]);
  const [customWeights, setCustomWeights] = useState<number[]>(Array(12).fill(1));
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Department Cascade State
  const [cascadedDepts, setCascadedDepts] = useState<DepartmentCascadeInput[]>([]);

  const generatePreview = useMemo(() => () => {
    if (!kpi || !kpi.target) return;
    const yearlyTarget = parseFloat(String(kpi.target).replace(/[^0-9.]/g, '')) || 0;
    
    let actualStrategy = strategy === 'auto' ? detectBestStrategy(kpi) : strategy;
    let preview: MonthlyDistribution[];

    switch (actualStrategy) {
      case 'equal': preview = DISTRIBUTION_STRATEGIES.equal(yearlyTarget); break;
      case 'weighted': preview = DISTRIBUTION_STRATEGIES.weighted(yearlyTarget, customWeights); break;
      case 'seasonal': preview = DISTRIBUTION_STRATEGIES.seasonal(yearlyTarget, seasonalPattern); break;
      case 'progressive': preview = DISTRIBUTION_STRATEGIES.progressive(yearlyTarget, progressiveCurve); break;
      case 'historical': preview = DISTRIBUTION_STRATEGIES.equal(yearlyTarget); break; // Placeholder
      default: preview = DISTRIBUTION_STRATEGIES.equal(yearlyTarget);
    }
    setPreviewData(preview);
  }, [strategy, seasonalPattern, progressiveCurve, customWeights, kpi]);

  useEffect(() => {
    if (kpi && isOpen) {
      generatePreview();
    } else {
      // Reset state on close
      setCascadedDepts([]);
      setStrategy('auto');
      setSelectedYear(new Date().getFullYear());
    }
  }, [kpi, isOpen, generatePreview]);

  const handleAddDept = () => {
    setCascadedDepts([...cascadedDepts, { department: '', weight: 0, target: '' }]);
  };

  const handleRemoveDept = (index: number) => {
    setCascadedDepts(cascadedDepts.filter((_, i) => i !== index));
  };
  
  const handleDeptChange = (index: number, field: keyof DepartmentCascadeInput, value: string | number) => {
    const newDepts = [...cascadedDepts];
    const dept = newDepts[index];
    if (field === 'weight') {
      dept.weight = Number(value)
    } else {
      dept[field] = value as string;
    }
    setCascadedDepts(newDepts);
  };

  const getStrategyDisplayName = (strat: DistributionStrategy): string => {
    const names: Record<DistributionStrategy, string> = {
      'auto': '🤖 อัตโนมัติ (AI แนะนำ)', 'equal': '⚖️ เท่ากันทุกเดือน', 'weighted': '⚡ กำหนดน้ำหนักเอง',
      'seasonal': '📊 ตามฤดูกาล', 'progressive': '📈 เพิ่มขึ้นแบบก้าวหน้า', 'historical': '📜 ตามข้อมูลในอดีต'
    };
    return names[strat];
  };

  const handleDeploy = () => {
    if (!user || !kpi) return;
    const validCascades = cascadedDepts.filter(d => d.department && d.target);
    let actualStrategy = strategy === 'auto' ? detectBestStrategy(kpi) : strategy;
    onConfirm(previewData, validCascades, actualStrategy, selectedYear);
    onClose();
  };
  
  const yearlyTargetDisplay = (typeof kpi?.target === 'string' ? kpi.target : (kpi?.target || 0));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Deploy & Cascade KPI
          </DialogTitle>
           <DialogDescription>
            <span className="block font-semibold text-gray-700">{kpi?.measure}</span>
            <span className="block text-sm">
              เป้าหมายรายปี: <span className="font-bold text-blue-600">{yearlyTargetDisplay}</span> {kpi?.unit}
            </span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(80vh-10rem)] pr-6">
          <div className="space-y-8">
            {/* --- MONTHLY DEPLOY SECTION --- */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h4 className="font-semibold flex items-center gap-2"><Calendar className="h-5 w-5" />ขั้นตอนที่ 1: Deploy รายเดือน</h4>
              <div className="grid grid-cols-2 gap-4">
                  <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i).map(year => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={strategy} onValueChange={(val) => setStrategy(val as DistributionStrategy)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['auto', 'equal', 'weighted', 'seasonal', 'progressive', 'historical'] as DistributionStrategy[]).map(strat => (
                        <SelectItem key={strat} value={strat}>{getStrategyDisplayName(strat)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
              </div>
              <Collapsible>
                  <CollapsibleTrigger asChild>
                      <Button variant="link" className="p-0 h-auto text-sm">ดูตัวอย่างการกระจายรายเดือน <ChevronsUpDown className="ml-1 h-4 w-4" /></Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-2">
                      {previewData.map((month) => (
                        <div key={month.month} className="flex items-center gap-4 p-2 hover:bg-gray-50 rounded text-sm">
                          <span className="w-12 font-medium text-gray-700">{month.monthName}</span>
                          <div className="flex-1"><Progress value={month.percentage} className="h-2" /></div>
                          <span className="w-28 text-right font-semibold text-gray-800">{month.target.toFixed(2)}</span>
                          <span className="w-16 text-right text-gray-500 bg-gray-100 px-2 py-1 rounded">{month.percentage.toFixed(1)}%</span>
                        </div>
                      ))}
                  </CollapsibleContent>
              </Collapsible>
            </div>

            {/* --- DEPARTMENT CASCADE SECTION --- */}
            <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex justify-between items-center">
                    <h4 className="font-semibold flex items-center gap-2"><Building className="h-5 w-5" />ขั้นตอนที่ 2: Cascade ไปยังฝ่าย</h4>
                    <Button size="sm" variant="outline" onClick={handleAddDept}><PlusCircle className="mr-2 h-4 w-4" />เพิ่มฝ่าย</Button>
                </div>
                
                <div className="space-y-3">
                  {cascadedDepts.map((dept, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 rounded-md">
                      <div className="col-span-5">
                          <Select value={dept.department} onValueChange={(val) => handleDeptChange(index, 'department', val)}>
                              <SelectTrigger><SelectValue placeholder="เลือกฝ่าย..." /></SelectTrigger>
                              <SelectContent>
                                  {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="col-span-3">
                          <Input type="number" placeholder="Weight (%)" value={dept.weight || ''} onChange={(e) => handleDeptChange(index, 'weight', e.target.value)} />
                      </div>
                      <div className="col-span-3">
                          <Input placeholder={`Target (${kpi?.unit})`} value={dept.target} onChange={(e) => handleDeptChange(index, 'target', e.target.value)} />
                      </div>
                      <div className="col-span-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleRemoveDept(index)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                      </div>
                    </div>
                  ))}
                  {cascadedDepts.length === 0 && <p className="text-sm text-center text-gray-500 py-4">ยังไม่มีการ Cascade ไปยังฝ่าย</p>}
                </div>
                 <p className="text-xs text-gray-500">
                    * Total weight should ideally be 100%. You can assign KPIs to multiple departments here.
                 </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex gap-2 !mt-6">
          <DialogClose asChild><Button variant="outline" onClick={onClose}>ยกเลิก</Button></DialogClose>
          <Button onClick={handleDeploy} disabled={!user}>
            <Share2 className="mr-2 h-4 w-4" />
            Deploy & Cascade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


// ==================== CORPORATE LEVEL COMPONENT ====================

const CorporateLevel = ({ 
  onDeployAndCascadeClick,
  onEditClick, 
  onDeleteClick,
  userRole 
}: { 
  onDeployAndCascadeClick: (kpi: CorporateKpi) => void;
  onEditClick: (kpi: CorporateKpi) => void;
  onDeleteClick: (kpi: CorporateKpi) => void;
  userRole: Role;
}) => {
  const { kpiData, isKpiDataLoading } = useKpiData();
  const [deleteKpi, setDeleteKpi] = useState<CorporateKpi | null>(null);

  const canEdit = ['Admin', 'VP', 'AVP', 'Manager'].includes(userRole || '');
  const canDelete = userRole === 'Admin';
  const canCascade = ['Admin', 'VP', 'AVP', 'Manager'].includes(userRole || '');
  
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
    );
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
    <>
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
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-medium text-gray-800 pr-4">{kpi.measure}</span>
                      <Badge variant="outline">{kpi.category}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-gray-800">
                        {kpi.target} {kpi.unit && `(${kpi.unit})`}
                      </span>
                    </div>
                    <Progress value={75} className="h-2 mt-2" />
                    
                    <div className="flex justify-end mt-4 space-x-2">
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => onDeployAndCascadeClick(kpi)}
                        disabled={!canCascade}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Share2 className="mr-2 h-4 w-4" />
                        Deploy & Cascade
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEdit && (
                            <DropdownMenuItem onSelect={() => onEditClick(kpi)}>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem 
                              onSelect={() => setDeleteKpi(kpi)} 
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={deleteKpi !== null}
        onClose={() => setDeleteKpi(null)}
        onConfirm={() => {
          if (deleteKpi) {
            onDeleteClick(deleteKpi);
            setDeleteKpi(null);
          }
        }}
        itemName={deleteKpi?.measure || ''}
        itemType="Corporate KPI"
      />
    </>
  );
};

// ==================== DEPARTMENT LEVEL COMPONENT ====================

const DepartmentLevel = ({ 
  cascadedKpis,
  isLoading,
  onDeleteCascadedKpi, 
  userRole 
}: { 
  cascadedKpis: WithId<CascadedKpi>[] | null;
  isLoading: boolean;
  onDeleteCascadedKpi: (kpiId: string) => void;
  userRole: Role;
}) => {
  const [deleteKpi, setDeleteKpi] = useState<WithId<CascadedKpi> | null>(null);
  const canDelete = ['Admin', 'VP', 'AVP', 'Manager'].includes(userRole || '');

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (!cascadedKpis || cascadedKpis.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Department KPIs</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-gray-500">
          <p>No cascaded KPIs available.</p>
          <p className="mt-2">Start by cascading corporate KPIs to departments.</p>
        </CardContent>
      </Card>
    );
  }

  // Group by department
  const groupedByDept = cascadedKpis.reduce((acc, kpi) => {
    const dept = kpi.department || 'Unassigned';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(kpi);
    return acc;
  }, {} as { [key: string]: WithId<CascadedKpi>[] });

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(groupedByDept).map(([department, kpis]) => (
          <Card key={department}>
            <CardHeader>
              <CardTitle>{department}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {kpis.map(kpi => (
                <Card key={kpi.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-medium text-sm">{kpi.measure}</span>
                      {kpi.category && <Badge variant="outline" className="text-xs">{kpi.category}</Badge>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold">{kpi.target} {kpi.unit}</span>
                      {canDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteKpi(kpi)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <DeleteConfirmDialog
        isOpen={deleteKpi !== null}
        onClose={() => setDeleteKpi(null)}
        onConfirm={() => {
          if (deleteKpi) {
            onDeleteCascadedKpi(deleteKpi.id);
            setDeleteKpi(null);
          }
        }}
        itemName={deleteKpi?.measure || ''}
        itemType="Department KPI"
      />
    </>
  );
};

// ==================== INDIVIDUAL LEVEL COMPONENT ====================

const IndividualLevel = ({
  employees,
  individualKpis,
  isLoading,
  onAssignKpi,
  onDeleteIndividualKpi,
  userRole,
}: {
  employees: WithId<Employee>[] | null;
  individualKpis: WithId<IndividualKpi>[] | null;
  isLoading: boolean;
  onAssignKpi: (employee: Employee) => void;
  onDeleteIndividualKpi: (kpiId: string) => void;
  userRole: Role;
}) => {
  const [deleteKpi, setDeleteKpi] = useState<WithId<IndividualKpi> | null>(null);

  const canAssign = ['Admin', 'VP', 'AVP', 'Manager'].includes(userRole || '');
  const canDelete = ['Admin', 'Manager'].includes(userRole || '');

  const employeeKpiMap = useMemo(() => {
    return (individualKpis || []).reduce((acc, kpi) => {
      if (!acc[kpi.employeeId]) acc[kpi.employeeId] = [];
      acc[kpi.employeeId].push(kpi);
      return acc;
    }, {} as { [key: string]: WithId<IndividualKpi>[] });
  }, [individualKpis]);
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!employees || employees.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Individual KPIs</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-gray-500">
          <p>No employee data available. Please import organization data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {employees.map(employee => {
          const empKpis = employeeKpiMap[employee.id] || [];
          return (
            <Card key={employee.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{employee.name}</CardTitle>
                    <p className="text-sm text-gray-500">{employee.position} - {employee.department}</p>
                  </div>
                  {canAssign && (
                    <Button size="sm" onClick={() => onAssignKpi(employee)}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Assign KPI
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {empKpis.length === 0 ? (
                  <p className="text-sm text-gray-500">No KPIs assigned</p>
                ) : (
                  <div className="space-y-2">
                    {empKpis.map(kpi => (
                      <div key={kpi.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50/50">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{kpi.kpiMeasure}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">{kpi.status}</Badge>
                            <span className="text-xs text-gray-500">Weight: {kpi.weight}%</span>
                          </div>
                        </div>
                        {canDelete && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteKpi(kpi)}
                            className="text-red-600 hover:text-red-700 h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DeleteConfirmDialog
        isOpen={deleteKpi !== null}
        onClose={() => setDeleteKpi(null)}
        onConfirm={() => {
          if (deleteKpi) {
            onDeleteIndividualKpi(deleteKpi.id);
            setDeleteKpi(null);
          }
        }}
        itemName={deleteKpi?.kpiMeasure || ''}
        itemType="Individual KPI"
      />
    </>
  );
};


// ==================== PLACEHOLDER DIALOGS ====================

const EditKpiDialog = (props: any) => <div />;


const AssignKpiDialog = ({ 
    isOpen, 
    onClose, 
    employee, 
    departmentKpis, 
    onConfirm,
    user 
} : {
    isOpen: boolean;
    onClose: () => void;
    employee: WithId<Employee> | null;
    departmentKpis: WithId<CascadedKpi>[];
    onConfirm: (assignments: any[]) => void;
    user: any;
}) => {
    const [selectedCascaded, setSelectedCascaded] = useState<SelectedCascadedKpi[]>([]);
    const [committedKpis, setCommittedKpis] = useState<CommittedKpiInput[]>([]);

    const employeeDeptKpis = useMemo(() => {
        return departmentKpis.filter(kpi => kpi.department === employee?.department);
    }, [departmentKpis, employee]);

    useEffect(() => {
      if (!isOpen) {
        setSelectedCascaded([]);
        setCommittedKpis([]);
      }
    }, [isOpen]);

    const handleCascadedSelect = (kpiId: string, checked: boolean) => {
        if (checked) {
            setSelectedCascaded([...selectedCascaded, { kpiId, weight: 0 }]);
        } else {
            setSelectedCascaded(selectedCascaded.filter(k => k.kpiId !== kpiId));
        }
    };
    
    const handleCascadedWeightChange = (kpiId: string, weight: string) => {
        setSelectedCascaded(selectedCascaded.map(k => k.kpiId === kpiId ? { ...k, weight: parseInt(weight) || 0 } : k));
    };
    
    const handleAddCommitted = () => {
        setCommittedKpis([...committedKpis, { task: '', weight: 0, targets: { level1: '', level2: '', level3: '', level4: '', level5: ''} }]);
    };
    
    const handleRemoveCommitted = (index: number) => {
        setCommittedKpis(committedKpis.filter((_, i) => i !== index));
    };

    const handleCommittedChange = (index: number, field: keyof CommittedKpiInput, value: any) => {
        const newCommitted = [...committedKpis];
        (newCommitted[index] as any)[field] = value;
        setCommittedKpis(newCommitted);
    };

    const handleCommittedTargetChange = (index: number, level: string, value: string) => {
        const newCommitted = [...committedKpis];
        (newCommitted[index].targets as any)[level] = value;
        setCommittedKpis(newCommitted);
    }
    
    const handleConfirmClick = () => {
        if (!employee) return;
        
        const cascadedAssignments = selectedCascaded.map(selected => {
            const kpi = employeeDeptKpis.find(dk => dk.id === selected.kpiId);
            return {
                type: 'cascaded',
                employeeId: employee.id,
                kpiId: selected.kpiId,
                kpiMeasure: kpi?.measure || 'Unknown KPI',
                target: kpi?.target || 'N/A',
                weight: selected.weight
            };
        });

        const committedAssignments = committedKpis.map(committed => ({
            type: 'committed',
            employeeId: employee.id,
            kpiId: `committed-${Date.now()}`, // temp ID
            kpiMeasure: committed.task,
            task: committed.task,
            weight: committed.weight,
            targets: committed.targets,
        }));
        
        onConfirm([...cascadedAssignments, ...committedAssignments]);
        onClose();
    };
    
    const totalWeight = useMemo(() => {
        const cascadedWeight = selectedCascaded.reduce((sum, kpi) => sum + kpi.weight, 0);
        const committedWeight = committedKpis.reduce((sum, kpi) => sum + kpi.weight, 0);
        return cascadedWeight + committedWeight;
    }, [selectedCascaded, committedKpis]);

    if (!employee) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Assign KPIs for: {employee.name}</DialogTitle>
                    <DialogDescription>
                        Assign KPIs from the department or create new individual commitments. The total weight should be 100%.
                    </DialogDescription>
                </DialogHeader>

                 <div className="flex justify-end items-center gap-2 border-t border-b py-2 px-4 -mx-6 bg-gray-50/50">
                    <Label>Total Weight:</Label>
                    <span className={cn("font-bold text-lg", totalWeight === 100 ? "text-success" : "text-destructive")}>{totalWeight}%</span>
                </div>

                <ScrollArea className="max-h-[calc(80vh-15rem)]">
                    <div className="pr-6">
                        <Tabs defaultValue="cascaded" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="cascaded">Cascaded KPIs</TabsTrigger>
                                <TabsTrigger value="committed">Committed KPIs</TabsTrigger>
                            </TabsList>
                            <TabsContent value="cascaded" className="mt-4">
                                <div className="space-y-4">
                                    <h4 className="font-semibold">Assign from Department: {employee.department}</h4>
                                    {employeeDeptKpis.length > 0 ? employeeDeptKpis.map(kpi => {
                                      const isSelected = selectedCascaded.some(s => s.kpiId === kpi.id);
                                      return (
                                        <div key={kpi.id} className={cn("p-4 rounded-lg flex items-start gap-4", isSelected ? "bg-blue-50 border border-blue-200" : "bg-gray-50 border")}>
                                            <Checkbox 
                                              id={`cascaded-${kpi.id}`}
                                              checked={isSelected}
                                              onCheckedChange={(checked) => handleCascadedSelect(kpi.id, !!checked)}
                                              className="mt-1"
                                            />
                                            <div className="grid gap-1.5 flex-1">
                                                <label htmlFor={`cascaded-${kpi.id}`} className="font-medium cursor-pointer">{kpi.measure}</label>
                                                <p className="text-sm text-muted-foreground">Department Target: {kpi.target} {kpi.unit}</p>
                                                {isSelected && (
                                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                                        <div className="space-y-1">
                                                            <Label htmlFor={`weight-${kpi.id}`}>Individual Weight (%)</Label>
                                                            <Input 
                                                              id={`weight-${kpi.id}`} 
                                                              type="number"
                                                              placeholder="e.g., 20"
                                                              value={selectedCascaded.find(s => s.kpiId === kpi.id)?.weight || ''}
                                                              onChange={(e) => handleCascadedWeightChange(kpi.id, e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                      )
                                    }) : <p className="text-sm text-muted-foreground text-center py-4">No KPIs have been cascaded to the {employee.department} department yet.</p>}
                                </div>
                            </TabsContent>
                            <TabsContent value="committed" className="mt-4">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                       <h4 className="font-semibold">Create Individual Commitments</h4>
                                       <Button size="sm" variant="outline" onClick={handleAddCommitted}><PlusCircle className="mr-2 h-4 w-4"/>Add Commitment</Button>
                                    </div>

                                    {committedKpis.map((kpi, index) => (
                                        <div key={index} className="p-4 border rounded-lg space-y-4 relative bg-gray-50">
                                            <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-7 w-7" onClick={() => handleRemoveCommitted(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <Label>Task / Objective</Label>
                                                    <Textarea placeholder="e.g., Complete project management certification" value={kpi.task} onChange={e => handleCommittedChange(index, 'task', e.target.value)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>Weight (%)</Label>
                                                    <Input type="number" placeholder="e.g., 15" value={kpi.weight || ''} onChange={e => handleCommittedChange(index, 'weight', parseInt(e.target.value) || 0)} />
                                                </div>
                                            </div>
                                            <div>
                                                <Label className="mb-2 block">5-Level Targets</Label>
                                                <div className="grid grid-cols-5 gap-2">
                                                    {['level1', 'level2', 'level3', 'level4', 'level5'].map((level, i) => (
                                                        <div key={level} className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">Level {i+1}</Label>
                                                            <Input placeholder={`Target for level ${i+1}`} value={(kpi.targets as any)[level]} onChange={e => handleCommittedTargetChange(index, level, e.target.value)} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {committedKpis.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No individual commitments added.</p>}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </ScrollArea>
                
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleConfirmClick} disabled={!user}>Confirm Assignments</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


// ==================== MAIN COMPONENT ====================

export default function KPICascadeManagement() {
  const { setPageTitle } = useAppLayout();
  
  useEffect(() => {
    setPageTitle("KPI Cascade");
  }, [setPageTitle]);

  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  // States
  const [selectedKpi, setSelectedKpi] = useState<CorporateKpi | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeployAndCascadeOpen, setIsDeployAndCascadeOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<WithId<Employee> | null>(null);

  // Firestore collections
  const cascadedKpisQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'cascaded_kpis') : null),
    [firestore]
  );
  const { data: cascadedKpis, isLoading: isCascadedKpisLoading } = useCollection<WithId<CascadedKpi>>(cascadedKpisQuery);
  
  const individualKpisQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'individual_kpis') : null),
    [firestore]
  );
  const { data: individualKpis, isLoading: isIndividualKpisLoading } = useCollection<WithId<IndividualKpi>>(individualKpisQuery);

  const employeesQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'employees') : null),
    [firestore]
  );
  const { data: employees, isLoading: isEmployeesLoading } = useCollection<WithId<Employee>>(employeesQuery);


  // Determine user role
  const userRole: Role = useMemo(() => {
    if (!user) return null;
    // Add your role determination logic here
    return 'Admin'; // Default for demo
  }, [user]);

  const departments = useMemo(() => {
    if (!employees) return [];
    return Array.from(new Set(employees.map(emp => emp.department))).filter(Boolean);
  }, [employees]);
  
  const overallLoading = isUserLoading || isCascadedKpisLoading || isIndividualKpisLoading || isEmployeesLoading;

  // ==================== HANDLERS ====================

  const handleDeployAndCascadeClick = (kpi: CorporateKpi) => {
    setSelectedKpi(kpi);
    setIsDeployAndCascadeOpen(true);
  };
  
  const handleConfirmDeployAndCascade = async (
    distributions: MonthlyDistribution[],
    cascadeInputs: DepartmentCascadeInput[],
    strategy: DistributionStrategy,
    year: number
  ) => {
     if (!user || !firestore || !selectedKpi) {
      toast({ title: "Authentication Required", variant: 'destructive' });
      return;
    }

    try {
      // 1. Deploy Monthly KPIs
      const monthlyKpisCollection = collection(firestore, 'monthly_kpis');
      for (const m of distributions) {
        const monthlyKpi: Omit<MonthlyKpi, 'id' | 'createdAt' | 'updatedAt'> = {
          parentKpiId: selectedKpi.id, measure: selectedKpi.measure, perspective: selectedKpi.perspective || '',
          category: selectedKpi.category || '', year, month: m.month, target: m.target, actual: 0,
          progress: 0, percentage: m.percentage, unit: selectedKpi.unit || '', status: 'Active',
          distributionStrategy: strategy, createdBy: user.uid,
        };
        addDocumentNonBlocking(monthlyKpisCollection, { ...monthlyKpi, createdAt: new Date() });
      }

      // 2. Cascade to Departments
      const cascadedKpisCollection = collection(firestore, 'cascaded_kpis');
      for (const input of cascadeInputs) {
        const cascadedKpi: Omit<CascadedKpi, 'id'> = {
          corporateKpiId: selectedKpi.id, measure: selectedKpi.measure, department: input.department,
          weight: input.weight, target: input.target, category: selectedKpi.category, unit: selectedKpi.unit,
        };
        addDocumentNonBlocking(cascadedKpisCollection, cascadedKpi);
      }

      toast({ 
        title: "KPI Deployed & Cascaded! 🎉", 
        description: `"${selectedKpi.measure}" for ${year} is deployed and cascaded to ${cascadeInputs.length} departments.`,
        duration: 7000
      });

      setIsDeployAndCascadeOpen(false);
      setSelectedKpi(null);
    } catch (err) {
      console.error('Error in deploy & cascade process:', err);
      toast({ title: "Process Failed", description: "An error occurred.", variant: 'destructive' });
    }
  };


  const handleEditClick = (kpi: CorporateKpi) => {
    setSelectedKpi(kpi);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (kpi: CorporateKpi) => {
    if (!user || !firestore) {
      toast({ title: "Authentication Required", description: "Please log in to delete KPIs.", variant: 'destructive' });
      return;
    }
    const ref = doc(firestore, 'kpi_catalog', kpi.id);
    deleteDocumentNonBlocking(ref);
    toast({ title: "KPI Deleted", description: `"${kpi.measure}" has been removed.`, variant: 'destructive' });
  };

  const handleAssignKpiClick = (employee: WithId<Employee>) => {
    setSelectedEmployee(employee);
    setIsAssignModalOpen(true);
  };

  const handleDeleteIndividualKpi = (kpiId: string) => {
    if (!user || !firestore) {
      toast({ title: "Authentication Required", variant: 'destructive' });
      return;
    }
    const ref = doc(firestore, 'individual_kpis', kpiId);
    deleteDocumentNonBlocking(ref);
    toast({ title: "Assigned KPI Deleted", description: "The KPI has been removed from the individual's portfolio." });
  };

  const handleDeleteCascadedKpi = (kpiId: string) => {
    if (!user || !firestore) {
      toast({ title: "Authentication Required", variant: 'destructive' });
      return;
    }
    const ref = doc(firestore, 'cascaded_kpis', kpiId);
    deleteDocumentNonBlocking(ref);
    toast({ title: "Cascaded KPI Deleted", description: "The KPI has been removed from the department.", variant: 'destructive' });
  };

  const handleConfirmEdit = (editedKpi: Kpi) => {
    if (!user || !firestore || !('id' in editedKpi)) {
      toast({ title: "Authentication or Data Error", variant: 'destructive' });
      return;
    }
    const ref = doc(firestore, 'kpi_catalog', editedKpi.id);
    setDocumentNonBlocking(ref, editedKpi, { merge: true });
    toast({ title: "KPI Updated", description: `"${editedKpi.measure}" has been updated.` });
  };

  const handleConfirmAssignment = async (assignments: Omit<IndividualKpi, 'status'>[]) => {
    if (!user || !firestore || !selectedEmployee) {
      toast({ title: "Authentication Required", variant: 'destructive' });
      return;
    }

    const colRef = collection(firestore, 'individual_kpis');
    
    // We don't delete old ones, we just add new ones. The portfolio page will show all.
    // Management of old/duplicate KPIs can be a future feature.
    
    for (const assignment of assignments) {
      addDocumentNonBlocking(colRef, { ...assignment, status: 'Draft' as const });
    }
    
    toast({ title: "KPIs Assigned", description: `${assignments.length} KPI(s) have been assigned to ${selectedEmployee.name} as 'Draft'.` });
  };

  // ==================== RENDER ====================

  return (
    <div className="fade-in space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">KPI Cascade Structure</h3>
        <p className="text-gray-600">โครงสร้าง KPI แบบ 3 ระดับ: องค์กร → ฝ่าย → บุคคล</p>
        
        {!isUserLoading && !user && (
          <div className="mt-4 p-3 rounded-md text-sm flex items-center bg-amber-50 border border-amber-200 text-amber-800">
            <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
            <p><strong>You are not logged in.</strong> All management actions are disabled. Please log in to edit, assign, or delete KPIs.</p>
          </div>
        )}
      </div>
      
      {isUserLoading ? (
        <p>Loading user permissions...</p>
      ) : (
        <Tabs defaultValue="corporate" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="corporate">ระดับองค์กร</TabsTrigger>
            <TabsTrigger value="department">ระดับฝ่าย</TabsTrigger>
            <TabsTrigger value="individual">ระดับบุคคล</TabsTrigger>
          </TabsList>

          <TabsContent value="corporate" className="mt-6">
            <CorporateLevel 
              onDeployAndCascadeClick={handleDeployAndCascadeClick} 
              onEditClick={handleEditClick}
              onDeleteClick={handleDeleteClick} 
              userRole={userRole} 
            />
          </TabsContent>

          <TabsContent value="department" className="mt-6">
            <DepartmentLevel
              cascadedKpis={cascadedKpis}
              isLoading={isCascadedKpisLoading}
              onDeleteCascadedKpi={handleDeleteCascadedKpi} 
              userRole={userRole} 
            />
          </TabsContent>

          <TabsContent value="individual" className="mt-6">
             <IndividualLevel
              employees={employees}
              individualKpis={individualKpis}
              isLoading={overallLoading}
              onAssignKpi={handleAssignKpiClick}
              onDeleteIndividualKpi={handleDeleteIndividualKpi}
              userRole={userRole}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Dialogs */}
      <DeployAndCascadeDialog
        kpi={selectedKpi}
        isOpen={isDeployAndCascadeOpen}
        onClose={() => { 
          setIsDeployAndCascadeOpen(false); 
          setSelectedKpi(null); 
        }}
        onConfirm={handleConfirmDeployAndCascade}
        user={user}
        departments={departments}
      />
      
      <EditKpiDialog 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        kpi={selectedKpi}
        onConfirm={handleConfirmEdit}
        user={user}
      />
      
      <AssignKpiDialog
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
        departmentKpis={cascadedKpis || []}
        onConfirm={handleConfirmAssignment}
        user={user}
      />
    </div>
  );
}
