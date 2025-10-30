
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
  TrendingDown,
  CalendarDays,
  RefreshCw,
  Edit,
  PlusCircle,
  BadgeCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase, WithId, useDoc, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useKpiData } from '@/context/KpiDataContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { format } from 'date-fns';

// ==================== TYPE DEFINITIONS ====================

interface IndividualKpiBase {
  employeeId: string;
  employeeName: string;
  department: string;
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
  corporateKpiId: string;
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
    id: string;
    kpiId: string;
    actualValue: string;
    submissionDate: any;
    status: string;
}

interface MonthlyKpi {
  id: string;
  parentKpiId: string;
  month: number;
  year: number;
  target: number;
  actual: number;
}

interface AppUser {
  role: 'Admin' | 'VP' | 'AVP' | 'Manager' | 'Employee';
  department: string;
}

interface Employee {
    id: string;
    name: string;
    position: string;
    department: string;
}

// ==================== UTILITY FUNCTIONS ====================
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const getStatusColor = (status: IndividualKpi['status']) => {
  const colors = {
    'Draft': 'bg-gray-100 text-gray-800 border-gray-300',
    'Agreed': 'bg-blue-100 text-blue-800 border-blue-300',
    'In-Progress': 'bg-green-100 text-green-800 border-green-300',
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
    'Upper Manager Approval': <Eye className="h-4 w-4" />,
    'Employee Acknowledged': <Award className="h-4 w-4" />,
    'Closed': <CheckCircle2 className="h-4 w-4" />,
    'Rejected': <AlertCircle className="h-4 w-4" />,
  };
  return icons[status] || icons['Draft'];
};

const parseValue = (value: string | number) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;
    return parseFloat(value.replace(/[^0-9.-]+/g, "")) || 0;
};

// ==================== DIALOGS ====================

const CreateCommittedKpiDialog = ({
    isOpen,
    onClose,
    onCreate,
    teamMembers,
    currentUserId,
    isManager
}: {
    isOpen: boolean,
    onClose: () => void,
    onCreate: (kpi: Omit<CommittedKpi, 'id' | 'status' | 'kpiId'>) => void,
    teamMembers: Employee[],
    currentUserId: string,
    isManager: boolean
}) => {
    const [employeeId, setEmployeeId] = useState(currentUserId);
    const [task, setTask] = useState('');
    const [weight, setWeight] = useState('');
    const [targets, setTargets] = useState({ level1: '', level2: '', level3: '', level4: '', level5: '' });
    const { toast } = useToast();
    const { orgData } = useKpiData();

    useEffect(() => {
        if (!isManager) {
            setEmployeeId(currentUserId);
        }
    }, [isManager, currentUserId]);
    
    useEffect(() => {
        if (isOpen) {
            // Reset state when dialog opens
            setTask('');
            setWeight('');
            setTargets({ level1: '', level2: '', level3: '', level4: '', level5: '' });
            if (isManager) {
                setEmployeeId(''); // Force manager to select
            } else {
                setEmployeeId(currentUserId);
            }
        }
    }, [isOpen, isManager, currentUserId]);

    const handleCreate = () => {
        if (!task || !weight || !employeeId) {
            toast({
              title: "Missing Information",
              description: "Please fill out the Task, Weight, and assign the KPI to an employee.",
              variant: "destructive"
            });
            return;
        }

        const employee = orgData?.find(e => e.id === employeeId);
        if (!employee) {
             toast({ title: "Employee not found", variant: "destructive"});
             return;
        }
        
        onCreate({
            employeeId,
            employeeName: employee.name,
            department: employee.department,
            kpiMeasure: task,
            weight: Number(weight),
            type: 'committed',
            task,
            targets: {
                level1: targets.level1,
                level2: targets.level2,
                level3: targets.level3,
                level4: targets.level4,
                level5: targets.level5,
            }
        });
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create New Committed KPI</DialogTitle>
                    <DialogDescription>Define a new individual or department-specific KPI with a 5-level performance scale.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    {isManager && (
                        <div className="space-y-2">
                            <Label htmlFor="employee-select">Assign To</Label>
                            <Select value={employeeId} onValueChange={setEmployeeId}>
                                <SelectTrigger id="employee-select">
                                    <SelectValue placeholder="Select an employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {teamMembers.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="grid grid-cols-5 gap-4">
                        <div className="space-y-2 col-span-4">
                            <Label htmlFor="task">Task / KPI Measure</Label>
                            <Input id="task" value={task} onChange={e => setTask(e.target.value)} placeholder="e.g., Improve internal process for X" />
                        </div>
                         <div className="space-y-2 col-span-1">
                            <Label htmlFor="weight">Weight (%)</Label>
                            <Input id="weight" type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g., 15" />
                        </div>
                    </div>
                    <div>
                        <Label>5-Level Performance Targets</Label>
                        <div className="space-y-2 mt-2">
                            {Object.keys(targets).map((level, i) => (
                                <div key={level} className="flex items-center gap-3">
                                    <Label className="w-24 text-sm text-right">Level {i+1}</Label>
                                    <Input 
                                        value={targets[level as keyof typeof targets]}
                                        onChange={e => setTargets(prev => ({...prev, [level]: e.target.value}))}
                                        placeholder={`Description for level ${i+1} performance...`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleCreate}>Create Draft KPI</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const EditKpiDialog = ({
    isOpen,
    onClose,
    kpi,
    onSave
}: {
    isOpen: boolean;
    onClose: () => void;
    kpi: WithId<IndividualKpi> | null;
    onSave: (kpiId: string, updates: Partial<IndividualKpi>) => void;
}) => {
    const [weight, setWeight] = useState('');
    const [cascadedTarget, setCascadedTarget] = useState('');
    // Add state for other editable fields if needed, e.g., committed task or targets

    useEffect(() => {
        if (kpi) {
            setWeight(String(kpi.weight || ''));
            if (kpi.type === 'cascaded') {
                setCascadedTarget(kpi.target);
            }
        }
    }, [kpi]);

    const handleSave = () => {
        if (!kpi) return;
        const updates: Partial<IndividualKpi> = {
            weight: Number(weight)
        };
        if (kpi.type === 'cascaded') {
            updates.target = cascadedTarget;
        }
        // Add logic to update other fields for committed KPIs if necessary
        onSave(kpi.id, updates);
        onClose();
    };

    if (!kpi) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit KPI: {kpi.kpiMeasure}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Weight (%)</Label>
                        <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} />
                    </div>
                     {kpi.type === 'cascaded' && (
                         <div className="space-y-2">
                            <Label>Target</Label>
                            <Input value={cascadedTarget} onChange={e => setCascadedTarget(e.target.value)} />
                        </div>
                     )}
                     {kpi.type === 'committed' && (
                         <p className="text-sm text-muted-foreground">Editing 5-level targets for committed KPIs would be done here.</p>
                     )}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const MonthlyReportDialog = ({
  isOpen,
  onClose,
  kpi,
  monthlyData,
}: {
  isOpen: boolean;
  onClose: () => void;
  kpi: WithId<IndividualKpi> | null;
  monthlyData: WithId<MonthlyKpi>[];
}) => {
  if (!kpi) return null;

  const dataForKpi = monthlyData
    .filter(m => kpi.type === 'cascaded' && m.parentKpiId === kpi.corporateKpiId)
    .sort((a, b) => a.month - b.month);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Monthly Report: {kpi.kpiMeasure}</DialogTitle>
          <DialogDescription>
            Detailed monthly performance breakdown for this KPI.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {kpi.type === 'cascaded' && dataForKpi.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Achievement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataForKpi.map(month => {
                  const achievement = month.target > 0 ? (month.actual / month.target) * 100 : 0;
                  return (
                    <TableRow key={month.id}>
                      <TableCell className="font-medium">{MONTH_NAMES[month.month - 1]}</TableCell>
                      <TableCell className="text-right">{month.target.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{month.actual.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={achievement >= 100 ? 'success' : 'destructive'}>{achievement.toFixed(1)}%</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No monthly data deployed for this KPI.</p>
            </div>
          )}
           {kpi.type === 'committed' && (
             <div className="text-center py-8 text-gray-500">
               <p>Monthly reporting is not applicable for 'Committed' KPIs.</p>
               <p className="text-sm">Achievement is based on the 5-level scale submission.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


const KpiDetailDialog = ({
  kpi,
  isOpen,
  onClose,
  onAgree,
  onAcknowledge,
  canAgree,
  canAcknowledge,
}: {
  kpi: IndividualKpi | null;
  isOpen: boolean;
  onClose: () => void;
  onAgree: (kpiId: string, notes: string) => void;
  onAcknowledge: (kpiId: string) => void;
  canAgree: boolean;
  canAcknowledge: boolean;
}) => {
  const [employeeNotes, setEmployeeNotes] = useState('');
  
  // This hook needs to be at the top level
  const sortedTargetEntries = useMemo(() => {
    if (!kpi || kpi.type !== 'committed' || !kpi.targets) return [];
    // Sort keys like 'level1', 'level2' numerically
    return Object.entries(kpi.targets).sort(([keyA], [keyB]) => {
        const numA = parseInt(keyA.replace('level', ''), 10);
        const numB = parseInt(keyB.replace('level', ''), 10);
        return numA - numB;
    });
  }, [kpi]);

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

  const handleAcknowledge = () => {
    onAcknowledge(kpi.id);
    onClose();
  };
  
  const isRejected = kpi.status === 'Rejected';

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'MMM dd, yyyy, hh:mm a');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon(kpi.status)}
            {canAcknowledge ? "Acknowledge Approved KPI" : canAgree ? (isRejected ? "Revise & Resubmit KPI" : "Review & Agree to KPI") : "KPI Details"}
          </DialogTitle>
          <DialogDescription>
            Review your assigned KPI and the communication trail.
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
                      {sortedTargetEntries.map(([level, target], idx) => (
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
              
              {kpi.rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <Label className="text-xs text-red-700 font-semibold flex items-center justify-between">
                        <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" />Manager's Rejection Reason</span>
                        <span>{formatDate(kpi.reviewedAt)}</span>
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

              {kpi.employeeNotes && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <Label className="text-xs text-green-700 font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />Your Agreement Notes</span>
                    <span>{formatDate(kpi.agreedAt)}</span>
                  </Label>
                  <p className="text-sm text-gray-700 mt-1">{kpi.employeeNotes}</p>
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

        <DialogFooter className="flex gap-2 pt-4">
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          {canAcknowledge && (
            <Button onClick={handleAcknowledge} className="bg-blue-600 hover:bg-blue-700">
                <Award className="mr-2 h-4 w-4" />
                Acknowledge & Start KPI
            </Button>
          )}
          {canAgree && (
            <Button onClick={handleAgree} className={isRejected ? "bg-orange-500 hover:bg-orange-600" : "bg-green-600 hover:bg-green-700"}>
                {isRejected ? <RefreshCw className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {isRejected ? "Resubmit to Manager" : "Agree & Submit to Manager"}
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
  onViewMonthlyReport,
  onEdit,
}: { 
  kpi: WithId<IndividualKpi>; 
  submission: WithId<KpiSubmission> | undefined;
  onViewDetails: (kpi: WithId<IndividualKpi>) => void;
  onViewMonthlyReport: (kpi: WithId<IndividualKpi>) => void;
  onEdit: (kpi: WithId<IndividualKpi>) => void;
}) => {
  
  const { targetValue, actualValue, achievement, isPositive } = useMemo(() => {
    let targetNum = 0;
    let actualNum = 0;

    if (kpi.type === 'cascaded') {
      targetNum = parseValue(kpi.target);
      actualNum = submission ? parseValue(submission.actualValue) : 0;
    }
    // For 'committed' KPIs, a numeric progress might not be applicable in the same way.
    // We can show a placeholder or a different kind of progress.
    const ach = targetNum > 0 ? (actualNum / targetNum) * 100 : 0;
    const isPos = actualNum >= targetNum;

    return { 
        targetValue: kpi.type === 'cascaded' ? kpi.target : '5-Level Scale', 
        actualValue: submission?.actualValue ?? 'Not Submitted', 
        achievement: ach, 
        isPositive: isPos
    };
  }, [kpi, submission]);
  
  const getActionButtons = () => {
    // Show 'Acknowledge' button if status is 'Upper Manager Approval'
    if (kpi.status === 'Upper Manager Approval') {
        return (
          <Button size="sm" variant="default" onClick={() => onViewDetails(kpi)} className="bg-blue-600 hover:bg-blue-700">
              <Award className="mr-2 h-4 w-4" />
              Acknowledge
          </Button>
        );
    }
    // Show 'Review' button for Draft and Rejected states
    if (['Draft', 'Rejected'].includes(kpi.status)) {
        return (
          <Button size="sm" variant="default" onClick={() => onViewDetails(kpi)}>
              <Eye className="mr-2 h-4 w-4" />
              Review
          </Button>
        );
    }
    
    // For all other statuses, show a generic 'Details' button
    return (
       <Button size="sm" variant="outline" onClick={() => onViewDetails(kpi)}>
          <Eye className="mr-2 h-4 w-4" />
          Details
      </Button>
    );
  };


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
            <Button size="sm" variant="ghost" onClick={() => onViewMonthlyReport(kpi)}>
              <CalendarDays className="mr-2 h-4 w-4" />
              Monthly Report
            </Button>
            {getActionButtons()}
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
  const { orgData: allEmployees, isOrgDataLoading: isEmployeesLoading, monthlyKpisData, isMonthlyKpisLoading } = useKpiData();

  const [selectedKpi, setSelectedKpi] = useState<WithId<IndividualKpi> | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isMonthlyReportOpen, setMonthlyReportOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);

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
    return allEmployees.filter(emp => emp.id === user.uid);
  }, [isManagerOrAdmin, allEmployees, userProfile, user]);

  
  const kpiQueryIds = useMemo(() => {
    if (teamMembers.length === 0) return null;
    const ids = teamMembers.map(tm => tm.id);
    return ids.length > 0 ? ids.slice(0, 30) : null; // Firestore 'in' query limit is 30
  }, [teamMembers]);


  const kpisQuery = useMemoFirebase(() => {
    if (!firestore || !kpiQueryIds) return null;
    // Show all KPIs for the user/team regardless of status to give a full picture.
    return query(collection(firestore, 'individual_kpis'), where('employeeId', 'in', kpiQueryIds));
  }, [firestore, kpiQueryIds]);

  const { data: kpis, isLoading: isKpisLoading } = useCollection<WithId<IndividualKpi>>(kpisQuery);
  
  const submissionKpiIds = useMemo(() => {
    if(!kpis || kpis.length === 0) return null;
    const ids = kpis.map(k => k.id);
    return ids.length > 0 ? ids.slice(0,30) : null;
  }, [kpis]);

  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore || !submissionKpiIds) return null;
    return query(collection(firestore, 'submissions'), where('kpiId', 'in', submissionKpiIds));
  }, [firestore, submissionKpiIds]);

  const { data: submissions, isLoading: isSubmissionsLoading } = useCollection<WithId<KpiSubmission>>(submissionsQuery);

  const submissionsMap = useMemo(() => {
      const map = new Map<string, WithId<KpiSubmission>>();
      if (submissions) {
          submissions.forEach(s => {
              if (!map.has(s.kpiId) || s.submissionDate > map.get(s.kpiId)!.submissionDate) {
                  map.set(s.kpiId, s);
              }
          });
      }
      return map;
  }, [submissions]);

  // ==================== HANDLERS ====================

  const handleCreateCommittedKpi = (kpiData: Omit<CommittedKpi, 'id' | 'status' | 'kpiId'>) => {
    if (!firestore) return;
    
    const newKpi: Omit<IndividualKpi, 'id'> = {
        ...kpiData,
        kpiId: `committed_${Date.now()}`, // Unique ID for this committed KPI
        status: 'Draft',
    };
    
    addDocumentNonBlocking(collection(firestore, 'individual_kpis'), newKpi);
    
    toast({
        title: "Committed KPI Created",
        description: `A new draft KPI "${kpiData.task}" has been created.`,
    });
  };

  const handleAgreeToKpi = async (kpiId: string, notes: string) => {
    if (!firestore || !user) return;
    try {
      const kpiRef = doc(firestore, 'individual_kpis', kpiId);
      setDocumentNonBlocking(kpiRef, {
        status: 'Manager Review',
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
  
  const handleViewMonthlyReport = (kpi: WithId<IndividualKpi>) => {
    setSelectedKpi(kpi);
    setMonthlyReportOpen(true);
  };

  const handleEdit = (kpi: WithId<IndividualKpi>) => {
    setSelectedKpi(kpi);
    setEditDialogOpen(true);
  };

  const handleSaveKpi = (kpiId: string, updates: Partial<IndividualKpi>) => {
      if (!firestore) {
          toast({ title: "Error", description: "Firestore not available", variant: 'destructive' });
          return;
      }
      const kpiRef = doc(firestore, 'individual_kpis', kpiId);
      setDocumentNonBlocking(kpiRef, updates, { merge: true });
      toast({ title: "KPI Updated", description: "The KPI details have been saved."});
  };

  // ==================== RENDER ====================

  const isLoading = isUserLoading || isKpisLoading || isProfileLoading || isEmployeesLoading || isSubmissionsLoading || isMonthlyKpisLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-6 w-72" />
            </div>
            <Skeleton className="h-10 w-36" />
        </div>
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
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">Portfolio</h3>
            <p className="text-gray-600">
              {isManagerOrAdmin ? "Review and manage your team's KPI portfolio." : "Review and manage your personal KPIs for this period."}
            </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Committed KPI
        </Button>
      </div>
      
      <div className="space-y-8">
        {(teamMembers || []).map(employee => {
            const employeeKpis = kpis?.filter(k => k.employeeId === employee.id) || [];
            const totalWeight = employeeKpis.reduce((sum, kpi) => sum + kpi.weight, 0);

            if (teamMembers.length > 1 && employeeKpis.length === 0 && !isManagerOrAdmin) {
              return null; // Don't show employees with no KPIs for a cleaner view unless it's a manager looking
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
                              <div className="text-right hidden sm:block">
                                  <p className="font-semibold">{totalWeight}%</p>
                                  <p className="text-xs text-muted-foreground">Total Weight</p>
                              </div>
                               <div className="text-right hidden sm:block">
                                  <p className="font-semibold">{employeeKpis.length}</p>
                                  <p className="text-xs text-muted-foreground">Total KPIs</p>                              </div>
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
                                      onViewMonthlyReport={handleViewMonthlyReport}
                                      onEdit={handleEdit}
                                  />
                              ))}
                          </div>
                      ) : (
                         <div className="text-center py-10">
                            <Target className="h-12 w-12 text-gray-300 mx-auto mb-4"/>
                            <h4 className="font-semibold">{isManagerOrAdmin ? 'No KPIs assigned to this employee' : 'No KPIs assigned yet'}</h4>
                            <p className="text-sm text-muted-foreground">{isManagerOrAdmin ? 'Use the "Cascade" page to assign KPIs.' : 'Your manager will assign KPIs to you soon.'}</p>
                         </div>
                      )}
                  </CollapsibleContent>
              </Collapsible>
            )
        })}
      </div>
      
      <CreateCommittedKpiDialog 
        isOpen={isCreateDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={handleCreateCommittedKpi}
        teamMembers={teamMembers}
        currentUserId={user.uid}
        isManager={isManagerOrAdmin || false}
      />

      <KpiDetailDialog
        kpi={selectedKpi}
        isOpen={isDetailDialogOpen}
        onClose={() => {
          setIsDetailDialogOpen(false);
          setSelectedKpi(null);
        }}
        onAgree={handleAgreeToKpi}
        onAcknowledge={handleAcknowledgeKpi}
        canAgree={!!selectedKpi && ['Draft', 'Rejected'].includes(selectedKpi.status) && selectedKpi.employeeId === user.uid}
        canAcknowledge={!!selectedKpi && selectedKpi.status === 'Upper Manager Approval' && selectedKpi.employeeId === user.uid}
      />
      
      <MonthlyReportDialog
        isOpen={isMonthlyReportOpen}
        onClose={() => {
            setMonthlyReportOpen(false);
            setSelectedKpi(null);
        }}
        kpi={selectedKpi}
        monthlyData={monthlyKpisData || []}
      />
      
      <EditKpiDialog 
        isOpen={isEditDialogOpen}
        onClose={() => {
            setEditDialogOpen(false);
            setSelectedKpi(null);
        }}
        kpi={selectedKpi}
        onSave={handleSaveKpi}
      />

    </div>
  );
}
