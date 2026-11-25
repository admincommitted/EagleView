import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Briefcase, CheckCircle, Clock, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, DataTable, Input } from '@/components/ui';
import { errorMessage } from '@/services/axiosInstance';
import { dashboardApi } from './DashboardParts/dashboardApi';
import { MetricCard } from './DashboardParts/MetricCard';
import { ExpiringWarranties } from './DashboardParts/ExpiringWarranties';

const STATUS_BADGES = {
  DRAFT: { variant: 'neutral' },
  SUBMITTED: { variant: 'info' },
  QUERY_RAISED: { variant: 'danger' },
  ASSESSED: { variant: 'neutral', className: 'tw:border-violet-500/25 tw:bg-violet-500/10 tw:text-violet-600' },
  DUTY_PAID: { variant: 'warning' },
  OOC: { variant: 'success' },
};

const toCount = (value) => Number(value) || 0;

// The summary has no assessed / duty_paid counts on newer servers; it sends total instead.
const totalJobs = (summary) => (summary.total !== undefined
  ? toCount(summary.total)
  : toCount(summary.draft) + toCount(summary.submitted) + toCount(summary.query_raised) + toCount(summary.assessed) + toCount(summary.duty_paid) + toCount(summary.ooc));

const STAT_TILES = [
  { label: 'Total Jobs', value: totalJobs, icon: Briefcase, tone: 'blue', trend: 'Live', trendUp: true },
  { label: 'Pending Submissions', value: (summary) => summary.draft, icon: Clock, tone: 'amber', trend: 'Action', trendUp: false },
  { label: 'Queries Raised', value: (summary) => summary.query_raised, icon: AlertTriangle, tone: 'red', trend: 'Attention', trendUp: false },
  { label: 'OOC Given', value: (summary) => summary.ooc, icon: CheckCircle, tone: 'green', trend: 'Cleared', trendUp: true },
];

const formatDate = (value) => new Date(value).toLocaleDateString('en-GB');

const JOB_COLUMNS = [
  { key: 'jobNo', header: 'Job No', className: 'tw:font-semibold tw:text-primary' },
  { key: 'boeType', header: 'BOE Type' },
  { key: 'importerName', header: 'Importer', cell: (job) => job.importerName || 'N/A' },
  { key: 'igmNo', header: 'IGM No', cell: (job) => job.igmNo || 'N/A' },
  { key: 'jobDate', header: 'Job Date', cell: (job) => formatDate(job.jobDate) },
  {
    key: 'status',
    header: 'Status',
    cell: (job) => {
      const badge = STATUS_BADGES[job.status] || STATUS_BADGES.DRAFT;
      return <Badge variant={badge.variant} className={badge.className}>{job.status}</Badge>;
    },
  },
];

const matchesSearch = (job, search) => !search || [job.jobNo, job.boeType, job.importerName, job.igmNo]
  .some((value) => String(value || '').toLowerCase().includes(search.toLowerCase()));

async function exportJobsExcel(jobs) {
  if (!jobs.length) return;
  const XLSX = await import('xlsx');
  const rows = jobs.map((job) => ({
    'Job No': job.jobNo,
    Type: job.boeType,
    Importer: job.importerName || '',
    'IGM No': job.igmNo || '',
    Date: job.jobDate ? formatDate(job.jobDate) : '',
    Status: job.status || '',
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Recent jobs');
  XLSX.writeFile(workbook, `recent-jobs-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function useDashboardData() {
  const [summary, setSummary] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [expiringAssets, setExpiringAssets] = useState([]);

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        setExpiringAssets(await dashboardApi.expiringAssets());
      } catch (error) {
        console.error('Alerts error:', errorMessage(error));
      }
    };
    const loadTracking = async () => {
      try {
        const data = await dashboardApi.liveTracking();
        if (!data.success) return;
        setSummary(data.summary);
        setRecentJobs(data.recentJobs || []);
      } catch (error) {
        console.error(errorMessage(error));
      }
    };
    loadAlerts();
    loadTracking();
  }, []);

  return { summary, recentJobs, expiringAssets };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { summary, recentJobs, expiringAssets } = useDashboardData();
  const [jobFilter, setJobFilter] = useState('');
  const shownJobs = recentJobs.filter((job) => matchesSearch(job, jobFilter));

  return (
    <div className="tw:flex tw:min-h-full tw:flex-col tw:gap-6 tw:rounded-xl tw:bg-page tw:p-2 tw:md:gap-8">
      <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <div>
          <h1 className="tw:m-0 tw:text-[1.75rem] tw:font-extrabold tw:tracking-tight tw:text-foreground">Dashboard</h1>
          <p className="tw:m-0 tw:mt-1 tw:text-[13px] tw:text-muted-foreground">Welcome back. Here is the operational overview.</p>
        </div>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
          <Input
            data-allow-text
            leftIcon={Search}
            value={jobFilter}
            onChange={(event) => setJobFilter(event.target.value)}
            placeholder="Search job no / importer / IGM"
            className="tw:h-8 tw:w-full tw:sm:w-[250px]"
          />
          <Button size="lg" variant="default" onClick={() => navigate('/job-entry')}>+ New Job</Button>
        </div>
      </div>

      {summary && (
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:xl:grid-cols-4 tw:xl:gap-6">
          {STAT_TILES.map((tile) => (
            <MetricCard key={tile.label} label={tile.label} value={tile.value(summary)} icon={tile.icon} tone={tile.tone}>
              <Badge variant={tile.trendUp ? 'success' : 'danger'}>
                {tile.trendUp ? <TrendingUp /> : <TrendingDown />} {tile.trend}
              </Badge>
            </MetricCard>
          ))}
        </div>
      )}

      <ExpiringWarranties assets={expiringAssets} />

      <Card className="tw:p-2 tw:md:p-4">
        <CardHeader className="tw:flex-wrap tw:border-b tw:border-border tw:pb-3">
          <CardTitle className="tw:text-sm tw:text-foreground">Live ICEGATE Pipeline / Job Tracking</CardTitle>
          <Button variant="secondary" onClick={() => exportJobsExcel(shownJobs)}>Export Excel</Button>
        </CardHeader>
        <CardContent className="tw:pt-3">
          <DataTable
            columns={JOB_COLUMNS}
            rows={shownJobs}
            emptyText={recentJobs.length === 0 ? 'No recent jobs found.' : 'No job matches the search.'}
          />
        </CardContent>
      </Card>
    </div>
  );
}
