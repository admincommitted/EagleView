import { useState } from 'react';
import { ChevronDown, ChevronUp, Plane } from 'lucide-react';
import { Badge, Button, Field, Input, NumberInput, Section, SelectBox, Textarea } from '@/components/ui';
import FieldAutocomplete from '@/components/FieldAutocomplete';
import { showSuccessToast } from '../../../printLogic';
import { loadStockSuggest } from '../../awbStockSuggest';
import PartyRow from '../PartyRow';
import { DropEmpty, DropItem, DropList } from '../DropList';
import { LinkButton } from '../awbFormParts';

const OPTIONAL_PARTIES = ['Buyer', 'Sub Agent', 'Overseas Agent', 'Notify 1', 'Notify 2'];
const DOCS_OPTIONS = ['SHIPMENT WITH DOCUMENTS', 'SHIPMENT WITHOUT DOCUMENTS'];
const isTransmitted = (awb) => awb.status === 'TRANSMITTED' || awb.transmissionStatus === 'TRANSMITTED';
const stockLine = (awb) => `${awb.awbNumber || ''} - ${awb.status === 'AVAILABLE STOCK' ? 'AVAILABLE' : (awb.status || 'ACTIVE')} - ${awb.shipperName || 'UNUSED'}`;

function AirlineName({ code, name }) {
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <span className="tw:inline-flex tw:items-center tw:gap-1.5 tw:text-[11px] tw:font-semibold tw:whitespace-nowrap tw:text-muted-foreground">
      {code && !logoFailed
        ? <img src={`https://www.gstatic.com/flights/airline_logos/70px/${code}.png`} alt={name} onError={() => setLogoFailed(true)} className="tw:size-[18px] tw:shrink-0 tw:rounded-[2px] tw:object-contain" />
        : <Plane className="tw:size-3.5" />}
      {name}
    </span>
  );
}

function AwbNumberBoxes({ ctx, onSuffixBlur }) {
  const { awbDropList, awbFocusedIndex, awbPrefix, awbSuffix, setAwbDropList, setAwbFocusedIndex, setAwbPrefix, setAwbSuffix, setShowAwbDrop, showAwbDrop } = ctx;
  const refuse = (message) => showSuccessToast('Error', message, true);
  const takeStockNumber = (awb) => {
    const [prefix, serial] = (awb.awbNumber || '').split('-');
    if (prefix) setAwbPrefix(prefix);
    if (serial) setAwbSuffix(serial);
    setShowAwbDrop(false);
  };
  const handleKeys = (event) => {
    if (!showAwbDrop || awbDropList.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setAwbFocusedIndex((index) => (index < awbDropList.length - 1 ? index + 1 : index));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setAwbFocusedIndex((index) => (index > 0 ? index - 1 : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const awb = awbDropList[awbFocusedIndex];
      if (!awb) return;
      if (isTransmitted(awb)) refuse('AWB is already TRANSMITTED and cannot be selected/edited!');
      else { takeStockNumber(awb); setAwbFocusedIndex(-1); }
    }
  };

  return (
    <div className="tw:flex tw:items-center tw:gap-2">
      <NumberInput decimals={0} maxLength={3} value={awbPrefix} onValueChange={setAwbPrefix} placeholder="prefix" required={!awbPrefix}
        className="tw:w-[52px] tw:text-center tw:font-semibold tw:tracking-wider" />
      <span className="tw:font-bold">-</span>
      <DropList
        open={showAwbDrop && awbDropList.length > 0}
        onClose={() => setShowAwbDrop(false)}
        className="tw:w-[max(var(--radix-popover-trigger-width),320px)] tw:max-w-[calc(100vw-16px)]"
        anchor={(
          <NumberInput
            decimals={0}
            maxLength={8}
            value={awbSuffix}
            placeholder="8-digit no."
            required={!awbSuffix}
            className="tw:w-[104px] tw:font-semibold tw:tracking-wider"
            onValueChange={(serial) => {
              setAwbSuffix(serial);
              setAwbFocusedIndex(-1);
              loadStockSuggest(awbPrefix, serial, setAwbDropList, setShowAwbDrop);
            }}
            onKeyDown={handleKeys}
            onFocus={() => {
              if (/^\d{3}$/.test(awbPrefix || '')) loadStockSuggest(awbPrefix, awbSuffix, setAwbDropList, setShowAwbDrop);
              else setShowAwbDrop(false);
            }}
            onBlur={() => { setTimeout(() => setShowAwbDrop(false), 200); onSuffixBlur?.(awbPrefix, awbSuffix); }}
          />
        )}
      >
        {awbDropList.map((awb, index) => (
          <DropItem
            key={`${awb.awbNumber}-${index}`}
            active={awbFocusedIndex === index}
            disabled={isTransmitted(awb)}
            className="tw:truncate tw:whitespace-nowrap"
            onHover={() => setAwbFocusedIndex(index)}
            onLeave={() => setAwbFocusedIndex(-1)}
            onPick={() => { if (isTransmitted(awb)) refuse('AWB is already TRANSMITTED!'); else takeStockNumber(awb); }}
          >
            {stockLine(awb)}
          </DropItem>
        ))}
      </DropList>
    </div>
  );
}

function HawbStockBox({ ctx }) {
  const { hawbNumber, hawbStockFiltered, openHawbStockDrop, setHawbNumber, setShowHawbDrop, showHawbDrop } = ctx;
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
      <Field label="HAWB NO*">
        <Input value={hawbNumber ?? ''} onChange={(event) => setHawbNumber(event.target.value)} placeholder="e.g. DEL001" required className="tw:w-full tw:md:w-[120px]" />
      </Field>
      <DropList
        open={Boolean(showHawbDrop)}
        onClose={() => setShowHawbDrop(false)}
        className="tw:w-[280px] tw:max-h-[200px]"
        anchor={(
          <Button variant="default" size="sm" title="Show available House AWB numbers from stock" onClick={openHawbStockDrop}>
            GET HAWB NO {showHawbDrop ? <ChevronUp /> : <ChevronDown />}
          </Button>
        )}
      >
        {hawbStockFiltered.length > 0 ? hawbStockFiltered.map((hawb, index) => (
          <DropItem
            key={`${hawb.fullHawbNumber}-${index}`}
            className="tw:flex tw:items-center tw:justify-between tw:gap-2"
            onPick={() => { setHawbNumber(hawb.fullHawbNumber || ''); setShowHawbDrop(false); }}
          >
            <span className="tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5">
              <span className="tw:text-[13px] tw:font-extrabold tw:tracking-wide tw:text-primary">{hawb.fullHawbNumber}</span>
              {hawb.agentName
                ? <span className="tw:truncate tw:text-[10px] tw:font-semibold tw:text-success">{hawb.agentName}</span>
                : <span className="tw:text-[10px] tw:font-semibold tw:italic">No Agent Assigned</span>}
            </span>
            <Badge variant="success">AVAILABLE</Badge>
          </DropItem>
        )) : <DropEmpty>No HAWB available</DropEmpty>}
      </DropList>
    </div>
  );
}

function IataAgentCard({ ctx, fillAgentOci }) {
  const { accountingInfo, agentDetails, setAccountingInfo, setAgentDetails, setOciRows } = ctx;
  const [agentEdit, setAgentEdit] = useState(false);
  const agentHasName = String(agentDetails?.name || '').trim() !== '';
  const showForm = agentEdit || !agentHasName;
  const setAgentField = (field) => (event) => setAgentDetails({ ...agentDetails, [field]: event.target.value.toUpperCase() });

  // MAWB: the agent's tax id from the master fills the AGT / E line of the OCI
  const fillAgentEori = (option) => {
    const agentEori = option.taxId || option.vat || option.eori || option.panNumber || '';
    if (!agentEori) return;
    const countryCode = (option.country || option.countryCode || 'IN').substring(0, 2).toUpperCase();
    setOciRows((previous) => {
      const rows = [...(previous || [])];
      const agentLine = rows.find((row) => row.infoId === 'AGT' && row.customsId === 'E');
      if (agentLine) agentLine.suppInfo = agentEori;
      else rows.push({ id: Date.now() + 104, countryCode, infoId: 'AGT', customsId: 'E', suppInfo: agentEori });
      return rows;
    });
  };
  const pickAgent = (option) => {
    setAgentDetails((previous) => ({ ...previous, name: option.title, code: option.iataCode || option.title, place: option.place || '' }));
    if (fillAgentOci) fillAgentEori(option);
  };
  const summary = [
    agentDetails.code && `IATA code ${agentDetails.code}`,
    agentDetails.place && `Place ${agentDetails.place}`,
    agentDetails.account && `Account ${agentDetails.account}`,
  ].filter(Boolean).join(' · ') || 'IATA code not filled';

  return (
    <div className="tw:min-w-0 tw:rounded-sm tw:border tw:border-border tw:bg-card">
      <div className="tw:flex tw:min-h-[26px] tw:items-center tw:justify-between tw:border-b tw:border-border tw:px-2 tw:py-0.5">
        <span className="tw:text-entry tw:font-semibold tw:text-head">IATA Agent Details</span>
        {agentHasName && <LinkButton tabIndex={-1} onClick={() => setAgentEdit((editing) => !editing)}>{showForm ? 'Done' : 'Edit'}</LinkButton>}
      </div>
      <div className="tw:flex tw:flex-col tw:gap-1.5 tw:p-2">
        {showForm ? (
          <div className="tw:flex tw:flex-col tw:gap-1.5" onFocus={() => setAgentEdit(true)}>
            <Field label="Name" labelWidth="96px">
              <FieldAutocomplete
                listType="iata-agent"
                value={agentDetails.name}
                onChange={(event) => setAgentDetails({ ...agentDetails, name: event.target.value })}
                onSelect={pickAgent}
                placeholder="IATA AGENT NAME..."
              />
            </Field>
            <div className="tw:grid tw:grid-cols-1 tw:gap-1.5 tw:md:grid-cols-[minmax(0,1fr)_auto]">
              <Field label="Code" labelWidth="96px">
                <Input autoComplete="off" value={agentDetails.code ?? ''} onChange={setAgentField('code')} className="tw:uppercase" />
              </Field>
              <Field label="Place">
                <Input autoComplete="off" value={agentDetails.place ?? ''} onChange={setAgentField('place')} className="tw:w-full tw:uppercase tw:md:w-20" />
              </Field>
            </div>
            <Field label="Account" labelWidth="96px">
              <Input autoComplete="off" value={agentDetails.account ?? ''} onChange={setAgentField('account')} className="tw:uppercase" />
            </Field>
          </div>
        ) : (
          <div className="tw:text-entry tw:leading-relaxed">
            <div className="tw:font-bold">{agentDetails.name}</div>
            <div className="tw:text-muted-foreground">{summary}</div>
          </div>
        )}
        <Field label="Docs" labelWidth="96px">
          <SelectBox options={DOCS_OPTIONS} value={agentDetails.docs || DOCS_OPTIONS[0]} onValueChange={(docs) => setAgentDetails({ ...agentDetails, docs })} className="tw:md:max-w-[280px]" />
        </Field>
        <Field label="Accounting Info" labelWidth="96px" note="0/6 LINES (MAX 34 CHARS/LINE)" className="tw:md:items-start">
          <Textarea
            rows={2}
            value={accountingInfo}
            onChange={(event) => setAccountingInfo(event.target.value.toUpperCase())}
            placeholder="E.G. FREIGHT PREPAID"
            className="tw:h-6 tw:min-h-6 tw:resize-none tw:font-mono tw:uppercase tw:md:max-w-[280px]"
          />
        </Field>
      </div>
    </div>
  );
}

/**
 * AWB number row, the parties and the IATA agent.
 * hawbBox: 'stock' = HAWB number box with the HAWB stock list (HAWB screen), 'link' = linked HAWBs button (MAWB).
 * keepPartyMasterFields: a party picked from the master keeps its master record (false on the MAWB: address only).
 */
export default function PartiesSection({ ctx, awbNoLabel = 'AWB NO', hawbBox, onAwbSuffixBlur, fillAgentOci = false, keepPartyMasterFields = true }) {
  const { airlineCode, airlineName, linkedHawbs, parties, setAddPartyTitle, setParties, setShowAddParty, setShowLinkHawb, setShowSubAgentMaster } = ctx;
  const [openParties, setOpenParties] = useState({});
  const partyName = (title) => String(parties?.[title]?.name || '').trim();
  const freeParties = OPTIONAL_PARTIES.filter((title) => !partyName(title) && !openParties[title] && (title !== 'Notify 2' || partyName('Notify 1')));
  const addParty = (title) => () => { setAddPartyTitle(`Add ${title} Details`); setShowAddParty(true); };
  const partyProps = (title) => ({
    title,
    data: parties[title],
    keepMasterFields: keepPartyMasterFields,
    onChange: (data) => setParties((previous) => ({ ...previous, [title]: data })),
  });
  const optionalProps = (title) => ({
    ...partyProps(title),
    compact: true,
    forceOpen: Boolean(openParties[title]),
    onClose: () => setOpenParties((open) => ({ ...open, [title]: false })),
  });
  const sameAsConsignee = { hasSameAsCnee: true, cneeData: parties.Consignee };

  return (
    <Section title="Party Details" className="tw:px-2 tw:pt-1" bodyClassName="tw:gap-0">
      <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border tw:py-1 tw:md:flex-row tw:md:flex-wrap tw:md:items-center tw:md:gap-x-4">
        <Field label={awbNoLabel} required>
          <AwbNumberBoxes ctx={ctx} onSuffixBlur={onAwbSuffixBlur} />
          {airlineName && <AirlineName key={airlineCode || ''} code={airlineCode} name={airlineName} />}
        </Field>
        {hawbBox === 'stock' && <HawbStockBox ctx={ctx} />}
        {hawbBox === 'link' && (
          <Field label="HAWB NO">
            <Button variant="default" size="sm" onClick={() => setShowLinkHawb(true)}>View / Link HAWBs ({linkedHawbs.length})</Button>
          </Field>
        )}
        <Field label="Reference Number:" className="tw:md:ml-auto">
          <Input autoComplete="off" placeholder="Optional Info" className="tw:w-full tw:uppercase tw:md:w-[150px]" />
        </Field>
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:items-stretch tw:gap-x-4 tw:gap-y-3 tw:py-2 tw:lg:grid-cols-2">
        <PartyRow {...partyProps('Shipper')} isMandatory hasSelf onAddClick={addParty('Shipper')} />
        <PartyRow {...partyProps('Consignee')} isMandatory onAddClick={addParty('Consignee')} />
        <PartyRow {...optionalProps('Buyer')} {...sameAsConsignee} onAddClick={addParty('Buyer')} />
        <PartyRow {...optionalProps('Sub Agent')} hasSelf onAddClick={() => setShowSubAgentMaster(true)} />
        <PartyRow {...optionalProps('Overseas Agent')} onAddClick={addParty('Overseas Agent')} />
        <PartyRow {...optionalProps('Notify 1')} {...sameAsConsignee} onAddClick={addParty('Notify 1')} />
        {(partyName('Notify 1') || partyName('Notify 2')) && (
          <PartyRow {...optionalProps('Notify 2')} forceOpen={Boolean(openParties['Notify 2']) && Boolean(partyName('Notify 1'))} {...sameAsConsignee} onAddClick={addParty('Notify 2')} />
        )}
        <IataAgentCard ctx={ctx} fillAgentOci={fillAgentOci} />
        {freeParties.length > 0 && (
          <div className="tw:flex tw:min-h-[26px] tw:min-w-0 tw:flex-wrap tw:items-center tw:gap-x-3.5 tw:gap-y-0.5 tw:self-start tw:rounded-sm tw:border tw:border-border tw:bg-card tw:px-2 tw:py-0.5">
            <span className="tw:text-entry tw:font-semibold tw:text-head">Other parties</span>
            {freeParties.map((title) => (
              <LinkButton key={title} onClick={() => setOpenParties((open) => ({ ...open, [title]: true }))}>+ {title}</LinkButton>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
