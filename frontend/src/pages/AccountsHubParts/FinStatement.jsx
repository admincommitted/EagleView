// Balance Sheet, Profit & Loss and Trial Balance on one engine (fin-statement): every ledger's opening / period Dr-Cr /
// closing comes from the books in the branch + year scope of the top bar and the screen totals it per group. "Show"
// picks how deep the statement opens; any group can still be opened or closed by clicking it. Print and Excel give
// exactly what is open on the screen.
import { useEffect, useMemo, useState } from 'react';
import { Printer, Download, FileText, ChevronRight, ChevronDown, RefreshCw, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/store/workspaceStore';
import {
  Button, DateInput, Label, SelectBox,
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui';
import { accountsApi } from './accountsApi';
import { escapeHtml, markup } from './printVoucher';

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const isZero = (value) => Math.abs(value) < 0.005;
const amountText = (value) => (isZero(value) ? '' : Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const signedText = (value) => (isZero(value) ? '' : (value < 0 ? '-' : '') + amountText(value));
const dayMonthYear = (date) => (date ? String(date).slice(0, 10).split('-').reverse().join('-') : '');
const todayIso = () => new Date().toISOString().slice(0, 10);
const LEVELS = [{ value: '1', label: 'Main groups' }, { value: '2', label: 'Main + sub groups' }, { value: '9', label: 'All groups' }, { value: 'L', label: 'Groups + ledgers' }];
const TB_TOTAL_KEYS = ['opDr', 'opCr', 'dr', 'cr', 'clDr', 'clCr'];
const TB_AMOUNT_HEADS = ['Debit', 'Credit', 'Debit', 'Credit', 'Debit', 'Credit'];
const PRINT_DELAY_MS = 250;
const FRAME_REMOVE_MS = 1500;

let companyHeadRequest = null;
const loadCompanyHead = async () => {
  try {
    return await accountsApi.companyHead();
  } catch {
    companyHeadRequest = null;
    return { name: '', address: '' };
  }
};
const companyHead = () => (companyHeadRequest ??= loadCompanyHead());
const scopeText = () => { const { branch } = window.__acctx || {}; return branch === 'ALL' || !branch ? 'All branches' : branch; };

const TITLES = {
  bs: ['Balance Sheet', 'Statement of assets and liabilities'],
  pl: ['Profit & Loss Account', 'Income and expenses of the period'],
  tb: ['Trial Balance', 'Opening, period and closing balance of every account'],
};

// group tree with totals: node = { key, kind: 'g'|'l', id, name, depth, nature, op, dr, cr, cl, kids }
function buildTree(data) {
  const byId = new Map(data.groups.map((group) => [group.id, { key: 'g' + group.id, kind: 'g', id: group.id, name: group.name, p: group.p, nature: group.n, op: 0, dr: 0, cr: 0, cl: 0, kids: [] }]));
  const roots = [];
  for (const group of byId.values()) {
    const parent = group.p && byId.get(group.p);
    if (parent) parent.kids.push(group); else roots.push(group);
  }
  for (const ledger of data.ledgers) {
    const group = byId.get(ledger.g);
    if (group) group.kids.push({ key: 'l' + ledger.id, kind: 'l', id: ledger.id, name: ledger.name, op: ledger.op, dr: ledger.dr, cr: ledger.cr, cl: ledger.cl, kids: [] });
  }
  const total = (node, depth, nature) => {
    node.depth = depth;
    node.nature = node.nature || nature;
    if (node.kind === 'g') {
      node.op = node.dr = node.cr = node.cl = 0;
      for (const kid of node.kids) {
        total(kid, depth + 1, node.nature);
        node.op += kid.op; node.dr += kid.dr; node.cr += kid.cr; node.cl += kid.cl;
      }
      node.op = round2(node.op); node.dr = round2(node.dr); node.cr = round2(node.cr); node.cl = round2(node.cl);
      node.kids = node.kids.filter((kid) => !isZero(kid.op) || !isZero(kid.dr) || !isZero(kid.cr) || !isZero(kid.cl));
      node.kids.sort((first, second) => (first.kind === second.kind ? 0 : first.kind === 'g' ? -1 : 1));
    }
    return node;
  };
  return roots.map((root) => total(root, 0, root.nature)).filter((root) => root.kids.length);
}
// keys that are open at a level
function openAt(roots, level) {
  const open = new Set();
  const walk = (node) => {
    if (node.kind !== 'g') return;
    const hasGroups = node.kids.some((kid) => kid.kind === 'g');
    const opens = level === 'L' ? node.kids.length > 0 : level === '9' ? hasGroups : hasGroups && node.depth < Number(level) - 1;
    if (opens) open.add(node.key);
    node.kids.forEach(walk);
  };
  roots.forEach(walk);
  return open;
}
// rows as on screen
function visibleRows(nodes, open, value) {
  const out = [];
  const walk = (node) => { out.push({ node, value: value(node) }); if (open.has(node.key)) node.kids.forEach(walk); };
  nodes.forEach(walk);
  return out;
}
// per-row Dr / Cr split for the TB (a group shows its net, like iCAFFE's consolidated trial balance)
const splitDrCr = (value) => [value > 0 ? value : 0, value < 0 ? -value : 0];
const tbAmounts = (node) => { const [openDr, openCr] = splitDrCr(node.op); const [closeDr, closeCr] = splitDrCr(node.cl); return [openDr, openCr, node.dr, node.cr, closeDr, closeCr]; };
const sideRows = (side, open) => [
  ...visibleRows(side.nodes, open, side.value),
  ...(side.extra ? [{ extra: true, node: { name: side.extra[0], depth: 0, kind: 'g', kids: [] }, value: side.extra[1] }] : []),
];

function buildStatement(data, mode, roots, open) {
  if (!data) return { sides: null, trial: null };
  const byNature = (nature) => roots.filter((root) => root.nature === nature);
  const total = (list, value) => round2(list.reduce((sum, root) => sum + value(root), 0));
  if (mode === 'bs') {
    const liabilities = byNature('Liabilities');
    const assets = byNature('Assets');
    const profit = round2(-(total(byNature('Income'), (root) => root.cl) + total(byNature('Expenses'), (root) => root.cl)));
    return {
      sides: {
        left: { label: 'Liabilities', nodes: liabilities, value: (node) => -node.cl, extra: profit >= 0 ? ['Profit & Loss A/c', profit] : null, total: round2(total(liabilities, (root) => -root.cl) + Math.max(profit, 0)) },
        right: { label: 'Assets', nodes: assets, value: (node) => node.cl, extra: profit < 0 ? ['Profit & Loss A/c (loss)', -profit] : null, total: round2(total(assets, (root) => root.cl) + Math.max(-profit, 0)) },
      },
      trial: null,
    };
  }
  if (mode === 'pl') {
    const income = byNature('Income');
    const expenses = byNature('Expenses');
    const incomeTotal = total(income, (root) => root.cr - root.dr);
    const expenseTotal = total(expenses, (root) => root.dr - root.cr);
    const netProfit = round2(incomeTotal - expenseTotal);
    return {
      sides: {
        left: { label: 'Expenses', nodes: expenses, value: (node) => node.dr - node.cr, extra: netProfit >= 0 ? ['Net Profit', netProfit] : null, total: round2(expenseTotal + Math.max(netProfit, 0)) },
        right: { label: 'Income', nodes: income, value: (node) => node.cr - node.dr, extra: netProfit < 0 ? ['Net Loss', -netProfit] : null, total: round2(incomeTotal + Math.max(-netProfit, 0)) },
      },
      trial: null,
    };
  }
  const all = [...byNature('Liabilities'), ...byNature('Assets'), ...byNature('Income'), ...byNature('Expenses')];
  return {
    sides: null,
    trial: {
      rows: visibleRows(all, open, (node) => node),
      totals: {
        opDr: total(all, (root) => Math.max(root.op, 0)), opCr: total(all, (root) => Math.max(-root.op, 0)),
        dr: total(all, (root) => root.dr), cr: total(all, (root) => root.cr),
        clDr: total(all, (root) => Math.max(root.cl, 0)), clCr: total(all, (root) => Math.max(-root.cl, 0)),
      },
    },
  };
}

// ---- print: exactly the rows open on the screen
const PRINT_CSS = (landscape) => `
  @page { size: ${landscape ? 'A4 landscape' : 'A4'}; margin: 10mm } body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #000 }
  .co { text-align: center; font-size: 15px; font-weight: 700 } .ad { text-align: center; font-size: 10px } .ti { text-align: center; font-size: 12px; font-weight: 700; margin: 8px 0 2px; text-decoration: underline }
  .meta { display: flex; justify-content: space-between; margin: 6px 0 } table { border-collapse: collapse; width: 100% } th, td { border: 1px solid #777; padding: 2px 4px } th { background: #e9eef3 }
  td.n { text-align: right; white-space: nowrap } th.amount { width: 120px } td.bold { font-weight: 700 } tfoot td { font-weight: 700; border-top: 1.5px solid #000 } tr.x td { font-weight: 700 }
  .two { display: flex; gap: 8px; align-items: flex-start } .two > div { flex: 1 }`;
const printIndent = (node) => `style="padding-left:${4 + node.depth * 14}px;${node.kind === 'g' ? 'font-weight:' + (node.depth === 0 ? 700 : 600) : 'color:#333'}"`;
const numberCell = (value, extraClass = '') => markup('td', value, `class="n${extraClass}"`);

function printSide(side, open) {
  const rows = sideRows(side, open).map((row) => markup('tr',
    markup('td', escapeHtml(row.node.name), printIndent(row.node)) + numberCell(signedText(row.value), row.node.kind === 'g' && row.node.depth === 0 ? ' bold' : ''),
    row.extra ? 'class="x"' : ''));
  return markup('table',
    markup('thead', markup('tr', markup('th', escapeHtml(side.label)) + markup('th', 'Amount', 'class="amount"')))
    + markup('tbody', rows.join(''))
    + markup('tfoot', markup('tr', markup('td', 'Total') + numberCell(amountText(side.total)))));
}
function printTrial(trial) {
  const head = markup('tr', markup('th', 'Account', 'rowspan="2"') + markup('th', 'Opening', 'colspan="2"') + markup('th', 'Transactions', 'colspan="2"') + markup('th', 'Closing', 'colspan="2"'))
    + markup('tr', TB_AMOUNT_HEADS.map((heading) => markup('th', heading)).join(''));
  const rows = trial.rows.map(({ node }) => markup('tr', markup('td', escapeHtml(node.name), printIndent(node)) + tbAmounts(node).map((value) => numberCell(amountText(value))).join('')));
  return markup('table', markup('thead', head) + markup('tbody', rows.join(''))
    + markup('tfoot', markup('tr', markup('td', 'Grand Total') + TB_TOTAL_KEYS.map((key) => numberCell(amountText(trial.totals[key]))).join(''))));
}
function printInFrame(html) {
  const frame = document.createElement('iframe');
  frame.className = 'tw:fixed tw:right-0 tw:bottom-0 tw:size-0 tw:border-0';
  document.body.appendChild(frame);
  frame.contentDocument.open();
  frame.contentDocument.write(html);
  frame.contentDocument.close();
  setTimeout(() => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      // the browser blocked printing from the frame; nothing else to do
    }
    setTimeout(() => frame.remove(), FRAME_REMOVE_MS);
  }, PRINT_DELAY_MS);
}

// ---- screen
const indentStyle = (depth, start, step) => ({ '--indent': `${start + (depth || 0) * step}px` });

function StatementRow({ node, value, extra, open, onToggle }) {
  const isGroup = node.kind === 'g' && !extra;
  const canOpen = isGroup && node.kids.length > 0;
  const strong = extra || (isGroup && node.depth === 0);
  return (
    <div
      onClick={() => canOpen && onToggle(node.key)}
      style={indentStyle(node.depth, 12, 18)}
      className={cn(
        'tw:flex tw:justify-between tw:border-b tw:border-border/60 tw:py-1.25 tw:pr-3 tw:pl-(--indent) tw:hover:bg-page',
        canOpen && 'tw:cursor-pointer',
        extra ? 'tw:bg-success/10' : strong && 'tw:bg-page/60'
      )}
    >
      <span className={cn('tw:flex tw:items-center tw:gap-1 tw:text-[12.5px]', strong ? 'tw:font-extrabold' : isGroup ? 'tw:font-semibold' : 'tw:font-normal', extra ? 'tw:text-success' : isGroup ? 'tw:text-foreground' : 'tw:text-foreground/75')}>
        {canOpen ? (open.has(node.key) ? <ChevronDown className="tw:size-3.25 tw:text-primary" /> : <ChevronRight className="tw:size-3.25 tw:text-primary" />) : <span className="tw:w-3.25" />}
        {node.name}
      </span>
      <span className={cn('tw:text-[12.5px] tw:tabular-nums', strong ? 'tw:font-extrabold' : 'tw:font-semibold', value < 0 ? 'tw:text-destructive' : 'tw:text-foreground')}>{signedText(value)}</span>
    </div>
  );
}

function StatementSide({ side, open, onToggle, className }) {
  return (
    <div className={cn('tw:flex tw:min-w-0 tw:flex-1 tw:flex-col', className)}>
      <div className="tw:border-b tw:border-input tw:bg-muted tw:px-3 tw:py-2 tw:text-[12.5px] tw:font-extrabold">{side.label}</div>
      {sideRows(side, open).map((row) => <StatementRow key={row.extra ? 'extra' : row.node.key} node={row.node} value={row.value} extra={row.extra} open={open} onToggle={onToggle} />)}
      <div className="tw:flex-1" />
      <div className="tw:flex tw:justify-between tw:border-t-2 tw:border-foreground tw:bg-muted tw:px-3 tw:py-2.5 tw:text-sm tw:font-black"><span>Total</span><span>{amountText(side.total)}</span></div>
    </div>
  );
}

function TrialBalanceTable({ trial, open, onToggle }) {
  return (
    <Table className="tw:text-[12.5px]">
      <TableHeader>
        <TableRow className="tw:hover:bg-transparent">
          <TableHead rowSpan={2}>Account</TableHead>
          <TableHead colSpan={2} className="tw:text-center">Opening</TableHead>
          <TableHead colSpan={2} className="tw:text-center">Transactions</TableHead>
          <TableHead colSpan={2} className="tw:text-center">Closing</TableHead>
        </TableRow>
        <TableRow className="tw:hover:bg-transparent">
          {TB_AMOUNT_HEADS.map((heading, index) => <TableHead key={index} className="tw:text-right">{heading}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {trial.rows.map(({ node }) => {
          const isGroup = node.kind === 'g';
          const canOpen = isGroup && node.kids.length > 0;
          const mainGroup = isGroup && node.depth === 0;
          return (
            <TableRow key={node.key} onClick={() => canOpen && onToggle(node.key)} className={cn(canOpen && 'tw:cursor-pointer')}>
              <TableCell style={indentStyle(node.depth, 8, 18)} className={cn('tw:pl-(--indent)', isGroup ? (mainGroup ? 'tw:font-extrabold' : 'tw:font-semibold') : 'tw:font-normal')}>
                {canOpen ? (open.has(node.key) ? <ChevronDown className="tw:inline tw:size-3" /> : <ChevronRight className="tw:inline tw:size-3" />) : null} {node.name}
              </TableCell>
              {tbAmounts(node).map((value, index) => <TableCell key={index} className={cn('tw:text-right tw:tabular-nums', mainGroup && 'tw:font-bold')}>{amountText(value)}</TableCell>)}
            </TableRow>
          );
        })}
      </TableBody>
      <TableFooter>
        <TableRow className="tw:border-t-2 tw:border-foreground tw:bg-muted tw:font-black tw:hover:bg-muted">
          <TableCell className="tw:p-2">Grand Total</TableCell>
          {TB_TOTAL_KEYS.map((key) => <TableCell key={key} className="tw:p-2 tw:text-right">{amountText(trial.totals[key])}</TableCell>)}
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function DateFilter({ label, value, onChange }) {
  return (
    <Label className="tw:font-bold tw:text-foreground/80">
      {label} <DateInput value={value} onValueChange={onChange} wrapperClassName="tw:w-[140px]" />
    </Label>
  );
}

// the statement starts again whenever another branch or year is picked in the top bar
export function ScopedFinStatement({ mode }) {
  const activeBranch = useWorkspaceStore((state) => state.activeBranch);
  const activeYear = useWorkspaceStore((state) => state.activeYear);
  const branchKey = activeBranch ? (activeBranch.isAll ? 'ALL' : activeBranch.branchCode) || '' : '';
  return <FinStatement key={`${branchKey}|${activeYear?.id || ''}`} mode={mode} />;
}

export default function FinStatement({ mode = 'bs' }) {
  const ctx = window.__acctx || {};
  const [from, setFrom] = useState(ctx.fyStart || '');
  const [to, setTo] = useState(() => { const yearEnd = ctx.fyEnd || ''; const today = todayIso(); return yearEnd && today > yearEnd ? yearEnd : today; });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState('1');
  const [open, setOpen] = useState(new Set());
  const [title, subtitle] = TITLES[mode];

  const load = async () => {
    setBusy(true);
    setError('');
    const params = { to };
    if (mode !== 'bs' && from) params.from = from;
    if (mode === 'bs' && ctx.fyStart) params.from = ctx.fyStart;
    try {
      const statement = await accountsApi.hubFinStatement(params);
      setData(statement);
      if (!from) setFrom(statement.from);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { load(); }, [to, from]); // eslint-disable-line react-hooks/exhaustive-deps
  const roots = useMemo(() => (data ? buildTree(data) : []), [data]);
  useEffect(() => { setOpen(openAt(roots, level)); }, [roots, level]);
  const toggle = (key) => setOpen((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  const { sides, trial } = buildStatement(data, mode, roots, open);
  const periodText = mode === 'bs' ? 'As on ' + dayMonthYear(to) : 'From ' + dayMonthYear(from) + ' To ' + dayMonthYear(to);
  const difference = sides ? round2(sides.left.total - sides.right.total) : 0;

  const print = async () => {
    const head = await companyHead();
    const body = sides ? `<div class="two"><div>${printSide(sides.left, open)}</div><div>${printSide(sides.right, open)}</div></div>` : trial ? printTrial(trial) : '';
    printInFrame(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PRINT_CSS(mode === 'tb')}</style></head><body>`
      + `<div class="co">${escapeHtml(head.name)}</div>${head.address ? `<div class="ad">${escapeHtml(head.address)}</div>` : ''}<div class="ti">${escapeHtml(title)}</div>`
      + `<div class="meta"><span>Scope : ${escapeHtml(scopeText())}</span><span>${escapeHtml(periodText)}</span><span>Printed on ${dayMonthYear(todayIso())}</span></div>${body}</body></html>`);
  };
  const exportExcel = async () => {
    const [XLSX, head] = await Promise.all([import('xlsx'), companyHead()]);
    const indented = (node) => '    '.repeat(node.depth || 0) + node.name;
    const cellNumber = (value) => (isZero(value) ? '' : round2(value));
    const sheetRows = [[head.name], [head.address || ''], [title], ['Scope : ' + scopeText() + '    ' + periodText], []];
    if (sides) {
      const left = sideRows(sides.left, open);
      const right = sideRows(sides.right, open);
      sheetRows.push([sides.left.label, 'Amount', '', sides.right.label, 'Amount']);
      for (let index = 0; index < Math.max(left.length, right.length); index++) {
        const leftRow = left[index];
        const rightRow = right[index];
        sheetRows.push([leftRow ? indented(leftRow.node) : '', leftRow ? cellNumber(leftRow.value) : '', '', rightRow ? indented(rightRow.node) : '', rightRow ? cellNumber(rightRow.value) : '']);
      }
      sheetRows.push(['Total', round2(sides.left.total), '', 'Total', round2(sides.right.total)]);
    } else if (trial) {
      sheetRows.push(['Account', 'Opening Debit', 'Opening Credit', 'Debit', 'Credit', 'Closing Debit', 'Closing Credit']);
      trial.rows.forEach(({ node }) => sheetRows.push([indented(node), ...tbAmounts(node).map(cellNumber)]));
      sheetRows.push(['Grand Total', ...TB_TOTAL_KEYS.map((key) => round2(trial.totals[key]))]);
    }
    const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
    sheet['!cols'] = sides ? [{ wch: 50 }, { wch: 18 }, { wch: 3 }, { wch: 50 }, { wch: 18 }] : [{ wch: 50 }, ...Array(6).fill({ wch: 16 })];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, title.replace(/[^\w ]/g, '').slice(0, 31));
    XLSX.writeFile(workbook, title.replace(/[^\w]+/g, '_') + '_' + to + '.xlsx');
  };

  return (
    <div className="tw:mx-auto tw:max-w-[1600px] tw:p-2 tw:md:p-4">
      <div className="tw:mb-3 tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-page tw:px-4 tw:py-3">
        <div className="tw:rounded-md tw:bg-primary tw:p-2 tw:text-primary-foreground"><FileText className="tw:size-5" /></div>
        <div className="tw:mr-auto tw:min-w-0">
          <h2 className="tw:m-0 tw:text-lg tw:font-extrabold">{title}</h2>
          <span className="tw:text-[11px] tw:text-muted-foreground">{subtitle} - {scopeText()}{data?.fy?.name ? ' | FY ' + data.fy.name : ''}</span>
        </div>
        {mode !== 'bs' && <DateFilter label="From" value={from} onChange={setFrom} />}
        <DateFilter label={mode === 'bs' ? 'As on' : 'To'} value={to} onChange={setTo} />
        <Label className="tw:font-bold tw:text-foreground/80" title="How deep the statement opens - Print and Excel give the same">
          Show <SelectBox options={LEVELS} value={level} onValueChange={setLevel} className="tw:w-[170px]" />
        </Label>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <Button size="lg" onClick={() => setOpen(openAt(roots, 'L'))} title="Open every group and ledger"><ChevronsUpDown /> Expand all</Button>
          <Button size="lg" onClick={() => setOpen(new Set())} title="Close every group"><ChevronsDownUp /> Collapse all</Button>
          <Button size="lg" onClick={load} disabled={busy}><RefreshCw className={cn(busy && 'tw:animate-spin')} /> {busy ? 'Loading...' : 'Refresh'}</Button>
          <Button size="lg" onClick={print} disabled={!data} title="Prints what is open on the screen"><Printer /> Print</Button>
          <Button size="lg" onClick={exportExcel} disabled={!data} title="Excel of what is open on the screen"><Download /> Excel</Button>
        </div>
      </div>
      {error && <div className="tw:p-2.5 tw:font-bold tw:text-destructive">Could not load: {error}</div>}
      {!data && !error && (
        <div className="tw:flex tw:items-center tw:justify-center tw:gap-2 tw:p-10 tw:font-bold tw:text-primary">
          <RefreshCw className="tw:size-4 tw:animate-spin" /> Loading {title}...
        </div>
      )}
      {data && (
        <div className={cn('tw:overflow-hidden tw:rounded-lg tw:border tw:border-input tw:bg-card', busy && 'tw:opacity-60')}>
          <div className="tw:border-b-2 tw:border-foreground tw:px-5 tw:py-3.5 tw:text-center">
            <div className="tw:text-[19px] tw:font-extrabold">{title}</div>
            <div className="tw:mt-0.5 tw:text-entry tw:text-foreground/75">{periodText} - {scopeText()}</div>
          </div>
          {sides && (
            <div className="tw:flex tw:min-h-[300px] tw:flex-col tw:md:flex-row">
              <StatementSide side={sides.left} open={open} onToggle={toggle} className="tw:border-b tw:border-border tw:md:border-r tw:md:border-b-0" />
              <StatementSide side={sides.right} open={open} onToggle={toggle} />
            </div>
          )}
          {sides && Math.abs(difference) >= 1 && (
            <div className="tw:bg-destructive/10 tw:px-3.5 tw:py-2 tw:text-entry tw:font-bold tw:text-destructive">
              Difference of {amountText(difference)} - the books do not balance in this scope (with one branch picked, entries between branches and the company-wide opening can cause this; pick All branches).
            </div>
          )}
          {trial && <TrialBalanceTable trial={trial} open={open} onToggle={toggle} />}
        </div>
      )}
    </div>
  );
}
