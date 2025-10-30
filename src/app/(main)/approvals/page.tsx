
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


// ==================== KPI SUBMISSIONS TAB ====================

const KpiSubmissions = ({ submissions, onApprove, onReject, isLoading }: {
    submissions: WithId<KpiSubmission>[];
    onApprove: (submissionId: string) => void;
    onReject: (submissionId: string, reason: string) => void;
    isLoading: boolean;
}) => {
    const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
    const [isRejectDialogOpen, setRejectDialogOpen] = useState(false);

    const handleRejectClick = (id: string) => {
        setSelectedSubmissionId(id);
        setRejectDialogOpen(true);
    };

    const handleConfirmReject = (reason: string) => {
        if (selectedSubmissionId) {
            onReject(selectedSubmissionId, reason);
        }
        setRejectDialogOpen(false);
        setSelectedSubmissionId(null);
    };

    if (isLoading) {
        return <Skeleton className="h-64" />;
    }

    if (!submissions || submissions.length === 0) {
        return (
            <Card>
                <CardContent className="p-12 text-center">
                    <Inbox className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No KPI data submissions are currently awaiting your review.</p>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <>
            <div className="space-y-4">
                {submissions.map((item) => (
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
                                <Button variant="default" size="sm" onClick={() => onApprove(item.id)}>Approve</Button>
                            </div>
                             {item.notes && (
                                <div className="md:col-span-6 text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                                    <strong>Notes:</strong> {item.notes}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <RejectionDialog 
                isOpen={isRejectDialogOpen}
                onClose={() => setRejectDialogOpen(false)}
                onConfirm={handleConfirmReject}
            />
        </>
    );
};

// ==================== COMMITMENT REQUESTS TAB ====================
const CommitmentRequests = ({ kpis, onApprove, onReject, isLoading, employees }: {
    kpis: WithId<IndividualKpi>[];
    onApprove: (kpiId: string, notes: string) => void;
    onReject: (kpiId: string, reason: string) => void;
    isLoading: boolean;
    employees: WithId<Employee>[];
}) => {
    const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null);
    const [isRejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [isApproveDialogOpen, setApproveDialogOpen] = useState(false);

    const handleRejectClick = (id: string) => {
        setSelectedKpiId(id);
        setRejectDialogOpen(true);
    };
    
    const handleApproveClick = (id: string) => {
        setSelectedKpiId(id);
        setApproveDialogOpen(true);
    };

    const handleConfirmReject = (reason: string) => {
        if (selectedKpiId) {
            onReject(selectedKpiId, reason);
        }
        setRejectDialogOpen(false);
        setSelectedKpiId(null);
    };

    const handleConfirmApprove = (notes: string) => {
        if(selectedKpiId) {
            onApprove(selectedKpiId, notes);
        }
        setApproveDialogOpen(false);
        setSelectedKpiId(null);
    };

    const getEmployeeName = (employeeId: string) => {
        return employees.find(e => e.id === employeeId)?.name || 'Unknown Employee';
    };
    
    if (isLoading) {
        return <Skeleton className="h-64" />;
    }

    if (!kpis || kpis.length === 0) {
        return (
            <Card>
                <CardContent className="p-12 text-center">
                    <Inbox className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No commitment requests are currently awaiting your approval.</p>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <>
            <div className="space-y-4">
                {kpis.map((kpi) => (
                    <Card key={kpi.id}>
                        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                            <div className="md:col-span-2">
                                <p className="font-semibold text-gray-800">{kpi.kpiMeasure}</p>
                                <p className="text-sm text-gray-500">
                                    Request from: {getEmployeeName(kpi.employeeId)}
                                </p>
                            </div>
                            <div>
                                <Label className="text-xs">Weight</Label>
                                <p className="font-medium">{kpi.weight}%</p>
                            </div>
                            <div className="md:col-span-2 flex justify-end gap-2">
                                <Button variant="destructive" size="sm" onClick={() => handleRejectClick(kpi.id)}>Reject</Button>
                                <Button variant="default" size="sm" onClick={() => handleApproveClick(kpi.id)}>Final Agreement</Button>
                            </div>
                            {kpi.employeeNotes && (
                                <div className="md:col-span-5 text-sm text-gray-600 bg-blue-50 p-3 rounded-md border border-blue-200">
                                    <strong>Employee Notes:</strong> {kpi.employeeNotes}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <RejectionDialog 
                isOpen={isRejectDialogOpen}
                onClose={() => setRejectDialogOpen(false)}
                onConfirm={handleConfirmReject}
            />

            <ApprovalDialog
                isOpen={isApproveDialogOpen}
                onClose={() => setApproveDialogOpen(false)}
                onConfirm={handleConfirmApprove}
            />
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

  const isManagerOrAdmin = useMemo(() => {
    if (!userProfile) return false;
    return ['Admin', 'VP', 'AVP', 'Manager'].includes(userProfile.role);
  }, [userProfile]);

  useEffect(() => {
    setPageTitle("Action Center");
  }, [setPageTitle]);
  
  // Fetch employees to get names for submissions
  const employeesQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'employees') : null), [firestore]);
  const { data: employeesData, isLoading: isEmployeesLoading } = useCollection<WithId<Employee>>(employeesQuery);

  // Fetch KPI Submissions needing Manager Review
  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore || !isManagerOrAdmin) return null;
    return query(collection(firestore, 'submissions'), where('status', '==', 'Manager Review'));
  }, [firestore, isManagerOrAdmin]);

  const { data: submissions, isLoading: isSubmissionsLoading } = useCollection<WithId<KpiSubmission>>(submissionsQuery);

  // Fetch individual KPIs needing manager agreement
  const commitmentRequestsQuery = useMemoFirebase(() => {
    if (!firestore || !isManagerOrAdmin) return null;
    return query(collection(firestore, 'individual_kpis'), where('status', '==', 'Agreed'));
  }, [firestore, isManagerOrAdmin]);
  
  const { data: commitmentRequests, isLoading: isCommitmentsLoading } = useCollection<WithId<IndividualKpi>>(commitmentRequestsQuery);

  const isLoading = isUserLoading || isProfileLoading || isSubmissionsLoading || isEmployeesLoading || isCommitmentsLoading;

  // Handlers
  const handleApproveSubmission = async (submissionId: string) => {
    if (!firestore) return;
    const submissionRef = doc(firestore, 'submissions', submissionId);
    setDocumentNonBlocking(submissionRef, { status: 'Upper Manager Approval', reviewedAt: serverTimestamp() }, { merge: true });
    toast({ title: "Submission Approved", description: "The submission has been moved to the next approval stage." });
  };

  const handleRejectSubmission = async (submissionId: string, reason: string) => {
    if (!firestore) return;
    const submissionRef = doc(firestore, 'submissions', submissionId);
    setDocumentNonBlocking(submissionRef, { status: 'Rejected', rejectionReason: reason, reviewedAt: serverTimestamp() }, { merge: true });
    toast({ title: "Submission Rejected", description: "The submission has been marked as rejected.", variant: "destructive" });
  };
  
  const handleApproveCommitment = async (kpiId: string, notes: string) => {
    if (!firestore) return;
    const kpiRef = doc(firestore, 'individual_kpis', kpiId);
    setDocumentNonBlocking(kpiRef, { status: 'Upper Manager Approval', managerNotes: notes, reviewedAt: serverTimestamp() }, { merge: true });
    toast({ title: "Commitment Approved", description: "The KPI is now pending final acknowledgment by the employee." });
  };

  const handleRejectCommitment = async (kpiId: string, reason: string) => {
    if (!firestore) return;
    const kpiRef = doc(firestore, 'individual_kpis', kpiId);
    setDocumentNonBlocking(kpiRef, { status: 'Rejected', rejectionReason: reason, managerNotes: reason, reviewedAt: serverTimestamp() }, { merge: true });
    toast({ title: "Commitment Rejected", description: "The employee has been notified to revise their commitment.", variant: "destructive" });
  };
  
  const stats = useMemo(() => ({
      pendingSubmissions: submissions?.length ?? 0,
      pendingCommitments: commitmentRequests?.length ?? 0,
      teamSize: employeesData?.length ?? 0,
  }), [submissions, commitmentRequests, employeesData]);

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
            <Label className="text-sm text-gray-500">Pending Submissions</Label>
            <p className="text-2xl font-bold text-orange-600">{stats.pendingSubmissions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm text-gray-500">Pending Commitments</Label>
            <p className="text-2xl font-bold text-blue-600">{stats.pendingCommitments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm text-gray-500">Team Members</Label>
            <p className="text-2xl font-bold text-gray-900">{stats.teamSize}</p>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="submissions">
          <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="submissions">
                  KPI Submissions
                  {stats.pendingSubmissions > 0 && <Badge className="ml-2 bg-orange-500">{stats.pendingSubmissions}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="commitments">
                  Commitment Requests
                  {stats.pendingCommitments > 0 && <Badge className="ml-2 bg-blue-500">{stats.pendingCommitments}</Badge>}
              </TabsTrigger>
          </TabsList>
          <TabsContent value="submissions" className="mt-6">
             <KpiSubmissions 
                submissions={submissions || []} 
                onApprove={handleApproveSubmission}
                onReject={handleRejectSubmission}
                isLoading={isSubmissionsLoading}
             />
          </TabsContent>
          <TabsContent value="commitments" className="mt-6">
              <CommitmentRequests
                kpis={commitmentRequests || []}
                onApprove={handleApproveCommitment}
                onReject={handleRejectCommitment}
                isLoading={isCommitmentsLoading}
                employees={employeesData || []}
              />
          </TabsContent>
      </Tabs>

    </div>
  );
}
