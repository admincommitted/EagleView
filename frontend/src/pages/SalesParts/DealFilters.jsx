import { RefreshCw, Search } from 'lucide-react';
import { Button, Input, SelectBox } from '@/components/ui';
import { activePersons, pairOptions } from './salesFormat';

const FILTER_BOX = 'tw:w-full tw:sm:w-auto tw:sm:min-w-[130px]';

/** Search box, status / service / sales person filters and Refresh above the enquiry and quotation lists. */
export default function DealFilters({ meta, filters, placeholder, statusLabel, statusOptions, onQueryChange, onSearch, onFilter, children }) {
  const persons = activePersons(meta);
  const filterBox = (field, allLabel, options) => (
    <SelectBox
      className={FILTER_BOX}
      clearable
      clearLabel={allLabel}
      placeholder={allLabel}
      value={filters[field]}
      onValueChange={(value) => onFilter(field, value)}
      options={options}
    />
  );
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
      <form onSubmit={(event) => { event.preventDefault(); onSearch(); }} className="tw:flex tw:w-full tw:gap-1.5 tw:sm:w-auto">
        <Input leftIcon={Search} className="tw:sm:w-[250px]" data-allow-text="" placeholder={placeholder} value={filters.q} onChange={(event) => onQueryChange(event.target.value)} />
        <Button type="submit">Search</Button>
      </form>
      {filterBox('status', statusLabel, statusOptions)}
      {filterBox('service', 'All services', pairOptions(meta.services))}
      {persons.length > 1 && filterBox('spId', 'All sales persons', persons.map((person) => ({ value: person.id, label: person.name })))}
      <Button size="icon" onClick={onSearch} title="Refresh" aria-label="Refresh"><RefreshCw /></Button>
      {children}
    </div>
  );
}
