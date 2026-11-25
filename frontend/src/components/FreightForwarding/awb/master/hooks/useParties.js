import { useState } from 'react';
import { emptyParties } from '../../savedAwb';

export default function useParties() {
  const [parties, setParties] = useState(emptyParties);
  const [shipperEmail, setShipperEmail] = useState('');
  const [consigneeEmail, setConsigneeEmail] = useState('');
  const [showAddParty, setShowAddParty] = useState(false);
  const [addPartyTitle, setAddPartyTitle] = useState('');
  const [showSubAgentMaster, setShowSubAgentMaster] = useState(false);
  const [showOverseasMaster, setShowOverseasMaster] = useState(false);

  const handleRequestAddParty = (type, extractedData) => {
    setAddPartyTitle(`Add ${type} Details`);
    setShowAddParty({ isOpen: true, prefillData: extractedData });
  };

  return {
    parties, setParties, shipperEmail, setShipperEmail, consigneeEmail, setConsigneeEmail,
    showAddParty, setShowAddParty, addPartyTitle, setAddPartyTitle, handleRequestAddParty,
    showSubAgentMaster, setShowSubAgentMaster, showOverseasMaster, setShowOverseasMaster,
  };
}
