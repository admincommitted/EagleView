import { X } from 'lucide-react';
import { Button, ComboInput, DataTable, Input, NumberInput, SelectBox } from '@/components/ui';
import { cn } from '@/lib/utils';
import { inr, pairOptions } from './salesFormat';
import { round2 } from './quoteMath';

const shortSection = (label) => label.replace(' charges', '');
const CELL_BOX = 'tw:text-[11.5px]';

/** The charge lines of a quotation; worked lines carry .w (qty, sell, buy, sellInr, buyInr) from workLine. */
export default function QuoteChargesTable({ lines, deal, meta, editable, chargesByName, onChange, onRemove, rateOf }) {
  const chargeNames = (deal.charges || []).map((charge) => charge.chargeName);
  const sectionOptions = (deal.sections || []).map(([value, label]) => ({ value, label: shortSection(label) }));
  const currencies = ['INR', ...(meta.currencies || []).filter((currency) => currency !== 'INR')];

  const amountBox = (field, width, extra) => (line) => (
    <NumberInput negative className={cn(CELL_BOX, width, extra)} disabled={!editable} value={line[field]} onValueChange={(value) => onChange(line.key, { [field]: value })} />
  );

  const pickHead = (line, text) => {
    const charge = chargesByName.get(text.toUpperCase());
    onChange(line.key, { head: text, chargeId: charge ? charge.id : null, sacCode: charge ? charge.sacCode : null, gstRate: charge ? charge.gstRate : null });
  };

  const columns = [
    {
      key: 'section',
      header: 'Section',
      cell: (line) => <SelectBox className={cn(CELL_BOX, 'tw:w-[92px]')} disabled={!editable} value={line.section || 'OTHER'} onValueChange={(section) => onChange(line.key, { section })} options={sectionOptions} />,
    },
    {
      key: 'head',
      header: 'Charge (GST Charges)',
      cell: (line) => {
        const known = line.chargeId || chargesByName.get(String(line.head || '').toUpperCase());
        return (
          <div className="tw:flex tw:w-[210px] tw:flex-col tw:gap-0.5">
            <ComboInput
              className={CELL_BOX}
              aria-invalid={!known || undefined}
              disabled={!editable}
              options={chargeNames}
              value={line.head || ''}
              onValueChange={(text) => pickHead(line, text)}
              title={line.sacCode ? `SAC ${line.sacCode}, GST ${line.gstRate}%` : 'Pick from the GST Charges list'}
            />
            <Input
              className="tw:text-[10.5px]"
              data-allow-text=""
              disabled={!editable}
              placeholder="note on the print (optional)"
              value={line.remarks || ''}
              onChange={(event) => onChange(line.key, { remarks: event.target.value })}
            />
          </div>
        );
      },
    },
    {
      key: 'basis',
      header: 'Basis',
      cell: (line) => (
        <SelectBox className={cn(CELL_BOX, 'tw:w-[110px]')} disabled={!editable} value={line.basis || 'FLAT'} onValueChange={(basis) => onChange(line.key, { basis, autoQty: true })} options={pairOptions(deal.basis)} />
      ),
    },
    {
      key: 'qty',
      header: 'Qty',
      cell: (line) => (
        <NumberInput
          className={cn(CELL_BOX, 'tw:w-[70px]', line.autoQty && 'tw:bg-primary/5')}
          disabled={!editable}
          title={line.autoQty ? 'From the cargo above - type to fix it' : 'Typed'}
          value={line.autoQty ? line.w.qty : line.qty}
          onValueChange={(qty) => onChange(line.key, { qty, autoQty: false })}
        />
      ),
    },
    {
      key: 'currency',
      header: 'Cur',
      cell: (line) => (
        <SelectBox
          className={cn(CELL_BOX, 'tw:w-[70px]')}
          disabled={!editable}
          value={line.currency || 'INR'}
          onValueChange={(currency) => onChange(line.key, { currency, roe: currency === 'INR' ? 1 : rateOf(currency) })}
          options={currencies}
        />
      ),
    },
    {
      key: 'roe',
      header: 'ROE',
      cell: (line) => (
        <NumberInput
          className={cn(CELL_BOX, 'tw:w-[62px]')}
          disabled={!editable || line.currency === 'INR'}
          value={line.currency === 'INR' ? 1 : line.roe}
          onValueChange={(roe) => onChange(line.key, { roe })}
        />
      ),
    },
    { key: 'buyRate', header: 'Buy rate', cell: amountBox('buyRate', 'tw:w-[72px]') },
    { key: 'minBuy', header: 'Min buy', cell: amountBox('minBuy', 'tw:w-[64px]') },
    { key: 'sellRate', header: 'Sell rate', cell: amountBox('sellRate', 'tw:w-[72px]', 'tw:font-semibold') },
    { key: 'minSell', header: 'Min sell', cell: amountBox('minSell', 'tw:w-[64px]') },
    { key: 'sell', header: 'Sell', align: 'right', cell: (line) => line.w.sell.toLocaleString('en-IN', { maximumFractionDigits: 2 }) },
    { key: 'sellInr', header: 'Sell Rs', align: 'right', cell: (line) => inr(line.w.sellInr) },
    {
      key: 'margin',
      header: 'Margin Rs',
      align: 'right',
      cell: (line) => {
        const margin = round2(line.w.sellInr - line.w.buyInr);
        return <span className={margin < 0 ? 'tw:text-destructive' : undefined}>{inr(margin)}</span>;
      },
    },
    {
      key: 'vendor',
      header: 'Vendor',
      cell: (line) => (
        <Input className={cn(CELL_BOX, 'tw:w-[100px]')} disabled={!editable} placeholder="airline / agent" value={line.vendor || ''} onChange={(event) => onChange(line.key, { vendor: event.target.value })} />
      ),
    },
    {
      key: 'remove',
      header: '',
      cell: (line) => editable && <Button variant="ghost" size="icon-sm" aria-label="Remove line" className="tw:text-destructive" onClick={() => onRemove(line.key)}><X /></Button>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={lines}
      rowKey="key"
      className="tw:min-w-[1080px]"
      emptyText={editable ? 'Add charges with the buttons above (Freight, Origin, Destination, Customs …).' : 'No charges.'}
    />
  );
}
