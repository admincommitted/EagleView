import { RefreshCw, Save, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, DataTable, Input } from '@/components/ui';

// big masters (tariff, RSP ...) have thousands of rows: only this many are drawn, the search box finds the rest
const SHOWN_ROWS = 300;

function ShownRowsNote({ shown, total }) {
  if (shown >= total) return null;
  return <div className="tw:px-3 tw:py-2 tw:text-center tw:text-[11px] tw:text-muted-foreground">{shown} of {total} shown - type in the search box to narrow the list</div>;
}

function RecordList({ title, icon: Icon, records, total, search, onSearch, searchPlaceholder, selectedId, recordKey, onPick, primaryText, secondaryText }) {
  return (
    <Card className="tw:flex tw:max-h-[40vh] tw:flex-col tw:gap-0 tw:overflow-hidden tw:p-0 tw:lg:max-h-none tw:lg:w-[300px] tw:lg:shrink-0">
      <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border tw:p-3">
        <h3 className="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:text-[13px] tw:font-bold tw:tracking-[0.5px] tw:text-head tw:uppercase">
          <Search className="tw:size-4 tw:text-primary" /> {title} ({total})
        </h3>
        <Input leftIcon={Search} placeholder={searchPlaceholder} value={search} onChange={(event) => onSearch(event.target.value)} data-allow-text="" />
      </div>
      <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto">
        {records.map((record) => {
          const key = record[recordKey];
          const selected = selectedId != null && selectedId !== '' && String(selectedId) === String(key);
          return (
            <Button key={key} variant="ghost" size="block" onClick={() => onPick(record)}
              className={cn('tw:gap-3 tw:rounded-none tw:border-0 tw:border-b tw:border-l-4 tw:border-b-border tw:border-l-transparent tw:py-2.5', selected && 'tw:border-l-primary tw:bg-accent')}>
              <span className={cn('tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-md tw:bg-secondary tw:text-muted-foreground', selected && 'tw:bg-primary tw:text-primary-foreground')}>
                <Icon className="tw:size-4" />
              </span>
              <span className="tw:flex tw:min-w-0 tw:flex-col">
                <span className={cn('tw:truncate tw:text-entry tw:font-semibold', selected && 'tw:font-bold tw:text-primary')}>{primaryText(record)}</span>
                {secondaryText && <span className="tw:truncate tw:text-[10px] tw:font-bold tw:text-muted-foreground">{secondaryText(record)}</span>}
              </span>
            </Button>
          );
        })}
        {records.length === 0 && <div className="tw:p-8 tw:text-center tw:text-entry tw:text-muted-foreground">No records found.</div>}
        <ShownRowsNote shown={records.length} total={total} />
      </div>
    </Card>
  );
}

/**
 * A plain master screen: searchable list on the left (top on a phone), the add / edit form and the grid on the right.
 *   master       - what useMasterRecords returns (or an object with the same keys)
 *   list         - { title, icon, searchPlaceholder, primaryText(record), secondaryText(record) }
 *   formTitle    - heading of the form panel; icon - its icon
 *   columns      - DataTable columns of the grid (add activeColumn / masterActionsColumn as needed)
 *   actions      - extra buttons beside Save / Clear
 *   saveLabel    - text of the save button (default 'Save')
 *   rowClassName - (record) => classes of a grid row (e.g. dimRowWhenInactive)
 *   belowGrid    - shown under the grid (notes, totals)
 *   children     - the form fields
 */
export function MasterPage({
  master, list, formTitle, icon: Icon, columns, actions, saveLabel = 'Save', rowClassName, belowGrid, emptyText = 'No records found.', className, children,
}) {
  const recordKey = master.recordKey || 'id';
  const selectedKey = master.selectedKey ?? master.form?.[recordKey];
  const shownRows = master.filtered.slice(0, SHOWN_ROWS);
  return (
    <div className={cn('tw:flex tw:flex-col tw:gap-4 tw:normal-case tw:lg:h-full tw:lg:min-h-0 tw:lg:flex-row', className)}>
      <RecordList {...list} icon={list.icon || Icon} records={shownRows} total={master.filtered.length} search={master.search}
        onSearch={master.setSearch} selectedId={selectedKey} recordKey={recordKey} onPick={master.editRecord} />

      <Card className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-4 tw:p-4 tw:md:p-6 tw:lg:overflow-y-auto">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
          <h3 className="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:text-[15px] tw:font-bold tw:tracking-[0.5px] tw:text-head tw:uppercase">
            <span className="tw:h-[18px] tw:w-2 tw:rounded tw:bg-primary" />
            {Icon && <Icon className="tw:size-5 tw:text-primary" />} {formTitle}
          </h3>
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            {actions}
            <Button variant="default" size="lg" disabled={master.saving} onClick={master.save}><Save /> {saveLabel}</Button>
            <Button size="lg" onClick={master.clearForm}><RefreshCw /> Clear</Button>
          </div>
        </div>

        <div className="tw:rounded-lg tw:border tw:border-border tw:bg-page tw:p-4">{children}</div>

        <DataTable columns={columns} rows={shownRows} rowKey={recordKey} selectedKey={selectedKey} onRowClick={master.editRecord}
          rowClassName={rowClassName} emptyText={emptyText} containerClassName="tw:rounded-lg tw:border tw:border-border" />
        <ShownRowsNote shown={shownRows.length} total={master.filtered.length} />
        {belowGrid}
      </Card>
    </div>
  );
}
