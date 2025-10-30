
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { WithId } from '@/firebase/firestore/use-collection';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

// Define the shape of your KPI data based on the JSON structure
export interface Kpi {
  id: string;
  perspective: string;
  measure: string;
  target: string | number;
  unit: string;
  category: string;
}

// Define the shape for an Employee
export interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
  manager: string;
  userId?: string; // Link to auth user
}

export interface AppSettings {
  orgName: string;
  period: string;
  currency: string;
  periodDate?: string;
}

// Type for a cascaded KPI in a department
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

// Type for a monthly deployed KPI
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

const defaultSettings: AppSettings = {
    orgName: 'บริษัท ABC จำกัด (เริ่มต้น)',
    period: 'รายไตรมาส (Quarterly)',
    currency: 'thb',
};


// Define the context shape
interface KpiDataContextType {
  kpiData: WithId<Kpi>[] | null;
  isKpiDataLoading: boolean;
  orgData: WithId<Employee>[] | null;
  isOrgDataLoading: boolean;
  cascadedKpis: WithId<CascadedKpi>[] | null;
  isCascadedKpisLoading: boolean;
  monthlyKpisData: WithId<MonthlyKpi>[] | null;
  isMonthlyKpisLoading: boolean;
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;
  isSettingsLoading: boolean;
}

// Create the context
const KpiDataContext = createContext<KpiDataContextType | undefined>(undefined);

// Create the provider component
export const KpiDataProvider = ({ children }: { children: ReactNode }) => {
  const firestore = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();

  // Queries are now dependent on having a logged-in user.
  // Firestore security rules will enforce admin-only access on the backend.
  const kpiQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'kpi_catalog');
  }, [firestore, user]);
  const { data: kpiData, isLoading: isKpiDataLoading } = useCollection<Kpi>(kpiQuery);

  const orgQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'employees');
  }, [firestore, user]);
  const { data: orgData, isLoading: isOrgDataLoading } = useCollection<Employee>(orgQuery);
  
  const cascadedKpisQuery = useMemoFirebase(() => {
      if (!firestore || !user) return null;
      return collection(firestore, 'cascaded_kpis');
  }, [firestore, user]);
  const { data: cascadedKpis, isLoading: isCascadedKpisLoading } = useCollection<CascadedKpi>(cascadedKpisQuery);
  
  const monthlyKpisQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    const currentYear = new Date().getFullYear();
    return query(collection(firestore, 'monthly_kpis'), where('year', '==', currentYear));
  }, [firestore, user]);
  const { data: monthlyKpisData, isLoading: isMonthlyKpisLoading } = useCollection<MonthlyKpi>(monthlyKpisQuery);

  // Settings should be readable by any authenticated user.
  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null; // Only fetch if user is logged in.
    return doc(firestore, 'settings', 'global');
  }, [firestore, user]);
  
  const { data: settingsData, isLoading: isSettingsLoading } = useDoc<AppSettings>(settingsDocRef);
  
  const [localSettings, setLocalSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    if (settingsData) {
      setLocalSettings(settingsData);
    } else if (!isSettingsLoading && !user) {
      // If not loading and no user, fallback to default.
      setLocalSettings(defaultSettings);
    }
  }, [settingsData, isSettingsLoading, user]);


  const setSettings = (newSettings: Partial<AppSettings>) => {
    if (settingsDocRef) {
        const updatedSettings = { ...localSettings, ...newSettings };
        setLocalSettings(updatedSettings); // Optimistic update
        setDocumentNonBlocking(settingsDocRef, updatedSettings, { merge: true });
    }
  };
  
  const isLoading = isAuthLoading || isSettingsLoading;

  const contextValue = {
    kpiData,
    isKpiDataLoading: isLoading || isKpiDataLoading,
    orgData,
    isOrgDataLoading: isLoading || isOrgDataLoading,
    cascadedKpis,
    isCascadedKpisLoading: isLoading || isCascadedKpisLoading,
    monthlyKpisData,
    isMonthlyKpisLoading: isLoading || isMonthlyKpisLoading,
    settings: localSettings,
    setSettings,
    isSettingsLoading: isLoading,
  };


  return (
    <KpiDataContext.Provider value={contextValue}>
      {children}
    </KpiDataContext.Provider>
  );
};

// Create a custom hook for using the context
export const useKpiData = () => {
  const context = useContext(KpiDataContext);
  if (context === undefined) {
    throw new Error('useKpiData must be used within a KpiDataProvider');
  }
  return context;
};
