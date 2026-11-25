// Sales > Customers: every customer and prospect with its KAM, how it is billing (this / last FY, duty kept apart),
// filters, and "Load from books" (profiles for every debtor billed).
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Plus, RefreshCw, Search } from 'lucide-react';
import { Button, DataTable, Input, Modal, SelectBox } from '@/components/ui';
import { salesHubApi } from './salesApi';
import { activeLookups, activePersons, crore, dmy, labelsOf, pairOptions } from './salesFormat';
import { ActivityBadge, CheckLabel, FigureTile, Muted, Notice, StatusBadge } from './salesWidgets';
import CustomerForm from './CustomerForm';

const NO_FILTERS = { q: '', status: '', kamId: '', industry: '', segment: '', service: '', activity: '', customerType: '', reviewDue: '', sort: 'billed' };
const LIST_LIMIT = '2000';
const ACTIVITY_OPTIONS = [
  { value: 'ACTIVE', label: 'Billing (60 days)' },
  { value: 'SLOWING', label: 'Slowing (61-120 days)' },
  { value: 'DORMANT', label: 'Dormant (120+ days)' },
  { value: 'NONE', label: 'Not billed' },
];

const fyLabel = (fy) => (fy ? `FY ${String(fy).slice(2, 4)}-${String(Number(String(fy).slice(0, 4)) + 1).slice(2)}` : 'this FY');
const plural = (count, word) => `${count} ${word}${count > 1 ? 's' : ''}`;
const todayIso = () => new Date().toISOString().slice(0, 10);

function customerColumns(meta, fy) {
  const statusLabels = labelsOf(meta.statuses);
  const serviceLabels = labelsOf(meta.services);
  const segmentLabels = labelsOf(meta.segments);
  const money = (key, header, className) => ({ key, header, align: 'right', className, cell: (row) => crore(row[key]) });
  return [
    {
      key: 'name',
      header: 'Customer',
      className: 'tw:min-w-[200px] tw:max-w-[300px] tw:whitespace-normal',
      cell: (row) => (
        <>
          <div className="tw:font-bold tw:text-foreground">{row.name}</div>
          <Muted className="tw:text-[10.5px]">
            {[row.city, row.state, row.gstin].filter(Boolean).join(' · ')}
            {row.ledgers > 1 ? ` · ${row.ledgers} ledgers` : ''}
            {row.contacts ? ` · ${plural(row.contacts, 'contact')}` : ''}
            {row.lanes ? ` · ${plural(row.lanes, 'lane')}` : ''}
          </Muted>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <div className="tw:flex tw:flex-col tw:gap-0.5">
          <StatusBadge status={row.status} label={statusLabels[row.status]} />
          <ActivityBadge activity={row.activity} lastBill={row.lastBill} />
        </div>
      ),
    },
    { key: 'kamName', header: 'KAM', cell: (row) => row.kamName || <span className="tw:text-warning">No KAM</span> },
    { key: 'segment', header: 'Segment', cell: (row) => segmentLabels[row.segment] || '' },
    { key: 'industry', header: 'Industry', className: 'tw:whitespace-normal' },
    { key: 'branchCode', header: 'Branch' },
    money('billedCy', `Billed ${fy}`, 'tw:font-semibold'),
    money('billedLy', 'Last FY', 'tw:text-muted-foreground'),
    { key: 'reimbCy', header: `Duty / DO ${fy}`, align: 'right', className: 'tw:text-muted-foreground', cell: (row) => (row.reimbCy ? crore(row.reimbCy) : '') },
    { key: 'lastBill', header: 'Last bill', cell: (row) => dmy(row.lastBill) },
    {
      key: 'services',
      header: 'Services',
      className: 'tw:max-w-[180px] tw:whitespace-normal tw:text-[11px] tw:text-muted-foreground',
      cell: (row) => String(row.services || '').split(',').filter(Boolean).map((code) => serviceLabels[code] || code).join(', '),
    },
    {
      key: 'nextReviewDate',
      header: 'Next review',
      cell: (row) => <span className={row.nextReviewDate && row.nextReviewDate <= todayIso() ? 'tw:text-destructive' : 'tw:text-foreground'}>{dmy(row.nextReviewDate)}</span>,
    },
  ];
}

const PREVIEW_FIGURES = [
  ['Ledgers billed', 'ledgersBilled'], ['New customers', 'made'], ['Ledgers linked to existing', 'linked'], ['With KAM', 'withKam'],
  ['KAM from debtor group', 'kamFromGroup'], ['KAM from dockets', 'kamFromDockets'], ['More than one ledger', 'multiLedger'], ['Blocked', 'blocked'], ['On hold', 'onHold'],
];

const SAMPLE_COLUMNS = [
  { key: 'name', header: 'Customer', className: 'tw:whitespace-normal' },
  { key: 'ledgers', header: 'Ledgers', className: 'tw:whitespace-normal tw:text-[11px]', cell: (row) => row.ledgers.join(' + ') },
  { key: 'bills', header: 'Bills' },
  { key: 'billed', header: 'Billed', align: 'right', cell: (row) => crore(row.billed) },
  { key: 'segment', header: 'Segment' },
  { key: 'status', header: 'Status' },
  { key: 'kam', header: 'KAM' },
  { key: 'branch', header: 'Branch' },
];

function BooksPreview({ preview }) {
  return (
    <div className="tw:text-entry">
      <p className="tw:mt-0">
        Every debtor ledger with a sales bill since <b>{dmy(preview.since)}</b> gets a sales profile. Ledgers of one customer (same PAN, or the same name
        with "DUTY A/C", "(IMPORT DUTY ACCOUNT)", "- DO") are put together. Profiles already made are not changed.
      </p>
      <div className="tw:mb-2.5 tw:grid tw:grid-cols-[repeat(auto-fill,minmax(min(120px,100%),1fr))] tw:gap-2">
        {PREVIEW_FIGURES.map(([label, field]) => <FigureTile key={field} label={label} value={preview[field]} />)}
      </div>
      {preview.unmatchedNames?.length > 0 && (
        <Notice tone="warning" className="tw:mb-2.5">
          These iCAFFE names are not sales persons yet, so their customers get no KAM: {preview.unmatchedNames.map((unmatched) => `${unmatched.name} (${unmatched.customers})`).join(', ')}.
          Add them in Sales Persons first (Names found in iCAFFE), then load again.
        </Notice>
      )}
      <DataTable columns={SAMPLE_COLUMNS} rows={preview.sample || []} rowKey={(row, index) => index} />
      <Muted className="tw:mt-1.5 tw:text-entry">A sample of what will be made. Segment: Key = Rs 25 lakh+ billed or 50+ bills in the period; Regular = 6+ bills; else Occasional.</Muted>
    </div>
  );
}

export default function CustomersTab({ meta, reloadMeta }) {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [rows, setRows] = useState([]);
  const [info, setInfo] = useState({ total: 0, counts: {} });
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [booksLoad, setBooksLoad] = useState(null);

  const load = async (shown = filters) => {
    setLoading(true);
    try {
      const answer = await salesHubApi.customers({ ...shown, limit: LIST_LIMIT });
      setRows(answer.data || []);
      setInfo({ total: answer.total, counts: answer.counts || {}, fy: answer.fy });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (field, value) => {
    const next = { ...filters, [field]: value };
    setFilters(next);
    if (field !== 'q') load(next);
  };

  const previewBooksLoad = async () => {
    setBooksLoad({ busy: true });
    try {
      setBooksLoad({ preview: await salesHubApi.loadCustomersFromBooks({ dryRun: true }) });
    } catch (error) {
      setBooksLoad(null);
      toast.error(error.message);
    }
  };

  const runBooksLoad = async () => {
    setBooksLoad((current) => ({ ...current, busy: true }));
    try {
      const result = await salesHubApi.loadCustomersFromBooks({});
      toast.success(`${result.made} customers made, ${result.linked} ledgers linked`);
      setBooksLoad(null);
      load();
    } catch (error) {
      setBooksLoad((current) => ({ ...current, busy: false }));
      toast.error(error.message);
    }
  };

  const fy = fyLabel(info.fy);
  const filterBox = (field, allLabel, options) => (
    <SelectBox
      className="tw:w-full tw:sm:w-auto tw:sm:min-w-[130px]"
      clearable
      clearLabel={allLabel}
      placeholder={allLabel}
      value={filters[field]}
      onValueChange={(value) => setFilter(field, value)}
      options={options}
    />
  );
  const statusOptions = (meta.statuses || []).map(([code, label]) => ({ value: code, label: `${label}${info.counts[code] ? ` (${info.counts[code]})` : ''}` }));
  const kamOptions = [{ value: 'none', label: 'No KAM' }, ...activePersons(meta).map((person) => ({ value: person.id, label: person.name }))];
  const preview = booksLoad?.preview;
  const emptyText = `No customer here. Add one with "New customer / prospect"${meta.canManage ? ', or make profiles for every billed debtor with "Load from books"' : ''}.`;

  return (
    <div className="tw:flex tw:min-h-0 tw:flex-col tw:gap-2.5">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <form onSubmit={(event) => { event.preventDefault(); load(); }} className="tw:flex tw:w-full tw:gap-1.5 tw:sm:w-auto">
          <Input
            leftIcon={Search}
            className="tw:sm:w-[260px]"
            placeholder="Name, GSTIN, city, contact, mobile"
            data-allow-text=""
            value={filters.q}
            onChange={(event) => setFilters({ ...filters, q: event.target.value })}
          />
          <Button type="submit">Search</Button>
        </form>
        {filterBox('status', 'All status', statusOptions)}
        {filterBox('kamId', 'All sales persons', kamOptions)}
        {filterBox('activity', 'Any billing', ACTIVITY_OPTIONS)}
        {filterBox('segment', 'All segments', pairOptions(meta.segments))}
        {filterBox('industry', 'All industries', activeLookups(meta, 'INDUSTRY').map((lookup) => lookup.value))}
        {filterBox('service', 'All services', pairOptions(meta.services))}
        {filterBox('customerType', 'All types', pairOptions(meta.customerTypes))}
        <CheckLabel checked={filters.reviewDue === '1'} onCheckedChange={(checked) => setFilter('reviewDue', checked ? '1' : '')}>Review due</CheckLabel>
        <SelectBox
          className="tw:w-full tw:sm:w-auto tw:sm:min-w-[130px]"
          value={filters.sort}
          onValueChange={(value) => setFilter('sort', value)}
          options={[
            { value: 'billed', label: `Sort: billed ${fy}` },
            { value: 'lastBill', label: 'Sort: last bill' },
            { value: 'potential', label: 'Sort: potential' },
            { value: 'name', label: 'Sort: name' },
          ]}
        />
        <div className="tw:flex tw:flex-wrap tw:gap-1.5 tw:sm:ml-auto">
          <Button size="icon" onClick={() => load()} title="Refresh" aria-label="Refresh"><RefreshCw /></Button>
          {meta.canManage && <Button onClick={previewBooksLoad}><Download /> Load from books</Button>}
          <Button variant="default" onClick={() => setOpenId('new')}><Plus /> New customer / prospect</Button>
        </div>
      </div>

      <Muted className="tw:text-entry">
        {loading ? 'Loading…' : `${info.total} customers${info.total > rows.length ? ` (first ${rows.length} shown)` : ''}. Billed = sales bills less credit notes incl. GST; duty / DO accounts are shown apart.`}
      </Muted>
      <DataTable
        columns={customerColumns(meta, fy)}
        rows={rows}
        onRowClick={(row) => setOpenId(row.id)}
        emptyText={loading ? '' : emptyText}
        containerClassName="tw:max-h-[calc(100vh-330px)] tw:rounded-md tw:border tw:border-border tw:bg-card"
      />

      {openId && (
        <CustomerForm
          id={openId === 'new' ? null : openId}
          meta={meta}
          onClose={() => setOpenId(null)}
          onSaved={(savedId) => { load(); if (savedId) setOpenId(savedId); }}
          reloadMeta={reloadMeta}
        />
      )}

      <Modal
        open={Boolean(booksLoad)}
        onClose={() => !booksLoad?.busy && setBooksLoad(null)}
        title="Load customers from the books"
        width={900}
        footer={preview && (
          <>
            <Button disabled={booksLoad.busy} onClick={() => setBooksLoad(null)}>Cancel</Button>
            <Button variant="default" disabled={booksLoad.busy || !(preview.made || preview.linked)} onClick={runBooksLoad}>
              {booksLoad.busy ? 'Loading…' : `Make ${preview.made} customers`}
            </Button>
          </>
        )}
      >
        {booksLoad?.busy && !preview && <Muted className="tw:text-entry">Reading the books…</Muted>}
        {preview && <BooksPreview preview={preview} />}
      </Modal>
    </div>
  );
}
