import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { crore, inr } from './salesFormat';

const percentText = (growth) => `${growth >= 0 ? '+' : ''}${Math.round(growth * 100)}%`;

/** Growth against last year as a green / red arrow and percentage. */
export function Delta({ growth, suffix }) {
  if (growth == null) return <span className="tw:text-muted-foreground">no billing then</span>;
  const up = growth >= 0;
  const Arrow = up ? TrendingUp : TrendingDown;
  return (
    <span>
      <span className={cn('tw:inline-flex tw:items-center tw:gap-0.5 tw:font-bold tw:whitespace-nowrap', up ? 'tw:text-success' : 'tw:text-destructive')}>
        <Arrow className="tw:size-3" /> {growth > 9.99 ? '10x+' : percentText(growth)}
      </span>
      {suffix && <span className="tw:text-muted-foreground"> {suffix}</span>}
    </span>
  );
}

/** An amount in lakh / crore, the full rupees on hover. */
export function Money({ amount }) {
  return <span title={inr(amount)}>{crore(amount)}</span>;
}
