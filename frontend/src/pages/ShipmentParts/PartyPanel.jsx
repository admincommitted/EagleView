import { Input, SelectBox } from '@/components/ui';
import { CheckField, FormGrid, GridCell, GridField, Panel } from './layout';
import { MasterLookup, PartyLookup } from './MasterLookup';
import { blankable, textProps, valueProps } from './formBindings';
import { OPTIONS } from './shipmentForm';

const upperState = (state) => String(state).toUpperCase();

// a party box whose label carries a "same as ..." tick (Notify = Importer, Seller = Supplier)
function SameAsField({ label, sameLabel, same, onSameChange, children }) {
  return (
    <GridCell span={2} className="tw:flex tw:flex-col tw:gap-0.5">
      <div className="tw:flex tw:items-center tw:gap-2 tw:text-[11px] tw:font-bold tw:text-muted-foreground">
        {label}
        <CheckField label={sameLabel} checked={same} onCheckedChange={onSameChange} className="tw:h-auto" />
      </div>
      {children}
    </GridCell>
  );
}

export default function PartyPanel({ form }) {
  const { shipment, isImport, labels, setValue, setShipment } = form;
  const setData = (key) => (value) => setValue('data.' + key, value);
  const pickName = (key) => (party) => setValue(key, party.name);

  const changeMainParty = (name) => setShipment((current) => ({
    ...current,
    mainParty: name,
    mainPartyId: null,
    ...(current.data.notifySame && { notifyParty: name }),
    ...(current.billingType === labels.main && { billingParty: name }),
  }));
  const pickMainAddress = (address) => setShipment((current) => ({
    ...current,
    mainAddress: address.address,
    ...(current.data.notifySame && { data: { ...current.data, notifyAddress: address.address } }),
    ...(current.billingParty === current.mainParty && { billingAddress: address.address }),
    ...(!current.placeOfSupply && address.state && { placeOfSupply: upperState(address.state) }),
  }));
  const pickMainParty = (party) => setShipment((current) => ({
    ...current,
    mainParty: party.name,
    mainPartyId: party.id,
    mainAddress: party.address,
    ...(!current.marketingPerson && party.marketingPerson && { marketingPerson: party.marketingPerson }),
    ...(!current.placeOfSupply && party.state && { placeOfSupply: upperState(party.state) }),
    ...(current.data.notifySame && { notifyParty: party.name, data: { ...current.data, notifyAddress: party.address } }),
    ...((current.data.billingSame || !current.billingParty || current.billingType === labels.main)
      && { billingParty: party.name, billingAddress: party.address, billingType: current.billingType || labels.main }),
  }));
  const changeMainAddress = (address) => setShipment((current) => ({
    ...current,
    mainAddress: address,
    ...(current.data.notifySame && { data: { ...current.data, notifyAddress: address } }),
    ...(current.billingType === labels.main && { billingAddress: address }),
  }));

  const changeOtherParty = (name) => setShipment((current) => ({
    ...current,
    otherParty: name,
    ...(current.billingType === labels.other && { billingParty: name }),
    ...(current.data.sellerSame && { data: { ...current.data, seller: name } }),
  }));
  const pickOtherParty = (party) => setShipment((current) => ({
    ...current,
    otherParty: party.name,
    ...(current.billingType === labels.other && { billingParty: party.name, billingAddress: party.address }),
    data: { ...current.data, otherAddress: party.address, ...(current.data.sellerSame && { seller: party.name }) },
  }));

  // party picked together with its address kept under data
  const pickWithAddress = (nameKey, addressKey) => (party) => setShipment((current) => ({
    ...current,
    [nameKey]: party.name,
    data: { ...current.data, [addressKey]: party.address },
  }));

  const setNotifySame = (same) => setShipment((current) => ({
    ...current,
    notifyParty: same ? current.mainParty : current.notifyParty,
    data: { ...current.data, notifySame: same, notifyAddress: same ? current.mainAddress : current.data.notifyAddress },
  }));
  const setSellerSame = (same) => setShipment((current) => ({
    ...current,
    data: { ...current.data, sellerSame: same, seller: same ? current.otherParty : current.data.seller },
  }));

  const billingFrom = {
    [labels.main]: (current) => ({ billingParty: current.mainParty, billingAddress: current.mainAddress }),
    [labels.other]: (current) => ({ billingParty: current.otherParty, billingAddress: current.data.otherAddress }),
    'Overseas Agent': (current) => ({ billingParty: current.overseasAgent, billingAddress: current.data.overseasAddress }),
    SubAgent: (current) => ({ billingParty: current.subAgent, billingAddress: current.data.subAgentAddress }),
  };
  const changeBillingType = (billingType) => setShipment((current) => ({
    ...current,
    billingType,
    ...billingFrom[billingType]?.(current),
  }));
  const pickBilling = (party) => setShipment((current) => ({
    ...current,
    billingParty: party.name,
    billingAddress: party.address,
    ...(party.state && { placeOfSupply: upperState(party.state) }),
  }));
  const pickBillingAddress = (address) => setShipment((current) => ({
    ...current,
    billingAddress: address.address,
    ...(address.state && { placeOfSupply: upperState(address.state) }),
  }));

  return (
    <Panel title="Party Details">
      <FormGrid columns={8}>
        <GridField label={labels.main} required span={2}>
          <PartyLookup type={isImport ? 'consignee' : 'shipper'} value={shipment.mainParty} mandatory onText={changeMainParty} onAddress={pickMainAddress} onPick={pickMainParty} />
        </GridField>
        <GridField label="Address" span={2}><Input value={shipment.mainAddress} onChange={(event) => changeMainAddress(event.target.value)} /></GridField>
        <GridField label={labels.other} span={2}>
          <PartyLookup type="foreign" value={shipment.otherParty} onText={changeOtherParty} onAddress={(address) => setData('otherAddress')(address.address)} onPick={pickOtherParty} />
        </GridField>
        <GridField label={isImport ? 'Broker' : 'Buyer'} span={2}>
          <PartyLookup type={isImport ? '' : 'buyer'} value={shipment.data.broker} onText={setData('broker')} onPick={pickName('data.broker')} />
        </GridField>
        <GridField label="Sub Agent1" span={2}>
          <PartyLookup type="subagent" value={shipment.subAgent} onText={(name) => setValue('subAgent', name)} onAddress={(address) => setData('subAgentAddress')(address.address)} onPick={pickWithAddress('subAgent', 'subAgentAddress')} />
        </GridField>
        <GridField label="Address" span={2}><Input {...textProps(form, 'data.subAgentAddress')} /></GridField>
        <GridField label="Sub Agent2" span={2}>
          <PartyLookup type="subagent" value={shipment.data.subAgent2} onText={setData('subAgent2')} onPick={pickName('data.subAgent2')} />
        </GridField>
        <GridField label="CHA" span={2}>
          <MasterLookup what="cha" value={shipment.cha} onText={(name) => setValue('cha', name)} onPick={pickName('cha')} placeholder="CHA master" />
        </GridField>
        <GridField label="OverSeas Agt" span={2}>
          <PartyLookup type="overseas" value={shipment.overseasAgent} onText={(name) => setValue('overseasAgent', name)} onAddress={(address) => setData('overseasAddress')(address.address)} onPick={pickWithAddress('overseasAgent', 'overseasAddress')} />
        </GridField>
        <GridField label="Address" span={2}><Input {...textProps(form, 'data.overseasAddress')} /></GridField>
        <GridField label="OverSeas Agt2" span={2}>
          <PartyLookup type="overseas" value={shipment.data.overseasAgent2} onText={setData('overseasAgent2')} onPick={pickName('data.overseasAgent2')} />
        </GridField>
        <GridField label="Routed By" span={2}>
          <PartyLookup value={shipment.data.routedBy} onText={setData('routedBy')} onPick={pickName('data.routedBy')} />
        </GridField>
        <SameAsField label="Notify" sameLabel={'same as ' + labels.main} same={shipment.data.notifySame} onSameChange={setNotifySame}>
          <PartyLookup type="notify" value={shipment.notifyParty} disabled={Boolean(shipment.data.notifySame)} onText={(name) => setValue('notifyParty', name)} onAddress={(address) => setData('notifyAddress')(address.address)} onPick={pickWithAddress('notifyParty', 'notifyAddress')} />
        </SameAsField>
        <GridField label="Notify Address" span={2}><Input {...textProps(form, 'data.notifyAddress')} /></GridField>
        <SameAsField label={isImport ? 'Seller' : 'Manufacturer'} sameLabel={'same as ' + labels.other} same={shipment.data.sellerSame} onSameChange={setSellerSame}>
          <PartyLookup type={isImport ? 'foreign' : 'shipper'} value={shipment.data.seller} disabled={Boolean(shipment.data.sellerSame)} onText={setData('seller')} onPick={pickName('data.seller')} />
        </SameAsField>
        <GridField label="Billing Type">
          <SelectBox {...blankable} value={shipment.billingType} onValueChange={changeBillingType} options={[labels.main, labels.other, 'Overseas Agent', 'SubAgent', 'Other']} />
        </GridField>
        <GridField label="Billing Cust." span={2}>
          <PartyLookup value={shipment.billingParty} onText={(name) => setValue('billingParty', name)} onAddress={pickBillingAddress} onPick={pickBilling} />
        </GridField>
        <GridField label="Billing Address" span={3}><Input {...textProps(form, 'billingAddress')} /></GridField>
        <GridField label="Cost Center">
          <MasterLookup what="costcentre" value={shipment.costCentre} onText={(name) => setValue('costCentre', name)} onPick={pickName('costCentre')} noAdd />
        </GridField>
        <GridField label="Actl Shipper" span={2}>
          <PartyLookup type={isImport ? 'foreign' : 'shipper'} value={shipment.data.actualShipper} onText={setData('actualShipper')} onPick={pickName('data.actualShipper')} />
        </GridField>
        <GridField label="Actl Consignee" span={2}>
          <PartyLookup type={isImport ? 'consignee' : 'foreign'} value={shipment.data.actualConsignee} onText={setData('actualConsignee')} onPick={pickName('data.actualConsignee')} />
        </GridField>
        <GridField label="OBL Type"><SelectBox {...blankable} {...valueProps(form, 'data.oblType')} options={OPTIONS.oblType} /></GridField>
        <GridField label="Forwarder" span={2}>
          <PartyLookup value={shipment.data.forwarder} onText={setData('forwarder')} onPick={pickName('data.forwarder')} />
        </GridField>
      </FormGrid>
    </Panel>
  );
}
