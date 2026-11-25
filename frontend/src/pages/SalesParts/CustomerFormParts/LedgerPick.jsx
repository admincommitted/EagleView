import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ComboInput } from '@/components/ui';
import { cn } from '@/lib/utils';
import { salesHubApi } from '../salesApi';
import { Muted } from '../salesWidgets';

const SEARCH_DELAY_MS = 250;

/** Search box for an accounts ledger; keep is this customer's id, so its own ledgers stay pickable. */
export default function LedgerPick({ ledgerId, label = '', keep, all, onPick, id }) {
  const [ledgers, setLedgers] = useState([]);
  const [focused, setFocused] = useState(false);
  const timer = useRef(null);

  const search = (query) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setLedgers((await salesHubApi.ledgers({ query, keep, all })).data || []);
      } catch {
        setLedgers([]);
      }
    }, SEARCH_DELAY_MS);
  };

  const ownedElsewhere = (ledger) => ledger.profileId && String(ledger.profileId) !== String(keep || '');
  const pick = (ledger) => {
    if (ownedElsewhere(ledger)) {
      toast.error('That ledger already belongs to another customer');
      return;
    }
    onPick(ledger);
  };

  return (
    <div className="tw:flex tw:w-full tw:min-w-0 tw:flex-col tw:gap-0.5">
      <ComboInput
        id={id}
        options={ledgers}
        value={label}
        filter={() => true}
        getValue={(ledger) => ledger.name}
        onValueChange={search}
        onSelect={pick}
        onFocus={() => { setFocused(true); search(''); }}
        onBlur={() => setFocused(false)}
        placeholder="Type the ledger name or GSTIN"
        renderOption={(ledger) => (
          <span className={cn('tw:min-w-0', ownedElsewhere(ledger) && 'tw:opacity-50')}>
            <b>{ledger.name}</b>{' '}
            <span className="tw:text-[10.5px] tw:text-muted-foreground">
              {[ledger.gstin, ledger.groupName, ownedElsewhere(ledger) ? 'has a profile' : ''].filter(Boolean).join(' · ')}
            </span>
          </span>
        )}
      />
      {ledgerId && !focused && <Muted className="tw:text-[10.5px]">Ledger #{ledgerId}</Muted>}
    </div>
  );
}
