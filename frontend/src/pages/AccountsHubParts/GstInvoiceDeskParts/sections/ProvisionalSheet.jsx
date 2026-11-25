import { useState } from 'react';
import { ClipboardList, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Checkbox, Field, Input, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui';
import { Box, Sheet, fmtDate, inr } from '../../ui';
import { num } from '../gstMath';
import useProvisionalSheet from '../hooks/useProvisionalSheet';

const EDIT_COLUMNS = [
  { key: 'sac', width: 'tw:w-[70px]' },
  { key: 'gstRate', width: 'tw:w-[46px]', right: true },
  { key: 'currency', width: 'tw:w-[46px]', upper: true },
  { key: 'exRate', width: 'tw:w-[58px]', right: true },
  { key: 'qty', width: 'tw:w-[56px]', right: true },
  { key: 'buyRate', width: 'tw:w-[80px]', right: true },
  { key: 'sellRate', width: 'tw:w-[80px]', right: true },
];
const HEADERS = ['', 'Charge', 'SAC', 'GST %', 'Cur', 'Ex.Rate', 'Qty', 'Buy Rate', 'Sell Rate', 'Buy (INR)', 'Sell (INR)', 'Cost booked', 'Billed', 'To bill', 'From', ''];
const isMoneyHeader = (index) => index >= 5 && index <= 13;

function SheetTitle({ jobNo, sheet }) {
  return (
    <span className="tw:inline-flex tw:items-center tw:gap-1.5">
      <ClipboardList className="tw:size-3" /> Provisional Sheet - {jobNo}
      {sheet && <Badge variant={sheet.source === 'saved' ? 'success' : 'warning'}>{sheet.source === 'saved' ? 'saved' + (sheet.savedBy ? ' by ' + sheet.savedBy : '') : 'proposed - not saved yet'}</Badge>}
    </span>
  );
}

function ContractLine({ sheet }) {
  return (
    <div className="tw:mb-1.5 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:text-[11px]">
      {sheet.contract
        ? <Badge variant="success">Contract {sheet.contract.contractNo} - valid to {fmtDate(sheet.contract.validTo)}</Badge>
        : <span className="tw:text-muted-foreground">No active contract for this customer on the docket date - charge rules and costs booked are proposed.</span>}
      {sheet.contract && sheet.source === 'saved' && <span className="tw:text-muted-foreground">The sheet was saved before - the contract rates show only on a new sheet.</span>}
      {(sheet.notes || []).map((note, index) => <span key={index}className="tw:font-semibold tw:text-warning">{note}</span>)}
    </div>
  );
}

function SheetRow({ row, index, provisional, canAdd }) {
  const { changeRow, removeRow, ticked, toggleRow } = provisional;
  const costOver = num(row.actualCost) > num(row.sellInr) && num(row.sellInr);
  return (
    <TableRow>
      <TableCell>{canAdd && <Checkbox checked={!!ticked[index]} onCheckedChange={(value) => toggleRow(index, value === true)} />}</TableCell>
      <TableCell><Input data-allow-text className="tw:min-w-[170px] tw:font-bold" value={row.charge} onChange={(event) => changeRow(index, 'charge', event.target.value.toUpperCase())} /></TableCell>
      {EDIT_COLUMNS.map((column) => (
        <TableCell key={column.key}>
          <Input className={cn(column.width, column.right && 'tw:text-right')} value={row[column.key] ?? ''} data-allow-text={column.upper ? '' : undefined}
            onChange={(event) => changeRow(index, column.key, column.upper ? event.target.value.toUpperCase() : event.target.value)} />
        </TableCell>
      ))}
      <TableCell className="tw:text-right">{inr(row.buyInr)}</TableCell>
      <TableCell className="tw:text-right tw:font-bold">{inr(row.sellInr)}</TableCell>
      <TableCell className={cn('tw:text-right', costOver && 'tw:text-destructive')}>{num(row.actualCost) ? inr(row.actualCost) : ''}</TableCell>
      <TableCell className="tw:text-right">{num(row.billed) ? inr(row.billed) : ''}</TableCell>
      <TableCell className={cn('tw:text-right tw:font-bold', row.toBill > 0.009 ? 'tw:text-head' : 'tw:text-muted-foreground')}>{inr(row.toBill)}</TableCell>
      <TableCell className="tw:text-[10px] tw:text-muted-foreground">
        {row.from}{row.note ? <span className="tw:text-warning"> - {row.note}</span> : null}{row.notGst && row.charge ? <span className="tw:font-bold tw:text-destructive"> - not in GST Charges</span> : null}
      </TableCell>
      <TableCell><Button variant="ghost" size="icon-sm" className="tw:text-destructive" aria-label="Remove" onClick={() => removeRow(index)}><Trash2 className="tw:size-3" /></Button></TableCell>
    </TableRow>
  );
}

// the cost sheet of a docket: what is billed and what is left; ticked lines go to the invoice
export function ProvisionalSheet({ jobNo, partyName, onAdd, onClose, embedded }) {
  const provisional = useProvisionalSheet({ jobNo, partyName, onAdd });
  const { sheet, rows, error, msg, totals } = provisional;
  const cost = Math.max(totals.buy, totals.cost);
  return (
    <Box title={<SheetTitle jobNo={jobNo} sheet={sheet} />} right={!embedded && <Button variant="ghost" onClick={onClose}><X /> Close</Button>}>
      {error && <div className="tw:mb-1.5 tw:font-bold tw:text-destructive">{error}</div>}
      {!sheet && !error && <div className="tw:text-muted-foreground">Loading the sheet</div>}
      {sheet && (
        <>
          {sheet.job && (
            <div className="tw:mb-1.5 tw:text-[11px] tw:text-muted-foreground">
              {sheet.job.dir} {sheet.job.mode || ''} job of {fmtDate(sheet.job.jobDate)}{sheet.job.party ? ' - ' + sheet.job.party : ''}{sheet.job.grossWeight ? ' - ' + sheet.job.grossWeight + ' kg' : ''}
            </div>
          )}
          <ContractLine sheet={sheet} />
          <Table containerClassName="tw:max-h-[340px]">
            <TableHeader sticky>
              <TableRow>{HEADERS.map((header, index) => <TableHead key={index} className={isMoneyHeader(index) ? 'tw:text-right' : ''}>{header}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => <SheetRow key={index} row={row} index={index} provisional={provisional} canAdd={!!onAdd} />)}
              {!rows.length && <TableRow><TableCell colSpan={HEADERS.length} className="tw:py-4 tw:text-center tw:text-muted-foreground">Nothing proposed for this docket - add the charges below</TableCell></TableRow>}
            </TableBody>
            <TableFooter>
              <TableRow className="tw:font-extrabold">
                <TableCell /><TableCell>Total</TableCell><TableCell colSpan={7} />
                {[totals.buy, totals.sell, totals.cost, totals.billed, totals.left].map((value, index) => <TableCell key={index} className="tw:text-right">{inr(value)}</TableCell>)}
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
          <div className="tw:mt-2 tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <Button variant="ghost" onClick={provisional.addRow}><Plus /> Add charge</Button>
            <Button variant="success" onClick={provisional.save}><Save /> Save sheet</Button>
            {onAdd && <Button variant="default" onClick={provisional.addTicked}><Plus /> Add ticked to invoice</Button>}
            <span className="tw:text-[11px] tw:text-muted-foreground">Expected margin {inr(totals.sell - cost)} - Sell {inr(totals.sell)} vs cost {inr(cost)}</span>
            {msg && <span className="tw:text-[11px] tw:font-bold tw:text-success">{msg}</span>}
          </div>
        </>
      )}
    </Box>
  );
}

// the Provisional Sheet on its own, from the menu
export function ProvisionalSheetScreen() {
  const [docketNo, setDocketNo] = useState('');
  const [openDocket, setOpenDocket] = useState('');
  const show = () => setOpenDocket(docketNo.trim());
  return (
    <Sheet tabs={[{ id: 'p', label: 'Provisional Sheet' }]} tab="p" onTab={() => {}} right={<span className="tw:text-[11px] tw:text-muted-foreground">What each docket should be billed - used by GST Invoice</span>}>
      <Box title="Docket">
        <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-end">
          <Field label="Docket No" layout="col" className="tw:w-full tw:md:w-[260px]">
            <Input data-allow-text value={docketNo} onChange={(event) => setDocketNo(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === 'Enter' && show()} placeholder="DOCKET NO." />
          </Field>
          <Button variant="default" size="lg" onClick={show} disabled={!docketNo.trim()}><Search /> Show</Button>
        </div>
      </Box>
      {openDocket && <ProvisionalSheet key={openDocket} jobNo={openDocket} embedded />}
    </Sheet>
  );
}
