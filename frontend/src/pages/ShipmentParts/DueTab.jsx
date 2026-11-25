import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button, DateInput, Input, SelectBox } from '@/components/ui';
import { cn } from '@/lib/utils';
import { toDisplayDate } from '@/lib/dates';
import { FormGrid, GridField, GridPanel, Panel, StatusMessage } from './layout';
import DeleteButton from './DeleteButton';
import { shipmentApi } from './shipmentApi';
import useEvents, { removeEvent } from './useEvents';
import { todayIso } from './shipmentForm';

const isLate = (ymd) => ymd && ymd < todayIso();

function DueDate({ value, late }) {
  return <span className={cn('tw:font-bold', late && 'tw:text-destructive')}>{toDisplayDate(value)}</span>;
}

const OPEN_DUE_COLUMNS = [
  { key: 'eventDate', header: 'Due Date', cell: (row) => <DueDate value={row.eventDate} late={isLate(row.eventDate)} /> },
  { key: 'docketNo', header: 'Docket No', cell: (row) => <b>{row.docketNo}</b> },
  { key: 'mainParty', header: 'Party' },
  { key: 'title', header: 'Bill Type' },
  { key: 'remarks', header: 'Remarks' },
];

export default function DueTab({ shipmentId, docketNo, division, branch, types }) {
  const [events, reload] = useEvents(shipmentId);
  const [draft, setDraft] = useState({ title: '', date: todayIso(), remarks: '' });
  const [message, setMessage] = useState(null);
  const [openDueDates, setOpenDueDates] = useState([]);

  const loadOpenDueDates = useCallback(async () => {
    try {
      setOpenDueDates(await shipmentApi.openDueDates(division, branch));
    } catch {
      setOpenDueDates([]);
    }
  }, [division, branch]);
  useEffect(() => { loadOpenDueDates(); }, [loadOpenDueDates]);

  const reloadAll = () => { reload(); loadOpenDueDates(); };
  const dueDates = events.filter((event) => event.kind === 'duedate');

  const add = async () => {
    if (!draft.title) {
      setMessage({ tone: 'error', text: 'Select Document Type' });
      return;
    }
    try {
      await shipmentApi.saveEvent(shipmentId, { kind: 'duedate', title: draft.title, eventDate: draft.date, remarks: draft.remarks, status: 'Open' });
      reloadAll();
      setMessage(null);
    } catch (error) {
      setMessage({ tone: 'error', text: error.message });
    }
  };

  const toggleDone = async (row) => {
    await shipmentApi.saveEvent(shipmentId, { kind: 'duedate', id: row.id, title: row.title, eventDate: row.eventDate, remarks: row.remarks, status: row.status === 'Done' ? 'Open' : 'Done' });
    reloadAll();
  };

  const docketColumns = [
    { key: 'docketNo', header: 'Docket No', cell: () => docketNo },
    { key: 'title', header: 'Bill Type', cell: (row) => <b>{row.title}</b> },
    { key: 'eventDate', header: 'Due Date', cell: (row) => <DueDate value={row.eventDate} late={row.status !== 'Done' && isLate(row.eventDate)} /> },
    { key: 'remarks', header: 'Remarks' },
    { key: 'createdBy', header: 'Enter By' },
    { key: 'createdAt', header: 'Enter Date', cell: (row) => toDisplayDate(row.createdAt) },
    { key: 'modifiedBy', header: 'Modified By' },
    { key: 'updatedAt', header: 'Modified Date', cell: (row) => (row.modifiedBy ? toDisplayDate(row.updatedAt) : '') },
    {
      key: 'done',
      header: '',
      cell: (row) => <Button size="sm" variant={row.status === 'Done' ? 'ghost' : 'secondary'} onClick={() => toggleDone(row)}>{row.status === 'Done' ? 'Re-open' : 'Mark done'}</Button>,
    },
    { key: 'delete', header: '', cell: (row) => <DeleteButton onClick={() => removeEvent(shipmentId, row, 'Remove the due date ' + row.title + '?', reloadAll)} /> },
  ];

  return (
    <>
      {shipmentId && (
        <Panel title={'Set Due Dates for Documents - ' + docketNo}>
          <FormGrid columns={6}>
            <GridField label="Select Document Type" required span={2}>
              <SelectBox
                clearable
                clearLabel="Select Document Type"
                placeholder="Select Document Type"
                required={!draft.title}
                value={draft.title}
                onValueChange={(title) => setDraft({ ...draft, title })}
                options={types}
              />
            </GridField>
            <GridField label="Due Date"><DateInput value={draft.date} onValueChange={(date) => setDraft({ ...draft, date })} /></GridField>
            <GridField label="Remarks" span={2}><Input value={draft.remarks} onChange={(event) => setDraft({ ...draft, remarks: event.target.value })} /></GridField>
            <Button variant="success" onClick={add}><Save /> Set Due Date</Button>
          </FormGrid>
          <StatusMessage message={message} />
        </Panel>
      )}
      {shipmentId && (
        <GridPanel title="Due Date" heightClassName="tw:min-h-[100px] tw:max-h-[220px]" columns={docketColumns} rows={dueDates} emptyText="No due date set" />
      )}
      <GridPanel
        title={'Open due dates - all dockets of this division (' + openDueDates.length + ')'}
        heightClassName="tw:max-h-[260px]"
        columns={OPEN_DUE_COLUMNS}
        rows={openDueDates}
        emptyText="Nothing due"
      />
    </>
  );
}
