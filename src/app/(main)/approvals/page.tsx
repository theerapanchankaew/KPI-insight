
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, UserCheck, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection, useFirestore, useMemoFirebase, WithId, setDocumentNonBlocking, useUser, useDoc, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// Type for a KPI Submission document
interface KpiSubmission {
    id: string;
    kpiId: string;
    kpiMeasure: string;
    submittedBy: string;
    submitterName: string;
    department: string;
    actualValue: string;
    targetValue: string;
    notes: string;
    status: 'Manager Review' | 'Upper Manager Approval' | 'Closed';
}

// Type for an Individual KPI document (consistent with other pages)
interface IndividualKpiBase {
    employeeId: string;
    kpiId: string;
    kpiMeasure: string;
    weight: number;
    status: 'Draft' | 'Agreed' | 'In-Progress' | 'Manager Review' | 'Upper Manager Approval' | 'Employee Acknowledged' | 'Closed' | 'Rejected';
    notes?: string;
    rejectionReason?: string;
}
interface AssignedCascadedKpi extends IndividualKpiBase { type: 'cascaded'; target: string; }
interface CommittedKpi extends IndividualKpiBase { type: 'committed'; task: string; targets: { [key: string]: string }; }
type IndividualKpi = AssignedCascadedKpi | CommittedKpi;

interface AppUser {
  role: 'Admin' | 'VP' | 'AVP' | 'Manager' | 'Employee' | null;
}

const RejectDialog = ({ isOpen, onClose, onConfirm, kpiName }: { isOpen: boolean, onClose: () => void, onConfirm: (reason: string) => void, kpiName: string }) => {
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (isOpen) {
            setReason('');
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reject: {kpiName}</DialogTitle>
                    <DialogDescription>
                        Please provide a reason for the rejection. This will be sent back to the employee.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="rejection-reason">Rejection Reason</Label>
                    <Textarea 
                        id="rejection-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g., Target is not aligned with department goals..."
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={() => onConfirm(reason)} variant="destructive" disabled={!reason.trim()}>Confirm Rejection</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const KpiApprovalsTab = ({ isManagerOrAdmin, isProfileLoading }: { isManagerOrAdmin: boolean, isProfileLoading: boolean }) => {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<WithId<KpiSubmission> | null>(null);

  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore || isProfileLoading || !isManagerOrAdmin) return null; 
    return query(collection(firestore, 'submissions'), where('status', 'in', ['Manager Review', 'Upper Manager Approval']));
  }, [firestore, isProfileLoading, isManagerOrAdmin]);

  const { data: submissionsData, isLoading: isSubmissionsLoading } = useCollection<KpiSubmission>(submissionsQuery);

  const handleApprove = (item: WithId<KpiSubmission>) => {
    if(!firestore) return;
    const submissionRef = doc(firestore, 'submissions', item.id);
    const individualKpiRef = doc(firestore, 'individual_kpis', item.kpiId);
    
    let nextSubmissionStatus: KpiSubmission['status'];
    let individualKpiNextStatus: IndividualKpi['status'] | null = null;
    
    if (item.status === 'Manager Review') {
        nextSubmissionStatus = 'Upper Manager Approval';
        toast({ title: 'Approved by Manager', description: 'KPI sent for upper management approval.'});
    } else { // Upper Manager Approval
        nextSubmissionStatus = 'Closed';
        individualKpiNextStatus = 'Closed'; // Close the loop on the KPI itself
        toast({ title: 'Final Approval Complete', description: 'KPI submission has been closed.'});
    }

    setDocumentNonBlocking(submissionRef, { status: nextSubmissionStatus }, { merge: true });

    if(individualKpiNextStatus) {
        setDocumentNonBlocking(individualKpiRef, { status: individualKpiNextStatus }, { merge: true });
    }
  };

  const handleOpenRejectDialog = (item: WithId<KpiSubmission>) => {
    setSelectedSubmission(item);
    setIsRejectModalOpen(true);
  };
  
  const handleConfirmRejection = (reason: string) => {
      if(!firestore || !selectedSubmission) return;

      const submissionRef = doc(firestore, 'submissions', selectedSubmission.id);
      const individualKpiRef = doc(firestore, 'individual_kpis', selectedSubmission.kpiId);
      
      // Update individual kpi to 'In-Progress' so employee can resubmit
      const updatedData: Partial<IndividualKpi> = {
          status: 'In-Progress',
          rejectionReason: `Submission rejected: ${reason}`, // Add context
      };
      setDocumentNonBlocking(individualKpiRef, updatedData, { merge: true });

      // Delete the rejected submission document from the queue
      deleteDocumentNonBlocking(submissionRef);

      toast({
          title: "Submission Rejected",
          description: `The submission for "${selectedSubmission.kpiMeasure}" has been rejected and sent back to the employee.`,
          variant: 'destructive',
      });
      
      setIsRejectModalOpen(false);
      setSelectedSubmission(null);
  };

  const isLoading = isProfileLoading || isSubmissionsLoading;

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pending KPI Submissions for Review</CardTitle>
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
                     <Badge variant={item.status === 'Manager Review' ? 'default' : 'secondary'}>{item.status}</Badge>
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
                  <Button onClick={() => handleApprove(item)} className="bg-green-600 hover:bg-green-700 text-white">
                    <Check className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button onClick={() => handleOpenRejectDialog(item)} variant="destructive">
                    <X className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            </div>
            ))
          ) : (
             <p className="p-6 text-center text-gray-500">{isManagerOrAdmin ? "No pending submissions to review." : "Only managers and admins can view pending submissions."}</p>
          )}
        </div>
      </CardContent>
    </Card>
     <RejectDialog 
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={handleConfirmRejection}
        kpiName={selectedSubmission?.kpiMeasure || ''}
    />
    </>
  );
};

const CommitmentRequestsTab = ({ isManagerOrAdmin, isProfileLoading }: { isManagerOrAdmin: boolean, isProfileLoading: boolean }) => {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isRejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<WithId<IndividualKpi> | null>(null);

  const commitmentsQuery = useMemoFirebase(() => {
      if (!firestore || isProfileLoading || !isManagerOrAdmin) return null;
      return query(collection(firestore, 'individual_kpis'), where('status', '==', 'Agreed'));
  }, [firestore, isProfileLoading, isManagerOrAdmin]);

  const { data: pendingCommitments, isLoading: isCommitmentsLoading } = useCollection<IndividualKpi>(commitmentsQuery);

  const handleAgreement = (kpi: WithId<IndividualKpi>) => {
    if (!firestore) return;
    const kpiRef = doc(firestore, 'individual_kpis', kpi.id);
    // After manager agreement, it goes for Upper Manager (final) approval
    const updatedData = { status: 'Upper Manager Approval' as const };
    setDocumentNonBlocking(kpiRef, updatedData, { merge: true });

    toast({ title: 'Agreement Confirmed', description: `You have agreed to the commitment for KPI: ${kpi.kpiMeasure}. Sent for final approval.`});
  };
  
  const handleOpenRejectDialog = (kpi: WithId<IndividualKpi>) => {
    setSelectedKpi(kpi);
    setRejectModalOpen(true);
  };
  
  const handleConfirmRejection = (reason: string) => {
    if (!firestore || !selectedKpi) return;
    const kpiRef = doc(firestore, 'individual_kpis', selectedKpi.id);
    const updatedData: Partial<IndividualKpi> = {
        status: 'Rejected',
        rejectionReason: reason,
    };
    setDocumentNonBlocking(kpiRef, updatedData, { merge: true });
    toast({ title: 'KPI Rejected', description: `The commitment has been sent back to the employee with your feedback.`, variant: 'destructive'});
    setRejectModalOpen(false);
    setSelectedKpi(null);
  };

  const isLoading = isProfileLoading || isCommitmentsLoading;

  return (
    <>
    <Card>
       <CardHeader>
        <CardTitle>Pending KPI Commitments</CardTitle>
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
                    <Button onClick={() => handleOpenRejectDialog(item)} variant="destructive" >
                        <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                    </div>
                </div>
                </div>
          ))) : (
            <p className="p-6 text-center text-gray-500">{isManagerOrAdmin ? "No pending commitments to review." : "Only managers and admins can view commitment requests."}</p>
          )}
        </div>
      </CardContent>
    </Card>
    <RejectDialog 
        isOpen={isRejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        onConfirm={handleConfirmRejection}
        kpiName={selectedKpi?.kpiMeasure || ''}
    />
    </>
  );
};

export default function ApprovalsPage() {
  const { setPageTitle } = useAppLayout();
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    setPageTitle('Action Center');
  }, [setPageTitle]);
  
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<AppUser>(userProfileRef);
  const isManagerOrAdmin = useMemo(() => {
      if (!userProfile) return false;
      return ['Admin', 'VP', 'AVP', 'Manager'].includes(userProfile.role || '');
  }, [userProfile]);
  
  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore || isUserProfileLoading || !isManagerOrAdmin) return null;
    return query(collection(firestore, 'submissions'), where('status', 'in', ['Manager Review', 'Upper Manager Approval']))
  }, [firestore, isUserProfileLoading, isManagerOrAdmin]);

  const commitmentsQuery = useMemoFirebase(() => {
    if (!firestore || isUserProfileLoading || !isManagerOrAdmin) return null;
    return query(collection(firestore, 'individual_kpis'), where('status', '==', 'Agreed'));
  }, [firestore, isUserProfileLoading, isManagerOrAdmin]);

  const { data: submissionsData, isLoading: isSubmissionsLoading } = useCollection(submissionsQuery);
  const { data: commitmentsData, isLoading: isCommitmentsLoading } = useCollection(commitmentsQuery);

  const isLoading = isSubmissionsLoading || isCommitmentsLoading || isUserProfileLoading;

  return (
    <div className="fade-in space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-800">Action Center</h3>
        <p className="text-gray-600 mt-1">Review and process all pending approvals and commitments.</p>
      </div>

       <Tabs defaultValue="submissions" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="submissions">KPI Submissions ({isLoading ? '...' : submissionsData?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="commitments">Commitment Requests ({isLoading ? '...' : commitmentsData?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="submissions" className="mt-6">
          <KpiApprovalsTab isManagerOrAdmin={isManagerOrAdmin} isProfileLoading={isUserProfileLoading} />
        </TabsContent>
        <TabsContent value="commitments" className="mt-6">
          <CommitmentRequestsTab isManagerOrAdmin={isManagerOrAdmin} isProfileLoading={isUserProfileLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

    