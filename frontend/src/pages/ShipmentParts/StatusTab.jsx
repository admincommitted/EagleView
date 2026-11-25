import { useState } from 'react';
import { Mail, Save } from 'lucide-react';
import { Button, DataTable, DateInput, Input } from '@/components/ui';
import { Panel, StatusMessage } from './layout';
import DeleteButton from './DeleteButton';
import StatusMail from './StatusMail';
import { shipmentApi } from './shipmentApi';
import useEvents, { removeEvent } from './useEvents';

const weekday = (ymd) => (ymd ? new Date(ymd + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' }) : '');

export default function StatusTab({ shipmentId, docketNo, levels, onChanged }) {
  const [showMail, setShowMail] = useState(false);
  const [events, reload] = useEvents(shipmentId);
  const [edits, setEdits] = useState({});
  const [message, setMessage] = useState(null);

  const savedStatus = (level) => events.find((event) => event.kind === 'status' && event.title === level);
  const editOf = (level) => edits[level] || {};
  const editLevel = (level, key, value) => setEdits({ ...edits, [level]: { ...editOf(level), [key]: value } });
  // what the row shows: the typed value, else the saved one
  const shownValue = (level, key, savedKey) => editOf(level)[key] ?? savedStatus(level)?.[savedKey] ?? '';

  const save = async (level) => {
    const edit = editOf(level);
    const saved = savedStatus(level);
    if (!(edit.date || saved?.eventDate)) {
      setMessage({ tone: 'error', text: 'Status date is required for ' + level });
      return;
    }
    try {
      await shipmentApi.saveEvent(shipmentId, {
        kind: 'status',
        id: saved?.id,
        title: level,
        eventDate: edit.date || saved.eventDate,
        eventTime: edit.time ?? saved?.eventTime ?? '',
        remarks: edit.remarks ?? saved?.remarks ?? '',
      });
      setEdits({ ...edits, [level]: undefined });
      setMessage({ tone: 'success', text: level + ' saved' });
      reload();
      onChanged?.();
    } catch (error) {
      setMessage({ tone: 'error', text: error.message });
    }
  };

  const remove = (level) => removeEvent(shipmentId, savedStatus(level), 'Remove the status ' + level + '?', () => { reload(); onChanged?.(); });

  const columns = [
    { key: 'level', header: 'Level', className: 'tw:font-bold', cell: (level) => `${levels.indexOf(level) + 1}. ${level}` },
    { key: 'day', header: 'Day', className: 'tw:text-muted-foreground', cell: (level) => weekday(shownValue(level, 'date', 'eventDate')) },
    {
      key: 'date',
      header: 'Status Date',
      cell: (level) => <DateInput wrapperClassName="tw:w-[140px]" value={shownValue(level, 'date', 'eventDate')} onValueChange={(value) => editLevel(level, 'date', value)} />,
    },
    {
      key: 'time',
      header: 'Status Time',
      cell: (level) => <Input type="time" className="tw:w-[100px]" value={shownValue(level, 'time', 'eventTime')} onChange={(event) => editLevel(level, 'time', event.target.value)} />,
    },
    {
      key: 'remarks',
      header: 'Remark',
      className: 'tw:min-w-[160px]',
      cell: (level) => <Input value={shownValue(level, 'remarks', 'remarks')} onChange={(event) => editLevel(level, 'remarks', event.target.value)} />,
    },
    { key: 'user', header: 'User', className: 'tw:text-[11px] tw:text-muted-foreground', cell: (level) => savedStatus(level)?.modifiedBy || savedStatus(level)?.createdBy || '' },
    {
      key: 'actions',
      header: '',
      cell: (level) => (
        <div className="tw:flex tw:items-center tw:gap-1.5">
          <Button size="sm" variant={edits[level] ? 'success' : 'ghost'} onClick={() => save(level)}><Save className="tw:size-3" /> Save</Button>
          {savedStatus(level) && <DeleteButton onClick={() => remove(level)} />}
        </div>
      ),
    },
  ];

  return (
    <>
      <Panel
        title="Shipment Status"
        className="tw:bg-background"
        bodyClassName="tw:p-0"
        actions={(
          <>
            <StatusMessage message={message} />
            <Button size="sm" variant="default" onClick={() => setShowMail(!showMail)}><Mail className="tw:size-3" /> Send Mail</Button>
          </>
        )}
      >
        <DataTable
          columns={columns}
          rows={levels}
          rowKey={(level) => level}
          rowClassName={(level) => (savedStatus(level) ? 'tw:bg-success/10 tw:even:bg-success/10' : '')}
          emptyText="No status levels"
        />
      </Panel>
      {showMail && <StatusMail shipmentId={shipmentId} docketNo={docketNo} onClose={() => setShowMail(false)} />}
    </>
  );
}
