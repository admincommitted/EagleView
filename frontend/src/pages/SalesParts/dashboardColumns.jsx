import { dmy } from './salesFormat';
import { Muted } from './salesWidgets';
import { Money } from './SalesMoney';

export const growthOf = (current, before) => (before > 0 ? (current - before) / before : null);

export function customerColumn(showKam) {
  return {
    key: 'name',
    header: 'Customer',
    className: 'tw:min-w-[160px] tw:whitespace-normal',
    cell: (row) => (
      <>
        <b className="tw:text-foreground">{row.name}</b>
        {showKam && <Muted className="tw:text-[10.5px]">{row.kam || 'no KAM'}{row.city ? ` · ${row.city}` : ''}</Muted>}
      </>
    ),
  };
}

export const moneyColumn = (key, header) => ({ key, header, align: 'right', cell: (row) => <Money amount={row[key]} /> });

export const lastBillColumn = { key: 'last', header: 'Last bill', align: 'right', cell: (row) => dmy(row.lastBill) };
