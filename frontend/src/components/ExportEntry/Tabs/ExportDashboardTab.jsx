import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, Calculator, CheckCircle, Clock, FileText, Loader2, MessageCircle, Plane, Server, ShieldCheck, Zap } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';
import toast from 'react-hot-toast';
import ExportPenaltyCalculator from '../../ExportPenaltyCalculator';
import { askText } from '../../common/askConfirm';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { errorMessage } from '@/services/axiosInstance';
import { cn } from '@/lib/utils';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, SelectBox, StatCard, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { serverReply } from '../../JobEntry/JobEntryLayoutParts/serverReply';
import { exportEntryApi } from '../exportEntryApi';

// the LEO card and the "Cleared (LEO)" filter also count gate pass / departed / delivered
const AFTER_LEO = ['LEO', 'GATE_PASS', 'DEPARTED', 'DELIVERED'];
const isInStage = (job, stage) => stage === 'ALL' || (stage === 'LEO' ? AFTER_LEO.includes(job.macroStatus) : job.macroStatus === stage);

const STATUS_LABEL = { DRAFT: 'DRAFT', SUBMITTED: 'SB FILED', TD_DONE: 'TD DONE', XRAY_DONE: 'X-RAY DONE', LEO: 'LEO', GATE_PASS: 'GATE PASS', DEPARTED: 'DEPARTED', DELIVERED: 'DELIVERED', CANCELLED: 'CANCELLED' };
const STATUS_BADGE = { DRAFT: 'neutral', SUBMITTED: 'info', TD_DONE: 'info', XRAY_DONE: 'info', CANCELLED: 'danger' };
const statusLabel = (status) => STATUS_LABEL[status] || status;

const STAT_TILES = [
  { stage: 'DRAFT', label: 'Draft Jobs', countKey: 'draft', icon: FileText, tone: 'neutral' },
  { stage: 'SUBMITTED', label: 'SB Filed', countKey: 'submitted', icon: Plane, tone: 'primary' },
  { stage: 'TD_DONE', label: 'TD Completed', countKey: 'td_done', icon: Server, tone: 'primary' },
  { stage: 'XRAY_DONE', label: 'X-Ray Cleared', countKey: 'xray_done', icon: ShieldCheck, tone: 'primary' },
  { stage: 'LEO', label: 'LEO Issued', countKey: 'leo', icon: CheckCircle, tone: 'success' },
];

const STAGE_FILTERS = [
  { value: 'ALL', label: 'All Jobs' },
  { value: 'SUBMITTED', label: 'SB Filed' },
  { value: 'TD_DONE', label: 'TD Done' },
  { value: 'XRAY_DONE', label: 'X-Ray Done' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'LEO', label: 'Cleared (LEO)' },
];

const DISTRIBUTION = [
  { name: 'Draft', countKey: 'draft', color: '#94a3b8' },
  { name: 'SB Filed', countKey: 'submitted', color: '#0284c7' },
  { name: 'TD Done', countKey: 'td_done', color: '#0ea5e9' },
  { name: 'X-Ray', countKey: 'xray_done', color: '#6366f1' },
  { name: 'LEO', countKey: 'leo', color: '#65a30d' },
];
// recharts draws its tooltip with these style objects
const TOOLTIP_BOX = { fontSize: '10px', padding: '4px 8px', borderRadius: '4px' };
const TOOLTIP_ITEM = { color: '#333' };
const NO_DATA_SLICE = { name: 'No Data', value: 1, color: '#e2e8f0' };

const ACTIVITY_DOT = { STATUS: 'tw:bg-success', FILED: 'tw:bg-primary', REMARK: 'tw:bg-warning' };

// 05-Sep-2026; YYYYMMDD and ISO text both read
function displayDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  const date = compact ? new Date(+compact[1], +compact[2] - 1, +compact[3]) : new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
}

function displayWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toDateString() === new Date().toDateString() ? 'Today' : displayDate(date);
  return `${day} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

function useLiveTracking() {
  const activeBranch = useWorkspaceStore((state) => state.activeBranch);
  const activeYear = useWorkspaceStore((state) => state.activeYear);
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState({ counts: { draft: 0, td_done: 0, xray_done: 0, leo: 0 }, jobs: [], riskJobs: [], activity: [], otherJobs: 0, tat: null });

  const load = async (announce = false) => {
    setLoading(true);
    try {
      const params = {
        ...(activeBranch?.id && !activeBranch.isAll ? { branchId: activeBranch.id } : {}),
        ...(activeYear?.id ? { financialYearId: activeYear.id } : {}),
      };
      const data = await exportEntryApi.dashboardLiveTracking(params);
      if (data.success) {
        setBoard({
          counts: data.summary,
          jobs: data.recentJobs || [],
          riskJobs: data.riskJobs || [],
          activity: data.recentActivity || [],
          otherJobs: data.otherJobs || 0,
          // LEO given today: average hours from SB to LEO, worked out by the server from the real LEO times
          tat: data.tatToday?.count ? data.tatToday : null,
        });
        if (announce) toast.success('Dashboard refreshed');
      }
    } catch (error) {
      console.error(errorMessage(error));
      toast.error('Failed to load export metrics');
    } finally {
      setLoading(false);
    }
  };

  // only the selected branch / financial year (reloads when they change)
  useEffect(() => {
    load();
  }, [activeBranch?.id, activeYear?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { loading, board, reload: load };
}

async function sendLeoOnWhatsapp(job) {
  const partyName = job.exporterName || job.shipperName || '';
  const mobile = (await askText({
    title: 'Send LEO on WhatsApp',
    message: `Job ${job.jobNo}: LEO message to ${partyName || 'the exporter'}.`,
    label: 'WhatsApp number (with country code)',
    placeholder: 'e.g. 919812345678',
    okLabel: 'Send',
  }))?.trim();
  if (!mobile) return;
  try {
    const reply = await serverReply(exportEntryApi.sendWhatsapp({
      mobileNumber: mobile,
      partyName,
      refNo: job.sbNo || job.jobNo,
      statusText: `Job ${job.jobNo}: Shipping Bill ${job.sbNo || ''} - Let Export Order (LEO) given by Customs.`,
    }));
    if (reply.success) toast.success(`WhatsApp sent to ${mobile}`);
    else toast.error(`WhatsApp not sent: ${reply.error || 'check Settings > WhatsApp'}`);
  } catch (error) {
    toast.error(`WhatsApp not sent: ${errorMessage(error)}`);
  }
}

function JobCard({ job, onOpen }) {
  return (
    <Card className="tw:gap-2 tw:p-2.5 tw:transition-shadow tw:hover:shadow-md">
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-2">
        <div className="tw:min-w-0">
          <CardTitle className="tw:text-foreground">{job.jobNo || 'DRAFT'}</CardTitle>
          <div className="tw:mt-0.5 tw:text-[10px] tw:text-muted-foreground">
            {displayDate(job.jobDate || job.createdAt) || 'Recent'} · {job.shipmentMode === 'SEA' ? 'SEA' : 'AIR'}{job.destination ? ` · ${job.destination}` : ''}
          </div>
        </div>
        <Badge variant={STATUS_BADGE[job.status] || 'success'}>{statusLabel(job.status)}</Badge>
      </div>

      <div className="tw:flex tw:flex-col tw:gap-1 tw:text-[11px] tw:text-foreground/80">
        <div className="tw:truncate"><strong>Exporter:</strong> {job.exporterName || job.shipperName || 'N/A'}</div>
        {job.sbNo && <Badge variant="info" className="tw:rounded-sm">SB No: {job.sbNo}{job.sbDate ? ` / ${displayDate(job.sbDate)}` : ''}</Badge>}
        {job.leoDate && AFTER_LEO.includes(job.status) && <div className="tw:text-[10px] tw:font-semibold tw:text-success">LEO: {displayDate(job.leoDate)}</div>}
      </div>

      <div className="tw:mt-auto tw:flex tw:flex-wrap tw:gap-1.5">
        <Button className="tw:flex-1" onClick={onOpen}>Continue Job <ArrowRight /></Button>
        {AFTER_LEO.includes(job.status) && (
          <Button variant="success" className="tw:flex-1" onClick={(event) => { event.stopPropagation(); sendLeoOnWhatsapp(job); }}>
            <MessageCircle /> Send WhatsApp
          </Button>
        )}
      </div>
    </Card>
  );
}

function Pipeline({ loading, jobs, onOpenJob, stageFilter, onStageFilter, statusFilter, onStatusFilter }) {
  const statuses = [...new Set(jobs.map((job) => job.status))].filter(Boolean);
  const shown = jobs.filter((job) => isInStage(job, stageFilter) && (statusFilter === 'ALL' || job.status === statusFilter));

  return (
    <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-2">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
        <CardTitle className="tw:tracking-wide tw:uppercase">Current Pipeline</CardTitle>
        <div className="tw:flex tw:min-w-0 tw:max-w-full tw:flex-wrap tw:items-center tw:gap-2">
          <SelectBox
            className="tw:w-full tw:sm:w-56"
            value={statusFilter}
            onValueChange={onStatusFilter}
            options={[{ value: 'ALL', label: 'All statuses (deep filter)' }, ...statuses.map((status) => ({ value: status, label: statusLabel(status) }))]}
          />
          <Tabs value={stageFilter} onValueChange={onStageFilter} className="tw:min-w-0 tw:max-w-full">
            <TabsList variant="pill" className="tw:max-w-full tw:justify-start tw:overflow-x-auto">
              {STAGE_FILTERS.map((filter) => <TabsTrigger key={filter.value} value={filter.value} className="tw:text-[11px]">{filter.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {loading && <div className="tw:flex tw:justify-center tw:p-8"><Loader2 className="tw:size-6 tw:animate-spin tw:text-primary" /></div>}

      {!loading && shown.length === 0 && (
        <div className="tw:rounded-lg tw:border tw:border-dashed tw:border-input tw:bg-muted tw:p-8 tw:text-center">
          <p className="tw:m-0 tw:text-entry tw:text-muted-foreground">No jobs found for this filter.</p>
        </div>
      )}

      {!loading && shown.length > 0 && (
        <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] tw:gap-2.5">
          {shown.map((job) => <JobCard key={job.id} job={job} onOpen={() => onOpenJob(job.id)} />)}
        </div>
      )}
    </div>
  );
}

function RiskRadar({ riskJobs, onCalculate }) {
  return (
    <Card className="tw:border-destructive/30 tw:bg-destructive/5">
      <CardHeader><CardTitle icon={<AlertTriangle />} className="tw:text-destructive tw:uppercase">Financial Risk Radar</CardTitle></CardHeader>
      <CardContent>
        {riskJobs.length === 0 && (
          <div className="tw:flex tw:flex-col tw:items-center tw:gap-1 tw:rounded-md tw:border tw:border-dashed tw:border-success/40 tw:bg-success/5 tw:py-5 tw:text-success">
            <CheckCircle className="tw:size-5 tw:opacity-80" />
            <span className="tw:text-entry tw:font-semibold">ALL CLEAR</span>
            <span className="tw:text-[10px] tw:opacity-80">No Pending Penalties</span>
          </div>
        )}
        {riskJobs.map((risk, index) => {
          const isHigh = risk.severity === 'HIGH';
          return (
            <Button
              key={risk.id || index}
              size="block"
              title="Work out the penalty"
              onClick={() => onCalculate(risk.job)}
              className={cn('tw:justify-between tw:border-l-4 tw:bg-card tw:text-foreground tw:hover:shadow-md', isHigh ? 'tw:border-l-destructive' : 'tw:border-l-warning')}
            >
              <span className="tw:min-w-0">
                <span className="tw:block tw:font-bold">{risk.jobNo}</span>
                <span className="tw:block tw:text-[10px] tw:text-muted-foreground">{risk.warning}</span>
              </span>
              <Calculator className={isHigh ? 'tw:text-destructive' : 'tw:text-warning'} />
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function JobDistribution({ counts }) {
  const legend = DISTRIBUTION.map((slice) => ({ ...slice, value: counts[slice.countKey] || 0 }));
  const slices = legend.some((slice) => slice.value > 0) ? legend.filter((slice) => slice.value > 0) : [NO_DATA_SLICE];

  return (
    <Card>
      <CardHeader><CardTitle icon={<Activity />}>Job Distribution</CardTitle></CardHeader>
      <CardContent>
        <div className="tw:h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={slices} innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                {slices.map((slice) => <Cell key={slice.name} fill={slice.color} />)}
              </Pie>
              <ChartTooltip contentStyle={TOOLTIP_BOX} itemStyle={TOOLTIP_ITEM} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="tw:flex tw:flex-wrap tw:justify-center tw:gap-x-3 tw:gap-y-1">
          {legend.map((slice) => (
            <span key={slice.name} className="tw:inline-flex tw:items-center tw:gap-1 tw:text-[10px] tw:font-semibold tw:text-muted-foreground">
              <span className="tw:size-2 tw:rounded-[2px] tw:bg-(--slice)" style={{ '--slice': slice.color }} />
              {slice.name} {slice.value}
            </span>
          ))}
          {counts.cancelled > 0 && <span className="tw:text-[10px] tw:font-semibold tw:text-destructive">Cancelled {counts.cancelled}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityText({ event }) {
  if (event.kind === 'STATUS') return <>status <span className="tw:font-semibold">{event.text}</span></>;
  if (event.kind === 'REMARK') return <>remark: {event.text}</>;
  return event.text;
}

// timeline status / remarks, job created / saved / sent to ICEGATE (newest first)
function RecentActivity({ activity, onOpenJob }) {
  return (
    <Card className="tw:flex-1">
      <CardHeader><CardTitle icon={<Zap />}>Recent Activity</CardTitle></CardHeader>
      <CardContent className="tw:gap-1">
        {activity.length === 0 && <span className="tw:text-[11px] tw:text-muted-foreground">No recent activity.</span>}
        {activity.map((event, index) => (
          <Button key={`${event.jobId}-${index}`} variant="ghost" size="block" title="Open job" onClick={() => onOpenJob(event.jobId)} className="tw:gap-2.5 tw:px-1 tw:py-1">
            <span className={cn('tw:mt-1 tw:size-2.5 tw:shrink-0 tw:self-start tw:rounded-full', ACTIVITY_DOT[event.kind] || 'tw:bg-primary')} />
            <span className="tw:text-[11px] tw:leading-snug tw:text-foreground/80">
              <b className="tw:text-foreground">{event.jobNo || 'Draft'}</b>{' '}<ActivityText event={event} />
              <span className="tw:block tw:text-[9px] tw:text-muted-foreground">{displayWhen(event.at)}{event.by ? ` · ${event.by}` : ''}</span>
            </span>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function TatBanner({ tat }) {
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-md tw:border tw:border-primary/20 tw:bg-primary/10 tw:px-3 tw:py-1.5 tw:text-entry tw:font-semibold tw:text-head">
      <Clock className="tw:size-3.5" />
      Average Clearance TAT (Today):
      {tat ? (
        <>
          {` ${tat.hours} Hours from SB to LEO - ${tat.count} job${tat.count > 1 ? 's' : ''}`}
          <Badge variant={tat.hours < 24 ? 'success' : 'warning'}>{tat.hours < 24 ? 'Excellent' : 'Needs Attention'}</Badge>
        </>
      ) : ' No LEO given today'}
    </div>
  );
}

export default function ExportDashboardTab({ onOpenJob }) {
  const { loading, board, reload } = useLiveTracking();
  const [stageFilter, setStageFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [penalty, setPenalty] = useState({ open: false, job: null });

  const showStage = (stage) => { setStageFilter(stage); setStatusFilter('ALL'); };

  return (
    <div className="tw:flex tw:h-full tw:min-h-0 tw:flex-col tw:gap-4 tw:overflow-y-auto tw:p-1 tw:normal-case tw:lg:flex-row">
      <div className="tw:flex tw:min-w-0 tw:flex-none tw:flex-col tw:gap-3 tw:lg:flex-[3] tw:lg:overflow-y-auto">
        <div className="tw:grid tw:grid-cols-1 tw:gap-2.5 tw:sm:grid-cols-2 tw:lg:grid-cols-3 tw:xl:grid-cols-5">
          {STAT_TILES.map((tile) => (
            <StatCard
              key={tile.stage}
              label={tile.label}
              value={board.counts[tile.countKey] || 0}
              icon={tile.icon}
              tone={tile.tone}
              title={`Show ${tile.label.toLowerCase()}`}
              active={stageFilter === tile.stage}
              onClick={() => showStage(tile.stage)}
              onRefresh={() => reload(true)}
            />
          ))}
        </div>

        {board.otherJobs > 0 && (
          <div className="tw:rounded-md tw:border tw:border-warning/30 tw:bg-warning/10 tw:px-3 tw:py-1.5 tw:text-[11px] tw:font-semibold tw:text-warning">
            {board.otherJobs} more job(s) are saved under another branch / financial year - change the branch or year at the top to see them.
          </div>
        )}
        <TatBanner tat={board.tat} />

        <Pipeline
          loading={loading}
          jobs={board.jobs}
          onOpenJob={onOpenJob}
          stageFilter={stageFilter}
          onStageFilter={setStageFilter}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
        />
      </div>

      <div className="tw:flex tw:w-full tw:flex-none tw:flex-col tw:gap-3 tw:pr-1 tw:lg:w-[300px] tw:lg:shrink-0 tw:lg:overflow-y-auto">
        <RiskRadar riskJobs={board.riskJobs} onCalculate={(job) => setPenalty({ open: true, job })} />
        <JobDistribution counts={board.counts} />
        <RecentActivity activity={board.activity} onOpenJob={onOpenJob} />
      </div>

      <ExportPenaltyCalculator isOpen={penalty.open} onClose={() => setPenalty((current) => ({ ...current, open: false }))} job={penalty.job} />
    </div>
  );
}
