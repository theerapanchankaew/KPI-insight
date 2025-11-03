
"use client";

import React, { useEffect } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building, Briefcase, Users, User, BookUser } from 'lucide-react';

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
          <Tabs defaultValue="departments" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
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
