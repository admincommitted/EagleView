import { ComboInput } from '@/components/ui';

export default function RichAutocomplete({
  options,
  value,
  onChange,
  onSelect,
  renderOption,
  placeholder,
  searchFilter,
  inputStyle,
}) {
  return (
    <ComboInput
      options={options}
      value={value || ''}
      onValueChange={onChange}
      onSelect={onSelect}
      renderOption={(option) => <div className="tw:min-w-0 tw:flex-1">{renderOption(option)}</div>}
      filter={searchFilter}
      limit={50}
      placeholder={placeholder}
      style={inputStyle}
    />
  );
}
