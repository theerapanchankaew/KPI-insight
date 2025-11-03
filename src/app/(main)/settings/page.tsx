
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { getIdTokenResult } from 'firebase/auth';
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
} from 'lucide-react';
import Link from 'next/link';

const SettingsItem = ({ title, description, href, icon: Icon }: { title: string, description: string, href: string, icon: React.ElementType }) => (
  <Link href={href} passHref>
    <div className="flex items-center justify-between p-4 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="bg-muted p-3 rounded-lg">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h4 className="font-semibold">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </div>
  </Link>
);


export default function SettingsPage() {
  const { setPageTitle } = useAppLayout();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  
  useEffect(() => {
    setPageTitle('Settings');
  }, [setPageTitle]);

  useEffect(() => {
    if (isAuthLoading) return;

    if (user) {
      setIsCheckingRole(true);
      getIdTokenResult(user)
        .then((idTokenResult) => {
          const claims = idTokenResult.claims;
          const userRole = claims.role as string;
          setIsAdmin(userRole === 'Admin');
          setIsCheckingRole(false);
        })
        .catch(() => {
          setIsAdmin(false);
          setIsCheckingRole(false);
        });
    } else {
      setIsAdmin(false);
      setIsCheckingRole(false);
    }
  }, [user, isAuthLoading]);
  
  const isLoading = isAuthLoading || isCheckingRole;

  if (isLoading) {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Skeleton className="h-72 w-full" />
                <Skeleton className="h-72 w-full" />
                <Skeleton className="h-72 w-full" />
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
        <h3 className="text-2xl font-bold text-gray-900">Hierarchy Management</h3>
        <p className="text-gray-600 mt-1">Configure and manage all aspects of your organizational structure and system rules.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Organization Structure */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Structure</CardTitle>
            <CardDescription>Define how your company is organized and how decisions are made.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <SettingsItem title="Reporting Hierarchy" description="Manage the chain of command." href="#" icon={GitMerge} />
            <SettingsItem title="Approval Hierarchy" description="Define who approves what." href="#" icon={FileCheck} />
            <SettingsItem title="Delegation Management" description="Assign temporary responsibilities." href="#" icon={Share} />
          </CardContent>
        </Card>
        
        {/* Master Data */}
        <Card>
          <CardHeader>
            <CardTitle>Master Data</CardTitle>
            <CardDescription>Manage the core building blocks of your organization.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <SettingsItem title="Departments" description="Manage business units." href="#" icon={Building} />
            <SettingsItem title="Positions" description="Manage job titles and levels." href="#" icon={Briefcase} />
            <SettingsItem title="Roles" description="Manage system roles and permissions." href="#" icon={Users} />
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle>System Settings</CardTitle>
            <CardDescription>Configure system-wide rules and templates.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <SettingsItem title="Approval Rules" description="Set rules for automated approvals." href="#" icon={FileCog} />
            <SettingsItem title="Permission Templates" description="Create default permission sets." href="#" icon={Users2} />
          </CardContent>
        </Card>
        
      </div>
    </div>
  );
}
