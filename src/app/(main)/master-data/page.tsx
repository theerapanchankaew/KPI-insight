
"use client";

import React, { useEffect, useState } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building, Briefcase, Users, User, BookUser, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { writeBatch, collection, doc } from 'firebase/firestore';
import type { Kpi, Department, Position, Employee } from '@/context/KpiDataContext';


const KpiCatalogImport = () => {
    const [jsonInput, setJsonInput] = useState(`{
  "kpi_catalog": [
    {
      "id": "1bf13fca-25c4-4a04-8390-8b2173a2ffda",
      "perspective": "Sustainability",
      "strategic_objective": "Grow Corporate Value",
      "objective_statement": "การเติบโตอย่างยั่งยืน โดยการขยายฐานรายได้จากบริการ/ธุรกิจเดิม และบริการ/ธุรกิจใหม่ ตามเป้าหมายของสถาบันฯ",
      "measure": "Total Revenue",
      "target": "≥ 194.10 ล้านบาท",
      "unit": "THB million",
      "target_statement": "รายรับรวมของสถาบันฯ อย่างน้อย ≥ 194.10 ล้านบาท โดยคิดเป็นผลรวมสะสมของทั้งปีงบประมาณ",
      "category": "Theme:Sustainability Excellence"
    }
  ]
}`);
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isImporting, setIsImporting] = useState(false);

    const handleImport = async () => {
        if (!firestore) {
            toast({ title: "Error", description: "You must be logged in to import data.", variant: "destructive" });
            return;
        }

        setIsImporting(true);
        try {
            const data = JSON.parse(jsonInput);
            if (!data.kpi_catalog || !Array.isArray(data.kpi_catalog)) {
                throw new Error("Invalid JSON format: 'kpi_catalog' array not found.");
            }

            const kpis: Kpi[] = data.kpi_catalog;
            const batch = writeBatch(firestore);
            const kpiCollectionRef = collection(firestore, 'kpi_catalog');

            kpis.forEach(kpi => {
                const docRef = doc(kpiCollectionRef, kpi.id);
                batch.set(docRef, kpi);
            });

            await batch.commit();

            toast({
                title: "Import Successful",
                description: `${kpis.length} KPIs have been imported into the catalog.`,
            });

        } catch (error: any) {
            toast({
                title: "Import Failed",
                description: error.message || "Please check the JSON format and try again.",
                variant: "destructive",
            });
        } finally {
            setIsImporting(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <p className="text-muted-foreground">
                Paste your organization's KPI catalog JSON below. The structure should contain a `kpi_catalog` array.
                Each object in the array will be imported as a separate KPI document into the `kpi_catalog` collection.
            </p>
            <Textarea 
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                rows={15}
                placeholder="Paste your JSON here..."
                className="font-mono text-xs"
            />
            <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? "Importing..." : "Import KPI Catalog"}
            </Button>
        </div>
    )
};

const DepartmentImport = () => {
    const [jsonInput, setJsonInput] = useState(`{
  "departments": [
    {
      "id": "EXEC",
      "name": "Executive",
      "nameTH": "ฝ่ายบริหาร",
      "parentDepartmentId": null,
      "headOfDepartmentId": "emp-001"
    },
    {
      "id": "SALES",
      "name": "Sales",
      "nameTH": "ฝ่ายขาย",
      "parentDepartmentId": "EXEC",
      "headOfDepartmentId": "emp-002"
    }
  ]
}`);
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isImporting, setIsImporting] = useState(false);

    const handleImport = async () => {
        if (!firestore) {
            toast({ title: "Error", description: "You must be logged in to import data.", variant: "destructive" });
            return;
        }

        setIsImporting(true);
        try {
            const data = JSON.parse(jsonInput);
            if (!data.departments || !Array.isArray(data.departments)) {
                throw new Error("Invalid JSON format: 'departments' array not found.");
            }

            const departments: Department[] = data.departments;
            const batch = writeBatch(firestore);
            const deptCollectionRef = collection(firestore, 'departments');

            departments.forEach(dept => {
                const docRef = doc(deptCollectionRef, dept.id);
                batch.set(docRef, dept);
            });

            await batch.commit();

            toast({
                title: "Import Successful",
                description: `${departments.length} departments have been imported.`,
            });

        } catch (error: any) {
            toast({
                title: "Import Failed",
                description: error.message || "Please check the JSON format and try again.",
                variant: "destructive",
            });
        } finally {
            setIsImporting(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <p className="text-muted-foreground">
                Paste your organization's department structure JSON below. Ensure each department has a unique `id`.
            </p>
            <Textarea 
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                rows={15}
                placeholder="Paste your JSON here..."
                className="font-mono text-xs"
            />
            <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? "Importing..." : "Import Departments"}
            </Button>
        </div>
    )
};

const PositionImport = () => {
    const [jsonInput, setJsonInput] = useState(`{
  "positions": [
    {
      "id": "ceo",
      "name": "Chief Executive Officer",
      "nameTH": "ประธานเจ้าหน้าที่บริหาร",
      "level": 10,
      "category": "management",
      "defaultRoles": ["Admin", "Manager"]
    },
    {
      "id": "sales-mgr",
      "name": "Sales Manager",
      "nameTH": "ผู้จัดการฝ่ายขาย",
      "level": 8,
      "category": "management",
      "defaultRoles": ["Manager"]
    },
    {
      "id": "sales-rep",
      "name": "Sales Representative",
      "nameTH": "ตัวแทนฝ่ายขาย",
      "level": 5,
      "category": "staff",
      "defaultRoles": ["Employee"]
    }
  ]
}`);
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isImporting, setIsImporting] = useState(false);

    const handleImport = async () => {
        if (!firestore) {
            toast({ title: "Error", description: "You must be logged in to import data.", variant: "destructive" });
            return;
        }

        setIsImporting(true);
        try {
            const data = JSON.parse(jsonInput);
            if (!data.positions || !Array.isArray(data.positions)) {
                throw new Error("Invalid JSON format: 'positions' array not found.");
            }

            const positions: Position[] = data.positions;
            const batch = writeBatch(firestore);
            const posCollectionRef = collection(firestore, 'positions');

            positions.forEach(pos => {
                const docRef = doc(posCollectionRef, pos.id);
                batch.set(docRef, pos);
            });

            await batch.commit();

            toast({
                title: "Import Successful",
                description: `${positions.length} positions have been imported.`,
            });

        } catch (error: any) {
            toast({
                title: "Import Failed",
                description: error.message || "Please check the JSON format and try again.",
                variant: "destructive",
            });
        } finally {
            setIsImporting(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <p className="text-muted-foreground">
                Paste your organization's positions JSON below. Ensure each position has a unique `id`.
            </p>
            <Textarea 
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                rows={15}
                placeholder="Paste your JSON here..."
                className="font-mono text-xs"
            />
            <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? "Importing..." : "Import Positions"}
            </Button>
        </div>
    )
};

const EmployeeImport = () => {
    const [jsonInput, setJsonInput] = useState(`{
  "employees": [
    {
      "id": "emp-001",
      "name": "สมชาย ใจดี",
      "email": "somchai.jaidee@example.com",
      "departmentId": "EXEC",
      "positionId": "ceo",
      "managerId": "",
      "level": 10,
      "status": "active"
    }
  ]
}`);
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isImporting, setIsImporting] = useState(false);

    const handleImport = async () => {
        if (!firestore) {
            toast({ title: "Error", description: "You must be logged in to import data.", variant: "destructive" });
            return;
        }

        setIsImporting(true);
        try {
            const data = JSON.parse(jsonInput);
            if (!data.employees || !Array.isArray(data.employees)) {
                throw new Error("Invalid JSON format: 'employees' array not found.");
            }

            const employees: Employee[] = data.employees;
            const batch = writeBatch(firestore);
            const empCollectionRef = collection(firestore, 'employees');

            employees.forEach(emp => {
                const docRef = doc(empCollectionRef, emp.id);
                batch.set(docRef, emp);
            });

            await batch.commit();

            toast({
                title: "Import Successful",
                description: `${employees.length} employees have been imported.`,
            });

        } catch (error: any) {
            toast({
                title: "Import Failed",
                description: error.message || "Please check the JSON format and try again.",
                variant: "destructive",
            });
        } finally {
            setIsImporting(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <p className="text-muted-foreground">
                Paste your employee master data JSON below. The `id` for each employee should be unique. For system users, this `id` should match their Firebase Authentication UID.
            </p>
            <Textarea 
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                rows={15}
                placeholder="Paste your JSON here..."
                className="font-mono text-xs"
            />
            <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? "Importing..." : "Import Employees"}
            </Button>
        </div>
    )
};


const MasterDataItem = ({ title, description, icon: Icon }: { title: string, description: string, icon: React.ElementType }) => (
    <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
        <Icon className="w-16 h-16 text-gray-300 mb-4" />
        <h4 className="text-lg font-semibold">{title}</h4>
        <p className="text-muted-foreground">{description}</p>
    </div>
);

export default function MasterDataPage() {
  const { setPageTitle } = useAppLayout();

  useEffect(() => {
    setPageTitle('Master Data');
  }, [setPageTitle]);

  return (
    <div className="fade-in space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Master Data Management</CardTitle>
          <CardDescription>
            This is the central place to manage your organization's core data entities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="kpi-catalog" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="kpi-catalog">
                <Library className="w-4 h-4 mr-2" />
                KPI Catalog
              </TabsTrigger>
              <TabsTrigger value="departments">
                <Building className="w-4 h-4 mr-2" />
                Departments
              </TabsTrigger>
              <TabsTrigger value="positions">
                <Briefcase className="w-4 h-4 mr-2" />
                Positions
              </TabsTrigger>
              <TabsTrigger value="roles">
                <Users className="w-4 h-4 mr-2" />
                Roles
              </TabsTrigger>
              <TabsTrigger value="employees">
                <BookUser className="w-4 h-4 mr-2" />
                Employees
              </TabsTrigger>
            </TabsList>
            <TabsContent value="kpi-catalog" className="mt-6">
                <KpiCatalogImport />
            </TabsContent>
            <TabsContent value="departments" className="mt-6">
                <DepartmentImport />
            </TabsContent>
            <TabsContent value="positions" className="mt-6">
                 <PositionImport />
            </TabsContent>
            <TabsContent value="roles" className="mt-4">
                 <MasterDataItem 
                    title="Roles" 
                    description="Role and permission management features will be implemented here." 
                    icon={Users} 
                />
            </TabsContent>
            <TabsContent value="employees" className="mt-6">
                 <EmployeeImport />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
