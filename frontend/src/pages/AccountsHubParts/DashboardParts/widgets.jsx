import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui';
import { inr } from '../ui';
import { TONE, changeText } from './format';

const PADDING = { none: 'tw:p-0', normal: 'tw:p-3', roomy: 'tw:p-4' };

export function DashCard({ title, icon: Icon, right, children, padding = 'normal', className, id }) {
  return (
    <Card id={id} className={className}>
      {title && (
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:border-b tw:border-border tw:px-3 tw:py-2">
          {Icon && <Icon className="tw:size-3.25 tw:text-head" />}
          <span className="tw:text-[11px] tw:font-extrabold tw:tracking-wider tw:text-head tw:uppercase">{title}</span>
          <span className="tw:ml-auto tw:flex tw:items-center tw:gap-2 tw:text-[11px] tw:text-muted-foreground">{right}</span>
        </div>
      )}
      <div className={cn('tw:min-w-0 tw:flex-1', PADDING[padding])}>{children}</div>
    </Card>
  );
}

const KPI_TONE = {
  up: { border: 'tw:border-t-teal-600', text: TONE.income },
  down: { border: 'tw:border-t-rose-600', text: TONE.expense },
  blue: { border: 'tw:border-t-primary', text: TONE.brand },
  warn: { border: 'tw:border-t-amber-700', text: TONE.warn },
};
const PLAIN_KPI = { border: 'tw:border-t-border', text: TONE.text };

export function Kpi({ label, value, sub, tone, icon: Icon, onClick }) {
  const colors = KPI_TONE[tone] || PLAIN_KPI;
  return (
    <Card onClick={onClick} className={cn('tw:border-t-3 tw:px-3 tw:py-2.5', colors.border, onClick && 'tw:cursor-pointer tw:hover:bg-page')}>
      <div className="tw:flex tw:items-center tw:gap-1.5 tw:text-[10.5px] tw:font-extrabold tw:tracking-wide tw:text-muted-foreground tw:uppercase">
        {Icon && <Icon className={cn('tw:size-3', colors.text)} />}{label}
      </div>
      <div className={cn('tw:mt-1 tw:truncate tw:text-[21px] tw:font-extrabold tw:tabular-nums', colors.text)} title={inr(value)}>₹ {inr(value, 0)}</div>
      <div className="tw:mt-0.5 tw:min-h-[15px] tw:text-[11px] tw:text-muted-foreground">{sub}</div>
    </Card>
  );
}

export function Delta({ value, good = 'up', label = 'vs last year' }) {
  if (value == null) return null;
  const isGood = good === 'up' ? value >= 0 : value <= 0;
  return <span className="tw:whitespace-nowrap"><b className={isGood ? TONE.good : TONE.bad}>{changeText(value)}</b> {label}</span>;
}

// columns: [{ header, cell(row, index), right, bold, maxWidth (truncates, full text on hover), tone(row) -> text class }]
export function MiniTable({ columns, rows, onRow, empty = 'Nothing to show', maxHeight, foot, rowKey = (row, index) => index, showHeader = true, highlight }) {
  const alignOf = (column) => (column.right ? 'tw:text-right' : 'tw:text-left');
  return (
    <div style={{ '--table-max-h': typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }} className="tw:min-w-0">
      <Table containerClassName="tw:max-h-(--table-max-h)">
        {showHeader && (
          <TableHeader sticky>
            <TableRow className="tw:hover:bg-transparent">
              {columns.map((column, index) => (
                <TableHead key={index} className={cn(alignOf(column), 'tw:border-border tw:bg-page tw:text-foreground')}>{column.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={rowKey(row, index)}
              onClick={onRow ? () => onRow(row) : undefined}
              className={cn('tw:even:bg-transparent', onRow && 'tw:cursor-pointer', highlight?.(row) && 'tw:bg-accent tw:even:bg-accent')}
            >
              {columns.map((column, columnIndex) => {
                const content = column.cell(row, index);
                return (
                  <TableCell
                    key={columnIndex}
                    title={column.maxWidth ? String(content ?? '') : undefined}
                    style={column.maxWidth ? { '--cell-max-w': `${column.maxWidth}px` } : undefined}
                    className={cn(alignOf(column), 'tw:border-x-0 tw:tabular-nums', column.maxWidth && 'tw:max-w-(--cell-max-w) tw:truncate', column.bold && 'tw:font-bold', column.tone?.(row))}
                  >
                    {content}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow className="tw:hover:bg-transparent">
              <TableCell colSpan={columns.length} className="tw:border-x-0 tw:py-4.5 tw:text-center tw:text-muted-foreground">{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
        {foot && rows.length > 0 && (
          <TableFooter>
            <TableRow className="tw:border-t-2 tw:font-extrabold tw:hover:bg-transparent">
              {foot.map((cell, index) => <TableCell key={index} className={cn(alignOf(columns[index] || {}), 'tw:border-x-0 tw:tabular-nums')}>{cell}</TableCell>)}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}

// one "label ... ₹ amount" line
export function AmountLine({ label, value, strong, tone, sign }) {
  return (
    <div className={cn('tw:flex tw:justify-between tw:border-b tw:border-border/60 tw:px-0.5 tw:py-1.5', strong ? 'tw:text-[13px] tw:font-extrabold' : 'tw:text-entry tw:font-semibold')}>
      <span>{sign && <span className="tw:inline-block tw:w-3.5 tw:text-muted-foreground">{sign}</span>}{label}</span>
      <span className={cn('tw:tabular-nums', tone || TONE.text)}>₹ {inr(value, 0)}</span>
    </div>
  );
}

export function Check({ ok, warn, label, value, onClick }) {
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : Clock;
  const tone = ok ? TONE.good : warn ? TONE.bad : 'tw:text-amber-600';
  return (
    <div onClick={onClick} className={cn('tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-border/60 tw:px-1 tw:py-1.75', onClick && 'tw:cursor-pointer tw:hover:bg-page')}>
      <Icon className={cn('tw:size-3.75', tone)} />
      <span className="tw:flex-1 tw:text-[11.5px] tw:font-semibold">{label}</span>
      <span className={cn('tw:text-entry tw:font-extrabold', tone)}>{value}</span>
    </div>
  );
}

export function BarTrack({ percent, barClassName, onClick, title }) {
  return (
    <div className="tw:mt-0.75 tw:h-1.5 tw:rounded-[3px] tw:bg-muted" onClick={onClick} title={title}>
      <div style={{ '--bar-w': `${percent}%` }} className={cn('tw:h-full tw:w-(--bar-w) tw:rounded-[3px]', barClassName)} />
    </div>
  );
}

export function HeadBars({ rows, barClassName, onRow }) {
  if (!rows.length) return <div className="tw:p-4.5 tw:text-center tw:text-entry tw:text-muted-foreground">No entries this year</div>;
  const largest = Math.max(1, ...rows.map((row) => row.amount));
  return (
    <div className="tw:flex tw:flex-col tw:gap-1.75">
      {rows.map((row) => (
        <div key={row.id} onClick={() => onRow(row.id)} className="tw:cursor-pointer" title={row.name}>
          <div className="tw:flex tw:justify-between tw:gap-2 tw:text-[11px]">
            <span className="tw:truncate tw:font-semibold">{row.name}</span>
            <span className="tw:font-bold tw:tabular-nums">{inr(row.amount, 0)}</span>
          </div>
          <BarTrack percent={(row.amount / largest) * 100} barClassName={barClassName} />
        </div>
      ))}
    </div>
  );
}

export function Figure({ label, children, className }) {
  return (
    <div>
      <div className="tw:text-[10.5px] tw:font-bold tw:text-muted-foreground">{label}</div>
      <div className={cn('tw:text-lg tw:font-extrabold', className)}>{children}</div>
    </div>
  );
}

export function Notice({ tone = 'warn', children }) {
  return (
    <div className={cn('tw:rounded-md tw:border tw:px-3 tw:py-2 tw:text-entry', tone === 'warn' ? 'tw:border-amber-200 tw:bg-amber-50 tw:font-semibold tw:text-amber-700' : 'tw:border-blue-200 tw:bg-blue-50 tw:text-[11.5px] tw:text-blue-900')}>
      {children}
    </div>
  );
}
