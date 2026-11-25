import { useEffect, useState } from 'react';
import { Save, Search } from 'lucide-react';
import { Badge, Button, DateInput, Input, SelectBox } from '@/components/ui';
import { toDisplayDate } from '@/lib/dates';
import { FormGrid, GridCell, GridField, GridPanel, Panel, StatusMessage } from './layout';
import { shipmentApi } from './shipmentApi';
import { fyStartIso, stageVariant, todayIso } from './shipmentForm';

const LIST_LIMIT = 500;

const stageColumns = (labels) => [
  { key: 'docketDate', header: 'Docket Date', cell: (row) => toDisplayDate(row.docketDate) },
  { key: 'docketNo', header: 'Docket No', cell: (row) => <b>{row.docketNo}</b> },
  { key: 'stage', header: 'Status', cell: (row) => <Badge variant={stageVariant(row.stage)}>{row.stage || 'Register'}</Badge> },
  { key: 'mainParty', header: labels.main, className: 'tw:whitespace-normal' },
  { key: 'mawbNo', header: labels.master },
  { key: 'hawbNo', header: labels.house },
  { key: 'currentStatus', header: 'Current Status' },
];

function stageSummary(operation, answer) {
  const doneText = answer.done.length ? operation + ': ' + answer.done.join(', ') : '';
  const skippedText = answer.skipped.length ? (answer.done.length ? '. ' : '') + 'Not changed: ' + answer.skipped.join('; ') : '';
  return { tone: answer.skipped.length ? 'error' : 'success', text: doneText + skippedText };
}

export default function StageTab({ division, labels, branch, stages, onChanged }) {
  const [filters, setFilters] = useState({ from: fyStartIso(), to: todayIso(), stage: 'Register', docketNo: '', party: '', originPort: '', destinationPort: '' });
  const [rows, setRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [operation, setOperation] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState(null);

  const run = async () => {
    const query = {
      division, branch, from: filters.from, to: filters.to,
      ...(filters.stage && { stage: filters.stage }),
      ...(filters.docketNo && { docketNo: filters.docketNo }),
      ...(filters.party && { mainParty: filters.party }),
      ...(filters.originPort && { originPort: filters.originPort }),
      ...(filters.destinationPort && { destinationPort: filters.destinationPort }),
    };
    try {
      setRows(await shipmentApi.list(query));
      setSelectedIds([]);
    } catch (error) {
      setMessage({ tone: 'error', text: error.message });
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- searches by itself only when the division changes
  useEffect(() => { run(); }, [division]);

  const ids = rows.filter((row) => selectedIds.includes(row.id)).map((row) => row.id);
  const toggle = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((picked) => picked !== id) : [...current, id]));
  const toggleAll = () => setSelectedIds(rows.length > 0 && ids.length === rows.length ? [] : rows.map((row) => row.id));

  const apply = async () => {
    if (!operation) {
      setMessage({ tone: 'error', text: 'Choose the Operation Type' });
      return;
    }
    try {
      const answer = await shipmentApi.setStage(ids, operation, reason);
      setMessage(stageSummary(operation, answer));
      run();
      onChanged?.();
    } catch (error) {
      setMessage({ tone: 'error', text: error.message });
    }
  };

  const setFilter = (key) => (value) => setFilters({ ...filters, [key]: value });
  const textFilter = (key, label) => (
    <GridField label={label}><Input value={filters[key]} onChange={(event) => setFilter(key)(event.target.value)} /></GridField>
  );
  const tooMany = rows.length >= LIST_LIMIT ? ' - only the latest 500; narrow the dates or filters' : '';

  return (
    <>
      <Panel title="Complete / Cancel">
        <FormGrid columns={8}>
          <GridField label="Operation Type" required>
            <SelectBox clearable clearLabel="Select" placeholder="Select" required={!operation} value={operation} onValueChange={setOperation} options={stages} />
          </GridField>
          {operation === 'Cancelled' && (
            <GridField label="Reason" required span={3}><Input value={reason} required={!reason} onChange={(event) => setReason(event.target.value)} /></GridField>
          )}
          <Button variant="success" onClick={apply} disabled={!ids.length}><Save /> Save ({ids.length})</Button>
          <GridCell span={3}><StatusMessage message={message} /></GridCell>
        </FormGrid>
      </Panel>
      <Panel title="Search Panel">
        <FormGrid columns={8}>
          <GridField label="From Date"><DateInput value={filters.from} onValueChange={setFilter('from')} /></GridField>
          <GridField label="To Date"><DateInput value={filters.to} onValueChange={setFilter('to')} /></GridField>
          <GridField label="Docket Stage">
            <SelectBox clearable clearLabel="All" placeholder="All" value={filters.stage} onValueChange={setFilter('stage')} options={stages} />
          </GridField>
          {textFilter('docketNo', 'Docket No')}
          {textFilter('party', labels.main)}
          {textFilter('originPort', 'Origin Port')}
          {textFilter('destinationPort', 'Dstn Port')}
          <Button variant="default" onClick={run}><Search /> Search</Button>
        </FormGrid>
      </Panel>
      <GridPanel
        title={`Shipment Details (${rows.length})${tooMany}`}
        heightClassName="tw:min-h-[160px] tw:max-h-[380px]"
        columns={stageColumns(labels)}
        rows={rows}
        onRowClick={(row) => toggle(row.id)}
        selection={{ keys: ids, onToggle: toggle, onToggleAll: toggleAll }}
        emptyText="No docket"
      />
    </>
  );
}
