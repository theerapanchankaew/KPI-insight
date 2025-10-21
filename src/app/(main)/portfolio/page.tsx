
"use client";

import React, { useEffect, useState } from 'react';
import { useAppLayout } from '../layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { kpiPortfolioData } from '@/lib/data/portfolio-data';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Clock, AlertCircle, Check, X, ShieldCheck } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const statusConfig = {
    Committed: { icon: ShieldCheck, color: 'text-primary', badge: 'default' },
    Pending: { icon: Clock, color: 'text-accent', badge: 'warning' },
    Rejected: { icon: AlertCircle, color: 'text-destructive', badge: 'destructive' },
    Approved: { icon: CheckCircle, color: 'text-success', badge: 'success' },
};

const KpiCommitDialog = ({ isOpen, onClose, kpi, onConfirm, onReject }: { isOpen: boolean, onClose: () => void, kpi: any, onConfirm: (id: string, notes: string) => void, onReject: (id: string, notes: string) => void }) => {
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            setNotes(kpi?.notes || kpi?.rejectionReason || '');
        }
    }, [isOpen, kpi]);

    if (!kpi) return null;

    const isRejectDisabled = notes.trim() === '';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Review KPI: {kpi.kpi}</DialogTitle>
                    <DialogDescription>
                        Please review and confirm your commitment, or provide a reason for rejection. This action is between you (Individual) and your Manager.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="p-4 bg-gray-50/50 rounded-lg space-y-2 border">
                        <p><strong>Type:</strong> <Badge variant={kpi.type === 'cascaded' ? 'secondary' : 'default'}>{kpi.type}</Badge></p>
                        <p><strong>Measure:</strong> {kpi.kpi}</p>
                        <p><strong>Weight:</strong> {kpi.weight}%</p>
                        <p><strong>Target:</strong> {kpi.target}</p>
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
    
    const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
    const [selectedKpi, setSelectedKpi] = useState<any | null>(null);
    const [portfolioData, setPortfolioData] = useState(kpiPortfolioData);

    useEffect(() => {
        setPageTitle('My Portfolio');
    }, [setPageTitle]);
    
    const handleReviewClick = (kpi: any) => {
        setSelectedKpi(kpi);
        setIsCommitModalOpen(true);
    };

    const handleConfirmCommitment = (kpiId: string, notes: string) => {
        setPortfolioData(prevData =>
            prevData.map(kpi =>
                kpi.id === kpiId ? { ...kpi, status: 'Committed', notes, rejectionReason: '' } : kpi
            )
        );
        toast({
            title: "KPI Committed",
            description: "Your commitment has been sent to your manager for final agreement.",
        });
        setIsCommitModalOpen(false);
    };
    
    const handleRejectCommitment = (kpiId: string, reason: string) => {
        setPortfolioData(prevData =>
            prevData.map(kpi =>
                kpi.id === kpiId ? { ...kpi, status: 'Rejected', notes: reason, rejectionReason: reason } : kpi
            )
        );
        toast({
            title: "KPI Rejected",
            description: "This KPI has been flagged for renegotiation.",
            variant: "destructive"
        });
        setIsCommitModalOpen(false);
    };


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
                            {portfolioData.map(kpi => {
                                const config = statusConfig[kpi.status as keyof typeof statusConfig] || statusConfig.Pending;
                                const { icon: Icon, color, badge } = config;
                                return (
                                    <TableRow key={kpi.id}>
                                        <TableCell className="font-medium">{kpi.kpi}</TableCell>
                                        <TableCell>
                                            <Badge variant={kpi.type === 'cascaded' ? 'secondary' : 'default'}>{kpi.type}</Badge>
                                        </TableCell>
                                        <TableCell>{kpi.weight}%</TableCell>
                                        <TableCell>{kpi.target}</TableCell>
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
                                            )
                                          }
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
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
