import { useEffect, useState } from 'react';
import { ComboInput } from '@/components/ui';
import { freightApi } from '@/components/FreightForwarding/freightApi';
import { errorMessage } from '@/services/axiosInstance';
import { partyContact } from './awbFormat';

const SEARCH_DELAY_MS = 300;
const MIN_SEARCH_LENGTH = 2;

function contactLine(party) {
  const { address, pin, mobile, email, gst } = partyContact(party);
  return address + (pin ? ' - ' + pin : '') + (mobile ? ' | MOB: ' + mobile : '') + (email ? ' | EMAIL: ' + email : '') + (gst ? ' | GST: ' + gst : '');
}

// One search result per branch of a party
const branchRows = (parties) => parties.flatMap((party) => (party.branches && party.branches.length > 0
  ? party.branches.map((branch) => ({ ...party, branches: [branch], uniqueKey: `${party.id}-${branch.id}` }))
  : [{ ...party, uniqueKey: `${party.id}-none` }]));

export function PartySearch({ placeholder, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (query.length < MIN_SEARCH_LENGTH) {
      setResults([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        setResults(branchRows((await freightApi.partySearch(query)) || []));
      } catch (error) {
        console.error('Party search failed:', errorMessage(error));
      }
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <ComboInput
      options={results}
      value={query}
      onValueChange={setQuery}
      onSelect={(party) => { setQuery(''); onSelect(party); }}
      getValue={(party) => party.name}
      filter={() => true}
      placeholder={placeholder}
      listClassName="tw:w-auto tw:min-w-(--radix-popover-trigger-width) tw:max-w-[90vw]"
      renderOption={(party) => (
        <span className="tw:flex tw:min-w-0 tw:flex-col">
          <span className="tw:font-bold tw:text-head">{party.name}</span>
          <span className="tw:text-[11px] tw:text-muted-foreground tw:uppercase">{contactLine(party)}</span>
        </span>
      )}
    />
  );
}

export function PartyDetails({ party }) {
  const { address, pin, mobile, email, gst } = partyContact(party);
  return (
    <>
      <strong>{party.name}</strong><br />
      <span className="tw:text-primary tw:uppercase">{address}{pin ? ' - ' + pin : ''}</span>
      {(mobile || gst || email) && (
        <div className="tw:mt-1 tw:flex tw:flex-wrap tw:gap-x-3 tw:text-[11px] tw:text-muted-foreground tw:uppercase">
          {mobile && <span><strong>MOB:</strong> {mobile}</span>}
          {email && <span><strong>EMAIL:</strong> {email}</span>}
          {gst && <span><strong>GST:</strong> {gst}</span>}
        </div>
      )}
    </>
  );
}
