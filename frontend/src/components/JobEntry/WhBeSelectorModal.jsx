import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Inbox, Link, Loader2, PenLine, Plane, RefreshCw, Search, Ship, Truck, Warehouse, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, DataTable, Input, Modal } from '@/components/ui';
import { jobEntryApi } from './jobEntryApi';

/**
 * Choose the warehouse (into-bond, BE type W) BE that an Ex-Bond BE clears.
 *   importerName / iecCode / customsPort - this job's importer and port (matching WH BEs are listed first)
 *   excludeJobId     - this job's own id (so its own quantities are not counted as cleared)
 *   onSelect(whJob)  - called with the chosen WH BE row
 *   onManual()       - "Enter WH BE manually" (WH BE filed outside this software)
 * Keyboard: Up / Down, Enter = link, Esc = close; double-click a row to link.
 */
const displayDate = (value) => {
  if (!value) return '';
  const parts = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(value));
  const date = parts ? new Date(+parts[1], +parts[2] - 1, +parts[3]) : new Date(value);
  return isNaN(date) ? String(value) : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function ModeIcon({ mode }) {
  if (mode === 'AIR') return <Plane className="tw:size-[13px]" />;
  if (mode === 'SEA') return <Ship className="tw:size-[13px]" />;
  return <Truck className="tw:size-[13px]" />;
}

function Chip({ active, onClick, title, children }) {
  return (
    <Button size="sm" onClick={onClick} title={title}
      className={cn('tw:h-7 tw:rounded-full tw:px-3', active ? 'tw:border-primary tw:bg-primary/10 tw:text-primary' : 'tw:text-muted-foreground')}>
      {children}
    </Button>
  );
}

function CellLines({ main, sub, mainClassName, title }) {
  return (
    <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5" title={title}>
      <span className={cn('tw:truncate', mainClassName)}>{main}</span>
      {sub && <span className="tw:truncate tw:text-[10px] tw:text-muted-foreground">{sub}</span>}
    </div>
  );
}

function columnsFor(selectedId) {
  return [
    {
      key: 'pick',
      header: '',
      width: '34px',
      cell: (job) => (
        <span className={cn('tw:flex tw:size-3.5 tw:items-center tw:justify-center tw:rounded-full tw:border-2', job.id === selectedId ? 'tw:border-primary' : 'tw:border-input')}>
          {job.id === selectedId && <span className="tw:size-1.5 tw:rounded-full tw:bg-primary" />}
        </span>
      ),
    },
    {
      key: 'job',
      header: 'JOB',
      cell: (job) => (
        <CellLines main={job.jobNo} mainClassName={cn('tw:font-bold', job.id === selectedId && 'tw:text-primary')}
          sub={`${displayDate(job.jobDate)}${job.invoiceNo ? ` · Inv ${job.invoiceNo}` : ''}`} />
      ),
    },
    {
      key: 'importer',
      header: 'IMPORTER',
      cell: (job) => (
        <CellLines main={job.importerName || '—'} title={job.importerName}
          sub={`${job.iecCode ? `IEC ${job.iecCode}` : ''}${job.matchImporter ? ' · same importer' : ''}`} />
      ),
    },
    {
      key: 'warehouse',
      header: 'WAREHOUSE',
      cell: (job) => (
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:items-start tw:gap-0.5">
          <Badge variant="info" className="tw:max-w-full tw:rounded-sm tw:font-mono tw:text-[11px]">{job.warehouseCode || '—'}</Badge>
          <span className="tw:text-[10px] tw:text-muted-foreground">{job.customsPort || ''}{job.matchPort ? ' · same port' : ''}</span>
        </div>
      ),
    },
    {
      key: 'whBe',
      header: 'WH BE NO / DATE',
      cell: (job) => (job.beNo
        ? <CellLines main={job.beNo} mainClassName="tw:font-mono tw:font-bold" sub={displayDate(job.beDate)} />
        : <Badge variant="warning">Not filed</Badge>),
    },
    {
      key: 'igm',
      header: 'IGM / AWB',
      cell: (job) => (
        <CellLines main={job.igmNo || job.mawbNo || job.hawbNo || '—'} mainClassName="tw:font-mono"
          sub={job.igmNo ? 'IGM' : job.mawbNo ? 'MAWB' : job.hawbNo ? 'HAWB' : ''} />
      ),
    },
    {
      key: 'status',
      header: 'STATUS',
      cell: (job) => (
        <div className="tw:flex tw:flex-col tw:gap-0.5">
          <span className="tw:flex tw:items-center tw:gap-1.5">
            <Badge variant={job.beNo ? 'success' : 'neutral'}>{job.status || 'DRAFT'}</Badge>
            <span className="tw:flex tw:text-muted-foreground" title={job.shipmentMode}><ModeIcon mode={job.shipmentMode} /></span>
          </span>
          {job.exBondCount > 0 && <span className="tw:text-[10px] tw:text-muted-foreground">{job.exBondCount} ex-bond{job.exBondCount > 1 ? 's' : ''} so far</span>}
        </div>
      ),
    },
  ];
}

function LoadError({ error, onRetry, className }) {
  return (
    <div className={cn('tw:flex tw:items-center tw:gap-2 tw:rounded-md tw:border tw:border-destructive/30 tw:bg-destructive/5 tw:px-3.5 tw:py-3 tw:text-left tw:text-entry tw:text-destructive', className)}>
      <AlertCircle className="tw:size-4" /> {error}
      <Button variant="destructive" size="sm" className="tw:ml-auto" onClick={onRetry}>Retry</Button>
    </div>
  );
}

function EmptyList({ loading, error, onRetry, hasJobs, search, filedOnly, onShowAll }) {
  if (loading) return <span className="tw:inline-flex tw:items-center tw:gap-2"><Loader2 className="tw:size-4 tw:animate-spin" /> Loading...</span>;
  if (error) return <LoadError error={error} onRetry={onRetry} />;
  if (!hasJobs) {
    return (
      <div className="tw:whitespace-normal tw:py-6">
        <Inbox className="tw:mx-auto tw:size-[34px] tw:text-input" />
        <div className="tw:mt-2 tw:text-[13px] tw:font-bold tw:text-foreground">No warehouse BE saved yet</div>
        <div className="tw:mt-1 tw:text-[11px]">Save the warehouse job first (BE Type = W), or enter the WH BE No / Date yourself if it was filed elsewhere.</div>
      </div>
    );
  }
  return (
    <div className="tw:py-5 tw:text-entry">
      Nothing matches{search ? <> &quot;<b>{search}</b>&quot;</> : ''}{filedOnly ? ' among filed WH BEs' : ''}.{' '}
      <Button variant="link" size="sm" className="tw:font-semibold" onClick={onShowAll}>Show all</Button>
    </div>
  );
}

export default function WhBeSelectorModal({ importerId, importerName, iecCode, customsPort, excludeJobId, onSelect, onClose, onManual }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [scope, setScope] = useState('mine'); // 'mine' = this importer, 'all'
  const [filedOnly, setFiledOnly] = useState(false);
  const listRef = useRef(null);

  const loadWarehouseBes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters = { importerId, importerName, iecCode, customsPort, excludeJobId };
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const answer = await jobEntryApi.warehouseBeList(params);
      if (answer.success) setJobs(answer.data || []);
      else setError(answer.error || 'Could not load the warehouse BEs');
    } catch (loadError) {
      setError(loadError.response ? (loadError.response.data?.error || 'Could not load the warehouse BEs') : 'Network error: ' + loadError.message);
    } finally {
      setLoading(false);
    }
  }, [importerId, importerName, iecCode, customsPort, excludeJobId]);

  useEffect(() => { loadWarehouseBes(); }, [loadWarehouseBes]);

  const mine = jobs.filter((job) => job.matchImporter);
  const useMine = scope === 'mine' && mine.length > 0;
  const query = search.trim().toLowerCase();
  const filtered = (useMine ? mine : jobs)
    .filter((job) => !filedOnly || job.beNo)
    .filter((job) => !query || [job.jobNo, job.beNo, job.iecCode, job.warehouseCode, job.importerName, job.igmNo, job.mawbNo, job.hawbNo, job.invoiceNo]
      .some((value) => String(value || '').toLowerCase().includes(query)))
    .sort((first, second) => (second.matchImporter - first.matchImporter) || (second.matchPort - first.matchPort) || (!!second.beNo - !!first.beNo));
  // the selection is kept only while it is in the visible list
  const selected = filtered.find((job) => job.id === selectedId) || null;

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedId]);

  const link = (job = selected) => {
    if (!job) return;
    onSelect(job);
    onClose();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && selected) { event.preventDefault(); link(); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!filtered.length) return;
    const index = filtered.findIndex((job) => job.id === selectedId);
    const next = event.key === 'ArrowDown' ? Math.min(filtered.length - 1, index + 1) : Math.max(0, index < 0 ? 0 : index - 1);
    setSelectedId(filtered[next].id);
  };

  const showAll = () => { setSearch(''); setFiledOnly(false); setScope('all'); };
  const countText = loading ? 'Loading...' : `${filtered.length} of ${jobs.length} warehouse BE${jobs.length !== 1 ? 's' : ''}`;

  return (
    <Modal
      open
      onClose={onClose}
      width={1000}
      title={<span className="tw:flex tw:items-center tw:gap-2 tw:font-bold"><Warehouse className="tw:size-5 tw:text-primary" /> Select Warehouse BE</span>}
      description="Link the into-bond (W) BE this Ex-Bond clears. WH BE No, warehouse code and the balance quantity fill in automatically."
      bodyClassName="tw:p-0 tw:gap-0"
      footer={(
        <div className="tw:flex tw:w-full tw:flex-wrap tw:items-center tw:justify-end tw:gap-2">
          <div className="tw:min-w-[220px] tw:flex-1 tw:text-[11px] tw:text-muted-foreground">
            {selected ? (
              <>
                <div className="tw:flex tw:items-center tw:gap-1.5 tw:truncate tw:font-semibold tw:text-primary">
                  <CheckCircle className="tw:size-[13px]" /> {selected.jobNo} · {selected.beNo ? `WH BE ${selected.beNo}` : 'WH BE not filed'} · {selected.warehouseCode || 'no WH code'}
                </div>
                {!selected.beNo && <div className="tw:mt-0.5 tw:text-warning">Not filed yet: enter the WH BE No / Date in the Job Header after linking.</div>}
              </>
            ) : (
              <span>{countText} · ↑ ↓ to move, Enter to link</span>
            )}
          </div>
          {onManual && <Button size="lg" onClick={() => { onManual(); onClose(); }}><PenLine /> Enter WH BE manually</Button>}
          <Button size="lg" onClick={onClose}>Cancel</Button>
          <Button size="lg" variant="default" disabled={!selected} onClick={() => link()}><Link /> Link to Ex-Bond</Button>
        </div>
      )}
    >
      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col" onKeyDown={handleKeyDown}>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:px-4 tw:py-2.5">
          <div className="tw:relative tw:w-full tw:md:w-auto tw:md:min-w-[220px] tw:md:flex-[1_1_320px]">
            <Input
              leftIcon={Search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoFocus
              placeholder="Search job no, WH BE no, warehouse code, importer, IEC, IGM / AWB, invoice..."
              className="tw:h-8 tw:pr-7"
            />
            {search && (
              <Button variant="ghost" size="icon-sm" title="Clear" aria-label="Clear" className="tw:absolute tw:top-1/2 tw:right-1 tw:-translate-y-1/2" onClick={() => setSearch('')}>
                <X />
              </Button>
            )}
          </div>
          {mine.length > 0 && mine.length < jobs.length && (
            <>
              <Chip active={useMine} onClick={() => setScope('mine')} title={importerName || iecCode}>This importer · {mine.length}</Chip>
              <Chip active={!useMine} onClick={() => setScope('all')}>All · {jobs.length}</Chip>
            </>
          )}
          <Chip active={filedOnly} onClick={() => setFiledOnly((only) => !only)} title="Only WH BEs that already have a BE No">Filed only</Chip>
          <Button size="icon" title="Reload" aria-label="Reload" className="tw:size-7" onClick={loadWarehouseBes}><RefreshCw /></Button>
        </div>
        {jobs.length > 0 && mine.length === 0 && (importerName || iecCode) && (
          <div className="tw:mx-4 tw:mb-2.5 tw:rounded-md tw:bg-warning/10 tw:px-2.5 tw:py-1.5 tw:text-[11px] tw:text-warning">
            No warehouse BE of this importer was found - showing every warehouse BE.
          </div>
        )}
        <div ref={listRef} className="tw:min-h-[180px] tw:flex-1 tw:overflow-auto tw:border-t tw:border-border">
          {!loading && error && filtered.length > 0 && <LoadError error={error} onRetry={loadWarehouseBes} className="tw:m-4" />}
          <DataTable
            columns={columnsFor(selectedId)}
            rows={loading ? [] : filtered}
            selectedKey={selected?.id}
            onRowClick={(job) => setSelectedId(job.id)}
            onRowDoubleClick={(job) => link(job)}
            rowTitle="Click to select, double-click to link"
            className="tw:min-w-[860px] tw:text-entry"
            emptyText={<EmptyList loading={loading} error={error} onRetry={loadWarehouseBes} hasJobs={jobs.length > 0} search={search} filedOnly={filedOnly} onShowAll={showAll} />}
          />
        </div>
      </div>
    </Modal>
  );
}
