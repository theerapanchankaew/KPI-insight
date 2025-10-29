
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  MessageSquare,
  Award,
  Target,
  TrendingUp,
  Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { kpiApprovalData } from '@/lib/data/approval-data';

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
  rejectionReason?: string;
  agreedAt?: any;
  reviewedAt?: any;
  acknowledgedAt?: any;
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

type IndividualKpi = (AssignedCascadedKpi | CommittedKpi) & { id: string };

interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  userId?: string;
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
    'Upper Manager Approval': <AlertCircle className="h-4 w-4" />,
    'Employee Acknowledged': <Award className="h-4 w-4" />,
    'Closed': <CheckCircle2 className="h-4 w-4" />,
    'Rejected': <AlertCircle className="h-4 w-4" />,
  };
  return icons[status] || icons['Draft'];
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

// ==================== KPI CARD COMPONENT ====================

const KpiCard = ({ 
  kpi, 
  onViewDetails,
  onAcknowledge,
}: { 
  kpi: IndividualKpi; 
  onViewDetails: (kpi: IndividualKpi) => void;
  onAcknowledge: (kpiId: string) => void;
}) => {

  const canAgree = kpi.status === 'Draft' || kpi.status === 'Rejected';
  const canAcknowledge = kpi.status === 'Upper Manager Approval';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 pr-2">
            <h4 className="font-semibold text-gray-900 mb-1">{kpi.kpiMeasure}</h4>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {kpi.type === 'cascaded' ? 'Cascaded' : 'Committed'}
              </Badge>
              <Badge className={cn("text-xs", getStatusColor(kpi.status))}>
                {getStatusIcon(kpi.status)}
                <span className="ml-1">{kpi.status}</span>
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{kpi.weight}%</div>
            <div className="text-xs text-gray-500">Weight</div>
          </div>
        </div>

        {kpi.type === 'cascaded' && (
          <div className="mb-3">
            <Label className="text-xs text-gray-500">Target</Label>
            <p className="text-sm font-semibold">{kpi.target}</p>
          </div>
        )}

        {kpi.type === 'committed' && (
          <div className="mb-3">
            <Label className="text-xs text-gray-500">Objective</Label>
            <p className="text-sm">{kpi.task}</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
            <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onViewDetails(kpi)}
            >
                <Eye className="mr-2 h-4 w-4" />
                View Details
            </Button>
            {canAgree && (
                 <Button 
                    size="sm" 
                    variant="default"
                    onClick={() => onViewDetails(kpi)}
                    className="bg-orange-500 hover:bg-orange-600"
                >
                    Review & Agree
                </Button>
            )}
            {canAcknowledge && (
                <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={() => onAcknowledge(kpi.id)}
                >
                   <Award className="mr-2 h-4 w-4" />
                   Acknowledge
                </Button>
            )}
        </div>
      </CardContent>
    </Card>
  );
};

// ==================== MAIN COMPONENT ====================

export default function MyPortfolioPage() {
  const { setPageTitle } = useAppLayout();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const [selectedKpi, setSelectedKpi] = useState<IndividualKpi | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  useEffect(() => {
    setPageTitle("My KPI Portfolio");
  }, [setPageTitle]);

  // Get employee profile
  const employeeQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'employees'), where('userId', '==', user.uid));
  }, [firestore, user]);
  
  const { data: employeeData } = useCollection<Employee>(employeeQuery);
  const employee = employeeData?.[0];

  // Get individual KPIs
  const kpisQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'individual_kpis'),
      where('employeeId', '==', user.uid)
    );
  }, [firestore, user]);

  const { data: kpis, isLoading: isKpisLoading } = useCollection<IndividualKpi>(kpisQuery);

  // Group KPIs by status
  const kpisByStatus = useMemo(() => {
    if (!kpis) return { draft: [], agreed: [], inProgress: [], completed: [], rejected: [] };
    
    return {
      draft: kpis.filter(k => k.status === 'Draft' || k.status === 'Rejected'),
      agreed: kpis.filter(k => k.status === 'Agreed'),
      inProgress: kpis.filter(k => ['In-Progress', 'Manager Review', 'Upper Manager Approval'].includes(k.status)),
      completed: kpis.filter(k => ['Employee Acknowledged', 'Closed'].includes(k.status)),
    };
  }, [kpis]);

  // Calculate total weight
  const totalWeight = useMemo(() => {
    if (!kpis) return 0;
    return kpis.reduce((sum, kpi) => sum + kpi.weight, 0);
  }, [kpis]);

  // Statistics
  const stats = useMemo(() => {
    if (!kpis) return { total: 0, agreed: 0, pending: 0, completed: 0 };
    
    return {
      total: kpis.length,
      agreed: kpis.filter(k => k.status !== 'Draft' && k.status !== 'Rejected').length,
      pending: kpisByStatus.draft.length,
      completed: kpisByStatus.completed.length,
    };
  }, [kpis, kpisByStatus]);

  // ==================== HANDLERS ====================

  const handleAgreeToKpi = async (kpiId: string, notes: string) => {
    if (!firestore || !user) {
      toast({ title: "Error", description: "Unable to agree to KPI", variant: 'destructive' });
      return;
    }

    try {
      const kpiRef = doc(firestore, 'individual_kpis', kpiId);
      await setDocumentNonBlocking(kpiRef, {
        status: 'Agreed',
        employeeNotes: notes,
        rejectionReason: '', // Clear previous rejection reason
        agreedAt: new Date(),
      }, { merge: true });

      toast({
        title: "KPI Submitted for Approval! ✓",
        description: "Your manager has been notified and will review your commitment.",
        duration: 5000,
      });
    } catch (error) {
      console.error('Error agreeing to KPI:', error);
      toast({
        title: "Error",
        description: "Failed to update KPI status",
        variant: 'destructive',
      });
    }
  };

  const handleAcknowledgeKpi = async (kpiId: string) => {
    if (!firestore) return;
    try {
      const kpiRef = doc(firestore, 'individual_kpis', kpiId);
      await setDocumentNonBlocking(kpiRef, {
        status: 'In-Progress',
        acknowledgedAt: new Date(),
      }, { merge: true });
      toast({
        title: "KPI Acknowledged!",
        description: "The KPI is now active in your portfolio.",
      });
    } catch (error) {
       console.error('Error acknowledging to KPI:', error);
       toast({
        title: "Error",
        description: "Failed to acknowledge KPI",
        variant: 'destructive',
      });
    }
  };

  const handleViewDetails = (kpi: IndividualKpi) => {
    setSelectedKpi(kpi);
    setIsDetailDialogOpen(true);
  };

  // ==================== RENDER ====================

  if (isUserLoading || isKpisLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
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

  if (!employee && !isKpisLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No employee profile found for your user account.</p>
          <p className="text-sm text-gray-500 mt-2">Please contact your administrator to link your account.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="fade-in space-y-6">
      {/* Header Section */}
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">My KPI Portfolio</h3>
        <p className="text-gray-600">
          Review and manage your Key Performance Indicators
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total KPIs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Agreement</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Agreed/Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.agreed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Weight</p>
                <p className="text-2xl font-bold text-purple-600">{totalWeight}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
            { totalWeight > 100 ? (
                <div className='text-xs text-destructive mt-1'>Weight exceeds 100%</div>
            ) : (
                <Progress value={totalWeight} className="mt-2 h-2" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Required Alert */}
      {kpisByStatus.draft.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-orange-900">
                  Action Required: {kpisByStatus.draft.length} KPI(s) pending your agreement
                </p>
                <p className="text-sm text-orange-700 mt-1">
                  Review and agree to your assigned KPIs to activate them
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Tabs */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">
            Action Required
            {kpisByStatus.draft.length > 0 && (
              <Badge className="ml-2 bg-orange-500">{kpisByStatus.draft.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="active">
            Active / In Progress
            {kpisByStatus.inProgress.length > 0 && (
              <Badge className="ml-2 bg-yellow-500">{kpisByStatus.inProgress.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="all">All KPIs</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {kpisByStatus.draft.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <p className="text-gray-600">No pending KPIs</p>
                <p className="text-sm text-gray-500 mt-2">All your KPIs have been reviewed</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kpisByStatus.draft.map(kpi => (
                <KpiCard key={kpi.id} kpi={kpi} onViewDetails={handleViewDetails} onAcknowledge={handleAcknowledgeKpi} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="active" className="mt-6">
          {kpisByStatus.inProgress.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No active KPIs</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kpisByStatus.inProgress.map(kpi => (
                <KpiCard key={kpi.id} kpi={kpi} onViewDetails={handleViewDetails} onAcknowledge={handleAcknowledgeKpi} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {kpisByStatus.completed.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Award className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No completed KPIs</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kpisByStatus.completed.map(kpi => (
                <KpiCard key={kpi.id} kpi={kpi} onViewDetails={handleViewDetails} onAcknowledge={handleAcknowledgeKpi} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          {!kpis || kpis.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Target className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No KPIs assigned yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Your manager will assign KPIs to you soon
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kpis.map(kpi => (
                <KpiCard key={kpi.id} kpi={kpi} onViewDetails={handleViewDetails} onAcknowledge={handleAcknowledgeKpi} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail/Action Dialog */}
      <KpiDetailDialog
        kpi={selectedKpi}
        isOpen={isDetailDialogOpen}
        onClose={() => {
          setIsDetailDialogOpen(false);
          setSelectedKpi(null);
        }}
        onAgree={handleAgreeToKpi}
        canAgree={!!selectedKpi && (selectedKpi.status === 'Draft' || selectedKpi.status === 'Rejected')}
      />
    </div>
  );
}

