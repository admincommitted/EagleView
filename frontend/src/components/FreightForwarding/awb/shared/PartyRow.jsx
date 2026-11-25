import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Field, Input } from '@/components/ui';
import FieldAutocomplete from '@/components/FieldAutocomplete';
import { freightApi } from '../../freightApi';
import { DropItem, DropList } from './DropList';
import { LinkButton, PillCheck, RequiredBox } from './awbFormParts';

const EMPTY_ADDRESS = { name: '', street: '', city: '', state: '', country: '', zip: '', phone: '' };

/**
 * One row per branch of every party found. keepMasterFields: the party master record (regNo, gstin, branch ...)
 * travels with the picked party (e-AWB / HAWB); the MAWB keeps only the address.
 */
function partyOptions(parties, keepMasterFields) {
  if (!Array.isArray(parties)) return [];
  return parties.flatMap((party) => {
    if (!party.branches?.length) {
      return [{
        ...(keepMasterFields && { ...party, ctxType: '' }),
        name: party.name, branch: 'DEFAULT', address1: '', address2: '', city: '', state: '', country: party.countryCode || '', zip: '', phone: '',
      }];
    }
    return party.branches.map((branch) => ({
      ...(keepMasterFields && { ...party, regNo: branch.regNo || '', ctxType: branch.ctxType || '', gstin: branch.gstin || '' }),
      name: party.name,
      branch: branch.branch,
      address1: branch.address1 || '',
      address2: branch.address2 || '',
      city: branch.city || '',
      state: branch.state || '',
      country: branch.country || party.countryCode || 'IN',
      zip: branch.pinCode || '',
      phone: branch.phone || '',
    }));
  });
}

const addressOf = (option) => ({
  name: option.name,
  street: `${option.address1} ${option.address2}`.trim(),
  city: option.city,
  state: option.state,
  country: option.country,
  zip: option.zip,
  phone: option.phone,
  email: option.email || '',
});

function PartyOption({ option }) {
  return (
    <>
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <span className="tw:text-entry tw:font-bold">{option.name}</span>
        {option.branch && option.branch !== 'DEFAULT' && <span className="tw:text-[9px] tw:font-bold tw:text-muted-foreground">{option.branch}</span>}
      </div>
      <div className="tw:text-[11px] tw:text-muted-foreground">{[option.address1, option.address2, option.city, option.country].filter(Boolean).join(', ')}</div>
    </>
  );
}

/**
 * Shipper / consignee / notify ... box with the party-master search. A filled party shows as an address card
 * (Edit / Change); with `compact` an optional party that is not in use draws nothing (the screen offers "+ Buyer" ...).
 */
export default function PartyRow({
  title, hasSelf, hasSameAsCnee, isMandatory, onAddClick, data = {}, onChange, compact, forceOpen, onClose, cneeData,
  keepMasterFields = true,
}) {
  const name = data.name || '';
  const street = data.street || '';
  const city = data.city || '';
  const state = data.state || '';
  const country = data.country || '';
  const zipCode = data.zip || '';
  const phone = data.phone || '';
  const setField = (field) => (value) => onChange?.({ ...data, [field]: value });

  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredParties, setFilteredParties] = useState([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [editing, setEditing] = useState(() => !name);
  const [opened, setOpened] = useState(false);
  const [sameOn, setSameOn] = useState(false);
  const inputRef = useRef(null);
  const typedRef = useRef(false);
  const pickRef = useRef(false);
  const boxRef = useRef(null);

  const setAll = (newData) => {
    pickRef.current = true;
    onChange?.({ ...data, ...newData });
  };
  const choose = (option) => setAll(keepMasterFields ? { ...option, ...addressOf(option) } : addressOf(option));
  const copyConsignee = (checked) => {
    if (checked && cneeData) {
      setAll(Object.fromEntries(Object.keys(EMPTY_ADDRESS).map((field) => [field, cneeData[field] || ''])));
    } else {
      setAll(EMPTY_ADDRESS);
    }
  };

  useEffect(() => {
    if (!name) { setFilteredParties([]); return undefined; }
    let current = true;
    const search = async () => {
      try {
        const found = await freightApi.partySearchByType(name, title.toUpperCase());
        if (!current) return;
        setFilteredParties(partyOptions(found, keepMasterFields));
        setFocusedIndex(-1);
      } catch (error) {
        console.error(error);
        if (current) setFilteredParties([]);
      }
    };
    search();
    return () => { current = false; };
  }, [name, title, keepMasterFields]);

  // a picked / copied / loaded party closes to the card; one being typed stays open
  useEffect(() => {
    if (!name) { setEditing(true); typedRef.current = false; pickRef.current = false; return; }
    if (pickRef.current) { pickRef.current = false; typedRef.current = false; setEditing(false); return; }
    if (typedRef.current) return;
    if (boxRef.current?.contains(document.activeElement)) return;
    setEditing(false);
  }, [name, street, city]);
  useEffect(() => { if (forceOpen) inputRef.current?.focus(); }, [forceOpen]);

  const required = (value) => Boolean(isMandatory) && !String(value || '').trim();
  const missing = isMandatory
    ? [['Street', street], ['City', city], ['State', state], ['Country', country], ['ZIP', zipCode]].filter(([, value]) => !String(value || '').trim()).map(([label]) => label)
    : [];
  const sameBar = Boolean(hasSameAsCnee) && sameOn && Boolean(name) && !editing;
  const collapsed = !isMandatory && !name && !opened && !forceOpen;
  const showCard = Boolean(name) && !editing && !sameBar;
  const showForm = !collapsed && !showCard && !sameBar;
  const lowerTitle = title.toLowerCase();

  if (compact && collapsed) return null;

  const handleNameKeys = (event) => {
    if (!showDropdown || filteredParties.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusedIndex((index) => (index < filteredParties.length - 1 ? index + 1 : index));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex((index) => (index > 0 ? index - 1 : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < filteredParties.length) {
        choose(filteredParties[focusedIndex]);
        setShowDropdown(false);
        setFocusedIndex(-1);
      }
    }
  };
  const changeParty = () => {
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
  };

  return (
    <div ref={boxRef} className={cn('tw:flex tw:min-w-0 tw:flex-col tw:rounded-sm tw:border tw:border-border tw:bg-card', collapsed || sameBar ? 'tw:self-start' : 'tw:self-stretch')}>
      <div className={cn('tw:flex tw:min-h-[26px] tw:flex-wrap tw:items-center tw:gap-x-2 tw:gap-y-1 tw:px-2 tw:py-0.5', (showForm || showCard) && 'tw:border-b tw:border-border')}>
        <span className="tw:text-entry tw:font-semibold tw:whitespace-nowrap tw:text-head">{title}</span>
        {isMandatory && <span className="tw:text-[10px] tw:italic tw:text-required">Required</span>}
        {collapsed && <span className="tw:text-entry tw:text-muted-foreground">Not added</span>}
        {sameBar && (
          <span className="tw:min-w-0 tw:flex-[1_1_160px] tw:truncate tw:text-entry tw:font-semibold tw:text-success" title={name}>
            &#10003; Same as consignee <span className="tw:font-medium tw:text-muted-foreground">- {name}</span>
          </span>
        )}
        <span className="tw:ml-auto tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-x-3 tw:gap-y-1">
          {hasSelf && <PillCheck label="Self" />}
          {hasSameAsCnee && !sameBar && (
            <PillCheck label="Same as consignee" checked={sameOn} onCheckedChange={(checked) => { setSameOn(checked === true); copyConsignee(checked === true); }} />
          )}
          {sameBar && <LinkButton onClick={() => { setSameOn(false); setOpened(true); copyConsignee(false); }}>Use a different {lowerTitle}</LinkButton>}
          {collapsed && <LinkButton onClick={() => { setOpened(true); setTimeout(() => inputRef.current?.focus(), 0); }}>+ Add {lowerTitle}</LinkButton>}
          {showForm && Boolean(name) && <LinkButton onClick={() => setEditing(false)}>Done</LinkButton>}
          {compact && showForm && !name && <LinkButton title={`Hide ${title}`} onClick={() => { setOpened(false); setSameOn(false); onClose?.(); }}>Close</LinkButton>}
          {onAddClick && <LinkButton title={`Add a new party to the master (${title})`} onClick={onAddClick}>+ New party</LinkButton>}
        </span>
      </div>

      {showCard && (
        <div className="tw:flex tw:flex-1 tw:flex-col tw:px-2 tw:py-1.5">
          <div className="tw:text-entry tw:leading-relaxed tw:break-words tw:uppercase">
            <div className="tw:font-bold">{name}</div>
            {street && <div className="tw:text-muted-foreground">{street}</div>}
            {(city || state || zipCode || country) && (
              <div className="tw:text-muted-foreground">
                {[city, [state, zipCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}{country ? ` · ${country}` : ''}
              </div>
            )}
            {(phone || data.email) && (
              <div className="tw:mt-1 tw:flex tw:flex-wrap tw:gap-x-4 tw:gap-y-1 tw:text-[11px] tw:text-muted-foreground">
                {phone && <span>Phone {phone}</span>}
                {data.email && <span className="tw:normal-case">{data.email}</span>}
              </div>
            )}
          </div>
          <div className="tw:mt-auto tw:flex tw:flex-wrap tw:items-center tw:gap-x-3.5 tw:gap-y-1 tw:pt-1">
            {missing.length > 0 && <span className="tw:text-[11px] tw:font-semibold tw:text-destructive">Missing: {missing.join(', ')}</span>}
            <span className="tw:ml-auto tw:flex tw:flex-wrap tw:justify-end tw:gap-x-3.5 tw:gap-y-1">
              <LinkButton title="Edit the address" onClick={() => setEditing(true)}>Edit</LinkButton>
              <LinkButton title="Pick another party" onClick={changeParty}>Change</LinkButton>
            </span>
          </div>
        </div>
      )}

      <div
        className={cn('party-row-container tw:flex-col tw:gap-1.5 tw:px-2 tw:py-1.5', showForm ? 'tw:flex' : 'tw:hidden')}
        data-title={title}
        onChangeCapture={() => { typedRef.current = true; }}
      >
        <Field label="Name" required={isMandatory} labelWidth="64px">
          <DropList
            open={showDropdown && filteredParties.length > 0}
            onClose={() => setShowDropdown(false)}
            anchorClassName="tw:flex-1"
            className="tw:w-[max(var(--radix-popover-trigger-width),380px)] tw:max-w-[calc(100vw-16px)]"
            anchor={(
              <Input
                ref={inputRef}
                autoComplete="off"
                maxLength={35}
                value={name}
                required={required(name)}
                className="tw:font-bold tw:uppercase"
                onChange={(event) => { setField('name')(event.target.value); setShowDropdown(event.target.value.length >= 1); }}
                onKeyDown={handleNameKeys}
                onFocus={() => { if (name.length >= 1) setShowDropdown(true); }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              />
            )}
          >
            {filteredParties.map((option, index) => (
              <DropItem
                key={`${option.name}-${option.branch}-${index}`}
                active={focusedIndex === index}
                onPick={() => { choose(option); setShowDropdown(false); }}
                onHover={() => setFocusedIndex(index)}
                onLeave={() => setFocusedIndex(-1)}
              >
                <PartyOption option={option} />
              </DropItem>
            ))}
          </DropList>
        </Field>

        <Field label="Street" required={isMandatory} labelWidth="64px">
          <Input autoComplete="off" maxLength={70} value={street} required={required(street)} placeholder="Street address (max 70)" className="tw:uppercase" onChange={(event) => setField('street')(event.target.value)} />
        </Field>

        <Field label="City" required={isMandatory} labelWidth="64px">
          <Input autoComplete="off" maxLength={35} value={city} required={required(city)} placeholder="City" className="tw:uppercase" onChange={(event) => setField('city')(event.target.value)} />
          <Input autoComplete="off" maxLength={35} value={state} required={required(state)} placeholder="State / province" className="tw:uppercase" onChange={(event) => setField('state')(event.target.value)} />
        </Field>

        <Field label="Country" required={isMandatory} labelWidth="64px">
          <RequiredBox required={required(country)} className="tw:w-16 tw:shrink-0 tw:[&_input]:text-center">
            <FieldAutocomplete
              listType="country"
              value={country}
              onChange={(event) => setField('country')(event.target.value.toUpperCase())}
              onSelect={(option) => setField('country')(option.title)}
              placeholder="CC"
              maxLength={2}
            />
          </RequiredBox>
          <Input autoComplete="off" maxLength={9} value={zipCode} required={required(zipCode)} placeholder="ZIP / postcode" className="tw:uppercase" onChange={(event) => setField('zip')(event.target.value)} />
          <Input autoComplete="off" maxLength={25} value={phone} placeholder="Phone" className="tw:uppercase" onChange={(event) => setField('phone')(event.target.value)} />
        </Field>

        <Field label="Email" labelWidth="64px">
          <Input type="email" autoComplete="off" maxLength={70} value={data.email || ''} placeholder="email@example.com" className="tw:normal-case" onChange={(event) => setField('email')(event.target.value)} />
        </Field>
      </div>
    </div>
  );
}
