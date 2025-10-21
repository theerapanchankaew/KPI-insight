
"use client";

import React, { useEffect } from 'react';
import { useAppLayout } from '../layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { kpiApprovalData } from '@/lib/data/approval-data';
import { Check, X, Mail, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { kpiPortfolioData } from '@/lib/data/portfolio-data';

const KpiApprovalsTab = () => {
  const { toast } = useToast();

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pending KPI Submissions</CardTitle>
        <div className="flex space-x-2">
          <Button onClick={handleBulkApprove} size="sm" variant="outline" className="bg-success/10 text-success hover:bg-success/20 hover:text-success">Approve All</Button>
          <Button onClick={handleBulkReject} size="sm" variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive">Reject All</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
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
                    <div><span className="font-medium">Submitted by:</span><p>{item.submittedBy}</p></div>
                    <div><span className="font-medium">Department:</span><p>{item.department}</p></div>
                    <div><span className="font-medium">Value:</span><p className="font-bold text-gray-800">{item.value}</p></div>
                    <div><span className="font-medium">Target:</span><p>{item.target}</p></div>
                  </div>
                  <div className="bg-gray-100 rounded-lg p-3">
                    <p className="text-sm text-gray-700"><strong>Notes:</strong> {item.notes}</p>
                  </div>
                </div>
                <div className="flex space-x-2 ml-0 sm:ml-4 mt-4 sm:mt-0">
                  <Button onClick={() => handleApprove(item.id)} className="bg-success/90 hover:bg-success/100 text-white">
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
  )
};

const CommitmentRequestsTab = () => {
  const { toast } = useToast();
  const pendingCommitments = kpiPortfolioData.filter(kpi => kpi.status === 'Committed');

  const handleAgreement = (kpiId: string) => {
    toast({ title: 'Agreement Confirmed', description: `You have confirmed the commitment for KPI ${kpiId}.`});
  };

  return (
    <Card>
       <CardHeader>
        <CardTitle>Pending Commitments</CardTitle>
      </CardHeader>
       <CardContent className="p-0">
        <div className="divide-y divide-gray-200">
           {pendingCommitments.length > 0 ? pendingCommitments.map(item => (
            <div key={item.id} className="p-6 hover:bg-gray-50/50 transition-colors">
              <div className="flex flex-col sm:flex-row items-start justify-between">
                <div className="flex-1">
                  <h5 className="font-semibold text-gray-800 mb-2">{item.kpi}</h5>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                    <div><span className="font-medium">Employee:</span><p>สมศรี รักดี</p></div>
                    <div><span className="font-medium">Type:</span><p><Badge variant={item.type === 'cascaded' ? 'secondary' : 'default'}>{item.type}</Badge></p></div>
                    <div><span className="font-medium">Weight:</span><p className="font-bold text-gray-800">{item.weight}%</p></div>
                    <div><span className="font-medium">Target:</span><p>{item.target}</p></div>
                  </div>
                  {item.notes && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                        <p className="text-sm text-blue-800"><strong>Notes from employee:</strong> {item.notes}</p>
                    </div>
                  )}
                </div>
                <div className="flex space-x-2 ml-0 sm:ml-4 mt-4 sm:mt-0">
                   <Button onClick={() => handleAgreement(item.id)} variant="secondary">
                    <UserCheck className="w-4 h-4 mr-1" /> Final Agreement
                  </Button>
                  <Button variant="outline">
                    <Mail className="w-4 h-4 mr-1" /> Message
                  </Button>
                </div>
              </div>
            </div>
          )) : (
            <p className="p-6 text-center text-gray-500">No pending commitments to review.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function ApprovalsPage() {
  const { setPageTitle } = useAppLayout();

  useEffect(() => {
    setPageTitle('Action Center');
  }, [setPageTitle]);

  return (
    <div className="fade-in space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-800">Action Center</h3>
        <p className="text-gray-600 mt-1">Review and process all pending approvals and commitments.</p>
      </div>

       <Tabs defaultValue="submissions" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="submissions">KPI Submissions ({kpiApprovalData.length})</TabsTrigger>
          <TabsTrigger value="commitments">Commitment Requests ({kpiPortfolioData.filter(k=> k.status === 'Committed').length})</TabsTrigger>
        </TabsList>
        <TabsContent value="submissions" className="mt-6">
          <KpiApprovalsTab />
        </TabsContent>
        <TabsContent value="commitments" className="mt-6">
          <CommitmentRequestsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
