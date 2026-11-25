import { cn } from '@/lib/utils';
import { Button, DataTable, DateInput, Field, SelectBox } from '@/components/ui';

const STATUS_FILTERS = ['ALL', 'AVAILABLE', 'ALLOCATED', 'USED', 'VOID'];

const statusTone = (status) => {
  if (status === 'AVAILABLE') return 'tw:text-success';
  if (status === 'VOID') return 'tw:text-destructive';
  if (status === 'USED') return 'tw:text-muted-foreground';
  return 'tw:text-warning';
};

const stockDay = (row) => (row.stockDate || row.createdAt ? String(row.stockDate || row.createdAt).substring(0, 10) : '');

// the stock list of the open tab (HAWB stock on the HAWB tab, AWB stock on the others)
export default function QueryDetailSection({ stock }) {
  const { query, isHawb } = stock;

  const columns = [
    { key: 'date', header: 'Date', cell: stockDay },
    { key: 'status', header: 'Status', cell: (row) => <span className={cn('tw:font-bold', statusTone(row.status))}>{row.status}</span> },
    { key: 'number', header: isHawb ? 'HAWB No' : 'AWB No', cell: (row) => (isHawb ? row.fullHawbNumber : row.fullAwbNumber) },
    { key: 'sequenceNumber', header: 'Stock No' },
    { key: 'owner', header: isHawb ? 'Prefix' : 'Airline', cell: (row) => (isHawb ? row.prefix || '' : row.airlinePrefix || '') },
    { key: 'party', header: isHawb ? 'Party Name' : 'IATA Name', cell: (row) => (isHawb ? row.partyName || row.party?.name || '' : '') },
  ];

  return (
    <div className="tw:mt-4 tw:overflow-hidden tw:rounded-sm tw:border tw:border-border tw:bg-card">
      <div className="tw:border-b tw:border-border tw:bg-page tw:px-4 tw:py-2 tw:text-[13px] tw:font-bold">QUERY DETAIL</div>
      <div className="tw:flex tw:flex-col tw:gap-3 tw:px-4 tw:py-3">
        <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-end tw:md:gap-4">
          <Field label="From Date" layout="col" labelClassName="tw:font-bold tw:uppercase">
            <DateInput value={query.fromDate} onValueChange={query.setFromDate} />
          </Field>
          <Field label="To Date" layout="col" labelClassName="tw:font-bold tw:uppercase">
            <DateInput value={query.toDate} onValueChange={query.setToDate} />
          </Field>
          <Field label="Status" layout="col" labelClassName="tw:font-bold tw:uppercase" className="tw:md:w-[130px]">
            <SelectBox options={STATUS_FILTERS} value={query.filterStatus} onValueChange={query.setFilterStatus} />
          </Field>
          <div className="tw:flex tw:flex-wrap tw:gap-2 tw:md:ml-auto">
            <Button variant="warning" size="lg" onClick={() => stock.changeStock('unallocate', 'unallocate')}>
              Unallocate{query.selectedIds.length ? ` (${query.selectedIds.length})` : ''}
            </Button>
            <Button variant="default" size="lg" onClick={query.load}>Query</Button>
          </div>
        </div>

        <DataTable columns={columns} rows={query.rows} emptyText="No data found" containerClassName="tw:rounded-sm tw:border tw:border-border"
          selection={{ keys: query.selectedIds, onToggle: query.toggleId, onToggleAll: (checked) => query.toggleAllIds(checked === true) }} />
      </div>
    </div>
  );
}
