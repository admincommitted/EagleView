import { useState } from 'react';
import { CheckCircle2, Plus, X } from 'lucide-react';
import { Badge, Button, DateInput, Input } from '@/components/ui';
import { toDisplayDate } from '@/lib/dates';
import { FormGrid, GridField, GridPanel, Panel, StatusMessage } from './layout';
import { shipmentApi } from './shipmentApi';
import useEvents from './useEvents';
import { nowTime, todayIso } from './shipmentForm';

const ACTIVITY_COLUMNS = [
  { key: 'createdBy', header: 'User', cell: (row) => row.createdBy || '' },
  { key: 'title', header: 'Activity', cell: (row) => <b>{row.title}</b> },
  { key: 'eventDate', header: 'Activity Date', cell: (row) => toDisplayDate(row.eventDate) },
  { key: 'eventTime', header: 'Activity Time' },
  { key: 'remarks', header: 'Remarks', className: 'tw:whitespace-normal' },
  { key: 'doneDate', header: 'Complete Date', cell: (row) => toDisplayDate(row.doneDate) },
  { key: 'doneTime', header: 'Complete Time' },
  { key: 'status', header: 'Status', cell: (row) => <Badge variant={row.status === 'Done' ? 'success' : 'warning'}>{row.status || 'Pending'}</Badge> },
];

export default function ActivityTab({ shipmentId }) {
  const [events, reload] = useEvents(shipmentId);
  const [draft, setDraft] = useState({ title: '', date: todayIso(), time: nowTime(), remarks: '' });
  const [message, setMessage] = useState(null);
  const [completing, setCompleting] = useState(null);
  const activities = events.filter((event) => event.kind === 'activity');

  const add = async () => {
    try {
      await shipmentApi.saveEvent(shipmentId, { kind: 'activity', title: draft.title, eventDate: draft.date, eventTime: draft.time, remarks: draft.remarks, status: 'Pending' });
      setDraft({ ...draft, title: '', remarks: '' });
      reload();
      setMessage(null);
    } catch (error) {
      setMessage({ tone: 'error', text: error.message });
    }
  };

  const complete = async () => {
    try {
      const { id, title, eventDate, eventTime, doneDate, doneTime, remarks } = completing;
      await shipmentApi.saveEvent(shipmentId, { kind: 'activity', id, title, eventDate, eventTime, doneDate, doneTime, remarks, status: 'Done' });
      setCompleting(null);
      reload();
    } catch (error) {
      setMessage({ tone: 'error', text: error.message });
    }
  };

  const startCompleting = (row) => {
    if (row.status !== 'Done') setCompleting({ ...row, doneDate: todayIso(), doneTime: nowTime() });
  };

  return (
    <>
      <GridPanel
        title={'Activity List (' + activities.length + ')'}
        heightClassName="tw:min-h-[140px] tw:max-h-[300px]"
        columns={ACTIVITY_COLUMNS}
        rows={activities}
        onRowClick={startCompleting}
        emptyText="No activity yet"
      />
      {completing && (
        <Panel
          title={'Update Pending Activity - ' + completing.title}
          actions={<Button size="sm" variant="ghost" onClick={() => setCompleting(null)}><X className="tw:size-3" /> Close</Button>}
        >
          <FormGrid columns={6}>
            <GridField label="Activity Complete Date">
              <DateInput value={completing.doneDate} onValueChange={(doneDate) => setCompleting({ ...completing, doneDate })} />
            </GridField>
            <GridField label="Time">
              <Input type="time" value={completing.doneTime} onChange={(event) => setCompleting({ ...completing, doneTime: event.target.value })} />
            </GridField>
            <GridField label="Remarks" span={3}>
              <Input value={completing.remarks || ''} onChange={(event) => setCompleting({ ...completing, remarks: event.target.value })} />
            </GridField>
            <Button variant="success" onClick={complete}><CheckCircle2 /> Save</Button>
          </FormGrid>
        </Panel>
      )}
      <Panel title="New Activity">
        <FormGrid columns={6}>
          <GridField label="Activity" required span={2}>
            <Input value={draft.title} required={!draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="e.g. Follow up importer for documents" />
          </GridField>
          <GridField label="Date"><DateInput value={draft.date} onValueChange={(date) => setDraft({ ...draft, date })} /></GridField>
          <GridField label="Time"><Input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} /></GridField>
          <GridField label="Remarks"><Input value={draft.remarks} onChange={(event) => setDraft({ ...draft, remarks: event.target.value })} /></GridField>
          <Button variant="default" onClick={add}><Plus className="tw:size-3" /> Add</Button>
        </FormGrid>
        <StatusMessage message={message} />
      </Panel>
    </>
  );
}
