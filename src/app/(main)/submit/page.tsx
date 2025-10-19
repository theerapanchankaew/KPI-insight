"use client";

import React, { useEffect, useState } from 'react';
import { useAppLayout } from '../layout';
import { Button } from '@/components/ui/button';
import { Plus, FileText, BadgeCheck, Briefcase } from 'lucide-react';
import { kpiSubmissionData } from '@/lib/data/submission-data';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const SubmitKpiForm = ({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Submit New KPI</DialogTitle>
            </DialogHeader>
            <form id="submit-kpi-form" className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="submit-kpi-name">KPI Name</Label>
                        <Input id="submit-kpi-name" placeholder="e.g., Monthly Revenue" required />
                    </div>
                    <div>
                         <Label htmlFor="submit-kpi-category">Category</Label>
                        <Select>
                            <SelectTrigger id="submit-kpi-category"><SelectValue placeholder="Select Category" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="financial">Financial</SelectItem>
                                <SelectItem value="operational">Operational</SelectItem>
                                <SelectItem value="esg">ESG</SelectItem>
                                <SelectItem value="customer">Customer</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label htmlFor="submit-kpi-department">Department</Label>
                        <Select>
                            <SelectTrigger id="submit-kpi-department"><SelectValue placeholder="Select Department" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="sales">Sales</SelectItem>
                                <SelectItem value="operations">Operations</SelectItem>
                                <SelectItem value="corporate">Corporate Affairs</SelectItem>
                                <SelectItem value="finance">Finance</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="submit-kpi-level">Level</Label>
                        <Select>
                            <SelectTrigger id="submit-kpi-level"><SelectValue placeholder="Select Level" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="corporate">Corporate</SelectItem>
                                <SelectItem value="department">Department</SelectItem>
                                <SelectItem value="individual">Individual</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="submit-kpi-priority">Priority</Label>
                        <Select>
                            <SelectTrigger id="submit-kpi-priority"><SelectValue placeholder="Select Priority" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label htmlFor="submit-kpi-target">Target Value</Label>
                        <Input id="submit-kpi-target" type="number" placeholder="1000000" required />
                    </div>
                    <div>
                        <Label htmlFor="submit-kpi-actual">Actual Value</Label>
                        <Input id="submit-kpi-actual" type="number" placeholder="850000" required />
                    </div>
                    <div>
                        <Label htmlFor="submit-kpi-unit">Unit</Label>
                        <Input id="submit-kpi-unit" placeholder="THB, %, Count" required />
                    </div>
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit">Submit for Approval</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
)

const iconMap: { [key: string]: React.ElementType } = {
  Pending: FileText,
  Approved: BadgeCheck,
  Rejected: Briefcase,
  Draft: FileText,
};

export default function SubmitPage() {
  const { setPageTitle } = useAppLayout();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setPageTitle('Submit KPI');
  }, [setPageTitle]);

  return (
    <div className="fade-in space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">Submit KPI Data</h3>
          <p className="text-gray-600 mt-1">ส่งข้อมูล KPI สำหรับการอนุมัติ</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-5 h-5 mr-2" />
          Submit New KPI
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiSubmissionData.stats.map(stat => {
          const Icon = iconMap[stat.label];
          return (
            <Card key={stat.label} className="text-center">
              <CardContent className="p-6">
                <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3", stat.iconBg)}>
                  <Icon className={cn("w-6 h-6", stat.color)} />
                </div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b">
            <h4 className="text-lg font-semibold text-gray-800">Recent Submissions</h4>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI Name</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpiSubmissionData.submissions.map((sub, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{sub.kpiName}</TableCell>
                    <TableCell>{sub.submittedBy}</TableCell>
                    <TableCell>{sub.department}</TableCell>
                    <TableCell>{sub.value}</TableCell>
                    <TableCell><Badge variant={sub.statusColor}>{sub.status}</Badge></TableCell>
                    <TableCell>{sub.submittedAt}</TableCell>
                    <TableCell>
                      {sub.status === 'Pending' ? (
                        <>
                          <Button variant="link" className="p-0 h-auto text-secondary mr-3">Edit</Button>
                          <Button variant="link" className="p-0 h-auto text-destructive">Delete</Button>
                        </>
                      ) : (
                        <Button variant="link" className="p-0 h-auto text-gray-500">View</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <SubmitKpiForm open={isModalOpen} onOpenChange={setIsModalOpen} />
    </div>
  );
}
