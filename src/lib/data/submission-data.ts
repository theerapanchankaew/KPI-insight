import { FileText, BadgeCheck, Briefcase } from 'lucide-react';

export const kpiSubmissionData = {
  stats: [
    { label: 'Pending', value: 8, color: 'text-secondary', icon: FileText, iconBg: 'bg-secondary/10' },
    { label: 'Approved', value: 15, color: 'text-success', icon: BadgeCheck, iconBg: 'bg-success/10' },
    { label: 'Rejected', value: 2, color: 'text-destructive', icon: Briefcase, iconBg: 'bg-destructive/10' },
    { label: 'Draft', value: 5, color: 'text-gray-500', icon: FileText, iconBg: 'bg-gray-500/10' },
  ],
  submissions: [
    { kpiName: 'Monthly Revenue', submittedBy: 'สมชาย ใจดี', department: 'Sales', value: '฿125M', status: 'Pending', submittedAt: '2 ชม. ที่แล้ว', statusColor: 'secondary' as const },
    { kpiName: 'Process Efficiency', submittedBy: 'สุดา สวยงาม', department: 'Operations', value: '87%', status: 'Approved', submittedAt: '1 วัน ที่แล้ว', statusColor: 'success' as const },
  ],
};
