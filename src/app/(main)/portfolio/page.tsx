
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAppLayout } from '../layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Clock, AlertCircle, Check, X, ShieldCheck } from 'lucide-react';
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
    status: 'Pending' | 'Committed' | 'Approved' | 'Rejected';
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


const statusConfig = {
    Committed: { icon: ShieldCheck, color: 'text-primary' },
    Pending: { icon: Clock, color: 'text-accent' },
    Rejected: { icon: AlertCircle, color: 'text-destructive' },
    Approved: { icon: CheckCircle, color: 'text-success' },
};

const KpiCommitDialog = ({ isOpen, onClose, kpi, onConfirm, onReject }: { 
    isOpen: boolean, 
    onClose: () => void, 
    kpi: WithId<IndividualKpi> | null, 
    onConfirm: (id: string, notes: string) => void, 
    onReject: (id: string, notes: string) => void 
}) => {
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen && kpi) {
            setNotes(kpi.notes || kpi.rejectionReason || '');
        }
    }, [isOpen, kpi]);

    if (!kpi) return null;

    const isRejectDisabled = notes.trim() === '';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Review KPI: {kpi.type === 'committed' ? kpi.task : kpi.kpiMeasure}</DialogTitle>
                    <DialogDescription>
                        Please review and confirm your commitment, or provide a reason for rejection. This action is between you (Individual) and your Manager.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="p-4 bg-gray-50/50 rounded-lg space-y-2 border">
                        <p><strong>Type:</strong> <Badge variant={kpi.type === 'cascaded' ? 'secondary' : 'default'}>{kpi.type}</Badge></p>
                        <p><strong>Measure:</strong> {kpi.kpiMeasure}</p>
                        <p><strong>Weight:</strong> {kpi.weight}%</p>
                        <p><strong>Target:</strong> {kpi.type === 'cascaded' ? kpi.target : '5-level scale'}</p>
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes for Manager</Label>
                        <Textarea
                            id="notes"
                            placeholder="Add any comments or questions for your manager here. A reason is required if you are rejecting."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                     <p className="text-xs text-gray-600">By clicking "Confirm Commitment," you agree to work towards the set target. This will be sent to your manager for final agreement.</p>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={() => onReject(kpi.id, notes)} variant="destructive" disabled={isRejectDisabled}>
                        <X className="w-4 h-4 mr-2" />
                        Reject
                    </Button>
                    <Button onClick={() => onConfirm(kpi.id, notes)} className="bg-primary hover:bg-primary/90">
                        <Check className="w-4 h-4 mr-2" />
                        Confirm Commitment
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
    
    const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
    const [selectedKpi, setSelectedKpi] = useState<WithId<IndividualKpi> | null>(null);

    useEffect(() => {
        setPageTitle('My Portfolio');
    }, [setPageTitle]);

    const userKpisQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        // In a real app, we'd get the employee ID from the user's profile.
        // For now, we'll assume the user's display name matches the employee name for demo purposes.
        // A more robust solution would be linking user.uid to an employee document.
        // Let's assume we have user's employee ID, which is just user.uid for simplicity now.
        return query(collection(firestore, 'individual_kpis'), where('employeeId', '==', user.uid));
    }, [firestore, user]);

    const { data: portfolioData, isLoading: isPortfolioLoading } = useCollection<IndividualKpi>(userKpisQuery);
    
    const handleReviewClick = (kpi: WithId<IndividualKpi>) => {
        setSelectedKpi(kpi);
        setIsCommitModalOpen(true);
    };

    const handleConfirmCommitment = (kpiId: string, notes: string) => {
        if (!firestore) return;
        const kpiRef = doc(firestore, 'individual_kpis', kpiId);
        const kpiToUpdate = portfolioData?.find(k => k.id === kpiId);
        if (kpiToUpdate) {
            const updatedData = { ...kpiToUpdate, status: 'Committed' as const, notes, rejectionReason: '' };
            setDocumentNonBlocking(kpiRef, updatedData, { merge: true });
            
            toast({
                title: "KPI Committed",
                description: "Your commitment has been sent to your manager for final agreement.",
            });
            setIsCommitModalOpen(false);
        }
    };
    
    const handleRejectCommitment = (kpiId: string, reason: string) => {
        if (!firestore) return;
        const kpiRef = doc(firestore, 'individual_kpis', kpiId);
        const kpiToUpdate = portfolioData?.find(k => k.id === kpiId);
        if (kpiToUpdate) {
            const updatedData = { ...kpiToUpdate, status: 'Rejected' as const, notes: reason, rejectionReason: reason };
            setDocumentNonBlocking(kpiRef, updatedData, { merge: true });

            toast({
                title: "KPI Rejected",
                description: "This KPI has been flagged for renegotiation.",
                variant: "destructive"
            });
            setIsCommitModalOpen(false);
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
                    <CardTitle>My Assigned KPIs - 2024</CardTitle>
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
                                    const config = statusConfig[kpi.status] || statusConfig.Pending;
                                    const { icon: Icon, color } = config;
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
                                                    <span>{kpi.status}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {kpi.status === 'Pending' || kpi.status === 'Rejected' ? (
                                                    <Button size="sm" onClick={() => handleReviewClick(kpi)}>
                                                        Review
                                                    </Button>
                                                ) : (
                                                    <Button size="sm" variant="outline" disabled>
                                                        {kpi.status === 'Committed' ? 'Pending Agreement' : 'Agreed'}
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
            
            <KpiCommitDialog
                isOpen={isCommitModalOpen}
                onClose={() => setIsCommitModalOpen(false)}
                kpi={selectedKpi}
                onConfirm={handleConfirmCommitment}
                onReject={handleRejectCommitment}
            />
        </div>
    );
}

    