import { Input, NumberInput, Switch } from '@/components/ui';
import { formatInr } from '../format';

function RuleCard({ title, checked, onCheckedChange, children }) {
  return (
    <div className="tw:flex tw:items-center tw:justify-between tw:gap-4 tw:rounded-lg tw:border tw:border-border tw:p-4">
      <div className="tw:min-w-0">
        <div className="tw:text-sm tw:font-semibold tw:text-foreground">{title}</div>
        {children}
      </div>
      <Switch checked={!!checked} onCheckedChange={onCheckedChange} aria-label={title} />
    </div>
  );
}

// Nothing here sends mail by itself: the reminder job and the D/O release check read these flags per customer.
export default function AutoMailRulesTab({ client, hasEmail, policy, onPolicyChange, onSave }) {
  return (
    <div className="tw:flex tw:max-w-[680px] tw:flex-col tw:gap-4">
      <div>
        <h4 className="tw:m-0 tw:mb-2 tw:text-sm tw:text-foreground">Automation Rules for {client.name}</h4>
        <div className="tw:text-entry tw:text-muted-foreground">Saved against this customer. The reminder job and the D/O release check read these flags.</div>
      </div>

      <RuleCard title="Auto-send statement of account" checked={policy.autoSendLedger} onCheckedChange={(autoSendLedger) => onSave({ autoSendLedger })}>
        <div className="tw:mt-1 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:text-entry tw:text-muted-foreground">
          On these days of the month:
          <Input
            data-allow-text=""
            className="tw:w-[90px]"
            value={policy.autoSendDays || ''}
            onChange={(event) => onPolicyChange({ ...policy, autoSendDays: event.target.value })}
            onBlur={(event) => onSave({ autoSendDays: event.target.value })}
          />
          <span>(e.g. 1,15)</span>
        </div>
        {!hasEmail && <div className="tw:mt-1 tw:text-[11px] tw:text-warning">This ledger has no email address, so nothing can be sent.</div>}
      </RuleCard>

      <RuleCard title="Overdue reminders" checked={policy.overdueReminders} onCheckedChange={(overdueReminders) => onSave({ overdueReminders })}>
        <div className="tw:mt-1 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:text-entry tw:text-muted-foreground">
          Remind when a bill crosses
          <NumberInput
            decimals={0}
            className="tw:w-16"
            value={policy.reminderAfterDays ?? 10}
            onValueChange={(reminderAfterDays) => onPolicyChange({ ...policy, reminderAfterDays })}
            onBlur={(event) => onSave({ reminderAfterDays: event.target.value })}
          />
          days overdue (this customer&apos;s credit terms are {client.creditDays || 0} days).
        </div>
      </RuleCard>

      <RuleCard title="Hold D/O or Bill of Lading over the limit" checked={policy.autoHoldDelivery} onCheckedChange={(autoHoldDelivery) => onSave({ autoHoldDelivery })}>
        <div className="tw:mt-1 tw:text-entry tw:text-destructive">
          Block release of the Delivery Order while outstanding is over the credit limit
          {client.creditLimit ? ` (₹ ${formatInr(client.creditLimit)})` : ' - no limit is set on this ledger, so this flag has nothing to compare against'}.
        </div>
      </RuleCard>
    </div>
  );
}
