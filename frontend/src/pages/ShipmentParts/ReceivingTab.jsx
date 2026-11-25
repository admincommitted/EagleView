import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, DateInput, Input, NumberInput, SelectBox } from '@/components/ui';
import { toDisplayDate } from '@/lib/dates';
import { FormGrid, GridField, GridPanel, Panel, StatusMessage } from './layout';
import { MasterLookup } from './MasterLookup';
import DeleteButton from './DeleteButton';
import { shipmentApi } from './shipmentApi';
import useEvents, { removeEvent } from './useEvents';
import { formatInr, nowTime, OPTIONS, todayIso } from './shipmentForm';

function DraftBox({ field, draft, setDraft }) {
  const value = draft[field.key];
  const change = (next) => setDraft({ ...draft, [field.key]: next });
  if (field.kind === 'date') return <DateInput value={value} onValueChange={change} />;
  if (field.kind === 'time') return <Input type="time" value={value} onChange={(event) => change(event.target.value)} />;
  if (field.kind === 'number') return <NumberInput value={value} onValueChange={change} />;
  if (field.kind === 'select') return <SelectBox clearable clearLabel="Select" placeholder="Select" value={value} onValueChange={change} options={field.options} />;
  if (field.kind === 'currency') {
    return <MasterLookup what="currency" value={value} upper noAdd onText={change} onPick={(currency) => change(currency.code)} />;
  }
  return <Input value={value} onChange={(event) => change(event.target.value)} required={field.required && !value} />;
}

const RECEIVED_FIELDS = [
  { key: 'recDate', label: 'Receiving Date', kind: 'date' },
  { key: 'recTime', label: 'Time', kind: 'time' },
];
const RECEIVED_COLUMNS = [
  { key: 'eventDate', header: 'Received Date', cell: (event) => toDisplayDate(event.eventDate) },
  { key: 'eventTime', header: 'Received Time' },
];

// one kind of paper received: the entry row, then the list of what came in
function ReceivedSection({ title, fields, initialDraft, clearedKeys, toEventData, kind, columns, emptyText, events, shipmentId, reload, onError }) {
  const [draft, setDraft] = useState(initialDraft);
  const rows = events.filter((event) => event.kind === kind);

  const add = async () => {
    try {
      await shipmentApi.saveEvent(shipmentId, { kind, title: draft.title, eventDate: draft.recDate, eventTime: draft.recTime, data: toEventData(draft) });
      onError(null);
      reload();
      setDraft({ ...draft, ...Object.fromEntries(clearedKeys.map((key) => [key, ''])) });
    } catch (error) {
      onError(error.message);
    }
  };

  const deleteColumn = { key: 'delete', header: '', cell: (event) => <DeleteButton onClick={() => removeEvent(shipmentId, event, 'Remove ' + event.title + '?', reload)} /> };
  return (
    <>
      <Panel title={title}>
        <FormGrid columns={9}>
          {[...fields, ...RECEIVED_FIELDS].map((field) => (
            <GridField key={field.key} label={field.label} required={field.required} span={field.span}>
              <DraftBox field={field} draft={draft} setDraft={setDraft} />
            </GridField>
          ))}
          <Button variant="default" onClick={add}><Plus className="tw:size-3" /> Add</Button>
        </FormGrid>
      </Panel>
      <GridPanel heightClassName="tw:max-h-[150px]" emptyText={emptyText} rows={rows} columns={[...columns, ...RECEIVED_COLUMNS, deleteColumn]} />
    </>
  );
}

export default function ReceivingTab({ shipmentId, isImport }) {
  const [events, reload] = useEvents(shipmentId);
  const [problem, setProblem] = useState(null);
  const received = { recDate: todayIso(), recTime: nowTime() };
  const common = { events, shipmentId, reload, onError: setProblem };

  return (
    <>
      <ReceivedSection
        {...common}
        title="Invoice Details"
        kind="recv_invoice"
        fields={[
          { key: 'title', label: 'Invoice No', required: true },
          { key: 'date', label: 'Invoice Date', kind: 'date' },
          { key: 'currency', label: 'Currency', kind: 'currency' },
          { key: 'value', label: 'Value', kind: 'number' },
          { key: 'payMode', label: 'Pay Mode', kind: 'select', options: OPTIONS.payMode },
        ]}
        initialDraft={{ title: '', date: '', currency: 'USD', value: '', payMode: '', ...received }}
        clearedKeys={['title', 'date', 'value']}
        toEventData={(draft) => ({ invoiceDate: draft.date, currency: draft.currency, value: draft.value, payMode: draft.payMode })}
        columns={[
          { key: 'title', header: 'Invoice No' },
          { key: 'invoiceDate', header: 'Invoice Date', cell: (event) => toDisplayDate(event.data.invoiceDate) },
          { key: 'currency', header: 'Currency', cell: (event) => event.data.currency },
          { key: 'value', header: 'Value', align: 'right', cell: (event) => formatInr(event.data.value) },
          { key: 'payMode', header: 'Pay Mode', cell: (event) => event.data.payMode },
        ]}
        emptyText="No invoice received yet"
      />
      <ReceivedSection
        {...common}
        title={isImport ? 'BOE Details' : 'Shipping Bill Details'}
        kind="recv_boe"
        fields={[
          { key: 'title', label: isImport ? 'BOE No' : 'SB No', required: true },
          { key: 'date', label: isImport ? 'BOE Date' : 'SB Date', kind: 'date' },
        ]}
        initialDraft={{ title: '', date: '', ...received }}
        clearedKeys={['title', 'date']}
        toEventData={(draft) => ({ docDate: draft.date })}
        columns={[
          { key: 'title', header: isImport ? 'BOE No' : 'SB No' },
          { key: 'docDate', header: 'Date', cell: (event) => toDisplayDate(event.data.docDate) },
        ]}
        emptyText="Nothing yet"
      />
      <ReceivedSection
        {...common}
        title="Document Details"
        kind="recv_doc"
        fields={[
          { key: 'title', label: 'Doc. Name', required: true, span: 2 },
          { key: 'no', label: 'Document No' },
        ]}
        initialDraft={{ title: '', no: '', ...received }}
        clearedKeys={['title', 'no']}
        toEventData={(draft) => ({ docNo: draft.no })}
        columns={[
          { key: 'title', header: 'Document Name' },
          { key: 'docNo', header: 'Document No', cell: (event) => event.data.docNo },
        ]}
        emptyText="Nothing yet"
      />
      <StatusMessage message={problem && { tone: 'error', text: problem }} />
    </>
  );
}
