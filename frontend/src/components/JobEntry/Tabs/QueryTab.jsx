import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import DocketRegisterModal, { docketPath } from '../../DocketRegisterModal';
import DsrExcelGrid from './DsrExcelGrid';
import { blobErrorMessage, downloadBlob } from '@/lib/download';
import { errorMessage } from '@/services/axiosInstance';
import { ActionMenu, Badge, CardTitle } from '@/components/ui';
import { JobListLegend, STATUS_LEGEND_ICONS } from '@/components/common/JobListLegend';
import { jobEntryApi } from '../jobEntryApi';
import { BE_TYPE_LOOKS, beTypeOf, finalDocUrl, jobStatusOf, NO_FILTERS, serverFilters, STATUS_TITLES, toListRow } from './QueryTabParts/jobList';
import { jobRowMenu } from './QueryTabParts/jobRowMenu';
import JobDocumentsModal from './QueryTabParts/JobDocumentsModal';
import JobListTable from './QueryTabParts/JobListTable';
import JobLogsModal from './QueryTabParts/JobLogsModal';
import QueryToolbar from './QueryTabParts/QueryToolbar';

function foundMessage(total, shown) {
  const latestOnly = total > shown ? ` (showing the latest ${shown})` : '';
  return `Found ${total || shown} jobs${latestOnly}.`;
}

function useJobList(filters, refreshKey, announce) {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await jobEntryApi.listJobs(serverFilters(filters));
        if (!result.success) throw new Error(result.error || 'Could not load the jobs');
        const rows = result.data.map(toListRow);
        setJobs(rows);
        setTotal(result.total || 0);
        if (announce.current && rows.length) toast.success(foundMessage(result.total, rows.length));
        if (announce.current && !rows.length) toast.error('No data found for the selected criteria.');
      } catch (error) {
        if (announce.current) toast.error(errorMessage(error) || 'Could not load the jobs');
      } finally {
        announce.current = false;
        setLoading(false);
      }
    };
    load();
  }, [filters, refreshKey, announce]);

  return { jobs, setJobs, total, loading };
}

async function downloadOocCopies(jobs) {
  const files = jobs.map((job) => finalDocUrl(job, 'OOC_COPY')).filter(Boolean);
  if (!files.length) {
    toast.error(`None of the ${jobs.length} listed job(s) has an OOC copy yet (column Docs > O). Filter the jobs and try again.`);
    return;
  }
  try {
    const zip = await jobEntryApi.bulkZip(files, 'OOC_Copies_Bulk.zip');
    downloadBlob(zip, 'OOC_Copies_Bulk.zip');
    toast.success(`Zipping ${files.length} OOC cop${files.length > 1 ? 'ies' : 'y'}`);
  } catch (error) {
    toast.error(`Error downloading ZIP: ${await blobErrorMessage(error)}`);
  }
}

async function saveDsrField(jobId, field, value) {
  try {
    const result = await jobEntryApi.saveDsrField(jobId, field, value);
    if (!result.success) toast.error(result.message || 'DSR change not saved');
  } catch (error) {
    toast.error(`DSR change not saved: ${errorMessage(error)}`);
  }
}

const STATUS_LEGEND = [
  { value: 'locked', label: 'Locked' },
  { value: 'void', label: 'Void' },
  { value: 'received', label: 'Received BE No' },
];

// the legend under the list (row colour = BE type, icon = status); a chip shows only its jobs of the list loaded
const legendGroups = (jobs) => [
  {
    name: 'beType',
    title: 'BE type',
    items: BE_TYPE_LOOKS.map((look) => ({ ...look, count: jobs.filter((job) => beTypeOf(job) === look.value).length })),
  },
  {
    name: 'status',
    title: 'Status',
    items: STATUS_LEGEND.map((item) => ({
      ...item, title: STATUS_TITLES[item.value], icon: STATUS_LEGEND_ICONS[item.value].icon, iconClassName: STATUS_LEGEND_ICONS[item.value].className,
      count: jobs.filter((job) => jobStatusOf(job) === item.value).length,
    })),
  },
];

const matchesLegend = (job, picked) => (!picked.beType || beTypeOf(job) === picked.beType) && (!picked.status || jobStatusOf(job) === picked.status);

export default function QueryTab({ onAction, refreshKey }) {
  const navigate = useNavigate();
  const [draftFilters, setDraftFilters] = useState(NO_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(NO_FILTERS);
  const [viewMode, setViewMode] = useState('list');
  const [documentsJob, setDocumentsJob] = useState(null);
  const [logsJob, setLogsJob] = useState(null);
  const [docketJob, setDocketJob] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);
  const [legendPick, setLegendPick] = useState({ beType: null, status: null });
  const announceResult = useRef(false);

  const { jobs: loadedJobs, setJobs, total, loading } = useJobList(appliedFilters, refreshKey, announceResult);
  const shownJobs = loadedJobs.filter((job) => matchesLegend(job, legendPick));
  const pickLegend = (group, value) => setLegendPick((picked) => ({ ...picked, [group]: value }));

  const search = (filters) => {
    announceResult.current = true;
    setDraftFilters(filters);
    setAppliedFilters(filters);
  };

  const openDocket = (job) => navigate(docketPath(job.division || job.docketDivision, job.docketNo));

  const rowHandlers = {
    runAction: (action, job) => onAction(action, job),
    showDocuments: setDocumentsJob,
    showLogs: setLogsJob,
    registerDocket: setDocketJob,
    openDocket,
  };

  const markDocketRegistered = (docket) =>
    setJobs((rows) => rows.map((row) => (row.id === docketJob.id ? { ...row, docketNo: docket.docketNo, docketDivision: docket.division, docketId: docket.id } : row)));

  return (
    <div className="tw:relative tw:flex tw:h-full tw:flex-col tw:gap-3 tw:pr-2 tw:normal-case">
      <QueryToolbar
        draft={draftFilters}
        onDraftChange={setDraftFilters}
        onSearch={search}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onNewJob={() => onAction('new')}
        onReadFile={(kind) => onAction('import-file', kind)}
        onBulkOocZip={() => downloadOocCopies(shownJobs)}
      />

      <div className="glass-panel tw:flex tw:min-h-[420px] tw:flex-1 tw:flex-col tw:overflow-hidden tw:md:min-h-0">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:border-b tw:border-border tw:bg-background tw:px-3 tw:py-2.5 tw:md:px-4">
          <CardTitle>Active Import Jobs Dashboard</CardTitle>
          <Badge variant="info">{shownJobs.length}{shownJobs.length !== loadedJobs.length ? ` of ${loadedJobs.length}` : ''}</Badge>
          {loading && <span className="tw:text-[11px] tw:text-muted-foreground">loading...</span>}
          {!loading && total > loadedJobs.length && (
            <span className="tw:text-[11px] tw:text-muted-foreground">latest {loadedJobs.length} of {total} - use Search / dates for older jobs</span>
          )}
          <span className="tw:ml-auto tw:text-[11px] tw:text-muted-foreground">Right-click a job for all its actions</span>
        </div>

        <div className="tw:min-h-0 tw:flex-1 tw:overflow-auto">
          {viewMode === 'list'
            ? <JobListTable jobs={shownJobs} handlers={rowHandlers} onRowMenu={(job, event) => setRowMenu({ x: event.clientX, y: event.clientY, items: jobRowMenu(job, rowHandlers) })} />
            : <DsrExcelGrid data={shownJobs} onSave={saveDsrField} />}
        </div>

        <JobListLegend groups={legendGroups(loadedJobs)} picked={legendPick} onPick={pickLegend} />
      </div>

      {rowMenu && <ActionMenu key={`${rowMenu.x}-${rowMenu.y}`} open position={rowMenu} items={rowMenu.items} onOpenChange={(open) => !open && setRowMenu(null)} />}
      {documentsJob && <JobDocumentsModal job={documentsJob} onClose={() => setDocumentsJob(null)} />}
      {logsJob && <JobLogsModal job={logsJob} onClose={() => setLogsJob(null)} />}
      {docketJob && (
        <DocketRegisterModal
          side="Import"
          job={docketJob}
          onClose={() => setDocketJob(null)}
          onOpen={(docket) => { setDocketJob(null); openDocket(docket); }}
          onDone={markDocketRegistered}
        />
      )}
    </div>
  );
}
