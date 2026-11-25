import axiosInstance from '@/services/axiosInstance';

const getData = async (url, config) => (await axiosInstance.get(url, config)).data;

export const dashboardApi = {
  liveTracking: () => getData('/dashboard/live-tracking'),
  expiringAssets: () => getData('/assets/alerts/expiring'),
  misReport: (from, to) => getData('/reports/mis', { params: { from, to } }),
  receivablesOutstanding: (asOn) => getData('/vouchers/outstanding', { params: { type: 'receivable', asOn } }),
  monthWiseExpenses: () => getData('/po/dashboard/month-wise-expenses'),
  categoryWiseExpenses: () => getData('/po/dashboard/category-wise-expenses'),
  purchaseOrders: () => getData('/po'),
};

export { getData };
