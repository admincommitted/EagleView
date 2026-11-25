import { ArrowDown, ArrowUp, Ban, Copy, FileSpreadsheet, History, Pencil, Printer, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, CardHeader, CardTitle, DataTable } from '@/components/ui';
import { DocTypeBadge, PageSizeSelect, Pager, StageText } from '../AirExportParts/widgets';
import { showingText } from '../AirExportParts/airExport';
import { awbRowKey, PAGE_SIZES, totalsOf } from './searchConfig';

const stopRowEvents = { onClick: (event) => event.stopPropagation(), onDoubleClick: (event) => event.stopPropagation() };

function SortHeader({ label, sortKey, sort, onSort }) {
  const Arrow = sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <Button variant="header" size="sm" title="Click to sort" className="tw:px-0 tw:font-bold" onClick={() => onSort(sortKey)}>
      {label}{sort.key === sortKey && <Arrow className="tw:size-2.5" />}
    </Button>
  );
}

function RowActions({ row, busy, onOpen, onPrint, onDuplicate, onHistory, onVoid }) {
  const actions = [
    { title: 'Open / edit', icon: Pencil, onClick: onOpen, variant: 'default' },
    { title: 'Print AWB', icon: Printer, onClick: onPrint },
    { title: 'Duplicate', icon: Copy, onClick: onDuplicate, disabled: Boolean(busy) },
    { title: 'Status history and log', icon: History, onClick: onHistory, disabled: !row.awbNo },
    { title: 'Void', icon: Ban, onClick: onVoid, disabled: Boolean(busy), variant: 'destructive' },
  ];
  return (
    <span className="tw:inline-flex tw:gap-1" {...stopRowEvents}>
      {actions.map((action) => (
        <Button key={action.title} size="icon-sm" variant={action.variant} title={action.title} disabled={action.disabled} onClick={() => action.onClick(row)}>
          <action.icon className="tw:size-3" />
        </Button>
      ))}
    </span>
  );
}

const SORTABLE_COLUMNS = [
  { key: 'type', label: 'TYPE', align: 'center', cell: (row) => <DocTypeBadge type={row.type} /> },
  { key: 'stage', label: 'STATUS', cell: (row) => <StageText stage={row.stage} short /> },
  { key: 'flight', label: 'FLIGHT', cell: (row) => <span title={row.flightDate || ''}>{row.flight ? `${row.flight}${row.flightDate ? ` / ${String(row.flightDate).slice(0, 10)}` : ''}` : '-'}</span> },
  { key: 'createdAt', label: 'AWB DT.', cell: (row) => row.awbDate },
  { key: 'awbNo', label: 'AWB NO', link: 'awb' },
  { key: 'hawbNo', label: 'HAWB NO', link: 'hawb' },
  { key: 'shipper', label: 'SHIPPER' },
  { key: 'consignee', label: 'CONSIGNEE' },
  { key: 'dstn', label: 'DSTN' },
  { key: 'pc', label: 'P/C' },
  { key: 'pkgs', label: 'PKGS' },
  { key: 'grWt', label: 'GR.WT' },
  { key: 'chgWt', label: 'CHG.WT' },
  { key: 'totalFreight', label: 'TOTAL FREIGHT', cell: (row) => `${row.totalFreight}${row.currency ? ` ${row.currency}` : ''}` },
  { key: 'subagt', label: 'SUBAGT' },
  { key: 'tieup', label: 'TIEUP' },
  { key: 'routingStatus', label: 'ROUTING STATUS' },
  { key: 'cargoType', label: 'CARGO TYPE DESCRIPTION' },
  { key: 'remarks', label: 'REMARKS' },
];

function resultColumns({ sort, onSort, onOpenNumber, actionProps }) {
  const linkCell = (kind) => (row) => {
    const number = kind === 'hawb' ? row.hawbNo : row.awbNo;
    if (!number) return null;
    return (
      <span {...stopRowEvents}>
        <Button variant="link" size="sm" className="tw:font-bold tw:underline" onClick={() => onOpenNumber(kind, row)}>{number}</Button>
      </span>
    );
  };
  return [
    { key: 'actions', header: 'ACTIONS', align: 'center', cell: (row) => <RowActions row={row} {...actionProps} /> },
    ...SORTABLE_COLUMNS.map((column) => ({
      key: column.key,
      align: column.align || 'center',
      header: <SortHeader label={column.label} sortKey={column.key} sort={sort} onSort={onSort} />,
      cell: column.link ? linkCell(column.link) : column.cell,
    })),
  ];
}

function BulkBar({ pickedCount, busy, isBulkBusy, onPrint, onExcel, onSendFwb, onSendFhl, onClearPicks, pageSize, onPageSizeChange }) {
  const disabled = Boolean(busy);
  return (
    <div className={cn('tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:border-b tw:border-border tw:px-3 tw:py-1.5 tw:text-entry', pickedCount && 'tw:bg-primary/10')}>
      <b>{pickedCount ? `${pickedCount} ticked` : 'Tick rows to work on several at once'}</b>
      {pickedCount > 0 && (
        <>
          <Button size="sm" disabled={disabled} onClick={onPrint}><Printer /> Print ticked</Button>
          <Button size="sm" variant="success" disabled={disabled} onClick={onExcel}><FileSpreadsheet /> Excel ticked</Button>
          <Button size="sm" variant="default" disabled={disabled} onClick={onSendFwb}><Send /> Send FWB</Button>
          <Button size="sm" variant="default" disabled={disabled} onClick={onSendFhl}><Send /> Send FHL</Button>
          <Button size="sm" variant="secondary" disabled={disabled} onClick={onClearPicks}>Clear ticks</Button>
        </>
      )}
      {isBulkBusy && <span className="tw:text-primary">Sending, please wait...</span>}
      <span className="tw:ml-auto"><PageSizeSelect value={pageSize} sizes={PAGE_SIZES} onValueChange={onPageSizeChange} /></span>
    </div>
  );
}

function SendResults({ results, onClose }) {
  const sentCount = results.filter((result) => result.ok).length;
  return (
    <div className="tw:border-b tw:border-border tw:bg-page tw:px-3 tw:py-2 tw:text-entry">
      <div className="tw:flex tw:items-center tw:justify-between">
        <b>Send result: {sentCount} sent, {results.length - sentCount} failed</b>
        <Button variant="ghost" size="sm" onClick={onClose}><X /> close</Button>
      </div>
      {results.map((result, index) => (
        <div key={index} className={result.ok ? 'tw:text-success' : 'tw:text-destructive'}>{result.ok ? '✓' : '✕'} {result.no} - {result.text}</div>
      ))}
    </div>
  );
}

export default function SearchResults({ search, actions, onPrint, onExcel, onOpenRow, onOpenNumber, onHistory }) {
  const { rows, sorted, pageRows, pickedRows, picked, message, loading } = search;
  const totals = totalsOf(rows);
  const columns = resultColumns({
    sort: search.sort,
    onSort: search.sortBy,
    onOpenNumber,
    actionProps: {
      busy: actions.busy,
      onOpen: onOpenRow,
      onPrint: (row) => onOpenRow(row, { autoPrint: true }),
      onDuplicate: actions.duplicateRow,
      onHistory,
      onVoid: actions.voidRow,
    },
  });

  return (
    <Card className="tw:overflow-hidden">
      <CardHeader className="tw:flex-wrap tw:border-b tw:border-border tw:py-2">
        <CardTitle className="tw:text-[15px] tw:uppercase">
          SEARCH RESULTS - TOTAL AWB: {rows.length}
          {message && <span className="tw:ml-2.5 tw:text-entry tw:normal-case tw:text-destructive">{message}</span>}
        </CardTitle>
        {rows.length > 0 && (
          <span className="tw:text-entry tw:font-semibold tw:normal-case">
            PKGS {totals.pkgs} · GR.WT {totals.gr.toFixed(2)} · CHG.WT {totals.chg.toFixed(2)} kg
          </span>
        )}
      </CardHeader>

      {rows.length > 0 && (
        <BulkBar
          pickedCount={pickedRows.length}
          busy={actions.busy}
          isBulkBusy={actions.isBulkBusy}
          onPrint={onPrint}
          onExcel={onExcel}
          onSendFwb={() => actions.sendFwb(pickedRows)}
          onSendFhl={() => actions.sendFhl(pickedRows)}
          onClearPicks={search.clearPicks}
          pageSize={search.pageSize}
          onPageSizeChange={search.changePageSize}
        />
      )}
      {actions.results && <SendResults results={actions.results} onClose={actions.clearResults} />}

      <DataTable
        columns={columns}
        rows={loading ? [] : pageRows}
        rowKey={awbRowKey}
        selectedKey={search.selectedKey}
        onRowClick={(row) => search.setSelectedKey(awbRowKey(row))}
        onRowDoubleClick={(row) => onOpenRow(row)}
        rowClassName={(row) => cn(picked.has(awbRowKey(row)) && 'tw:bg-primary/10 tw:even:bg-primary/10', actions.busy === awbRowKey(row) && 'tw:opacity-50')}
        selection={{
          keys: pageRows.map(awbRowKey).filter((key) => picked.has(key)),
          onToggle: search.togglePick,
          onToggleAll: search.togglePage,
        }}
        emptyText={loading ? 'Loading...' : 'No records found.'}
        containerClassName="tw:max-h-[520px]"
      />

      {rows.length > search.pageSize && (
        <Pager
          className="tw:px-3 tw:py-2"
          page={search.page}
          pageCount={search.pageCount}
          onPageChange={search.setPage}
          summary={showingText(search.page, search.pageSize, sorted.length)}
        />
      )}
    </Card>
  );
}
