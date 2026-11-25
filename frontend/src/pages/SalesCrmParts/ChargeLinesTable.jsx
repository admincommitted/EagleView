import { Trash2 } from 'lucide-react';
import { Button, DataTable, Input, NumberInput, SelectBox } from '@/components/ui';
import { isInr, toNumber } from './quoteMath';

const BASES = ['Per TEU', 'Per Cont', 'Per BL', 'Per Kg', 'Flat'];

export default function ChargeLinesTable({ lines, rates, onChangeLine, onRemoveLine }) {
  const currencyOptions = (line) => [...new Set(['INR', ...rates.filter((rate) => rate.code !== 'INR').map((rate) => rate.code), line.currency])];

  const columns = [
    {
      key: 'head',
      header: 'Charge Head',
      cell: (line, index) => (
        <Input data-allow-text="" value={line.head} onChange={(event) => onChangeLine(index, { head: event.target.value })} placeholder="e.g. Ocean Freight" className="tw:min-w-[150px]" />
      ),
    },
    {
      key: 'currency',
      header: 'Curr',
      width: '80px',
      cell: (line, index) => (
        <SelectBox options={currencyOptions(line)} value={line.currency} onValueChange={(currency) => onChangeLine(index, { currency })} className="tw:min-w-[70px]" />
      ),
    },
    {
      key: 'roe',
      header: 'Rate used',
      align: 'right',
      width: '90px',
      cell: (line, index) => {
        const rateMissing = !toNumber(line.roe) && !isInr(line.currency);
        return (
          <>
            <NumberInput value={line.roe} onValueChange={(roe) => onChangeLine(index, { roe })} readOnly={isInr(line.currency)} align="right" aria-invalid={rateMissing} className="tw:min-w-[70px]" />
            {rateMissing && <div className="tw:text-[10px] tw:text-destructive">no rate on file - type one</div>}
          </>
        );
      },
    },
    {
      key: 'buyRate',
      header: 'Procured Rate (Buy)',
      align: 'right',
      cell: (line, index) => (
        <NumberInput value={line.buyRate} onValueChange={(buyRate) => onChangeLine(index, { buyRate })} align="right" className="tw:min-w-[90px] tw:border-destructive/40" />
      ),
    },
    {
      key: 'sellRate',
      header: 'Quote Rate (Sell)',
      align: 'right',
      cell: (line, index) => (
        <NumberInput value={line.sellRate} onValueChange={(sellRate) => onChangeLine(index, { sellRate })} align="right" className="tw:min-w-[90px] tw:border-success/50 tw:font-bold" />
      ),
    },
    {
      key: 'qty',
      header: 'Qty',
      align: 'right',
      width: '70px',
      cell: (line, index) => (
        <NumberInput value={line.qty} onValueChange={(qty) => onChangeLine(index, { qty })} align="right" className="tw:min-w-[55px]" />
      ),
    },
    {
      key: 'basis',
      header: 'Basis',
      cell: (line, index) => (
        <SelectBox options={BASES} value={line.basis} onValueChange={(basis) => onChangeLine(index, { basis })} className="tw:min-w-[90px]" />
      ),
    },
    {
      key: 'remarks',
      header: 'Remarks',
      cell: (line, index) => (
        <Input value={line.remarks} onChange={(event) => onChangeLine(index, { remarks: event.target.value })} className="tw:min-w-[110px]" />
      ),
    },
    {
      key: 'remove',
      header: '',
      align: 'center',
      cell: (line) => (
        <Button variant="ghost" size="icon" aria-label="Remove this charge line" onClick={() => onRemoveLine(line.id)} className="tw:text-destructive">
          <Trash2 />
        </Button>
      ),
    },
  ];

  return <DataTable columns={columns} rows={lines} emptyText="Add at least one charge line." />;
}
