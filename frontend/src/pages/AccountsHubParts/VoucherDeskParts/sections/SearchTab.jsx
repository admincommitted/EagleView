import { Copy, FileText, Printer, RotateCcw, Search } from 'lucide-react';
import { Button, DateInput, Field, Input, NumberInput, SelectBox } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ActionBar, Badge, Box, Btn, Grid, LedgerPicker, Money, fmtDate, statusTone } from '../../ui';
import { useVoucherSearch } from '../hooks/useVoucherSearch';
import { accountsOf } from '../voucherConfig';

const STATUSES = ['Approved', 'Pending', 'Returned', 'Rejected'];
const SEARCH_LIMIT = 500;

const AccountColumn = ({ voucher, side }) => accountsOf(voucher).map((account, index) => (
  <div key={index}>{account.dc === side ? <Money v={account.amount} side={side} /> : ' '}</div>
));

export function SearchTab({ cfg, onOpen, activeId, onCopy }) {
  const search = useVoucherSearch({ cfg, onCopy });
  const { filters, setFilter, rows, busy } = search;
  const runOnEnter = (event) => event.key === 'Enter' && search.run();
  const textFilter = (key, label, extra) => (
    <Field label={label} layout="col" className={extra?.className}>
      <Input data-allow-text value={filters[key]} onChange={(event) => setFilter(key)(event.target.value)} onKeyDown={runOnEnter} placeholder={extra?.placeholder} />
    </Field>
  );
  const capped = rows.length >= SEARCH_LIMIT;

  return (
    <>
      <Box>
        <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(165px,1fr))] tw:items-end tw:gap-2.5">
          <Field label="Financial Year" layout="col">
            <SelectBox placeholder="Custom dates" value={search.pickedYear?.id ?? ''} onValueChange={search.pickYear}
              options={search.years.map((year) => ({ value: year.id, label: year.name || year.code }))} />
          </Field>
          <Field label="From" layout="col"><DateInput value={filters.from} onValueChange={setFilter('from')} /></Field>
          <Field label="To" layout="col"><DateInput value={filters.to} onValueChange={setFilter('to')} /></Field>
          <Field label="Account Name" layout="col" className="tw:sm:col-span-2">
            <LedgerPicker id="srchacc" list={search.ledgers} value={filters.ledgerId} onChange={setFilter('ledgerId')} placeholder="Any account" />
          </Field>
          {textFilter('vno', 'Voucher No')}
          <Field label="Status" layout="col">
            <SelectBox options={STATUSES} value={filters.status} onValueChange={setFilter('status')} placeholder="All" clearable clearLabel="All" />
          </Field>
          {search.moreFilters && (
            <>
              {textFilter('refNo', 'Chq / Ref / Bill No')}
              {textFilter('jobNo', 'Job / Docket No')}
              {textFilter('branch', 'Branch')}
              <Field label="Amount" layout="col">
                <NumberInput align="right" value={filters.amount} onValueChange={setFilter('amount')} onKeyDown={runOnEnter} />
              </Field>
              {textFilter('narration', 'Narration', { className: 'tw:sm:col-span-2' })}
              {textFilter('q', 'Any text', { className: 'tw:sm:col-span-2', placeholder: 'Account, voucher, ref, job or narration' })}
            </>
          )}
        </div>
      </Box>
      <ActionBar note={search.message}>
        <Btn kind="primary" onClick={() => search.run()} disabled={busy}><Search size={13} /> {busy ? 'Searching' : 'Search'}</Btn>
        <Btn kind="clear" onClick={search.clear}><RotateCcw size={13} /> Clear</Btn>
        <Btn kind="plain" onClick={() => search.setMoreFilters((shown) => !shown)}>{search.moreFilters ? 'Fewer filters' : 'More filters'}</Btn>
        <Btn kind="plain" onClick={search.exportCsv} disabled={!rows.length}><FileText size={13} /> Excel</Btn>
        <span className={cn('tw:ml-auto tw:text-[11.5px] tw:font-bold', capped ? 'tw:text-warning' : 'tw:text-foreground/80')}>
          {capped ? 'First 500 vouchers - narrow the dates or filters to see the rest' : rows.length + ' vouchers'}, total <Money v={search.total} strong />
        </span>
      </ActionBar>
      <Grid title="Voucher Details" maxHeight="calc(100vh - 380px)" onRow={(voucher) => onOpen(voucher.id)} rowKey={(voucher) => voucher.id} activeKey={activeId}
        empty={busy ? 'Searching' : 'No vouchers for these filters'} rows={rows}
        cols={[
          { label: 'Type', render: (voucher) => voucher.typeName },
          { label: 'Voucher No.', render: (voucher) => <b className="tw:text-head">{voucher.voucherNumber}</b> },
          { label: 'Voucher Date', render: (voucher) => fmtDate(voucher.date) },
          { label: 'Status', render: (voucher) => <Badge tone={statusTone(voucher.status)}>{voucher.status || 'Pending'}</Badge> },
          { label: 'Account Name', wrap: true, render: (voucher) => accountsOf(voucher).map((account, index) => <div key={index}>{account.name}</div>) },
          { label: 'Debit', right: true, render: (voucher) => <AccountColumn voucher={voucher} side="Dr" /> },
          { label: 'Credit', right: true, render: (voucher) => <AccountColumn voucher={voucher} side="Cr" /> },
          { label: 'Ref / Chq No', render: (voucher) => voucher.refNo || '' },
          { label: 'Job No', render: (voucher) => voucher.jobNo || '' },
          { label: 'Narration', wrap: true, render: (voucher) => <span className="tw:text-muted-foreground">{voucher.narration || ''}</span> },
          { label: '', render: (voucher) => (
            <span className="tw:inline-flex tw:gap-0.5" onClick={(event) => event.stopPropagation()}>
              <Button variant="ghost" size="icon-sm" title="Copy as new" onClick={() => search.copy(voucher.id)}><Copy /></Button>
              <Button variant="ghost" size="icon-sm" title="Print" onClick={() => search.print(voucher.id)}><Printer /></Button>
            </span>
          ) },
        ]} />
    </>
  );
}
