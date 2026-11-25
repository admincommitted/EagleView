import { Fragment } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui';
import { cn } from '@/lib/utils';
import { Box, Btn, inr } from '../../ui';
import { bandsOf, hasBands, isNumberColumn, plainValue } from '../reportOutput';

const alignOf = (column) => (isNumberColumn(column) ? 'tw:text-right' : 'tw:text-left');
const totalText = (column, sums) => (column.type === 'money' ? inr(sums[column.key]) : sums[column.key]);

function SortHead({ column, sort, onSort, rowSpan }) {
  return (
    <TableHead rowSpan={rowSpan} onClick={() => onSort(column)} className={cn('tw:cursor-pointer tw:select-none', alignOf(column))}>
      <span className="tw:inline-flex tw:items-center tw:gap-0.5">
        {column.label}
        {sort.key === column.key && (sort.dir > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
      </span>
    </TableHead>
  );
}

function HeaderRows({ columns, sort, onSort }) {
  if (!hasBands(columns)) {
    return <TableRow>{columns.map((column) => <SortHead key={column.key} column={column} sort={sort} onSort={onSort} />)}</TableRow>;
  }
  return (
    <>
      <TableRow>
        {bandsOf(columns).map((band, index) => (band.group
          ? <TableHead key={'b' + index} colSpan={band.span} className="tw:text-center">{band.group}</TableHead>
          : <SortHead key={band.column.key} column={band.column} sort={sort} onSort={onSort} rowSpan={2} />))}
      </TableRow>
      <TableRow>{columns.filter((column) => column.group).map((column) => <SortHead key={column.key} column={column} sort={sort} onSort={onSort} />)}</TableRow>
    </>
  );
}

function ReportRow({ row, columns, activeVoucher, onDrill }) {
  const drillable = row._v || row._l;
  return (
    <TableRow data-state={row._v && String(row._v) === String(activeVoucher) ? 'selected' : undefined} onClick={() => onDrill(row)} className={cn(drillable && 'tw:cursor-pointer')}>
      {columns.map((column) => (
        <TableCell key={column.key} className={cn('tw:tabular-nums', alignOf(column), column.type === 'money' || column.type === 'date' ? 'tw:whitespace-nowrap' : 'tw:whitespace-normal')}>
          {plainValue(column, row[column.key])}
        </TableCell>
      ))}
    </TableRow>
  );
}

function GroupHeading({ group, columns, totalKeys, closed, onToggle }) {
  return (
    <TableRow onClick={() => onToggle(group.k)} className="tw:cursor-pointer tw:bg-primary/10 tw:even:bg-primary/10">
      {columns.map((column, index) => (
        <TableCell key={column.key} className={cn('tw:font-extrabold tw:text-head', alignOf(column))}>
          {index === 0
            ? <span className="tw:inline-flex tw:items-center tw:gap-1">{closed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}{group.k} ({group.list.length})</span>
            : totalKeys.includes(column.key) ? totalText(column, group.t) : ''}
        </TableCell>
      ))}
    </TableRow>
  );
}

// the report grid: banded headers, sort by any column, collapsible groups with sub-totals, grand total
export function ReportTable({ report, label }) {
  const { data, shownColumns: columns, rows, groups, totalKeys, totals, cap, closed } = report;
  const rowProps = { columns, activeVoucher: report.drawerVoucher, onDrill: report.drill };
  const title = (data.title ? data.title + ' - ' : '') + (data.subtitle || label);
  return (
    <Box title={title} right={data.note ? <span className="tw:text-[10.5px] tw:font-semibold tw:text-muted-foreground tw:normal-case">{data.note}</span> : null} pad={0}>
      <Table containerClassName="tw:max-h-[calc(100vh-420px)]">
        <TableHeader sticky><HeaderRows columns={columns} sort={report.sort} onSort={report.sortBy} /></TableHeader>
        <TableBody>
          {!groups && rows.slice(0, cap).map((row, index) => <ReportRow key={index} row={row} {...rowProps} />)}
          {groups && groups.map((group) => (
            <Fragment key={group.k}>
              <GroupHeading group={group} columns={columns} totalKeys={totalKeys} closed={closed[group.k]} onToggle={report.toggleGroup} />
              {!closed[group.k] && group.list.slice(0, cap).map((row, index) => <ReportRow key={index} row={row} {...rowProps} />)}
            </Fragment>
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={columns.length || 1} className="tw:py-7 tw:text-center tw:text-muted-foreground">
                {data.rows.length ? 'No row matches the filter' : 'No entries for this period'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {rows.length > 0 && totalKeys.length > 0 && (
          <TableFooter className="tw:sticky tw:bottom-0">
            <TableRow className="tw:bg-primary/10 tw:even:bg-primary/10">
              {columns.map((column, index) => (
                <TableCell key={column.key} className={cn('tw:font-extrabold', alignOf(column))}>
                  {index === 0 ? 'Grand Total (' + rows.length + ')' : totalKeys.includes(column.key) ? totalText(column, totals) : ''}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        )}
      </Table>
      {rows.length > cap && !groups && (
        <div className="tw:flex tw:items-center tw:gap-2.5 tw:p-2 tw:text-[11px] tw:text-muted-foreground tw:normal-case">
          Showing {cap.toLocaleString('en-IN')} of {rows.length.toLocaleString('en-IN')} rows - totals are for all rows; Excel has all of them.
          <Btn kind="ghost" onClick={report.showMore}>Show more</Btn>
        </div>
      )}
    </Box>
  );
}
