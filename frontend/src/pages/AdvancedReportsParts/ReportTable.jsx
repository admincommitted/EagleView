import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui';

const ALIGN = { left: 'tw:text-left', center: 'tw:text-center', right: 'tw:text-right tw:tabular-nums' };

const cellClassOf = (column, row) => (typeof column.className === 'function' ? column.className(row) : column.className);

/**
 * A report grid: columns [{ key, header, align, className (text or (row) => text), cell(row) }];
 * `footer` is extra TableRow(s) under the rows (totals, notes).
 */
export default function ReportTable({ columns, rows, rowKey, emptyText, footer, className }) {
  return (
    <Table className={cn('tw:min-w-[800px]', className)}>
      <TableHeader>
        <TableRow className="tw:hover:bg-transparent tw:even:bg-transparent">
          {columns.map((column) => (
            <TableHead key={column.key} className={ALIGN[column.align]}>{column.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={rowKey(row, index)}>
            {columns.map((column) => (
              <TableCell key={column.key} className={cn(ALIGN[column.align], cellClassOf(column, row))}>
                {column.cell ? column.cell(row) : row[column.key]}
              </TableCell>
            ))}
          </TableRow>
        ))}
        {!rows.length && emptyText && (
          <TableRow className="tw:hover:bg-transparent">
            <TableCell colSpan={columns.length} className="tw:py-6 tw:text-center tw:whitespace-normal tw:text-muted-foreground">{emptyText}</TableCell>
          </TableRow>
        )}
      </TableBody>
      {footer && <TableFooter>{footer}</TableFooter>}
    </Table>
  );
}
