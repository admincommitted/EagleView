export const DEFAULT_TERMS = '1. Rates are subject to standard airline fuel & security surcharges.\n2. Payment terms: 30 days from invoice date.\n3. Quotation valid for general cargo only unless specified.';

export const DEFAULT_PREFS = { splitInvoicing: false, consolidatedBilling: false, autoEmailInvoices: true, billingNotes: '' };

export const NEW_CONTRACT_HEADER = { contractNo: '(new)', customer: '', validFrom: '', validTo: '', currency: 'INR', status: 'Draft', salesRep: '' };

export const FREIGHT_SLABS = [
  ['min', 'Min'], ['normal', 'Normal'], ['plus45', '+45 KG'], ['plus100', '+100 KG'], ['plus300', '+300 KG'], ['plus500', '+500 KG'], ['plus1000', '+1000 KG'],
];

export const newFreightRate = (id = Date.now()) => ({
  id, origin: '', destination: '', serviceType: 'General', carrier: '', chargeName: '',
  ...Object.fromEntries(FREIGHT_SLABS.map(([key]) => [key, ''])),
});

export const newLocalCharge = (id = Date.now()) => ({
  id, printName: '', systemLedger: '', appliesTo: 'ALL', basis: 'Flat', rate: '', minAmt: '', maxAmt: '', currency: 'INR', mandatory: false, type: 'Taxable',
});

export const newTransportRate = (id = Date.now()) => ({ id, fromLoc: '', toLoc: '', vehicle: 'Tata Ace', amount: '', currency: 'INR', chargeName: '' });

// Saved numbers come back as numbers or decimal strings ("12.50"); the boxes show them as typed text ("12.5").
const asText = (value) => (value == null ? '' : String(Number.isFinite(Number(value)) && value !== '' ? Number(value) : value));

const savedOr = (rows, blank) => (rows.length ? rows : [blank]);

/** The editor state for a saved contract. */
export function contractToForm(contract) {
  const now = Date.now();
  return {
    header: {
      contractNo: contract.contractNo,
      customer: String(contract.partyId),
      validFrom: contract.validFrom || '',
      validTo: contract.validTo || '',
      currency: contract.currency || 'INR',
      status: contract.status,
      salesRep: contract.salesRep || '',
    },
    freightRates: savedOr((contract.freightRates || []).map((rate) => ({
      ...rate,
      carrier: rate.carrier || '',
      chargeName: rate.chargeName || '',
      ...Object.fromEntries(FREIGHT_SLABS.map(([key]) => [key, asText(rate[key])])),
    })), newFreightRate(now)),
    localCharges: savedOr((contract.charges || []).map((charge) => ({
      ...charge,
      systemLedger: charge.systemLedger || '',
      appliesTo: charge.appliesTo || 'ALL',
      rate: asText(charge.rate),
      minAmt: asText(charge.minAmt),
      maxAmt: asText(charge.maxAmt),
    })), newLocalCharge(now + 1)),
    transportRates: savedOr((contract.transportRates || []).map((route) => ({
      ...route,
      vehicle: route.vehicle || 'Tata Ace',
      amount: asText(route.amount),
      chargeName: route.chargeName || '',
    })), newTransportRate(now + 2)),
    terms: contract.terms || '',
    prefs: {
      splitInvoicing: !!contract.splitInvoicing,
      consolidatedBilling: !!contract.consolidatedBilling,
      autoEmailInvoices: contract.autoEmailInvoices !== false,
      billingNotes: contract.billingNotes || '',
    },
  };
}

export function blankForm() {
  const now = Date.now();
  return {
    header: NEW_CONTRACT_HEADER,
    freightRates: [newFreightRate(now)],
    localCharges: [newLocalCharge(now + 1)],
    transportRates: [newTransportRate(now + 2)],
    terms: DEFAULT_TERMS,
    prefs: DEFAULT_PREFS,
  };
}

export const hasTypedRows = ({ freightRates, localCharges, transportRates }) =>
  freightRates.some((rate) => rate.origin || rate.destination || rate.normal || rate.min)
  || localCharges.some((charge) => charge.printName || charge.rate)
  || transportRates.some((route) => route.fromLoc || route.toLoc || route.amount);

// Picking a customer opens the Active quotation still valid, else the one sent for approval, else the latest draft.
const contractRank = (contract) => {
  if (contract.status === 'Active' && !contract.expired) return 0;
  if (contract.status === 'Pending Approval') return 1;
  return contract.status === 'Draft' ? 2 : 3;
};

export const bestContract = (contracts) => [...contracts].sort((first, second) => contractRank(first) - contractRank(second) || second.id - first.id)[0];
