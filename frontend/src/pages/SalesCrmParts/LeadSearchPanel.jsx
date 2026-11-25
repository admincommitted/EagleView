import { Button, Field, Input, SelectBox } from '@/components/ui';
import { LEAD_STATUSES } from './crmFormat';

export default function LeadSearchPanel({ search, onSearch, statusFilter, onStatusFilter, loading, leadCount, leadCounts }) {
  const summary = leadCounts
    ? ` · new ${leadCounts.NEW || 0}, quoted ${leadCounts.QUOTED || 0}, won ${leadCounts.WON || 0}, lost ${leadCounts.LOST || 0}`
    : '';
  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-page tw:px-4 tw:py-3.5 tw:md:flex-row tw:md:flex-wrap tw:md:items-end">
      <Field label="Client / enquiry no / route / commodity" layout="col" className="tw:md:w-[260px]">
        <Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="e.g. Jebel Ali" />
      </Field>
      <Field label="Status" layout="col" className="tw:md:w-[140px]">
        <SelectBox options={LEAD_STATUSES} value={statusFilter} onValueChange={onStatusFilter} placeholder="All" clearable clearLabel="All" />
      </Field>
      <Button onClick={() => { onSearch(''); onStatusFilter(''); }}>Clear</Button>
      <div className="tw:text-entry tw:text-muted-foreground">
        {loading ? 'Searching...' : `${leadCount} lead(s)`}
        {summary}
      </div>
    </div>
  );
}
