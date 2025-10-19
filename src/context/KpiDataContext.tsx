"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the shape of your KPI data based on the JSON structure
// This is a simplified version; you can expand it to match the full structure.
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
  // Add other top-level fields from your JSON here
}

// Define the context shape
interface KpiDataContextType {
  kpiData: KpiData | null;
  setKpiData: (data: KpiData) => void;
}

// Create the context
const KpiDataContext = createContext<KpiDataContextType | undefined>(undefined);

// Create the provider component
export const KpiDataProvider = ({ children }: { children: ReactNode }) => {
  const [kpiData, setKpiData] = useState<KpiData | null>(null);

  return (
    <KpiDataContext.Provider value={{ kpiData, setKpiData }}>
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
