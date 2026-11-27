import { Badge, DateInput, Field, Input, NumberInput, Section } from '@/components/ui';

// BE No / Date come from the ICEGATE acknowledgement via the API, or are typed when the BE was uploaded on the portal
const FIELDS = [
  { name: 'beNo', label: 'BE No', kind: 'beNo' },
  { name: 'beDate', label: 'BE Date', kind: 'date' },
  { name: 'assessmentDate', label: 'Assessment Date', kind: 'date', hint: 'Date the BE was assessed (first / second check done)' },
  { name: 'dutyPaidDate', label: 'Duty Paid Date', kind: 'date' },
  { name: 'challanNo', label: 'Challan No', kind: 'text', maxLength: 30, placeholder: 'duty challan / TR-6' },
  { name: 'oocDate', label: 'Out of Charge Date', kind: 'date', hint: 'Out of Charge (OOC) date - the job is cleared after this' },
];

const STATUS_BADGE = { accepted: 'success', rejected: 'danger' };

function FilingControl({ field, value, onChange, id }) {
  if (field.kind === 'date') return <DateInput id={id} name={field.name} value={value} onChange={onChange} />;
  if (field.kind === 'beNo') {
    return <NumberInput id={id} name={field.name} decimals={0} maxLength={7} placeholder="7 digits" title="Bill of Entry number given by ICEGATE (7 digits)" value={value} onChange={onChange} />;
  }
  return <Input id={id} name={field.name} maxLength={field.maxLength} placeholder={field.placeholder} value={value} onChange={onChange} />;
}

// renders a DateInput / NumberInput / Input, so its Field label can float inside it
FilingControl.floatsLabel = true;

export default function BeFilingSection({ ctx }) {
  const { jobData, handleChange } = ctx;
  const status = String(jobData.icegateStatus || '').toLowerCase();
  const fromAcknowledgement = status === 'accepted' && jobData.beNo;

  const heading = (
    <span className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5">
      BE Filing Details
      {jobData.icegateStatus && (
        <Badge variant={STATUS_BADGE[status] || 'info'}>ICEGATE: {jobData.icegateStatus}{jobData.icegateUniqueId ? ` (${jobData.icegateUniqueId})` : ''}</Badge>
      )}
      <span className="tw:text-[10px] tw:font-medium tw:text-muted-foreground">
        {fromAcknowledgement ? 'BE No / Date came from the ICEGATE acknowledgement' : 'Type the BE No / Date here when the BE was filed by uploading the file on the ICEGATE portal'}
      </span>
    </span>
  );

  return (
    <Section title={heading}>
      <div className="tw:grid tw:grid-cols-1 tw:items-center tw:sm:grid-cols-2 tw:lg:grid-cols-3 tw:gap-x-4 tw:gap-y-2">
        {FIELDS.map((field) => (
          <Field key={field.name} label={field.label} labelWidth="130px" hint={field.hint}>
            <FilingControl field={field} value={jobData[field.name] || ''} onChange={handleChange} />
          </Field>
        ))}
      </div>
    </Section>
  );
}
