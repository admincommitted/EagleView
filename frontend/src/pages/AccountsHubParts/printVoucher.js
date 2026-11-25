// Printed voucher (Receipt / Payment / Journal / Purchase): a print window with the voucher in a plain A4 layout -
// header, particulars Dr / Cr, amount in words, narration, signatures.
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const twoDigitWords = (number) => (number < 20 ? ONES[number] : TENS[Math.floor(number / 10)] + (number % 10 ? ' ' + ONES[number % 10] : ''));
const threeDigitWords = (number) => (number >= 100
  ? ONES[Math.floor(number / 100)] + ' Hundred' + (number % 100 ? ' ' + twoDigitWords(number % 100) : '')
  : twoDigitWords(number));

// Indian numbering: crore, lakh, thousand
export function inWords(amount) {
  const absolute = Math.abs(Number(amount) || 0);
  let rupees = Math.floor(absolute);
  const paise = Math.round((absolute - rupees) * 100);
  if (!rupees && !paise) return 'Zero';
  const crore = Math.floor(rupees / 1e7); rupees %= 1e7;
  const lakh = Math.floor(rupees / 1e5); rupees %= 1e5;
  const thousand = Math.floor(rupees / 1e3); rupees %= 1e3;
  const parts = [];
  if (crore) parts.push(threeDigitWords(crore) + ' Crore');
  if (lakh) parts.push(twoDigitWords(lakh) + ' Lakh');
  if (thousand) parts.push(twoDigitWords(thousand) + ' Thousand');
  if (rupees) parts.push(threeDigitWords(rupees));
  return 'Rupees ' + (parts.join(' ') || 'Zero') + (paise ? ' and ' + twoDigitWords(paise) + ' Paise' : '') + ' Only';
}

export const escapeHtml = (text) => String(text ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const slashDate = (date) => {
  const text = String(date || '').slice(0, 10);
  const [year, month, day] = text.split('-');
  return day ? `${day}/${month}/${year}` : text;
};
// one element of a printed HTML page
export const markup = (tag, inner = '', attributes = '') => `<${tag}${attributes ? ' ' + attributes : ''}>${inner}</${tag}>`;
const sideTotal = (lines, side) => lines.filter((line) => line.dc === side).reduce((sum, line) => sum + Number(line.amount || 0), 0);

const PRINT_CSS = `
  @page { size: A4; margin: 14mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; }
  .head { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  .co { font-size: 18px; font-weight: 800; } .vt { font-size: 14px; font-weight: 700; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
  .meta { display: flex; justify-content: space-between; margin: 8px 0 12px; } .meta div { line-height: 1.6; } .meta .right { text-align: right; }
  table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #555; padding: 6px 8px; vertical-align: top; }
  th { background: #eee; text-align: left; } .n { text-align: right; white-space: nowrap; width: 120px; } .sub { font-size: 10px; color: #444; margin-top: 2px; }
  tfoot td { font-weight: 800; } .box { margin-top: 10px; } .sign { display: flex; justify-content: space-between; margin-top: 60px; }
  .sign div { border-top: 1px solid #111; padding-top: 4px; width: 28%; text-align: center; }`;

function particularsRow(line) {
  const foreign = line.currency && line.currency !== 'INR' && line.amountFcy
    ? `<div class="sub">${escapeHtml(line.currency)} ${money(line.amountFcy)} @ ${escapeHtml(line.roe)}</div>` : '';
  const remarks = line.remarks ? `<div class="sub">${escapeHtml(line.remarks)}</div>` : '';
  const particulars = (line.dc === 'Cr' ? '&nbsp;&nbsp;&nbsp;To ' : 'By ') + escapeHtml(line.ledgerName || line.name) + remarks + foreign;
  return markup('tr', markup('td', particulars)
    + markup('td', line.dc === 'Dr' ? money(line.amount) : '', 'class="n"')
    + markup('td', line.dc === 'Cr' ? money(line.amount) : '', 'class="n"'));
}

export function printVoucher(voucher, company) {
  const lines = voucher.lines || [];
  const debit = sideTotal(lines, 'Dr');
  const credit = sideTotal(lines, 'Cr');
  const allocations = voucher.allocations || [];
  const bills = allocations.length
    ? `<div class="box"><b>Set against bills:</b> ${allocations.map((bill) => escapeHtml(bill.againstNo || bill.refNo || bill.refType) + ' (' + money(bill.amount) + ')').join(', ')}</div>`
    : '';
  const particulars = markup('table',
    markup('thead', markup('tr', markup('th', 'Particulars') + markup('th', 'Debit (Rs)', 'class="n"') + markup('th', 'Credit (Rs)', 'class="n"')))
    + markup('tbody', lines.map(particularsRow).join(''))
    + markup('tfoot', markup('tr', markup('td', 'Total') + markup('td', money(debit), 'class="n"') + markup('td', money(credit), 'class="n"'))));

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(voucher.typeName)} ${escapeHtml(voucher.voucherNumber)}</title>
<style>${PRINT_CSS}</style></head><body>
<div class="head"><div class="co">${escapeHtml(company || 'COMMITTED CARGO CARE LIMITED')}</div><div class="vt">${escapeHtml(voucher.typeName)} Voucher</div></div>
<div class="meta"><div><b>Voucher No:</b> ${escapeHtml(voucher.voucherNumber)}<br><b>Ref / Chq No:</b> ${escapeHtml(voucher.refNo || '-')}<br><b>Job No:</b> ${escapeHtml(voucher.jobNo || '-')}</div>
<div class="right"><b>Date:</b> ${slashDate(voucher.date)}<br><b>Branch:</b> ${escapeHtml(voucher.branchCode || '-')}<br><b>Status:</b> ${escapeHtml(voucher.status || 'Pending')}</div></div>
${particulars}
<div class="box"><b>Amount in words:</b> ${inWords(debit)}</div>
${bills}
<div class="box"><b>Narration:</b> ${escapeHtml(voucher.narration || '-')}</div>
<div class="sign"><div>Prepared by${voucher.createdByName ? '<br>' + escapeHtml(voucher.createdByName) : ''}</div><div>Checked by</div><div>Authorised signatory</div></div>
<script>window.onload = function () { window.print(); };</script></body></html>`;

  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
