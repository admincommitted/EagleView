import { Input } from '@/components/ui';

// an iCAFFE series gives the number on Save: the box only shows it (and stays editable on Modify)
export function VoucherNoInput({ header, editId, onChange }) {
  const locked = !!header.icaffe && !editId;
  return (
    <Input data-allow-text required={!header.voucherNumber} readOnly={locked} className={header.icaffe && !locked ? 'tw:bg-secondary' : undefined}
      value={header.voucherNumber} onChange={(event) => onChange(event.target.value)} />
  );
}
