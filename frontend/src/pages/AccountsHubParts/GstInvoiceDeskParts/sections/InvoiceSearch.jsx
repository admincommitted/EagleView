import { FileJson, Printer, RefreshCw, Search, Send } from 'lucide-react';
import { Badge, Button, Checkbox, DateInput, Input, SelectBox } from '@/components/ui';
import { Box, Grid, fmtDate, inr } from '../../ui';
import { PARTY_TYPES, partyTypeOptions } from '../gstMath';
import { printInvoice } from '../invoicePrint';
import useInvoiceSearch from '../hooks/useInvoiceSearch';
import { CheckField, ChoiceButtons, GRID_6, GridField } from './formParts';

const SEARCH_BY = [['docket', 'Docket No'], ['invoice', 'Invoice No'], ['hawb', 'H/AWB No']];
const NO_PLACEHOLDER = { docket: 'DOCKET NO.', hawb: 'H/AWB NO', invoice: 'INVOICE NO.' };
const STATUS_OPTIONS = ['Approved', 'Void'];

const docketText = (row) => (row.bulk ? 'Bulk: ' + (row.dockets ? JSON.parse(row.dockets).join(', ') : '') : row.jobNo);

function TotalCell({ row }) {
  return (
    <span className={row.status === 'Void' ? 'tw:line-through' : ''}>
      {inr(row.total)}
      {row.currency && row.currency !== 'INR' && row.totalFcy ? <div className="tw:text-[10px] tw:text-muted-foreground">{row.currency} {inr(row.totalFcy)}</div> : null}
    </span>
  );
}

function searchColumns(search, showKind) {
  const { rows, chosen, ticked, toggleAll, toggleRow } = search;
  const allTicked = !!rows && rows.length > 0 && chosen.length === rows.length;
  return [
    { label: <Checkbox aria-label="Tick all" checked={allTicked} onCheckedChange={toggleAll} />, render: (row) => <Checkbox aria-label="Tick" checked={!!ticked[row.id]} onClick={(event) => event.stopPropagation()} onCheckedChange={() => toggleRow(row.id)} /> },
    { label: 'Print', render: (row) => <Button variant="ghost" size="icon-sm" title="Print" aria-label="Print" onClick={(event) => { event.stopPropagation(); printInvoice(row.id); }}><Printer className="tw:size-3" /></Button> },
    { label: 'Bill NO', render: (row) => <b className="tw:text-head">{row.invoiceNo}</b> },
    { label: 'Bill Date', render: (row) => fmtDate(row.date) },
    ...(showKind ? [{ label: 'Type', key: 'kindLabel' }] : []),
    { label: 'Previous/DR/CR No.', key: 'prevInvoiceNo' },
    { label: 'Previous Bill Type', key: 'prevKind' },
    { label: 'Status', render: (row) => <Badge variant={row.status === 'Void' ? 'danger' : 'success'}>{row.status === 'Void' ? 'Void' : 'Approved'}</Badge> },
    { label: 'Supply Type', key: 'supplyType' },
    { label: 'IRN Status', render: (row) => (row.irn ? <Badge variant={row.irnStatus === 'Cancelled' ? 'danger' : 'success'}>{row.irnStatus || 'Generated'}</Badge> : '') },
    { label: 'Party', key: 'partyName', wrap: true },
    { label: 'Docket No', render: docketText },
    { label: 'H/AWB No', key: 'hawbNo' },
    { label: 'Total', right: true, render: (row) => <TotalCell row={row} /> },
    { label: 'Entered By', key: 'createdBy' },
    { label: 'Entered Date', render: (row) => fmtDate(row.createdAt) },
    { label: 'Modified By', key: 'modifiedBy' },
    { label: 'Modified Date', render: (row) => (row.modifiedBy ? fmtDate(row.updatedAt) : '') },
    { label: 'Cost Center', key: 'costCentre' },
    { label: 'Remark', key: 'remarks', wrap: true },
  ];
}

// the Search tab (iCAFFE's columns); a click on a row opens the invoice
export default function InvoiceSearch({ kindId, onOpen }) {
  const search = useInvoiceSearch(kindId);
  const { filter, setFilterField, rows, more, error, chosen, note, netTotal } = search;
  const runOnEnter = (event) => event.key === 'Enter' && search.run();
  const title = 'Search Invoice - Total Invoice : ' + (rows ? rows.length : 0) + (more ? ' (first 500 - narrow the search)' : '') + (rows && rows.length ? ' - Net ' + inr(netTotal) : '');
  const tools = (
    <>
      {note && <span className="tw:text-[11px] tw:font-bold tw:text-foreground">{note}</span>}
      <Button variant="ghost" onClick={search.printTicked} disabled={!chosen.length}><Printer /> Print ticked ({chosen.length})</Button>
      <Button variant="ghost" onClick={search.bulkJson} disabled={!chosen.length}><FileJson /> E-Invoice JSON ({chosen.length})</Button>
      <Button variant="default" onClick={search.postTicked} disabled={!chosen.length}><Send /> Post To GSTN ({chosen.length})</Button>
    </>
  );
  return (
    <>
      <Box title="Search">
        <div className={GRID_6}>
          <GridField label="From Date"><DateInput value={filter.from} onValueChange={(value) => setFilterField('from', value)} /></GridField>
          <GridField label="To Date"><DateInput value={filter.to} onValueChange={(value) => setFilterField('to', value)} /></GridField>
          <GridField label="Party Type">
            <SelectBox value={filter.partyType} onValueChange={(value) => setFilterField('partyType', value)} options={partyTypeOptions(PARTY_TYPES.other)} placeholder="Select Party" clearable clearLabel="Select Party" />
          </GridField>
          <GridField label="Party Name" span={2}><Input data-allow-text value={filter.party} onChange={(event) => setFilterField('party', event.target.value)} placeholder="PARTY NAME" /></GridField>
          <GridField label="Status"><SelectBox value={filter.status} onValueChange={(value) => setFilterField('status', value)} options={STATUS_OPTIONS} placeholder="All" clearable clearLabel="All" /></GridField>
          <GridField label={<ChoiceButtons options={SEARCH_BY} value={filter.by} onChange={(value) => setFilterField('by', value)} />} span={2}>
            <Input data-allow-text value={filter.no} onChange={(event) => setFilterField('no', event.target.value)} onKeyDown={runOnEnter} placeholder={NO_PLACEHOLDER[filter.by]} />
          </GridField>
          <GridField label="Remark" span={2}><Input data-allow-text value={filter.remarks} onChange={(event) => setFilterField('remarks', event.target.value)} onKeyDown={runOnEnter} /></GridField>
          <GridField label="Scope"><CheckField label="All invoice types" checked={filter.all} onCheckedChange={(value) => setFilterField('all', value)} /></GridField>
          <div className="tw:flex tw:gap-1.5">
            <Button variant="default" size="lg" onClick={search.run}><Search /> Search</Button>
            <Button size="lg" onClick={search.resetFilter}><RefreshCw /> Clear</Button>
          </div>
        </div>
        {error && <div className="tw:mt-1.5 tw:font-bold tw:text-destructive">{error}</div>}
      </Box>
      <Grid title={title} maxHeight={460} onRow={onOpen} empty="No invoice for this search" right={tools} cols={searchColumns(search, filter.all)} rows={rows || []} />
    </>
  );
}
