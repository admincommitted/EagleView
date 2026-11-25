import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button, ComboInput } from '@/components/ui';

const SHOWN_LIMIT = 50;

const searchKey = (party) => [
  party.name, party.code, party.taxId, party.panNumber, party.city,
  ...(party.branches || []).map((branch) => `${branch.regNo || ''} ${branch.city || ''}`),
].filter(Boolean).join(' ').toLowerCase();

const wordsOf = (text) => text.trim().toLowerCase().split(/\s+/).filter(Boolean);

const matchesWords = (party, text) => {
  const key = searchKey(party);
  return wordsOf(text).every((word) => key.includes(word));
};

const partyDetails = (party) => [
  party.taxId && `IEC ${party.taxId}`,
  party.city,
  (party.branches || []).map((branch) => branch.regNo).find(Boolean),
].filter(Boolean).join(' · ') || ' ';

const renderParty = (party) => (
  <div className="tw:flex tw:min-w-0 tw:flex-col">
    <span className="tw:font-semibold tw:text-foreground">{party.name}</span>
    <span className="tw:text-[11px] tw:text-muted-foreground">{partyDetails(party)}</span>
  </div>
);

/** Customer box: type part of the name, code, IEC, GSTIN or city (every word must match); value is the party id. */
export default function PartyPicker({ parties, value, onChange }) {
  const [query, setQuery] = useState('');
  const selected = parties.find((party) => String(party.id) === String(value));
  const hitCount = useMemo(
    () => (query.trim() ? parties.filter((party) => matchesWords(party, query)).length : parties.length),
    [parties, query],
  );

  let hint = null;
  if (query.trim() && !hitCount) hint = `No customer matches "${query}" - add it in Party Master`;
  else if (query.trim() && hitCount >= SHOWN_LIMIT) hint = `Showing first ${SHOWN_LIMIT} - type more to narrow`;

  return (
    <div className="tw:flex tw:flex-col tw:gap-0.5">
      <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-1">
        <ComboInput
          options={parties}
          value={selected ? selected.name : ''}
          placeholder={selected ? selected.name : 'Search customer by name, IEC, GSTIN, city...'}
          getValue={(party) => party.id}
          getLabel={(party) => party.name}
          filter={matchesWords}
          renderOption={renderParty}
          limit={SHOWN_LIMIT}
          listClassName="tw:min-w-72"
          onValueChange={setQuery}
          onFocus={() => setQuery('')}
          onBlur={() => setQuery('')}
          onSelect={(party) => { setQuery(''); onChange(String(party.id)); }}
        />
        {selected && (
          <Button variant="ghost" size="icon-sm" title="Clear customer" onClick={() => onChange('')}><X /></Button>
        )}
      </div>
      {hint && <p className="tw:m-0 tw:text-[11px] tw:normal-case tw:text-muted-foreground">{hint}</p>}
    </div>
  );
}
