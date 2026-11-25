import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui';

/** A select whose options sit under headings: groups [{ label, options: [{ value, label }] }]; `options` go above them. */
export default function GroupedSelect({ groups, options = [], value, onValueChange, placeholder, className, title }) {
  const item = (option) => <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>;
  return (
    <Select value={value == null ? '' : String(value)} onValueChange={onValueChange}>
      <SelectTrigger className={className} title={title}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(item)}
        {groups.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.options.map(item)}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
