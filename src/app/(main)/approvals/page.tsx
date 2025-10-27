
"use client";

import React, { useEffect, useState } from 'react';
import { useAppLayout } from '../layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, Mail, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection, useFirestore, useMemoFirebase, WithId, setDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

// Type for a KPI Submission document
interface KpiSubmission {
    id: string;
    kpiMeasure: string;
    submittedBy: string;
    submitterName: string;
    department: string;
    actualValue: string;
    targetValue: string;
    notes: string;
    status: 'Pending' | 'Approved' | 'Rejected';
}

// Type for an Individual KPI document (consistent with other pages)
interface IndividualKpiBase {
    employeeId: string;
    kpiId: string;
    kpiMeasure: string;
    weight: number;
    status: 'Pending' | 'Committed' | 'Approved' | 'Rejected';
    notes?: string;
}
interface AssignedCascadedKpi extends IndividualKpiBase { type: 'cascaded'; target: string; }
interface CommittedKpi extends IndividualKpiBase { type: 'committed'; task: string; targets: { [key: string]: string }; }
type IndividualKpi = AssignedCascadedKpi | CommittedKpi;


const KpiApprovalsTab = () => {
  const { toast } = useToast();
  const firestore = useFirestore();

  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'submissions'), where('status', '==', 'Pending'));
  }, [firestore]);

  const { data: submissionsData, isLoading } = useCollection<KpiSubmission>(submissionsQuery);

  const handleUpdateStatus = (item: WithId<KpiSubmission>, status: 'Approved' | 'Rejected') => {
    if (!firestore) return;
    const submissionRef = doc(firestore, 'submissions', item.id);
    const updatedData = { ...item, status };
    setDocumentNonBlocking(submissionRef, updatedData, { merge: true });

    toast({
      title: `KPI ${status}`,
      description: `Submission for "${item.kpiMeasure}" has been ${status.toLowerCase()}.`,
      variant: status === 'Rejected' ? 'destructive' : undefined,
    });
  };

  const handleBulkAction = (status: 'Approved' | 'Rejected') => {
      if (!firestore || !submissionsData) return;
      
      submissionsData.forEach(item => {
          const submissionRef = doc(firestore, 'submissions', item.id);
          const updatedData = { ...item, status };
          setDocumentNonBlocking(submissionRef, updatedData, { merge: true });
      });

      toast({
          title: "Bulk Action Complete",
          description: `All pending KPIs have been ${status.toLowerCase()}.`,
          variant: status === 'Rejected' ? 'destructive' : undefined
      });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pending KPI Submissions</CardTitle>
        <div className="flex space-x-2">
          <Button onClick={() => handleBulkAction('Approved')} size="sm" variant="outline" className="bg-success/10 text-success hover:bg-success/20 hover:text-success" disabled={isLoading || !submissionsData || submissionsData.length === 0}>Approve All</Button>
          <Button onClick={() => handleBulkAction('Rejected')} size="sm" variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive" disabled={isLoading || !submissionsData || submissionsData.length === 0}>Reject All</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-200">
           {isLoading ? (
             [...Array(2)].map((_, i) => (
                <div key={i} className="p-6 space-y-4">
                   <div className="flex justify-between items-start">
                     <div className="space-y-2 flex-grow">
                       <Skeleton className="h-5 w-1/3" />
                       <Skeleton className="h-4 w-1/2" />
                       <Skeleton className="h-4 w-3/4" />
                     </div>
                     <div className="flex space-x-2">
                       <Skeleton className="h-10 w-24" />
                       <Skeleton className="h-10 w-24" />
                     </div>
                   </div>
                   <Skeleton className="h-12 w-full" />
                </div>
             ))
           ) : submissionsData && submissionsData.length > 0 ? (
            submissionsData.map(item => (
            <div key={item.id} className="p-6 hover:bg-gray-50/50 transition-colors">
              <div className="flex flex-col sm:flex-row items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h5 className="font-semibold text-gray-800">{item.kpiMeasure}</h5>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                    <div><span className="font-medium">Submitted by:</span><p>{item.submitterName}</p></div>
                    <div><span className="font-medium">Department:</span><p>{item.department}</p></div>
                    <div><span className="font-medium">Value:</span><p className="font-bold text-gray-800">{item.actualValue}</p></div>
                    <div><span className="font-medium">Target:</span><p>{item.targetValue}</p></div>
                  </div>
                  {item.notes && (
                    <div className="bg-gray-100 rounded-lg p-3">
                        <p className="text-sm text-gray-700"><strong>Notes:</strong> {item.notes}</p>
                    </div>
                  )}
                </div>
                <div className="flex space-x-2 ml-0 sm:ml-4 mt-4 sm:mt-0">
                  <Button onClick={() => handleUpdateStatus(item, 'Approved')} className="bg-success/90 hover:bg-success/100 text-white">
                    <Check className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button onClick={() => handleUpdateStatus(item, 'Rejected')} variant="destructive">
                    <X className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            </div>
            ))
          ) : (
             <p className="p-6 text-center text-gray-500">No pending submissions to review.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
};

const CommitmentRequestsTab = () => {
  const { toast } = useToast();
  const firestore = useFirestore();

  const commitmentsQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'individual_kpis'), where('status', '==', 'Committed'));
  }, [firestore]);

  const { data: pendingCommitments, isLoading } = useCollection<IndividualKpi>(commitmentsQuery);

  const handleAgreement = (kpi: WithId<IndividualKpi>) => {
    if (!firestore) return;
    const kpiRef = doc(firestore, 'individual_kpis', kpi.id);
    const updatedData = { ...kpi, status: 'Approved' as const };
    setDocumentNonBlocking(kpiRef, updatedData, { merge: true });

    toast({ title: 'Agreement Confirmed', description: `You have finalized the commitment for KPI: ${kpi.kpiMeasure}.`});
  };

  return (
    <Card>
       <CardHeader>
        <CardTitle>Pending Commitments</CardTitle>
      </CardHeader>
       <CardContent className="p-0">
        <div className="divide-y divide-gray-200">
           {isLoading ? (
                [...Array(2)].map((_, i) => (
                    <div key={i} className="p-6 space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2 flex-grow">
                            <Skeleton className="h-5 w-2/3" />
                            <Skeleton className="h-4 w-full" />
                            </div>
                            <div className="flex space-x-2">
                            <Skeleton className="h-10 w-32" />
                            <Skeleton className="h-10 w-28" />
                            </div>
                        </div>
                    </div>
                ))
           ) : pendingCommitments && pendingCommitments.length > 0 ? (
            pendingCommitments.map(item => (
                <div key={item.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                <div className="flex flex-col sm:flex-row items-start justify-between">
                    <div className="flex-1">
                    <h5 className="font-semibold text-gray-800 mb-2">{item.kpiMeasure}</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                        <div><span className="font-medium">Employee:</span><p>{item.employeeId}</p></div> {/* TODO: Fetch employee name */}
                        <div><span className="font-medium">Type:</span><p><Badge variant={item.type === 'cascaded' ? 'secondary' : 'default'}>{item.type}</Badge></p></div>
                        <div><span className="font-medium">Weight:</span><p className="font-bold text-gray-800">{item.weight}%</p></div>
                        <div><span className="font-medium">Target:</span><p>{item.type === 'cascaded' ? item.target : '5-level scale'}</p></div>
                    </div>
                    {item.notes && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                            <p className="text-sm text-blue-800"><strong>Notes from employee:</strong> {item.notes}</p>
                        </div>
                    )}
                    </div>
                    <div className="flex space-x-2 ml-0 sm:ml-4 mt-4 sm:mt-0">
                    <Button onClick={() => handleAgreement(item)} variant="secondary">
                        <UserCheck className="w-4 h-4 mr-1" /> Final Agreement
                    </Button>
                    <Button variant="outline">
                        <Mail className="w-4 h-4 mr-1" /> Message
                    </Button>
                    </div>
                </div>
                </div>
          ))) : (
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
  
  // These hooks are used to get the count for the tabs.
  // This is a bit inefficient as the components also fetch data, but it's simple for now.
  const firestore = useFirestore();
  const submissionsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'submissions'), where('status', '==', 'Pending')) : null, [firestore]);
  const commitmentsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'individual_kpis'), where('status', '==', 'Committed')) : null, [firestore]);
  const { data: submissionsData } = useCollection(submissionsQuery);
  const { data: commitmentsData } = useCollection(commitmentsQuery);

  return (
    <div className="fade-in space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-800">Action Center</h3>
        <p className="text-gray-600 mt-1">Review and process all pending approvals and commitments.</p>
      </div>

       <Tabs defaultValue="submissions" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="submissions">KPI Submissions ({submissionsData?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="commitments">Commitment Requests ({commitmentsData?.length ?? 0})</TabsTrigger>
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
