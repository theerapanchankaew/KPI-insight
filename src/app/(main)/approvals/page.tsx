"use client";

import React, { useEffect } from 'react';
import { useAppLayout } from '../layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { kpiApprovalData } from '@/lib/kpi-data';
import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

export default function ApprovalsPage() {
  const { setPageTitle } = useAppLayout();
  const { toast } = useToast();

  useEffect(() => {
    setPageTitle('Approvals');
  }, [setPageTitle]);

  const handleApprove = (id: string) => {
    toast({ title: "KPI Approved", description: `KPI with ID ${id} has been approved.` });
  };

  const handleReject = (id: string) => {
    toast({ title: "KPI Rejected", description: `KPI with ID ${id} has been rejected.`, variant: 'destructive' });
  };
  
  const handleBulkApprove = () => {
    toast({ title: "Bulk Action", description: "All pending KPIs have been approved." });
  };
  
  const handleBulkReject = () => {
    toast({ title: "Bulk Action", description: "All pending KPIs have been rejected.", variant: 'destructive' });
  };

  return (
    <div className="fade-in space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">KPI Approvals</h3>
          <p className="text-gray-600 mt-1">อนุมัติข้อมูล KPI ที่รอการตรวจสอบ</p>
        </div>
        <div className="flex space-x-3">
          <Button onClick={handleBulkApprove} className="bg-success hover:bg-success/90">Approve All</Button>
          <Button onClick={handleBulkReject} variant="destructive">Reject All</Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h4 className="text-lg font-semibold text-gray-800">Pending Approvals</h4>
            <Badge variant="outline">{kpiApprovalData.length} รายการ</Badge>
          </div>
          <div className="divide-y divide-gray-200">
            {kpiApprovalData.map(item => (
              <div key={item.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                <div className="flex flex-col sm:flex-row items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h5 className="font-semibold text-gray-800">{item.name}</h5>
                      <Badge variant={item.priorityColor}>{item.priority}</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                      <div>
                        <span className="font-medium">Submitted by:</span>
                        <p>{item.submittedBy}</p>
                      </div>
                       <div>
                        <span className="font-medium">Department:</span>
                        <p>{item.department}</p>
                      </div>
                       <div>
                        <span className="font-medium">Value:</span>
                        <p className="font-bold text-gray-800">{item.value}</p>
                      </div>
                       <div>
                        <span className="font-medium">Target:</span>
                        <p>{item.target}</p>
                      </div>
                    </div>
                    <div className="bg-gray-100 rounded-lg p-3">
                      <p className="text-sm text-gray-700"><strong>Notes:</strong> {item.notes}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2 ml-0 sm:ml-4 mt-4 sm:mt-0">
                    <Button onClick={() => handleApprove(item.id)} className="bg-success hover:bg-success/90">
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button onClick={() => handleReject(item.id)} variant="destructive">
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
