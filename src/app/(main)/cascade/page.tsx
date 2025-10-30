
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
import { ChevronDown, ChevronRight, Share2, Edit, Trash2 } from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase, WithId } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

// ==================== TYPE DEFINITIONS ====================
import type { Employee, Kpi as CorporateKpi, CascadedKpi, MonthlyKpi, IndividualKpi } from '@/context/KpiDataContext';

// ==================== UTILITY FUNCTIONS ====================
const parseValue = (value: string | number) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;
    return parseFloat(value.replace(/[^0-9.-]+/g, "")) || 0;
};

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
    monthlyKpis 
}: { 
    kpi: WithId<CascadedKpi>, 
    individualKpis: WithId<IndividualKpi>[], 
    employees: Map<string, WithId<Employee>>,
    monthlyKpis: WithId<MonthlyKpi>[]
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
            <TableRow className="bg-blue-50 hover:bg-blue-100/60" onClick={() => setIsOpen(!isOpen)}>
                <TableCell className="pl-12 py-3 cursor-pointer">
                    <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="font-semibold text-blue-900">{kpi.department}</span>
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
    monthlyKpis 
}: { 
    kpi: WithId<CorporateKpi>, 
    cascadedKpis: WithId<CascadedKpi>[], 
    individualKpis: WithId<IndividualKpi>[], 
    employees: Map<string, WithId<Employee>>,
    monthlyKpis: WithId<MonthlyKpi>[]
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
            <TableRow className="border-b-2 border-gray-300 hover:bg-gray-50" onClick={() => setIsOpen(!isOpen)}>
                <TableCell className="font-bold text-gray-900 py-4 cursor-pointer">
                    <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        {kpi.measure}
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
                            />
                       ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-sm text-gray-500 py-4 pl-12">
                                This KPI has not been cascaded to any departments yet.
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

  const isLoading = isKpiDataLoading || isCascadedKpisLoading || isOrgDataLoading || isIndividualKpisLoading || isMonthlyKpisLoading;

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
          />
        ))}
      </TableBody>
    );
  };

  return (
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
  );
}
