"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the shape of your KPI data based on the JSON structure
interface Kpi {
  id: string;
  perspective: string;
  strategic_objective: string;
  measure: string;
  target: string;
  unit: string;
  category: string;
}

interface KpiData {
  version: string;
  organization: string;
  kpi_catalog: Kpi[];
}

// Define the shape for an Employee
interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
  manager: string;
}

// Define the shape for the organization data
interface OrgData {
  employees: Employee[];
}

interface AppSettings {
  orgName: string;
  period: string;
  currency: string;
}


// Define the context shape
interface KpiDataContextType {
  kpiData: KpiData | null;
  setKpiData: (data: KpiData) => void;
  orgData: OrgData | null;
  setOrgData: (data: OrgData) => void;
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;
}

// Create the context
const KpiDataContext = createContext<KpiDataContextType | undefined>(undefined);

// Create the provider component
export const KpiDataProvider = ({ children }: { children: ReactNode }) => {
  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  const [orgData, setOrgData] = useState<OrgData | null>(null);
  const [settings, setSettingsState] = useState<AppSettings>({
    orgName: 'บริษัท ABC จำกัด',
    period: 'Quarterly',
    currency: 'thb',
  });

  const setSettings = (newSettings: Partial<AppSettings>) => {
    setSettingsState(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <KpiDataContext.Provider value={{ kpiData, setKpiData, orgData, setOrgData, settings, setSettings }}>
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
