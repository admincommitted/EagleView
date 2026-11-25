import { useMemo, useRef, useState } from 'react';
import { Check, ClipboardPaste, RotateCcw } from 'lucide-react';
import { Button, DataTable, Input, Modal, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';

const numberOrNull = (value) => { const number = parseFloat(String(value ?? '').replace(/,/g, '')); return Number.isFinite(number) ? number : null; };
const showQty = (value) => (value === null || value === undefined ? '' : String(Math.round(value * 1e6) / 1e6));
const isWrong = (state) => state === 'over' || state === 'bad';

// a pasted line: "Item Sr No <tab> Quantity", or "Inv Sr No, Item Sr No, Quantity" on a job with several invoices
const PASTE_CELL_SEPARATOR = /[\t;]|,(?=\s*\d)|\s{2,}|\s+(?=\S+$)/;

// Quick Quantity Entry for an Ex-Bond BE: an ex-bond clears part of its warehouse BE, so the work is "type the
// quantity of each item". Every item is one row with its warehouse balance; the quantities are typed down the column
// (Enter / Down = next row) or pasted from Excel, and written in one go.
//   onApply(qtyById) - { [item.id]: quantity typed } for the rows that changed
export default function QuickQtyWindow({ items, onApply, onClose }) {
  const rows = useMemo(() => (items || []).map((item) => ({
    id: item.id,
    invoiceSr: String(item.invSrNo || '1'),
    itemSr: String(item.itemSrNo || item.itemNo || ''),
    description: item.desc || item.productDescription || item.genericDesc || '',
    unit: item.unit || item.uqc || '',
    savedQty: String(item.qty || item.quantity || ''),
    balance: numberOrNull(item._whBalanceQty),
  })), [items]);
  const [typed, setTyped] = useState({}); // id -> text in the box (only rows that were touched)
  const [pasteText, setPasteText] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [note, setNote] = useState('');
  const qtyBoxes = useRef({});
  const manyInvoices = new Set(rows.map((row) => row.invoiceSr)).size > 1;

  const qtyTextOf = (row) => (row.id in typed ? typed[row.id] : row.savedQty);
  const stateOf = (row) => {
    const text = qtyTextOf(row);
    const qty = numberOrNull(text);
    if (String(text).trim() === '' || qty === null || qty < 0) return 'bad';
    if (row.balance !== null && qty > row.balance + 1e-6) return 'over';
    return numberOrNull(row.savedQty) === qty ? 'same' : 'changed';
  };
  const counts = rows.reduce((count, row) => { count[stateOf(row)]++; return count; }, { same: 0, changed: 0, over: 0, bad: 0 });
  const hasWrongRows = counts.over > 0 || counts.bad > 0;
  const leftOf = (row) => { const qty = numberOrNull(qtyTextOf(row)); return row.balance === null || qty === null ? null : Math.round((row.balance - qty) * 1e6) / 1e6; };

  const focusRow = (index) => {
    const row = rows[index];
    const box = row && qtyBoxes.current[row.id];
    if (box) { box.focus(); box.select(); }
  };

  const fillFromPaste = () => {
    const next = { ...typed };
    let matched = 0;
    const unmatched = [];
    pasteText.split(/\r?\n/).forEach((line) => {
      const cells = line.split(PASTE_CELL_SEPARATOR).map((cell) => cell.trim()).filter((cell) => cell !== '');
      if (cells.length < 2) return;
      const qty = numberOrNull(cells[cells.length - 1]);
      const itemSr = String(parseInt(cells[cells.length - 2], 10));
      const invoiceSr = cells.length >= 3 ? String(parseInt(cells[cells.length - 3], 10)) : null;
      if (qty === null || itemSr === 'NaN') return; // a heading row
      const candidates = rows.filter((row) => String(parseInt(row.itemSr, 10)) === itemSr && (invoiceSr === null || row.invoiceSr === invoiceSr));
      if (candidates.length === 1) { next[candidates[0].id] = showQty(qty); matched++; } else unmatched.push(itemSr);
    });
    setTyped(next);
    setNote(matched || unmatched.length
      ? `${matched} quantity(ies) filled from the paste` + (unmatched.length ? ` - not matched to one item: Item Sr No ${unmatched.slice(0, 10).join(', ')}${unmatched.length > 10 ? ' ...' : ''}` : '')
      : 'Nothing read - paste two columns: Item Sr No and Quantity');
    if (matched) setPasteOpen(false);
  };

  const apply = () => {
    if (hasWrongRows) { focusRow(rows.findIndex((row) => isWrong(stateOf(row)))); return; }
    const changedQty = {};
    rows.forEach((row) => { if (stateOf(row) === 'changed') changedQty[row.id] = showQty(numberOrNull(qtyTextOf(row))); });
    onApply(changedQty);
  };

  const moveFocus = (event, index) => {
    if (event.key === 'Enter' || event.key === 'ArrowDown') { event.preventDefault(); focusRow(Math.min(rows.length - 1, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); focusRow(Math.max(0, index - 1)); }
  };

  const columns = [
    ...(manyInvoices ? [{ key: 'invoiceSr', header: 'Inv' }] : []),
    { key: 'itemSr', header: 'Item Sr', className: 'tw:font-bold' },
    { key: 'description', header: 'Description', className: 'tw:w-full tw:max-w-[320px] tw:truncate', cell: (row) => <span title={row.description}>{row.description}</span> },
    { key: 'unit', header: 'Unit' },
    { key: 'balance', header: 'WH Bal', align: 'right', title: 'Quantity still in the warehouse (WH BE quantity less what filed ex-bonds cleared)', cell: (row) => showQty(row.balance) },
    { key: 'savedQty', header: 'Saved Qty', align: 'right', className: 'tw:text-muted-foreground' },
    {
      key: 'qty', header: 'Quantity', align: 'right', className: 'tw:px-1.5 tw:py-0.5',
      cell: (row, index) => {
        const state = stateOf(row);
        return (
          <Input
            ref={(element) => { qtyBoxes.current[row.id] = element; }}
            data-qq-sr={row.itemSr}
            inputMode="decimal"
            autoFocus={index === 0}
            value={qtyTextOf(row)}
            onFocus={(event) => event.target.select()}
            onChange={(event) => setTyped((previous) => ({ ...previous, [row.id]: event.target.value }))}
            onKeyDown={(event) => moveFocus(event, index)}
            className={cn('tw:w-24 tw:text-right tw:font-bold', isWrong(state) && 'tw:border-destructive tw:text-destructive', state === 'changed' && 'tw:border-success')}
          />
        );
      },
    },
    {
      key: 'left', header: 'Left', align: 'right', title: 'WH balance less the quantity typed',
      cell: (row) => {
        const left = leftOf(row);
        return <span className={cn('tw:font-bold', left !== null && left < 0 && 'tw:text-destructive')}>{stateOf(row) === 'over' ? 'over by ' + showQty(-left) : showQty(left)}</span>;
      },
    },
  ];

  const rowTone = (row) => {
    const state = stateOf(row);
    if (isWrong(state)) return 'tw:bg-destructive/10 tw:even:bg-destructive/10';
    return state === 'changed' ? 'tw:bg-success/10 tw:even:bg-success/10' : undefined;
  };
  const nothingToWrite = !counts.changed && !hasWrongRows;

  return (
    <Modal
      open
      onClose={onClose}
      title="Quick Quantity Entry"
      description={`${rows.length} item(s) - type down the column (Enter = next row) or paste from Excel`}
      width={880}
      closeOnOutside={false}
      bodyClassName="tw:flex tw:flex-col tw:gap-2"
      footer={(
        <div className="tw:flex tw:w-full tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-center">
          <span className="tw:text-[11px] tw:text-muted-foreground">Value and the duty estimate of each changed item follow its quantity. The job is saved when you press the button.</span>
          <div className="tw:flex tw:gap-2 tw:sm:ml-auto">
            <Button onClick={onClose}>Close</Button>
            <Button variant={hasWrongRows ? 'destructive' : 'default'} onClick={apply} disabled={nothingToWrite}>
              <Check /> {hasWrongRows ? 'Show the first wrong row' : `Write ${counts.changed} quantity(ies) and save`}
            </Button>
          </div>
        </div>
      )}
    >
      <div data-quick-qty className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-sm tw:bg-page tw:p-2">
        <Button onClick={() => setPasteOpen((open) => !open)}><ClipboardPaste /> Paste from Excel</Button>
        <Button onClick={() => { setTyped({}); setNote(''); }} title="Every box back to the quantity saved on the job"><RotateCcw /> Undo typing</Button>
        <span className="tw:font-bold tw:text-success">{counts.changed} changed</span>
        {counts.over > 0 && <span className="tw:font-bold tw:text-destructive">{counts.over} over the warehouse balance</span>}
        {counts.bad > 0 && <span className="tw:font-bold tw:text-destructive">{counts.bad} not a quantity</span>}
        {note && <span className="tw:text-[11px] tw:text-muted-foreground">{note}</span>}
      </div>
      {pasteOpen && (
        <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-start">
          <Textarea
            autoFocus
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder={manyInvoices ? 'Copy three columns in Excel and paste here:\nInv Sr No   Item Sr No   Quantity' : 'Copy two columns in Excel and paste here:\nItem Sr No   Quantity'}
            className="tw:h-[92px] tw:flex-1 tw:font-mono"
          />
          <Button variant="default" onClick={fillFromPaste}>Fill the boxes</Button>
        </div>
      )}
      <DataTable columns={columns} rows={rows} rowClassName={rowTone} containerClassName="tw:max-h-[55vh]" />
    </Modal>
  );
}
