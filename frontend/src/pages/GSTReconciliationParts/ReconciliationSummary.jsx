import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';

const TONE_CLASS = {
  success: { bar: 'tw:border-l-success', text: 'tw:text-success' },
  warning: { bar: 'tw:border-l-warning', text: 'tw:text-warning' },
  danger: { bar: 'tw:border-l-destructive', text: 'tw:text-destructive' },
  primary: { bar: 'tw:border-l-primary', text: 'tw:text-primary' },
};

const SUMMARY_CARDS = [
  { key: 'matched', label: 'Perfect Match', note: 'Invoices claimable for ITC', tone: 'success' },
  { key: 'mismatched', label: 'Mismatched Amounts', note: 'Values differ between Portal & Books', tone: 'warning' },
  { key: 'missingOnPortal', label: 'Missing on Portal', note: 'In your books, not in GSTR-2B - vendor has not filed', tone: 'danger', zeroWhenEmpty: true },
  { key: 'missingInBooks', label: 'Missing in Books', note: 'On the portal, no purchase voucher entered', tone: 'primary', zeroWhenEmpty: true },
];

export default function ReconciliationSummary({ summary }) {
  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2 tw:lg:grid-cols-4 tw:lg:gap-5">
      {SUMMARY_CARDS.map((card) => {
        const tone = TONE_CLASS[card.tone];
        return (
          <Card key={card.key} className={cn('tw:gap-2 tw:border-l-4 tw:p-5', tone.bar)}>
            <div className="tw:text-[13px] tw:font-bold tw:uppercase tw:text-muted-foreground">{card.label}</div>
            <div className={cn('tw:text-[28px] tw:font-black tw:leading-none', tone.text)}>
              {card.zeroWhenEmpty ? summary[card.key] || 0 : summary[card.key]}
            </div>
            <div className={cn('tw:text-[11px] tw:normal-case', tone.text)}>{card.note}</div>
          </Card>
        );
      })}
    </div>
  );
}
