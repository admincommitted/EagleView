// 04-Nov-2026: printed voucher (iCAFFE "Print" on Receipt / Payment / Journal / Purchase) - opens a print window with
// the voucher in a plain A4 layout: header, particulars Dr / Cr, amount in words, narration, signatures.
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n) => (n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : ''));
const three = (n) => (n >= 100 ? ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : '') : two(n));
export function inWords(amount) {
  const a = Math.abs(Number(amount) || 0); let r = Math.floor(a); const p = Math.round((a - r) * 100);
  if (!r && !p) return 'Zero';
  const parts = []; const cr = Math.floor(r / 1e7); r %= 1e7; const lk = Math.floor(r / 1e5); r %= 1e5; const th = Math.floor(r / 1e3); r %= 1e3;
  if (cr) parts.push(three(cr) + ' Crore'); if (lk) parts.push(two(lk) + ' Lakh'); if (th) parts.push(two(th) + ' Thousand'); if (r) parts.push(three(r));
  return 'Rupees ' + (parts.join(' ') || 'Zero') + (p ? ' and ' + two(p) + ' Paise' : '') + ' Only';
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const d8 = (d) => { const s = String(d || '').slice(0, 10); const [y, m, dd] = s.split('-'); return dd ? `${dd}/${m}/${y}` : s; };

export function printVoucher(v, company) {
  const lines = v.lines || [];
  const dr = lines.filter(l => l.dc === 'Dr').reduce((s, l) => s + Number(l.amount || 0), 0);
  const cr = lines.filter(l => l.dc === 'Cr').reduce((s, l) => s + Number(l.amount || 0), 0);
  const rows = lines.map(l => `<tr><td>${l.dc === 'Cr' ? '&nbsp;&nbsp;&nbsp;To ' : 'By '}${esc(l.ledgerName || l.name)}${l.remarks ? `<div class="sub">${esc(l.remarks)}</div>` : ''}${l.currency && l.currency !== 'INR' && l.amountFcy ? `<div class="sub">${esc(l.currency)} ${money(l.amountFcy)} @ ${esc(l.roe)}</div>` : ''}</td>
    <td class="n">${l.dc === 'Dr' ? money(l.amount) : ''}</td><td class="n">${l.dc === 'Cr' ? money(l.amount) : ''}</td></tr>`).join('');
  const bills = (v.allocations || []).length ? `<div class="box"><b>Set against bills:</b> ${(v.allocations || []).map(a => esc(a.againstNo || a.refNo || a.refType) + ' (' + money(a.amount) + ')').join(', ')}</div>` : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(v.typeName)} ${esc(v.voucherNumber)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; }
  .head { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  .co { font-size: 18px; font-weight: 800; } .vt { font-size: 14px; font-weight: 700; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
  .meta { display: flex; justify-content: space-between; margin: 8px 0 12px; } .meta div { line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #555; padding: 6px 8px; vertical-align: top; }
  th { background: #eee; text-align: left; } .n { text-align: right; white-space: nowrap; width: 120px; } .sub { font-size: 10px; color: #444; margin-top: 2px; }
  tfoot td { font-weight: 800; } .box { margin-top: 10px; } .sign { display: flex; justify-content: space-between; margin-top: 60px; }
  .sign div { border-top: 1px solid #111; padding-top: 4px; width: 28%; text-align: center; }
</style></head><body>
<div class="head"><div class="co">${esc(company || 'COMMITTED CARGO CARE LIMITED')}</div><div class="vt">${esc(v.typeName)} Voucher</div></div>
<div class="meta"><div><b>Voucher No:</b> ${esc(v.voucherNumber)}<br><b>Ref / Chq No:</b> ${esc(v.refNo || '-')}<br><b>Job No:</b> ${esc(v.jobNo || '-')}</div>
<div style="text-align:right"><b>Date:</b> ${d8(v.date)}<br><b>Branch:</b> ${esc(v.branchCode || '-')}<br><b>Status:</b> ${esc(v.status || 'Pending')}</div></div>
<table><thead><tr><th>Particulars</th><th class="n">Debit (Rs)</th><th class="n">Credit (Rs)</th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr><td>Total</td><td class="n">${money(dr)}</td><td class="n">${money(cr)}</td></tr></tfoot></table>
<div class="box"><b>Amount in words:</b> ${inWords(dr)}</div>
${bills}
<div class="box"><b>Narration:</b> ${esc(v.narration || '-')}</div>
<div class="sign"><div>Prepared by${v.createdByName ? '<br>' + esc(v.createdByName) : ''}</div><div>Checked by</div><div>Authorised signatory</div></div>
<script>window.onload = function () { window.print(); };</script></body></html>`;
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}
