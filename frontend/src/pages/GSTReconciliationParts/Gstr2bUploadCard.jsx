import { UploadCloud } from 'lucide-react';
import { Card, Field, FileButton, NumberInput } from '@/components/ui';
import Notice from '../PurchaseParts/Notice';

export default function Gstr2bUploadCard({ tolerance, onToleranceChange, analyzing, error, onFile }) {
  return (
    <Card className="tw:items-center tw:gap-4 tw:border-2 tw:border-dashed tw:border-input tw:px-4 tw:py-10 tw:text-center tw:md:py-14">
      <UploadCloud className="tw:size-12 tw:text-muted-foreground/70" />
      <div className="tw:flex tw:flex-col tw:gap-2">
        <h3 className="tw:m-0 tw:text-base tw:font-bold tw:normal-case tw:text-foreground">Upload GSTR-2B JSON</h3>
        <p className="tw:m-0 tw:max-w-[400px] tw:text-sm tw:normal-case tw:text-muted-foreground">
          Download the JSON file from the GST Portal for the current month and upload it here. System will auto-match
          with your Vendor Bills.
        </p>
      </div>
      <Field label="Match tolerance (₹)">
        <NumberInput className="tw:w-20" value={tolerance} onValueChange={onToleranceChange} />
      </Field>
      <FileButton variant="default" size="lg" accept=".json,application/json" disabled={analyzing}
        onFiles={([file]) => file && onFile(file)}>
        {analyzing ? 'Reading the file and matching...' : 'Select JSON File & Start Match'}
      </FileButton>
      {error && <Notice tone="danger" className="tw:w-full tw:max-w-[640px] tw:text-left">{error}</Notice>}
    </Card>
  );
}
