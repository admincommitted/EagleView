import { SelectBox } from '@/components/ui';

export function BranchSelect({ value, onChange, list, required, exclude, disabled }) {
  const branches = list.filter((branch) => branch.code !== exclude);
  const known = !value || branches.some((branch) => branch.code === value);
  const options = [
    ...(known ? [] : [{ value, label: value }]),
    ...branches.map((branch) => ({ value: branch.code, label: branch.code + ' - ' + branch.name })),
  ];
  return (
    <SelectBox options={options} value={value || ''} onValueChange={onChange} disabled={disabled} required={required && !value}
      placeholder={required ? 'Choose the branch' : 'Select'} />
  );
}

// these wrap a box the floating Field label can sit in
BranchSelect.floatsLabel = true;
