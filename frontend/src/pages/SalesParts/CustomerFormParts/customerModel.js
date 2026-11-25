import { activeLookups } from '../salesFormat';

export const NEW_CONTACT = {
  name: '', designation: '', department: '', mobile: '', phone: '', email: '', whatsapp: '', isPrimary: false, isDecisionMaker: false, sendQuotes: true,
  birthday: '', anniversary: '', linkedin: '', remarks: '', isActive: true,
};

export const NEW_LANE = {
  service: '', origin: '', originCountry: '', destination: '', destinationCountry: '', commodity: '', hsCode: '', incoterm: '', containerType: '',
  shipmentsPerMonth: '', volumePerShipment: '', volumeUnit: '', isDg: false, isTempControlled: false, currentVendor: '', currentRate: '',
  rateCurrency: 'INR', rateBasis: '', targetRate: '', status: 'OPEN', remarks: '', isActive: true,
};

// 0 / false from the server means "no"; a new row has no value yet and counts as "yes"
export const isOn = (flag) => flag !== false && flag !== 0;

export const competitorNames = (meta) => activeLookups(meta, 'COMPETITOR').map((lookup) => lookup.value);

const cleanLedgerName = (name) => name.replace(/^XX+\s*/i, '').replace(/\s*XX+$/i, '').replace(/\s*[-_]\s*DR\.?$/i, '');

/** Linking the main ledger fills the blank profile fields from it. */
export function mainLedgerPicked(customer, ledger) {
  return {
    ...customer,
    ledgerId: ledger.id,
    ledgerName: ledger.name,
    name: customer.name || cleanLedgerName(ledger.name),
    gstin: customer.gstin || ledger.gstin || '',
    pan: customer.pan || ledger.pan || '',
    state: customer.state || ledger.state || '',
    address: customer.address || ledger.address || '',
    pinCode: customer.pinCode || ledger.pinCode || '',
    email: customer.email || ledger.email || '',
    phone: customer.phone || ledger.phone || '',
    branchCode: customer.branchCode || ledger.dealingBranch || '',
    creditDaysAsked: customer.creditDaysAsked || ledger.creditDays || '',
  };
}
