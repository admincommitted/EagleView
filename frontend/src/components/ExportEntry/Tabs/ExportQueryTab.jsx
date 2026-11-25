import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, CheckCircle, FileSpreadsheet, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import DocketRegisterModal, { docketPath } from '../../DocketRegisterModal';
import QueryResolutionDrawer from '../../JobEntry/Tabs/QueryResolutionDrawer';
import { cn } from '@/lib/utils';
import { blobErrorMessage, downloadBlob } from '@/lib/download';
import { ActionMenu, Badge, Button, CardTitle } from '@/components/ui';
import { exportEntryApi } from '../exportEntryApi';
import { AFTER_LEO, filterJobs, finalDocUrl, NO_FILTERS, sbNoOf } from './ExportQueryTabParts/exportJobList';
import { downloadJobListExcel } from './ExportQueryTabParts/exportJobExcel';
import { exportRowMenu } from './ExportQueryTabParts/exportRowMenu';
import useExportJobList from './ExportQueryTabParts/useExportJobList';
import ExportQueryToolbar from './ExportQueryTabParts/ExportQueryToolbar';
import ExportJobListTable from './ExportQueryTabParts/ExportJobListTable';
import ExportDocumentsModal from './ExportQueryTabParts/ExportDocumentsModal';
import ExportLogsModal from './ExportQueryTabParts/ExportLogsModal';
import SbTrackModal from './ExportQueryTabParts/SbTrackModal';
import AmendModal from './ExportQueryTabParts/AmendModal';

const LEO_ZIP_NAME = 'LEO_Copies_Bulk.zip';

async function downloadLeoCopies(jobs) {
  const files = jobs.map((job) => finalDocUrl(job, 'LEO_COPY')).filter(Boolean);
  if (!files.length) {
    toast.error(`No LEO copy in the ${jobs.length} job(s) listed. LEO copies show as a green "L" in the Docs column.`);
    return;
  }
  const toastId = toast.loading(`Zipping ${files.length} LEO cop${files.length > 1 ? 'ies' : 'y'}...`);
  try {
    downloadBlob(await exportEntryApi.queryBulkZip(files, LEO_ZIP_NAME), LEO_ZIP_NAME);
    toast.success('LEO copies downloaded', { id: toastId });
  } catch (error) {
    toast.error(`Error downloading ZIP: ${await blobErrorMessage(error)}`, { id: toastId });
  }
}

const isFiledNotLocked = (job) => sbNoOf(job) && !AFTER_LEO.includes(job.stage) && job.stage !== 'CANCELLED';

// the legend = the row colours of the list; Locked / Void show only those jobs on a click
function StatusLegend({ jobs, status, onStatusChange }) {
  const toggle = (value) => onStatusChange(status === value ? 'All' : value);
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:border-t tw:border-border tw:bg-background tw:px-4 tw:py-2">
      <Button variant="ghost" size="sm" className="tw:h-auto tw:rounded-full tw:p-0" title="LEO given: the SB is locked" onClick={() => toggle('LEO')}>
        <Badge variant="danger" className={cn(status === 'LEO' && 'tw:ring-2 tw:ring-destructive')}><Lock /> LOCKED JOB ({jobs.filter((job) => AFTER_LEO.includes(job.stage)).length})</Badge>
      </Button>
      <Button variant="ghost" size="sm" className="tw:h-auto tw:rounded-full tw:p-0" title="Cancelled jobs" onClick={() => toggle('CANCELLED')}>
        <Badge variant="warning" className={cn(status === 'CANCELLED' && 'tw:ring-2 tw:ring-warning')}><Ban /> VOID JOB ({jobs.filter((job) => job.stage === 'CANCELLED').length})</Badge>
      </Button>
      <Badge variant="success"><CheckCircle /> RECEIVED SB NO ({jobs.filter(isFiledNotLocked).length})</Badge>
    </div>
  );
}

function ListNotice({ loadError, otherCount, allBranches, onToggleAll, branchName }) {
  if (loadError) return <div className="tw:w-full tw:text-[11px] tw:text-destructive">Could not load the job list: {loadError}</div>;
  if (!otherCount && !allBranches) return null;
  return (
    <div className="tw:flex tw:w-full tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-sm tw:border tw:border-warning/40 tw:bg-warning/10 tw:px-2 tw:py-1 tw:text-[11px] tw:text-warning">
      {allBranches ? 'Showing jobs of all branches and years.' : `${otherCount} more job(s) are saved under another branch / financial year.`}
      <Button variant="warning" size="sm" onClick={onToggleAll}>{allBranches ? `Only ${branchName}` : 'Show all'}</Button>
    </div>
  );
}

export default function ExportQueryTab({ onAction, refreshKey = 0 }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [documentsJob, setDocumentsJob] = useState(null);
  const [logsJob, setLogsJob] = useState(null);
  const [trackJob, setTrackJob] = useState(null);
  const [amendJob, setAmendJob] = useState(null);
  const [docketJob, setDocketJob] = useState(null);
  const [drawerJob, setDrawerJob] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);
  const [announce, setAnnounce] = useState(false);

  const { jobs, setJobs, loadJobs, loadError, allBranches, setAllBranches, otherCount, branchName } = useExportJobList(refreshKey);
  const shownJobs = filterJobs(jobs, filters);

  // Search reloads from the server, then says how many jobs match (the list also filters while typing)
  const search = async () => {
    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) { toast.error('From date is after To date'); return; }
    if (await loadJobs()) setAnnounce(true);
  };
  useEffect(() => {
    if (!announce) return;
    setAnnounce(false);
    if (shownJobs.length) toast.success(`${shownJobs.length} job(s) found`);
    else toast.error('No job found for the selected criteria');
  }, [announce, shownJobs.length]);

  const openDocket = (job) => navigate(docketPath(job.docketDivision || job.division, job.docketNo));
  const runAction = (...args) => onAction?.(...args);

  const rowHandlers = {
    runAction,
    showDocuments: setDocumentsJob,
    showLogs: setLogsJob,
    showTrack: setTrackJob,
    startAmend: setAmendJob,
    registerDocket: setDocketJob,
    openDocket,
  };

  const markDocketRegistered = (docket) =>
    setJobs((rows) => rows.map((row) => (row.id === docketJob.id ? { ...row, docketNo: docket.docketNo, docketDivision: docket.division, docketId: docket.id } : row)));

  return (
    <div className="tw:relative tw:flex tw:h-full tw:flex-col tw:gap-3 tw:pr-2 tw:normal-case">
      <QueryResolutionDrawer module="EXPORT" isOpen={Boolean(drawerJob)} onClose={() => setDrawerJob(null)} job={drawerJob} />

      <ExportQueryToolbar
        jobs={jobs}
        filters={filters}
        onFiltersChange={setFilters}
        onSearch={search}
        onBulkLeoZip={() => downloadLeoCopies(shownJobs)}
        onAction={runAction}
      />

      <div className="glass-panel tw:flex tw:min-h-[420px] tw:flex-1 tw:flex-col tw:overflow-hidden tw:md:min-h-0">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:border-b tw:border-border tw:bg-background tw:px-3 tw:py-2.5 tw:md:px-4">
          <CardTitle>Active Export Jobs Dashboard</CardTitle>
          <Badge variant="info">{shownJobs.length}{shownJobs.length !== jobs.length ? ` of ${jobs.length}` : ''}</Badge>
          <span className="tw:ml-auto tw:text-[11px] tw:text-muted-foreground">Right-click a job for all its actions</span>
          <Button variant="success" size="sm" title="Download the listed jobs as Excel" onClick={() => downloadJobListExcel(shownJobs)}><FileSpreadsheet /> Excel</Button>
          <ListNotice loadError={loadError} otherCount={otherCount} allBranches={allBranches} onToggleAll={() => setAllBranches((all) => !all)} branchName={branchName} />
        </div>

        <div className="tw:min-h-0 tw:flex-1 tw:overflow-auto">
          <ExportJobListTable jobs={shownJobs} handlers={rowHandlers}
            onRowMenu={(job, event) => setRowMenu({ x: event.clientX, y: event.clientY, items: exportRowMenu(job, rowHandlers) })} />
        </div>

        <StatusLegend jobs={jobs} status={filters.status} onStatusChange={(status) => setFilters({ ...filters, status })} />
      </div>

      {rowMenu && <ActionMenu key={`${rowMenu.x}-${rowMenu.y}`} open position={rowMenu} items={rowMenu.items} onOpenChange={(open) => !open && setRowMenu(null)} />}
      {documentsJob && <ExportDocumentsModal job={documentsJob} onClose={() => setDocumentsJob(null)} />}
      {logsJob && <ExportLogsModal job={logsJob} onClose={() => setLogsJob(null)} />}
      {trackJob && <SbTrackModal job={trackJob} onClose={() => setTrackJob(null)} onTimeline={(jobId) => runAction('timeline', jobId)} onJobChanged={loadJobs} />}
      <AmendModal job={amendJob} onClose={() => setAmendJob(null)} onAmend={(jobId, amendment) => runAction('amend', jobId, amendment)} />
      {docketJob && (
        <DocketRegisterModal
          side="Export"
          job={{ ...docketJob, importer: docketJob.exporter }}
          onClose={() => setDocketJob(null)}
          onOpen={(docket) => { setDocketJob(null); openDocket(docket); }}
          onDone={markDocketRegistered}
        />
      )}
    </div>
  );
}
