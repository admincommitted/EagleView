// Voucher details in a side panel (iCAFFE's "Voucher Details" without leaving the report), opened from the Ledger, the
// registers / Day Book report, the Daybook page and Outstanding. Up / Down arrows (or the < > buttons) move through the
// rows of the report; Esc closes.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Printer, FileText, ExternalLink, Layers } from 'lucide-react';
import axiosInstance, { errorMessage } from '@/services/axiosInstance';
import {
  Button, Checkbox, Label, Sheet, SheetContent,
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui';
import { accountsApi } from './accountsApi';
import { inr, fmtDate, Badge, statusTone } from './ui';
import { printVoucher } from './printVoucher';
import { deskOf } from './CommandSearch';
import { openInvoicePdf } from './GstInvoiceDesk';

const BRANCH = { DEL: 'NEW DELHI', MUM: 'MUMBAI', JPR: 'JAIPUR', LDH: 'LUDHIANA' };
const DIVISION = { AI: 'Import Air', AE: 'Export Air', SI: 'Import Sea', SE: 'Export Sea' };
const MERGE_SETTING = 'vdMerge';
const CACHE_LIMIT = 300;

// voucher id -> details for this browser session; any save to the accounts endpoints clears it
const voucherCache = new Map();
const CHANGES_VOUCHERS = /^\/?(api\/)?(accounts-hub|vouchers|accounts-gst)/;
axiosInstance.interceptors.request.use((config) => {
  if (String(config.method || 'get').toLowerCase() !== 'get' && CHANGES_VOUCHERS.test(config.url || '')) voucherCache.clear();
  return config;
});

const loadVoucher = async (id) => {
  if (voucherCache.has(id)) return voucherCache.get(id);
  const voucher = await accountsApi.hubVoucher(id);
  voucherCache.set(id, voucher);
  if (voucherCache.size > CACHE_LIMIT) voucherCache.delete(voucherCache.keys().next().value);
  return voucher;
};

const readMergeSetting = () => {
  try {
    return localStorage.getItem(MERGE_SETTING) === '1';
  } catch {
    return false;
  }
};
const saveMergeSetting = (merge) => {
  try {
    localStorage.setItem(MERGE_SETTING, merge ? '1' : '0');
  } catch {
    // private mode: the choice is just not remembered
  }
};

const isTyping = (target) => /INPUT|SELECT|TEXTAREA/.test(target?.tagName || '');

function voucherLines(voucher, merge) {
  if (!voucher) return [];
  const lines = (voucher.lines || []).map((line) => ({
    name: line.ledgerName,
    group: line.groupName,
    dr: line.dc === 'Dr' ? Number(line.amount) || 0 : 0,
    cr: line.dc === 'Cr' ? Number(line.amount) || 0 : 0,
    remarks: line.remarks,
    fcy: line.currency && line.currency !== 'INR' && line.amountFcy ? line.currency + ' ' + inr(line.amountFcy) + (line.roe ? ' @ ' + line.roe : '') : '',
    count: 1,
  }));
  // iCAFFE order: account name A-Z within the voucher
  lines.sort((first, second) => String(first.name).localeCompare(String(second.name)) || (second.dr - first.dr));
  if (!merge) return lines;
  const merged = new Map();
  for (const line of lines) {
    const key = line.name + '|' + (line.dr ? 'Dr' : 'Cr');
    const existing = merged.get(key);
    if (existing) { existing.dr += line.dr; existing.cr += line.cr; existing.count++; } else merged.set(key, { ...line, remarks: '' });
  }
  return [...merged.values()];
}

function voucherInfo(voucher) {
  const purchase = voucher.purchase;
  return [
    ['Branch', BRANCH[voucher.branchCode] || voucher.branchCode || 'NEW DELHI'],
    ['Division', DIVISION[voucher.division] || voucher.division],
    ['Voucher No', voucher.voucherNumber],
    ['Date', fmtDate(voucher.date)],
    ['Docket No', voucher.jobNo],
    ['Ref / Cheque', voucher.refNo],
    purchase && (purchase.billNo || purchase.billDate) ? ['Party bill', [purchase.billNo, purchase.billDate && fmtDate(purchase.billDate)].filter(Boolean).join(' dt. ')] : null,
    voucher.gst ? ['GST invoice', voucher.gst.invoiceNo + (voucher.gst.irn ? '  (IRN)' : '')] : null,
  ].filter((entry) => entry && entry[1]);
}

function InfoItem({ label, children }) {
  return (
    <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-2">
      <span className="tw:w-[86px] tw:shrink-0 tw:text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function SetOffList({ title, rows }) {
  if (!rows.length) return null;
  return (
    <div className="tw:text-entry">
      <div className="tw:mb-1 tw:font-extrabold tw:text-head">{title}</div>
      {rows.map((row) => (
        <div key={row.key} className="tw:flex tw:justify-between tw:border-t tw:border-border tw:py-0.5">
          <span>{row.label}</span><b className="tw:tabular-nums">{inr(row.amount)}</b>
        </div>
      ))}
    </div>
  );
}

// ids: the voucher ids of the rows on the screen, in order (for Up / Down); id: the one to show
export default function VoucherDrawer({ id, ids, onMove, onClose }) {
  const navigate = useNavigate();
  const [voucher, setVoucher] = useState(null);
  const [error, setError] = useState('');
  const [merge, setMerge] = useState(readMergeSetting);
  const rowIds = useMemo(() => [...new Set((ids || []).filter(Boolean).map(Number))], [ids]);
  const position = rowIds.indexOf(Number(id));
  const move = (step) => { const next = rowIds[position + step]; if (next && onMove) onMove(next); };

  useEffect(() => {
    let live = true;
    setError('');
    setVoucher(null);
    const load = async () => {
      try {
        const loaded = await loadVoucher(Number(id));
        if (live) setVoucher(loaded);
      } catch (loadError) {
        if (live) setError(errorMessage(loadError));
      }
    };
    if (id) load();
    return () => { live = false; };
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isTyping(event.target)) return;
      if (event.key === 'ArrowDown') { event.preventDefault(); move(1); } else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const changeMerge = (checked) => { setMerge(checked); saveMergeSetting(checked); };
  const lines = useMemo(() => voucherLines(voucher, merge), [voucher, merge]);
  const debit = lines.reduce((sum, line) => sum + line.dr, 0);
  const credit = lines.reduce((sum, line) => sum + line.cr, 0);
  const narration = voucher ? String(voucher.narration || '').trim() : '';
  // a line remark is shown only when it adds something (iCAFFE repeats the narration on every line)
  const extraRemark = (remarks) => {
    const text = String(remarks || '').replace(/\s+/g, ' ').trim();
    return text && !narration.replace(/\s+/g, ' ').includes(text) ? text : '';
  };

  const openFullScreen = () => {
    if (!voucher) return;
    onClose();
    if (voucher.gst && voucher.gst.kind) navigate('/accounts-hub?item=gst' + voucher.gst.kind + '&voucher=' + voucher.id);
    else navigate('/accounts-hub?item=' + deskOf(voucher.baseType || 'Journal') + '&voucher=' + voucher.id);
  };
  // the invoice already saved for this voucher: as a PDF, or the same page as Print when no PDF can be made here
  const openInvoice = async () => {
    setError('');
    try {
      await openInvoicePdf(voucher.id, false);
    } catch (invoiceError) {
      setError('Invoice: ' + String(invoiceError.message || invoiceError).split('\n')[0].slice(0, 200));
    }
  };
  const print = () => { if (!printVoucher(voucher)) setError('Allow pop-ups for this site to print'); };

  const allocations = (voucher?.allocations || []).map((bill, index) => ({
    key: index,
    label: (bill.againstNo || bill.refNo || bill.refType) + (bill.againstDate ? ' dt. ' + fmtDate(bill.againstDate) : ''),
    amount: bill.amount,
  }));
  const creditNotes = (voucher?.creditNotes || []).map((note) => ({ key: note.id, label: `${note.voucherNumber} dt. ${fmtDate(note.date)}`, amount: note.totalAmount }));

  return (
    <Sheet open onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent
        side="right"
        aria-label="Voucher details"
        description="Voucher details"
        className="tw:w-[min(600px,100vw)]"
        title={(
          <span className="tw:flex tw:min-w-0 tw:flex-col">
            <span className="tw:text-[11px] tw:font-normal tw:text-muted-foreground">Voucher Details{voucher ? ' - ' + (voucher.icaffeType || voucher.typeName || '') : ''}</span>
            <span className="tw:truncate tw:text-[17px] tw:font-extrabold">{voucher ? voucher.voucherNumber : 'Loading...'}</span>
          </span>
        )}
      >
        <div className="tw:flex tw:h-full tw:flex-col">
          <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-3 tw:overflow-auto tw:p-3.5">
            {rowIds.length > 1 && (
              <div className="tw:flex tw:items-center tw:justify-end tw:gap-2 tw:text-[11px]">
                <Button size="icon" title="Previous row (Up arrow)" onClick={() => move(-1)} disabled={position <= 0}><ChevronLeft /></Button>
                <span className="tw:whitespace-nowrap">{position + 1} of {rowIds.length}</span>
                <Button size="icon" title="Next row (Down arrow)" onClick={() => move(1)} disabled={position < 0 || position >= rowIds.length - 1}><ChevronRight /></Button>
              </div>
            )}
            {error && <div className="tw:text-entry tw:font-bold tw:text-destructive">{error}</div>}
            {!voucher && !error && <div className="tw:p-5 tw:text-center tw:text-entry tw:text-muted-foreground">Loading voucher...</div>}
            {voucher && (
              <>
                <div className="tw:grid tw:grid-cols-1 tw:gap-x-4.5 tw:gap-y-1.5 tw:text-entry tw:sm:grid-cols-2">
                  {voucherInfo(voucher).map(([label, value]) => (
                    <InfoItem key={label} label={label}><b className="tw:wrap-anywhere tw:text-foreground">{value}</b></InfoItem>
                  ))}
                  <InfoItem label="Status">
                    <Badge tone={statusTone(voucher.status || '')}>{voucher.status || '-'}</Badge>
                    {voucher.createdByName && <span className="tw:text-[11px] tw:text-muted-foreground">by {voucher.createdByName}</span>}
                  </InfoItem>
                </div>

                <Table className="tw:text-entry" containerClassName="tw:rounded-md tw:border tw:border-border">
                  <TableHeader>
                    <TableRow className="tw:hover:bg-transparent">
                      <TableHead>Particulars</TableHead>
                      <TableHead className="tw:text-right">Debit</TableHead>
                      <TableHead className="tw:text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, index) => {
                      const remark = extraRemark(line.remarks);
                      return (
                        <TableRow key={index}>
                          <TableCell className="tw:whitespace-normal">
                            <div className="tw:font-semibold">{line.name}{line.count > 1 && <span className="tw:font-medium tw:text-muted-foreground"> ({line.count} lines)</span>}</div>
                            {(line.group || remark || line.fcy) && <div className="tw:text-[10.5px] tw:text-muted-foreground">{[line.group, line.fcy, remark].filter(Boolean).join(' | ')}</div>}
                          </TableCell>
                          <TableCell className="tw:text-right tw:tabular-nums tw:text-destructive">{line.dr ? inr(line.dr) : ''}</TableCell>
                          <TableCell className="tw:text-right tw:tabular-nums tw:text-success">{line.cr ? inr(line.cr) : ''}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="tw:bg-accent tw:font-extrabold tw:hover:bg-accent">
                      <TableCell className="tw:text-right">Total</TableCell>
                      <TableCell className="tw:text-right tw:tabular-nums">{inr(debit)}</TableCell>
                      <TableCell className="tw:text-right tw:tabular-nums">{inr(credit)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>

                <div className="tw:flex tw:items-center tw:gap-3 tw:text-[11.5px]">
                  <Label className="tw:cursor-pointer">
                    <Checkbox checked={merge} onCheckedChange={(checked) => changeMerge(checked === true)} /> <Layers className="tw:size-3" /> Same account on one line
                  </Label>
                  {Math.abs(debit - credit) > 0.009 && <span className="tw:font-bold tw:text-destructive">Dr and Cr differ by {inr(Math.abs(debit - credit))}</span>}
                </div>

                {narration && (
                  <div className="tw:rounded-md tw:border tw:border-primary/30 tw:bg-primary/10 tw:px-2.5 tw:py-2 tw:text-entry tw:whitespace-pre-wrap tw:wrap-anywhere">
                    <div className="tw:mb-0.5 tw:text-[10.5px] tw:font-extrabold tw:text-head">Narration</div>{narration}
                  </div>
                )}
                <SetOffList title="Bills set off" rows={allocations} />
                <SetOffList title="Credit notes against this bill" rows={creditNotes} />
              </>
            )}
          </div>
          <div className="tw:flex tw:flex-wrap tw:gap-2 tw:border-t tw:border-border tw:bg-page tw:px-3.5 tw:py-2.5">
            <Button variant="default" size="lg" disabled={!voucher} onClick={print}><Printer /> Print</Button>
            {voucher?.gst && <Button size="lg" onClick={openInvoice}><FileText /> Invoice</Button>}
            <Button size="lg" disabled={!voucher} onClick={openFullScreen}><ExternalLink /> Open voucher</Button>
            <span className="tw:flex-1" />
            <Button variant="secondary" size="lg" onClick={onClose}>Close</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
