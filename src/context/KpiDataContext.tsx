
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { WithId } from '@/firebase/firestore/use-collection';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

// Define the shape of your KPI data based on the JSON structure
export interface Kpi {
  id: string;
  perspective: string;
  strategic_objective: string;
  measure: string;
  target: string;
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


// Define the context shape
interface KpiDataContextType {
  kpiData: WithId<Kpi>[] | null;
  isKpiDataLoading: boolean;
  orgData: WithId<Employee>[] | null;
  isOrgDataLoading: boolean;
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;
  isSettingsLoading: boolean;
}

// Create the context
const KpiDataContext = createContext<KpiDataContextType | undefined>(undefined);

// Create the provider component
export const KpiDataProvider = ({ children }: { children: ReactNode }) => {
  const firestore = useFirestore();
  const { user } = useUser();

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
  
  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'global');
  }, [firestore]);
  
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

  const contextValue = {
    kpiData,
    isKpiDataLoading,
    orgData,
    isOrgDataLoading,
    settings: localSettings,
    setSettings,
    isSettingsLoading,
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
