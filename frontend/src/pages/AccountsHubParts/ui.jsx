import { useEffect, useMemo, useRef, useState } from 'react';
import axiosInstance from '@/services/axiosInstance';
import { cn } from '@/lib/utils';
import {
  Badge as UiBadge, Button, Input, Label, Popover, PopoverAnchor, PopoverContent,
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
  Tabs as UiTabs, TabsList, TabsTrigger,
} from '@/components/ui';

export const T = {
  grad: 'linear-gradient(135deg, var(--primary-color-start, #0284c7), var(--primary-color-end, #075985))',
  tabGrad: 'linear-gradient(to right, var(--primary-color-start, #0ea5e9), var(--primary-color-end, #2563eb))',
  brand: 'var(--primary-color-end, #075985)', brandA: 'var(--primary-color-start, #0284c7)', brandLight: 'var(--primary-bg-light, #e0f2fe)',
  head: 'var(--primary-text, #0275a8)', headBg: 'var(--primary-bg-light, #e1f0fa)', headBorder: 'color-mix(in srgb, var(--primary-border, #93c5fd) 55%, #ffffff)',
  box: 'color-mix(in srgb, var(--primary-bg-light, #eff6ff) 55%, #ffffff)', boxBorder: 'color-mix(in srgb, var(--primary-border, #93c5fd) 40%, #ffffff)',
  ink: 'var(--primary-color-end, #075985)', inkSoft: '#334155',
  paper: 'var(--bg-app, #f4f7f9)', panel: '#ffffff', rule: '#cbd5e1', ruleSoft: '#e2e8f0',
  text: 'var(--text-main, #0f172a)', muted: 'var(--text-muted, #64748b)',
  dr: '#b91c1c', cr: '#047857', amber: '#b45309', amberBg: '#fffbeb', okBg: '#ecfdf5', drBg: '#fef2f2',
};

export const inr = (value, decimals = 2) => (value === null || value === undefined || value === '' || isNaN(Number(value))
  ? ''
  : Number(value).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
export const fmtDate = (date) => {
  if (!date) return '';
  const text = String(date).slice(0, 10);
  const [year, month, day] = text.split('-');
  return day && month && year ? `${day}/${month}/${year}` : text;
};
export const todayIso = () => new Date().toISOString().slice(0, 10);

// The financial year picked in the top bar (GlobalContext keeps it on window.__acctx).
const topBarYear = () => {
  const { fyStart: start, fyEnd: end } = window.__acctx || {};
  return start && end ? [String(start).slice(0, 10), String(end).slice(0, 10)] : null;
};
export const fyStart = () => {
  const year = topBarYear();
  if (year) return year[0];
  const today = new Date();
  return `${today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear()}-04-01`;
};
export const fyEnd = () => {
  const year = topBarYear();
  return year ? year[1] : `${Number(fyStart().slice(0, 4)) + 1}-03-31`;
};
export const fyId = () => (window.__acctx || {}).fyId || '';

// ------------------------------------------------------------------ http
const asJson = (data) => (data && typeof data === 'object' ? data : {});
const withoutApiPrefix = (url) => String(url).replace(/^\/api(?=\/)/, '');

const request = async (config) => {
  try {
    const response = await axiosInstance.request({ ...config, url: withoutApiPrefix(config.url) });
    const data = asJson(response.data);
    if (data.success === false) throw new Error(data.error || data.message || `HTTP ${response.status}`);
    return data;
  } catch (error) {
    if (!error.response) throw error;
    const data = asJson(error.response.data);
    throw new Error(data.error || data.message || `HTTP ${error.response.status}`);
  }
};

// Takes '/accounts-hub/...' (an older URL that still starts with the api prefix works too) and fetch-style options
// { method, headers, body }; resolves to the response JSON, rejects with Error(server message).
export const api = (url, options = {}) => request({ url, method: options.method || 'GET', headers: options.headers, data: options.body });
export const postJson = (url, body, method = 'POST') => request({ url, method, data: body });

// cached lookups; plain names go to /lookups/<name>, one cache per top-bar branch and year
const LOOKUPS = ['ledgers', 'groups', 'tdsnatures', 'costcentres', 'sac', 'years'];
const lookupCache = {};
const loadLookup = async (url, key) => {
  try {
    return await api(url);
  } catch {
    delete lookupCache[key];
    return [];
  }
};
export const lookup = (path, fresh) => {
  const url = '/accounts-hub/' + (LOOKUPS.includes(path) ? 'lookups/' + path : path);
  const { branch = '', fyId: yearId = '' } = window.__acctx || {};
  const key = `${url}#${branch}#${yearId}`;
  if (fresh) delete lookupCache[key];
  lookupCache[key] ??= loadLookup(url, key);
  return lookupCache[key];
};

const cssSize = (value) => (typeof value === 'number' ? `${value}px` : value);

// ------------------------------------------------------------------ boxes
// field box; with a title it gets the light-blue section strip
export function Box({ title, right, children, style, pad = 10, bodyStyle, className, bodyClassName }) {
  return (
    <div style={style} className={cn('tw:min-w-0 tw:overflow-hidden tw:rounded-md tw:border tw:border-primary/25 tw:bg-primary/5', className)}>
      {title && (
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:border-b tw:border-primary/30 tw:bg-primary/10 tw:px-2.5 tw:py-1 tw:text-[11.5px] tw:font-extrabold tw:text-head">
          <span>{title}</span>
          <span className="tw:ml-auto tw:flex tw:flex-wrap tw:items-center tw:gap-2">{right}</span>
        </div>
      )}
      <div style={{ '--box-pad': cssSize(pad), ...bodyStyle }} className={cn('tw:p-(--box-pad)', bodyClassName)}>{children}</div>
    </div>
  );
}
export const Panel = ({ children, style, pad = 12, className }) => <Box pad={pad} style={style} className={cn('tw:bg-card', className)}>{children}</Box>;

// folder tabs over a sheet; tab: { id, label, icon }
export function Tabs({ tabs, value, onChange, right }) {
  return (
    <UiTabs value={String(value)} onValueChange={(id) => onChange(tabs.find((tab) => String(tab.id) === id).id)}>
      <div className="tw:flex tw:flex-wrap tw:items-end tw:gap-2 tw:border-b-2 tw:border-primary">
        <TabsList className="tw:w-auto tw:flex-wrap tw:border-b-0">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={String(tab.id)}>
              {tab.icon && <tab.icon className="tw:size-3" />}{tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {right && <div className="tw:ml-auto tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:pb-1">{right}</div>}
      </div>
    </UiTabs>
  );
}

// the page frame of one screen: folder tabs, then the white sheet
export function Sheet({ tabs, tab, onTab, right, children }) {
  return (
    <div>
      <Tabs tabs={tabs} value={tab} onChange={onTab} right={right} />
      <div className="tw:flex tw:flex-col tw:gap-2.5 tw:rounded-b-lg tw:border tw:border-t-0 tw:border-input tw:bg-card tw:p-3">{children}</div>
    </div>
  );
}

// ------------------------------------------------------------------ buttons
const BUTTON_VARIANT = { save: 'success', primary: 'default', danger: 'destructive', clear: 'outline', plain: 'secondary', ghost: 'ghost' };
export function Btn({ children, onClick, kind = 'plain', disabled, title, type = 'button', small, className }) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      variant={BUTTON_VARIANT[kind] || 'secondary'}
      size={small ? 'default' : 'lg'}
      className={cn('tw:font-bold', kind === 'ghost' && 'tw:border-dashed tw:border-primary/30', className)}
    >
      {children}
    </Button>
  );
}

const GOOD_NOTE = /^(Saved|Merged|Updated|Deleted|Closed|Re-opened)/;
export function ActionBar({ children, note }) {
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-md tw:border tw:border-primary/30 tw:bg-primary/10 tw:px-2.5 tw:py-2">
      {children}
      {note && <span className={cn('tw:ml-auto tw:text-entry tw:font-bold', GOOD_NOTE.test(note) ? 'tw:text-success' : 'tw:text-destructive')}>{note}</span>}
    </div>
  );
}

// ------------------------------------------------------------------ fields
const COLUMN_SPAN = { 2: 'tw:md:col-span-2', 3: 'tw:md:col-span-3', 4: 'tw:md:col-span-4', 5: 'tw:md:col-span-5', 6: 'tw:md:col-span-6' };
export function Field({ label, children, hint, required, span = 1, style, className }) {
  return (
    <div style={style} className={cn('tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5', COLUMN_SPAN[span], className)}>
      <Label required={required}>{label}</Label>
      {children}
      {hint && <span className="tw:text-[10.5px] tw:text-muted-foreground">{hint}</span>}
    </div>
  );
}
// label left, field right (stacked on a phone)
export function Row({ label, children, required, w = 104 }) {
  return (
    <div
      style={{ '--row-label-w': `${w}px` }}
      className="tw:grid tw:min-h-[30px] tw:grid-cols-1 tw:items-center tw:gap-x-2 tw:gap-y-0.5 tw:md:grid-cols-[var(--row-label-w)_minmax(0,1fr)]"
    >
      <Label required={required}>{label}</Label>
      <div className="tw:min-w-0">{children}</div>
    </div>
  );
}
export const inputStyle = { width: '100%', height: 28, borderRadius: 5, border: '1px solid #94a3b8', padding: '0 8px', fontSize: 11.5, background: 'var(--bg-input, #fff)', color: 'var(--input-text, #000)', outline: 'none', fontWeight: 500 };
export const roStyle = { ...inputStyle, background: '#eef2f6', color: '#334155' };
export const mandStyle = { ...inputStyle, borderColor: '#f87171' };

const SIDE_COLOR = { Dr: 'tw:text-destructive', Cr: 'tw:text-success' };
export function Money({ v, side, strong, muted }) {
  return (
    <span className={cn('tw:whitespace-nowrap tw:tabular-nums', strong ? 'tw:font-extrabold' : 'tw:font-semibold', muted ? 'tw:text-muted-foreground' : SIDE_COLOR[side] || 'tw:text-foreground')}>
      {inr(v)}
    </span>
  );
}

const BADGE_VARIANT = { muted: 'neutral', ok: 'success', warn: 'warning', bad: 'danger', brand: 'info' };
export function Badge({ children, tone = 'muted' }) {
  return <UiBadge variant={BADGE_VARIANT[tone] || 'neutral'}>{children}</UiBadge>;
}
export const statusTone = (status) => (/approv/i.test(status) ? 'ok' : /reject|return/i.test(status) ? 'bad' : 'warn');

// Type-ahead list for every account / charge box: matches every word typed, anywhere in the name ("kotak 2647" finds
// KOTAK MAHINDRA BANK A/C NO - 2647171181); names starting with the text come first. Down / Up move, Enter or Tab
// picks, Esc closes, F2 lists everything.
const normalise = (text) => String(text || '').toUpperCase().replace(/\s+/g, ' ').trim();
const CLOSE_AFTER_BLUR_MS = 150;
export function SuggestBox({ text, onText, items, getLabel, getSub, getKey, onPick, placeholder, style, className, disabled, autoFocus, max = 80, title, id, 'aria-invalid': invalid }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const anchorRef = useRef(null);
  const listRef = useRef(null);
  const query = showAll ? '' : normalise(text);

  const matches = useMemo(() => {
    if (!open) return [];
    const words = query.split(' ').filter(Boolean);
    const startsWith = [];
    const contains = [];
    for (const item of items || []) {
      const label = normalise(getLabel(item));
      if (!words.every((word) => label.includes(word))) continue;
      (query && label.startsWith(query) ? startsWith : contains).push(item);
      if (startsWith.length >= max) break;
    }
    return startsWith.concat(contains).slice(0, max);
  }, [open, query, items]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setHighlighted(0); }, [query]);
  useEffect(() => { listRef.current?.children[highlighted]?.scrollIntoView?.({ block: 'nearest' }); }, [highlighted]);

  const close = () => { setOpen(false); setShowAll(false); };
  const pick = (item) => { onPick(item); close(); };
  const handleKeyDown = (event) => {
    if (event.key === 'F2') { event.preventDefault(); setShowAll(true); setOpen(true); return; }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      setHighlighted((current) => Math.min(current + 1, matches.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') { event.preventDefault(); setHighlighted((current) => Math.max(current - 1, 0)); return; }
    if (event.key === 'Escape') { close(); return; }
    if ((event.key === 'Enter' || event.key === 'Tab') && open && matches[highlighted] && (normalise(text) || showAll)) {
      if (event.key === 'Enter') event.preventDefault();
      pick(matches[highlighted]);
    }
  };
  const itemCount = (items || []).length;

  return (
    <Popover open={open && !disabled} onOpenChange={(isOpen) => { if (!isOpen) close(); }}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="tw:relative tw:flex tw:w-full tw:min-w-0">
          <Input
            id={id}
            data-allow-text=""
            value={text}
            disabled={disabled}
            autoFocus={autoFocus}
            title={title}
            autoComplete="off"
            placeholder={placeholder}
            style={style}
            aria-invalid={invalid || undefined}
            className={className}
            onChange={(event) => { onText(event.target.value); setShowAll(false); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(close, CLOSE_AFTER_BLUR_MS)}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={2}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => { if (anchorRef.current?.contains(event.target)) event.preventDefault(); }}
        className="tw:max-h-[min(300px,var(--radix-popover-content-available-height))] tw:w-(--radix-popover-trigger-width) tw:min-w-[300px] tw:overflow-y-auto tw:p-0 tw:text-[11.5px]"
      >
        <div ref={listRef}>
          {matches.map((item, index) => (
            <div
              key={getKey ? getKey(item) : index}
              onMouseDown={(event) => { event.preventDefault(); pick(item); }}
              onMouseEnter={() => setHighlighted(index)}
              className={cn('tw:cursor-pointer tw:border-b tw:border-border/40 tw:px-2 tw:py-1', index === highlighted && 'tw:bg-accent tw:text-accent-foreground')}
            >
              <div className="tw:font-bold">{getLabel(item)}</div>
              {getSub?.(item) ? <div className="tw:text-[10px] tw:opacity-70">{getSub(item)}</div> : null}
            </div>
          ))}
        </div>
        {!matches.length && <div className="tw:px-2.5 tw:py-2 tw:opacity-70">{itemCount ? `Nothing matches "${text}"` : 'List is empty'}</div>}
        {matches.length >= max && <div className="tw:px-2.5 tw:py-1 tw:text-[10px] tw:opacity-70">Showing the first {max} - type more to narrow</div>}
      </PopoverContent>
    </Popover>
  );
}

// ledger picker: value = ledger id. What is typed stays in the box; a name that is not a ledger shows red until one
// is picked; typing an exact ledger name picks it.
export function LedgerPicker({ value, onChange, list, placeholder = 'Type ledger name', id, autoFocus, disabled, mandatory }) {
  const current = list.find((ledger) => String(ledger.id) === String(value));
  const [text, setText] = useState(current ? current.name : '');
  const previousValue = useRef(value);
  useEffect(() => {
    // follow the value only when it changes from outside (a picked ledger, a cleared form, a voucher opened)
    if (current && normalise(current.name) !== normalise(text)) setText(current.name);
    else if (!value && previousValue.current && !current) setText('');
    previousValue.current = value;
  }, [value, current?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const exactMatch = (typed) => list.find((ledger) => normalise(ledger.name) === normalise(typed));
  const typedNotPicked = Boolean(text && !value);
  const choose = (ledger) => { previousValue.current = ledger.id; onChange(ledger.id, ledger); };

  return (
    <SuggestBox
      id={id}
      text={text}
      items={list}
      getLabel={(ledger) => ledger.name}
      getSub={(ledger) => ledger.groupName || ''}
      getKey={(ledger) => ledger.id}
      disabled={disabled}
      autoFocus={autoFocus}
      placeholder={list.length ? placeholder : 'No ledgers yet'}
      title={typedNotPicked ? 'Pick the account from the list' : undefined}
      aria-invalid={(mandatory && !value) || typedNotPicked}
      onText={(typed) => {
        setText(typed);
        const ledger = exactMatch(typed);
        if (ledger) choose(ledger);
        else if (value) { previousValue.current = ''; onChange('', null); }
      }}
      onPick={(ledger) => { setText(ledger.name); choose(ledger); }}
    />
  );
}

// current balance of a ledger (shown next to the cash / bank book)
export function useBalance(ledgerId) {
  const [balance, setBalance] = useState(null);
  useEffect(() => {
    setBalance(null);
    if (!ledgerId) return;
    const loadBalance = async () => {
      try {
        setBalance(await api(`/accounts-hub/ledger-balance/${ledgerId}`));
      } catch {
        setBalance(null);
      }
    };
    loadBalance();
  }, [ledgerId]);
  return balance;
}

// totals strip under a voucher
export function BalanceStrip({ dr, cr, extra }) {
  const difference = Math.round((dr - cr) * 100) / 100;
  const balanced = dr > 0 && Math.abs(difference) < 0.01;
  const started = Boolean(dr || cr);
  return (
    <div className={cn(
      'tw:flex tw:flex-wrap tw:items-center tw:gap-x-4.5 tw:gap-y-1 tw:rounded-md tw:border tw:px-3 tw:py-1.5 tw:text-[11.5px]',
      balanced ? 'tw:border-success/40 tw:bg-success/10' : started ? 'tw:border-warning/40 tw:bg-warning/10' : 'tw:border-input tw:bg-muted'
    )}>
      <span className="tw:font-bold tw:text-foreground/80">Dr. <Money v={dr} side="Dr" strong /></span>
      <span className="tw:font-bold tw:text-foreground/80">Cr. <Money v={cr} side="Cr" strong /></span>
      {extra}
      <span className={cn('tw:ml-auto tw:font-extrabold', balanced ? 'tw:text-success' : started ? 'tw:text-warning' : 'tw:text-muted-foreground')}>
        {balanced ? 'Balanced' : started ? `Difference ${inr(Math.abs(difference))} ${difference > 0 ? 'Dr' : 'Cr'}` : 'Enter amounts'}
      </span>
    </div>
  );
}

// grid inside a titled box; cols: [{ label, key, render(row, index), right, w, wrap }]
export function Grid({ title, right, cols, rows, empty = 'No entries', foot, maxHeight = 320, minHeight, onRow, rowKey = (row, index) => index, activeKey }) {
  const alignOf = (column) => (column.right ? 'tw:text-right' : 'tw:text-left');
  return (
    <Box title={title} right={right} pad={0} className="tw:bg-card" style={{ '--grid-max-h': cssSize(maxHeight), '--grid-min-h': cssSize(minHeight) }}>
      <Table containerClassName="tw:max-h-(--grid-max-h) tw:min-h-(--grid-min-h)">
        <TableHeader sticky>
          <TableRow className="tw:hover:bg-transparent">
            {cols.map((column, index) => (
              <TableHead key={index} style={column.w ? { '--col-w': cssSize(column.w) } : undefined} className={cn(alignOf(column), column.w && 'tw:w-(--col-w)')}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const key = rowKey(row, index);
            const active = activeKey !== undefined && String(key) === String(activeKey);
            return (
              <TableRow
                key={key}
                data-state={active ? 'selected' : undefined}
                onClick={onRow ? () => onRow(row) : undefined}
                className={cn(onRow && 'tw:cursor-pointer')}
              >
                {cols.map((column, columnIndex) => (
                  <TableCell key={columnIndex} className={cn(alignOf(column), 'tw:align-top tw:tabular-nums', column.wrap && 'tw:whitespace-normal')}>
                    {column.render ? column.render(row, index) : row[column.key]}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
          {!rows.length && (
            <TableRow className="tw:hover:bg-transparent">
              <TableCell colSpan={cols.length} className="tw:py-6 tw:text-center tw:text-muted-foreground">{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
        {foot && rows.length > 0 && (
          <TableFooter className="tw:sticky tw:bottom-0">
            <TableRow className="tw:bg-accent tw:font-extrabold tw:hover:bg-accent">
              {foot.map((cell, index) => (
                <TableCell key={index} className={cn(cols[index]?.right ? 'tw:text-right' : 'tw:text-left', 'tw:border-t-2 tw:border-t-primary/30')}>{cell}</TableCell>
              ))}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </Box>
  );
}

const lineTotal = (lines, side) => lines.filter((line) => line.dc === side).reduce((sum, line) => sum + Number(line.amount || 0), 0);

// read-only posting
export function PostingTable({ lines, title = 'Posting' }) {
  return (
    <Grid
      title={title}
      maxHeight={360}
      rows={lines}
      cols={[
        {
          label: 'Account Name',
          wrap: true,
          render: (line) => (
            <div>
              <div className="tw:font-bold">{line.ledgerName || line.name}</div>
              {(line.groupName || line.remarks) && <div className="tw:text-[10px] tw:text-muted-foreground">{[line.groupName, line.remarks].filter(Boolean).join(' - ')}</div>}
            </div>
          ),
        },
        { label: 'Debit', right: true, w: 140, render: (line) => (line.dc === 'Dr' ? <Money v={line.amount} side="Dr" /> : '') },
        { label: 'Credit', right: true, w: 140, render: (line) => (line.dc === 'Cr' ? <Money v={line.amount} side="Cr" /> : '') },
      ]}
      foot={['Total', <Money key="dr" v={lineTotal(lines, 'Dr')} side="Dr" strong />, <Money key="cr" v={lineTotal(lines, 'Cr')} side="Cr" strong />]}
    />
  );
}
export const thS = { textAlign: 'left' };
export const tdS = { verticalAlign: 'top' };

export function Empty({ title, children, action }) {
  return (
    <div className="tw:px-5 tw:py-7.5 tw:text-center tw:text-muted-foreground">
      <div className="tw:mb-1 tw:text-[13px] tw:font-extrabold tw:text-head">{title}</div>
      <div className={cn('tw:text-entry', action && 'tw:mb-3')}>{children}</div>
      {action}
    </div>
  );
}

// red / amber note under a party picker: blacklisted, inactive, MSME 45-day rule
export function PartyNote({ b: party }) {
  if (!party) return null;
  const notes = [];
  if (Number(party.isBlacklisted)) notes.push(['bad', 'Blacklisted party' + (party.blacklistReason ? ': ' + party.blacklistReason : '')]);
  if (party.isActive !== undefined && party.isActive !== null && Number(party.isActive) === 0) notes.push(['bad', 'This account is marked inactive']);
  if (party.msmeNo) notes.push(['warn', 'MSME supplier - pay within ' + (Number(party.msmeAgreementDays) || 45) + ' days']);
  if (!notes.length) return null;
  return (
    <div className="tw:mt-1 tw:flex tw:flex-wrap tw:gap-1.5">
      {notes.map(([tone, text]) => <Badge key={text} tone={tone}>{text}</Badge>)}
    </div>
  );
}
