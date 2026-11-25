import { Download, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, DateInput, Input, SelectBox, Textarea } from '@/components/ui';
import { ActionBar, Box, Grid, fmtDate, inr } from '../../ui';
import { CheckField } from '../../GstInvoiceDeskParts/sections/formParts';
import { STATE_OPTIONS, stateOfGstin } from '../mastersData';
import useLedgerChildren from '../hooks/useLedgerChildren';
import { FormField } from './masterParts';

const ENTRY_GRID = 'tw:grid tw:grid-cols-1 tw:items-end tw:gap-2.5 tw:sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]';
const balanced = (difference) => Math.abs(difference) < 0.01;
const drCr = (value) => inr(Math.abs(value)) + ' ' + (value < 0 ? 'Cr' : 'Dr');

// one text box of the entry form; fields: [key, label, { required, span, upper, maxLength, placeholder, right }]
function TextField({ field, entry, setField }) {
  const [key, label, options = {}] = field;
  const value = entry[key] ?? '';
  const required = options.required && !(options.right ? Number(value) : value);
  return (
    <FormField label={label} required={options.required} span={options.span}>
      <Input data-allow-text={options.right ? undefined : ''} required={required} value={value} maxLength={options.maxLength} placeholder={options.placeholder} inputMode={options.right ? 'decimal' : undefined}
        className={cn(options.right && 'tw:text-right')} onChange={(event) => setField(key, options.upper ? event.target.value.toUpperCase() : event.target.value)} />
    </FormField>
  );
}

const ADDRESS_FIELDS = [['label', 'Label', { placeholder: 'Mumbai branch' }], ['address', 'Address', { required: true, span: 2 }], ['city', 'City']];
const ADDRESS_CONTACT_FIELDS = [['contactPerson', 'Contact Person'], ['phone', 'Phone'], ['email', 'Email']];
const BANK_FIELDS = [['bankName', 'Bank Name'], ['accountName', 'Account Name'], ['accountNo', 'Account No', { required: true }], ['ifsc', 'IFSC', { upper: true, maxLength: 11 }],
  ['branch', 'Branch'], ['swift', 'SWIFT (overseas)', { upper: true, maxLength: 11 }]];

function AddressFields({ entry, setField }) {
  const text = (field) => <TextField key={field[0]} field={field} entry={entry} setField={setField} />;
  return (
    <>
      {ADDRESS_FIELDS.map(text)}
      <FormField label="State"><SelectBox value={entry.state || ''} onValueChange={(value) => setField('state', value)} options={STATE_OPTIONS} placeholder="Select" clearable clearLabel="Select" /></FormField>
      <FormField label="PIN"><Input value={entry.pinCode || ''} onChange={(event) => setField('pinCode', event.target.value)} /></FormField>
      <FormField label="GSTIN">
        <Input data-allow-text value={entry.gstin || ''} maxLength={15} onChange={(event) => { const gstin = event.target.value; setField('gstin', gstin.toUpperCase()); if (!entry.state) setField('state', stateOfGstin(gstin)); }} />
      </FormField>
      {ADDRESS_CONTACT_FIELDS.map(text)}
    </>
  );
}

function OpeningFields({ entry, setField }) {
  return (
    <>
      <TextField field={['docNo', 'Bill / Doc No', { required: true }]} entry={entry} setField={setField} />
      <FormField label="Bill Date" required><DateInput value={entry.docDate || ''} onValueChange={(value) => setField('docDate', value)} /></FormField>
      <FormField label="Due Date"><DateInput value={entry.dueDate || ''} onValueChange={(value) => setField('dueDate', value)} /></FormField>
      <FormField label="Dr / Cr"><SelectBox value={entry.dc || 'Dr'} onValueChange={(value) => setField('dc', value)} options={['Dr', 'Cr']} /></FormField>
      <TextField field={['amount', 'Amount', { required: true, right: true }]} entry={entry} setField={setField} />
      <TextField field={['jobNo', 'Job No']} entry={entry} setField={setField} />
      <TextField field={['remarks', 'Remarks']} entry={entry} setField={setField} />
    </>
  );
}

function OpeningBalanceCheck({ billsTotal, ledgerOpening, difference }) {
  const ok = balanced(difference);
  return (
    <div className={cn('tw:flex tw:flex-wrap tw:items-center tw:gap-x-7 tw:gap-y-1 tw:rounded-md tw:border tw:px-3 tw:py-2 tw:text-entry', ok ? 'tw:border-success/40 tw:bg-success/10' : 'tw:border-warning/40 tw:bg-warning/10')}>
      <span>Opening balance of the account <b>{drCr(ledgerOpening)}</b></span>
      <span>Bills entered <b>{drCr(billsTotal)}</b></span>
      <b className={ok ? 'tw:text-success' : 'tw:text-warning'}>{ok ? 'Matches' : 'Difference ' + inr(Math.abs(difference)) + (difference < 0 ? ' Cr' : ' Dr')}</b>
    </div>
  );
}

function childColumns(kind, config, remove) {
  const valueOf = (row, key) => (key.endsWith('Date') ? fmtDate(row[key]) : key === 'amount' ? inr(row[key]) : row[key] || '');
  return [
    ...config.cols.map(([key, label]) => ({ label, right: key === 'amount', wrap: key === 'address', render: (row) => valueOf(row, key) })),
    ...(kind !== 'openings' ? [{ label: '', render: (row) => (Number(row.isDefault) ? <Badge variant="info">Default</Badge> : '') }] : []),
    { label: '', render: (row) => <Button variant="ghost" size="icon-sm" className="tw:text-destructive" aria-label="Delete" onClick={(event) => { event.stopPropagation(); remove(row); }}><Trash2 /></Button> },
  ];
}

// addresses / bank accounts / opening bills of one ledger
export default function LedgerChildList({ kind, ledger, onChanged }) {
  const childForm = useLedgerChildren({ kind, ledger, onChanged });
  const { config, rows, entry, setField, msg, paste, setPaste } = childForm;
  return (
    <div className="tw:flex tw:flex-col tw:gap-2.5">
      {kind === 'openings' && <OpeningBalanceCheck billsTotal={childForm.billsTotal} ledgerOpening={childForm.ledgerOpening} difference={childForm.difference} />}
      <Box title={(entry.id ? 'Change ' : 'Add ') + config.title.toLowerCase().replace(/s$/, '')} className="tw:bg-card">
        <div className={ENTRY_GRID}>
          {kind === 'addresses' && <AddressFields entry={entry} setField={setField} />}
          {kind === 'banks' && BANK_FIELDS.map((field) => <TextField key={field[0]} field={field} entry={entry} setField={setField} />)}
          {kind === 'openings' && <OpeningFields entry={entry} setField={setField} />}
          {kind !== 'openings' && <CheckField label="Default" checked={!!Number(entry.isDefault)} onCheckedChange={(value) => setField('isDefault', value ? 1 : 0)} />}
        </div>
      </Box>
      <ActionBar note={msg}>
        <Button variant="success" size="lg" onClick={childForm.save}>{entry.id ? <Pencil /> : <Plus />} {entry.id ? 'Update' : 'Add'}</Button>
        <Button size="lg" onClick={childForm.reset}><RotateCcw /> Clear</Button>
      </ActionBar>
      {kind === 'openings' && (
        <Box title="Paste bills from Excel" right={<span className="tw:text-[10.5px] tw:font-semibold tw:text-muted-foreground">Columns: Bill no, Bill date (dd/mm/yyyy), Amount, Dr/Cr, Due date, Job no</span>} className="tw:bg-card">
          <div className="tw:flex tw:flex-col tw:gap-2.5 tw:md:flex-row tw:md:items-end">
            <Textarea value={paste} onChange={(event) => setPaste(event.target.value)} rows={3} placeholder="Copy the rows in Excel and paste here" className="tw:flex-1 tw:font-mono" />
            <Button variant="default" size="lg" onClick={childForm.importPaste} disabled={!paste.trim()}><Download /> Import</Button>
          </div>
        </Box>
      )}
      <Grid title={config.title + ' (' + rows.length + ')'} maxHeight={300} rows={rows} rowKey={(row) => row.id} activeKey={entry.id} onRow={childForm.edit}
        empty={'No ' + config.title.toLowerCase() + ' yet'} cols={childColumns(kind, config, childForm.remove)} />
    </div>
  );
}
