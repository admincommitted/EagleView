import { cn } from '@/lib/utils';
import { ComboInput } from '@/components/ui';

const findGstCharge = (gstCharges, name) =>
  gstCharges.find((charge) => String(charge.name).toUpperCase() === String(name || '').trim().toUpperCase());

const gstRateText = (charge) => (charge.exempt ? 'exempt' : `${charge.gstRate ?? 18}%`);

/** A charge name picked from Accounts > GST Charges (its SAC and GST % print under the box). */
export default function GstChargeInput({ gstCharges, value, onChange, placeholder }) {
  const match = findGstCharge(gstCharges, value);
  const unknown = Boolean(value && gstCharges.length && !match);

  return (
    <div className="tw:flex tw:min-w-[190px] tw:flex-col tw:gap-0.5">
      <ComboInput
        options={gstCharges}
        value={value || ''}
        placeholder={placeholder || 'Pick GST charge'}
        getValue={(charge) => charge.name}
        getLabel={(charge) => `${charge.sac || ''} | ${gstRateText(charge)}`}
        aria-invalid={unknown || undefined}
        onValueChange={onChange}
        onBlur={(event) => {
          const typed = findGstCharge(gstCharges, event.target.value);
          if (typed && typed.name !== event.target.value) onChange(typed.name);
        }}
      />
      <div className={cn('tw:min-h-3 tw:text-[10px] tw:normal-case', unknown ? 'tw:text-destructive' : 'tw:text-muted-foreground')}>
        {unknown ? 'Not in Accounts GST Charges' : match ? `SAC ${match.sac || '-'} | GST ${gstRateText(match)}` : ''}
      </div>
    </div>
  );
}
