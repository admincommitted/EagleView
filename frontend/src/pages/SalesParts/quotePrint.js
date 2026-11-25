// Sales quotation as a printable A4 page (Print, PDF and the mail attachment use the same HTML).
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n, d = 2) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const dmy = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : (v || ''); };
const qtyText = (n) => { const v = Number(n) || 0; return Number.isInteger(v) ? String(v) : v.toLocaleString('en-IN', { maximumFractionDigits: 3 }); };

export function quoteHtml(q, deal, svcLabel) {
  const cp = (deal && deal.company) || {};
  const basis = Object.fromEntries(((deal && deal.basis) || []).map(b => [b[0], b[1]]));
  const sections = (deal && deal.sections) || [];
  const lines = q.lines || [];
  const rows = (k, v) => (v == null || v === '' ? '' : `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`);
  const cargo = [q.pkgs ? `${qtyText(q.pkgs)} pkgs` : '', q.grossWt ? `gross ${qtyText(q.grossWt)} kg` : '', q.chargeableWt ? `chargeable ${qtyText(q.chargeableWt)} kg` : '',
    q.cbm ? `${qtyText(q.cbm)} CBM` : '', q.containers || ''].filter(Boolean).join(', ');
  const byCur = {};
  lines.forEach(l => { byCur[l.currency] = (byCur[l.currency] || 0) + (Number(l.sellAmount) || 0); });
  const totInr = lines.reduce((s, l) => s + (Number(l.sellInr) || 0), 0);
  const roes = [...new Set(lines.filter(l => l.currency !== 'INR').map(l => `1 ${l.currency} = Rs ${money(l.roe, 2)}`))];
  const table = sections.map(([code, name]) => {
    const ls = lines.filter(l => (l.section || 'OTHER') === code);
    if (!ls.length) return '';
    return `<tr class="sec"><td colspan="7">${esc(name)}</td></tr>` + ls.map(l => {
      const minNote = (Number(l.minSell) > 0 && Number(l.sellAmount) <= Number(l.minSell) + 0.001 && Number(l.sellRate) * Number(l.qty) < Number(l.minSell)) ? ' (min)' : '';
      const rate = l.basis === 'PCT' ? `${money(l.sellRate, 3)} %` : money(l.sellRate, 2);
      return `<tr><td>${esc(l.head)}${l.remarks ? `<div class="small">${esc(l.remarks)}</div>` : ''}</td><td>${esc(basis[l.basis] || l.basis || '')}</td>
        <td class="r">${l.basis === 'FLAT' || l.basis === 'DOC' ? '' : esc(qtyText(l.qty))}</td><td>${esc(l.currency)}</td><td class="r">${rate}${Number(l.minSell) > 0 ? `<div class="small">min ${money(l.minSell)}</div>` : ''}</td>
        <td class="r">${money(l.sellAmount)}${minNote}</td><td class="r">${l.gstRate == null ? '' : esc(Number(l.gstRate)) + '%'}</td></tr>`;
    }).join('');
  }).join('');
  const terms = String(q.terms || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const br = q.branch || {};
  const coAddr = [cp.address1, cp.address2, [cp.city, cp.state, cp.pincode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  // the quoting branch's address / GSTIN when the branch master has them, else the company's
  const addr = br.address ? [br.address, br.branchName].filter(Boolean).join(', ') : [coAddr, cp.country].filter(Boolean).join(', ');
  const gstin = br.gstin || cp.gstin; const phone = br.phone || cp.phone; const email = br.email || cp.email;
  const second = [q.carrier, q.routing, q.transitTime, q.frequency, q.cargoValue].some(v => v != null && v !== '');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(q.quoteNo)}</title>
<style>
@page { size: A4; margin: 12mm 12mm 14mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; color: #111; margin: 0; }
.head { display: flex; gap: 14px; align-items: center; border-bottom: 2px solid #0c4a6e; padding-bottom: 8px; }
.head img { max-height: 54px; max-width: 160px; }
.co { flex: 1; } .co b { font-size: 15px; color: #0c4a6e; } .small { font-size: 9px; color: #475569; }
h1 { font-size: 15px; letter-spacing: .5px; margin: 10px 0 6px; color: #0c4a6e; }
.two { display: flex; gap: 12px; } .two > div { flex: 1; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 8px; }
.kv { width: 100%; border-collapse: collapse; } .kv th { text-align: left; color: #475569; font-weight: 600; width: 38%; padding: 2px 4px 2px 0; vertical-align: top; } .kv td { padding: 2px 0; }
table.ch { width: 100%; border-collapse: collapse; margin-top: 10px; }
table.ch th { background: #0c4a6e; color: #fff; text-align: left; padding: 5px 6px; font-size: 10px; }
table.ch td { border-bottom: 1px solid #e2e8f0; padding: 4px 6px; vertical-align: top; }
table.ch tr.sec td { background: #e0f2fe; font-weight: 700; color: #0c4a6e; }
.r { text-align: right; white-space: nowrap; }
.tot { margin-left: auto; margin-top: 6px; border-collapse: collapse; } .tot td { padding: 3px 8px; } .tot tr.g td { font-weight: 700; border-top: 1.5px solid #0c4a6e; }
ol { margin: 4px 0 0 16px; padding: 0; } li { margin-bottom: 2px; }
.sign { margin-top: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
</style></head><body>
<div class="head">${cp.logoDataUrl ? `<img src="${esc(cp.logoDataUrl)}" alt="">` : ''}<div class="co"><b>${esc(cp.companyName || cp.legalName || '')}</b><div class="small">${esc(addr)}</div>
<div class="small">${[gstin ? 'GSTIN ' + gstin : '', phone, email, cp.website].filter(Boolean).map(esc).join(' | ')}</div></div></div>
<h1>QUOTATION</h1>
<div class="two">
<div><table class="kv">${rows('To', q.clientName)}${rows('Address', [q.custAddress, q.custCity, q.custState].filter(Boolean).join(', '))}${rows('GSTIN', q.custGstin)}${rows('Attention', q.contactPerson)}${rows('E-mail', q.email)}</table></div>
<div><table class="kv">${rows('Quotation no', q.quoteNo)}${rows('Date', dmy(q.date))}${rows('Valid until', dmy(q.validUntil))}${rows('Your enquiry', q.enquiryNo)}${rows('Service', svcLabel || q.serviceType)}</table></div>
</div>
<div class="two" style="margin-top:8px"><div><table class="kv">${rows('Origin', q.origin)}${rows('Destination', q.destination)}${rows('Incoterm', q.incoterms)}${rows('Commodity', q.commodity)}${rows('Cargo', cargo)}</table></div>
${second ? `<div><table class="kv">${rows('Carrier', q.carrier)}${rows('Routing', q.routing)}${rows('Transit time', q.transitTime)}${rows('Frequency', q.frequency)}${rows('Cargo value', q.cargoValue ? `${q.cargoCurrency || ''} ${money(q.cargoValue)}` : '')}</table></div>` : ''}</div>
<table class="ch"><thead><tr><th>Charge</th><th>Basis</th><th class="r">Qty</th><th>Cur</th><th class="r">Rate</th><th class="r">Amount</th><th class="r">GST</th></tr></thead><tbody>${table}</tbody></table>
<table class="tot">${Object.entries(byCur).map(([c, v]) => `<tr><td>Total ${esc(c)}</td><td class="r">${money(v)}</td></tr>`).join('')}
${Object.keys(byCur).length > 1 || !byCur.INR ? `<tr class="g"><td>Total in INR (approx.)</td><td class="r">${money(totInr)}</td></tr>` : ''}</table>
${roes.length ? `<div class="small" style="text-align:right">Rate of exchange used: ${esc(roes.join(', '))}; billed at the rate on the invoice date.</div>` : ''}
${q.remarks ? `<div style="margin-top:8px"><b>Remarks:</b> ${esc(q.remarks)}</div>` : ''}
${terms.length ? `<div style="margin-top:10px"><b>Terms &amp; conditions</b><ol>${terms.map(t => `<li>${esc(t)}</li>`).join('')}</ol></div>` : ''}
<div class="sign"><div class="small">${[q.salesPerson, q.spDesignation, q.spMobile, q.spEmail].filter(Boolean).map(esc).join('<br>')}</div>
<div style="text-align:right">${cp.companyName || cp.legalName ? `For <b>${esc(cp.companyName || cp.legalName)}</b>` : ''}<br><br><br>Authorised signatory</div></div>
</body></html>`;
}
