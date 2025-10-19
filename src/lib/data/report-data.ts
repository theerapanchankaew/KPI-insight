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
