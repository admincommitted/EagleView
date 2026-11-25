import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, Input, SelectBox } from '@/components/ui';
import { TYPE_FILTERS, partyTypeText } from '../partyMasterData';

const TYPE_OPTIONS = TYPE_FILTERS.map(({ value, label }) => ({ value, label }));

const directoryTypeText = (row) => (row.partyType === 'CONSIGNEE' ? 'CONSIGNEE / SUPPLIER' : String(row.partyType || '').replace('_', ' '));
const directoryDetail = (row) => {
  const place = [row.city, row.countryCode].filter(Boolean).join(', ');
  return directoryTypeText(row) + (place ? ` - ${place}` : '');
};

function PartyRow({ name, detail, selected, waiting, onPick }) {
  return (
    <Button variant="ghost" size="block" onClick={onPick}
      className={cn('tw:flex-col tw:items-start tw:gap-0.5 tw:rounded-none tw:border-0 tw:border-b tw:border-l-[3px] tw:border-b-border tw:border-l-transparent tw:px-3 tw:py-2 tw:text-[11px] tw:font-medium tw:text-foreground',
        selected && 'tw:border-l-primary tw:bg-primary/10 tw:font-semibold tw:text-primary',
        waiting && 'tw:cursor-wait')}>
      <span>{name}</span>
      <span className="tw:text-[10px] tw:font-normal tw:text-muted-foreground">{detail}</span>
    </Button>
  );
}

export default function SearchPartySection({ ctx }) {
  const { dirList, dirBusy, importDir, filteredParties, matchedCount, searchTerm, selectedParty, setSearchTerm, setSelectedParty, setTypeFilter, typeFilter } = ctx;
  const countText = matchedCount > filteredParties.length
    ? `Showing ${filteredParties.length} of ${matchedCount.toLocaleString('en-IN')} - type to narrow`
    : `${matchedCount.toLocaleString('en-IN')} parties`;

  return (
    <Card className="tw:flex tw:max-h-[45vh] tw:flex-col tw:gap-0 tw:overflow-hidden tw:p-0 tw:lg:max-h-none tw:lg:w-[300px] tw:lg:shrink-0">
      <h3 className="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-border tw:p-4 tw:text-[13px] tw:font-bold tw:tracking-[0.5px] tw:uppercase">
        <Search className="tw:size-4 tw:text-primary" /> Search Party
      </h3>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border tw:p-3">
        <Input leftIcon={Search} data-allow-text="" placeholder="SEARCH NAME, IEC, GST, CITY..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
        <SelectBox options={TYPE_OPTIONS} value={typeFilter} onValueChange={setTypeFilter} placeholder="ALL TYPES" clearable clearLabel="ALL TYPES" />
        <div className="tw:text-[10px] tw:text-muted-foreground">{countText}</div>
      </div>
      <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto">
        {filteredParties.map((party) => (
          <PartyRow key={party.id} name={party.name} detail={partyTypeText(party) || party.type}
            selected={selectedParty?.id === party.id} onPick={() => setSelectedParty(party)} />
        ))}
        {dirList.length > 0 && (
          <div className={cn(dirBusy && 'tw:opacity-60')}>
            {dirList.map((row) => (
              <PartyRow key={`directory-${row.id}`} name={row.name} detail={directoryDetail(row)} waiting={dirBusy} onPick={() => importDir(row)} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
