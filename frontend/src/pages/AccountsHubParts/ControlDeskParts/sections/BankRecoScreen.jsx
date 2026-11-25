import { Check, Download, RefreshCw, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Checkbox, DateInput, Field, Input, SelectBox } from '@/components/ui';
import { ActionBar, Box, Empty, Grid, Money, Sheet, fmtDate, inr } from '../../ui';
import { ExcelButtons, sampleExcel } from '../../extras';
import useBankReco, { STATEMENT_COLUMNS } from '../hooks/useBankReco';
import Tiles from './Tiles';

const SHOW_OPTIONS = [{ value: 'open', label: 'Not cleared' }, { value: 'done', label: 'Cleared' }, { value: 'all', label: 'All lines' }];
const SHOW_TITLE = { open: 'Not cleared', done: 'Cleared', all: 'All lines' };
const STATEMENT_SAMPLE = [['05/10/2026', 'CHQ PAID 000124 XYZ AIRLINES', '000124', 1500, '', 48500], ['08/10/2026', 'NEFT CR ABC EXPORTS', 'UTR123', '', 5000, 53500]];
const drCr = (value) => inr(Math.abs(value)) + (value < 0 ? ' Cr' : ' Dr');

const ColField = ({ label, required, children }) => <Field label={label} required={required} layout="col">{children}</Field>;

function ClearedOnCell({ row, reco }) {
  const date = reco.clearedOn(row);
  const edited = reco.isEdited(row);
  return (
    <span className="tw:inline-flex tw:items-center tw:gap-1">
      <DateInput value={date} minDate={row.date} onValueChange={(value) => reco.setClearedOn(row, value)} wrapperClassName="tw:w-[130px]" className={cn(edited && 'tw:border-warning tw:bg-warning/10')} />
      {date && <Button variant="ghost" size="icon-sm" className="tw:text-destructive" title="Not cleared" aria-label="Not cleared" onClick={() => reco.setClearedOn(row, '')}><X className="tw:size-3" /></Button>}
    </span>
  );
}

function lineColumns(reco) {
  const { shown, ticked, toggleRow, toggleShown } = reco;
  const allTicked = shown.length > 0 && shown.every((row) => ticked[row.id]);
  return [
    { label: <Checkbox aria-label="Tick all" checked={allTicked} onCheckedChange={(value) => toggleShown(value === true)} />, w: 28, render: (row) => <Checkbox aria-label="Tick" checked={!!ticked[row.id]} onCheckedChange={(value) => toggleRow(row.id, value === true)} /> },
    { label: 'Date', render: (row) => <span>{fmtDate(row.date)}{row.older && <div className="tw:text-[9.5px] tw:font-extrabold tw:text-warning">EARLIER</div>}</span> },
    { label: 'Voucher', render: (row) => <span><b>{row.voucherNumber}</b><div className="tw:text-[10px] tw:text-muted-foreground">{row.typeName}</div></span> },
    { label: 'Party / narration', wrap: true, render: (row) => <span><b>{row.party}</b><div className="tw:text-[10px] tw:text-muted-foreground">{row.narration}</div></span> },
    { label: 'Chq / Ref', render: (row) => row.refNo },
    { label: 'Deposit', right: true, render: (row) => (row.dc === 'Dr' ? <Money v={row.amount} side="Dr" /> : '') },
    { label: 'Withdrawal', right: true, render: (row) => (row.dc === 'Cr' ? <Money v={row.amount} side="Cr" /> : '') },
    { label: 'Cleared on', w: 170, render: (row) => <ClearedOnCell row={row} reco={reco} /> },
  ];
}

const statementColumns = [
  { label: 'Date', render: (line) => fmtDate(line.date) }, { label: 'Description', wrap: true, render: (line) => line.desc }, { label: 'Ref', render: (line) => line.ref },
  { label: 'Withdrawal', right: true, render: (line) => (line.dc === 'Cr' ? inr(line.amount) : '') }, { label: 'Deposit', right: true, render: (line) => (line.dc === 'Dr' ? inr(line.amount) : '') },
];

function RecoStatement({ data, live, difference }) {
  const steps = [['Balance as per books', data.closing], ['Add: cheques issued, not presented', live.notPresented], ['Less: deposits not yet credited', -live.notCredited]];
  const matches = difference !== null && Math.abs(difference) < 0.01;
  return (
    <Box title="Reconciliation statement" pad={0}>
      <div className="tw:px-3 tw:py-1.5 tw:text-entry">
        {steps.map(([label, value]) => <div key={label} className="tw:flex tw:justify-between tw:py-0.5"><span className="tw:text-foreground">{label}</span><Money v={value} /></div>)}
      </div>
      <div className="tw:flex tw:justify-between tw:border-t tw:border-primary/30 tw:bg-primary/10 tw:px-3 tw:py-2"><b className="tw:text-head">Balance as per bank</b><Money v={live.bank} strong /></div>
      {difference !== null && (
        <div className={cn('tw:px-3 tw:py-1.5 tw:text-entry tw:font-extrabold', matches ? 'tw:text-success' : 'tw:text-destructive')}>
          {matches ? 'Matches the statement' : 'Statement differs by ' + inr(Math.abs(difference)) + (difference > 0 ? ' (bank shows more)' : ' (bank shows less)')}
        </div>
      )}
    </Box>
  );
}

// books vs bank: cheques not presented, deposits not credited, the balance the bank should show
export function BankRecoScreen() {
  const reco = useBankReco();
  const { banks, filter, setFilter, setFilterField, data, msg, rows, shown, live, dirty, statementOnly, saving, difference } = reco;
  const openCount = (dc) => rows.filter((row) => row.dc === dc && reco.isOpen(row)).length;
  return (
    <Sheet tabs={[{ id: 'b', label: 'Bank Reconciliation' }]} tab="b" onTab={() => {}}>
      <Box>
        <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-2.5 tw:sm:grid-cols-2 tw:lg:grid-cols-[minmax(220px,2fr)_repeat(3,minmax(130px,1fr))_auto]">
          <ColField label="Bank / Cash Book" required>
            <SelectBox value={filter.ledgerId} onValueChange={(value) => setFilter((old) => ({ ...old, ledgerId: value, stmt: '' }))} options={banks.map((bank) => ({ value: bank.id, label: bank.name }))}
              placeholder={banks.length ? 'Select' : 'No bank ledger yet'} />
          </ColField>
          <ColField label="From"><DateInput value={filter.from} onValueChange={(value) => setFilterField('from', value)} /></ColField>
          <ColField label="To (statement date)"><DateInput value={filter.to} onValueChange={(value) => setFilterField('to', value)} /></ColField>
          <ColField label="Balance as per statement">
            <Input className="tw:text-right" inputMode="decimal" value={filter.stmt} onChange={(event) => setFilterField('stmt', event.target.value)} placeholder="Closing on the bank statement" />
          </ColField>
          <Button variant="default" size="lg" onClick={reco.load}><RefreshCw /> Load</Button>
        </div>
      </Box>
      {!banks.length && <Empty title="No bank account yet">Create the bank ledgers under Bank Accounts (Masters, Ledger Account), then reconcile here.</Empty>}
      {data && (
        <>
          <div className="tw:grid tw:grid-cols-1 tw:items-start tw:gap-2.5 tw:lg:grid-cols-[minmax(0,1fr)_360px]">
            <Tiles items={[
              { key: 'a', label: 'Opening (books)', value: drCr(data.opening) },
              { key: 'b', label: 'Balance as per books', value: drCr(data.closing), sub: 'on ' + fmtDate(filter.to) },
              { key: 'c', label: 'Not presented', value: inr(live.notPresented), tone: 'tw:text-warning', sub: openCount('Cr') + ' payments' },
              { key: 'd', label: 'Not yet credited', value: inr(live.notCredited), tone: 'tw:text-warning', sub: openCount('Dr') + ' deposits' },
            ]} />
            <RecoStatement data={data} live={live} difference={difference} />
          </div>
          <ActionBar note={msg}>
            <SelectBox className="tw:w-[150px]" value={filter.show} onValueChange={(value) => setFilterField('show', value)} options={SHOW_OPTIONS} />
            <span className="tw:text-[11px] tw:text-muted-foreground">Clear ticked on</span>
            <DateInput value={reco.bulkDate} onValueChange={reco.setBulkDate} wrapperClassName="tw:w-[140px]" />
            <Button variant="secondary" size="lg" onClick={reco.clearTicked}><Check /> Clear ticked</Button>
            <ExcelButtons label="Read bank statement" onFile={reco.readStatement} onSample={() => sampleExcel('bank_statement_sample', STATEMENT_COLUMNS, STATEMENT_SAMPLE)} />
            <Button variant="success" size="lg" onClick={reco.save} disabled={saving}><Save /> {saving ? 'Saving' : 'Save' + (dirty.length ? ' (' + dirty.length + ')' : '')}</Button>
            <Button variant="secondary" size="lg" onClick={reco.exportLines}><Download /> Excel</Button>
          </ActionBar>
          <Grid title={SHOW_TITLE[filter.show] + ' (' + shown.length + ')'} maxHeight="calc(100vh - 470px)" rows={shown} rowKey={(row) => row.id}
            empty={rows.length ? 'Nothing here - change the filter' : 'No entries in this bank for the period'} cols={lineColumns(reco)} />
          {statementOnly && statementOnly.length > 0 && (
            <Grid title={'In the bank statement but not in the books (' + statementOnly.length + ') - bank charges, interest, direct credits: book them, then read the statement again'} maxHeight={220} rows={statementOnly}
              right={<Button variant="ghost" onClick={reco.exportStatementOnly}><Download /> Excel</Button>} cols={statementColumns} />
          )}
        </>
      )}
    </Sheet>
  );
}
