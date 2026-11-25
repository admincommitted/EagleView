import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui';

const ALIGN = { left: 'tw:text-left', center: 'tw:text-center', right: 'tw:text-right tw:tabular-nums' };

// For statements with opening / closing / total lines around the rows; plain lists use DataTable.
export function ReportTable({ columns, children, footer }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="tw:hover:bg-transparent tw:even:bg-transparent">
          {columns.map((column) => (
            <TableHead key={column.key} className={cn(ALIGN[column.align], column.className)}>{column.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
      {footer && <TableFooter>{footer}</TableFooter>}
    </Table>
  );
}

export function ReportCell({ align, className, ...props }) {
  return <TableCell className={cn(ALIGN[align], className)} {...props} />;
}

// cells: [{ value, className }] after the label, which spans `span` columns
export function TotalsRow({ label, span, cells = [], className, labelClassName }) {
  return (
    <TableRow className={cn('tw:font-bold tw:hover:bg-transparent', className)}>
      <TableCell colSpan={span} className={cn('tw:text-right', labelClassName)}>{label}</TableCell>
      {cells.map((cell, index) => (
        <TableCell key={index} className={cn('tw:text-right tw:tabular-nums', cell.className)}>{cell.value}</TableCell>
      ))}
    </TableRow>
  );
}

export function MessageRow({ span, children, className }) {
  return (
    <TableRow className="tw:hover:bg-transparent">
      <TableCell colSpan={span} className={cn('tw:py-5 tw:text-center tw:text-muted-foreground tw:italic', className)}>{children}</TableCell>
    </TableRow>
  );
}
