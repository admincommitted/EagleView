import { useEffect, useState } from 'react';
import { Activity, BarChart2, DollarSign, Package, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { SelectBox } from '@/components/ui';
import { dashboardApi } from './DashboardParts/dashboardApi';
import { MetricCard } from './DashboardParts/MetricCard';
import { AgeingPanel, DebtorsPanel, LaneProfitPanel, LossJobsPanel, TopClientsPanel } from './DashboardParts/directorPanels';
import { money } from './DashboardParts/money';

const PERIODS = ['This Month (Sep 2026)', 'Last Month (Aug 2026)', 'Q2 (Jul - Sep 2026)', 'YTD (2026-2027)'];

const misErrorText = (error) => error.response?.data?.error || (error.response ? `HTTP ${error.response.status}` : error.message);

async function loadReceivables(asOn) {
  try {
    return await dashboardApi.receivablesOutstanding(asOn);
  } catch {
    return {};
  }
}

function useDirectorMis(fromDate, toDate) {
  const [mis, setMis] = useState(null);
  const [outstanding, setOutstanding] = useState(0);
  const [overdueRows, setOverdueRows] = useState([]);
  const [buckets, setBuckets] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [report, receivables] = await Promise.all([dashboardApi.misReport(fromDate, toDate), loadReceivables(toDate)]);
        if (report.success === false) throw new Error(report.error || 'HTTP 200');
        setMis(report);
        const rows = receivables.data || [];
        setOutstanding(rows.reduce((sum, row) => sum + (parseFloat(row.pending) || 0), 0));
        setOverdueRows(rows.filter((row) => row.overdueDays > 0).sort((first, second) => second.pending - first.pending).slice(0, 8));
        setBuckets(receivables.buckets || null);
        setLoadError('');
      } catch (error) {
        setMis(null);
        setLoadError(`Could not load the MIS: ${misErrorText(error)}`);
      }
    };
    load();
  }, [fromDate, toDate]);

  return { mis, outstanding, overdueRows, buckets, loadError };
}

const countJobs = (jobs, modePattern) => `${jobs.filter((job) => modePattern.test(job.mode)).length} jobs`;

export default function DirectorDashboard() {
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const [period, setPeriod] = useState(PERIODS[0]);
  const { mis, outstanding, overdueRows, buckets, loadError } = useDirectorMis(fromDate, toDate);

  const kpis = mis?.kpis || {};
  const jobs = mis?.jobs || [];

  return (
    <div className="tw:mx-auto tw:flex tw:min-h-screen tw:max-w-[1600px] tw:flex-col tw:gap-6 tw:bg-page tw:p-4 tw:md:p-6">
      <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <div>
          <h2 className="tw:m-0 tw:flex tw:items-center tw:gap-2.5 tw:text-[22px] tw:font-extrabold tw:tracking-tight tw:text-foreground tw:md:text-[28px]">
            <BarChart2 className="tw:size-7 tw:shrink-0 tw:text-primary" /> Director's MIS & Analytics
          </h2>
          <p className="tw:m-0 tw:mt-1 tw:text-sm tw:text-muted-foreground tw:md:ml-[38px]">Real-time business intelligence, profitability, and revenue leakage alerts.</p>
        </div>
        <SelectBox options={PERIODS} value={period} onValueChange={setPeriod} size="sm" className="tw:w-full tw:font-semibold tw:md:w-60" />
      </div>

      {loadError && <p role="alert" className="tw:m-0 tw:rounded-md tw:border tw:border-destructive/30 tw:bg-destructive/5 tw:px-3 tw:py-2 tw:text-entry tw:text-destructive">{loadError}</p>}

      <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:sm:grid-cols-2 tw:lg:grid-cols-3 tw:xl:grid-cols-5">
        <MetricCard label="Total Revenue" value={money(kpis.revenue)} icon={DollarSign} tone="blue">
          <span className="tw:flex tw:items-center tw:gap-1 tw:text-success"><TrendingUp className="tw:size-3.5" /> +12% vs last month</span>
        </MetricCard>
        <MetricCard label="Gross Profit" value={money(kpis.profit)} icon={Activity} tone="green" tint valueClassName="tw:text-success">
          <span className="tw:font-bold tw:text-success">Overall Margin: {kpis.marginPct != null ? kpis.marginPct : 0}%</span>
        </MetricCard>
        <MetricCard label="Air Volume" value={countJobs(jobs, /^A/i)} icon={Package} tone="violet">
          <span className="tw:flex tw:items-center tw:gap-1 tw:text-success"><TrendingUp className="tw:size-3.5" /> +5 Tons vs last month</span>
        </MetricCard>
        <MetricCard label="Sea Volume" value={countJobs(jobs, /^S/i)} icon={Package} tone="cyan">
          <span className="tw:flex tw:items-center tw:gap-1 tw:text-destructive"><TrendingDown className="tw:size-3.5" /> -2 TEUs vs last month</span>
        </MetricCard>
        <MetricCard label="A/R Outstanding" value={money(outstanding)} icon={Target} tone="amber">
          <span className="tw:text-destructive">32% is over 60 Days!</span>
        </MetricCard>
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:lg:grid-cols-2">
        <LaneProfitPanel lanes={mis?.lanes || []} />
        <TopClientsPanel clients={mis?.topClients || []} totalRevenue={kpis.revenue} />
      </div>

      {/* "Revenue leakage" is shown as the jobs that cost more than they billed: an estimated cost is never stored. */}
      <LossJobsPanel jobs={jobs.filter((job) => job.profit < 0)} unlinked={mis?.unlinked} />

      <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:lg:grid-cols-[1.2fr_1fr]">
        <DebtorsPanel rows={overdueRows} />
        <AgeingPanel buckets={buckets} outstanding={outstanding} />
      </div>
    </div>
  );
}
