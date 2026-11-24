// 08-Nov-2026: the charges a docket should be billed under the customer's contract (Customer Contract & Quotation
// Master, /api/contracts). Used by the Provisional Sheet (routes/accountsGstInvoice.js). Read only.
//   contract: the docket's "Quotation" field when it holds an Active contract no., else the Active contract of the
//             billing party / main party valid on the docket date
//   freight:  contract freight matrix - origin, destination (codes matched to the docket's port names through the
//             port masters), cargo type, carrier (any, or the docket's airline), weight slab on chargeable weight, Min
//   charges:  the contract's charges for the docket's division, by basis (flat, per kg, per package, per CBM, per
//             container 20'/40', % of freight / value / duty) with Min / Max; Reimbursement or At Actuals charges
//             are billed at the actual cost booked on the docket (receipted charges), never at a rate
//   transport: the contract's cartage rates, offered unticked (the route is chosen by the user)
// Every line carries an Accounts GST charge name.
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const r2 = (v) => Math.round((num(v) + Number.EPSILON) * 100) / 100;
const U = (v) => String(v == null ? '' : v).trim().toUpperCase();
const norm = (t) => U(t).replace(/\(.*?\)/g, ' ').replace(/\b(NEW|INTL|INTERNATIONAL|AIRPORT|AIR PORT|APT|PORT|SEAPORT)\b/g, ' ').replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const SLABS = [['plus1000', 1000, '+1000 kg'], ['plus500', 500, '+500 kg'], ['plus300', 300, '+300 kg'], ['plus100', 100, '+100 kg'], ['plus45', 45, '+45 kg'], ['normal', 0, 'Normal']];

async function portCodes(q, text) {
  const out = new Set(); const raw = U(text); if (!raw) return out;
  if (/^[A-Z]{3}$/.test(raw)) out.add(raw);
  const m = raw.match(/\(([A-Z]{3})\)/); if (m) out.add(m[1]);
  const n = norm(text); if (!n) return out;
  for (const r of await q('SELECT code FROM ForeignPorts WHERE upper(trim(name)) = ? LIMIT 20', [n]).catch(() => [])) { const c = U(r.code); if (c.length === 5) out.add(c.slice(2)); else if (c.length === 3) out.add(c); }
  for (const r of await q('SELECT code FROM Airports WHERE upper(trim(name)) = ? OR upper(trim(name)) LIKE ? LIMIT 20', [n, n + ' %']).catch(() => [])) out.add(U(r.code));
  return out;
}
async function carrierCodes(q, carrier, mawbNo) {
  const out = new Set(); const c = U(carrier); if (c) out.add(c);
  const pre = String(mawbNo || '').replace(/\D/g, '').slice(0, 3);
  const rows = await q('SELECT name, code2, code3, prefix FROM Airlines WHERE upper(trim(name)) = ? OR upper(code2) = ? OR upper(code3) = ? OR (? <> \'\' AND prefix = ?) LIMIT 10', [c, c, c, pre, pre]).catch(() => []);
  for (const r of rows) for (const v of [r.name, r.code2, r.code3, r.prefix]) if (v) out.add(U(v));
  return out;
}

module.exports = async function contractBilling(q, jobNo, costs) {
  const sh = (await q(`SELECT docketNo, docketDate, division, mainParty, mainPartyId, billingParty, quotationNo, originPort, destinationPort, carrier, mawbNo, cargoType,
      grossWeight, chargeableWeight, pkgs, volume, containersJson, dataJson FROM Shipments WHERE upper(trim(docketNo)) = ? LIMIT 1`, [jobNo]).catch(() => []))[0];
  if (!sh) return null;
  const date = String(sh.docketDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const div = U(sh.division);
  // the contract
  let ct = null; const notes = [];
  if (sh.quotationNo) ct = (await q("SELECT * FROM CustomerContracts WHERE upper(trim(contractNo)) = ? AND status = 'Active' LIMIT 1", [U(sh.quotationNo)]).catch(() => []))[0] || null;
  if (!ct) {
    const ids = [];
    if (sh.billingParty) for (const r of await q('SELECT id FROM Parties WHERE upper(trim(name)) = ? LIMIT 3', [U(sh.billingParty)]).catch(() => [])) ids.push(r.id);
    if (num(sh.mainPartyId)) ids.push(num(sh.mainPartyId));
    else if (sh.mainParty) for (const r of await q('SELECT id FROM Parties WHERE upper(trim(name)) = ? LIMIT 3', [U(sh.mainParty)]).catch(() => [])) ids.push(r.id);
    if (ids.length) ct = (await q(`SELECT * FROM CustomerContracts WHERE status = 'Active' AND partyId IN (${ids.map(Number).join(',')}) AND coalesce(validFrom, '0000-00-00') <= ? AND validTo >= ?
        ORDER BY CASE WHEN partyId = ? THEN 0 ELSE 1 END, id DESC LIMIT 1`, [date, date, ids[0]]).catch(() => []))[0] || null;
  }
  if (!ct) return { contract: null, lines: [] };
  const gst = await q('SELECT chargeName, coalesce(isActive, 1) active FROM AccGstCharges').catch(() => []);
  const gname = (re) => { const g = gst.find(c => c.active && re.test(U(c.chargeName))); return g ? U(g.chargeName) : null; };
  const data = (() => { try { return JSON.parse(sh.dataJson || '{}') || {}; } catch (e) { return {}; } })();
  const imp = /I$/.test(div);
  const roeOf = async (cur) => { if (!cur || U(cur) === 'INR') return 1; const r = (await q('SELECT importRate, exportRate FROM Currencies WHERE upper(currencyCode) = ? LIMIT 1', [U(cur)]).catch(() => []))[0]; return r ? num(imp ? r.importRate : r.exportRate) || 1 : 1; };
  const from = 'Contract ' + ct.contractNo;
  const lines = [];
  const chw = num(sh.chargeableWeight) || num(sh.grossWeight), grw = num(sh.grossWeight) || chw;

  // freight (air): the matrix row for this sector, cargo type and carrier
  const fr = await q('SELECT * FROM ContractFreightRates WHERE contractId = ?', [ct.id]).catch(() => []);
  if (fr.length && /^A/.test(div) && chw > 0) {
    const [oc, dc, cc] = await Promise.all([portCodes(q, sh.originPort), portCodes(q, sh.destinationPort), carrierCodes(q, sh.carrier, sh.mawbNo)]);
    const st = U(sh.cargoType || 'General');
    const sector = fr.filter(r => oc.has(U(r.origin)) && dc.has(U(r.destination)));
    const pickSt = (want) => sector.filter(r => U(r.serviceType) === want);
    const rows = pickSt(st).length ? pickSt(st) : pickSt('GENERAL');
    const anyC = (r) => !r.carrier || ['ANY', '*', 'ALL'].includes(U(r.carrier));
    const row = rows.find(r => !anyC(r) && cc.has(U(r.carrier))) || rows.find(anyC);
    if (row) {
      let rate = null, slab = '';
      for (const [k, b, l] of SLABS) if (chw >= b && row[k] != null && row[k] !== '') { rate = num(row[k]); slab = l; break; }
      let qty = chw, sell = rate || 0, basis = 'Per KG (ChW) ' + slab;
      if (rate == null || (row.min != null && row.min !== '' && rate * chw < num(row.min))) { qty = 1; sell = num(row.min); basis = 'Min'; }
      const charge = U(row.chargeName) || gname(div === 'AE' ? /FREIGHT.*AIR.*EXPORT/ : /FREIGHT.*AIR.*IMPORT/) || 'FREIGHT CHARGES';
      const cur = ct.currency || 'INR';
      lines.push({ charge, currency: cur, exRate: await roeOf(cur), qty, buyRate: 0, sellRate: r2(sell), basis, from: from + ' - freight ' + row.origin + '-' + row.destination + (row.carrier ? ' ' + row.carrier : ''),
        note: row.chargeName ? '' : 'set the GST charge of this freight line in the contract' });
    } else if (sector.length || fr.length) notes.push('No freight rate in the contract for ' + (sh.originPort || '?') + ' to ' + (sh.destinationPort || '?') + (sh.carrier ? ' / ' + sh.carrier : ''));
  }

  // charges of the contract for this division
  let cont = []; try { cont = JSON.parse(sh.containersJson || '[]') || []; } catch (e) {}
  const c20 = cont.filter(c => /20/.test(String(c.size || ''))).length, c40 = cont.filter(c => /40|45/.test(String(c.size || ''))).length, cUnk = cont.length - c20 - c40;
  const freightAmt = lines.length ? lines[0].sellRate * lines[0].qty * lines[0].exRate : 0;
  const chg = await q('SELECT * FROM ContractCharges WHERE contractId = ? ORDER BY id', [ct.id]).catch(() => []);
  for (const c of chg) {
    const ap = U(c.appliesTo || 'ALL'); if (ap !== 'ALL' && ap !== div) continue;
    const charge = U(c.printName); const b = U(c.basis); const cur = c.currency || 'INR'; const ex = await roeOf(cur);
    if (U(c.type) === 'REIMBURSEMENT' || /ACTUAL/.test(b)) { // receipted: the actual cost booked on the docket
      const cost = costs.get(charge) || 0;
      lines.push({ charge, currency: 'INR', exRate: 1, qty: 1, buyRate: r2(cost), sellRate: r2(cost), basis: 'At actual cost', from: from + ' - at actual cost', receipted: true,
        note: cost ? '' : 'cost not booked on the docket yet' });
      continue;
    }
    let qty = 1, optional = false, note = '';
    if (/%/.test(b)) {
      const base = /FREIGHT/.test(b) ? freightAmt / ex : /DUTY/.test(b) ? num(data.totalDuty || data.dutyAmount) : num(data.assessableValue || data.assValue || data.invoiceValueInr || data.invoiceValue);
      if (!base) note = 'base amount (' + c.basis + ') not on the docket - enter it';
      const amt0 = base * num(c.rate) / 100; qty = 1;
      let amt = amt0; if (num(c.minAmt) && amt < num(c.minAmt)) amt = num(c.minAmt); if (num(c.maxAmt) && amt > num(c.maxAmt)) amt = num(c.maxAmt);
      lines.push({ charge, currency: cur, exRate: ex, qty: 1, buyRate: 0, sellRate: r2(amt), basis: c.basis + ' @ ' + num(c.rate), from, note, optional: !base && !c.mandatory });
      continue;
    }
    if (/CHW|CHARGEABLE/.test(b)) qty = chw; else if (/GRW|GROSS/.test(b)) qty = grw; else if (/KG/.test(b)) qty = chw;
    else if (/PKG|PACKAGE/.test(b)) qty = num(sh.pkgs); else if (/CBM/.test(b)) qty = num(sh.volume);
    else if (/20/.test(b)) { qty = c20 || (c40 ? 0 : cUnk); if (!c20 && cUnk && !c40) { optional = true; note = 'container size not on the docket'; } }
    else if (/40/.test(b)) { qty = c40 || (c20 ? 0 : cUnk); if (!c40 && cUnk && !c20) { optional = true; note = 'container size not on the docket'; } }
    else if (/CONTAINER/.test(b)) qty = cont.length;
    if (!(qty > 0)) { if (!c.mandatory) continue; qty = 1; }
    let sell = num(c.rate); const amt = sell * qty;
    if (num(c.minAmt) && amt < num(c.minAmt)) { qty = 1; sell = num(c.minAmt); note = (note ? note + '; ' : '') + 'Min applied'; }
    else if (num(c.maxAmt) && amt > num(c.maxAmt)) { qty = 1; sell = num(c.maxAmt); note = (note ? note + '; ' : '') + 'Max applied'; }
    lines.push({ charge, currency: cur, exRate: ex, qty: r2(qty), buyRate: 0, sellRate: r2(sell), basis: c.basis, from, note, optional });
  }
  // cartage: offered, not ticked
  for (const t of await q('SELECT * FROM ContractTransportRates WHERE contractId = ? ORDER BY id', [ct.id]).catch(() => [])) {
    const charge = U(t.chargeName) || gname(/^TRANSPORTATION CHARGES/) || 'TRANSPORTATION CHARGES';
    lines.push({ charge, currency: t.currency || 'INR', exRate: await roeOf(t.currency), qty: 1, buyRate: 0, sellRate: r2(t.amount), basis: [t.fromLoc, t.toLoc].join(' to ') + (t.vehicle ? ' (' + t.vehicle + ')' : ''), from: from + ' - transport', optional: true });
  }
  return { contract: { id: ct.id, contractNo: ct.contractNo, partyName: ct.partyName, validTo: ct.validTo, currency: ct.currency }, lines, notes };
};
