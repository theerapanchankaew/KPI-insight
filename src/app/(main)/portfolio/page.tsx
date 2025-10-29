
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Clock, AlertCircle, Check, Send, Edit, UserCheck, ShieldCheck } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useUser, useFirestore, useCollection, useMemoFirebase, WithId } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Skeleton } from '@/components/ui/skeleton';

// Define the shape of an individual KPI, consistent with cascade page
interface IndividualKpiBase {
    employeeId: string;
    kpiId: string;
    kpiMeasure: string;
    weight: number;
    status: 'Draft' | 'Agreed' | 'In-Progress' | 'Manager Review' | 'Upper Manager Approval' | 'Employee Acknowledged' | 'Closed' | 'Rejected';
    notes?: string;
    rejectionReason?: string;
}

interface AssignedCascadedKpi extends IndividualKpiBase {
    type: 'cascaded';
    target: string;
}

interface CommittedKpi extends IndividualKpiBase {
    type: 'committed';
    task: string;
    targets: { level1: string; level2: string; level3: string; level4: string; level5: string; };
}

type IndividualKpi = AssignedCascadedKpi | CommittedKpi;


const statusConfig: { [key in IndividualKpi['status']]: { icon: React.ElementType, color: string, label: string } } = {
    Draft: { icon: Edit, color: 'text-gray-500', label: 'Draft' },
    Agreed: { icon: UserCheck, color: 'text-blue-500', label: 'Pending Manager Agreement' },
    'In-Progress': { icon: Clock, color: 'text-accent', label: 'In Progress' },
    'Manager Review': { icon: ShieldCheck, color: 'text-primary', label: 'Manager Review' },
    'Upper Manager Approval': { icon: ShieldCheck, color: 'text-purple-500', label: 'Pending Final Approval' },
    'Employee Acknowledged': { icon: CheckCircle, color: 'text-teal-500', label: 'Acknowledged' },
    Closed: { icon: CheckCircle, color: 'text-success', label: 'Closed' },
    Rejected: { icon: AlertCircle, color: 'text-destructive', label: 'Rejected' },
};


const KpiActionDialog = ({ isOpen, onClose, kpi, onConfirm }: { 
    isOpen: boolean, 
    onClose: () => void, 
    kpi: WithId<IndividualKpi> | null, 
    onConfirm: (id: string, notes: string, newStatus: IndividualKpi['status']) => void,
}) => {
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen && kpi) {
            setNotes(kpi.notes || '');
        }
    }, [isOpen, kpi]);

    if (!kpi) return null;

    // The action from this dialog is for the employee to agree to a Draft/Rejected KPI
    const nextStatus: IndividualKpi['status'] = 'Agreed';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Review KPI: {kpi.type === 'committed' ? kpi.task : kpi.kpiMeasure}</DialogTitle>
                    <DialogDescription>
                        Review and agree to your KPI. This will be sent to your manager for final agreement.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="p-4 bg-gray-50/50 rounded-lg space-y-2 border">
                        <p><strong>Type:</strong> <Badge variant={kpi.type === 'cascaded' ? 'secondary' : 'default'}>{kpi.type}</Badge></p>
                        <p><strong>Measure:</strong> {kpi.kpiMeasure}</p>
                        <p><strong>Weight:</strong> {kpi.weight}%</p>
                        <p><strong>Target:</strong> {kpi.type === 'cascaded' ? kpi.target : '5-level scale'}</p>
                        {kpi.status === 'Rejected' && kpi.rejectionReason && (
                             <div className="bg-destructive/10 p-3 rounded-md">
                                <p className="text-sm text-destructive"><strong>Manager Feedback:</strong> {kpi.rejectionReason}</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes for Manager</Label>
                        <Textarea
                            id="notes"
                            placeholder="Add any comments or questions for your manager here. A reason is required if you are requesting a change."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                     <p className="text-xs text-gray-600">By clicking "Agree & Submit," you agree to the terms of this KPI and send it for manager review.</p>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={() => onConfirm(kpi.id, notes, nextStatus)} className="bg-primary hover:bg-primary/90">
                        <Send className="w-4 h-4 mr-2" />
                        Agree & Submit
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function PortfolioPage() {
    const { setPageTitle } = useAppLayout();
    const { toast } = useToast();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [selectedKpi, setSelectedKpi] = useState<WithId<IndividualKpi> | null>(null);

    useEffect(() => {
        setPageTitle('My Portfolio');
    }, [setPageTitle]);

    const userKpisQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'individual_kpis'), where('employeeId', '==', user.uid));
    }, [firestore, user]);

    const { data: portfolioData, isLoading: isPortfolioLoading } = useCollection<IndividualKpi>(userKpisQuery);
    
    const handleReviewClick = (kpi: WithId<IndividualKpi>) => {
        setSelectedKpi(kpi);
        setIsActionModalOpen(true);
    };
    
    // Per SRS, employee acknowledges the final approval from upper management
    const handleAcknowledge = (kpiId: string) => {
        if (!firestore) return;
        const kpiRef = doc(firestore, 'individual_kpis', kpiId);
        setDocumentNonBlocking(kpiRef, { status: 'In-Progress' }, { merge: true });
        toast({
            title: `KPI In Progress`,
            description: `You have acknowledged the approved KPI. It is now active.`,
        });
    }

    const handleConfirmAction = (kpiId: string, notes: string, newStatus: IndividualKpi['status']) => {
        if (!firestore) return;
        const kpiRef = doc(firestore, 'individual_kpis', kpiId);
        const kpiToUpdate = portfolioData?.find(k => k.id === kpiId);
        if (kpiToUpdate) {
            // Employee is agreeing to the KPI, clearing any previous rejection reason
            const updatedData: Partial<IndividualKpi> = { status: newStatus, notes, rejectionReason: '' };
            
            setDocumentNonBlocking(kpiRef, updatedData, { merge: true });
            
            toast({
                title: `KPI Status Updated`,
                description: `The KPI has been moved to the '${statusConfig[newStatus].label}' state and sent for manager review.`,
            });
            setIsActionModalOpen(false);
        }
    };
    
    const isLoading = isUserLoading || isPortfolioLoading;


    return (
        <div className="fade-in space-y-6">
            <div>
                <h3 className="text-xl font-semibold text-gray-800">My Individual Portfolio</h3>
                <p className="text-gray-600 mt-1">ภาพรวม KPI ที่ได้รับมอบหมายและสถานะการ Commitment</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>My Assigned KPIs</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>KPI / Task</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Weight</TableHead>
                                <TableHead>Target</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                [...Array(4)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : portfolioData && portfolioData.length > 0 ? (
                                portfolioData.map(kpi => {
                                    const config = statusConfig[kpi.status] || statusConfig.Draft;
                                    const { icon: Icon, color, label } = config;
                                    // Per SRS, employee action needed on Draft or Rejected
                                    const canReview = kpi.status === 'Draft' || kpi.status === 'Rejected';
                                    // Per SRS, employee acknowledges after Upper Manager Approval
                                    const canAcknowledge = kpi.status === 'Upper Manager Approval';

                                    return (
                                        <TableRow key={kpi.id}>
                                            <TableCell className="font-medium">{kpi.type === 'committed' ? kpi.task : kpi.kpiMeasure}</TableCell>
                                            <TableCell>
                                                <Badge variant={kpi.type === 'cascaded' ? 'secondary' : 'default'}>{kpi.type}</Badge>
                                            </TableCell>
                                            <TableCell>{kpi.weight}%</TableCell>
                                            <TableCell>{kpi.type === 'cascaded' ? kpi.target : "5-level scale"}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center">
                                                    <Icon className={`w-4 h-4 mr-2 ${color}`} />
                                                    <span>{label}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {canReview ? (
                                                    <Button size="sm" onClick={() => handleReviewClick(kpi)}>
                                                        Review & Agree
                                                    </Button>
                                                ) : canAcknowledge ? (
                                                     <Button size="sm" variant="secondary" onClick={() => handleAcknowledge(kpi.id)}>
                                                        <Check className="w-4 h-4 mr-1"/> Acknowledge
                                                    </Button>
                                                ) : (
                                                    <Button size="sm" variant="outline" disabled>
                                                        No Action Needed
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                               <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                                        You have no KPIs assigned to your portfolio yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            
            <KpiActionDialog
                isOpen={isActionModalOpen}
                onClose={() => setIsActionModalOpen(false)}
                kpi={selectedKpi}
                onConfirm={handleConfirmAction}
            />
        </div>
    );
}
