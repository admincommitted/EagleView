import { useState } from 'react';
import { emptyParties } from '../../savedAwb';

export default function useParties() {
  const [parties, setParties] = useState(emptyParties);
  const [shipperEmail, setShipperEmail] = useState('');
  const [consigneeEmail, setConsigneeEmail] = useState('');
  const [addPartyTitle, setAddPartyTitle] = useState('');
  const [showAddParty, setShowAddParty] = useState(false);

  const handleRequestAddParty = (type, extractedData) => {
    setAddPartyTitle(`Add ${type} Details`);
    setShowAddParty({ isOpen: true, prefillData: extractedData });
  };

  return {
    parties, setParties, shipperEmail, setShipperEmail, consigneeEmail, setConsigneeEmail,
    addPartyTitle, setAddPartyTitle, showAddParty, setShowAddParty, handleRequestAddParty,
  };
}
