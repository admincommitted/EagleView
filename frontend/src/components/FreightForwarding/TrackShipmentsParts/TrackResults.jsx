import { Bell, ExternalLink, FileSpreadsheet, History, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, CardContent, CardHeader, CardTitle, DataTable } from '@/components/ui';
import { MILESTONES, pageCountOf, pageSlice, shortDateTime, showingText } from '../AirExportParts/airExport';
import { DocTypeBadge, Milestone, PageSizeSelect, Pager, StageText } from '../AirExportParts/widgets';
import { airlineTrackingLink, historyTarget, PAGE_SIZES } from './trackConfig';

const stopRowEvents = { onClick: (event) => event.stopPropagation(), onDoubleClick: (event) => event.stopPropagation() };

function RowLinks({ row, airlines, onHistory }) {
  const link = airlineTrackingLink(row, airlines);
  return (
    <span className="tw:inline-flex tw:items-center tw:gap-2" {...stopRowEvents}>
      <Button variant="ghost" size="icon-sm" title="Status history" className="tw:text-primary" onClick={() => onHistory(historyTarget(row))}><History /></Button>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" title="Airline tracking website" className="tw:text-primary"><ExternalLink className="tw:size-3.5" /></a>
      ) : (
        <span title="Add the tracking link in Masters → Airline" className="tw:text-input"><ExternalLink className="tw:size-3.5" /></span>
      )}
    </span>
  );
}

const MILESTONE_COLUMNS = [
  { key: 'saved', header: 'SAVED' },
  { key: 'submittedToAirline', header: 'SUBMITTED TO AIRLINE' },
  ...MILESTONES.map((milestone) => ({ key: milestone, header: milestone.toUpperCase(), rejected: milestone === 'fna' })),
].map((column) => ({ ...column, align: 'center', cell: (row) => <Milestone value={row[column.key]} rejected={column.rejected} withTime /> }));

const trackColumns = (airlines, onHistory) => [
  { key: 'documentType', header: 'DOCUMENT TYPE', align: 'center', cell: (row) => <DocTypeBadge type={row.documentType} /> },
  { key: 'awbNumber', header: 'AWB/MASTER AWB NUMBER', align: 'center', className: 'tw:font-bold' },
  { key: 'hawbNumber', header: 'HOUSE WAYBILL NUMBER', align: 'center', cell: (row) => row.hawbNumber || '-' },
  { key: 'stage', header: 'STATUS', align: 'center', cell: (row) => <StageText stage={row.stage} /> },
  ...MILESTONE_COLUMNS,
  { key: 'origin', header: 'ORIGIN', align: 'center', cell: (row) => row.origin || '-' },
  { key: 'destination', header: 'DESTINATION', align: 'center', cell: (row) => row.destination || '-' },
  { key: 'flight', header: 'FLIGHT', align: 'center', cell: (row) => row.flight || '-' },
  { key: 'departureDate', header: 'DEPARTURE', align: 'center', cell: (row) => (row.departureDate ? shortDateTime(row.departureDate) : '-') },
  { key: 'shipperName', header: 'SHIPPER', align: 'center', className: 'tw:max-w-[180px] tw:truncate', cell: (row) => <span title={row.shipperName || ''}>{row.shipperName || '-'}</span> },
  { key: 'links', header: 'LINKS', align: 'center', cell: (row) => <RowLinks row={row} airlines={airlines} onHistory={onHistory} /> },
];

export default function TrackResults({ tracking, onHistory, onOpenRow, onExcel, onCustomerUpdates }) {
  const { rows, airlines, loading, page, pageSize, polling, pollMessage } = tracking;

  return (
    <Card>
      <CardHeader className="tw:border-b tw:border-border tw:py-2">
        <CardTitle className="tw:text-[15px] tw:uppercase">SEARCH RESULT</CardTitle>
      </CardHeader>
      <CardContent className="tw:gap-3 tw:px-4 tw:pt-3">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:text-entry">
          <span className="tw:mr-auto tw:text-muted-foreground">
            {rows.length} records · refreshes every 15 seconds · click a row for its history, double-click to open the AWB
          </span>
          <Button variant="success" disabled={polling} title="Ask the airline mailbox for new status (FSU) now" onClick={tracking.fetchStatusNow}>
            <RefreshCw className={cn(polling && 'tw:animate-spin')} /> {polling ? 'Fetching...' : 'Fetch status now'}
          </Button>
          <Button variant="success" disabled={!rows.length} onClick={onExcel}><FileSpreadsheet /> Excel</Button>
          <Button variant="default" title="Automatic email / WhatsApp to customers on milestones" onClick={onCustomerUpdates}><Bell /> Customer updates</Button>
          <PageSizeSelect value={pageSize} sizes={PAGE_SIZES} onValueChange={tracking.changePageSize} />
        </div>

        {pollMessage && <div className={cn('tw:text-entry', pollMessage.startsWith('Error') ? 'tw:text-destructive' : 'tw:text-success')}>{pollMessage}</div>}

        <DataTable
          columns={trackColumns(airlines, onHistory)}
          rows={loading ? [] : pageSlice(rows, page, pageSize)}
          rowKey={(row) => row.type + row.id}
          rowTitle="Click: history · Double-click: open AWB"
          onRowClick={(row) => onHistory(historyTarget(row))}
          onRowDoubleClick={onOpenRow}
          emptyText={loading ? 'Loading tracking data...' : 'NO TRACKING DATA FOUND'}
          containerClassName="tw:rounded-lg tw:border tw:border-border"
        />

        {rows.length > 0 && (
          <Pager page={page} pageCount={pageCountOf(rows.length, pageSize)} onPageChange={tracking.setPage} summary={showingText(page, pageSize, rows.length)} />
        )}
      </CardContent>
    </Card>
  );
}
