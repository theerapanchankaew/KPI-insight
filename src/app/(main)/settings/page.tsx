
"use client";

import React, { useEffect, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

import {
  ChevronRight,
  ShieldAlert,
  Users,
  Building,
  Briefcase,
  GitMerge,
  FileCheck,
  Share,
  FileCog,
  Users2,
  BookUser,
  List,
  UserCog,
  Network,
  ListTree,
  BarChart,
  ClipboardList,
  FileClock,
  FlaskConical,
  History,
  Workflow,
  BookCopy,
  UserPlus
} from 'lucide-react';
import Link from 'next/link';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useUser } from '@/firebase';

const SettingsItem = ({ title, href, icon: Icon }: { title: string, href: string, icon: React.ElementType }) => (
  <Link href={href} passHref>
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ml-8 border-l border-dashed border-gray-300">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <h5 className="font-normal text-sm">{title}</h5>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  </Link>
);


const SubMenu = ({ title, icon: Icon, children }: { title: string, icon: React.ElementType, children: React.ReactNode }) => (
    <AccordionItem value={title}>
        <AccordionTrigger className="hover:no-underline text-base px-4">
             <div className="flex items-center gap-4">
                <div className="bg-muted p-3 rounded-lg">
                  <Icon className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h4 className="font-semibold text-left">{title}</h4>
                </div>
              </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-0">
            {children}
        </AccordionContent>
    </AccordionItem>
);


export default function SettingsPage() {
  const { setPageTitle } = useAppLayout();
  const { user, isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile();

  const isAdmin = useMemo(() => {
    if (!userProfile || !Array.isArray(userProfile.roles)) return false;
    return userProfile.roles.map(role => role.toLowerCase()).includes('admin');
  }, [userProfile]);
  
  useEffect(() => {
    setPageTitle('System Administration');
  }, [setPageTitle]);

  const isLoading = isUserLoading || isProfileLoading;

  if (isLoading) {
    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-900">System Administration</h3>
            <p className="text-gray-600 mt-1">Configure and manage all aspects of your organizational structure and system rules.</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        </div>
    )
  }

  if (!isAdmin) {
    return (
        <Card className="mt-8">
            <CardContent className="p-12 text-center">
                <ShieldAlert className="h-16 w-16 mx-auto text-destructive mb-4" />
                <h3 className="text-xl font-semibold">Access Denied</h3>
                <p className="text-muted-foreground mt-2">Only administrators can access the settings page.</p>
            </CardContent>
        </Card>
    )
  }

  return (
    <div className="fade-in space-y-8">
      <div>
        <h3 className="text-2xl font-bold text-gray-900">System Administration Center</h3>
        <p className="text-gray-600 mt-1">Configure and manage all aspects of your organizational structure and system rules.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        <Card>
            <CardHeader>
                <CardTitle>🏢 Organization Management</CardTitle>
                <CardDescription>Define how your company is organized, structured, and how decisions are made.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Accordion type="multiple" className="w-full">
                    <SubMenu title="Reporting Hierarchy" icon={GitMerge}>
                        <SettingsItem title="Organization Chart" href="#" icon={Network} />
                        <SettingsItem title="Tree View" href="#" icon={ListTree} />
                        <SettingsItem title="List View" href="#" icon={List} />
                        <SettingsItem title="Manage Structure" href="#" icon={FileCog} />
                        <SettingsItem title="Reports & Analytics" href="#" icon={BarChart} />
                    </SubMenu>
                    <SubMenu title="Approval Hierarchy" icon={FileCheck}>
                        <SettingsItem title="Approval Rules" href="#" icon={ClipboardList} />
                        <SettingsItem title="Flow Builder" href="#" icon={Workflow} />
                        <SettingsItem title="Conditions Manager" href="#" icon={FileCog} />
                        <SettingsItem title="Approval Levels" href="#" icon={Users2} />
                        <SettingsItem title="Test Simulator" href="#" icon={FlaskConical} />
                        <SettingsItem title="Approval History" href="#" icon={History} />
                    </SubMenu>
                    <SubMenu title="Delegation Management" icon={Share}>
                        <SettingsItem title="Active Delegations" href="#" icon={Users} />
                        <SettingsItem title="Create Delegation" href="#" icon={UserPlus} />
                        <SettingsItem title="Scheduled" href="#" icon={FileClock} />
                        <SettingsItem title="History" href="#" icon={History} />
                        <SettingsItem title="Templates" href="#" icon={BookCopy} />
                    </SubMenu>
                 </Accordion>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>📚 Master Data</CardTitle>
                <CardDescription>Manage the core building blocks and entities of your organization.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="multiple" className="w-full" defaultValue={['Departments', 'Positions', 'Roles', 'Employees']}>
                    <SubMenu title="Departments" icon={Building}>
                        <SettingsItem title="View All Departments" href="#" icon={List} />
                        <SettingsItem title="Add New Department" href="#" icon={PlusCircle} />
                    </SubMenu>
                    <SubMenu title="Positions" icon={Briefcase}>
                         <SettingsItem title="View All Positions" href="#" icon={List} />
                        <SettingsItem title="Add New Position" href="#" icon={PlusCircle} />
                    </SubMenu>
                    <SubMenu title="Roles" icon={Users}>
                        <SettingsItem title="View All Roles" href="#" icon={List} />
                        <SettingsItem title="Add New Role" href="#" icon={PlusCircle} />
                    </SubMenu>
                    <SubMenu title="Employees" icon={BookUser}>
                        <SettingsItem title="View All Employees" href="#" icon={List} />
                        <SettingsItem title="Add New Employee" href="#" icon={UserPlus} />
                    </SubMenu>
                </Accordion>
            </CardContent>
        </Card>
        
      </div>
    </div>
  );
}
