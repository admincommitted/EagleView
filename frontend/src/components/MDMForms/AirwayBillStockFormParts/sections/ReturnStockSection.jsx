import { Info, RefreshCw, Save, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, DateInput, Input, SelectBox } from '@/components/ui';
import { ButtonBar, NumberRow, StockField, StockPanel } from './stockParts';

const RETURN_ACTIONS = [{ value: 'VOID', label: 'Voided' }, { value: 'UNUSED', label: 'Unused' }];

const statusTone = (status) => {
  if (status === 'AVAILABLE') return 'tw:text-success';
  if (status === 'USED' || status === 'VOID') return 'tw:text-destructive';
  return 'tw:text-warning';
};

export default function ReturnStockSection({ stock }) {
  const { returning } = stock;

  return (
    <StockPanel title="Return Stock">
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
        <StockField label="Return Date">
          <DateInput value={stock.stockDate} onValueChange={stock.setStockDate} />
        </StockField>
        <StockField label="Status" required>
          <SelectBox options={RETURN_ACTIONS} value={returning.action} onValueChange={returning.setAction} required />
        </StockField>
        <StockField label="AirWayBill No" required className="tw:md:col-span-2">
          <NumberRow>
            <Input required placeholder="AWB NUMBER (11 DIGITS)" className="tw:w-[200px]" value={returning.awb} onChange={(event) => returning.changeAwb(event.target.value)} />
            <Button variant="default" onClick={returning.verify}><Search /> Verify</Button>
            {returning.info && <span className={cn('tw:text-entry tw:font-bold', statusTone(returning.info.status))}>{returning.info.fullAwbNumber}: {returning.info.status}</span>}
          </NumberRow>
        </StockField>
      </div>

      <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-1 tw:rounded-sm tw:border tw:border-primary/30 tw:bg-primary/10 tw:px-3 tw:py-2.5">
        <div className="tw:flex tw:items-center tw:gap-1.5 tw:text-entry tw:font-bold tw:text-head"><Info className="tw:size-3.5" /> Important Stock Rule:</div>
        <div className="tw:pl-5 tw:text-[11px] tw:leading-normal tw:text-head">
          <span className="tw:font-semibold">• Unused (Unallocate):</span> Makes the AWB <b className="tw:text-success">AVAILABLE</b> again for reuse.<br />
          <span className="tw:font-semibold">• Voided:</span> Permanently cancels the AWB. It will <b className="tw:text-destructive">NEVER</b> be available for reuse.
        </div>
      </div>

      <ButtonBar>
        <Button variant="success" size="lg" onClick={returning.save}><Save /> Return Stock</Button>
        <Button variant="default" size="lg" onClick={returning.clear}><RefreshCw /> Clear</Button>
      </ButtonBar>
    </StockPanel>
  );
}
