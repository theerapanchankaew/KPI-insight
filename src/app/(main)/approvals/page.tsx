
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter,
  DialogClose 
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  ShieldCheck,
  Inbox
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc, WithId } from '@/firebase';
import { collection, query, where, doc, serverTimestamp } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ==================== TYPE DEFINITIONS ====================

interface IndividualKpiBase {
  employeeId: string;
  kpiId: string;
  kpiMeasure: string;
  weight: number;
  status: 'Draft' | 'Agreed' | 'In-Progress' | 'Manager Review' | 'Upper Manager Approval' | 'Employee Acknowledged' | 'Closed' | 'Rejected';
  notes?: string;
  employeeNotes?: string;
  managerNotes?: string;
  agreedAt?: any;
  reviewedAt?: any;
  acknowledgedAt?: any;
  rejectionReason?: string;
}

interface AssignedCascadedKpi extends IndividualKpiBase {
  type: 'cascaded';
  target: string;
}

interface CommittedKpi extends IndividualKpiBase {
  type: 'committed';
  task: string;
  targets: {
    level1: string;
    level2: string;
    level3: string;
    level4: string;
    level5: string;
  };
}

type IndividualKpi = (AssignedCascadedKpi | CommittedKpi);

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
    submissionDate: any;
    status: 'Manager Review' | 'Upper Manager Approval' | 'Closed' | 'Rejected';
}

interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
}

type Role = 'Admin' | 'VP' | 'AVP' | 'Manager' | 'Employee';

interface AppUser {
  role: Role;
}

// ==================== DIALOGS ====================

const RejectionDialog = ({ isOpen, onClose, onConfirm }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}) => {
    const [reason, setReason] = useState('');
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reject Submission/Commitment</DialogTitle>
                    <DialogDescription>Please provide a reason for the rejection. This will be sent to the employee.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea 
                        placeholder="e.g., The actual value seems incorrect, or the proposed commitment needs adjustment..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button variant="destructive" onClick={() => onConfirm(reason)} disabled={!reason.trim()}>Confirm Rejection</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const ApprovalDialog = ({ isOpen, onClose, onConfirm }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (notes: string) => void;
}) => {
    const [notes, setNotes] = useState('');
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Approve Commitment</DialogTitle>
                    <DialogDescription>Add any final notes before approving this commitment. This will be visible to the employee.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea 
                        placeholder="e.g., Great commitment. Looking forward to seeing the results."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={() => onConfirm(notes)}>Confirm Approval</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ==================== GENERIC LIST COMPONENT ====================
const ApprovalList = ({
    items,
    title,
    isLoading,
    getEmployeeName,
    onApprove,
    onReject,
    noItemsMessage,
    actionButtonText,
    approveDialog,
}: {
    items: WithId<KpiSubmission | IndividualKpi>[];
    title: string;
    isLoading: boolean;
    getEmployeeName?: (employeeId: string) => string;
    onApprove: (itemId: string, notes: string) => void;
    onReject: (itemId: string, reason: string) => void;
    noItemsMessage: string;
    actionButtonText: string;
    approveDialog?: boolean;
}) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isRejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [isApproveDialogOpen, setApproveDialogOpen] = useState(false);

    const handleRejectClick = (id: string) => {
        setSelectedId(id);
        setRejectDialogOpen(true);
    };

    const handleApproveClick = (id: string) => {
        if (approveDialog) {
            setSelectedId(id);
            setApproveDialogOpen(true);
        } else {
            onApprove(id, '');
        }
    };

    const handleConfirmReject = (reason: string) => {
        if (selectedId) onReject(selectedId, reason);
        setRejectDialogOpen(false);
        setSelectedId(null);
    };
    
    const handleConfirmApprove = (notes: string) => {
        if (selectedId) onApprove(selectedId, notes);
        setApproveDialogOpen(false);
        setSelectedId(null);
    };

    if (isLoading) return <Skeleton className="h-64" />;
    if (!items || items.length === 0) {
        return (
            <Card>
                <CardContent className="p-12 text-center">
                    <Inbox className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">{noItemsMessage}</p>
                </CardContent>
            </Card>
        );
    }
    
    const renderItem = (item: WithId<KpiSubmission | IndividualKpi>) => {
        if ('kpiMeasure' in item) { // Type guard for both IndividualKpi and KpiSubmission
            if ('actualValue' in item) { // KpiSubmission
                 return (
                    <Card key={item.id}>
                        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                             <div className="md:col-span-3">
                                <p className="font-semibold text-gray-800">{item.kpiMeasure}</p>
                                <p className="text-sm text-gray-500">
                                    Submitted by: {item.submitterName} ({item.department})
                                </p>
                            </div>
                            <div>
                                <Label className="text-xs">Target</Label>
                                <p className="font-medium">{item.targetValue}</p>
                            </div>
                            <div>
                                <Label className="text-xs">Actual</Label>
                                <p className="font-bold text-lg text-primary">{item.actualValue}</p>
                            </div>
                            <div className="md:col-span-6 border-t pt-4 mt-2 flex justify-end gap-2">
                                <Button variant="destructive" size="sm" onClick={() => handleRejectClick(item.id)}>Reject</Button>
                                <Button variant="default" size="sm" onClick={() => handleApproveClick(item.id, )}>{actionButtonText}</Button>
                            </div>
                             {item.notes && (
                                <div className="md:col-span-6 text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                                    <strong>Notes:</strong> {item.notes}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            } else { // IndividualKpi
                return (
                    <Card key={item.id}>
                        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                            <div className="md:col-span-2">
                                <p className="font-semibold text-gray-800">{item.kpiMeasure}</p>
                                <p className="text-sm text-gray-500">
                                    Request from: {getEmployeeName?.(item.employeeId) || '...'}
                                </p>
                            </div>
                            <div>
                                <Label className="text-xs">Weight</Label>
                                <p className="font-medium">{item.weight}%</p>
                            </div>
                            <div className="md:col-span-2 flex justify-end gap-2">
                                <Button variant="destructive" size="sm" onClick={() => handleRejectClick(item.id)}>Reject</Button>
                                <Button variant="default" size="sm" onClick={() => handleApproveClick(item.id)}>{actionButtonText}</Button>
                            </div>
                            {(item.employeeNotes || item.managerNotes) && (
                                <div className="md:col-span-5 space-y-2 mt-2">
                                    {item.employeeNotes && <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md border border-blue-200">
                                        <strong>Employee Notes:</strong> {item.employeeNotes}
                                    </div>}
                                    {item.managerNotes && <div className="text-sm text-gray-600 bg-purple-50 p-3 rounded-md border border-purple-200">
                                        <strong>Manager Notes:</strong> {item.managerNotes}
                                    </div>}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            }
        }
        return null;
    };


    return (
        <>
            <div className="space-y-4">{items.map(renderItem)}</div>
            <RejectionDialog isOpen={isRejectDialogOpen} onClose={() => setRejectDialogOpen(false)} onConfirm={handleConfirmReject} />
            {approveDialog && <ApprovalDialog isOpen={isApproveDialogOpen} onClose={() => setApproveDialogOpen(false)} onConfirm={handleConfirmApprove} />}
        </>
    );
};


// ==================== MAIN COMPONENT ====================

export default function ActionCenterPage() {
  const { setPageTitle } = useAppLayout();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  
  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<AppUser>(userProfileRef);

  const isManagerOrAdmin = useMemo(() => userProfile?.role && ['Admin', 'VP', 'AVP', 'Manager'].includes(userProfile.role), [userProfile]);
  const isUpperManager = useMemo(() => userProfile?.role && ['Admin', 'VP'].includes(userProfile.role), [userProfile]);

  useEffect(() => {
    setPageTitle("Action Center");
  }, [setPageTitle]);
  
  const employeesQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'employees') : null), [firestore]);
  const { data: employeesData, isLoading: isEmployeesLoading } = useCollection<WithId<Employee>>(employeesQuery);

  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore || !isManagerOrAdmin) return null;
    return query(collection(firestore, 'kpi_submissions'), where('status', '==', 'Manager Review'));
  }, [firestore, isManagerOrAdmin]);

  const { data: submissions, isLoading: isSubmissionsLoading } = useCollection<WithId<KpiSubmission>>(submissionsQuery);

  const commitmentRequestsQuery = useMemoFirebase(() => {
    if (!firestore || !isManagerOrAdmin) return null;
    return query(collection(firestore, 'individual_kpis'), where('status', '==', 'Manager Review'));
  }, [firestore, isManagerOrAdmin]);
  
  const { data: commitmentRequests, isLoading: isCommitmentsLoading } = useCollection<WithId<IndividualKpi>>(commitmentRequestsQuery);

  const upperManagerApprovalQuery = useMemoFirebase(() => {
      if (!firestore || !isUpperManager) return null;
      return query(collection(firestore, 'individual_kpis'), where('status', '==', 'Upper Manager Approval'));
  }, [firestore, isUpperManager]);

  const { data: upperManagerApprovals, isLoading: isUpperManagerApprovalsLoading } = useCollection<WithId<IndividualKpi>>(upperManagerApprovalQuery);


  const isLoading = isUserLoading || isProfileLoading || isSubmissionsLoading || isEmployeesLoading || isCommitmentsLoading || isUpperManagerApprovalsLoading;

  const handleApproveSubmission = async (submissionId: string) => {
    if (!firestore) return;
    const submissionRef = doc(firestore, 'kpi_submissions', submissionId);
    setDocumentNonBlocking(submissionRef, { status: 'Closed', reviewedAt: serverTimestamp() }, { merge: true });
    toast({ title: "Submission Approved", description: "The submission has been approved and closed." });
  };

  const handleRejectSubmission = async (submissionId: string, reason: string) => {
    if (!firestore) return;
    const submissionRef = doc(firestore, 'kpi_submissions', submissionId);
    setDocumentNonBlocking(submissionRef, { status: 'Rejected', rejectionReason: reason, reviewedAt: serverTimestamp() }, { merge: true });
    toast({ title: "Submission Rejected", variant: "destructive" });
  };
  
  const handleApproveCommitment = async (kpiId: string, notes: string) => {
    if (!firestore) return;
    const kpiRef = doc(firestore, 'individual_kpis', kpiId);
    setDocumentNonBlocking(kpiRef, { status: 'Upper Manager Approval', managerNotes: notes, reviewedAt: serverTimestamp() }, { merge: true });
    toast({ title: "Commitment Agreed", description: "The KPI has been escalated to upper management for final approval." });
  };

  const handleRejectCommitment = async (kpiId: string, reason: string) => {
    if (!firestore) return;
    const kpiRef = doc(firestore, 'individual_kpis', kpiId);
    setDocumentNonBlocking(kpiRef, { status: 'Rejected', rejectionReason: reason, managerNotes: reason, reviewedAt: serverTimestamp() }, { merge: true });
    toast({ title: "Commitment Rejected", variant: "destructive" });
  };

  const handleUpperManagerApprove = async (kpiId: string) => {
    if (!firestore) return;
    const kpiRef = doc(firestore, 'individual_kpis', kpiId);
    setDocumentNonBlocking(kpiRef, { status: 'In-Progress' }, { merge: true });
    toast({ title: "Final Approval Given", description: "The KPI is now active." });
  };

  const handleUpperManagerReject = async (kpiId: string, reason: string) => {
    if (!firestore) return;
    const kpiRef = doc(firestore, 'individual_kpis', kpiId);
    setDocumentNonBlocking(kpiRef, { status: 'Rejected', rejectionReason: reason }, { merge: true });
    toast({ title: "Commitment Rejected", variant: "destructive" });
  };

  
  const getEmployeeName = (employeeId: string) => {
      return employeesData?.find(e => e.id === employeeId)?.name || 'Unknown Employee';
  };
  
  const stats = useMemo(() => ({
      pendingSubmissions: submissions?.length ?? 0,
      pendingCommitments: commitmentRequests?.length ?? 0,
      pendingUpperManager: upperManagerApprovals?.length ?? 0,
  }), [submissions, commitmentRequests, upperManagerApprovals]);

  if (isLoading) {
      return (
          <div className="space-y-6">
              <Skeleton className="h-24" />
              <Skeleton className="h-64" />
          </div>
      );
  }

  if (!isManagerOrAdmin) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
            <ShieldCheck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">You do not have permission to access this page.</p>
            <p className="text-sm text-gray-500 mt-2">The Action Center is available for managerial roles only.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="fade-in space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Action Center</h3>
        <p className="text-gray-600">Review and approve KPI data and commitments from your team.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm text-gray-500">Pending Data Submissions</Label>
            <p className="text-2xl font-bold text-orange-600">{stats.pendingSubmissions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm text-gray-500">Pending Commitment Agreements</Label>
            <p className="text-2xl font-bold text-blue-600">{stats.pendingCommitments}</p>
          </CardContent>
        </Card>
        {isUpperManager && <Card>
            <CardContent className="p-4">
                <Label className="text-sm text-gray-500">Pending Final Approval</Label>
                <p className="text-2xl font-bold text-indigo-600">{stats.pendingUpperManager}</p>
            </CardContent>
        </Card>}
      </div>
      
      <Tabs defaultValue="submissions">
          <TabsList className={cn("grid w-full", isUpperManager ? "grid-cols-3" : "grid-cols-2")}>
              <TabsTrigger value="submissions">
                  Data Submissions
                  {stats.pendingSubmissions > 0 && <Badge className="ml-2 bg-orange-500">{stats.pendingSubmissions}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="commitments">
                  Commitment Requests
                  {stats.pendingCommitments > 0 && <Badge className="ml-2 bg-blue-500">{stats.pendingCommitments}</Badge>}
              </TabsTrigger>
              {isUpperManager && <TabsTrigger value="upper-approval">
                  Upper Manager Approval
                  {stats.pendingUpperManager > 0 && <Badge className="ml-2 bg-indigo-500">{stats.pendingUpperManager}</Badge>}
              </TabsTrigger>}
          </TabsList>
          <TabsContent value="submissions" className="mt-6">
             <ApprovalList 
                items={submissions || []}
                title="KPI Submissions"
                isLoading={isSubmissionsLoading}
                onApprove={handleApproveSubmission}
                onReject={handleRejectSubmission}
                noItemsMessage="No KPI data submissions are currently awaiting your review."
                actionButtonText="Approve"
             />
          </TabsContent>
          <TabsContent value="commitments" className="mt-6">
              <ApprovalList
                items={commitmentRequests || []}
                title="Commitment Requests"
                isLoading={isCommitmentsLoading}
                getEmployeeName={getEmployeeName}
                onApprove={handleApproveCommitment}
                onReject={handleRejectCommitment}
                noItemsMessage="No commitment requests are currently awaiting your approval."
                actionButtonText="Final Agreement"
                approveDialog={true}
              />
          </TabsContent>
           {isUpperManager && <TabsContent value="upper-approval" className="mt-6">
              <ApprovalList
                items={upperManagerApprovals || []}
                title="Upper Manager Approval"
                isLoading={isUpperManagerApprovalsLoading}
                getEmployeeName={getEmployeeName}
                onApprove={handleUpperManagerApprove}
                onReject={handleUpperManagerReject}
                noItemsMessage="No commitments are currently awaiting final approval."
                actionButtonText="Final Approve"
              />
          </TabsContent>}
      </Tabs>

    </div>
  );
}

    