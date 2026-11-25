import { Button, Checkbox } from '@/components/ui';
import { cn } from '@/lib/utils';
import DetailCard from './DetailCard';

export default function CodesCard({ codes, form, open, suggested, onToggle, onUseSuggested }) {
  const canSuggest = open && suggested.length > 0 && suggested.join() !== form.codes.join();
  return (
    <DetailCard
      title="Amendment codes"
      actions={canSuggest && <Button size="sm" onClick={onUseSuggested}>Use suggested ({suggested.join(', ')})</Button>}
    >
      <div className="tw:grid tw:grid-cols-1 tw:gap-x-3 tw:gap-y-0.5 tw:md:grid-cols-2 tw:xl:grid-cols-3">
        {codes.map((code) => {
          const ticked = form.codes.includes(code.code);
          return (
            <label
              key={code.code}
              className={cn('tw:flex tw:min-w-0 tw:items-center tw:gap-1.5 tw:py-0.5', open ? 'tw:cursor-pointer' : 'tw:cursor-default', ticked ? 'tw:text-foreground' : 'tw:text-muted-foreground')}
            >
              <Checkbox disabled={!open} checked={ticked} onCheckedChange={() => onToggle(code.code)} />
              <b className="tw:w-[70px] tw:shrink-0">{code.code}</b>
              <span className="tw:truncate" title={code.label}>{code.label}</span>
              {suggested.includes(code.code) && <span className="tw:text-[10px] tw:font-bold tw:text-success">suggested</span>}
              {!code.seenInIcaffe && ticked && (
                <span title="Not yet seen in an iCAFFE amendment - check the ICEGATE reply" className="tw:text-[10px] tw:text-warning">check reply</span>
              )}
            </label>
          );
        })}
      </div>
    </DetailCard>
  );
}
