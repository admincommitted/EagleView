import { accountsApi } from '../accountsApi';
import { PURCHASE_DESKS } from '../PurchaseDeskParts/purchaseConfig';
import { num } from './amounts';

// iCAFFE numbering: the voucher no comes from the branch + division series (BA / CA / JN) and is given on Save.
// The division comes from the job no (NDL/AE/...) or is chosen.
export const DIV_OPTS = [['AE', 'Export Air'], ['AI', 'Import Air'], ['SE', 'Export Sea'], ['SI', 'Import Sea']];
export const DIVISION_OPTIONS = DIV_OPTS.map(([code, label]) => ({ value: code, label: code + ' - ' + label }));
export const divFrom = (jobNo) => {
  const match = /(?:^|\/|-)(AE|AI|SE|SI)(?:\/|-|$)/.exec(String(jobNo || '').toUpperCase());
  return match ? match[1] : '';
};
export const nextVoucherNo = (typeId, query) => accountsApi.voucherDeskNextNumber(typeId, Object.fromEntries(Object.entries(query).filter(([, value]) => value)));

export const BANK_GROUPS = 'Bank Accounts,Cash-in-Hand,Bank OD A/c';
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'HKD', 'SAR'];
export const PAY_BY = ['Cheque', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'Cash', 'DD', 'Wire transfer'];
export const DR_CR = ['Dr', 'Cr'];

export const DESKS = {
  receipt: { base: 'Receipt', title: 'Receipt', mode: 'cash', partySide: 'Cr', pending: 'receivable' },
  payment: { base: 'Payment', title: 'Payment', mode: 'cash', partySide: 'Dr', pending: 'payable' },
  remittance: { base: 'Receipt', title: 'Remittance', mode: 'cash', fcy: true, partySide: 'Cr', pending: 'receivable', filterFcy: true },
  remonaccount: { base: 'Receipt', title: 'Remittance (On Account)', mode: 'cash', fcy: true, onAccount: true, partySide: 'Cr', pending: 'receivable', filterFcy: true },
  contra: { base: 'Contra', title: 'Contra Voucher', mode: 'lines', banksOnly: true },
  journal: { base: 'Journal', title: 'Journal Voucher', mode: 'lines' },
  interbranch: { base: 'Journal', title: 'Inter Branch Transfer', mode: 'lines', branch: true },
  ...Object.fromEntries(Object.entries(PURCHASE_DESKS).map(([desk, purchase]) => [desk, {
    base: 'Purchase', searchBase: 'Purchase,Debit Note', desk, title: purchase.title, mode: 'purchase', job: purchase.needJob ? 'yes' : 'no',
  }])),
};

// the desk's own filters every voucher search carries
export const deskSearchParams = (cfg) => ({
  base: cfg.searchBase || cfg.base,
  ...(cfg.job && { job: cfg.job }),
  ...(cfg.filterFcy && { fcy: '1' }),
  ...(cfg.desk && { desk: cfg.desk }),
});

// "NAME~Dr~1000|NAME2~Cr~1000" from the voucher search
export const accountsOf = (voucher) => String(voucher.accounts || '').split('|').filter(Boolean).map((part) => {
  const [name, dc, amount] = part.split('~');
  return { name, dc, amount: num(amount) };
});

export const sampleFileName = (title) => title.toLowerCase().replace(/\W+/g, '_') + '_sample';

export const voucherIdFromSave = (result) => result?.data?.id || result?.id;
