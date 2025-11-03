
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
import type { Kpi } from '@/context/KpiDataContext';


const exampleJson = `{
  "version": "1.0",
  "kpi_catalog": [
    {
      "id": "1bf13fca-25c4-4a04-8390-8b2173a2ffda",
      "perspective": "Sustainability",
      "strategic_objective": "Grow Corporate Value",
      "measure": "Total Revenue",
      "target": "≥ 194.10 ล้านบาท",
      "unit": "THB million",
      "category": "Theme:Sustainability Excellence"
    }
  ]
}`;

const KpiCatalogImport = () => {
    const [jsonInput, setJsonInput] = useState(exampleJson);
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const [isImporting, setIsImporting] = useState(false);

    const handleImport = async () => {
        if (!firestore || !user) {
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
            <TabsContent value="departments" className="mt-4">
                <MasterDataItem 
                    title="Departments" 
                    description="Department management features will be implemented here." 
                    icon={Building} 
                />
            </TabsContent>
            <TabsContent value="positions" className="mt-4">
                 <MasterDataItem 
                    title="Positions" 
                    description="Position management features will be implemented here." 
                    icon={Briefcase} 
                />
            </TabsContent>
            <TabsContent value="roles" className="mt-4">
                 <MasterDataItem 
                    title="Roles" 
                    description="Role and permission management features will be implemented here." 
                    icon={Users} 
                />
            </TabsContent>
            <TabsContent value="employees" className="mt-4">
                 <MasterDataItem 
                    title="Employees" 
                    description="Employee record management features will be implemented here." 
                    icon={BookUser} 
                />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

