// Pieces shared by the Scheme sub-tabs: the summary strip on top, the grid of rows and the note at the foot.
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui';

const TONES = {
  good: 'tw:text-success',
  warn: 'tw:text-warning',
  bad: 'tw:text-destructive',
  muted: 'tw:text-muted-foreground',
};

export function SchemeSummary({ title, actions, children }) {
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-3.5 tw:gap-y-1 tw:border-b tw:border-border tw:bg-page tw:px-3 tw:py-1.5 tw:text-entry">
      <b className="tw:text-head">{title}</b>
      {children}
      {actions && <div className="tw:ml-auto tw:flex tw:flex-wrap tw:items-center tw:gap-2">{actions}</div>}
    </div>
  );
}

export function SummaryNote({ tone, title, children }) {
  return <span className={TONES[tone]} title={title}>{children}</span>;
}

export function SummaryChip({ label, value, tone }) {
  return (
    <span className="tw:inline-flex tw:items-baseline tw:gap-1.5 tw:rounded-full tw:border tw:border-border tw:bg-background tw:px-2.5 tw:py-0.5">
      <span className="tw:text-muted-foreground">{label}</span>
      <b className={cn('tw:text-foreground', TONES[tone])}>{value}</b>
    </span>
  );
}

export function SchemeFootnote({ className, children }) {
  return <div className={cn('tw:border-t tw:border-border tw:bg-page tw:px-3 tw:py-1 tw:text-[11px] tw:text-muted-foreground', className)}>{children}</div>;
}

export function StatusText({ tone, children }) {
  return <span className={cn('tw:font-semibold', TONES[tone])}>{children}</span>;
}

const ALIGN = { left: 'tw:text-left', center: 'tw:text-center', right: 'tw:text-right tw:tabular-nums' };

// The ui DataTable has no total row and no per-row tip, which these grids need.
// columns: [{ key, header, title, align, width (a tw:w-[..] class), className (cells), cell(row, index) }];
// footer: [{ value, colSpan, align, className }]
export function SchemeGrid({ columns, rows, rowKey, rowClassName, rowTitle, emptyText, footer, className, containerClassName }) {
  return (
    <Table className={cn('tw:text-entry', className)} containerClassName={cn('tw:flex-1', containerClassName)}>
      <TableHeader sticky>
        <TableRow className="tw:hover:bg-transparent tw:even:bg-transparent">
          {columns.map((column) => (
            <TableHead key={column.key} title={column.title} className={cn(ALIGN[column.align], column.width)}>{column.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={rowKey(row, index)} className={rowClassName?.(row, index)} title={rowTitle?.(row, index)}>
            {columns.map((column) => (
              <TableCell key={column.key} className={cn(ALIGN[column.align], column.className)}>
                {column.cell(row, index)}
              </TableCell>
            ))}
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow className="tw:hover:bg-transparent">
            <TableCell colSpan={columns.length} className="tw:p-4 tw:text-center tw:text-muted-foreground">{emptyText}</TableCell>
          </TableRow>
        )}
      </TableBody>
      {footer && rows.length > 0 && (
        <TableFooter>
          <TableRow className="tw:hover:bg-transparent">
            {footer.map((cell, index) => (
              <TableCell key={index} colSpan={cell.colSpan} className={cn('tw:font-bold', ALIGN[cell.align], cell.className)}>{cell.value}</TableCell>
            ))}
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}
