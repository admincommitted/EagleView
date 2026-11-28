import { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, Calculator, CheckCircle, Clock, FileText, Loader2, MessageCircle, Plane, Zap } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';
import toast from 'react-hot-toast';
import PenaltyCalculator from '../../PenaltyCalculator';
import { askText } from '../../common/askConfirm';
import { jobEntryApi } from '../jobEntryApi';
import { errorMessage } from '@/services/axiosInstance';
import { timeAgo, toDisplayDate } from '@/lib/dates';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, SelectBox, StatCard, Tabs, TabsList, TabsTrigger } from '@/components/ui';

const REFRESH_EVERY_MS = 30000;

const STAGES = {
  DRAFT: { label: 'DRAFT', badge: 'neutral', tone: 'primary', color: '#0284c7' },
  FILED: { label: 'FILED', badge: 'warning', tone: 'warning', color: '#eab308' },
  QUERY: { label: 'QUERY', badge: 'danger', tone: 'danger', color: '#e11d48' },
  OOC: { label: 'OOC', badge: 'success', tone: 'success', color: '#65a30d' },
  CANCELLED: { label: 'CANCELLED', badge: 'neutral', tone: 'neutral', color: '#94a3b8' },
};
const stageOf = (job) => STAGES[job.macroStatus] || STAGES.DRAFT;

const STAGE_FILTERS = [
  { value: 'ALL', label: 'All Jobs' },
  { value: 'QUERY', label: 'Queries (Urgent)' },
  { value: 'FILED', label: 'Filed (Awaiting OOC)' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'OOC', label: 'Cleared (OOC)' },
];

const EMPTY_COUNTS = { DRAFT: 0, FILED: 0, QUERY: 0, OOC: 0 };

function JobAlert({ toastId, kind, message, onView }) {
  const isQuery = kind === 'QUERY';
  const Icon = isQuery ? AlertTriangle : CheckCircle;
  return (
    <Card className={isQuery ? 'tw:max-w-[350px] tw:border-l-4 tw:border-l-destructive' : 'tw:max-w-[350px] tw:border-l-4 tw:border-l-success'}>
      <CardContent className="tw:flex-row tw:items-center tw:gap-3 tw:p-3">
        <Icon className={isQuery ? 'tw:size-6 tw:shrink-0 tw:text-destructive' : 'tw:size-6 tw:shrink-0 tw:text-success'} />
        <div className="tw:flex-1">
          <CardTitle className="tw:text-foreground">{isQuery ? 'ICEGATE Query Raised!' : 'Status Update'}</CardTitle>
          <p className="tw:m-0 tw:mt-1 tw:text-[11px] tw:text-muted-foreground">{message}</p>
        </div>
        <Button size="sm" onClick={() => { toast.dismiss(toastId); onView(); }}>View</Button>
      </CardContent>
    </Card>
  );
}

function announceChanges(previousJobs, latestJobs, openJob) {
  const alert = (kind, job, message) =>
    toast.custom((t) => <JobAlert toastId={t.id} kind={kind} message={message} onView={() => openJob(job.id)} />, { duration: 6000 });

  latestJobs.forEach((job) => {
    const before = previousJobs.find((old) => old.id === job.id);
    if (!before) return;
    if (!before.beNo && job.beNo) alert('SUCCESS', job, `BE No ${job.beNo} generated for Job ${job.jobNo}!`);
    if (before.macroStatus === job.macroStatus) return;
    if (job.macroStatus === 'QUERY') alert('QUERY', job, `Customs requires attention on Job ${job.jobNo}.`);
    else if (job.macroStatus === 'OOC') alert('SUCCESS', job, `Clearance (OOC) Issued for Job ${job.jobNo}!`);
    else toast.success(`Job ${job.jobNo} moved to ${job.macroStatus}`);
  });
}

function useLiveTracking(openJob) {
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState({ counts: EMPTY_COUNTS, jobs: [], riskJobs: [], activity: [], tatHours: 0, tatCount: 0 });
  const lastJobs = useRef([]);

  const load = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await jobEntryApi.liveTracking();
      const jobs = data.recentJobs || [];
      if (lastJobs.current.length) announceChanges(lastJobs.current, jobs, openJob);
      lastJobs.current = jobs;
      setBoard({
        counts: { DRAFT: data.summary?.draft || 0, FILED: data.summary?.submitted || 0, QUERY: data.summary?.query_raised || 0, OOC: data.summary?.ooc || 0 },
        jobs,
        riskJobs: data.riskJobs || [],
        activity: data.activity || [],
        tatHours: data.averageTat || 0,
        tatCount: data.tatCount || 0,
      });
    } catch (error) {
      console.error('Live tracking failed:', errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(() => load(false), REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { loading, board, reload: load };
}

async function sendOocOnWhatsapp(job) {
  const mobile = (await askText({
    title: 'Send OOC on WhatsApp',
    message: `Job ${job.jobNo}: OOC message to ${job.importerName || 'the importer'}.`,
    label: 'WhatsApp number (with country code)',
    value: job.importerPhone || '',
    placeholder: 'e.g. 919812345678',
    okLabel: 'Send',
  }))?.trim();
  if (!mobile) return;

  const beDate = job.beDate ? ` dt ${toDisplayDate(job.beDate)}` : '';
  try {
    await jobEntryApi.sendWhatsappStatus({
      partyName: job.importerName || '',
      mobileNumber: mobile,
      awbNumber: job.hawbNo || job.mawbNo || job.beNo || job.jobNo,
      statusText: `Job ${job.jobNo}: Bill of Entry ${job.beNo || ''}${beDate} is cleared - Out of Charge (OOC) given by Customs.`,
    });
    toast.success(`WhatsApp sent to ${mobile}`);
  } catch (error) {
    toast.error(`WhatsApp not sent: ${errorMessage(error) || 'check Settings > WhatsApp'}`);
  }
}

function JobCard({ job, onOpen }) {
  const stage = stageOf(job);
  const awbLine = [job.mawbNo && `MAWB/BL ${job.mawbNo}`, job.hawbNo && `HAWB/HBL ${job.hawbNo}`].filter(Boolean).join(' · ');
  const boeType = job.boeType && job.boeType !== 'HOME_CONSUMPTION' ? ` · ${job.boeType.replace('_', '-')}` : '';
  return (
    <Card
      role="button"
      tabIndex={0}
      title="Open this job"
      onClick={onOpen}
      onKeyDown={(event) => event.key === 'Enter' && onOpen()}
      className="tw:cursor-pointer tw:gap-2 tw:p-2.5 tw:transition-shadow tw:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring/40"
    >
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-2">
        <div className="tw:min-w-0">
          <CardTitle className="tw:text-foreground">{job.jobNo || 'DRAFT'}</CardTitle>
          <div className="tw:mt-0.5 tw:text-[11px] tw:text-muted-foreground">{toDisplayDate(job.jobDate) || 'Recent'} · {job.mode}{boeType}</div>
        </div>
        <Badge variant={stage.badge} title={job.icegateStatus ? `ICEGATE: ${job.icegateStatus}` : job.status}>{stage.label}</Badge>
      </div>

      <div className="tw:flex tw:flex-col tw:gap-1 tw:text-[11px] tw:text-foreground/80">
        <div className="tw:truncate" title={job.importerName}><strong>Importer:</strong> {job.importerName || job.importer || 'N/A'}</div>
        {awbLine && <div className="tw:text-muted-foreground">{awbLine}</div>}
        {job.beNo && <Badge variant="info" className="tw:rounded-sm">BE No: {job.beNo}{job.beDate && ` dt ${toDisplayDate(job.beDate)}`}</Badge>}
      </div>

      <div className="tw:mt-auto tw:flex tw:flex-wrap tw:gap-1.5">
        <Button className="tw:flex-1" onClick={(event) => { event.stopPropagation(); onOpen(); }}>Continue Job <ArrowRight /></Button>
        {job.macroStatus === 'OOC' && (
          <Button variant="success" className="tw:flex-1" onClick={(event) => { event.stopPropagation(); sendOocOnWhatsapp(job); }}>
            <MessageCircle /> Send WhatsApp
          </Button>
        )}
      </div>
    </Card>
  );
}

function Pipeline({ loading, jobs, onOpenJob, onGoToQuery, stageFilter, onStageFilter, statusFilter, onStatusFilter }) {
  const statuses = [...new Set(jobs.flatMap((job) => [job.status, job.icegateStatus]))].filter(Boolean);
  const shown = jobs.filter((job) =>
    (stageFilter === 'ALL' || job.macroStatus === stageFilter) &&
    (statusFilter === 'ALL' || job.status === statusFilter || job.icegateStatus === statusFilter)
  );

  return (
    <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-2">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
        <CardTitle className="tw:tracking-wide tw:uppercase">Current Pipeline</CardTitle>
        <div className="tw:flex tw:min-w-0 tw:max-w-full tw:flex-wrap tw:items-center tw:gap-2">
          <SelectBox
            className="tw:w-full tw:sm:w-56"
            value={statusFilter}
            onValueChange={onStatusFilter}
            options={[{ value: 'ALL', label: 'All statuses (deep filter)' }, ...statuses]}
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
        <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-dashed tw:border-input tw:bg-muted tw:p-8">
          <p className="tw:m-0 tw:text-entry tw:text-muted-foreground">No jobs found for this filter.</p>
          <Button size="sm" onClick={onGoToQuery}>Open the job list</Button>
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

function RiskRadar({ riskJobs, onOpenJob, onCalculate }) {
  return (
    <Card className="tw:border-destructive/30 tw:bg-destructive/5">
      <CardHeader>
        <CardTitle icon={<AlertTriangle />} className="tw:text-destructive tw:uppercase">Financial Risk Radar</CardTitle>
        {riskJobs.length > 0 && <Badge variant="danger">{riskJobs.length}</Badge>}
      </CardHeader>
      <CardContent>
        {riskJobs.length === 0 && (
          <div className="tw:flex tw:flex-col tw:items-center tw:gap-1 tw:rounded-md tw:border tw:border-dashed tw:border-success/40 tw:bg-success/5 tw:py-5 tw:text-success">
            <CheckCircle className="tw:size-5 tw:opacity-80" />
            <span className="tw:text-entry tw:font-semibold">ALL CLEAR</span>
            <span className="tw:text-[10px] tw:opacity-80">No Pending Penalties</span>
          </div>
        )}
        {riskJobs.map((risk, index) => (
          <Button
            key={`${risk.jobNo}-${index}`}
            size="block"
            title="Work out the penalty"
            onClick={() => onCalculate(risk)}
            className="tw:justify-between tw:border-l-4 tw:border-l-(--risk) tw:bg-card tw:text-foreground"
            style={{ '--risk': risk.color || '#ef4444' }}
          >
            <span className="tw:min-w-0">
              <span className="tw:flex tw:items-center tw:gap-1.5 tw:font-bold">
                {risk.jobNo} {risk.mode && `(${risk.mode})`}
                {risk.id && <Button asChild variant="link" size="sm"><span onClick={(event) => { event.stopPropagation(); onOpenJob(risk.id); }}>Open</span></Button>}
              </span>
              <span className="tw:block tw:text-[10px] tw:text-muted-foreground tw:uppercase">{risk.riskType || 'Penalty Warning!'}</span>
            </span>
            <Calculator className="tw:text-(--risk)" />
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function JobDistribution({ counts }) {
  const slices = [
    { name: 'Draft', value: counts.DRAFT, color: STAGES.DRAFT.color },
    { name: 'Filed', value: counts.FILED, color: STAGES.FILED.color },
    { name: 'Queries', value: counts.QUERY, color: STAGES.QUERY.color },
    { name: 'Cleared', value: counts.OOC, color: STAGES.OOC.color },
  ];
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <Card>
      <CardHeader><CardTitle icon={<Activity />}>Job Distribution</CardTitle></CardHeader>
      <CardContent>
        {total === 0 ? <div className="tw:py-6 tw:text-center tw:text-[11px] tw:text-muted-foreground">No jobs yet.</div> : (
          <>
            <div className="tw:relative tw:h-[140px]">
              <div className="tw:pointer-events-none tw:absolute tw:inset-0 tw:flex tw:flex-col tw:items-center tw:justify-center">
                <span className="tw:text-lg tw:font-extrabold">{total}</span>
                <span className="tw:text-[9px] tw:text-muted-foreground">JOBS</span>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                    {slices.map((slice) => <Cell key={slice.name} fill={slice.color} />)}
                  </Pie>
                  <ChartTooltip contentStyle={{ fontSize: '10px', padding: '4px 8px', borderRadius: '4px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="tw:grid tw:grid-cols-2 tw:gap-x-2.5 tw:gap-y-1">
              {slices.map((slice) => (
                <div key={slice.name} className="tw:flex tw:items-center tw:gap-1.5 tw:text-[11px] tw:text-muted-foreground">
                  <span className="tw:size-2 tw:rounded-[2px] tw:bg-(--slice)" style={{ '--slice': slice.color }} />
                  {slice.name}
                  <b className="tw:ml-auto tw:text-foreground tw:tabular-nums">{slice.value}</b>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivity({ activity, onOpenJob }) {
  return (
    <Card className="tw:flex-1">
      <CardHeader><CardTitle icon={<Zap />}>Recent Activity</CardTitle></CardHeader>
      <CardContent className="tw:gap-1">
        {activity.length === 0 && <span className="tw:text-[11px] tw:text-muted-foreground">No recent activity.</span>}
        {activity.map((event, index) => (
          <Button key={`${event.id}-${index}`} variant="ghost" size="block" title="Open this job" onClick={() => onOpenJob(event.id)} className="tw:gap-2.5 tw:px-1 tw:py-1">
            <span className="tw:mt-1 tw:size-2.5 tw:shrink-0 tw:self-start tw:rounded-full tw:bg-primary" />
            <span className="tw:text-[11px] tw:leading-snug tw:text-foreground/80">
              <b className="tw:text-foreground">Job {event.jobNo || 'Draft'}</b>: {event.text}
              <span className="tw:block tw:text-[10px] tw:text-muted-foreground">{timeAgo(event.at)}</span>
            </span>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

const STAT_TILES = [
  { stage: 'DRAFT', label: 'Draft Jobs', icon: FileText, title: 'Not sent to ICEGATE yet' },
  { stage: 'FILED', label: 'Filed - Awaiting OOC', icon: Plane, title: 'Sent to ICEGATE / BE No received, OOC not yet' },
  { stage: 'QUERY', label: 'Queries Raised', icon: AlertTriangle, title: 'Customs query open' },
  { stage: 'OOC', label: 'OOC Issued', icon: CheckCircle, title: 'Out of charge copy received' },
];

export default function ImportDashboardTab({ onGoToQuery, onOpenJob }) {
  const { loading, board, reload } = useLiveTracking(onOpenJob);
  const [stageFilter, setStageFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [penaltyJob, setPenaltyJob] = useState(null);

  const showStage = (stage) => { setStageFilter(stage); setStatusFilter('ALL'); };

  return (
    <div className="tw:flex tw:h-full tw:min-h-0 tw:flex-col tw:gap-4 tw:overflow-y-auto tw:p-1 tw:normal-case tw:lg:flex-row">
      <div className="tw:flex tw:min-w-0 tw:flex-none tw:flex-col tw:gap-3 tw:lg:flex-[3] tw:lg:overflow-y-auto">
        <div className="tw:grid tw:grid-cols-1 tw:gap-2.5 tw:sm:grid-cols-2 tw:xl:grid-cols-4">
          {STAT_TILES.map((tile) => (
            <StatCard
              key={tile.stage}
              label={tile.label}
              value={board.counts[tile.stage]}
              icon={tile.icon}
              tone={STAGES[tile.stage].tone}
              title={`${tile.title} - click to list them`}
              active={stageFilter === tile.stage}
              onClick={() => showStage(tile.stage)}
              onRefresh={reload}
            />
          ))}
        </div>

        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-md tw:border tw:border-primary/20 tw:bg-primary/10 tw:px-3 tw:py-1.5 tw:text-entry tw:font-semibold tw:text-head">
          <Clock className="tw:size-3.5" />
          Average Clearance TAT (Today):
          {board.tatCount === 0 ? ' No Clearances Today' : (
            <>
              {` ${board.tatHours} hours from job creation to OOC, ${board.tatCount} clearance(s)`}
              <Badge variant={board.tatHours < 24 ? 'success' : 'warning'}>{board.tatHours < 24 ? 'Excellent' : 'Needs Attention'}</Badge>
            </>
          )}
        </div>

        <Pipeline
          loading={loading}
          jobs={board.jobs}
          onOpenJob={onOpenJob}
          onGoToQuery={onGoToQuery}
          stageFilter={stageFilter}
          onStageFilter={setStageFilter}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
        />
      </div>

      <div className="tw:flex tw:w-full tw:flex-none tw:flex-col tw:gap-3 tw:pr-1 tw:lg:w-[300px] tw:lg:shrink-0 tw:lg:overflow-y-auto">
        <RiskRadar riskJobs={board.riskJobs} onOpenJob={onOpenJob} onCalculate={(risk) => setPenaltyJob({ jobNo: risk.jobNo, mode: risk.mode || 'SEA' })} />
        <JobDistribution counts={board.counts} />
        <RecentActivity activity={board.activity} onOpenJob={onOpenJob} />
      </div>

      <PenaltyCalculator isOpen={Boolean(penaltyJob)} onClose={() => setPenaltyJob(null)} job={penaltyJob} />
    </div>
  );
}
