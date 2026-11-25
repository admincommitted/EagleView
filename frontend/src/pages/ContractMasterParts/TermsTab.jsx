import { Checkbox, Label, Separator, Textarea } from '@/components/ui';

const BILLING_SWITCHES = [
  {
    key: 'splitInvoicing',
    title: 'Require Split Invoicing',
    note: 'System will automatically force separation of Freight bills and Local/Customs bills for this client to comply with TDS/Tax rules.',
  },
  {
    key: 'consolidatedBilling',
    title: 'Fortnightly / Consolidated Billing',
    note: 'Block single job invoicing. Push all shipments to the Bulk Billing engine automatically.',
  },
  {
    key: 'autoEmailInvoices',
    title: 'Auto-Email Invoices',
    note: "Automatically dispatch the finalized PDF invoice to the client's registered email.",
  },
];

export default function TermsTab({ terms, onTermsChange, prefs, onPrefChange }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-6 tw:p-3 tw:md:p-6 tw:lg:flex-row tw:lg:gap-8">
      <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-3 tw:lg:flex-[1.5]">
        <h3 className="tw:m-0 tw:text-[15px] tw:normal-case tw:text-foreground">Standard Terms & Conditions</h3>
        <p className="tw:m-0 tw:text-xs tw:normal-case tw:text-muted-foreground">These terms will be printed on the final quotation and job invoices.</p>
        <Textarea data-allow-text="" className="tw:h-[200px] tw:leading-normal" value={terms} onChange={(event) => onTermsChange(event.target.value)} />
      </div>

      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-4 tw:rounded-lg tw:border tw:border-border tw:bg-page tw:p-5">
        <h3 className="tw:m-0 tw:text-[15px] tw:normal-case tw:text-foreground">Billing & Automation Preferences</h3>
        {BILLING_SWITCHES.map((option) => (
          <div key={option.key} className="tw:flex tw:items-start tw:gap-2.5">
            <Checkbox id={`billing-${option.key}`} className="tw:mt-0.5" checked={!!prefs[option.key]}
              onCheckedChange={(checked) => onPrefChange(option.key, checked === true)} />
            <Label htmlFor={`billing-${option.key}`} className="tw:flex-col tw:items-start tw:gap-0.5 tw:whitespace-normal tw:cursor-pointer">
              <span className="tw:text-[13px] tw:font-semibold">{option.title}</span>
              <span className="tw:text-[11px] tw:normal-case tw:text-muted-foreground">{option.note}</span>
            </Label>
          </div>
        ))}
        <Separator />
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <Label htmlFor="billing-notes" className="tw:text-[13px] tw:font-semibold">Special Billing Instructions (Internal)</Label>
          <p className="tw:m-0 tw:text-[11px] tw:normal-case tw:text-muted-foreground">
            Notes for the Accounts team (e.g. "Courier physical copy to HQ", "Deduct TDS before paying duty").
          </p>
          <Textarea id="billing-notes" data-allow-text="" className="tw:h-20" placeholder="Enter any custom rules or special instructions here..."
            value={prefs.billingNotes} onChange={(event) => onPrefChange('billingNotes', event.target.value)} />
        </div>
      </div>
    </div>
  );
}
