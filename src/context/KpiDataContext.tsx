
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { WithId } from '@/firebase/firestore/use-collection';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { getIdTokenResult } from 'firebase/auth';

// ==================== NORMALIZED ENTITY TYPES ====================

export interface Employee {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  positionId: string;
  managerId: string;
  level: number;
  status: 'active' | 'inactive' | 'resigned';
}

export interface User {
  id: string;
  employeeId: string;
  email: string;
  roles: string[]; // Array of role codes
  menuAccess: { [key: string]: boolean };
  permissions: { [key: string]: boolean };
}

export interface Department {
  id: string;
  name: string;
  nameTH: string;
  parentDepartmentId: string;
  headOfDepartmentId: string;
}

export interface Position {
  id: string;
  name: string;
  nameTH: string;
  level: number;
  category: 'management' | 'specialist' | 'staff';
  defaultRoles: string[];
}

export interface Role {
  id: string;
  code: string;
  name: string;
  defaultPermissions: { [key: string]: boolean };
  menuAccess: { [key: string]: boolean };
}

export interface Kpi {
  id: string;
  perspective: string;
  measure: string;
  target: string | number;
  unit: string;
  category: string;
}

export interface CascadedKpi {
  id: string;
  corporateKpiId: string;
  measure: string;
  department: string;
  weight: number;
  target: string;
  category?: string;
  unit?: string;
}

export interface MonthlyKpi {
  id: string;
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

interface IndividualKpiBase {
  employeeId: string;
  kpiMeasure: string;
  weight: number;
  status: 'Draft' | 'Agreed' | 'In-Progress' | 'Manager Review' | 'Upper Manager Approval' | 'Employee Acknowledged' | 'Closed' | 'Rejected';
  notes?: string;
  employeeNotes?: string;
  managerNotes?: string;
  rejectionReason?: string;
  agreedAt?: any;
  reviewedAt?: any;
  acknowledgedAt?: any;
}
interface AssignedCascadedKpi extends IndividualKpiBase { type: 'cascaded'; target: string; unit: string; corporateKpiId: string; }
interface CommittedKpi extends IndividualKpiBase { type: 'committed'; task: string; targets: { [key: string]: string }; }
export type IndividualKpi = (AssignedCascadedKpi | CommittedKpi);


export interface KpiSubmission {
    id: string;
    kpiId: string;
    submittedBy: string;
    actualValue: string;
    notes: string;
    submissionDate: any;
    status: 'Manager Review' | 'Upper Manager Approval' | 'Closed' | 'Rejected';
}

export interface AppSettings {
  orgName: string;
  period: string;
  currency: string;
  periodDate?: string;
}


const defaultSettings: AppSettings = {
    orgName: 'บริษัท ABC จำกัด (เริ่มต้น)',
    period: 'รายไตรมาส (Quarterly)',
    currency: 'thb',
};

// ==================== CONTEXT SHAPE ====================

interface KpiDataContextType {
  employees: WithId<Employee>[] | null;
  isEmployeesLoading: boolean;
  departments: WithId<Department>[] | null;
  isDepartmentsLoading: boolean;
  positions: WithId<Position>[] | null;
  isPositionsLoading: boolean;
  roles: WithId<Role>[] | null;
  isRolesLoading: boolean;
  
  kpiData: WithId<Kpi>[] | null;
  isKpiDataLoading: boolean;
  cascadedKpis: WithId<CascadedKpi>[] | null;
  isCascadedKpisLoading: boolean;
  monthlyKpisData: WithId<MonthlyKpi>[] | null;
  isMonthlyKpisLoading: boolean;
  individualKpis: WithId<IndividualKpi>[] | null;
  isIndividualKpisLoading: boolean;


  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;
  isSettingsLoading: boolean;

  isManagerOrAdmin: boolean;
  isRoleLoading: boolean;
}

// ==================== CONTEXT DEFINITION ====================

const KpiDataContext = createContext<KpiDataContextType | undefined>(undefined);

// ==================== PROVIDER COMPONENT ====================

export const KpiDataProvider = ({ children }: { children: ReactNode }) => {
  const firestore = useFirestore();
  const { user } = useUser();

  const [isManagerOrAdmin, setIsManagerOrAdmin] = useState(false);
  const [isRoleLoading, setIsRoleLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setIsRoleLoading(true);
      getIdTokenResult(user, true) // Force refresh the token to get the latest claims
        .then((idTokenResult) => {
          const userRole = idTokenResult.claims.role as string;
          // Standardize the check to be case-insensitive for robustness
          const role = userRole?.toLowerCase();
          setIsManagerOrAdmin(['admin', 'vp', 'avp', 'manager'].includes(role));
          setIsRoleLoading(false);
        })
        .catch(() => {
          setIsManagerOrAdmin(false);
          setIsRoleLoading(false);
        });
    } else {
      setIsManagerOrAdmin(false);
      setIsRoleLoading(false);
    }
  }, [user]);

  // Master Data Queries
  const employeesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'employees') : null, [firestore]);
  const { data: employees, isLoading: isEmployeesLoading } = useCollection<Employee>(employeesQuery);

  const departmentsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'departments') : null, [firestore]);
  const { data: departments, isLoading: isDepartmentsLoading } = useCollection<Department>(departmentsQuery);

  const positionsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'positions') : null, [firestore]);
  const { data: positions, isLoading: isPositionsLoading } = useCollection<Position>(positionsQuery);
  
  const rolesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'roles') : null, [firestore]);
  const { data: roles, isLoading: isRolesLoading } = useCollection<Role>(rolesQuery);

  // Transactional Data Queries
  const kpiQuery = useMemoFirebase(() => firestore ? collection(firestore, 'kpi_catalog') : null, [firestore]);
  const { data: kpiData, isLoading: isKpiDataLoading } = useCollection<Kpi>(kpiQuery);

  const cascadedKpisQuery = useMemoFirebase(() => firestore ? collection(firestore, 'cascaded_kpis') : null, [firestore]);
  const { data: cascadedKpis, isLoading: isCascadedKpisLoading } = useCollection<CascadedKpi>(cascadedKpisQuery);
  
  const monthlyKpisQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const today = new Date();
    const currentYear = today.getFullYear();
    const fiscalYearStartYear = today.getMonth() >= 9 ? currentYear : currentYear - 1;
    return query(collection(firestore, 'monthly_kpis'), where('year', 'in', [fiscalYearStartYear, fiscalYearStartYear + 1]));
  }, [firestore]);
  const { data: monthlyKpisData, isLoading: isMonthlyKpisLoading } = useCollection<MonthlyKpi>(monthlyKpisQuery);

  const individualKpisQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'individual_kpis');
  }, [firestore, user]);

  const { data: individualKpis, isLoading: isIndividualKpisLoading } = useCollection<WithId<IndividualKpi>>(individualKpisQuery);

  // Settings
  const settingsDocRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, 'settings', 'global') : null, [firestore, user]);
  const { data: settingsData, isLoading: isSettingsLoading } = useDoc<AppSettings>(settingsDocRef);

  const [localSettings, setLocalSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    if (settingsData) {
      setLocalSettings(settingsData);
    }
  }, [settingsData]);


  const setSettings = (newSettings: Partial<AppSettings>) => {
    if (settingsDocRef) {
        const updatedSettings = { ...localSettings, ...newSettings };
        setLocalSettings(updatedSettings); // Optimistic update
        setDocumentNonBlocking(settingsDocRef, updatedSettings, { merge: true });
    }
  };
  
  const isLoading = isEmployeesLoading || isDepartmentsLoading || isPositionsLoading || isRolesLoading;

  const contextValue: KpiDataContextType = {
    employees, isEmployeesLoading: isLoading,
    departments, isDepartmentsLoading: isLoading,
    positions, isPositionsLoading: isLoading,
    roles, isRolesLoading: isLoading,

    kpiData, isKpiDataLoading,
    cascadedKpis, isCascadedKpisLoading,
    monthlyKpisData, isMonthlyKpisLoading,
    individualKpis, isIndividualKpisLoading,
    
    settings: localSettings,
    setSettings,
    isSettingsLoading: isSettingsLoading,

    isManagerOrAdmin,
    isRoleLoading,
  };


  return (
    <KpiDataContext.Provider value={contextValue}>
      {children}
    </KpiDataContext.Provider>
  );
};

// ==================== HOOK ====================

export const useKpiData = () => {
  const context = useContext(KpiDataContext);
  if (context === undefined) {
    throw new Error('useKpiData must be used within a KpiDataProvider');
  }
  return context;
};

    