

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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronsUpDown, PlusCircle, Trash2, Edit, AlertTriangle, MoreVertical, Calendar, TrendingUp, BarChart3 } from 'lucide-react';
import { WithId, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, doc } from 'firebase/firestore';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


type Role = 'Admin' | 'VP' | 'AVP' | 'Manager' | 'Employee' | null;

// Type for a corporate KPI
type CorporateKpi = WithId<Kpi>;

// Monthly Distribution Types
interface MonthlyDistribution {
  month: number; // 1-12
  monthName: string;
  percentage: number; // 0-100
  target: number;
  weight?: number;
}

type DistributionStrategy = 'auto' | 'equal' | 'weighted' | 'seasonal' | 'progressive' | 'historical';
type SeasonalPattern = 'tourism' | 'retail' | 'agriculture' | 'custom';
type ProgressiveCurve = 'linear' | 'exponential';

// Monthly KPI in Firestore
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
  createdAt: any; // serverTimestamp
  updatedAt?: any; // serverTimestamp
  createdBy: string;
}

// Base type for any individual KPI
interface IndividualKpiBase {
    employeeId: string;
    kpiId: string; // This can be the original corporate KPI id or a new one for committed
    kpiMeasure: string;
    weight: number;
    status: 'Draft' | 'Agreed' | 'In-Progress' | 'Manager Review' | 'Upper Manager Approval' | 'Employee Acknowledged' | 'Closed' | 'Rejected';
    notes?: string;
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


// ==================== DISTRIBUTION STRATEGIES ====================

const MONTH_NAMES_TH = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const DISTRIBUTION_STRATEGIES = {
  // 1. Equal Distribution - แบ่งเท่าๆ กัน
  equal: (yearlyTarget: number): MonthlyDistribution[] => {
    const monthlyTarget = yearlyTarget / 12;
    return Array(12).fill(null).map((_, i) => ({
      month: i + 1,
      monthName: MONTH_NAMES_TH[i],
      percentage: 8.33,
      target: parseFloat(monthlyTarget.toFixed(2))
    }));
  },

  // 2. Weighted Distribution - แบบถ่วงน้ำหนัก
  weighted: (yearlyTarget: number, weights: number[]): MonthlyDistribution[] => {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight === 0) return DISTRIBUTION_STRATEGIES.equal(yearlyTarget);
    return weights.map((weight, i) => ({
      month: i + 1,
      monthName: MONTH_NAMES_TH[i],
      percentage: parseFloat(((weight / totalWeight) * 100).toFixed(2)),
      target: parseFloat(((yearlyTarget * weight) / totalWeight).toFixed(2)),
      weight
    }));
  },

  // 3. Seasonal Distribution - ตามฤดูกาล
  seasonal: (yearlyTarget: number, pattern: SeasonalPattern = 'retail'): MonthlyDistribution[] => {
    const patterns: Record<SeasonalPattern, number[]> = {
      tourism: [6, 5, 4, 4, 5, 6, 8, 10, 12, 14, 12, 14], // High season Q4
      retail: [8, 8, 8, 9, 9, 9, 10, 10, 11, 12, 14, 16], // Peak December
      agriculture: [4, 4, 6, 8, 10, 12, 14, 12, 10, 8, 6, 6], // Mid-year peak
      custom: Array(12).fill(1) // Placeholder
    };
    
    const weights = patterns[pattern] || patterns.retail;
    return DISTRIBUTION_STRATEGIES.weighted(yearlyTarget, weights);
  },

  // 4. Progressive Distribution - แบบก้าวหน้า
  progressive: (yearlyTarget: number, curve: ProgressiveCurve = 'linear'): MonthlyDistribution[] => {
    let weights: number[];
    
    if (curve === 'linear') {
      weights = Array(12).fill(null).map((_, i) => i + 1);
    } else {
      weights = Array(12).fill(null).map((_, i) => Math.pow(1.2, i));
    }
    
    return DISTRIBUTION_STRATEGIES.weighted(yearlyTarget, weights);
  },

  // 5. Historical Distribution - ตามข้อมูลในอดีต
  historical: (yearlyTarget: number, historicalData: number[][]): MonthlyDistribution[] => {
    if (!historicalData || historicalData.length === 0) {
      return DISTRIBUTION_STRATEGIES.equal(yearlyTarget);
    }
    const avgMonthlyPattern = Array(12).fill(0);
    historicalData.forEach(yearData => {
      yearData.forEach((value, month) => {
        if (month < 12) avgMonthlyPattern[month] += value;
      });
    });
    
    const yearCount = historicalData.length;
    const avgPattern = avgMonthlyPattern.map(sum => sum / yearCount);
    const totalAvg = avgPattern.reduce((a, b) => a + b, 0);

    if (totalAvg === 0) return DISTRIBUTION_STRATEGIES.equal(yearlyTarget);
    
    return avgPattern.map((avg, i) => ({
      month: i + 1,
      monthName: MONTH_NAMES_TH[i],
      percentage: parseFloat(((avg / totalAvg) * 100).toFixed(2)),
      target: parseFloat(((yearlyTarget * avg) / totalAvg).toFixed(2))
    }));
  }
};

const calculateVariance = (data: number[][]): number => {
  const flatData = data.flat();
  if (flatData.length === 0) return 0;
  const mean = flatData.reduce((a, b) => a + b, 0) / flatData.length;
  const variance = flatData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / flatData.length;
  return Math.sqrt(variance) / mean; // Coefficient of variation
};

const detectBestStrategy = (
  kpi: CorporateKpi | null, 
  historicalData?: number[][]
): DistributionStrategy => {
  if (!kpi) return 'equal';
  if (historicalData && historicalData.length >= 2) {
    const variance = calculateVariance(historicalData);
    if (variance > 0.15) return 'historical';
  }

  const measure = kpi.measure.toLowerCase();
  const seasonalKeywords = ['sale', 'sales', 'revenue', 'customer', 'order', 'visitor', 'ขาย', 'รายได้', 'ลูกค้า'];
  if (seasonalKeywords.some(keyword => measure.includes(keyword))) return 'seasonal';

  const growthKeywords = ['growth', 'increase', 'expand', 'new', 'เติบโต', 'เพิ่ม', 'ขยาย'];
  if (growthKeywords.some(keyword => measure.includes(keyword))) return 'progressive';
  
  return 'equal';
};

const MonthlyDeployDialog = ({ 
  kpi, 
  isOpen, 
  onClose,
  onConfirm,
  user
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
    if (kpi && isOpen) {
      generatePreview();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy, seasonalPattern, progressiveCurve, customWeights, kpi, isOpen]);

  const generatePreview = () => {
    if (!kpi) return;
    
    let preview: MonthlyDistribution[];
    const yearlyTarget = Number(String(kpi.target).replace(/[^0-9.-]+/g,""));
    
    let actualStrategy = strategy;
    if (strategy === 'auto') {
      actualStrategy = detectBestStrategy(kpi);
    }

    switch (actualStrategy) {
      case 'equal':
        preview = DISTRIBUTION_STRATEGIES.equal(yearlyTarget);
        break;
      case 'weighted':
        preview = DISTRIBUTION_STRATEGIES.weighted(yearlyTarget, customWeights);
        break;
      case 'seasonal':
        preview = DISTRIBUTION_STRATEGIES.seasonal(yearlyTarget, seasonalPattern);
        break;
      case 'progressive':
        preview = DISTRIBUTION_STRATEGIES.progressive(yearlyTarget, progressiveCurve);
        break;
      case 'historical':
        preview = DISTRIBUTION_STRATEGIES.equal(yearlyTarget); // Fallback for demo
        break;
      default:
        preview = DISTRIBUTION_STRATEGIES.equal(yearlyTarget);
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

  if (!kpi) return null;
  const yearlyTargetValue = Number(String(kpi.target).replace(/[^0-9.-]+/g,""));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Deploy KPI เป็นรายเดือน
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <div className="font-semibold text-gray-700">{kpi?.measure}</div>
            <div className="text-sm">เป้าหมายรายปี: <span className="font-bold text-blue-600">{kpi?.target}</span> {kpi?.unit}</div>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Left Column: Controls */}
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label>ปีที่ต้องการ Deploy</Label>
                        <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i - 2).map(year => (
                                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>กลยุทธ์การกระจาย</Label>
                        <Select value={strategy} onValueChange={(val) => setStrategy(val as DistributionStrategy)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {(['auto', 'equal', 'weighted', 'seasonal', 'progressive', 'historical'] as DistributionStrategy[]).map(strat => (
                                    <SelectItem key={strat} value={strat}>{getStrategyDisplayName(strat)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {strategy === 'auto' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                    <div className="flex gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div><strong>โหมดอัตโนมัติ:</strong> ระบบจะเลือกกลยุทธ์ที่เหมาะสมที่สุด<div className="mt-1 text-blue-700">กำลังใช้: {getStrategyDisplayName(detectBestStrategy(kpi))}</div></div>
                    </div>
                    </div>
                )}
                {strategy === 'seasonal' && (
                    <div>
                        <Label>รูปแบบฤดูกาล</Label>
                        <Select value={seasonalPattern} onValueChange={(val) => setSeasonalPattern(val as SeasonalPattern)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
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
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                        <SelectItem value="linear">📈 Linear (เพิ่มเท่าๆ กัน)</SelectItem>
                        <SelectItem value="exponential">🚀 Exponential (เพิ่มเร็วขึ้นเรื่อยๆ)</SelectItem>
                        </SelectContent>
                    </Select>
                    </div>
                )}
                 {strategy === 'weighted' && (
                    <Card className="p-4 bg-gray-50">
                        <CardHeader className="p-2"><CardTitle className="text-base">กำหนดน้ำหนักเอง</CardTitle></CardHeader>
                        <CardContent className="p-2">
                            <div className="grid grid-cols-4 gap-2">
                                {customWeights.map((weight, i) => (
                                <div key={i} className="space-y-1">
                                    <Label className="text-xs">{MONTH_NAMES_TH[i]}</Label>
                                    <Input type="number" min="0" step="0.1" value={weight} onChange={(e) => {
                                        const newWeights = [...customWeights];
                                        newWeights[i] = parseFloat(e.target.value) || 0;
                                        setCustomWeights(newWeights);
                                    }} className="h-8 text-sm" />
                                </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Right Column: Preview */}
            <div className="border rounded-lg bg-white">
                <div className="flex items-center justify-between p-4 border-b">
                    <h4 className="font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4" />ตัวอย่างการกระจาย</h4>
                    <div className={cn("text-sm font-medium", Math.abs(totalTarget - yearlyTargetValue) > 0.01 ? 'text-destructive' : 'text-gray-500')}>
                        รวม: {totalTarget.toFixed(2)} ({totalPercentage.toFixed(1)}%)
                    </div>
                </div>
                <ScrollArea className="h-[400px]">
                    <div className="p-4 space-y-2">
                        {previewData.map((month) => (
                        <div key={month.month} className="flex items-center gap-4 p-1.5 hover:bg-gray-50 rounded">
                            <span className="w-12 text-sm font-medium text-gray-700">{month.monthName}</span>
                            <div className="flex-1"><Progress value={month.percentage} className="h-3" /></div>
                            <span className="w-24 text-right font-semibold text-gray-800 tabular-nums">{month.target.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            <span className="w-16 text-right text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded tabular-nums">{month.percentage.toFixed(1)}%</span>
                        </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </div>

        <DialogFooter className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleDeploy} disabled={!user}>
            <Calendar className="mr-2 h-4 w-4" />
            Deploy {previewData.length} เดือน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


const CorporateLevel = ({ onCascadeClick, onEditClick, onDeleteClick, onMonthlyDeployClick, userRole }: { onCascadeClick: (kpi: CorporateKpi) => void, onEditClick: (kpi: CorporateKpi) => void, onDeleteClick: (kpiId: string) => void, onMonthlyDeployClick: (kpi: CorporateKpi) => void, userRole: Role }) => {
    const { kpiData, isKpiDataLoading } = useKpiData();
    const [deleteKpiId, setDeleteKpiId] = useState<string | null>(null);
    const kpiToDelete = useMemo(() => {
      if (!deleteKpiId) return null;
      return kpiData?.find(kpi => kpi.id === deleteKpiId) || null;
    }, [deleteKpiId, kpiData]);


    const canEdit = userRole === 'Admin' || userRole === 'VP' || userRole === 'AVP' || userRole === 'Manager';
    const canDelete = userRole === 'Admin';
    const canCascade = userRole === 'Admin' || userRole === 'VP' || userRole === 'AVP' || userRole === 'Manager';
    
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
        <>
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
                                    <div className="flex justify-end mt-4 space-x-2">
                                        {canCascade && (
                                          <Button size="sm" variant="default" onClick={() => onMonthlyDeployClick(kpi)} className="bg-blue-600 hover:bg-blue-700">
                                            <Calendar className="mr-2 h-4 w-4" />
                                            Deploy รายเดือน
                                          </Button>
                                        )}
                                        <Button size="sm" variant="outline" onClick={() => onCascadeClick(kpi)}>Cascading to ระดับฝ่าย</Button>
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
                                                    <DropdownMenuItem onSelect={() => setDeleteKpiId(kpi.id)} className="text-destructive">
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
        <AlertDialog open={deleteKpiId !== null} onOpenChange={(open) => !open && setDeleteKpiId(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action will permanently delete the KPI "{kpiToDelete?.measure}". This cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteKpiId(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => {
                        if (deleteKpiId) onDeleteClick(deleteKpiId);
                        setDeleteKpiId(null);
                    }}>
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
};


const DepartmentLevel = () => {
    const { orgData, isOrgDataLoading, cascadedKpis, isCascadedKpisLoading } = useKpiData();

    if (isOrgDataLoading || isCascadedKpisLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Department Performance</CardTitle>
                </CardHeader>
                <CardContent className="p-6 text-center text-gray-500">
                    <p>Loading Organization and KPI data from Firestore...</p>
                </CardContent>
            </Card>
        );
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
    
    const kpisByDepartment = useMemo(() => {
        if (!cascadedKpis) return {};
        return cascadedKpis.reduce((acc, kpi) => {
            if (!acc[kpi.department]) {
                acc[kpi.department] = [];
            }
            acc[kpi.department].push(kpi);
            return acc;
        }, {} as Record<string, WithId<CascadedKpi>[]>);
    }, [cascadedKpis]);


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

const AssignedKpiGrid = ({ kpis, canEdit, onEdit, onDelete, user }: { 
    kpis: WithId<IndividualKpi>[], 
    canEdit: boolean, 
    onEdit: (kpi: WithId<IndividualKpi>) => void, 
    onDelete: (kpiId: string) => void,
    user: any 
}) => {
    const summary = useMemo(() => {
        const totalWeight = kpis.reduce((sum, kpi) => sum + kpi.weight, 0);
        const cascadedCount = kpis.filter(kpi => kpi.type === 'cascaded').length;
        const committedCount = kpis.filter(kpi => kpi.type === 'committed').length;
        return { totalWeight, cascadedCount, committedCount };
    }, [kpis]);

    const isUserLoggedIn = !!user;

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
                        {canEdit && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {kpis.map(kpi => (
                        <TableRow key={kpi.id}>
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
                             {canEdit && (
                                <TableCell className="text-right">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => onEdit(kpi)} 
                                        className="mr-2 h-8 w-8"
                                        disabled={!isUserLoggedIn}
                                        title={!isUserLoggedIn ? "Please log in to edit KPI" : "Edit KPI"}
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8"
                                                disabled={!isUserLoggedIn}
                                                title={!isUserLoggedIn ? "Please log in to delete KPI" : "Delete KPI"}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    {!isUserLoggedIn 
                                                        ? "You need to be logged in to delete KPIs. Please log in and try again."
                                                        : "This will permanently delete the assigned KPI. This action cannot be undone."
                                                    }
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                {isUserLoggedIn && (
                                                    <AlertDialogAction onClick={() => onDelete(kpi.id)}>Delete</AlertDialogAction>
                                                )}
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        ) : (
            <p className="text-sm text-center text-gray-500 py-4">No KPIs assigned to this individual yet.</p>
        )}
        
        {!isUserLoggedIn && canEdit && kpis.length === 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-amber-600 mr-2" />
                <p className="text-sm text-amber-800">
                    Log in to assign and manage KPIs.
                </p>
            </div>
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


const IndividualLevel = ({ 
    individualKpis, 
    onAssignKpi, 
    onEditIndividualKpi, 
    onDeleteIndividualKpi, 
    userRole,
    user 
}: { 
    individualKpis: WithId<IndividualKpi>[] | null, 
    onAssignKpi: (employee: WithId<Employee>) => void, 
    onEditIndividualKpi: (kpi: WithId<IndividualKpi>) => void, 
    onDeleteIndividualKpi: (kpiId: string) => void, 
    userRole: Role,
    user: any 
}) => {
    const { orgData, isOrgDataLoading } = useKpiData();

    const canAssignOrEdit = userRole === 'Admin' || userRole === 'VP' || userRole === 'AVP' || userRole === 'Manager';
    const isUserLoggedIn = !!user;

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
                <CardHeader><CardTitle>Individual Performance</CardTitle></CardHeader>
                <CardContent className="p-6 text-center text-gray-500">
                    <p>No Organization data has been imported.</p>
                    <p className="mt-2">Please go to the "Intake Data" page to upload an organization data file.</p>
                </CardContent>
            </Card>
        );
    }
    
    const managers = [...new Set(orgData.map(e => e.manager))].filter(Boolean);

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
                                const assignedForPerson = (individualKpis || []).filter(ik => ik.employeeId === person.id);
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
                                            <AssignedKpiGrid 
                                                kpis={assignedForPerson} 
                                                canEdit={canAssignOrEdit}
                                                onEdit={onEditIndividualKpi}
                                                onDelete={onDeleteIndividualKpi}
                                                user={user}
                                            />
                                            {canAssignOrEdit && (
                                                <div className="p-4 bg-gray-50/50 border-t flex justify-end">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => onAssignKpi(person)}
                                                        disabled={!isUserLoggedIn}
                                                        title={!isUserLoggedIn ? "Please log in to assign KPIs" : "Assign KPI"}
                                                    >
                                                        Assign KPI
                                                    </Button>
                                                </div>
                                            )}
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
    user
}: {
    isOpen: boolean;
    onClose: () => void;
    kpi: CorporateKpi | null;
    departments: string[];
    onConfirm: (cascadedKpi: Omit<CascadedKpi, 'id'>) => void;
    user: any;
}) => {
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
    const [target, setTarget] = useState('');
    const [weight, setWeight] = useState('');

    const isUserLoggedIn = !!user;

    useEffect(() => {
        if (!isOpen) {
            setSelectedDepartments([]);
            setTarget('');
            setWeight('');
        }
    }, [isOpen]);
    
    const handleDepartmentToggle = (department: string, checked: boolean) => {
        if (!isUserLoggedIn) return;
        setSelectedDepartments(prev => 
            checked ? [...prev, department] : prev.filter(d => d !== department)
        );
    };

    const handleSubmit = () => {
        if (!isUserLoggedIn) {
            alert("Please log in to cascade KPIs");
            return;
        }

        if (kpi && selectedDepartments.length > 0 && target && weight) {
            selectedDepartments.forEach(department => {
                onConfirm({
                    corporateKpiId: kpi.id,
                    measure: kpi.measure,
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
                    {!isUserLoggedIn && (
                        <DialogDescription className="text-destructive flex items-center pt-2">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Please log in to cascade KPIs.
                        </DialogDescription>
                    )}
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
                                            disabled={!isUserLoggedIn}
                                        />
                                        <Label htmlFor={`dept-${dept}`} className={cn("font-normal", !isUserLoggedIn && "text-muted-foreground")}>{dept}</Label>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="department-target">Department Target</Label>
                        <Input 
                            id="department-target" 
                            value={target} 
                            onChange={e => setTarget(e.target.value)} 
                            placeholder={`e.g., ${kpi.target}`} 
                            disabled={!isUserLoggedIn}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="department-weight">Weight (%)</Label>
                        <Input 
                            id="department-weight" 
                            type="number" 
                            value={weight} 
                            onChange={e => setWeight(e.target.value)} 
                            placeholder="e.g., 20" 
                            disabled={!isUserLoggedIn}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button 
                        onClick={handleSubmit}
                        disabled={!isUserLoggedIn || selectedDepartments.length === 0 || !target || !weight}
                        title={!isUserLoggedIn ? "Log in to confirm" : ""}
                    >
                        Confirm Cascade
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export type CascadedKpiSelection = { [kpiId: string]: { selected: boolean; weight: string; target: string } };
export type CommittedKpiDraft = {
    id: number;
    task: string;
    kpiMeasure: string;
    weight: string;
    targets: { level1: string; level2: string; level3: string; level4: string; level5: string; };
};

const AssignKpiDialog = ({
    isOpen,
    onClose,
    employee,
    departmentKpis,
    onConfirm,
    selectedKpis,
    setSelectedKpis,
    committedKpis,
    setCommittedKpis,
    user
}: {
    isOpen: boolean;
    onClose: () => void;
    employee: WithId<Employee> | null;
    departmentKpis: WithId<CascadedKpi>[];
    onConfirm: (assignments: Omit<IndividualKpi, 'status'>[]) => void;
    selectedKpis: CascadedKpiSelection;
    setSelectedKpis: React.Dispatch<React.SetStateAction<CascadedKpiSelection>>;
    committedKpis: CommittedKpiDraft[];
    setCommittedKpis: React.Dispatch<React.SetStateAction<CommittedKpiDraft[]>>;
    user: any;
}) => {
    const [assignmentType, setAssignmentType] = useState<'cascaded' | 'committed'>('cascaded');
    const isUserLoggedIn = !!user;
    
    const relevantKpis = useMemo(() => {
        if (!employee) return [];
        return departmentKpis.filter(kpi => kpi.department === employee.department);
    }, [departmentKpis, employee]);

    const handleKpiSelectionChange = (kpiId: string, field: 'selected' | 'weight' | 'target', value: string | boolean) => {
        if (!isUserLoggedIn) return;
        setSelectedKpis(prev => ({
            ...prev,
            [kpiId]: { ...(prev[kpiId] || { selected: false, weight: '', target: '' }), [field]: value }
        }));
    };

    const handleAddCommittedKpi = () => {
        if (!isUserLoggedIn) return;
        setCommittedKpis(prev => [...prev, {
            id: Date.now(),
            task: '',
            kpiMeasure: '',
            weight: '',
            targets: { level1: '', level2: '', level3: '', level4: '', level5: '' }
        }]);
    };

    const handleCommittedKpiChange = (index: number, field: keyof Omit<CommittedKpiDraft, 'id' | 'targets'>, value: string) => {
        if (!isUserLoggedIn) return;
        setCommittedKpis(prev => {
            const newKpis = [...prev];
            newKpis[index][field] = value;
            return newKpis;
        });
    };
    
    const handleCommittedTargetChange = (index: number, level: keyof CommittedKpiDraft['targets'], value: string) => {
        if (!isUserLoggedIn) return;
        setCommittedKpis(prev => {
            const newKpis = [...prev];
            newKpis[index].targets[level] = value;
            return newKpis;
        });
    };

    const handleRemoveCommittedKpi = (id: number) => {
        if (!isUserLoggedIn) return;
        setCommittedKpis(prev => prev.filter(kpi => kpi.id !== id));
    };
    
    const handleSubmit = () => {
        if (!isUserLoggedIn) {
            alert("Please log in to assign KPIs");
            return;
        }

        if (!employee) return;
        
        const cascadedAssignments: Omit<AssignedCascadedKpi, 'status'>[] = [];
        for (const kpiId in selectedKpis) {
            const selection = selectedKpis[kpiId];
            const kpiDetails = relevantKpis.find(k => k.id === kpiId);
            if (selection.selected && selection.weight && selection.target && kpiDetails) {
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

        const committedAssignments: Omit<CommittedKpi, 'status'>[] = committedKpis.map(draft => ({
            type: 'committed',
            employeeId: employee.id,
            kpiId: `committed-${draft.id}`,
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
                    {!isUserLoggedIn && (
                        <DialogDescription className="text-destructive flex items-center pt-2">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Please log in to assign KPIs.
                        </DialogDescription>
                    )}
                </DialogHeader>
                <Tabs value={assignmentType} onValueChange={(value) => setAssignmentType(value as 'cascaded' | 'committed')} className="w-full pt-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="cascaded" disabled={!isUserLoggedIn}>Assign Cascaded KPI</TabsTrigger>
                        <TabsTrigger value="committed" disabled={!isUserLoggedIn}>Create Committed KPI</TabsTrigger>
                    </TabsList>
                    <TabsContent value="cascaded" className="mt-6 space-y-4">
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
                                                        disabled={!isUserLoggedIn}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">{kpi.measure}</TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="text"
                                                        placeholder="Enter target"
                                                        value={selectedKpis[kpi.id]?.target || ''}
                                                        onChange={(e) => handleKpiSelectionChange(kpi.id, 'target', e.target.value)}
                                                        disabled={!isUserLoggedIn || !selectedKpis[kpi.id]?.selected}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        placeholder="e.g., 10"
                                                        value={selectedKpis[kpi.id]?.weight || ''}
                                                        onChange={(e) => handleKpiSelectionChange(kpi.id, 'weight', e.target.value)}
                                                        disabled={!isUserLoggedIn || !selectedKpis[kpi.id]?.selected}
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
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="absolute top-2 right-2 h-6 w-6" 
                                                onClick={() => handleRemoveCommittedKpi(kpi.id)}
                                                disabled={!isUserLoggedIn}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="md:col-span-2 space-y-2">
                                                    <Label htmlFor={`committed-task-${kpi.id}`}>Task / Project Name</Label>
                                                    <Input 
                                                        id={`committed-task-${kpi.id}`} 
                                                        value={kpi.task} 
                                                        onChange={e => handleCommittedKpiChange(index, 'task', e.target.value)} 
                                                        placeholder="e.g., Monthly Report Submission" 
                                                        disabled={!isUserLoggedIn}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`committed-weight-${kpi.id}`}>Weight (%)</Label>
                                                    <Input 
                                                        id={`committed-weight-${kpi.id}`} 
                                                        type="number" 
                                                        value={kpi.weight} 
                                                        onChange={e => handleCommittedKpiChange(index, 'weight', e.target.value)} 
                                                        placeholder="e.g., 15" 
                                                        disabled={!isUserLoggedIn}
                                                    />
                                                </div>
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor={`committed-measure-${kpi.id}`}>KPI Measure</Label>
                                                <Input 
                                                    id={`committed-measure-${kpi.id}`} 
                                                    value={kpi.kpiMeasure} 
                                                    onChange={e => handleCommittedKpiChange(index, 'kpiMeasure', e.target.value)} 
                                                    placeholder="e.g., On-time Submission Rate" 
                                                    disabled={!isUserLoggedIn}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Performance Levels (ระดับผลงาน)</Label>
                                                <div className="grid grid-cols-5 gap-2">
                                                    <Input placeholder="Level 1" value={kpi.targets.level1} onChange={e => handleCommittedTargetChange(index, 'level1', e.target.value)} disabled={!isUserLoggedIn} />
                                                    <Input placeholder="Level 2" value={kpi.targets.level2} onChange={e => handleCommittedTargetChange(index, 'level2', e.target.value)} disabled={!isUserLoggedIn} />
                                                    <Input placeholder="Level 3" value={kpi.targets.level3} onChange={e => handleCommittedTargetChange(index, 'level3', e.target.value)} disabled={!isUserLoggedIn} />
                                                    <Input placeholder="Level 4" value={kpi.targets.level4} onChange={e => handleCommittedTargetChange(index, 'level4', e.target.value)} disabled={!isUserLoggedIn} />
                                                    <Input placeholder="Level 5" value={kpi.targets.level5} onChange={e => handleCommittedTargetChange(index, 'level5', e.target.value)} disabled={!isUserLoggedIn} />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                           </div>
                        </ScrollArea>
                         <div className="flex justify-start">
                            <Button variant="outline" onClick={handleAddCommittedKpi} disabled={!isUserLoggedIn}>
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
                       <Button onClick={handleSubmit} disabled={!isUserLoggedIn || totalWeight > 100 || totalWeight === 0}>Assign KPIs</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const EditKpiDialog = ({
    isOpen,
    onClose,
    kpi,
    onConfirm,
    user
}: {
    isOpen: boolean;
    onClose: () => void;
    kpi: CorporateKpi | null;
    onConfirm: (kpi: Kpi) => void;
    user: any;
}) => {
    const [editedKpi, setEditedKpi] = useState<Kpi | null>(null);
    const isUserLoggedIn = !!user;

    useEffect(() => {
        if (kpi) {
            setEditedKpi(kpi);
        } else {
            setEditedKpi(null);
        }
    }, [kpi]);

    const handleChange = (field: keyof Kpi, value: string) => {
        if (!isUserLoggedIn) return;
        if (editedKpi) {
            setEditedKpi({ ...editedKpi, [field]: value });
        }
    };

    const handleSubmit = () => {
        if (!isUserLoggedIn) {
            alert("Please log in to edit KPIs");
            return;
        }

        if (editedKpi) {
            onConfirm(editedKpi);
            onClose();
        }
    };

    if (!kpi) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Corporate KPI</DialogTitle>
                    {!isUserLoggedIn && (
                        <DialogDescription className="text-destructive flex items-center pt-2">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                           Please log in to edit KPIs.
                        </DialogDescription>
                    )}
                </DialogHeader>
                {editedKpi && (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="kpi-measure">Measure</Label>
                            <Input id="kpi-measure" value={editedKpi.measure} onChange={(e) => handleChange('measure', e.target.value)} disabled={!isUserLoggedIn} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="kpi-target">Target</Label>
                                <Input id="kpi-target" value={editedKpi.target} onChange={(e) => handleChange('target', e.target.value)} disabled={!isUserLoggedIn}/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="kpi-unit">Unit</Label>
                                <Input id="kpi-unit" value={editedKpi.unit || ''} onChange={(e) => handleChange('unit', e.target.value)} disabled={!isUserLoggedIn}/>
                            </div>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="kpi-perspective">Perspective</Label>
                                <Input id="kpi-perspective" value={editedKpi.perspective} onChange={(e) => handleChange('perspective', e.target.value)} disabled={!isUserLoggedIn}/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="kpi-category">Category</Label>
                                <Input id="kpi-category" value={editedKpi.category} onChange={(e) => handleChange('category', e.target.value)} disabled={!isUserLoggedIn}/>
                            </div>
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSubmit} disabled={!isUserLoggedIn}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function CascadePage() {
  const { setPageTitle } = useAppLayout();
  const { orgData } = useKpiData();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<Role>(null);
  
  const cascadedKpisQuery = useMemoFirebase(() => firestore ? collection(firestore, 'cascaded_kpis') : null, [firestore]);
  const { data: cascadedKpis } = useCollection<CascadedKpi>(cascadedKpisQuery);
  
  useEffect(() => {
    const checkUserRole = async () => {
        if(user) {
            try {
                const token = await user.getIdTokenResult();
                setUserRole(token.claims.role as Role || 'Employee');
            } catch (error) {
                console.error("Error fetching user claims", error);
                setUserRole('Employee');
            }
        } else {
            setUserRole(null);
        }
    }
    if (!isUserLoading) {
        checkUserRole();
    }
  }, [user, isUserLoading]);

  const individualKpisQuery = useMemoFirebase(() => firestore ? collection(firestore, 'individual_kpis') : null, [firestore]);
  const { data: individualKpis } = useCollection<IndividualKpi>(individualKpisQuery);

  const [isCascadeModalOpen, setIsCascadeModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMonthlyDeployOpen, setIsMonthlyDeployOpen] = useState(false);
  
  const [selectedKpi, setSelectedKpi] = useState<CorporateKpi | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<WithId<Employee> | null>(null);
  
  const [selectedKpis, setSelectedKpis] = useState<CascadedKpiSelection>({});
  const [committedKpis, setCommittedKpis] = useState<CommittedKpiDraft[]>([]);

  useEffect(() => {
    setPageTitle('Cascade KPI');
  }, [setPageTitle]);

  const departments = orgData ? [...new Set(orgData.map(e => e.department))] : [];

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

  const handleAssignKpiClick = (employee: WithId<Employee>) => {
    setSelectedEmployee(employee);
    
    const assignedCascaded = (individualKpis || []).filter(ik => ik.employeeId === employee.id && ik.type === 'cascaded');
    const assignedCommitted = (individualKpis || []).filter(ik => ik.employeeId === employee.id && ik.type === 'committed');

    const initialSelected: CascadedKpiSelection = {};
    assignedCascaded.forEach(kpi => {
        if(kpi.type === 'cascaded') {
            initialSelected[kpi.kpiId] = { selected: true, weight: String(kpi.weight), target: kpi.target };
        }
    });

    const initialCommitted: CommittedKpiDraft[] = assignedCommitted.map((kpi, index) => {
        if(kpi.type === 'committed') {
            return {
                id: Date.now() + index,
                task: kpi.task,
                kpiMeasure: kpi.kpiMeasure,
                weight: String(kpi.weight),
                targets: kpi.targets
            }
        }
        return null;
    }).filter((kpi): kpi is CommittedKpiDraft => kpi !== null);

    setSelectedKpis(initialSelected);
    setCommittedKpis(initialCommitted);
    setIsAssignModalOpen(true);
  };
  
  const handleEditIndividualKpi = (kpi: WithId<IndividualKpi>) => {
    const employee = orgData?.find(e => e.id === kpi.employeeId);
    if (employee) {
        handleAssignKpiClick(employee);
    }
  }
  
  const handleDeleteIndividualKpi = (kpiId: string) => {
      if (!user) {
          toast({ title: "Authentication Required", description: "Please log in to delete KPIs.", variant: 'destructive' });
          return;
      }
      if (!firestore) return;
      const kpiRef = doc(firestore, 'individual_kpis', kpiId);
      deleteDocumentNonBlocking(kpiRef);
      toast({ title: "Assigned KPI Deleted", description: "The KPI has been removed from the individual's portfolio."});
  }

  const handleConfirmMonthlyDeploy = async (distributions: MonthlyDistribution[], strategy: DistributionStrategy, year: number) => {
    if (!user || !firestore || !selectedKpi) {
      toast({ title: "Authentication Required", description: "Please log in to deploy KPIs.", variant: 'destructive' });
      return;
    }

    try {
      const monthlyKpisCollection = collection(firestore, 'monthly_kpis');
      for (const month of distributions) {
        const monthlyKpi: Omit<MonthlyKpi, 'id' | 'createdAt'> = {
          parentKpiId: selectedKpi.id,
          measure: selectedKpi.measure,
          perspective: selectedKpi.perspective || '',
          category: selectedKpi.category || '',
          year: year,
          month: month.month,
          target: month.target,
          actual: 0,
          progress: 0,
          percentage: month.percentage,
          unit: selectedKpi.unit || '',
          status: 'Active',
          distributionStrategy: strategy,
          createdBy: user.uid
        };
        await addDocumentNonBlocking(monthlyKpisCollection, monthlyKpi);
      }

      toast({ 
        title: "KPI Deployed Successfully! 🎉", 
        description: `"${selectedKpi.measure}" has been deployed to 12 monthly targets for ${year}.`,
        duration: 5000
      });

    } catch (error) {
      console.error('Error deploying monthly KPIs:', error);
      toast({ title: "Deployment Failed", description: "An error occurred while deploying KPIs.", variant: 'destructive' });
    }
  };

  const handleConfirmCascade = (cascadedKpi: Omit<CascadedKpi, 'id'>) => {
      if (!user) {
          toast({ title: "Authentication Required", description: "Please log in to cascade KPIs.", variant: 'destructive' });
          return;
      }
      if (!firestore) return;
      const cascadedKpisCollection = collection(firestore, 'cascaded_kpis');
      addDocumentNonBlocking(cascadedKpisCollection, cascadedKpi);
      toast({ title: "KPI Cascaded", description: `"${cascadedKpi.measure}" has been cascaded.` });
  };

  const handleConfirmAssignment = async (assignments: Omit<IndividualKpi, 'status'>[]) => {
      if (!user) {
          toast({ title: "Authentication Required", description: "Please log in to assign KPIs.", variant: 'destructive' });
          return;
      }
      if (!firestore || !selectedEmployee) return;
      
      const individualKpisCollection = collection(firestore, 'individual_kpis');
      const existingAssignments = (individualKpis || []).filter(ik => ik.employeeId === selectedEmployee.id);
      
      existingAssignments.forEach(assignment => {
        const docRef = doc(firestore, 'individual_kpis', assignment.id);
        deleteDocumentNonBlocking(docRef);
      });

      assignments.forEach(assignment => {
        const finalAssignment: Omit<IndividualKpi, 'id'> = {
            ...assignment,
            status: 'Draft' // Set initial status to Draft as per SRS
        };
        addDocumentNonBlocking(individualKpisCollection, finalAssignment);
      });
      
      toast({ title: "KPIs Assigned", description: `${assignments.length} KPI(s) have been assigned to ${selectedEmployee.name}.` });
  };

  const handleConfirmEdit = (editedKpi: Kpi) => {
    if (!user) {
        toast({ title: "Authentication Required", description: "Please log in to edit KPIs.", variant: 'destructive' });
        return;
    }
    if (!firestore) return;
    const kpiRef = doc(firestore, 'kpi_catalog', editedKpi.id);
    setDocumentNonBlocking(kpiRef, editedKpi, { merge: true });
    toast({ title: "KPI Updated", description: `"${editedKpi.measure}" has been updated.` });
  }

  const handleDelete = (kpiId: string) => {
    if (!user) {
        toast({ title: "Authentication Required", description: "Please log in to delete KPIs.", variant: 'destructive' });
        return;
    }
    if (!firestore) return;
    const kpiRef = doc(firestore, 'kpi_catalog', kpiId);
    deleteDocumentNonBlocking(kpiRef);
    toast({ title: "KPI Deleted", description: `The KPI has been removed from the catalog.`, variant: 'destructive' });
  }
  
  const handleCloseAssignDialog = () => {
    setIsAssignModalOpen(false);
    setSelectedEmployee(null);
    setSelectedKpis({});
    setCommittedKpis([]);
  }

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
      
      {(isUserLoading) ? (
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
                onDeleteClick={handleDelete} 
                userRole={userRole} 
              />
            </TabsContent>
            <TabsContent value="department" className="mt-6">
              <DepartmentLevel />
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
        onClose={handleCloseAssignDialog}
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

    

    




