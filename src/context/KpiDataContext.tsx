
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
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

// Type for a cascaded KPI in a department
export interface CascadedKpi {
  corporateKpiId: string;
  measure: string;
  department: string;
  weight: number;
  departmentTarget: string;
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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
        if (user) {
            try {
                const idTokenResult = await user.getIdTokenResult();
                setIsAdmin(idTokenResult.claims.role === 'Admin');
            } catch (error) {
                console.error("Error fetching user claims:", error);
                setIsAdmin(false);
            }
        } else {
           setIsAdmin(false);
        }
    };
    if (!isAuthLoading) {
        checkAdminStatus();
    }
  }, [user, isAuthLoading]);

  // IMPORTANT: Only admins should be able to query these global collections
  const kpiQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return collection(firestore, 'kpi_catalog');
  }, [firestore, isAdmin]);
  const { data: kpiData, isLoading: isKpiDataLoading } = useCollection<Kpi>(kpiQuery);

  const orgQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return collection(firestore, 'employees');
  }, [firestore, isAdmin]);
  const { data: orgData, isLoading: isOrgDataLoading } = useCollection<Employee>(orgQuery);
  
  const cascadedKpisQuery = useMemoFirebase(() => {
      if (!firestore || !isAdmin) return null;
      return collection(firestore, 'cascaded_kpis');
  }, [firestore, isAdmin]);
  const { data: cascadedKpis, isLoading: isCascadedKpisLoading } = useCollection<CascadedKpi>(cascadedKpisQuery);
  
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
    } else if (!isSettingsLoading) {
      // If not loading and no data, fallback to default.
      setLocalSettings(defaultSettings);
    }
  }, [settingsData, isSettingsLoading]);


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
    isKpiDataLoading: isLoading || (isAdmin ? isKpiDataLoading : false),
    orgData,
    isOrgDataLoading: isLoading || (isAdmin ? isOrgDataLoading : false),
    cascadedKpis,
    isCascadedKpisLoading: isLoading || (isAdmin ? isCascadedKpisLoading : false),
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
