
import {
  LayoutGrid,
  Network,
  PlusSquare,
  ShieldCheck,
  FileText,
  Settings,
  Database,
  Target
} from 'lucide-react';

export const appConfig = {
  title: 'KPI Insights',
  companyName: 'บริษัท ABC จำกัด',
  ceoName: 'คุณสมชาย ผู้บริหาร',
  ceoTitle: 'CEO',
};

// This now serves as a master list for the UI, but permissions are controlled by roles in Firestore.
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
    icon: Target,
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
    href: '/master-data',
    label: 'Master Data',
    description: 'จัดการข้อมูลหลัก',
    icon: Database,
  },
  {
    href: '/settings',
    label: 'System Administration',
    description: 'การตั้งค่าระบบ',
    icon: Settings,
  },
];

export const headerData = {
  currentPeriod: 'งวดปัจจุบัน: Q4 2024',
  alertCount: 3,
};
