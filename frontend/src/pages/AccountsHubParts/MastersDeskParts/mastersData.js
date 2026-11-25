import { downloadBlob } from '@/lib/download';
import { inr } from '../ui';

export const NATURES = ['Assets', 'Liabilities', 'Income', 'Expenses'];
export const STATES = [['01', 'Jammu & Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'], ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'],
  ['10', 'Bihar'], ['11', 'Sikkim'], ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'], ['18', 'Assam'], ['19', 'West Bengal'],
  ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'], ['24', 'Gujarat'], ['26', 'Dadra & Nagar Haveli and Daman & Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'],
  ['30', 'Goa'], ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'], ['35', 'Andaman & Nicobar Islands'], ['36', 'Telangana'], ['37', 'Andhra Pradesh'], ['38', 'Ladakh'], ['97', 'Other Territory']];
export const STATE_OPTIONS = STATES.map(([code, name]) => ({ value: name, label: code + ' - ' + name }));
export const stateOfGstin = (gstin) => (STATES.find(([code]) => code === String(gstin || '').slice(0, 2)) || [])[1] || '';
export const balanceText = (balance, side) => (balance ? inr(balance) + ' ' + side : '0.00');
export const BUSINESS_TYPES = ['Exporter', 'Importer', 'Exporter & Importer', 'Freight Forwarder', 'Airline', 'Shipping Line', 'Transporter', 'CHA', 'Overseas Agent', 'Vendor', 'Employee', 'Other'];

// "Group > Sub group > ..." of a group; byId: Map of the groups
export const MAX_GROUP_DEPTH = 20;
export function groupPath(group, byId) {
  const names = [];
  let current = group;
  let depth = 0;
  while (current && depth++ < MAX_GROUP_DEPTH) { names.unshift(current.name); current = byId.get(current.parentId); }
  return names.join(' > ');
}

const csvCell = (value) => { const text = String(value ?? ''); return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text; };
// cols: [[key or (row) => value, header]]; with a BOM so Excel reads the names right
export function downloadCsvFile(name, cols, rows) {
  const lines = [cols.map((col) => csvCell(col[1])).join(',')].concat(rows.map((row) => cols.map(([field]) => csvCell(typeof field === 'function' ? field(row) : row[field])).join(',')));
  downloadBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }), name + '.csv');
}

export const blankLedger = (groupId = '') => ({
  name: '', groupId, openingBalance: '', balanceType: 'Dr', creditDays: '', creditLimit: '', maintainBillByBill: 0, costCentresApplicable: 0,
  isGstApplicable: 0, gstin: '', pan: '', hsnSac: '', taxability: '', gstRate: '', isTdsApplicable: 0, tdsNatureId: '', deducteeType: '', isTdsDeductible: 0,
  address: '', state: '', pinCode: '', country: 'India', contactPerson: '', phone: '', email: '', bankName: '', bankAccount: '', bankIfsc: '',
  accountType: 'Personal', accountCode: '', dealingBranch: '', monthlyBudget: '', creditMode: 'Credit', businessType: '', isUnregistered: 0, isBlacklisted: 0, blacklistReason: '',
  isComposite: 0, isFixedDeposit: 0, isTdsExempt: 0, partyTdsLedgerId: '', msmeNo: '', msmeType: '', msmeActivity: '', msmeAgreementDays: '', isActive: 1,
});
// read-only fields of an opened ledger that are not sent back on Save
export const LEDGER_READ_ONLY = ['addresses', 'banks', 'openings', 'groupName', 'nature', 'balance', 'side', 'entries', 'totalDr', 'totalCr', 'lastEntry', 'partyTdsLedgerName', 'createdAt', 'updatedAt', 'createdByName', 'modifiedByName'];

// addresses / bank accounts / opening bills of a ledger
export const CHILD_FORMS = {
  addresses: {
    title: 'Addresses', blank: { label: '', address: '', city: '', state: '', pinCode: '', country: 'India', gstin: '', contactPerson: '', phone: '', email: '', isDefault: 0 },
    cols: [['label', 'Label'], ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['gstin', 'GSTIN'], ['contactPerson', 'Contact'], ['phone', 'Phone']],
  },
  banks: {
    title: 'Bank accounts', blank: { bankName: '', accountName: '', accountNo: '', ifsc: '', branch: '', swift: '', isDefault: 0 },
    cols: [['bankName', 'Bank'], ['accountName', 'Account name'], ['accountNo', 'Account no'], ['ifsc', 'IFSC'], ['branch', 'Branch'], ['swift', 'SWIFT']],
  },
  openings: {
    title: 'Opening bills', blank: { docNo: '', docDate: '', dueDate: '', dc: 'Dr', amount: '', jobNo: '', remarks: '' },
    cols: [['docNo', 'Bill / Doc No'], ['docDate', 'Bill Date'], ['dueDate', 'Due Date'], ['dc', 'Dr/Cr'], ['amount', 'Amount'], ['jobNo', 'Job No'], ['remarks', 'Remarks']],
  },
};
