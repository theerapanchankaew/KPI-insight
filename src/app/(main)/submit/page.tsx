
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Button } from '@/components/ui/button';
import { FileText, BadgeCheck, Briefcase, Upload, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser, useFirestore, useCollection, useMemoFirebase, WithId, addDocumentNonBlocking, useDoc, setDocumentNonBlocking } from '@/firebase';
import { collection, query, where, serverTimestamp, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { useKpiData } from '@/context/KpiDataContext';

// Consistent type definition with portfolio and cascade pages
interface IndividualKpiBase {
    employeeId: string;
    kpiId: string;
    kpiMeasure: string;
    weight: number;
    status: 'Draft' | 'Agreed' | 'In-Progress' | 'Manager Review' | 'Upper Manager Approval' | 'Employee Acknowledged' | 'Closed' | 'Rejected';
    notes?: string;
}
interface AssignedCascadedKpi extends IndividualKpiBase { type: 'cascaded'; target: string; }
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
  role: 'Admin' | 'VP' | 'AVP' | 'Manager' | 'Employee';
}

interface Employee {
    id: string;
    name: string;
    department: string;
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
                targetValue: kpi.type === 'cascaded' ? kpi.target : '5-level scale',
                notes,
                status: 'Manager Review'
            });
            onOpenChange(false);
        }
    };
    
    if (!kpi) return null;

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
                        <p><strong>Target:</strong> {kpi.type === 'cascaded' ? kpi.target : "5-level scale"}</p>
                    </div>
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


export default function SubmitPage() {
  const { setPageTitle } = useAppLayout();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { orgData: allEmployees, isOrgDataLoading: isEmployeesLoading } = useKpiData();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<WithId<IndividualKpi> | null>(null);

  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<AppUser>(userProfileRef);

  useEffect(() => {
    setPageTitle('Submit KPI');
  }, [setPageTitle]);

  const isManagerOrAdmin = useMemo(() => 
    userProfile?.role && ['Admin', 'VP', 'AVP', 'Manager'].includes(userProfile.role),
    [userProfile]
  );
  
  const kpisQuery = useMemoFirebase(() => {
    if (!firestore || isProfileLoading) return null;
    
    const baseQuery = collection(firestore, 'individual_kpis');
    
    if (isManagerOrAdmin) {
      // Managers/Admins see all KPIs that are not yet closed
      return query(baseQuery, where('status', '!=', 'Closed'));
    } else if (user) {
      // Employees only see their own active KPIs
      return query(baseQuery, 
        where('employeeId', '==', user.uid), 
        where('status', 'in', ['Draft', 'In-Progress', 'Rejected', 'Agreed', 'Manager Review'])
      );
    }
    return null;
  }, [firestore, user, isProfileLoading, isManagerOrAdmin]);
  
  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Fetch all submissions to check which KPIs have been submitted
    return collection(firestore, 'submissions');
  }, [firestore]);


  const { data: allKpis, isLoading: isKpisLoading } = useCollection<WithId<IndividualKpi>>(kpisQuery);
  const { data: allSubmissions, isLoading: isSubmissionsLoading } = useCollection<WithId<KpiSubmission>>(submissionsQuery);
  
  const submissionStatusMap = useMemo(() => {
    const map = new Map<string, KpiSubmission['status']>();
    if (allSubmissions) {
      // Sort by date to get the most recent status
      const sortedSubmissions = [...allSubmissions].sort((a, b) => b.submissionDate?.toMillis() - a.submissionDate?.toMillis());
      sortedSubmissions.forEach(s => {
        if (!map.has(s.kpiId)) {
          map.set(s.kpiId, s.status);
        }
      });
    }
    return map;
  }, [allSubmissions]);
  
  const employeeMap = useMemo(() => {
    if (!allEmployees) return new Map();
    return new Map(allEmployees.map(e => [e.id, e]));
  }, [allEmployees]);
  

  const summaryStats = useMemo(() => {
      const uniqueKpiIds = new Set(allSubmissions?.map(s => s.kpiId));
      const inProgressCount = allKpis?.filter(k => k.status === 'In-Progress').length || 0;
      
      return {
        totalInProgress: allKpis?.length || 0,
        needsSubmission: inProgressCount - uniqueKpiIds.size,
        submitted: uniqueKpiIds.size,
      };
  }, [allKpis, allSubmissions]);
  
  const handleOpenSubmitDialog = (kpi: WithId<IndividualKpi>) => {
    setSelectedKpi(kpi);
    setIsModalOpen(true);
  };
  
  const handleDataSubmit = async (submission: Omit<KpiSubmission, 'submissionDate' | 'submittedBy' | 'submitterName' | 'department'>) => {
    if (!firestore || !user) {
        toast({ title: "Error", description: "Could not connect to the database.", variant: "destructive"});
        return;
    }
    
    const kpiOwner = allKpis?.find(k => k.id === submission.kpiId);
    const employeeData = allEmployees?.find(e => e.id === kpiOwner?.employeeId);

    const submissionData: KpiSubmission = {
        ...submission,
        submittedBy: employeeData?.id || 'unknown',
        submitterName: employeeData?.name || 'Unknown User',
        department: employeeData?.department || 'Unassigned',
        submissionDate: serverTimestamp(),
    };
    
    const submissionsCollection = collection(firestore, 'submissions');
    addDocumentNonBlocking(submissionsCollection, submissionData);

    toast({
        title: "KPI Data Submitted",
        description: `Your data for "${submission.kpiMeasure}" has been sent for approval.`
    });
  };

  const handleForceToAgreed = (kpiId: string) => {
      if(!firestore || !isManagerOrAdmin) {
          toast({ title: 'Permission Denied', variant: 'destructive'});
          return;
      }
      const kpiRef = doc(firestore, 'individual_kpis', kpiId);
      setDocumentNonBlocking(kpiRef, { status: 'Agreed', agreedAt: serverTimestamp() }, { merge: true });
      toast({ title: 'KPI Submitted to Action Center', description: 'The KPI is now awaiting manager approval.' });
  }

  const isLoading = isUserLoading || isKpisLoading || isSubmissionsLoading || isEmployeesLoading || isProfileLoading;

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
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {isManagerOrAdmin && <TableHead>Employee</TableHead>}
                  <TableHead>KPI / Task</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                    [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                            {isManagerOrAdmin && <TableCell><Skeleton className="h-5 w-24" /></TableCell>}
                            <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                        </TableRow>
                    ))
                ) : allKpis && allKpis.length > 0 ? (
                  allKpis.map((kpi) => {
                    const submissionStatus = submissionStatusMap.get(kpi.id);
                    const isSubmitted = !!submissionStatus;
                    const employee = employeeMap.get(kpi.employeeId);
                    
                    const canResubmit = submissionStatus === 'Rejected';

                    return (
                        <TableRow key={kpi.id} className={cn(isSubmitted && !canResubmit && "bg-green-50/60")}>
                        {isManagerOrAdmin && (
                            <TableCell>
                                <div className="font-medium">{employee?.name || kpi.employeeId}</div>
                                <div className="text-xs text-muted-foreground">{employee?.department}</div>
                            </TableCell>
                        )}
                        <TableCell className="font-medium">{kpi.kpiMeasure}</TableCell>
                        <TableCell><Badge variant={kpi.type === 'cascaded' ? 'secondary' : 'default'}>{kpi.type}</Badge></TableCell>
                        <TableCell>{kpi.type === 'cascaded' ? kpi.target : "5-level scale"}</TableCell>
                        <TableCell>{kpi.weight}%</TableCell>
                        <TableCell>
                           {isSubmitted ? (
                                <Badge variant={submissionStatus === 'Rejected' ? 'destructive' : 'outline'}>{submissionStatus}</Badge>
                            ) : (
                                <Badge variant="outline">{kpi.status}</Badge>
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                           {(() => {
                                if (isSubmitted && !canResubmit) {
                                    return (
                                        <Button variant="outline" size="sm" disabled>
                                            <BadgeCheck className="w-4 h-4 mr-2"/> Submitted
                                        </Button>
                                    );
                                }
                                if (canResubmit) {
                                    return (
                                        <Button variant="destructive" size="sm" onClick={() => handleOpenSubmitDialog(kpi)}>
                                            Resubmit Data
                                        </Button>
                                    );
                                }
                                if (kpi.status === 'In-Progress') {
                                    return (
                                        <Button variant="default" size="sm" onClick={() => handleOpenSubmitDialog(kpi)}>
                                            Submit Data
                                        </Button>
                                    );
                                }
                                if (kpi.status === 'Draft' && isManagerOrAdmin) {
                                     return (
                                        <Button variant="secondary" size="sm" onClick={() => handleForceToAgreed(kpi.id)}>
                                            <Send className="w-4 h-4 mr-2" />
                                            Submit to Action Center
                                        </Button>
                                    );
                                }
                                return (
                                    <Button variant="outline" size="sm" disabled>
                                        Awaiting Agreement
                                    </Button>
                                );
                           })()}
                        </TableCell>
                        </TableRow>
                    );
                  })
                ) : (
                   <TableRow>
                        <TableCell colSpan={isManagerOrAdmin ? 7 : 6} className="h-48 text-center text-gray-500">
                            <div className="flex flex-col items-center justify-center space-y-2">
                                <Briefcase className="h-10 w-10 text-gray-300" />
                                <p className="font-medium">No KPIs awaiting action.</p>
                                <p className="text-sm">KPIs that are not yet closed will appear here.</p>
                            </div>
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <SubmitDataDialog 
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        kpi={selectedKpi}
        onSubmit={handleDataSubmit}
      />
    </div>
  );
}
