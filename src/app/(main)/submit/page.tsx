
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Button } from '@/components/ui/button';
import { FileText, BadgeCheck, Briefcase, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser, useFirestore, useCollection, useMemoFirebase, WithId, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, serverTimestamp } from 'firebase/firestore';
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


const SubmitDataDialog = ({ isOpen, onOpenChange, kpi, onSubmit }: { 
    isOpen: boolean; 
    onOpenChange: (open: boolean) => void;
    kpi: WithId<IndividualKpi> | null;
    onSubmit: (submission: Omit<KpiSubmission, 'submissionDate' | 'status' | 'submittedBy' | 'submitterName' | 'department' | 'rejectionReason'>) => void;
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
  const { orgData, isOrgDataLoading } = useKpiData();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<WithId<IndividualKpi> | null>(null);

  useEffect(() => {
    setPageTitle('Submit KPI');
  }, [setPageTitle]);

  // Per SRS, only KPIs with status 'In-Progress' are available for data submission
  const kpisForSubmissionQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'individual_kpis'), 
      where('employeeId', '==', user.uid),
      where('status', '==', 'In-Progress')
    );
  }, [firestore, user]);
  
  const userSubmissionsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    // This could be refined to only fetch submissions for the current period
    return query(
      collection(firestore, 'submissions'),
      where('submittedBy', '==', user.uid)
    );
  }, [firestore, user]);


  const { data: kpisForSubmission, isLoading: isKpisLoading } = useCollection<WithId<IndividualKpi>>(kpisForSubmissionQuery);
  const { data: userSubmissions, isLoading: isSubmissionsLoading } = useCollection<WithId<KpiSubmission>>(userSubmissionsQuery);
  
  const submittedKpiIds = useMemo(() => {
    return new Set(userSubmissions?.map(s => s.kpiId) || []);
  }, [userSubmissions]);
  
  const kpisNeedingSubmission = useMemo(() => {
    if (!kpisForSubmission) return [];
    return kpisForSubmission.filter(kpi => !submittedKpiIds.has(kpi.id));
  }, [kpisForSubmission, submittedKpiIds]);

  const summaryStats = useMemo(() => {
    return {
        totalInProgress: kpisForSubmission?.length || 0,
        needsSubmission: kpisNeedingSubmission.length,
        submitted: submittedKpiIds.size,
    };
  }, [kpisForSubmission, kpisNeedingSubmission, submittedKpiIds]);
  
  const handleOpenSubmitDialog = (kpi: WithId<IndividualKpi>) => {
    setSelectedKpi(kpi);
    setIsModalOpen(true);
  };
  
  const handleDataSubmit = async (submission: Omit<KpiSubmission, 'submissionDate' | 'status' | 'submittedBy' | 'submitterName' | 'department' | 'rejectionReason'>) => {
    if (!firestore || !user) {
        toast({ title: "Error", description: "Could not connect to the database.", variant: "destructive"});
        return;
    }
    
    const employeeData = orgData?.find(e => e.id === user.uid);

    const submissionData: KpiSubmission = {
        ...submission,
        submittedBy: user.uid,
        submitterName: user.displayName || 'Unknown User',
        department: employeeData?.department || 'Unassigned',
        submissionDate: serverTimestamp(),
        status: 'Manager Review', // Per SRS, first step is Manager Review
    };
    
    const submissionsCollection = collection(firestore, 'submissions');
    addDocumentNonBlocking(submissionsCollection, submissionData);

    toast({
        title: "KPI Data Submitted",
        description: `Your data for "${submission.kpiMeasure}" has been sent for approval.`
    });
  };

  const isLoading = isUserLoading || isKpisLoading || isSubmissionsLoading || isOrgDataLoading;

  const statCards = [
    { label: 'In-Progress KPIs', value: summaryStats.totalInProgress, icon: BadgeCheck, color: 'text-success' },
    { label: 'Needs Submission', value: summaryStats.needsSubmission, icon: FileText, color: 'text-accent' },
    { label: 'Submitted (This Period)', value: summaryStats.submitted, icon: Upload, color: 'text-primary' },
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
             <CardTitle>My KPIs Ready for Submission</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI / Task</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                    [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                        </TableRow>
                    ))
                ) : kpisForSubmission && kpisForSubmission.length > 0 ? (
                  kpisForSubmission.map((kpi) => {
                    const isSubmitted = submittedKpiIds.has(kpi.id);
                    return (
                        <TableRow key={kpi.id} className={cn(isSubmitted && "bg-green-50/60")}>
                        <TableCell className="font-medium">{kpi.kpiMeasure}</TableCell>
                        <TableCell><Badge variant={kpi.type === 'cascaded' ? 'secondary' : 'default'}>{kpi.type}</Badge></TableCell>
                        <TableCell>{kpi.type === 'cascaded' ? kpi.target : "5-level scale"}</TableCell>
                        <TableCell>{kpi.weight}%</TableCell>
                        <TableCell className="text-right">
                            {isSubmitted ? (
                                <Button variant="outline" size="sm" disabled>
                                    <BadgeCheck className="w-4 h-4 mr-2"/> Submitted
                                </Button>
                            ) : (
                                <Button variant="default" size="sm" onClick={() => handleOpenSubmitDialog(kpi)}>
                                    Submit Data
                                </Button>
                            )}
                        </TableCell>
                        </TableRow>
                    );
                  })
                ) : (
                   <TableRow>
                        <TableCell colSpan={5} className="h-48 text-center text-gray-500">
                            <div className="flex flex-col items-center justify-center space-y-2">
                                <Briefcase className="h-10 w-10 text-gray-300" />
                                <p className="font-medium">No KPIs ready for submission.</p>
                                <p className="text-sm">KPIs with a status of 'In-Progress' will appear here.</p>
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

    