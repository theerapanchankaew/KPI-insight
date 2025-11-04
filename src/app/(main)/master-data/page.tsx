
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building, Briefcase, Users, BookUser, Library, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { writeBatch, collection, doc } from 'firebase/firestore';
import type { Kpi, Department, Position, Employee, Role } from '@/context/KpiDataContext';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';


const DataImportSection = ({ 
    title, 
    description, 
    exampleJson, 
    collectionName, 
    dataKey,
    onImport,
    isImporting
}: {
    title: string;
    description: string;
    exampleJson: string;
    collectionName: string;
    dataKey: string;
    onImport: (jsonInput: string, collectionName: string, dataKey: string) => void;
    isImporting: boolean;
}) => {
    const [jsonInput, setJsonInput] = useState(exampleJson);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                setJsonInput(content);
            };
            reader.readAsText(file);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/json': ['.json'] },
        multiple: false,
    });

    return (
        <div className="space-y-6">
            <p className="text-muted-foreground">{description}</p>
            
            <div 
                {...getRootProps()} 
                className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                    isDragActive ? "border-primary bg-primary/10" : "border-gray-300 hover:border-primary/50"
                )}
            >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                {isDragActive ? (
                    <p className="mt-2 text-primary">Drop the file here...</p>
                ) : (
                    <p className="mt-2 text-muted-foreground">Drag 'n' drop a JSON file here, or click to select a file</p>
                )}
            </div>

            <div className="relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-lg">OR</div>
                <div className="border-b"></div>
            </div>

            <Textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                rows={15}
                placeholder="Paste your JSON here..."
                className="font-mono text-xs"
            />
            <Button onClick={() => onImport(jsonInput, collectionName, dataKey)} disabled={isImporting}>
                {isImporting ? "Importing..." : `Import ${title}`}
            </Button>
        </div>
    );
};


export default function MasterDataPage() {
  const { setPageTitle } = useAppLayout();
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isImporting, setIsImporting] = useState<string | null>(null);

  useEffect(() => {
    setPageTitle('Master Data');
  }, [setPageTitle]);

  const handleImport = async (jsonInput: string, collectionName: string, dataKey: string) => {
    if (!firestore) {
        toast({ title: "Error", description: "You must be logged in to import data.", variant: "destructive" });
        return;
    }

    setIsImporting(collectionName);
    try {
        const data = JSON.parse(jsonInput);
        if (!data[dataKey] || !Array.isArray(data[dataKey])) {
            throw new Error(`Invalid JSON format: '${dataKey}' array not found.`);
        }

        const items: any[] = data[dataKey];
        const batch = writeBatch(firestore);
        const collectionRef = collection(firestore, collectionName);

        items.forEach(item => {
            if (!item.id) {
                console.warn("Skipping item without ID:", item);
                return;
            }
            const docRef = doc(collectionRef, item.id);
            batch.set(docRef, item);
        });

        await batch.commit();

        toast({
            title: "Import Successful",
            description: `${items.length} items have been imported into ${collectionName}.`,
        });

    } catch (error: any) {
        toast({
            title: "Import Failed",
            description: error.message || "Please check the JSON format and try again.",
            variant: "destructive",
        });
    } finally {
        setIsImporting(null);
    }
  };


  const kpiCatalogJson = `{
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
}`;

 const departmentJson = `{
  "departments": [
    {
      "id": "EXEC",
      "name": "Executive",
      "nameTH": "ฝ่ายบริหาร",
      "parentDepartmentId": null,
      "headOfDepartmentId": "emp-001"
    }
  ]
}`;

 const positionJson =`{
  "positions": [
    {
      "id": "ceo",
      "name": "Chief Executive Officer",
      "nameTH": "ประธานเจ้าหน้าที่บริหาร",
      "level": 10,
      "category": "management",
      "defaultRoles": ["Admin", "Manager"]
    }
  ]
}`;

const roleJson =`{
  "roles": [
    {
      "id": "admin",
      "code": "Admin",
      "name": "Administrator",
      "menuAccess": {
        "dashboard": true, "cascade": true, "portfolio": true, "submit": true, 
        "approvals": true, "reports": true, "master-data": true, "settings": true
      }
    }
  ]
}`;

const employeeJson = `{
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
}`;

  return (
    <div className="fade-in space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Master Data Management</CardTitle>
          <CardDescription>
            This is the central place to manage your organization's core data entities. Use the tabs below to upload JSON files for each data type.
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
                <DataImportSection 
                    title="KPI Catalog"
                    description="Paste your organization's KPI catalog JSON below. The structure should contain a `kpi_catalog` array."
                    exampleJson={kpiCatalogJson}
                    collectionName="kpi_catalog"
                    dataKey="kpi_catalog"
                    onImport={handleImport}
                    isImporting={isImporting === "kpi_catalog"}
                />
            </TabsContent>
            <TabsContent value="departments" className="mt-6">
                <DataImportSection
                    title="Departments"
                    description="Paste your organization's department structure JSON below. Ensure each department has a unique `id`."
                    exampleJson={departmentJson}
                    collectionName="departments"
                    dataKey="departments"
                    onImport={handleImport}
                    isImporting={isImporting === "departments"}
                />
            </TabsContent>
            <TabsContent value="positions" className="mt-6">
                 <DataImportSection
                    title="Positions"
                    description="Paste your organization's positions JSON below. Ensure each position has a unique `id`."
                    exampleJson={positionJson}
                    collectionName="positions"
                    dataKey="positions"
                    onImport={handleImport}
                    isImporting={isImporting === "positions"}
                 />
            </TabsContent>
            <TabsContent value="roles" className="mt-6">
                 <DataImportSection
                    title="Roles"
                    description="Paste your application roles JSON below. The `id` and `code` should be unique."
                    exampleJson={roleJson}
                    collectionName="roles"
                    dataKey="roles"
                    onImport={handleImport}
                    isImporting={isImporting === "roles"}
                 />
            </TabsContent>
            <TabsContent value="employees" className="mt-6">
                 <DataImportSection
                    title="Employees"
                    description="Paste your employee master data JSON below. For system users, the `id` should match their Firebase Authentication UID."
                    exampleJson={employeeJson}
                    collectionName="employees"
                    dataKey="employees"
                    onImport={handleImport}
                    isImporting={isImporting === "employees"}
                 />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
