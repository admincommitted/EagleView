import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Calendar, Download, IndianRupee, TrendingUp } from 'lucide-react';
import { Badge, Button, StatCard } from '@/components/ui';
import { errorMessage } from '@/services/axiosInstance';
import { dashboardApi } from './DashboardParts/dashboardApi';
import { ExpiringWarranties } from './DashboardParts/ExpiringWarranties';
import { CategorySpendChart, MonthTrendChart } from './DashboardParts/ExpenseCharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NO_CATEGORY = { category: 'None', expense: 0 };

const wholeRupees = (amount) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

async function loadExpiringAssets() {
  try {
    return await dashboardApi.expiringAssets();
  } catch {
    return [];
  }
}

function useExpenseData() {
  const [months, setMonths] = useState([]);
  const [categories, setCategories] = useState([]);
  const [expiringAssets, setExpiringAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [monthWise, categoryWise, assets] = await Promise.all([
          dashboardApi.monthWiseExpenses(),
          dashboardApi.categoryWiseExpenses(),
          loadExpiringAssets(),
        ]);
        setExpiringAssets(assets || []);
        setMonths(monthWise);
        setCategories(categoryWise);
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { months, categories, expiringAssets, loading, error };
}

async function exportApprovedExpenses() {
  try {
    const orders = await dashboardApi.purchaseOrders();
    const rows = orders.filter((order) => order.status === 'Approved').map((order) => ({
      'PO Number': order.poNumber,
      Date: new Date(order.date).toLocaleDateString('en-GB'),
      Category: order.category || 'Other',
      'Vendor Name': order.Vendor ? order.Vendor.vendorName : 'N/A',
      Branch: order.branch || 'Head Office',
      'Total Amount': parseFloat(order.totalAmount || 0),
      Status: order.status,
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Approved Expenses');
    XLSX.writeFile(workbook, 'Approved_Expenses_Report.xlsx');
  } catch (error) {
    console.error(errorMessage(error));
    toast.error('Failed to generate Excel report');
  }
}

export default function AdminDashboard() {
  const { months, categories, expiringAssets, loading, error } = useExpenseData();

  const totalExpense = months.reduce((sum, month) => sum + (Number(month.expense) || 0), 0);
  const currentMonthName = MONTHS[new Date().getMonth()];
  const currentMonthExpense = months.find((month) => month.month === currentMonthName)?.expense || 0;
  const topCategory = categories.length > 0
    ? categories.reduce((top, category) => (top.expense > category.expense ? top : category))
    : NO_CATEGORY;

  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:px-3 tw:py-2">
      <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <h2 className="tw:m-0 tw:text-sm tw:font-semibold tw:text-foreground">Admin Dashboard</h2>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <Badge variant="outline" className="tw:rounded-sm tw:bg-card tw:px-2 tw:text-[11px] tw:font-normal tw:text-muted-foreground">
            Year-to-Date ({new Date().getFullYear()})
          </Badge>
          <Button variant="default" onClick={exportApprovedExpenses}><Download /> Export to Excel</Button>
        </div>
      </div>

      {loading && <p className="tw:m-0 tw:flex tw:h-[200px] tw:items-center tw:justify-center tw:text-base tw:text-muted-foreground">Loading analytics...</p>}

      {!loading && error && (
        <div className="tw:rounded-sm tw:border tw:border-destructive/30 tw:bg-destructive/5 tw:p-4 tw:text-destructive">{error}</div>
      )}

      {!loading && !error && (
        <>
          <ExpiringWarranties assets={expiringAssets} emptyText="No items expiring soon. All warranties are safe!" />

          <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] tw:gap-2">
            <StatCard tone="primary" icon={IndianRupee} label="Total Approved Expenses" value={wholeRupees(totalExpense)} />
            <StatCard tone="success" icon={Calendar} label={`${currentMonthName} Expenses`} value={wholeRupees(currentMonthExpense)} />
            <StatCard
              tone="warning"
              icon={TrendingUp}
              label="Highest Spend Category"
              value={(
                <>
                  {topCategory.category}
                  <span className="tw:mt-1 tw:block tw:text-entry tw:font-semibold tw:text-muted-foreground">{wholeRupees(topCategory.expense)}</span>
                </>
              )}
            />
          </div>

          <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:lg:grid-cols-[2fr_1fr]">
            <MonthTrendChart months={months} />
            <CategorySpendChart categories={categories} />
          </div>
        </>
      )}
    </div>
  );
}
