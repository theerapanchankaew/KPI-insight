import {
  LayoutGrid,
  Network,
  PlusSquare,
  BadgeCheck,
  FileText,
  Settings,
  FileUp,
  User,
  ShieldCheck,
} from 'lucide-react';

export const appConfig = {
  title: 'Win-Win KPI',
  companyName: 'บริษัท ABC จำกัด',
  ceoName: 'คุณสมชาย ผู้บริหาร',
  ceoTitle: 'CEO',
};

export const navItems = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    description: 'ภาพรวม KPI',
    icon: LayoutGrid,
  },
  {
    href: '/cascade',
    label: 'Cascade KPI',
    description: 'โครงสร้าง KPI',
    icon: Network,
  },
  {
    href: '/portfolio',
    label: 'My Portfolio',
    description: 'KPI ของฉัน',
    icon: User,
  },
  {
    href: '/submit',
    label: 'Submit KPI',
    description: 'ส่งข้อมูล',
    icon: PlusSquare,
  },
  {
    href: '/approvals',
    label: 'Action Center',
    description: 'อนุมัติและจัดการ',
    icon: ShieldCheck,
  },
  {
    href: '/reports',
    label: 'Reports',
    description: 'รายงานผล',
    icon: FileText,
  },
  {
    href: '/kpi-import',
    label: 'Intake Data',
    description: 'นำเข้าข้อมูล',
    icon: FileUp,
  },
  {
    href: '/settings',
    label: 'Settings',
    description: 'การตั้งค่า',
    icon: Settings,
  },
];

export const headerData = {
  currentPeriod: 'งวดปัจจุบัน: Q4 2024',
  alertCount: 3,
};
