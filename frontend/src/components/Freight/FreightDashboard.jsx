import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Anchor, CheckCircle, FileText, MapPin, Plane, Plus, Search, Ship, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { askConfirm } from '../common/askConfirm';
import { freightApi } from '../FreightForwarding/freightApi';
import { cn } from '@/lib/utils';
import { Badge, Button, Card, DataTable, DateInput, Field, Input } from '@/components/ui';

// Recording an IGM, VGM or manifest / AMS here is only a record of what the office did. It does NOT transmit anything
// to SCMTR / ICEGATE, the shipping line's VGM portal or US customs - each needs that system's own channel.

const ICONS = { plane: Plane, ship: Ship, anchor: Anchor };
const ACTION_ICONS = { DO: CheckCircle, DESTUFF: MapPin };
const TYPES_NEEDING_REFERENCE = ['DO', 'MBL', 'HBL', 'IGM', 'VGM'];
const REFERENCE_PLACEHOLDERS = { DO: 'DO/26/0001', VGM: 'VGM reference', IGM: 'IGM number' };
const DETAIL_PLACEHOLDERS = { DESTUFF: 'CFS name, date of de-stuffing...', VGM: 'Declared weight, method...' };

const STATUS_BADGES = [
  [/OOC|DELIVERED|CLEARED|SAILED|SHIPPED/, 'success'],
  [/QUERY|HOLD|RMS/, 'danger'],
  [/FILED|SUBMITTED|SENT|ASSESS|DUTY/, 'warning'],
];
const statusBadge = (status) => STATUS_BADGES.find(([pattern]) => pattern.test(String(status || '').toUpperCase()))?.[1] || 'info';

const today = () => new Date().toISOString().slice(0, 10);
const emptyEventForm = () => ({ refNo: '', detail: '', eventDate: today() });

// The server answers { success: false, error } on a refusal, sometimes with an HTTP error status.
async function callFreight(request) {
  try {
    const body = (await request()) || {};
    return { body, failure: body.success === false ? body.error || 'HTTP 200' : '' };
  } catch (error) {
    if (!error.response) throw error;
    const body = error.response.data || {};
    return { body, failure: body.error || `HTTP ${error.response.status}` };
  }
}

function useFreightBoard(kind) {
  const [rows, setRows] = useState([]);
  const [kpis, setKpis] = useState({});
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { body, failure } = await callFreight(() => freightApi.freightDashboard(kind));
      if (failure) throw new Error(failure);
      setRows(body.data || []);
      setKpis(body.kpis || {});
      setMeta(body);
    } catch (loadError) {
      setRows([]);
      setKpis({});
      setMeta(null);
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => { load(); }, [load]);

  const eventTypeOf = (type) => (meta?.eventTypes || []).find((eventType) => eventType.type === type) || { label: type, internal: true };
  const externalNoteOf = (type) => meta?.externalNotes?.[type] || '';

  return { rows, kpis, meta, loading, error, load, eventTypeOf, externalNoteOf };
}

function useEventRecorder(reload) {
  const [eventFor, setEventFor] = useState(null);
  const [form, setForm] = useState(emptyEventForm);
  const [saving, setSaving] = useState(false);

  const openEvent = (row, type) => {
    if (!row) {
      toast.error('Pick a shipment row first - these actions are recorded against one job');
      return;
    }
    setEventFor({ row, type });
    setForm(emptyEventForm());
  };

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const send = (allowRepeat) => callFreight(() => freightApi.recordFreightEvent({
    jobNo: eventFor.row.jobNo,
    jobKind: eventFor.row.jobKind,
    eventType: eventFor.type,
    eventDate: form.eventDate,
    refNo: form.refNo,
    detail: form.detail,
    allowRepeat,
  }));

  const saveEvent = async () => {
    if (!eventFor) return;
    setSaving(true);
    try {
      let result = await send(false);
      if (/already recorded/.test(result.body.error || '') && await askConfirm({ title: 'Already recorded', message: result.body.error, okLabel: 'Record again', tone: 'warn' })) {
        result = await send(true);
      }
      if (result.failure) throw new Error(result.failure);
      const { body } = result;
      toast.success(body.note || 'Recorded', { duration: body.transmitted === false && !body.data?.isInternal ? 8000 : 4000 });
      setEventFor(null);
      await reload();
    } catch (saveError) {
      toast.error('Not recorded: ' + saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return { eventFor, form, saving, openEvent, setField, saveEvent, closeEvent: () => setEventFor(null) };
}

function KpiCard({ card, value }) {
  return (
    <Card
      className="tw:gap-1 tw:border-l-4 tw:border-l-(--kpi-colour) tw:p-4 tw:lg:p-6"
      style={{ '--kpi-colour': card.colour, '--kpi-strong': card.strong }}
    >
      <div className="tw:text-[13px] tw:font-bold tw:text-muted-foreground">{card.label}</div>
      <div className={cn('tw:text-[28px] tw:font-black', card.strong ? 'tw:text-(--kpi-strong)' : 'tw:text-foreground')}>
        {value == null ? '—' : value}
      </div>
      {card.hint && <div className="tw:text-[11px] tw:text-muted-foreground/70">{card.hint}</div>}
    </Card>
  );
}

function EventForm({ recorder, eventType, externalNote }) {
  const { eventFor, form, saving, setField, saveEvent, closeEvent } = recorder;
  const { type } = eventFor;
  return (
    <div className={cn('tw:mb-5 tw:rounded-lg tw:border tw:p-4', eventType.internal ? 'tw:border-primary/25 tw:bg-primary/5' : 'tw:border-warning/40 tw:bg-warning/10')}>
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-2">
        <div className="tw:text-sm tw:font-bold tw:text-foreground">{eventType.label} &mdash; {eventFor.row.jobNo}</div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={closeEvent}><X /></Button>
      </div>
      {!eventType.internal && <div className="tw:mt-2 tw:mb-3 tw:text-xs tw:font-semibold tw:text-warning">{externalNote}</div>}
      <div className="tw:mt-3 tw:grid tw:grid-cols-1 tw:gap-3 tw:md:grid-cols-[1fr_1fr_2fr]">
        <Field layout="col" label="Date">
          <DateInput value={form.eventDate} onValueChange={(date) => setField('eventDate', date)} />
        </Field>
        <Field layout="col" label={`Reference / document no${TYPES_NEEDING_REFERENCE.includes(type) ? ' (required)' : ''}`}>
          <Input data-allow-text value={form.refNo} onChange={(event) => setField('refNo', event.target.value)} placeholder={REFERENCE_PLACEHOLDERS[type] || ''} />
        </Field>
        <Field layout="col" label="Detail">
          <Input data-allow-text value={form.detail} onChange={(event) => setField('detail', event.target.value)} placeholder={DETAIL_PLACEHOLDERS[type] || 'Anything worth keeping'} />
        </Field>
      </div>
      <Button size="lg" onClick={saveEvent} disabled={saving} className="tw:mt-3 tw:border-(--board-accent) tw:bg-(--board-accent) tw:text-white">
        {saving ? 'Recording...' : 'Record it'}
      </Button>
    </div>
  );
}

const RecordedEvents = ({ events }) => (events && events.length ? (
  <div className="tw:flex tw:flex-wrap tw:gap-1">
    {events.slice(0, 5).map((event) => (
      <Badge
        key={event.id}
        variant={event.isInternal ? 'info' : 'warning'}
        className="tw:rounded-sm"
        title={(event.refNo || '') + ' ' + (event.detail || '') + (event.isInternal ? '' : ' (recorded only, not transmitted)')}
      >
        {event.eventType}
      </Badge>
    ))}
  </div>
) : <span className="tw:text-[11px] tw:text-muted-foreground/50">nothing yet</span>);

function shipmentColumns(kind, openJob) {
  const isAir = kind.startsWith('air');
  const isImport = kind.endsWith('import');
  return [
    {
      key: 'job',
      header: `Job / ${isAir ? 'MAWB' : 'Master B/L'}`,
      cell: (shipment) => (
        <>
          <div className="tw:font-bold tw:text-primary">{shipment.jobNo}</div>
          <div className="tw:text-[11px] tw:text-muted-foreground">
            {shipment.docNo || <span className="tw:text-warning">no master document no on the job</span>}
            {shipment.houseNo ? ' / ' + shipment.houseNo : ''}
          </div>
          {shipment.igmNo && <div className="tw:text-[10px] tw:text-muted-foreground/70">IGM {shipment.igmNo}</div>}
        </>
      ),
    },
    { key: 'party', header: 'Party', cell: (shipment) => shipment.party || '—' },
    {
      key: 'carrier',
      header: isAir ? 'Flight' : 'Vessel / Voyage',
      cell: (shipment) => (
        <>
          {shipment.carrier || '—'}
          {shipment.modeUnknown && <div className="tw:text-[10px] tw:text-warning">shipment mode not set on this job</div>}
        </>
      ),
    },
    { key: 'routing', header: 'Routing', cell: (shipment) => [shipment.origin, shipment.destination].filter(Boolean).join(' → ') || '—' },
    { key: 'date', header: isImport ? 'ETA' : 'ETD', cell: (shipment) => (isImport ? shipment.eta : shipment.etd) || '—' },
    { key: 'events', header: 'Recorded', cell: (shipment) => <RecordedEvents events={shipment.events} /> },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      cell: (shipment) => (
        <>
          <Badge variant={statusBadge(shipment.status)}>{shipment.status}</Badge>
          {shipment.beNo && <div className="tw:mt-0.5 tw:text-[10px] tw:text-muted-foreground">BE {shipment.beNo}</div>}
          {shipment.sbNo && <div className="tw:mt-0.5 tw:text-[10px] tw:text-muted-foreground">SB {shipment.sbNo}</div>}
        </>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      cell: (shipment) => (
        <Button size="sm" onClick={(event) => { event.stopPropagation(); openJob(shipment.jobNo); }}>Open job</Button>
      ),
    },
  ];
}

const SEARCHED_FIELDS = ['docNo', 'houseNo', 'jobNo', 'party', 'carrier', 'origin', 'destination', 'igmNo'];
const matchesSearch = (row, search) => !search || SEARCHED_FIELDS.some((field) => String(row[field] || '').toLowerCase().includes(search.toLowerCase()));

export default function FreightDashboard({ kind, title, subtitle, accent, icon, actions, newJobPath, kpiCards }) {
  const navigate = useNavigate();
  const board = useFreightBoard(kind);
  const recorder = useEventRecorder(board.load);
  const [search, setSearch] = useState('');
  const [selectedJobNo, setSelectedJobNo] = useState(null);

  const { rows, kpis, meta, loading, error, eventTypeOf, externalNoteOf } = board;
  const shown = rows.filter((row) => matchesSearch(row, search));
  const selectedRow = rows.find((row) => row.jobNo === selectedJobNo) || null;
  const isImport = kind.endsWith('import');
  const Icon = ICONS[icon] || Anchor;
  const openJob = (jobNo) => navigate(newJobPath + '?jobNo=' + encodeURIComponent(jobNo));
  const emptyText = loading ? 'Loading shipments...' : search ? 'No shipment matches that search.' : meta?.note || 'No shipment yet.';

  return (
    <div className="tw:mx-auto tw:max-w-[1500px] tw:p-4 tw:md:p-6" style={{ '--board-accent': accent, '--kpi-cols': `repeat(${kpiCards.length}, minmax(0, 1fr))` }}>
      <div className="tw:mb-6 tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <div className="tw:flex tw:items-center tw:gap-3">
          <div className="tw:rounded-lg tw:bg-(--board-accent) tw:p-3 tw:text-white"><Icon className="tw:size-6" /></div>
          <div className="tw:min-w-0">
            <h2 className="tw:m-0 tw:text-2xl tw:font-bold tw:text-foreground">{title}</h2>
            <div className="tw:mt-1 tw:text-[13px] tw:text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        <Button size="lg" onClick={() => navigate(newJobPath)} className="tw:self-start tw:border-(--board-accent) tw:bg-(--board-accent) tw:text-white tw:md:self-auto">
          <Plus /> {isImport ? 'New Import Job' : 'New Export Job'}
        </Button>
      </div>

      {error && <div className="tw:mb-4 tw:rounded-lg tw:border tw:border-destructive/30 tw:bg-destructive/5 tw:px-4 tw:py-3 tw:text-[13px] tw:text-destructive">{error}</div>}

      <div className="tw:mb-6 tw:grid tw:grid-cols-1 tw:gap-5 tw:sm:grid-cols-2 tw:lg:grid-cols-(--kpi-cols)">
        {kpiCards.map((card) => <KpiCard key={card.key} card={card} value={kpis[card.key]} />)}
      </div>

      <div className="tw:mb-2 tw:flex tw:flex-wrap tw:gap-3">
        {actions.map((action) => {
          const eventType = eventTypeOf(action.type);
          const ActionIcon = ACTION_ICONS[action.type] || FileText;
          return (
            <Button
              key={action.type}
              size="lg"
              onClick={() => recorder.openEvent(selectedRow, action.type)}
              title={eventType.internal ? eventType.label : externalNoteOf(action.type)}
              className={cn('tw:text-foreground', !eventType.internal && 'tw:border-warning/60')}
            >
              <ActionIcon className="tw:size-4" />
              {action.label}
              {!eventType.internal && <AlertTriangle className="tw:text-warning" />}
            </Button>
          );
        })}
      </div>
      <div className="tw:mb-5 tw:text-xs tw:text-muted-foreground">
        {selectedRow
          ? <>Acting on <b>{selectedRow.jobNo}</b>{selectedRow.docNo ? ' (' + selectedRow.docNo + ')' : ''}. </>
          : <>Click a shipment row below to pick it, then use these. </>}
        <span className="tw:text-warning">
          <AlertTriangle className="tw:inline tw:size-3 tw:align-[-2px]" /> marked actions are recorded here only - this software does not transmit them to the portal.
        </span>
      </div>

      {recorder.eventFor && (
        <EventForm recorder={recorder} eventType={eventTypeOf(recorder.eventFor.type)} externalNote={externalNoteOf(recorder.eventFor.type)} />
      )}

      <Card className="tw:overflow-hidden">
        <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border tw:bg-page tw:px-5 tw:py-4 tw:md:flex-row tw:md:items-center tw:md:justify-between">
          <h3 className="tw:m-0 tw:text-[15px] tw:text-foreground">
            {isImport ? 'Incoming shipments' : 'Outgoing shipments'}
            <span className="tw:text-xs tw:font-normal tw:text-muted-foreground"> &nbsp;{loading ? 'loading...' : shown.length + ' of ' + rows.length}</span>
          </h3>
          <Input
            data-allow-text
            leftIcon={Search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search job / MBL / MAWB / party / vessel"
            className="tw:w-full tw:md:min-w-[280px]"
          />
        </div>
        <DataTable
          columns={shipmentColumns(kind, openJob)}
          rows={shown}
          rowKey={(shipment) => shipment.jobNo || shipment.id}
          selectedKey={selectedJobNo}
          onRowClick={(shipment) => setSelectedJobNo(selectedJobNo === shipment.jobNo ? null : shipment.jobNo)}
          emptyText={emptyText}
        />
        {meta?.note && <div className="tw:border-t tw:border-border tw:bg-page tw:px-5 tw:py-2.5 tw:text-[11px] tw:text-muted-foreground">{meta.note}</div>}
      </Card>
    </div>
  );
}
