import { useEffect, useRef, useState } from 'react';
import { MapPin, Plus, X } from 'lucide-react';
import { Button, ComboInput, Popover, PopoverContent, PopoverTrigger } from '@/components/ui';
import { shipmentApi } from './shipmentApi';

// the Master Directory page where a name of this kind is added ("+" next to the box)
const MASTER_PAGE = {
  party: 'party', airport: 'port', port: 'port', airline: 'airline', line: 'shipping-line', vessel: 'vessel', user: 'users',
  cha: 'party', warehouse: 'warehouse', uqc: 'uqc', country: 'country', state: 'country', currency: 'currency',
};
const ONE_LETTER_LISTS = ['state', 'uqc', 'currency', 'country'];
const TYPING_PAUSE_MS = 250;

function LookupOption({ option }) {
  const detail = option.address || option.dir || option.country || (option.prefix && 'Prefix ' + option.prefix);
  return (
    <div className="tw:flex tw:min-w-0 tw:flex-col tw:text-[11.5px]">
      <span>
        <b>{option.code ? option.code + ' - ' : ''}{option.name}</b>
        {option.partyCode && <span className="tw:ml-1.5 tw:text-[9.5px] tw:font-semibold tw:text-muted-foreground">{option.partyCode}</span>}
        {option.src && option.src !== 'Party Master' && <span className="tw:ml-1.5 tw:text-[9.5px] tw:font-bold tw:text-warning">{option.src}</span>}
      </span>
      {detail && (
        <span className="tw:text-[10px] tw:text-muted-foreground">
          {detail}{option.gstin ? ' - ' + option.gstin : ''}{option.branches > 1 ? ` (${option.branches} addresses)` : ''}
        </span>
      )}
    </div>
  );
}

// the party's addresses (party master branches) - like iCAFFE's "i" next to each party
function AddressPicker({ partyName, onPick }) {
  const [addresses, setAddresses] = useState(null);
  const [problem, setProblem] = useState('');

  const load = async () => {
    setProblem('');
    if (!String(partyName || '').trim()) {
      setProblem('Pick the party first');
      setAddresses([]);
      return;
    }
    try {
      const list = (await shipmentApi.partyAddresses(partyName)) || [];
      setAddresses(list);
      if (!list.length) setProblem(`No address of "${partyName}" in the party master`);
    } catch (error) {
      setProblem(error.message);
      setAddresses([]);
    }
  };

  const pick = (address) => { onPick(address); setAddresses(null); };

  return (
    <Popover open={addresses !== null} onOpenChange={(isOpen) => (isOpen ? load() : setAddresses(null))}>
      <PopoverTrigger asChild>
        <Button size="icon-sm" title="Pick the address from the party master"><MapPin className="tw:size-3" /></Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="tw:max-h-[280px] tw:w-[380px] tw:max-w-[calc(100vw-2rem)] tw:overflow-auto tw:p-0 tw:normal-case">
        <div className="tw:flex tw:items-center tw:justify-between tw:bg-page tw:px-2 tw:py-1 tw:text-[11px] tw:font-bold">
          Addresses {problem ? '' : `(${addresses?.length || 0})`}
          <X role="button" aria-label="Close" className="tw:size-3 tw:cursor-pointer" onClick={() => setAddresses(null)} />
        </div>
        {problem && <div className="tw:p-2 tw:text-[11px] tw:text-destructive">{problem}</div>}
        {addresses?.map((address) => (
          <div key={address.id} role="option" aria-selected={false} onClick={() => pick(address)} className="tw:cursor-pointer tw:border-b tw:border-border/50 tw:px-2 tw:py-1 tw:text-[11.5px] tw:hover:bg-accent">
            <b>{address.name}</b>
            {address.isDefault && <span className="tw:ml-1.5 tw:text-[9.5px] tw:font-bold tw:text-success">default</span>}
            <div className="tw:text-[10px] tw:text-muted-foreground">{address.address}{address.gstin ? ' - GSTIN ' + address.gstin : ''}</div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Type-ahead on a master (party, airport, port, airline, vessel, user, UQC, state, currency ...): type 2 letters, or F2
 * for the whole list. onText gets what is typed, onPick the master record picked; onAddress adds the address picker.
 */
export function MasterLookup({ what, type, value, onText, onPick, onAddress, placeholder, mandatory, disabled, upper, noAdd }) {
  const [options, setOptions] = useState([]);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (text, now) => {
    clearTimeout(timer.current);
    const minLength = ONE_LETTER_LISTS.includes(what) ? 1 : 2;
    if (!now && String(text).trim().length < minLength) { setOptions([]); return; }
    timer.current = setTimeout(async () => {
      try {
        setOptions((await shipmentApi.lookup(what, text, type)) || []);
      } catch {
        setOptions([]);
      }
    }, now ? 0 : TYPING_PAUSE_MS);
  };

  const masterPage = MASTER_PAGE[what];
  return (
    <div className="tw:flex tw:min-w-0 tw:flex-1 tw:gap-0.5">
      <ComboInput
        options={options}
        value={value || ''}
        onValueChange={(text) => { onText(text); search(text); }}
        onSelect={onPick}
        filter={() => true}
        getValue={(option) => option.code || option.name}
        renderOption={(option) => <LookupOption option={option} />}
        upper={upper}
        disabled={disabled}
        placeholder={placeholder}
        required={mandatory && !value}
        title="Type 2 letters to pick from the master; F2 lists all"
        listClassName="tw:w-[360px] tw:max-w-[calc(100vw-2rem)]"
        onKeyDown={(event) => {
          if (event.key !== 'F2') return;
          event.preventDefault();
          search(value || '', true);
        }}
      />
      {onAddress && <AddressPicker partyName={value} onPick={onAddress} />}
      {masterPage && !noAdd && !disabled && (
        <Button size="icon-sm" title={`Add / edit in the master (Master Directory > ${masterPage})`} onClick={() => window.open('/master/' + masterPage, '_blank')}>
          <Plus className="tw:size-3" />
        </Button>
      )}
    </div>
  );
}

// a name from the iCAFFE directory is copied into the party master when it is picked
async function takeParty(party) {
  if (!party || party.id || !party.icaffeId) return party;
  try {
    const saved = await shipmentApi.partyFromDirectory(party.icaffeId);
    return { ...party, id: saved.id, src: 'Party Master' };
  } catch {
    return party;
  }
}

export function PartyLookup({ onPick, ...props }) {
  return <MasterLookup what="party" {...props} onPick={async (party) => onPick(await takeParty(party))} />;
}
