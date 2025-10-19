import {
    DollarSign,
    Users,
    TrendingUp,
    Briefcase,
    ClipboardList,
    Building2,
  } from 'lucide-react';
  
  export const summaryCardsData = [
    {
      title: 'Total Revenue',
      value: '฿2.45B',
      target: 'เป้า: ฿2.2B',
      trend: { value: '+12.5%', direction: 'up' as const, color: 'text-success' },
      rag: {
        bg: 'bg-success/10',
        icon: 'text-success',
      },
      icon: DollarSign,
    },
    {
      title: 'Revenue per Head',
      value: '฿1.85M',
      target: 'เป้า: ฿2.0M',
      trend: { value: '-2.1%', direction: 'down' as const, color: 'text-accent' },
      rag: {
        bg: 'bg-accent/10',
        icon: 'text-accent',
      },
      icon: Users,
    },
    {
      title: 'EBITDA %',
      value: '18.5%',
      target: 'เป้า: 15%',
      trend: { value: '+3.5%', direction: 'up' as const, color: 'text-success' },
      rag: {
        bg: 'bg-success/10',
        icon: 'text-success',
      },
      icon: TrendingUp,
    },
    {
      title: 'HVA Count',
      value: '142',
      target: 'เป้า: 180',
      trend: { value: '-8.5%', direction: 'down' as const, color: 'text-destructive' },
      rag: {
        bg: 'bg-destructive/10',
        icon: 'text-destructive',
      },
      icon: Briefcase,
    },
  ];
  
  export const performanceChartData = {
    data: [
      { month: 'Jan', Revenue: 160, EBITDA: 150 },
      { month: 'Feb', Revenue: 140, EBITDA: 135 },
      { month: 'Mar', Revenue: 180, EBITDA: 165 },
      { month: 'Apr', Revenue: 170, EBITDA: 155 },
      { month: 'May', Revenue: 210, EBITDA: 190 },
      { month: 'Jun', Revenue: 200, EBITDA: 185 },
      { month: 'Jul', Revenue: 230, EBITDA: 210 },
      { month: 'Aug', Revenue: 245, EBITDA: 220 },
    ],
    config: {
      Revenue: { label: 'Revenue', color: 'hsl(var(--chart-1))' },
      EBITDA: { label: 'EBITDA', color: 'hsl(var(--chart-2))' },
    },
  };
    
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