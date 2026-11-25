import { Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { moneyWithPaise } from './crmFormat';

function TotalRow({ label, amount, className }) {
  return (
    <div className="tw:flex tw:justify-between tw:gap-2 tw:text-[13px]">
      <span>{label}</span>
      <span className={cn('tw:font-bold tw:tabular-nums', className)}>{moneyWithPaise(amount)}</span>
    </div>
  );
}

export default function ProfitabilityPanel({ totals, ratesNote }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-md tw:border tw:border-input tw:bg-page tw:p-4">
      <h4 className="tw:m-0 tw:mb-1 tw:flex tw:items-center tw:gap-2 tw:text-[13px] tw:font-bold tw:text-foreground">
        <Calculator className="tw:size-4" /> Profitability Analysis (INR)
      </h4>
      <TotalRow label="Total Buy Cost:" amount={totals.buy} className="tw:text-destructive" />
      <TotalRow label="Total Sell Revenue:" amount={totals.sell} className="tw:text-success" />
      <div className="tw:my-1 tw:border-t tw:border-dashed tw:border-input" />
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:text-[13px]">
        <span>Estimated Margin:</span>
        <div className="tw:text-right">
          <div className={cn('tw:text-lg tw:font-black tw:tabular-nums', totals.margin < 0 ? 'tw:text-destructive' : 'tw:text-primary')}>{moneyWithPaise(totals.margin)}</div>
          <div className="tw:text-entry tw:font-bold tw:text-muted-foreground">({totals.pct.toFixed(2)}%)</div>
        </div>
      </div>
      <div className="tw:border-t tw:border-dashed tw:border-input tw:pt-2 tw:text-[11px] tw:text-muted-foreground">
        Converted at the rate shown on each line. {ratesNote}
      </div>
      {totals.missing.length > 0 && (
        <div className="tw:text-entry tw:font-semibold tw:text-destructive">
          No exchange rate for {totals.missing.join(', ')} - those lines are not in the totals. Type the rate, or add it in Accounting Masters.
        </div>
      )}
      {totals.margin < 0 && <div className="tw:text-entry tw:font-semibold tw:text-destructive">This quote sells below cost.</div>}
    </div>
  );
}
