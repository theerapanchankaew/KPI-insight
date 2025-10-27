
// This file is now deprecated as the portfolio data is fetched live from Firestore.
// It is kept for reference but is no longer used by the application.
export const kpiPortfolioData = [
  { id: 'ind-kpi-1', kpi: 'Revenue Target (Domestic)', type: 'cascaded', weight: 40, target: '฿40M', status: 'Committed', notes: 'I will focus on the new product line to achieve this.' },
  { id: 'ind-kpi-2', kpi: 'New Customer Acquisition', type: 'cascaded', weight: 30, target: '20 new clients', status: 'Approved', notes: '' },
  { id: 'ind-kpi-3', kpi: 'On-time Report Submission', type: 'committed', weight: 15, target: '98% on-time', status: 'Pending', notes: '' },
  { id: 'ind-kpi-4', kpi: 'Peer Training Sessions', type: 'committed', weight: 15, target: '2 sessions/quarter', status: 'Pending', notes: '' },
  { id: 'ind-kpi-5', kpi: 'Customer Satisfaction Score (CSAT)', type: 'cascaded', weight: 20, target: '4.5/5', status: 'Rejected', rejectionReason: "Target is not achievable with current resources.", notes: "Target is not achievable with current resources." },
];

    