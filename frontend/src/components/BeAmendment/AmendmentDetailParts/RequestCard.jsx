import { DateInput, Field, Input } from '@/components/ui';
import DetailCard from './DetailCard';

export default function RequestCard({ form, open, setField }) {
  return (
    <DetailCard title="Request">
      <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-2">
        <Field layout="col" label="Request letter no">
          <Input disabled={!open} value={form.reqLetterNo} maxLength={30} onChange={(event) => setField('reqLetterNo', event.target.value)} />
        </Field>
        <Field layout="col" label="Request letter date">
          <DateInput disabled={!open} value={form.reqLetterDate} onValueChange={(value) => setField('reqLetterDate', value)} />
        </Field>
        <Field layout="col" label="Reason" className="tw:sm:col-span-2">
          <Input disabled={!open} value={form.reason} maxLength={120} onChange={(event) => setField('reason', event.target.value)} />
        </Field>
      </div>
    </DetailCard>
  );
}
