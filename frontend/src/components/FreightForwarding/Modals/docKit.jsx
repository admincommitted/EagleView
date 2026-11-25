import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Download, FileText, Printer, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Input, Modal, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, Textarea } from '@/components/ui';
import { askConfirm } from '../../common/askConfirm';
import { freightApi } from '../freightApi';
import { EMPTY_DOC, failText } from './docFormat';
import { printSheet, safeFileName, saveSheetPdf, saveSheetWord, sheetClone } from './docPrint';

// given by PersistedDoc (awb/PersistedDoc.jsx): { docType, restore(root), capture() }
export const DocCtx = createContext(null);

const LINE_FIELD = 'tw:h-auto tw:rounded-none tw:border-0 tw:border-b tw:border-solid tw:border-black tw:bg-transparent tw:px-[3px] tw:py-[2px] tw:[font-family:Arial,sans-serif] tw:text-[11px] tw:text-black tw:focus-visible:border-black tw:focus-visible:ring-0';
const BOX_FIELD = 'tw:min-h-0 tw:resize-y tw:rounded-none tw:border tw:border-solid tw:border-[#cbd5e1] tw:bg-transparent tw:px-[3px] tw:py-[2px] tw:[font-family:Arial,sans-serif] tw:text-[11px] tw:text-black tw:focus-visible:ring-0';
export const BOX = 'tw:border tw:border-solid tw:border-black tw:px-[8px] tw:py-[6px] tw:align-top';
export const HEAD_CELL = 'tw:bg-[#eef2f7] tw:text-left tw:text-[10px]';

// the boxes are named and uncontrolled: PersistedDoc reads and refills them by their place and name
export function DocInput({ name, value, className }) {
  return <Input name={name} defaultValue={value == null ? '' : String(value)} className={cn(LINE_FIELD, className)} />;
}

export function DocTextarea({ name, value, lines = 3, className }) {
  return <Textarea name={name} defaultValue={value == null ? '' : String(value)} rows={lines} className={cn(BOX_FIELD, className)} />;
}

export function DocCheck({ name, checked, label, className }) {
  return (
    <label className={cn('tw:mr-[12px] tw:inline-flex tw:items-center tw:gap-[4px] tw:text-[11px]', className)}>
      <Input type="checkbox" name={name} defaultChecked={Boolean(checked)} className="tw:m-[3px] tw:size-[13px] tw:p-0" /> {label}
    </label>
  );
}

// the ui table parts without their screen-grid look (colours, row stripes, hover), for printed sheets
const PLAIN_ROW = 'tw:border-0 tw:bg-transparent tw:even:bg-transparent tw:hover:bg-transparent';

export function SheetTable({ className, children }) {
  return <Table containerClassName="tw:overflow-visible" className={cn('tw:text-black', className)}>{children}</Table>;
}

export function SheetHeader({ children }) {
  return <TableHeader className="tw:bg-transparent tw:text-black">{children}</TableHeader>;
}

export function SheetBody({ children }) {
  return <TableBody className="tw:bg-transparent">{children}</TableBody>;
}

export function SheetFooter({ className, children }) {
  return <TableFooter className={cn('tw:bg-transparent tw:font-normal', className)}>{children}</TableFooter>;
}

export function SheetRow({ className, children }) {
  return <TableRow className={cn(PLAIN_ROW, className)}>{children}</TableRow>;
}

export function SheetCell({ className, ...props }) {
  return <TableCell className={cn('tw:whitespace-normal', BOX, className)} {...props} />;
}

export function SheetHead({ className, ...props }) {
  return <TableHead className={cn('tw:h-auto tw:whitespace-normal tw:font-bold tw:text-black', BOX, HEAD_CELL, className)} {...props} />;
}

export function Caption({ children, className }) {
  return <span className={cn('tw:mb-[2px] tw:block tw:text-[9.5px] tw:font-bold tw:text-[#334155]', className)}>{children}</span>;
}

export function Letterhead({ company, small }) {
  const contacts = [company?.gstin && `GSTIN ${company.gstin}`, company?.phone && `Ph ${company.phone}`, company?.email].filter(Boolean);
  return (
    <div className="tw:mb-[10px] tw:border-0 tw:border-b-2 tw:border-solid tw:border-black tw:pb-[5px] tw:text-center">
      <div className={cn('tw:font-bold', small ? 'tw:text-[15px]' : 'tw:text-[18px]')}>{company?.name || ' '}</div>
      {company?.address && <div className="tw:text-[10px]">{company.address}</div>}
      {contacts.length > 0 && <div className="tw:text-[9.5px]">{contacts.join('   |   ')}</div>}
    </div>
  );
}

export function Sign({ left, right }) {
  return (
    <div className="tw:mt-[28px] tw:flex tw:justify-between tw:gap-[40px] tw:text-[10.5px]">
      {[left, right].filter(Boolean).map((text, index) => (
        <div key={index} className={cn('tw:flex-1', index ? 'tw:text-right' : 'tw:text-left')}>
          <div className="tw:h-[34px]" />
          <div className="tw:inline-block tw:min-w-[220px] tw:border-0 tw:border-t tw:border-solid tw:border-black tw:pt-[3px]">{text}</div>
        </div>
      ))}
    </div>
  );
}

const CLOSED = { doc: null, loading: false, error: '' };
const NOT_SAVED = 'This AWB is not saved yet - the form opens blank. Save the AWB to fill it from the AWB.';

function useAwbDoc(isOpen, awbId, awbType) {
  const [state, setState] = useState(CLOSED);
  const load = useCallback(async () => {
    if (!awbId) { setState({ ...CLOSED, error: NOT_SAVED }); return; }
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    try {
      setState({ doc: await freightApi.awbDocData(awbType || 'AWB', awbId), loading: false, error: '' });
    } catch (error) {
      setState({ doc: null, loading: false, error: failText(error, 'Could not read the AWB') });
    }
  }, [awbId, awbType]);
  // closed: forget the AWB, so the next opening fills (and restores) from a fresh read
  useEffect(() => { if (isOpen) load(); else setState(CLOSED); }, [isOpen, load]);
  return { ...state, reload: load };
}

const PRINT_CSS = '.pb{page-break-after:always} table{border-collapse:collapse}';

function statusOf({ loading, error }) {
  if (loading) return { text: 'Reading the AWB...', className: 'tw:text-muted-foreground' };
  if (error) return { text: error, className: 'tw:text-warning' };
  return { text: 'Filled from the saved AWB - change anything; it is kept with the AWB', className: 'tw:text-success' };
}

/** Window of an AWB document: reads the saved AWB, shows the sheet (children(doc)), keeps what is typed, prints / exports only the sheet. */
export function DocWindow({ isOpen, onClose, title, fileName, awbId, awbType, landscape, extraButtons, children }) {
  const persisted = useContext(DocCtx);
  const { doc, loading, error, reload } = useAwbDoc(isOpen, awbId, awbType);
  const [generation, setGeneration] = useState(0);
  const [sheet, setSheet] = useState(null);
  const restored = useRef(false);

  useEffect(() => { if (!isOpen) restored.current = false; }, [isOpen]);
  // what was typed before goes back on top once the sheet is filled from the AWB
  useEffect(() => {
    if (!isOpen || loading || (!doc && !error) || restored.current || !sheet) return;
    restored.current = true;
    if (persisted?.restore) setTimeout(() => persisted.restore(sheet), 0);
  }, [isOpen, loading, doc, error, sheet, persisted]);

  const data = doc || EMPTY_DOC;
  const baseName = safeFileName(fileName || title);
  const status = statusOf({ loading, error });
  const heading = `${title}${data.hawbNo ? ` - HAWB ${data.hawbNo}` : data.awbNo ? ` - ${data.awbNo}` : ''}`;

  const refill = async () => {
    const goAhead = await askConfirm({ title: 'Fill from AWB', message: 'Fill the form again from the AWB? What was typed here is replaced.', okLabel: 'Fill again', tone: 'warn' });
    if (!goAhead) return;
    reload();
    setGeneration((current) => current + 1);
    setTimeout(() => persisted?.capture?.(), 600);
  };
  const print = () => printSheet(sheetClone(sheet), { title: baseName, landscape, css: PRINT_CSS });
  const savePdf = () => saveSheetPdf(sheetClone(sheet, { width: landscape ? 1040 : 720, padding: '8px' }), { fileName: baseName, landscape, avoid: ['tr', '.keep'] });
  const saveWord = () => saveSheetWord(sheetClone(sheet), { fileName: baseName, title: baseName, landscape });

  const footer = (
    <>
      {extraButtons}
      {awbId && <Button variant="secondary" title="Start again from the AWB" onClick={refill}><RefreshCw /> Fill from AWB</Button>}
      <Button variant="default" disabled={!sheet} onClick={print}><Printer /> Print</Button>
      <Button variant="destructive" disabled={!sheet} onClick={savePdf}><Download /> PDF</Button>
      <Button disabled={!sheet} onClick={saveWord}><FileText /> Word</Button>
    </>
  );

  return (
    <Modal open={isOpen} onClose={onClose} title={heading} width={landscape ? 1140 : 874} closeOnOutside={false}
      description={<span className={cn('tw:text-[11px] tw:font-bold', status.className)}>{status.text}</span>}
      className="tw:h-[94vh]" bodyClassName="tw:items-center-safe tw:overflow-auto tw:bg-[#e2e8f0] tw:p-[14px]" footer={footer}>
      {loading ? <div className="tw:p-[40px] tw:text-[13px] tw:text-muted-foreground">Reading the AWB...</div> : (
        <div key={generation} ref={setSheet} data-doc-root={persisted ? persisted.docType : ''}
          className={cn('tw:shrink-0 tw:bg-white tw:px-[26px] tw:py-[22px] tw:[font-family:Arial,sans-serif] tw:text-[11px] tw:text-black tw:normal-case tw:box-border',
            landscape ? 'tw:w-[1060px]' : 'tw:w-[794px]')}>
          {children(data)}
        </div>
      )}
    </Modal>
  );
}

const CODE39 = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn',
  $: 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn',
};

/** Code 39 barcode as plain SVG (cargo labels). */
export function Barcode39({ value, height = 46, unit = 1.4 }) {
  const text = '*' + String(value || '').toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '') + '*';
  const bars = [];
  let position = 0;
  for (const character of text) {
    const pattern = CODE39[character];
    if (!pattern) continue;
    for (let index = 0; index < 9; index++) {
      const barWidth = (pattern[index] === 'w' ? 3 : 1) * unit;
      if (index % 2 === 0) bars.push(<rect key={bars.length} x={position} y={0} width={barWidth} height={height} fill="#000" />);
      position += barWidth;
    }
    position += unit;
  }
  return <svg width={position} height={height} viewBox={`0 0 ${position} ${height}`} role="img" aria-label={`Barcode ${value}`} className="tw:mx-auto tw:block">{bars}</svg>;
}
