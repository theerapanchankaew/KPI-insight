"use client";

import React, { useEffect, useState } from 'react';
import { useAppLayout } from '../layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { kpiPortfolioData } from '@/lib/kpi-data';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

const statusConfig = {
    Committed: { icon: CheckCircle, color: 'text-success', badge: 'success' },
    Pending: { icon: Clock, color: 'text-accent', badge: 'warning' },
    Rejected: { icon: AlertCircle, color: 'text-destructive', badge: 'destructive' },
};

const KpiCommitDialog = ({ isOpen, onClose, kpi, onConfirm }: { isOpen: boolean, onClose: () => void, kpi: any, onConfirm: (id: string) => void }) => {
    if (!kpi) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Commit to KPI: {kpi.kpi}</DialogTitle>
                    <DialogDescription>
                        Please review the details below and confirm your commitment to this KPI. This will be sent to your manager for final agreement.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="p-4 bg-gray-50/50 rounded-lg">
                        <p><strong>Type:</strong> <Badge variant={kpi.type === 'cascaded' ? 'secondary' : 'default'}>{kpi.type}</Badge></p>
                        <p><strong>Measure:</strong> {kpi.kpi}</p>
                        <p><strong>Weight:</strong> {kpi.weight}%</p>
                        <p><strong>Target:</strong> {kpi.target}</p>
                    </div>
                     <p className="text-sm text-gray-600">By clicking "Confirm Commitment," you agree that you understand this KPI and will work towards achieving the set target for the current performance period.</p>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={() => onConfirm(kpi.id)}>Confirm Commitment</Button>
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
    
    const handleCommitClick = (kpi: any) => {
        setSelectedKpi(kpi);
        setIsCommitModalOpen(true);
    };

    const handleConfirmCommitment = (kpiId: string) => {
        setPortfolioData(prevData =>
            prevData.map(kpi =>
                kpi.id === kpiId ? { ...kpi, status: 'Committed' } : kpi
            )
        );
        toast({
            title: "KPI Committed",
            description: "Your commitment has been sent to your manager for final agreement.",
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
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {portfolioData.map(kpi => {
                                const { icon: Icon, color, badge } = statusConfig[kpi.status as keyof typeof statusConfig];
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
                                        <TableCell>
                                            {kpi.status === 'Pending' ? (
                                                <Button size="sm" onClick={() => handleCommitClick(kpi)}>
                                                    Commit
                                                </Button>
                                            ) : (
                                                 <Button size="sm" variant="outline" disabled>Committed</Button>
                                            )}
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
            />
        </div>
    );
}