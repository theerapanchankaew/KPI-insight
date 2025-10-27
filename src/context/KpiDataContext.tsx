
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { WithId }from '@/firebase/firestore/use-collection';

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

// Define the shape for the organization data
export interface OrgData {
  employees: WithId<Employee>[];
}

export interface AppSettings {
  orgName: string;
  period: string;
  currency: string;
  periodDate?: string;
}

// Define the context shape
interface KpiDataContextType {
  kpiData: WithId<Kpi>[] | null;
  isKpiDataLoading: boolean;
  orgData: WithId<Employee>[] | null;
  isOrgDataLoading: boolean;
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;
}

// Create the context
const KpiDataContext = createContext<KpiDataContextType | undefined>(undefined);

// Create the provider component
export const KpiDataProvider = ({ children }: { children: ReactNode }) => {
  const firestore = useFirestore();

  const kpiQuery = useMemoFirebase(() => firestore ? collection(firestore, 'kpi_catalog') : null, [firestore]);
  const { data: kpiData, isLoading: isKpiDataLoading } = useCollection<Kpi>(kpiQuery);

  const orgQuery = useMemoFirebase(() => firestore ? collection(firestore, 'employees') : null, [firestore]);
  const { data: orgData, isLoading: isOrgDataLoading } = useCollection<Employee>(orgQuery);

  const [settings, setSettingsState] = useState<AppSettings>({
    orgName: 'บริษัท ABC จำกัด',
    period: 'รายไตรมาส (Quarterly)',
    currency: 'thb',
  });

  const setSettings = (newSettings: Partial<AppSettings>) => {
    setSettingsState(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <KpiDataContext.Provider value={{ kpiData, isKpiDataLoading, orgData, isOrgDataLoading, settings, setSettings }}>
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
