
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Button } from '@/components/ui/button';
import { FileText, BadgeCheck, Briefcase, Upload, Send, Eye, MessageSquare, AlertCircle, ChevronsUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser, useFirestore, useCollection, useMemoFirebase, WithId, addDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, where, serverTimestamp, doc, Timestamp, getDocs } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { useKpiData } from '@/context/KpiDataContext';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { getIdTokenResult } from 'firebase/auth';

// Consistent type definition with portfolio and cascade pages
interface IndividualKpiBase {
    employeeId: string;
    employeeName: string;
    department: string;
    kpiId: string;
    kpiMeasure: string;
    weight: number;
    status: 'Draft' | 'Agreed' | 'In-Progress' | 'Manager Review' | 'Upper Manager Approval' | 'Employee Acknowledged' | 'Closed' | 'Rejected';
    notes?: string;
    employeeNotes?: string;
    managerNotes?: string;
    rejectionReason?: string;
    agreedAt?: any;
    reviewedAt?: any;
    acknowledgedAt?: any;
}
interface AssignedCascadedKpi extends IndividualKpiBase { type: 'cascaded'; target: string; corporateKpiId: string;}
interface CommittedKpi extends IndividualKpiBase { type: 'committed'; task: string; targets: { [key: string]: string }; }
type IndividualKpi = AssignedCascadedKpi | CommittedKpi;


interface KpiSubmission {
    id?: string;
    kpiId: string;
    kpiMeasure: string;
    submittedBy: string;
    submitterName: string;
    department: string;
    actualValue: string;
    targetValue: string;
    notes: string;
    submissionDate: any; // Server timestamp
    status: 'Manager Review' | 'Upper Manager Approval' | 'Closed' | 'Rejected';
}

interface AppUser {
  id: string;
  employeeId: string;
  roles: string[];
}


interface Employee {
    id: string;
    name: string;
    departmentId: string;
}


const SubmitDataDialog = ({ isOpen, onOpenChange, kpi, onSubmit }: { 
    isOpen: boolean; 
    onOpenChange: (open: boolean) => void;
    kpi: WithId<IndividualKpi> | null;
    onSubmit: (submission: Omit<KpiSubmission, 'submissionDate' | 'submittedBy' | 'submitterName' | 'department'>) => void;
}) => {
    const [actualValue, setActualValue] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setActualValue('');
            setNotes('');
        }
    }, [isOpen]);

    const handleSubmit = () => {
        if (kpi) {
            onSubmit({
                kpiId: kpi.id,
                kpiMeasure: kpi.type === 'committed' ? kpi.task : kpi.kpiMeasure,
                actualValue,
                targetValue: kpi.type === 'cascaded' ? kpi.target : "5-level scale",
                notes,
                status: 'Manager Review'
            });
            onOpenChange(false);
        }
    };
    
    if (!kpi) return null;

    const isCommitted = kpi.type === 'committed';

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Submit Data for: {kpi.kpiMeasure}</DialogTitle>
                    <DialogDescription>
                        Enter the actual value achieved for this period. This will be sent for approval.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="p-4 bg-gray-50/50 rounded-lg space-y-2 border">
                        <p><strong>Measure:</strong> {kpi.kpiMeasure}</p>
                        <p><strong>Weight:</strong> {kpi.weight}%</p>
                        <p><strong>Target:</strong> {isCommitted ? "5-level scale" : kpi.target}</p>
                    </div>

                    {isCommitted ? (
                        <div className="space-y-2">
                             <Label htmlFor="actual-value">Achieved Level</Label>
                             <Select value={actualValue} onValueChange={setActualValue}>
                                <SelectTrigger id="actual-value">
                                    <SelectValue placeholder="Select the level you achieved" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(kpi.targets).map(([level, desc]) => (
                                        <SelectItem key={level} value={`Level ${level.slice(-1)}`}>
                                            Level {level.slice(-1)}: {desc}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                             </Select>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="actual-value">Actual Value</Label>
                            <Input 
                                id="actual-value" 
                                value={actualValue} 
                                onChange={(e) => setActualValue(e.target.value)} 
                                placeholder="e.g., 1,200,000 or 95%"
                                required 
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="submission-notes">Notes</Label>
                        <Textarea 
                            id="submission-notes" 
                            value={notes} 
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add any relevant comments, explanations, or context for this submission."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSubmit} disabled={!actualValue.trim()}>Submit for Approval</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const ViewCommitmentDialog = ({ isOpen, onOpenChange, kpi }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    kpi: WithId<IndividualKpi> | null;
}) => {
    if (!kpi) return null;
    
    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
        return format(date, 'MMM dd, yyyy, hh:mm a');
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Approved Commitment Details</DialogTitle>
                    <DialogDescription>{kpi.kpiMeasure}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] pr-4">
                <div className="py-4 space-y-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-sm text-muted-foreground">Weight</Label>
                                <p className="font-semibold">{kpi.weight}%</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-sm text-muted-foreground">Type</Label>
                                <p className="font-semibold">{kpi.type}</p>
                            </div>
                        </div>
                        {kpi.type === 'cascaded' && (
                             <div className="space-y-1">
                                <Label className="text-sm text-muted-foreground">Target</Label>
                                <p className="font-semibold">{kpi.target}</p>
                            </div>
                        )}
                         {kpi.type === 'committed' && (
                            <>
                                 <div className="space-y-1">
                                    <Label className="text-sm text-muted-foreground">Task</Label>
                                    <p className="font-semibold">{kpi.task}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm text-muted-foreground">5-Level Targets</Label>
                                    <div className="space-y-1 text-sm p-3 bg-gray-50 rounded-md border">
                                        {Object.entries(kpi.targets).map(([level, target]) => (
                                            <p key={level}><strong>{level}:</strong> {target}</p>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                     <div className="border-t pt-4 space-y-4">
                        <h4 className="font-semibold text-gray-900">Communication & History Trail</h4>
                         {kpi.notes && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <Label className="text-xs text-blue-700 font-semibold flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    Manager's Initial Notes
                                </Label>
                                <p className="text-sm text-gray-700 mt-1">{kpi.notes}</p>
                            </div>
                         )}
                         {kpi.employeeNotes && kpi.agreedAt && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <Label className="text-xs text-green-700 font-semibold flex items-center justify-between">
                                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />Employee Agreement Notes</span>
                                    <span>{formatDate(kpi.agreedAt)}</span>
                                </Label>
                                <p className="text-sm text-gray-700 mt-1">{kpi.employeeNotes}</p>
                            </div>
                         )}
                         {kpi.rejectionReason && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <Label className="text-xs text-red-700 font-semibold flex items-center justify-between">
                                    <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" />Manager's Rejection Reason</span>
                                    <span>{formatDate(kpi.reviewedAt)}</span>
                                </Label>
                                <p className="text-sm text-gray-700 mt-1">{kpi.rejectionReason}</p>
                            </div>
                         )}
                         {kpi.managerNotes && (
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                <Label className="text-xs text-purple-700 font-semibold flex items-center justify-between">
                                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />Manager's Review Notes</span>
                                     <span>{formatDate(kpi.reviewedAt)}</span>
                                </Label>
                                <p className="text-sm text-gray-700 mt-1">{kpi.managerNotes}</p>
                            </div>
                         )}
                         {kpi.acknowledgedAt && (
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                                <Label className="text-xs text-indigo-700 font-semibold flex items-center justify-between">
                                    <span className="flex items-center gap-1"><BadgeCheck className="h-3 w-3" />Employee Acknowledged</span>
                                     <span>{formatDate(kpi.acknowledgedAt)}</span>
                                </Label>
                            </div>
                         )}
                    </div>
                </div>
                </ScrollArea>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button>Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const getStatusColor = (status: IndividualKpi['status'] | KpiSubmission['status']) => {
  const colors: Record<IndividualKpi['status'] | KpiSubmission['status'], string> = {
    'Draft': 'bg-gray-100 text-gray-800 border-gray-300',
    'Agreed': 'bg-blue-100 text-blue-800 border-blue-300',
    'In-Progress': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'Manager Review': 'bg-purple-100 text-purple-800 border-purple-300',
    'Upper Manager Approval': 'bg-indigo-100 text-indigo-800 border-indigo-300',
    'Employee Acknowledged': 'bg-green-100 text-green-800 border-green-300',
    'Closed': 'bg-gray-100 text-gray-800 border-gray-300',
    'Rejected': 'bg-red-100 text-red-800 border-red-300',
  };
  return colors[status] || colors['Draft'];
};

const getStatusIcon = (status: IndividualKpi['status'] | KpiSubmission['status']) => {
  const icons: Record<IndividualKpi['status'] | KpiSubmission['status'], React.ReactNode> = {
    'Draft': <FileText className="h-4 w-4" />,
    'Agreed': <BadgeCheck className="h-4 w-4" />,
    'In-Progress': <Briefcase className="h-4 w-4" />,
    'Manager Review': <Eye className="h-4 w-4" />,
    'Upper Manager Approval': <BadgeCheck className="h-4 w-4" />,
    'Employee Acknowledged': <BadgeCheck className="h-4 w-4" />,
    'Closed': <BadgeCheck className="h-4 w-4" />,
    'Rejected': <AlertCircle className="h-4 w-4" />,
  };
  return icons[status] || icons['Draft'];
};


const KpiActionCard = ({ kpi, submissionStatus, onOpenSubmit, onViewCommitment, isManager }: {
    kpi: WithId<IndividualKpi>;
    submissionStatus?: KpiSubmission['status'];
    onOpenSubmit: (kpi: WithId<IndividualKpi>) => void;
    onViewCommitment: (kpi: WithId<IndividualKpi>) => void;
    isManager: boolean;
}) => {
    const isSubmitted = !!submissionStatus;
    const canResubmitData = submissionStatus === 'Rejected';
    const router = useRouter();

    const getAction = () => {
        if (isSubmitted && !canResubmitData && kpi.status !== 'Rejected') {
            return <Button variant="outline" size="sm" disabled><BadgeCheck className="w-4 h-4 mr-2"/> Submitted</Button>;
        }
        if (canResubmitData) {
            return <Button variant="destructive" size="sm" onClick={() => onOpenSubmit(kpi)}>Resubmit Data</Button>;
        }
        if (kpi.status === 'In-Progress') {
            return <Button variant="default" size="sm" onClick={() => onOpenSubmit(kpi)}>Submit Data</Button>;
        }
        if (kpi.status === 'Draft' && isManager) {
            return <Button variant="secondary" size="sm" onClick={() => router.push('/cascade')}><Send className="w-4 h-4 mr-2" />Edit in Cascade</Button>;
        }
        if (kpi.status === 'Rejected' && isManager) {
            return <Button variant="destructive" size="sm" onClick={() => router.push('/cascade')}><Send className="w-4 h-4 mr-2" />Edit in Cascade</Button>;
        }
        if (kpi.status === 'Upper Manager Approval') {
            return <Button variant="outline" size="sm" onClick={() => onViewCommitment(kpi)}><Eye className="w-4 h-4 mr-2"/> View Commitment</Button>;
        }
        return <Button variant="outline" size="sm" disabled>Awaiting Agreement</Button>;
    };

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="text-base font-semibold leading-tight flex-1 pr-2">{kpi.kpiMeasure}</CardTitle>
                    <Badge className={cn("text-xs", getStatusColor(isSubmitted ? submissionStatus! : kpi.status))}>
                      {getStatusIcon(isSubmitted ? submissionStatus! : kpi.status)}
                      <span className="ml-1.5">{isSubmitted ? submissionStatus : kpi.status}</span>
                    </Badge>
                </div>
                {isManager && <p className="text-sm text-muted-foreground">{kpi.employeeName}</p>}
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <Badge variant={kpi.type === 'cascaded' ? 'secondary' : 'default'} className="capitalize">{kpi.type}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Weight</span>
                    <span className="font-medium">{kpi.weight}%</span>
                </div>
                 <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Target</span>
                    <span className="font-medium truncate">{kpi.type === 'cascaded' ? kpi.target : "5-level scale"}</span>
                </div>
            </CardContent>
            <CardFooter>
                {getAction()}
            </CardFooter>
        </Card>
    );
};


export default function SubmitPage() {
  const { setPageTitle } = useAppLayout();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { employees, isEmployeesLoading, kpiData: kpiCatalog, departments, individualKpis: allKpis, isIndividualKpisLoading } = useKpiData();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewCommitmentOpen, setViewCommitmentOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<WithId<IndividualKpi> | null>(null);
  
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  useEffect(() => {
    if (user) {
      setIsCheckingAdmin(true);
      getIdTokenResult(user, true) 
        .then((idTokenResult) => {
          const claims = idTokenResult.claims;
          const userRole = claims.role as string;
          setIsAdmin(userRole === 'Admin');
          setIsCheckingAdmin(false);
        })
        .catch(() => {
          setIsAdmin(false);
          setIsCheckingAdmin(false);
        });
    } else if (!isAuthLoading) {
      setIsAdmin(false);
      setIsCheckingAdmin(false);
    }
  }, [user, isAuthLoading]);

  const [isManager, setIsManager] = useState(false);
   useEffect(() => {
    if (user) {
      getIdTokenResult(user)
        .then((idTokenResult) => {
          const userRole = idTokenResult.claims.role as string;
          setIsManager(['Admin', 'VP', 'AVP', 'Manager'].includes(userRole));
        })
    }
  }, [user]);

  useEffect(() => {
    setPageTitle('Submit KPI');
  }, [setPageTitle]);
  
  const kpisForUser = useMemo(() => {
    if (!allKpis) return [];
    if (isManager) return allKpis.filter(k => k.status !== 'Closed');
    if (user) {
      return allKpis.filter(k => 
        k.employeeId === user.uid && 
        ['Draft', 'In-Progress', 'Rejected', 'Agreed', 'Upper Manager Approval'].includes(k.status)
      );
    }
    return [];
  }, [allKpis, user, isManager]);

  const [submissionStatusMap, setSubmissionStatusMap] = useState<Map<string, KpiSubmission['status']>>(new Map());
  const [isSubmissionsLoading, setIsSubmissionsLoading] = useState(true);
  
  useEffect(() => {
    if (!kpisForUser || kpisForUser.length === 0 || !firestore) {
        setIsSubmissionsLoading(false);
        return;
    };
    
    const fetchSubmissions = async () => {
        setIsSubmissionsLoading(true);
        const kpiIds = kpisForUser.map(kpi => kpi.id);
        const newMap = new Map<string, KpiSubmission['status']>();

        const chunkSize = 30;
        for (let i = 0; i < kpiIds.length; i += chunkSize) {
            const chunk = kpiIds.slice(i, i + chunkSize);
            if (chunk.length > 0) {
                const submissionsQuery = query(collection(firestore, 'kpi_submissions'), where('kpiId', 'in', chunk));
                const querySnapshot = await getDocs(submissionsQuery);
                querySnapshot.forEach((doc) => {
                    const submission = doc.data() as KpiSubmission;
                    if (!newMap.has(submission.kpiId) || doc.get('submissionDate') > (newMap.get(submission.kpiId) as any)) {
                         newMap.set(submission.kpiId, submission.status);
                    }
                });
            }
        }
        setSubmissionStatusMap(newMap);
        setIsSubmissionsLoading(false);
    };

    fetchSubmissions();
  }, [kpisForUser, firestore]);
  
  const departmentOptions = useMemo(() => {
    if (!departments) return [];
    return departments.filter(d => d.name).sort((a, b) => a.name.localeCompare(b.name));
  }, [departments]);

  const kpiCategories = useMemo(() => {
    if (!kpiCatalog) return [];
    return [...new Set(kpiCatalog.map(k => k.category))].filter(Boolean).sort();
  }, [kpiCatalog]);
  

  const filteredKpis = useMemo(() => {
    if (!kpisForUser) return [];
    return kpisForUser.filter(kpi => {
        const department = departments?.find(d => d.id === kpi.department);
        const departmentName = department ? department.name : kpi.department;
        const departmentMatch = departmentFilter === 'all' || departmentName === departmentFilter;
        
        const kpiInfo = kpi.type === 'cascaded' ? kpiCatalog?.find(k => k.id === kpi.corporateKpiId) : null;
        const category = kpiInfo?.category ?? (kpi as any).category;
        const categoryMatch = categoryFilter === 'all' || category === categoryFilter;

        const employeeMatch = employeeFilter === 'all' || kpi.employeeId === employeeFilter;

        return departmentMatch && categoryMatch && employeeMatch;
    });
  }, [kpisForUser, departmentFilter, categoryFilter, employeeFilter, kpiCatalog, departments]);

  const kpisByDepartment = useMemo(() => {
      if (!filteredKpis) return {};
      return filteredKpis.reduce((acc, kpi) => {
          const deptName = departments?.find(d => d.id === kpi.department)?.name || kpi.department || 'Unassigned';
          if (!acc[deptName]) {
              acc[deptName] = [];
          }
          acc[deptName].push(kpi);
          return acc;
      }, {} as { [key: string]: WithId<IndividualKpi>[] });
  }, [filteredKpis, departments]);


  const summaryStats = useMemo(() => {
      if(!kpisForUser) return { totalInProgress: 0, needsSubmission: 0, submitted: 0 };
      const submittedIds = new Set(submissionStatusMap.keys());
      const inProgressKpis = kpisForUser.filter(k => k.status === 'In-Progress');
      const needsSubmissionCount = inProgressKpis.filter(k => !submittedIds.has(k.id) || submissionStatusMap.get(k.id) === 'Rejected').length;
      
      const submittedThisPeriod = Array.from(submissionStatusMap.entries()).filter(([id, status]) => status !== 'Rejected').length;

      return {
        totalInProgress: kpisForUser.filter(k=> k.status !== 'Closed').length,
        needsSubmission: needsSubmissionCount,
        submitted: submittedThisPeriod,
      };
  }, [kpisForUser, submissionStatusMap]);
  
  const handleOpenSubmitDialog = (kpi: WithId<IndividualKpi>) => {
    setSelectedKpi(kpi);
    setIsModalOpen(true);
  };

  const handleOpenViewCommitmentDialog = (kpi: WithId<IndividualKpi>) => {
    setSelectedKpi(kpi);
    setViewCommitmentOpen(true);
  }
  
  const handleDataSubmit = async (submission: Omit<KpiSubmission, 'submissionDate' | 'submittedBy' | 'submitterName' | 'department'>) => {
    if (!firestore || !user) {
        toast({ title: "Error", description: "Could not connect to the database.", variant: "destructive"});
        return;
    }
    
    const kpiOwner = allKpis?.find(k => k.id === submission.kpiId);
    if (!kpiOwner) {
        toast({ title: "Error", description: "Could not find owner for this KPI.", variant: "destructive"});
        return;
    }

    const deptName = departments?.find(d => d.id === kpiOwner.department)?.name || kpiOwner.department;

    const submissionData: KpiSubmission = {
        ...submission,
        submittedBy: kpiOwner.employeeId,
        submitterName: kpiOwner.employeeName,
        department: deptName,
        submissionDate: serverTimestamp(),
    };
    
    addDocumentNonBlocking(collection(firestore, 'kpi_submissions'), submissionData);
    setSubmissionStatusMap(prev => new Map(prev).set(submission.kpiId, 'Manager Review'));


    toast({
        title: "KPI Data Submitted",
        description: `Your data for "${submission.kpiMeasure}" has been sent for approval.`
    });
  };

  const isLoading = isAuthLoading || isIndividualKpisLoading || isSubmissionsLoading || isEmployeesLoading || isCheckingAdmin;

  const statCards = [
    { label: 'Awaiting Action', value: summaryStats.totalInProgress, icon: Briefcase, color: 'text-primary' },
    { label: 'Needs Data Submission', value: summaryStats.needsSubmission, icon: FileText, color: 'text-accent' },
    { label: 'Submitted (This Period)', value: summaryStats.submitted, icon: Upload, color: 'text-success' },
  ];

  return (
    <div className="fade-in space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-800">Submit KPI Data</h3>
        <p className="text-gray-600 mt-1">ส่งข้อมูล KPI สำหรับการอนุมัติ</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {statCards.map(stat => (
            <Card key={stat.label} className="text-center">
              <CardContent className="p-6">
                <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 bg-muted")}>
                  <stat.icon className={cn("w-6 h-6", stat.color)} />
                </div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className={cn("text-2xl font-bold", stat.color)}>{isLoading ? '...' : stat.value}</p>
              </CardContent>
            </Card>
          ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>KPI Submission Status</CardTitle>
          <div className="flex flex-col md:flex-row gap-4 pt-2">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter} disabled={!isManager}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departmentOptions.map(dept => <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={employeeFilter} onValueChange={setEmployeeFilter} disabled={!isManager}>
                <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Filter by Employee" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees?.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {kpiCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : Object.keys(kpisByDepartment).length > 0 ? (
            Object.entries(kpisByDepartment).map(([department, kpis]) => (
              <Collapsible key={department} defaultOpen>
                <CollapsibleTrigger asChild>
                  <div className="flex w-full items-center justify-between rounded-md bg-muted/60 px-4 py-3 cursor-pointer border">
                    <h4 className="font-semibold">{department}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{kpis.length} KPIs</span>
                      <ChevronsUpDown className="h-4 w-4" />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="p-4 bg-gray-50/10 border border-t-0 rounded-b-md">
                   <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {kpis.map((kpi) => (
                           <KpiActionCard 
                             key={kpi.id}
                             kpi={kpi}
                             submissionStatus={submissionStatusMap.get(kpi.id)}
                             onOpenSubmit={handleOpenSubmitDialog}
                             onViewCommitment={handleOpenViewCommitmentDialog}
                             isManager={isManager}
                           />
                        ))}
                    </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center text-gray-500 space-y-2">
                <Briefcase className="h-10 w-10 text-gray-300" />
                <p className="font-medium">No KPIs Found</p>
                <p className="text-sm">No KPIs match the current filter settings.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <SubmitDataDialog 
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        kpi={selectedKpi}
        onSubmit={handleDataSubmit}
      />
      <ViewCommitmentDialog
        isOpen={isViewCommitmentOpen}
        onOpenChange={setViewCommitmentOpen}
        kpi={selectedKpi}
      />
    </div>
  );
}
