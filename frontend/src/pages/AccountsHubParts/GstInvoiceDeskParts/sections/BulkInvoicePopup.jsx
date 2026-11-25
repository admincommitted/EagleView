import { useState } from 'react';
import { Search } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Button, Checkbox, DateInput, Modal } from '@/components/ui';
import { Grid, fmtDate } from '../../ui';
import { accountsApi } from '../../accountsApi';
import { GridField } from './formParts';

// iCAFFE's "Bulk invoice": dockets in the dates whose shipper / importer is the invoice party; the order ticked is the
// order on the invoice
export default function BulkInvoicePopup({ partyName, partyId, chosen, onOk, onClose }) {
  const [dates, setDates] = useState({ from: '', to: '' });
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [order, setOrder] = useState([]);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    setError('');
    if (!String(partyName || '').trim() || !dates.from || !dates.to) { setError('Please fill in all required fields: Party, From Date, and To Date.'); return; }
    try {
      setRows(await accountsApi.gstInvoiceBulkDockets({ party: partyName, ...(partyId ? { partyId } : {}), from: dates.from, to: dates.to }));
      setOrder([]);
    } catch (searchError) {
      setError(errorMessage(searchError)); setRows([]);
    }
  };
  const list = (rows || []).filter((row) => !chosen.includes(row.docketNo));
  const toggle = (docketNo) => setOrder((old) => (old.includes(docketNo) ? old.filter((entry) => entry !== docketNo) : [...old, docketNo]));
  const allTicked = list.length > 0 && list.every((row) => order.includes(row.docketNo));
  const toggleAll = (on) => setOrder(on ? [...order, ...list.map((row) => row.docketNo).filter((docketNo) => !order.includes(docketNo))] : []);
  const ok = async () => { setBusy(true); await onOk(order); setBusy(false); };

  const columns = [
    { label: <Checkbox title="Select all" aria-label="Select all" checked={allTicked} onCheckedChange={(value) => toggleAll(value === true)} />, render: (row) => <Checkbox aria-label="Tick" checked={order.includes(row.docketNo)} className="tw:pointer-events-none" /> },
    { label: 'Docket No', render: (row) => <b>{row.docketNo}</b> },
    { label: 'Date', render: (row) => fmtDate(row.docketDate) },
    { label: 'Shipper / Importer', key: 'party', wrap: true },
    { label: 'Job', render: (row) => row.dir + ' ' + (row.mode || '') },
    { label: 'MAWB / MBL', key: 'mawbNo' },
    { label: 'HAWB / HBL', key: 'hawbNo' },
    { label: 'Cost sheet', render: (row) => (row.costSheet ? <Badge variant="success">Yes</Badge> : <Badge variant="neutral">No</Badge>) },
    { label: 'Billed on', render: (row) => row.billedOn.join(', ') },
  ];
  const footer = (
    <>
      <span className="tw:mr-auto tw:self-center tw:text-[11px] tw:text-muted-foreground">{order.length} docket(s) ticked - Ok brings each docket's cost sheet charges to the invoice</span>
      <Button size="lg" onClick={onClose}>Close</Button>
      <Button variant="success" size="lg" disabled={busy} onClick={ok}>Ok</Button>
    </>
  );

  return (
    <Modal open onClose={onClose} width={980} title="Bulk invoice" footer={footer}
      description={<>Party: <b>{partyName}</b> - dockets where this party is the shipper / importer</>}>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-end">
        <GridField label="From Date" required className="tw:w-full tw:md:w-[150px]"><DateInput value={dates.from} required={!dates.from} onValueChange={(value) => setDates((old) => ({ ...old, from: value }))} /></GridField>
        <GridField label="To Date" required className="tw:w-full tw:md:w-[150px]"><DateInput value={dates.to} required={!dates.to} onValueChange={(value) => setDates((old) => ({ ...old, to: value }))} /></GridField>
        <Button variant="default" size="lg" onClick={search}><Search /> Search</Button>
        {chosen.length > 0 && <span className="tw:pb-1.5 tw:text-[11px] tw:text-muted-foreground">Already on this invoice: {chosen.join(', ')}</span>}
      </div>
      {error && <div className="tw:font-bold tw:text-destructive">{error}</div>}
      <Grid maxHeight={330} minHeight={140} empty={rows ? 'No docket of this party in these dates' : 'Enter From / To date and Search'} onRow={(row) => toggle(row.docketNo)} rowKey={(row) => row.docketNo}
        cols={columns} rows={list} />
    </Modal>
  );
}
