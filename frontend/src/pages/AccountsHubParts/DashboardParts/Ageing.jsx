import { useState } from 'react';
import { cn } from '@/lib/utils';
import { inr } from '../ui';
import { TONE, linkText, shortAmount } from './format';
import { MiniTable } from './widgets';

const BUCKET_NAMES = ['0-30', '31-60', '61-90', '91-180', '180+'];
const BUCKET_COLORS = ['tw:bg-emerald-500', 'tw:bg-lime-500', 'tw:bg-amber-500', 'tw:bg-orange-500', 'tw:bg-red-600'];
const PARTIES_SHOWN = 6;
const NO_BUCKET = -1;

function Headline({ label, children, className }) {
  return (
    <div>
      <div className="tw:text-[10.5px] tw:font-bold tw:text-muted-foreground">{label}</div>
      <div className={cn('tw:tabular-nums', className)}>{children}</div>
    </div>
  );
}

// receivable / payable ageing: one headline figure, one bar split by age (click a part to filter), the largest parties
export function Ageing({ side, data, onParty, onReport }) {
  const [bucket, setBucket] = useState(NO_BUCKET);
  const total = data.total || 0;
  const percentOf = (amount) => (total ? Math.round((amount / total) * 100) : 0);
  const toggleBucket = (index) => setBucket(bucket === index ? NO_BUCKET : index);
  const dimmed = (index) => bucket !== NO_BUCKET && bucket !== index;
  const parties = (data.parties || data.top || []).filter((party) => bucket === NO_BUCKET || (party.buckets && party.buckets[bucket] > 0.005));
  const amountOf = (party) => (bucket === NO_BUCKET ? party.balance : party.buckets[bucket]);
  const firstColumn = bucket === NO_BUCKET ? 'Largest ' + (side === 'Dr' ? 'debtors' : 'creditors') : BUCKET_NAMES[bucket] + ' days';

  return (
    <div className="tw:flex tw:flex-col tw:gap-3.5 tw:px-1 tw:py-0.5">
      <div className="tw:flex tw:flex-wrap tw:items-end tw:gap-7">
        <Headline label="Outstanding" className="tw:text-2xl tw:leading-tight tw:font-extrabold tw:text-slate-900">₹ {inr(total, 0)}</Headline>
        <Headline label="Overdue" className={cn('tw:text-[15px] tw:font-extrabold', data.overdue ? TONE.expense : TONE.text)}>
          ₹ {inr(data.overdue, 0)} <span className="tw:text-[11px] tw:font-semibold tw:text-muted-foreground">{data.overduePct || 0}%</span>
        </Headline>
        <Headline label="Average age" className="tw:text-[15px] tw:font-extrabold">{data.avgDays || 0} days</Headline>
      </div>

      <div>
        <div className={cn('tw:flex tw:h-2.5 tw:overflow-hidden tw:rounded-[5px] tw:bg-muted', total && 'tw:gap-0.5')}>
          {data.buckets.map((ageBucket, index) => ageBucket.amount > 0 && (
            <div
              key={ageBucket.bucket}
              title={ageBucket.bucket + ' days: ₹ ' + inr(ageBucket.amount, 0) + ' (' + percentOf(ageBucket.amount) + '%)'}
              onClick={() => toggleBucket(index)}
              style={{ '--segment-w': `${percentOf(ageBucket.amount)}%` }}
              className={cn('tw:w-(--segment-w) tw:min-w-0.75 tw:cursor-pointer tw:transition-opacity', BUCKET_COLORS[index], dimmed(index) && 'tw:opacity-25')}
            />
          ))}
        </div>
        <div className="tw:mt-2.5 tw:flex tw:flex-wrap tw:justify-between tw:gap-1.5">
          {data.buckets.map((ageBucket, index) => (
            <div key={ageBucket.bucket} onClick={() => toggleBucket(index)} className={cn('tw:min-w-0 tw:cursor-pointer', dimmed(index) && 'tw:opacity-45')}>
              <div className="tw:flex tw:items-center tw:gap-1.25 tw:text-[10.5px] tw:font-semibold tw:text-muted-foreground">
                <span className={cn('tw:size-1.75 tw:rounded-full', BUCKET_COLORS[index])} />{ageBucket.bucket} days
              </div>
              <div className="tw:mt-px tw:text-[12.5px] tw:font-bold tw:text-slate-900 tw:tabular-nums">{shortAmount(ageBucket.amount)}</div>
            </div>
          ))}
        </div>
      </div>

      <MiniTable
        rows={parties.slice(0, PARTIES_SHOWN)}
        rowKey={(party) => party.id}
        onRow={(party) => onParty(party.id)}
        empty="Nothing outstanding"
        columns={[
          { header: firstColumn, cell: (party) => party.name, maxWidth: 230 },
          { header: 'Amount', right: true, bold: true, cell: (party) => inr(amountOf(party), 0) },
          { header: 'Overdue', right: true, cell: (party) => (party.overdue > 0.005 ? inr(party.overdue, 0) : '-'), tone: (party) => (party.overdue > 0.005 ? TONE.expense : TONE.muted) },
          { header: 'Oldest', right: true, cell: (party) => party.oldestDays + ' days', tone: () => TONE.muted },
        ]}
      />
      <div className="tw:flex tw:items-center tw:justify-between tw:text-[11px]">
        <span className="tw:text-muted-foreground">
          {bucket !== NO_BUCKET
            ? <span onClick={() => setBucket(NO_BUCKET)} className="tw:cursor-pointer tw:font-semibold tw:text-primary">Show all ages</span>
            : data.count + ' parties' + (data.advances ? ', advances ₹ ' + inr(data.advances, 0) : '')}
        </span>
        <span onClick={onReport} className={linkText}>View all {parties.length > PARTIES_SHOWN ? parties.length + ' ' : ''}parties</span>
      </div>
    </div>
  );
}
