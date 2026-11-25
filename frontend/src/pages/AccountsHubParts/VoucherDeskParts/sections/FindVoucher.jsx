import { Pencil, Printer, Search, Trash2, X } from 'lucide-react';
import { Button, DateInput, Field, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { Badge, Box, Btn, Grid, Money, fmtDate, statusTone } from '../../ui';
import { FIND_LIMIT, useFindVoucher } from '../hooks/useFindVoucher';
import { plural } from '../amounts';

const ACTIONS = {
  modify: { title: 'Choose the voucher to modify', verb: 'Modify', kind: 'save', Icon: Pencil },
  delete: { title: 'Choose the voucher to delete', verb: 'Delete', kind: 'danger', Icon: Trash2 },
  print: { title: 'Choose the voucher to print', verb: 'Print', kind: 'primary', Icon: Printer },
};

const firstAccounts = (voucher) => [...new Set(String(voucher.accounts || '').split('|').filter(Boolean).map((part) => part.split('~')[0]))].slice(0, 3).join(', ');

export function FindVoucher({ cfg, action, onClose, onModify }) {
  const { filters, setFilter, rows, message, busyId, run, pick } = useFindVoucher({ cfg, action, onModify });
  const { title, verb, kind, Icon } = ACTIONS[action];
  const runOnEnter = (event) => event.key === 'Enter' && run();
  const gridTitle = rows ? plural(rows.length, 'voucher') + (rows.length === FIND_LIMIT ? ' (first 200 - narrow the search)' : '') : 'Finding';

  return (
    <Box title={title} right={<Button variant="ghost" size="icon-sm" title="Close" onClick={onClose}><X /></Button>}>
      <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-2.5 tw:sm:grid-cols-3 tw:xl:grid-cols-[repeat(3,minmax(130px,1fr))_minmax(200px,2fr)_auto]">
        <Field label="Voucher No" layout="col"><Input data-allow-text autoFocus value={filters.vno} onChange={(event) => setFilter('vno')(event.target.value)} onKeyDown={runOnEnter} /></Field>
        <Field label="From" layout="col"><DateInput value={filters.from} onValueChange={setFilter('from')} /></Field>
        <Field label="To" layout="col"><DateInput value={filters.to} onValueChange={setFilter('to')} /></Field>
        <Field label="Account / ref / narration" layout="col" className="tw:sm:col-span-2 tw:xl:col-span-1">
          <Input data-allow-text value={filters.q} onChange={(event) => setFilter('q')(event.target.value)} onKeyDown={runOnEnter} />
        </Field>
        <Btn kind="primary" onClick={run}><Search size={13} /> Find</Btn>
      </div>
      {message && <div className={cn('tw:mt-2 tw:text-[11.5px] tw:font-bold', /^Not|Could/.test(message) ? 'tw:text-destructive' : 'tw:text-success')}>{message}</div>}
      <div className="tw:mt-2.5">
        <Grid title={gridTitle} maxHeight={280} rows={rows || []} rowKey={(voucher) => voucher.id} empty={rows ? 'No voucher for this search' : 'Finding'}
          cols={[
            { label: 'Voucher No.', render: (voucher) => <b className="tw:text-head">{voucher.voucherNumber}</b> },
            { label: 'Type', render: (voucher) => voucher.typeName },
            { label: 'Date', render: (voucher) => fmtDate(voucher.date) },
            { label: 'Accounts', wrap: true, render: firstAccounts },
            { label: 'Ref', render: (voucher) => voucher.refNo || '' },
            { label: 'Amount', right: true, render: (voucher) => <Money v={voucher.totalAmount} strong /> },
            { label: 'Status', render: (voucher) => <Badge tone={statusTone(voucher.status)}>{voucher.status || 'Pending'}</Badge> },
            { label: '', render: (voucher) => <Btn small kind={kind} disabled={!!busyId} onClick={() => pick(voucher)}><Icon size={11} /> {busyId === voucher.id ? '...' : verb}</Btn> },
          ]} />
      </div>
    </Box>
  );
}
