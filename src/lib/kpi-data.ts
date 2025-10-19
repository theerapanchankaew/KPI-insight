import {
  LayoutGrid,
  Network,
  PlusSquare,
  BadgeCheck,
  FileText,
  Settings,
  DollarSign,
  Users,
  TrendingUp,
  Briefcase,
  ClipboardList,
  Building2,
  FileUp,
  User,
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
    label: 'Approvals',
    description: 'อนุมัติข้อมูล',
    icon: BadgeCheck,
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

export const summaryCardsData = [
  {
    title: 'Total Revenue',
    value: '฿2.45B',
    target: 'เป้า: ฿2.2B',
    trend: '+12.5%',
    trendDirection: 'up' as const,
    rag: 'green' as const,
    icon: DollarSign,
  },
  {
    title: 'Revenue per Head',
    value: '฿1.85M',
    target: 'เป้า: ฿2.0M',
    trend: '-2.1%',
    trendDirection: 'stable' as const,
    rag: 'yellow' as const,
    icon: Users,
  },
  {
    title: 'EBITDA %',
    value: '18.5%',
    target: 'เป้า: 15%',
    trendDirection: 'up' as const,
    rag: 'green' as const,
    icon: TrendingUp,
  },
  {
    title: 'HVA Count',
    value: '142',
    target: 'เป้า: 180',
    trend: '-8.5%',
    trendDirection: 'down' as const,
    rag: 'red' as const,
    icon: Briefcase,
  },
];

export const performanceChartData = {
  data: [
    { month: 'ม.ค.', Revenue: 160, EBITDA: 150 },
    { month: 'ก.พ.', Revenue: 140, EBITDA: 135 },
    { month: 'มี.ค.', Revenue: 120, EBITDA: 125 },
    { month: 'เม.ย.', Revenue: 100, EBITDA: 110 },
    { month: 'พ.ค.', Revenue: 80, EBITDA: 95 },
    { month: 'มิ.ย.', Revenue: 70, EBITDA: 85 },
    { month: 'ก.ค.', Revenue: 60, EBITDA: 75 },
    { month: 'ส.ค.', Revenue: 50, EBITDA: 65 },
  ],
  config: {
    Revenue: { label: 'Revenue', color: 'hsl(var(--chart-1))' },
    EBITDA: { label: 'EBITDA', color: 'hsl(var(--chart-2))' },
  },
};

export const ragStatusData = {
  statuses: [
    { name: 'Green', count: 12, color: 'hsl(var(--success))', className: 'bg-success' },
    { name: 'Amber', count: 5, color: 'hsl(var(--accent))', className: 'bg-accent' },
    { name: 'Red', count: 3, color: 'hsl(var(--destructive))', className: 'bg-destructive' },
  ],
};

export const recentAlertsData = [
  {
    message: 'HVA Count ต่ำกว่าเป้า',
    time: '2 ชม. ที่แล้ว',
    level: 'danger' as const,
  },
  {
    message: 'Revenue per Head ใกล้เป้า',
    time: '4 ชม. ที่แล้ว',
    level: 'warning' as const,
  },
  {
    message: 'EBITDA เกินเป้าหมาย',
    time: '6 ชม. ที่แล้ว',
    level: 'success' as const,
  },
];

export const departmentPerformanceData = [
  {
    name: 'Sales',
    percentage: '92%',
    kpis: '15/16 KPIs',
    colorClass: 'text-primary',
    icon: DollarSign,
    bgClass: 'bg-primary/10',
  },
  {
    name: 'Operations',
    percentage: '87%',
    kpis: '12/14 KPIs',
    colorClass: 'text-secondary',
    icon: ClipboardList,
    bgClass: 'bg-secondary/10',
  },
  {
    name: 'Corporate',
    percentage: '78%',
    kpis: '8/10 KPIs',
    colorClass: 'text-accent',
    icon: Building2,
    bgClass: 'bg-accent/10',
  },
];

export const kpiCascadeData = {
  corporate: {
    financial: [
      { name: 'Total Revenue (THB)', status: 'Green' as const, value: '฿2.45B', target: 'Target: ฿2.2B', progress: 111 },
      { name: 'EBITDA %', status: 'Green' as const, value: '18.5%', target: 'Target: 15%', progress: 123 },
    ],
    operational: [
      { name: 'HVA Count', status: 'Red' as const, value: '142', target: 'Target: 180', progress: 79 },
      { name: 'New Requests', status: 'Amber' as const, value: '1,247', target: 'Target: 1,500', progress: 83 },
    ],
    esg: [
      { name: 'ESG Articles/Month', status: 'Green' as const, value: '28', target: 'Target: 25', progress: 112 },
      { name: 'GHG Reduction %', status: 'Amber' as const, value: '8.2%', target: 'Target: 10%', progress: 82 },
    ]
  },
  department: [
    { 
      name: 'Sales Department',
      performance: '92%',
      borderColor: 'border-green-200',
      statusColor: 'bg-success/10 text-success',
      kpis: [
        { name: 'Revenue Target', value: '฿1.2B', parent: 'Parent: Total Revenue', borderColor: 'border-primary' },
        { name: 'Customer Acquisition', value: '450', parent: 'New customers', borderColor: 'border-secondary' },
      ]
    },
    { 
      name: 'Operations',
      performance: '87%',
      borderColor: 'border-blue-200',
      statusColor: 'bg-accent/10 text-accent',
      kpis: [
        { name: 'Process Efficiency', value: '87%', parent: 'Target: 90%', borderColor: 'border-accent' },
        { name: 'Quality Score', value: '94%', parent: 'Target: 92%', borderColor: 'border-success' },
      ]
    },
    { 
      name: 'Corporate Affairs',
      performance: '95%',
      borderColor: 'border-purple-200',
      statusColor: 'bg-success/10 text-success',
      kpis: [
        { name: 'ESG Compliance', value: '95%', parent: 'Target: 90%', borderColor: 'border-success' },
        { name: 'Stakeholder Engagement', value: '28', parent: 'Monthly articles', borderColor: 'border-primary' },
      ]
    },
  ],
  individual: [
    { name: 'สมชาย ใจดี', department: 'Sales', kpi: 'Monthly Revenue', status: '95%', statusColor: 'bg-success/10 text-success' },
    { name: 'สุดา สวยงาม', department: 'Operations', kpi: 'Process Efficiency', status: '82%', statusColor: 'bg-accent/10 text-accent' },
    { name: 'วิชัย ขยัน', department: 'Corporate', kpi: 'ESG Articles', status: '112%', statusColor: 'bg-success/10 text-success' },
  ]
};

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

export const kpiApprovalData = [
  {
    id: '1',
    name: 'Monthly Sales Revenue',
    priority: 'High Priority',
    priorityColor: 'secondary' as const,
    submittedBy: 'สมชาย ใจดี',
    department: 'Sales',
    value: '฿125M',
    target: '฿120M',
    notes: 'ยอดขายเดือนนี้เกินเป้าหมาย 4.2% จากการขายสินค้าใหม่และการขยายตลาด',
  },
  {
    id: '2',
    name: 'ESG Article Count',
    priority: 'Normal',
    priorityColor: 'success' as const,
    submittedBy: 'วิชัย ขยัน',
    department: 'Corporate Affairs',
    value: '28 บทความ',
    target: '25 บทความ',
    notes: 'เผยแพร่บทความ ESG ครบตามเป้า พร้อมเนื้อหาเพิ่มเติมเกี่ยวกับความยั่งยืน',
  },
];

export const kpiReportData = {
  monthly: {
    summary: {
      achieved: '15/20',
      avgPerformance: '89.2%',
      improvement: '+5.7%',
    },
    topPerformers: [
      { name: 'Total Revenue', department: 'Sales Department', performance: '111%', color: 'success' as const },
      { name: 'ESG Articles', department: 'Corporate Affairs', performance: '112%', color: 'secondary' as const },
      { name: 'EBITDA %', department: 'Finance', performance: '123%', color: 'primary' as const },
    ],
    detailed: [
      { kpi: 'Total Revenue', department: 'Sales', target: '฿2.2B', actual: '฿2.45B', achievement: 111, trend: '+12.5%', trendColor: 'success' as const },
      { kpi: 'EBITDA %', department: 'Finance', target: '15%', actual: '18.5%', achievement: 123, trend: '+3.2%', trendColor: 'success' as const },
      { kpi: 'HVA Count', department: 'Operations', target: '180', actual: '142', achievement: 79, trend: '-8.5%', trendColor: 'destructive' as const },
    ]
  },
  quarterly: {
    overall: '87.5%',
    achieved: '42/48',
    growth: '+15.2%',
  }
};

export const kpiPortfolioData = [
  { id: 'ind-kpi-1', kpi: 'Revenue Target (Domestic)', type: 'cascaded', weight: 40, target: '฿40M', status: 'Committed' },
  { id: 'ind-kpi-2', kpi: 'New Customer Acquisition', type: 'cascaded', weight: 30, target: '20 new clients', status: 'Committed' },
  { id: 'ind-kpi-3', kpi: 'On-time Report Submission', type: 'committed', weight: 15, target: '98% on-time', status: 'Pending' },
  { id: 'ind-kpi-4', kpi: 'Peer Training Sessions', type: 'committed', weight: 15, target: '2 sessions/quarter', status: 'Pending' },
];