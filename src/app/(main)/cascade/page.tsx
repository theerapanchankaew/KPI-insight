
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useKpiData, type Employee, type Kpi, type CascadedKpi } from '@/context/KpiDataContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronsUpDown, PlusCircle, Trash2, Edit, AlertTriangle, MoreVertical, Calendar, TrendingUp, BarChart3 } from 'lucide-react';
import { WithId, useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, doc } from 'firebase/firestore';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ==================== TYPE DEFINITIONS ====================

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
            className="bg-red-600 hover:bg-red-700"
          >
            ลบ
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// ==================== MONTHLY DEPLOY DIALOG ====================

const MonthlyDeployDialog = ({
  kpi, isOpen, onClose, onConfirm, user
}: {
  kpi: CorporateKpi | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (distributions: MonthlyDistribution[], strategy: DistributionStrategy, year: number) => void;
  user: any;
}) => {
  const [strategy, setStrategy] = useState<DistributionStrategy>('auto');
  const [seasonalPattern, setSeasonalPattern] = useState<SeasonalPattern>('retail');
  const [progressiveCurve, setProgressiveCurve] = useState<ProgressiveCurve>('linear');
  const [previewData, setPreviewData] = useState<MonthlyDistribution[]>([]);
  const [customWeights, setCustomWeights] = useState<number[]>(Array(12).fill(1));
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    if (kpi && isOpen) generatePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy, seasonalPattern, progressiveCurve, customWeights, kpi, isOpen]);

  const generatePreview = () => {
    if (!kpi) return;
    let actualStrategy = strategy === 'auto' ? detectBestStrategy(kpi) : strategy;
    let preview: MonthlyDistribution[];

    switch (actualStrategy) {
      case 'equal': preview = DISTRIBUTION_STRATEGIES.equal(kpi.target); break;
      case 'weighted': preview = DISTRIBUTION_STRATEGIES.weighted(kpi.target, customWeights); break;
      case 'seasonal': preview = DISTRIBUTION_STRATEGIES.seasonal(kpi.target, seasonalPattern); break;
      case 'progressive': preview = DISTRIBUTION_STRATEGIES.progressive(kpi.target, progressiveCurve); break;
      case 'historical': preview = DISTRIBUTION_STRATEGIES.equal(kpi.target); break;
      default: preview = DISTRIBUTION_STRATEGIES.equal(kpi.target);
    }
    setPreviewData(preview);
  };

  const getStrategyDisplayName = (strat: DistributionStrategy): string => {
    const names: Record<DistributionStrategy, string> = {
      'auto': '🤖 อัตโนมัติ (AI แนะนำ)',
      'equal': '⚖️ เท่ากันทุกเดือน',
      'weighted': '⚡ กำหนดน้ำหนักเอง',
      'seasonal': '📊 ตามฤดูกาล',
      'progressive': '📈 เพิ่มขึ้นแบบก้าวหน้า',
      'historical': '📜 ตามข้อมูลในอดีต'
    };
    return names[strat];
  };

  const handleDeploy = () => {
    if (!user) return;
    let actualStrategy = strategy === 'auto' ? detectBestStrategy(kpi!) : strategy;
    onConfirm(previewData, actualStrategy, selectedYear);
    onClose();
  };

  const totalPercentage = previewData.reduce((sum, m) => sum + m.percentage, 0);
  const totalTarget = previewData.reduce((sum, m) => sum + m.target, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Deploy KPI เป็นรายเดือน
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <div className="font-semibold text-gray-700">{kpi?.measure}</div>
            <div className="text-sm">
              เป้าหมายรายปี: <span className="font-bold text-blue-600">{kpi?.target}</span> {kpi?.unit}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ปีที่ต้องการ Deploy</Label>
              <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i).map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>กลยุทธ์การกระจาย</Label>
              <Select value={strategy} onValueChange={(val) => setStrategy(val as DistributionStrategy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['auto', 'equal', 'weighted', 'seasonal', 'progressive', 'historical'] as DistributionStrategy[]).map(strat => (
                    <SelectItem key={strat} value={strat}>
                      {getStrategyDisplayName(strat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {strategy === 'seasonal' && (
            <div>
              <Label>รูปแบบฤดูกาล</Label>
              <Select value={seasonalPattern} onValueChange={(val) => setSeasonalPattern(val as SeasonalPattern)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">🛍️ Retail (เพิ่มสูงสุดธันวาคม)</SelectItem>
                  <SelectItem value="tourism">✈️ Tourism (เพิ่มสูง Q4)</SelectItem>
                  <SelectItem value="agriculture">🌾 Agriculture (เพิ่มสูงกลางปี)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {strategy === 'progressive' && (
            <div>
              <Label>รูปแบบการเติบโต</Label>
              <Select value={progressiveCurve} onValueChange={(val) => setProgressiveCurve(val as ProgressiveCurve)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">📈 Linear (เพิ่มเท่าๆ กัน)</SelectItem>
                  <SelectItem value="exponential">🚀 Exponential (เพิ่มเร็วขึ้นเรื่อยๆ)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {strategy === 'weighted' && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <Label className="mb-3 block font-semibold">กำหนดน้ำหนักแต่ละเดือน</Label>
              <div className="grid grid-cols-6 gap-3">
                {customWeights.map((weight, i) => (
                  <div key={i}>
                    <Label className="text-xs mb-1">{MONTH_NAMES_TH[i]}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={weight}
                      onChange={(e) => {
                        const newWeights = [...customWeights];
                        newWeights[i] = parseFloat(e.target.value) || 0;
                        setCustomWeights(newWeights);
                      }}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border rounded-lg p-4 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                ตัวอย่างการกระจาย
              </h4>
              <div className="text-sm text-gray-500">
                รวม: {totalTarget.toFixed(2)} {kpi?.unit} ({totalPercentage.toFixed(1)}%)
              </div>
            </div>

            <ScrollArea className="h-96">
              <div className="space-y-2">
                {previewData.map((month) => (
                  <div key={month.month} className="flex items-center gap-4 p-2 hover:bg-gray-50 rounded">
                    <span className="w-12 text-sm font-medium text-gray-700">
                      {month.monthName}
                    </span>
                    <div className="flex-1">
                      <Progress value={month.percentage} className="h-3" />
                    </div>
                    <span className="w-28 text-right font-semibold text-gray-800">
                      {month.target.toFixed(2)}
                    </span>
                    <span className="w-16 text-right text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {month.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {strategy === 'auto' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <div className="flex gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>โหมดอัตโนมัติ:</strong> ระบบจะวิเคราะห์ KPI และเลือกกลยุทธ์ที่เหมาะสมที่สุด
                  <div className="mt-1 text-blue-700">
                    กำลังใช้: {getStrategyDisplayName(detectBestStrategy(kpi!))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleDeploy} disabled={!user}>
            <Calendar className="mr-2 h-4 w-4" />
            Deploy เป็นรายเดือน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ==================== CORPORATE LEVEL COMPONENT ====================

const CorporateLevel = ({ 
  onCascadeClick, 
  onEditClick, 
  onDeleteClick,
  onMonthlyDeployClick,
  userRole 
}: { 
  onCascadeClick: (kpi: CorporateKpi) => void;
  onEditClick: (kpi: CorporateKpi) => void;
  onDeleteClick: (kpi: CorporateKpi) => void;
  onMonthlyDeployClick: (kpi: CorporateKpi) => void;
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
                      {canCascade && (
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => onMonthlyDeployClick(kpi)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          Deploy รายเดือน
                        </Button>
                      )}
                      
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => onCascadeClick(kpi)}
                        disabled={!canCascade}
                      >
                        Cascade ฝ่าย
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline">
                            Action
                            <MoreVertical className="ml-2 h-4 w-4" />
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
                              className="text-destructive"
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
  onDeleteCascadedKpi, 
  userRole 
}: { 
  onDeleteCascadedKpi: (kpiId: string) => void;
  userRole: Role;
}) => {
  const firestore = useFirestore();
  const cascadedKpisQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'cascaded_kpis') : null),
    [firestore]
  );
  const { data: cascadedKpis } = useCollection<WithId<CascadedKpi>>(cascadedKpisQuery);
  const [deleteKpi, setDeleteKpi] = useState<WithId<CascadedKpi> | null>(null);

  const canDelete = ['Admin', 'VP', 'AVP', 'Manager'].includes(userRole || '');

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
                      <Badge variant="outline" className="text-xs">{kpi.category}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold">{kpi.target} {kpi.unit}</span>
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteKpi(kpi)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
  individualKpis, 
  onAssignKpi, 
  onEditIndividualKpi,
  onDeleteIndividualKpi,
  userRole,
  user
}: {
  individualKpis: WithId<IndividualKpi>[] | null;
  onAssignKpi: (employee: Employee) => void;
  onEditIndividualKpi: (kpi: WithId<IndividualKpi>) => void;
  onDeleteIndividualKpi: (kpiId: string) => void;
  userRole: Role;
  user: any;
}) => {
  const firestore = useFirestore();
  const orgDataQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'employees') : null),
    [firestore]
  );
  const { data: orgData } = useCollection<WithId<Employee>>(orgDataQuery);
  const [deleteKpi, setDeleteKpi] = useState<WithId<IndividualKpi> | null>(null);

  const canAssign = ['Admin', 'VP', 'AVP', 'Manager'].includes(userRole || '');
  const canDelete = ['Admin', 'Manager'].includes(userRole || '');

  if (!orgData || orgData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Individual KPIs</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-gray-500">
          <p>No employee data available.</p>
        </CardContent>
      </Card>
    );
  }

  const employeeKpiMap = (individualKpis || []).reduce((acc, kpi) => {
    if (!acc[kpi.employeeId]) acc[kpi.employeeId] = [];
    acc[kpi.employeeId].push(kpi);
    return acc;
  }, {} as { [key: string]: WithId<IndividualKpi>[] });

  return (
    <>
      <div className="space-y-4">
        {orgData.map(employee => {
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
                      <div key={kpi.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{kpi.kpiMeasure}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">{kpi.status}</Badge>
                            <span className="text-xs text-gray-500">Weight: {kpi.weight}%</span>
                          </div>
                        </div>
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteKpi(kpi)}
                            className="text-red-600 hover:text-red-700"
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

const CascadeDialog = (props: any) => <div />;
const EditKpiDialog = (props: any) => <div />;
const AssignKpiDialog = (props: any) => <div />;

// ==================== MAIN COMPONENT ====================

export default function KPICascadeManagement() {
  useAppLayout({
    title: 'KPI Management',
    description: 'Manage and cascade KPIs across the organization'
  });

  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isLoading: isUserLoading } = useUser();

  // States
  const [selectedKpi, setSelectedKpi] = useState<CorporateKpi | null>(null);
  const [isCascadeModalOpen, setIsCascadeModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMonthlyDeployOpen, setIsMonthlyDeployOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedKpis, setSelectedKpis] = useState<any>({});
  const [committedKpis, setCommittedKpis] = useState<any[]>([]);

  // Firestore collections
  const individualKpisQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'individual_kpis') : null),
    [firestore]
  );
  const { data: individualKpis } = useCollection<WithId<IndividualKpi>>(individualKpisQuery);
  
  const cascadedKpisQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'cascaded_kpis') : null),
    [firestore]
  );
  const { data: cascadedKpis } = useCollection<WithId<CascadedKpi>>(cascadedKpisQuery);

  const orgDataQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'employees') : null),
    [firestore]
  );
  const { data: orgData } = useCollection<Employee>(orgDataQuery);


  // Determine user role
  const userRole: Role = useMemo(() => {
    if (!user) return null;
    // Add your role determination logic here
    return 'Admin'; // Default for demo
  }, [user]);

  const departments = useMemo(() => {
    if (!orgData) return [];
    return Array.from(new Set(orgData.map(emp => emp.department))).filter(Boolean);
  }, [orgData]);

  // ==================== HANDLERS ====================

  const handleCascadeClick = (kpi: CorporateKpi) => {
    setSelectedKpi(kpi);
    setIsCascadeModalOpen(true);
  };

  const handleEditClick = (kpi: CorporateKpi) => {
    setSelectedKpi(kpi);
    setIsEditModalOpen(true);
  };

  const handleMonthlyDeployClick = (kpi: CorporateKpi) => {
    setSelectedKpi(kpi);
    setIsMonthlyDeployOpen(true);
  };

  const handleDeleteClick = (kpi: CorporateKpi) => {
    if (!user || !firestore) {
      toast({ 
        title: "Authentication Required", 
        description: "Please log in to delete KPIs.", 
        variant: 'destructive' 
      });
      return;
    }
    
    const ref = doc(firestore, 'kpi_catalog', kpi.id);
    deleteDocumentNonBlocking(ref);
    toast({ 
      title: "KPI Deleted", 
      description: `"${kpi.measure}" has been removed from the catalog.`, 
      variant: 'destructive' 
    });
  };

  const handleAssignKpiClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsAssignModalOpen(true);
  };

  const handleEditIndividualKpi = (kpi: WithId<IndividualKpi>) => {
    const employee = orgData?.find(e => e.id === kpi.employeeId);
    if (employee) {
      handleAssignKpiClick(employee);
    }
  };

  const handleDeleteIndividualKpi = (kpiId: string) => {
    if (!user || !firestore) {
      toast({ 
        title: "Authentication Required", 
        description: "Please log in to delete KPIs.", 
        variant: 'destructive' 
      });
      return;
    }
    
    const ref = doc(firestore, 'individual_kpis', kpiId);
    deleteDocumentNonBlocking(ref);
    toast({ 
      title: "Assigned KPI Deleted", 
      description: "The KPI has been removed from the individual's portfolio." 
    });
  };

  const handleDeleteCascadedKpi = (kpiId: string) => {
    if (!user || !firestore) {
      toast({ 
        title: "Authentication Required", 
        description: "Please log in to delete KPIs.", 
        variant: 'destructive' 
      });
      return;
    }
    
    const ref = doc(firestore, 'cascaded_kpis', kpiId);
    deleteDocumentNonBlocking(ref);
    toast({ 
      title: "Cascaded KPI Deleted", 
      description: "The KPI has been removed from the department.", 
      variant: 'destructive' 
    });
  };

  const handleConfirmMonthlyDeploy = async (
    distributions: MonthlyDistribution[], 
    strategy: DistributionStrategy, 
    year: number
  ) => {
    if (!user || !firestore || !selectedKpi) {
      toast({ 
        title: "Authentication Required", 
        description: "Please log in to deploy KPIs.", 
        variant: 'destructive' 
      });
      return;
    }

    try {
      const monthlyKpisCollection = collection(firestore, 'monthly_kpis');
      
      for (const m of distributions) {
        const monthlyKpi: Omit<MonthlyKpi, 'id' | 'createdAt'> = {
          parentKpiId: selectedKpi.id,
          measure: selectedKpi.measure,
          perspective: selectedKpi.perspective || '',
          category: selectedKpi.category || '',
          year,
          month: m.month,
          target: m.target,
          actual: 0,
          progress: 0,
          percentage: m.percentage,
          unit: selectedKpi.unit || '',
          status: 'Active',
          distributionStrategy: strategy,
          createdBy: user.uid,
        };
        
        await addDocumentNonBlocking(monthlyKpisCollection, monthlyKpi);
      }

      toast({ 
        title: "KPI Deployed Successfully! 🎉", 
        description: `"${selectedKpi.measure}" has been deployed to 12 monthly targets for ${year}.`,
        duration: 5000
      });

      setIsMonthlyDeployOpen(false);
      setSelectedKpi(null);
    } catch (err) {
      console.error('Error deploying monthly KPIs:', err);
      toast({ 
        title: "Deployment Failed", 
        description: "An error occurred while deploying KPIs.", 
        variant: 'destructive' 
      });
    }
  };

  const handleConfirmCascade = (cascadedKpi: Omit<CascadedKpi, 'id'>) => {
    if (!user || !firestore) {
      toast({ 
        title: "Authentication Required", 
        description: "Please log in to cascade KPIs.", 
        variant: 'destructive' 
      });
      return;
    }
    
    const colRef = collection(firestore, 'cascaded_kpis');
    addDocumentNonBlocking(colRef, cascadedKpi);
    toast({ 
      title: "KPI Cascaded", 
      description: `"${cascadedKpi.measure}" has been cascaded.` 
    });
  };

  const handleConfirmEdit = (editedKpi: Kpi) => {
    if (!user || !firestore) {
      toast({ 
        title: "Authentication Required", 
        description: "Please log in to edit KPIs.", 
        variant: 'destructive' 
      });
      return;
    }
    
    const ref = doc(firestore, 'kpi_catalog', editedKpi.id);
    setDocumentNonBlocking(ref, editedKpi, { merge: true });
    toast({ 
      title: "KPI Updated", 
      description: `"${editedKpi.measure}" has been updated.` 
    });
  };

  const handleConfirmAssignment = async (assignments: Omit<IndividualKpi, 'status'>[]) => {
    if (!user || !firestore || !selectedEmployee) {
      toast({ 
        title: "Authentication Required", 
        description: "Please log in to assign KPIs.", 
        variant: 'destructive' 
      });
      return;
    }

    const colRef = collection(firestore, 'individual_kpis');
    const existing = (individualKpis || []).filter(ik => ik.employeeId === selectedEmployee.id);
    
    existing.forEach(a => {
      const docRef = doc(firestore, 'individual_kpis', a.id);
      deleteDocumentNonBlocking(docRef);
    });

    assignments.forEach(a => {
      addDocumentNonBlocking(colRef, { ...a, status: 'Draft' as const });
    });
    
    toast({ 
      title: "KPIs Assigned", 
      description: `${assignments.length} KPI(s) have been assigned to ${selectedEmployee.name}.` 
    });
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
              onCascadeClick={handleCascadeClick} 
              onEditClick={handleEditClick}
              onMonthlyDeployClick={handleMonthlyDeployClick}
              onDeleteClick={handleDeleteClick} 
              userRole={userRole} 
            />
          </TabsContent>

          <TabsContent value="department" className="mt-6">
            <DepartmentLevel 
              onDeleteCascadedKpi={handleDeleteCascadedKpi} 
              userRole={userRole} 
            />
          </TabsContent>

          <TabsContent value="individual" className="mt-6">
            <IndividualLevel 
              individualKpis={individualKpis} 
              onAssignKpi={handleAssignKpiClick} 
              onEditIndividualKpi={handleEditIndividualKpi}
              onDeleteIndividualKpi={handleDeleteIndividualKpi}
              userRole={userRole} 
              user={user}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Dialogs */}
      <MonthlyDeployDialog
        kpi={selectedKpi}
        isOpen={isMonthlyDeployOpen}
        onClose={() => { 
          setIsMonthlyDeployOpen(false); 
          setSelectedKpi(null); 
        }}
        onConfirm={handleConfirmMonthlyDeploy}
        user={user}
      />

      <CascadeDialog 
        isOpen={isCascadeModalOpen}
        onClose={() => setIsCascadeModalOpen(false)}
        kpi={selectedKpi}
        departments={departments}
        onConfirm={handleConfirmCascade}
        user={user}
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
          setSelectedKpis({});
          setCommittedKpis([]);
        }}
        employee={selectedEmployee}
        departmentKpis={cascadedKpis || []}
        onConfirm={handleConfirmAssignment}
        selectedKpis={selectedKpis}
        setSelectedKpis={setSelectedKpis}
        committedKpis={committedKpis}
        setCommittedKpis={setCommittedKpis}
        user={user}
      />
    </div>
  );
}

    