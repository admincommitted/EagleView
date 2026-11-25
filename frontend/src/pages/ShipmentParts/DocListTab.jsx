import { useEffect, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { Button, DataTable, DateInput, Input, SelectBox } from '@/components/ui';
import { Panel, StatusMessage } from './layout';
import { shipmentApi } from './shipmentApi';
import { OPTIONS, todayIso } from './shipmentForm';

export default function DocListTab({ shipmentId, list, docs, onSaved }) {
  const [docStates, setDocStates] = useState(docs || {});
  const [message, setMessage] = useState(null);
  const [extraName, setExtraName] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps -- a fresh copy only when another docket is opened
  useEffect(() => { setDocStates(docs || {}); }, [shipmentId]);

  const names = [...new Set([...list, ...Object.keys(docStates)])];
  const received = names.filter((name) => docStates[name]?.status === 'Received').length;

  const setDocPart = (name, key, value) => {
    const current = docStates[name] || {};
    const stampToday = key === 'status' && value === 'Received' && !current.date;
    setDocStates({ ...docStates, [name]: { ...current, [key]: value, ...(stampToday && { date: todayIso() }) } });
  };

  const save = async () => {
    try {
      await shipmentApi.saveDocList(shipmentId, docStates);
      onSaved(docStates);
      setMessage({ tone: 'success', text: 'Saved' });
    } catch (error) {
      setMessage({ tone: 'error', text: error.message });
    }
  };

  const addExtra = () => {
    if (!extraName.trim()) return;
    setDocStates({ ...docStates, [extraName.trim()]: {} });
    setExtraName('');
  };

  const columns = [
    { key: 'name', header: 'Document Name', className: 'tw:font-bold', cell: (name) => name },
    {
      key: 'status',
      header: 'Status',
      cell: (name) => (
        <SelectBox className="tw:w-[130px]" clearable clearLabel="Pending" placeholder="Pending" value={docStates[name]?.status || ''} onValueChange={(value) => setDocPart(name, 'status', value)} options={OPTIONS.docStatus} />
      ),
    },
    { key: 'date', header: 'Date', cell: (name) => <DateInput wrapperClassName="tw:w-[140px]" value={docStates[name]?.date || ''} onValueChange={(value) => setDocPart(name, 'date', value)} /> },
    {
      key: 'remarks',
      header: 'Remarks',
      className: 'tw:min-w-[160px]',
      cell: (name) => <Input value={docStates[name]?.remarks || ''} onChange={(event) => setDocPart(name, 'remarks', event.target.value)} />,
    },
  ];

  return (
    <Panel
      title={`Document List - ${received} of ${names.length} received`}
      className="tw:bg-background"
      bodyClassName="tw:p-0"
      actions={<><StatusMessage message={message} /><Button size="sm" variant="success" onClick={save}><Save className="tw:size-3" /> Save</Button></>}
    >
      <DataTable
        columns={columns}
        rows={names}
        rowKey={(name) => name}
        rowClassName={(name) => (docStates[name]?.status === 'Received' ? 'tw:bg-success/10 tw:even:bg-success/10' : '')}
        emptyText="No document in the list"
      />
      <div className="tw:flex tw:gap-1.5 tw:p-1.5">
        <Input className="tw:w-full tw:md:w-[260px]" value={extraName} onChange={(event) => setExtraName(event.target.value.toUpperCase())} placeholder="Add another document" />
        <Button size="sm" variant="ghost" onClick={addExtra}><Plus className="tw:size-3" /> Add</Button>
      </div>
    </Panel>
  );
}
