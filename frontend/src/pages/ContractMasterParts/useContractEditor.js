import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { askConfirm } from '@/components/common/askConfirm';
import { getParties } from '@/utils/partiesCache';
import { mastersApi, succeeded } from '../MastersParts/mastersApi';
import { bestContract, blankForm, contractToForm, hasTypedRows, newFreightRate, newLocalCharge, newTransportRate } from './contractRows';

const readIsAdmin = () => {
  try {
    return String(JSON.parse(localStorage.getItem('user') || '{}')?.role || '').toLowerCase() === 'admin';
  } catch {
    return false;
  }
};

/** State and server calls of the Customer Contract & Quotation Master (saved in /contracts). */
export default function useContractEditor() {
  const [saving, setSaving] = useState(false);
  const [contractId, setContractId] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [parties, setParties] = useState([]);
  const [gstCharges, setGstCharges] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [isAdmin] = useState(readIsAdmin);

  const loadList = async () => {
    try {
      const body = await mastersApi.contracts();
      if (body.success) setContracts(body.data || []);
    } catch {
      // the saved-contract list stays as it was
    }
  };

  useEffect(() => {
    const loadParties = async () => {
      try {
        const list = await getParties();
        setParties(Array.isArray(list) ? list : list?.data || []);
      } catch {
        // no customer list: the picker stays empty
      }
    };
    const loadGstCharges = async () => {
      try {
        setGstCharges(await mastersApi.gstCharges());
      } catch {
        // without the GST charge list the charge boxes are not checked
      }
    };
    loadList();
    loadParties();
    loadGstCharges();
  }, []);

  const setHeaderField = (name, value) => setForm((current) => ({ ...current, header: { ...current.header, [name]: value } }));
  const setPref = (name, value) => setForm((current) => ({ ...current, prefs: { ...current.prefs, [name]: value } }));
  const setTerms = (terms) => setForm((current) => ({ ...current, terms }));

  const updateList = (listKey, change) => setForm((current) => ({ ...current, [listKey]: change(current[listKey]) }));
  const listActions = (listKey, newRow, keepOneRow = false) => ({
    onAdd: () => updateList(listKey, (rows) => [...rows, newRow()]),
    onRemove: (id) => updateList(listKey, (rows) => (keepOneRow && rows.length <= 1 ? rows : rows.filter((row) => row.id !== id))),
    onUpdate: (id, field, value) => updateList(listKey, (rows) => rows.map((row) => (row.id === id ? { ...row, [field]: value } : row))),
  });

  const startBlank = () => {
    setContractId(null);
    setForm(blankForm());
  };

  const showContract = (contract) => {
    setContractId(contract.id);
    setForm(contractToForm(contract));
  };

  const openContract = async (id) => {
    if (!id) {
      startBlank();
      return;
    }
    try {
      const body = await succeeded(() => mastersApi.contract(id), 'Could not open contract');
      showContract(body.data);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const startNewForCustomer = () => {
    const { customer } = form.header;
    startBlank();
    setHeaderField('customer', customer);
  };

  // Picking a customer brings up that customer's best saved quotation; a customer with none starts a new one.
  const pickParty = async (partyId) => {
    if (!partyId) {
      setHeaderField('customer', '');
      return;
    }
    let partyContracts = [];
    try {
      const body = await mastersApi.contracts({ partyId });
      partyContracts = body.success ? body.data || [] : [];
    } catch {
      partyContracts = [];
    }
    if (!partyContracts.length) {
      if (contractId) startBlank();
      setHeaderField('customer', partyId);
      toast('No saved quotation for this customer - new one started', { icon: 'ℹ️' });
      return;
    }
    setContracts((current) => [...partyContracts, ...current.filter((contract) => !partyContracts.some((mine) => mine.id === contract.id))]);
    const best = bestContract(partyContracts);
    if (String(best.id) === String(contractId)) return;
    if (!contractId && hasTypedRows(form)) {
      const openSaved = await askConfirm({
        title: 'Saved quotation found',
        message: `${best.contractNo} is already saved for this customer. Open it? (rates typed on this screen will be cleared)`,
        okLabel: 'Open it',
        tone: 'warn',
      });
      if (!openSaved) {
        setHeaderField('customer', partyId);
        return;
      }
    }
    await openContract(best.id);
    toast.success(`Saved quotation ${best.contractNo} (${best.status}) loaded${partyContracts.length > 1 ? ` - ${partyContracts.length} saved for this customer` : ''}`);
  };

  const saveContract = async (status = 'Draft') => {
    const { header, terms, prefs, freightRates, localCharges, transportRates } = form;
    if (!header.customer || !header.validTo) {
      toast.error('Customer and Validity are mandatory.');
      return;
    }
    if (header.validFrom && header.validFrom > header.validTo) {
      toast.error('Valid From must be before Valid To');
      return;
    }
    const body = {
      partyId: header.customer, validFrom: header.validFrom, validTo: header.validTo, currency: header.currency, salesRep: header.salesRep,
      terms, ...prefs, freightRates, charges: localCharges, transportRates, submit: status === 'Pending Approval',
    };
    setSaving(true);
    try {
      const { data: saved } = await succeeded(() => mastersApi.saveContract(contractId, body), 'Could not save contract.');
      showContract(saved);
      toast.success(`Contract ${saved.contractNo} saved as ${saved.status}!`);
      loadList();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status) => {
    if (!contractId) return;
    try {
      const { data: changed } = await succeeded(() => mastersApi.setContractStatus(contractId, status), 'Could not change status');
      setHeaderField('status', changed.status);
      toast.success(`Contract ${status === 'Active' ? 'approved' : status.toLowerCase()}`);
      loadList();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteContract = async () => {
    if (!contractId) return;
    const goAhead = await askConfirm({ title: 'Delete contract', message: `Delete contract ${form.header.contractNo}?`, okLabel: 'Delete', tone: 'danger' });
    if (!goAhead) return;
    try {
      await succeeded(() => mastersApi.deleteContract(contractId), 'Delete failed');
      toast.success('Contract deleted');
      startBlank();
      loadList();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return {
    form, contractId, contracts, parties, gstCharges, saving,
    canApprove: isAdmin && form.header.status === 'Pending Approval',
    setHeaderField, setPref, setTerms,
    freightActions: listActions('freightRates', newFreightRate, true),
    chargeActions: listActions('localCharges', newLocalCharge),
    transportActions: listActions('transportRates', newTransportRate),
    openContract, startNewForCustomer, pickParty, saveContract, setStatus, deleteContract,
  };
}
