import { Plus } from 'lucide-react';
import { Button, DataTable } from '@/components/ui';
import Notice from '../PurchaseParts/Notice';

/** One rate tab: the explanation strip, the editable grid and its "add a line" button. */
export default function RateGrid({ intro, tone, columns, rows, addLabel, onAdd, tableClassName }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:p-3 tw:md:p-5">
      <Notice tone={tone}>{intro}</Notice>
      <DataTable columns={columns} rows={rows} stickyHeader={false} className={tableClassName} emptyText="No lines - add one below" />
      <div>
        <Button onClick={onAdd}><Plus /> {addLabel}</Button>
      </div>
    </div>
  );
}
