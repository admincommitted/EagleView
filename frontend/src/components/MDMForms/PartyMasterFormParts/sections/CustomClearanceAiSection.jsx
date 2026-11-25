import { BrainCircuit, Save } from 'lucide-react';
import { Button, Card, Field, Textarea } from '@/components/ui';

const RULE_FIELDS = [
  { field: 'aiImportRules', label: 'Import AI Rules', placeholder: "e.g. Always prefix description with 'SPARE PARTS FOR'. If unit is pcs, change to NOS." },
  { field: 'aiExportRules', label: 'Export AI Rules', placeholder: 'e.g. Map HSN to 84000000 if not found. Ignore DBK if under 500 INR.' },
];

export default function CustomClearanceAiSection({ ctx }) {
  const { formData, setFormField, saveParty } = ctx;
  return (
    <Card className="tw:flex-1 tw:gap-4 tw:p-4">
      <div className="tw:rounded-lg tw:border tw:border-primary/25 tw:bg-primary/5 tw:p-4">
        <h3 className="tw:m-0 tw:mb-2 tw:flex tw:items-center tw:gap-2 tw:text-[13px] tw:text-head">
          <BrainCircuit className="tw:size-4" /> Custom Clearance AI Rules (Gemini)
        </h3>
        <p className="tw:m-0 tw:text-[11px] tw:text-primary">
          Write natural language instructions for the AI on how to map descriptions, units, or HSN codes when extracting from PDFs for this specific client.
        </p>
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
        {RULE_FIELDS.map(({ field, label, placeholder }) => (
          <Field key={field} label={label} layout="col" labelClassName="tw:text-xs tw:font-semibold">
            <Textarea data-allow-text="" className="tw:h-[150px]" placeholder={placeholder} value={formData[field] || ''}
              onChange={(event) => setFormField(field, event.target.value)} />
          </Field>
        ))}
      </div>

      <div className="tw:mt-auto tw:flex tw:justify-end">
        <Button variant="default" size="lg" onClick={saveParty}><Save /> Save AI Rules</Button>
      </div>
    </Card>
  );
}
