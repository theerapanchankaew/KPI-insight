
"use client";

import React, { useEffect } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Database } from 'lucide-react';

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
            This is the central place to manage your organization's master data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <Database className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-muted-foreground">Master data management features will be implemented here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
