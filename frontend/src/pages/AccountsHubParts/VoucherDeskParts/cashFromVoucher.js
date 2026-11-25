import { num, r2 } from './amounts';
import { PAY_BY } from './voucherConfig';

export const blankEntry = () => ({ ledgerId: '', amount: '', currency: 'INR', fcy: '', roe: '', jobNo: '', tdsLedger: '', tdsAmt: '', chgLedger: '', chgAmt: '', remarks: '', allocs: {} });

// Modify / Copy of a receipt or payment opens in the receipt / payment form again. The bank line, each party line, its TDS
// ("TDS - <party>") and bank charges ("Bank charges") lines and the bills set off are read back from the voucher;
// a voucher whose lines do not fit (posted some other way) returns null and opens in the Dr / Cr form instead.
export function cashFromVoucher(voucher, cfg) {
  if (!voucher || !Array.isArray(voucher.lines) || !voucher.lines.length) return null;
  const bankSide = cfg.partySide === 'Dr' ? 'Cr' : 'Dr';
  const lines = voucher.lines.map((line) => ({ ...line, amount: num(line.amount), remarks: line.remarks || '' }));
  const isCharge = (line) => line.dc === 'Dr' && /^bank charges/i.test(line.remarks);
  const isTds = (line) => line.dc === bankSide && /^TDS - /i.test(line.remarks);
  const byAmount = (a, b) => b.amount - a.amount;
  const bankLine = lines.filter((line) => line.dc === bankSide && !isTds(line) && /bank|cash/i.test(line.groupName || '')).sort(byAmount)[0]
    || lines.filter((line) => line.dc === bankSide && !isTds(line)).sort(byAmount)[0];
  if (!bankLine) return null;

  const parties = lines.filter((line) => line !== bankLine && line.dc === cfg.partySide && !isCharge(line));
  const tdsLines = lines.filter((line) => line !== bankLine && isTds(line));
  const chargeLines = lines.filter((line) => line !== bankLine && isCharge(line));
  if (!parties.length || parties.length + tdsLines.length + chargeLines.length + 1 !== lines.length) return null;

  const bankRemarks = String(bankLine.remarks || '');
  const payBy = PAY_BY.find((mode) => bankRemarks.toLowerCase().startsWith(mode.toLowerCase())) || 'NEFT';
  const withoutPayBy = (remarks) => String(remarks || '').replace(new RegExp('^' + payBy.replace(/\W/g, '.') + '\\s*', 'i'), '').replace(/^No \S+\s*/i, '').trim();

  const entries = parties.map((line) => ({
    ...blankEntry(), ledgerId: line.ledgerId, amount: String(line.amount), currency: line.currency || 'INR',
    fcy: line.amountFcy != null ? String(line.amountFcy) : '', roe: line.roe != null ? String(line.roe) : '',
    jobNo: voucher.jobNo || '', remarks: withoutPayBy(line.remarks), allocs: {}, billList: [],
  }));
  tdsLines.forEach((tds) => {
    const partyName = String(tds.remarks).replace(/^TDS - /i, '').trim().toLowerCase();
    const entry = entries.find((_, index) => String(parties[index].ledgerName || '').toLowerCase() === partyName) || entries[0];
    entry.tdsLedger = tds.ledgerId;
    entry.tdsAmt = String(r2(num(entry.tdsAmt) + tds.amount));
  });
  chargeLines.forEach((charge) => {
    const entry = entries[0];
    entry.chgLedger = charge.ledgerId;
    entry.chgAmt = String(r2(num(entry.chgAmt) + charge.amount));
  });
  (voucher.allocations || []).forEach((allocation) => {
    const entry = entries.find((item) => String(item.ledgerId) === String(allocation.ledgerId));
    const billKey = allocation.againstVoucherId || allocation.refNo;
    if (!entry || !billKey) return;
    entry.allocs[billKey] = String(num(allocation.amount));
    entry.billList.push({ voucherId: allocation.againstVoucherId || null, refNo: allocation.againstNo || allocation.refNo, billNo: allocation.refNo, date: allocation.againstDate, amount: num(allocation.amount), pending: num(allocation.amount) });
  });

  const chqNo = voucher.refNo || '';
  const drawee = bankRemarks.split(' ').length > 3 && chqNo ? bankRemarks.split('No ' + chqNo).slice(1).join('').trim() : '';
  const date = String(voucher.date).slice(0, 10);
  return {
    bank: bankLine.ledgerId,
    entries,
    header: {
      date, voucherNumber: voucher.voucherNumber, refNo: '', narration: voucher.narration || '', branchCode: voucher.branchCode || '',
      costCentreId: bankLine.costCentreId || '', payBy, chqNo, chqDate: date, drawee,
    },
  };
}
