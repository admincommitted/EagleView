import { num } from '../VoucherDeskParts/amounts';
import { addDays, blankCharge, nearestSlab } from './purchaseConfig';

const isGstName = (name) => /\b(i|c|s|ut)?gst\b|rcm/i.test(String(name || ''));

// Modify / Copy of a saved bill or vendor credit note opens in the purchase form again. Charges are read back from
// the expense lines (remarks "Rec <charge> SAC <sac> Job <job>"), GST from the GST lines, the rest from the bill details.
export function purchaseFromVoucher(voucher) {
  if (!voucher || !Array.isArray(voucher.lines) || !voucher.lines.length) return null;
  const info = voucher.purchase || {};
  const creditNote = voucher.baseType === 'Debit Note' || info.kind === 'cn';
  const vendorSide = creditNote ? 'Dr' : 'Cr';
  const expenseSide = creditNote ? 'Cr' : 'Dr';
  const lines = voucher.lines.map((line) => ({ ...line, amount: num(line.amount), remarks: line.remarks || '', tax: /duties|tax/i.test(line.groupName || '') }));
  const vendorLine = lines.find((line) => line.dc === vendorSide && /^(bill|credit note) /i.test(line.remarks))
    || lines.find((line) => line.dc === vendorSide && /creditor/i.test(line.groupName || ''))
    || lines.filter((line) => line.dc === vendorSide && !line.tax && !/round off/i.test(line.ledgerName || '')).sort((a, b) => b.amount - a.amount)[0];
  if (!vendorLine) return null;

  const gstLines = lines.filter((line) => line !== vendorLine && line.tax && isGstName(line.ledgerName));
  const tdsLines = lines.filter((line) => line !== vendorLine && line.tax && /tds/i.test(line.ledgerName || ''));
  const roundOffLines = lines.filter((line) => line !== vendorLine && /round off/i.test(line.ledgerName || ''));
  const chargeLines = lines.filter((line) => line !== vendorLine && !gstLines.includes(line) && !tdsLines.includes(line) && !roundOffLines.includes(line));
  if (!chargeLines.length) return null;

  const rcm = gstLines.some((line) => /rcm/i.test(line.ledgerName));
  const taxable = chargeLines.reduce((total, line) => total + (line.dc === expenseSide ? line.amount : -line.amount), 0);
  const gstPaid = gstLines.filter((line) => line.dc === expenseSide && (!rcm || /input/i.test(line.ledgerName))).reduce((total, line) => total + line.amount, 0);
  const gstReversed = rcm ? 0 : gstLines.filter((line) => line.dc !== expenseSide).reduce((total, line) => total + line.amount, 0);
  const gst = gstPaid - gstReversed;
  const percent = taxable ? gst / taxable * 100 : 0;
  const slab = gst ? nearestSlab(percent, '18') : (Number(info.isSez) && info.sezType === 'lut' ? '18' : '0');

  const charges = chargeLines.map((line) => {
    let remarks = line.remarks.replace(/^Rec\s+/i, '');
    const sac = (remarks.match(/\bSAC (\S+)/) || [])[1] || '';
    const job = (remarks.match(/\bJob (\S+)/) || [])[1] || '';
    remarks = remarks.replace(/\s*\bSAC \S+/, '').replace(/\s*\bJob \S+/, '').trim();
    const foreign = line.currency && line.currency !== 'INR' && num(line.amountFcy);
    return {
      ...blankCharge(), charge: remarks || line.ledgerName, ledgerId: line.ledgerId, sac, pr: line.dc === expenseSide ? 'Pay' : 'Rec',
      currency: foreign ? line.currency : 'INR', roe: foreign ? String(line.roe || '') : '1', qty: '1', rate: String(foreign ? num(line.amountFcy) : line.amount),
      gstRate: slab, jobNo: job || voucher.jobNo || '',
    };
  });

  const date = String(voucher.date).slice(0, 10);
  return {
    mode: creditNote ? 'cn' : 'bill',
    vendor: vendorLine.ledgerId,
    vendorAmount: vendorLine.amount,
    lines: charges,
    roundOff: roundOffLines.length > 0 || Math.abs(vendorLine.amount - Math.round(vendorLine.amount)) < 0.001,
    tdsSecs: [info.tds1Section || (tdsLines[0] && (String(tdsLines[0].remarks).match(/\b19\d[A-Z]*\b/) || [])[0]) || '', info.tds2Section || ''],
    tdsAmts: [num(info.tds1Amount) || (tdsLines[0] ? tdsLines[0].amount : 0), num(info.tds2Amount)],
    h: {
      voucherNumber: voucher.voucherNumber, date, billNo: info.billNo || voucher.refNo || '', billDate: String(info.billDate || voucher.date).slice(0, 10),
      dueDate: String(info.dueDate || addDays(date, 30)).slice(0, 10), jobNo: voucher.jobNo || '', narration: voucher.narration || '',
      supply: gstLines.some((line) => /igst/i.test(line.ledgerName)) ? 'inter' : 'intra', branchCode: voucher.branchCode || '', hblNo: info.hblNo || '', mblNo: info.mblNo || '',
      isSez: Number(info.isSez) === 1, sezType: info.sezType || 'igst', hold: Number(info.holdPayment) === 1, holdReason: info.holdReason || '',
      against: info.againstVoucherId ? String(info.againstVoucherId) : '', cnReason: info.cnReason || '',
    },
  };
}
