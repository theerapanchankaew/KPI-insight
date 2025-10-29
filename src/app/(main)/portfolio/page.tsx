
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  MessageSquare,
  Award,
  Target,
  Eye,
  ChevronsUpDown,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase, WithId, useDoc } from '@/firebase';
import { collection, query, where, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useKpiData } from '@/context/KpiDataContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';


// ==================== TYPE DEFINITIONS ====================

interface IndividualKpiBase {
  employeeId: string;
  kpiId: string;
  kpiMeasure: string;
  weight: number;
  status: 'Draft' | 'Agreed' | 'In-Progress' | 'Manager Review' | 'Upper Manager Approval' | 'Employee Acknowledged' | 'Closed' | 'Rejected';
  notes?: string; // Manager's initial notes
  employeeNotes?: string;
  managerNotes?: string;
  rejectionReason?: string;
  agreedAt?: any;
  reviewedAt?: any;
  acknowledgedAt?: any;
}

interface AssignedCascadedKpi extends IndividualKpiBase {
  type: 'cascaded';
  target: string;
  unit: string;
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

type IndividualKpi = (AssignedCascadedKpi | CommittedKpi) & { id: string };

interface KpiSubmission {
    kpiId: string;
    actualValue: string;
    submissionDate: any;
    status: string;
}

interface AppUser {
  role: 'Admin' | 'VP' | 'AVP' | 'Manager' | 'Employee';
  department: string;
}

// ==================== UTILITY FUNCTIONS ====================

const getStatusColor = (status: IndividualKpi['status']) => {
  const colors = {
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

const getStatusIcon = (status: IndividualKpi['status']) => {
  const icons = {
    'Draft': <FileText className="h-4 w-4" />,
    'Agreed': <CheckCircle2 className="h-4 w-4" />,
    'In-Progress': <Clock className="h-4 w-4" />,
    'Manager Review': <Eye className="h-4 w-4" />,
    'Upper Manager Approval': <CheckCircle2 className="h-4 w-4" />,
    'Employee Acknowledged': <Award className="h-4 w-4" />,
    'Closed': <CheckCircle2 className="h-4 w-4" />,
    'Rejected': <AlertCircle className="h-4 w-4" />,
  };
  return icons[status] || icons['Draft'];
};

const parseValue = (value: string) => {
    if (typeof value !== 'string') return 0;
    return parseFloat(value.replace(/[^0-9.-]+/g, "")) || 0;
};

// ==================== KPI DETAIL/ACTION DIALOG ====================

const KpiDetailDialog = ({
  kpi,
  isOpen,
  onClose,
  onAgree,
  canAgree,
}: {
  kpi: IndividualKpi | null;
  isOpen: boolean;
  onClose: () => void;
  onAgree: (kpiId: string, notes: string) => void;
  canAgree: boolean;
}) => {
  const [employeeNotes, setEmployeeNotes] = useState('');

  useEffect(() => {
    if (isOpen && kpi) {
      setEmployeeNotes(kpi.employeeNotes || '');
    }
  }, [isOpen, kpi]);

  if (!kpi) return null;

  const handleAgree = () => {
    onAgree(kpi.id, employeeNotes);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Review & Agree to KPI
          </DialogTitle>
          <DialogDescription>
            Review your assigned KPI. Add any notes for your manager before agreeing.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* KPI Information */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-gray-500">KPI Measure</Label>
                <p className="text-lg font-semibold text-gray-900 mt-1">{kpi.kpiMeasure}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Type</Label>
                  <Badge variant="outline" className="mt-1">
                    {kpi.type === 'cascaded' ? 'Cascaded KPI' : 'Individual Commitment'}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Weight</Label>
                  <p className="text-lg font-semibold mt-1">{kpi.weight}%</p>
                </div>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Status</Label>
                <Badge className={cn("mt-1", getStatusColor(kpi.status))}>
                  {getStatusIcon(kpi.status)}
                  <span className="ml-1">{kpi.status}</span>
                </Badge>
              </div>

              {kpi.type === 'cascaded' && (
                <div>
                  <Label className="text-sm text-gray-500">Target</Label>
                  <p className="text-lg font-semibold mt-1">{kpi.target}</p>
                </div>
              )}

              {kpi.type === 'committed' && (
                <>
                  <div>
                    <Label className="text-sm text-gray-500">Task/Objective</Label>
                    <p className="text-base mt-1">{kpi.task}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Performance Levels</Label>
                    <div className="mt-2 space-y-2">
                      {Object.entries(kpi.targets).map(([level, target], idx) => (
                        <div key={level} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                          <span className="font-semibold text-sm w-20">Level {idx + 1}</span>
                          <span className="text-sm">{target}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Communication Trail */}
            <div className="border-t pt-4 space-y-4">
              <h4 className="font-semibold text-gray-900">Communication Trail</h4>
              
              {kpi.notes && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <Label className="text-xs text-blue-700 font-semibold flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Manager's Initial Notes
                  </Label>
                  <p className="text-sm text-gray-700 mt-1">{kpi.notes}</p>
                </div>
              )}
              
              {kpi.rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <Label className="text-xs text-red-700 font-semibold flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Manager's Rejection Reason
                    </Label>
                    <p className="text-sm text-gray-700 mt-1">{kpi.rejectionReason}</p>
                </div>
              )}

              {canAgree && (
                <div>
                  <Label htmlFor="employee-notes" className="text-sm font-semibold">
                    Your Notes (Optional)
                  </Label>
                  <Textarea
                    id="employee-notes"
                    placeholder="Add any comments, questions, or clarifications for your manager..."
                    value={employeeNotes}
                    onChange={(e) => setEmployeeNotes(e.target.value)}
                    rows={4}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    These notes will be visible to your manager.
                  </p>
                </div>
              )}

              {kpi.employeeNotes && !canAgree && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <Label className="text-xs text-green-700 font-semibold flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Your Notes
                  </Label>
                  <p className="text-sm text-gray-700 mt-1">{kpi.employeeNotes}</p>
                </div>
              )}

              {kpi.managerNotes && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <Label className="text-xs text-purple-700 font-semibold flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Manager's Review Notes
                  </Label>
                  <p className="text-sm text-gray-700 mt-1">{kpi.managerNotes}</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex gap-2">
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          {canAgree && (
            <Button onClick={handleAgree} className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Agree & Submit to Manager
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ==================== KPI CARD COMPONENT (WITH PROGRESS) ====================
const KpiProgressCard = ({ 
  kpi,
  submission,
  onViewDetails,
  onAcknowledge,
}: { 
  kpi: WithId<IndividualKpi>; 
  submission: WithId<KpiSubmission> | undefined;
  onViewDetails: (kpi: WithId<IndividualKpi>) => void;
  onAcknowledge: (kpiId: string) => void;
}) => {

  const canAcknowledge = kpi.status === 'Upper Manager Approval';
  
  const { targetValue, actualValue, achievement, isPositive } = useMemo(() => {
    if (kpi.type !== 'cascaded') {
      return { targetValue: '5-Level Scale', actualValue: submission?.actualValue ?? 'N/A', achievement: -1, isPositive: true };
    }
    const target = parseValue(kpi.target);
    const actual = submission ? parseValue(submission.actualValue) : 0;
    const achievement = target > 0 ? (actual / target) * 100 : 0;
    
    // Simple logic for trend direction. Can be made more complex.
    const isPositive = actual >= target;

    return { targetValue: kpi.target, actualValue: submission?.actualValue ?? 'Not Submitted', achievement, isPositive };
  }, [kpi, submission]);

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300 flex flex-col">
        <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
                <h4 className="font-semibold text-gray-900 flex-1 pr-2">{kpi.kpiMeasure}</h4>
                <Badge className={cn("text-xs", getStatusColor(kpi.status))}>
                  {getStatusIcon(kpi.status)}
                  <span className="ml-1">{kpi.status}</span>
                </Badge>
            </div>
            <p className="text-xs text-gray-500">Weight: {kpi.weight}% • Type: {kpi.type}</p>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between">
            {kpi.type === 'cascaded' ? (
                <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                        <div>
                            <p className="text-xs text-gray-500">Actual</p>
                            <p className="text-xl font-bold text-primary">{actualValue}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500">Target</p>
                            <p className="font-semibold">{targetValue}</p>
                        </div>
                    </div>
                    <div>
                        <Progress value={achievement} className="h-2" />
                        <div className="flex justify-between items-center mt-1">
                            <p className="text-xs font-semibold text-primary">{achievement.toFixed(1)}% Achieved</p>
                            <div className={cn("flex items-center text-xs", isPositive ? "text-green-600" : "text-red-600")}>
                                {isPositive ? <TrendingUp className="h-4 w-4 mr-1"/> : <TrendingDown className="h-4 w-4 mr-1"/>}
                                {isPositive ? 'On Track' : 'Needs Attention'}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-4 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-700">Committed Task</p>
                    <p className="text-xs text-gray-500">Achievement based on 5-level scale</p>
                    <p className="text-lg font-semibold text-primary mt-1">{submission?.actualValue ?? 'Not Submitted'}</p>
                </div>
            )}
        </CardContent>
        <div className="p-4 pt-2 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => onViewDetails(kpi)}>
                <Eye className="mr-2 h-4 w-4" />
                Details
            </Button>
            {canAcknowledge && (
                <Button size="sm" variant="default" onClick={() => onAcknowledge(kpi.id)}>
                   <Award className="mr-2 h-4 w-4" />
                   Acknowledge
                </Button>
            )}
        </div>
    </Card>
  );
};


// ==================== MAIN COMPONENT ====================

export default function MyPortfolioPage() {
  const { setPageTitle } = useAppLayout();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { orgData: allEmployees, isOrgDataLoading: isEmployeesLoading } = useKpiData();

  const [selectedKpi, setSelectedKpi] = useState<WithId<IndividualKpi> | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<AppUser>(userProfileRef);
  const isManagerOrAdmin = useMemo(() => userProfile?.role && ['Admin', 'VP', 'AVP', 'Manager'].includes(userProfile.role), [userProfile]);
  
  useEffect(() => {
    setPageTitle("My Portfolio");
  }, [setPageTitle]);

  const teamMembers = useMemo(() => {
    if (!allEmployees || !userProfile || !user) return [];
    if (isManagerOrAdmin) {
        if (userProfile.role === 'Admin' || userProfile.role === 'VP') {
            return allEmployees; 
        }
        return allEmployees.filter(emp => emp.department === userProfile.department);
    }
    // For employees, the "team" is just themselves
    return allEmployees.filter(emp => emp.id === user.uid);
  }, [isManagerOrAdmin, allEmployees, userProfile, user]);

  
  const kpiQueryIds = useMemo(() => {
    if (teamMembers.length === 0) return null;
    // Firestore 'in' query is limited to 30 items.
    return teamMembers.map(tm => tm.id).slice(0, 30);
  }, [teamMembers]);


  const kpisQuery = useMemoFirebase(() => {
    if (!firestore || !kpiQueryIds) return null;
    return query(collection(firestore, 'individual_kpis'), where('employeeId', 'in', kpiQueryIds));
  }, [firestore, kpiQueryIds]);

  const { data: kpis, isLoading: isKpisLoading } = useCollection<WithId<IndividualKpi>>(kpisQuery);
  
  // Fetch all submissions related to the fetched KPIs
  const submissionKpiIds = useMemo(() => {
    if(!kpis || kpis.length === 0) return null;
    // Limit to 30 to match 'in' query limit
    return kpis.map(k => k.id).slice(0, 30);
  }, [kpis]);

  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore || !submissionKpiIds) return null;
    return query(collection(firestore, 'submissions'), where('kpiId', 'in', submissionKpiIds));
  }, [firestore, submissionKpiIds]);

  const { data: submissions, isLoading: isSubmissionsLoading } = useCollection<WithId<KpiSubmission>>(submissionsQuery);

  const submissionsMap = useMemo(() => {
      const map = new Map<string, WithId<KpiSubmission>>();
      if (submissions) {
          // Get the most recent submission for each KPI
          submissions.forEach(s => {
              if (!map.has(s.kpiId) || s.submissionDate > map.get(s.kpiId)!.submissionDate) {
                  map.set(s.kpiId, s);
              }
          });
      }
      return map;
  }, [submissions]);

  // ==================== HANDLERS ====================

  const handleAgreeToKpi = async (kpiId: string, notes: string) => {
    if (!firestore || !user) return;
    try {
      const kpiRef = doc(firestore, 'individual_kpis', kpiId);
      setDocumentNonBlocking(kpiRef, {
        status: 'Agreed',
        employeeNotes: notes,
        rejectionReason: '', 
        agreedAt: serverTimestamp(),
      }, { merge: true });
      toast({
        title: "KPI Submitted for Approval! ✓",
        description: "Your manager has been notified and will review your commitment.",
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update KPI status", variant: 'destructive' });
    }
  };

  const handleAcknowledgeKpi = async (kpiId: string) => {
    if (!firestore) return;
    try {
      const kpiRef = doc(firestore, 'individual_kpis', kpiId);
      setDocumentNonBlocking(kpiRef, { status: 'In-Progress', acknowledgedAt: serverTimestamp() }, { merge: true });
      toast({ title: "KPI Acknowledged!", description: "The KPI is now active in your portfolio." });
    } catch (error) {
       toast({ title: "Error", description: "Failed to acknowledge KPI", variant: 'destructive' });
    }
  };

  const handleViewDetails = (kpi: WithId<IndividualKpi>) => {
    setSelectedKpi(kpi);
    setIsDetailDialogOpen(true);
  };
  
  // ==================== RENDER ====================

  const isLoading = isUserLoading || isKpisLoading || isProfileLoading || isEmployeesLoading || isSubmissionsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-6 w-1/2" />
        <div className="space-y-4 pt-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Please log in to view your KPI portfolio</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="fade-in space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">KPI Portfolio</h3>
        <p className="text-gray-600">
          Track and report results against your performance targets.
        </p>
      </div>
      
      <div className="space-y-8">
        {(teamMembers || []).map(employee => {
            const employeeKpis = kpis?.filter(k => k.employeeId === employee.id) || [];
            const needsActionCount = employeeKpis.filter(k => ['Draft', 'Rejected', 'Upper Manager Approval'].includes(k.status)).length;
            if (employeeKpis.length === 0) {
              return null; // Don't show employees with no KPIs for a cleaner view
            }

            return (
              <Collapsible key={employee.id} defaultOpen className="border rounded-lg">
                  <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 cursor-pointer bg-gray-50 rounded-t-lg">
                          <div className="flex items-center gap-3">
                              <Avatar>
                                  <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div>
                                  <p className="font-semibold">{employee.name}</p>
                                  <p className="text-sm text-muted-foreground">{employee.position}</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-4">
                              {needsActionCount > 0 && (
                                  <Badge variant="destructive">{needsActionCount} Action(s) Required</Badge>
                              )}
                              <div className="text-right hidden sm:block">
                                  <p className="font-semibold">{employeeKpis.length}</p>
                                  <p className="text-xs text-muted-foreground">Total KPIs</p>
                              </div>
                              <Button variant="ghost" size="sm" className="shrink-0">
                                  <ChevronsUpDown className="h-4 w-4" />
                              </Button>
                          </div>
                      </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="p-4">
                      {employeeKpis.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                              {employeeKpis.map(kpi => (
                                  <KpiProgressCard
                                      key={kpi.id}
                                      kpi={kpi}
                                      submission={submissionsMap.get(kpi.id)}
                                      onViewDetails={handleViewDetails}
                                      onAcknowledge={handleAcknowledgeKpi}
                                  />
                              ))}
                          </div>
                      ) : (
                          <p className="text-sm text-center text-gray-500 py-8">No KPIs assigned to this employee.</p>
                      )}
                  </CollapsibleContent>
              </Collapsible>
            )
        })}
      </div>

      <KpiDetailDialog
        kpi={selectedKpi}
        isOpen={isDetailDialogOpen}
        onClose={() => {
          setIsDetailDialogOpen(false);
          setSelectedKpi(null);
        }}
        onAgree={handleAgreeToKpi}
        canAgree={!!selectedKpi && ['Draft', 'Rejected'].includes(selectedKpi.status) && selectedKpi.employeeId === user.uid}
      />
    </div>
  );
}

    