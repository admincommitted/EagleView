import { useMemo } from 'react';
import toast from 'react-hot-toast';
import { ComboInput, Field, Input, Modal } from '@/components/ui';

const ADDRESS_LINES = ['address1', 'address2', 'address3', 'address4'];
const MAX_ADDRESS3 = 35;

const isBuyerParty = (party) => party.isBuyer || party.isConsignee;
const nameMatches = (party, query) => String(party.name || '').toLowerCase().includes(query.toLowerCase());
const partyOption = (party) => (
  <span className="tw:flex tw:flex-col">
    <b className="tw:text-[11px] tw:text-primary">{party.name}</b>
    <span className="tw:text-[10px] tw:text-muted-foreground">{party.street}, {party.city}</span>
  </span>
);

export default function BuyerDetailsModal({ ctx }) {
  const { buyerDetails, setBuyerDetails, parties, setFormData, showBuyerModal, setShowBuyerModal, setConsigneeSame } = ctx;
  const buyerOptions = useMemo(() => [...parties.filter(isBuyerParty), ...parties.filter((party) => !isBuyerParty(party))], [parties]);
  const setDetail = (key, value) => setBuyerDetails((previous) => ({ ...previous, [key]: value }));

  const pickParty = (party) => {
    const branch = party.branches?.length ? party.branches.find((row) => row.isDefault) || party.branches[0] : null;
    setBuyerDetails((previous) => ({
      ...previous,
      name: party.name,
      address1: branch?.address1 || party.street || '',
      address2: branch?.address2 || '',
      address3: [branch?.city || party.city, branch?.state || party.stateProvince, branch?.pinCode || party.zipPostcode].filter(Boolean).join(' ').slice(0, MAX_ADDRESS3),
      address4: party.countryCode || '',
      city: branch?.city || party.city || '',
    }));
  };

  // the buyer fields of the invoice
  const confirm = () => {
    if (!String(buyerDetails.name || '').trim()) {
      toast.error('Enter the buyer name');
      return;
    }
    setFormData((previous) => ({
      ...previous,
      buyer: buyerDetails.name, buyerName: buyerDetails.name,
      buyerAddress1: buyerDetails.address1 || '', buyerAddress2: buyerDetails.address2 || '',
      buyerAddress3: buyerDetails.address3 || '', buyerAddress4: buyerDetails.address4 || '', buyerCity: buyerDetails.city || '',
    }));
    setShowBuyerModal(false);
  };
  const cancel = () => {
    setShowBuyerModal(false);
    if (!String(buyerDetails.name || '').trim()) setConsigneeSame('Y');
  };

  return (
    <Modal open={showBuyerModal} title="Buyer Details" width={500} closeOnOutside={false} onOk={confirm} onClose={cancel}>
      <Field label="Buyer Name" required labelWidth="100px">
        <ComboInput required placeholder="BUYER NAME" options={buyerOptions} getValue={(party) => party.name} filter={nameMatches} renderOption={partyOption}
          value={buyerDetails.name} onValueChange={(name) => setDetail('name', name)} onSelect={pickParty} />
      </Field>
      {ADDRESS_LINES.map((key, index) => (
        <Field key={key} label={`Address${index + 1}`} labelWidth="100px">
          <Input data-allow-text="" placeholder={`ADDRESS ${index + 1}`} value={buyerDetails[key]} onChange={(event) => setDetail(key, event.target.value)} />
        </Field>
      ))}
    </Modal>
  );
}
