// Party Master > Fetch from DGFT: how DGFT branches meet the branches already in the party (13-Nov-2026)
//  - Sr No = DGFT Branch Code; a branch with no code is Sr No 0.
//  - A DGFT branch that matches an address already in the party (same start of address, PIN not different,
//    GSTIN not different) UPDATES that address: Sr No, address, city, state, PIN, GSTIN come from DGFT;
//    branch name, contact, phone, e-mail, TAN, default and the other fields stay.
//  - Other DGFT branches are added. A Sr No already used by an address that is not updated is never reused.
export const up = (v) => String(v ?? '').trim().toUpperCase();
const norm = (v) => up(v).replace(/[^A-Z0-9]/g, '');
const isGstin = (g) => /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(g);

export const dgftSrNo = (b) => { const c = String((b && b.branchCode) || '').trim(); return /^\d+$/.test(c) ? String(parseInt(c, 10)) : (c || '0'); };

function findMatch(b, addresses, taken) {
  const dFull = norm(b.address || b.address1); const d1 = norm(b.address1);
  const g2 = up(b.gstin); const p2 = String(b.pinCode || '').trim();
  for (let i = 0; i < addresses.length; i += 1) {
    if (taken.has(i)) continue;
    const a = addresses[i]; const e1 = norm(a.address1 || a.address);
    if (e1.length < 8) continue;
    const g1 = up(a.regNo || a.gstin); if (isGstin(g1) && isGstin(g2) && g1 !== g2) continue;
    const p1 = String(a.pinCode || a.zip || '').trim(); if (/^\d{6}$/.test(p1) && /^\d{6}$/.test(p2) && p1 !== p2) continue;
    const k = Math.min(20, e1.length);
    if (e1 === d1 || dFull.slice(0, k) === e1.slice(0, k)) return i;
  }
  return -1;
}

// list = DGFT branches, addresses = the party grid. Returns what Add would do, row by row (same order as list).
export function planDgft(list, addresses) {
  const addrs = addresses || []; const taken = new Set();
  const rows = (list || []).map(b => { const i = findMatch(b, addrs, taken); if (i >= 0) taken.add(i); return { b, sr: dgftSrNo(b), i }; });
  const used = new Map(); addrs.forEach((a, i) => { if (!taken.has(i)) { const s = String(a.branchSrNo ?? '').trim(); if (s !== '') used.set(s, i); } });
  for (const r of rows) {
    if (r.i < 0) continue;
    const old = String(addrs[r.i].branchSrNo ?? '').trim();
    if (used.has(r.sr)) { r.action = 'update'; r.newSr = old; r.note = `Updates Sr ${old} in this party (keeps Sr ${old}: Sr ${r.sr} is used by another address)`; used.set(old, r.i); }
    else { r.action = 'update'; r.newSr = r.sr; r.note = old === r.sr ? `Updates Sr ${old} in this party` : `Updates Sr ${old} in this party to Sr ${r.sr}`; used.set(r.sr, r.i); }
  }
  const seen = new Set(addrs.map(a => norm(a.address1)).filter(Boolean));
  for (const r of rows) {
    if (r.i >= 0) continue;
    if (seen.has(norm(r.b.address1))) { r.action = 'skip'; r.note = 'Already in this party'; continue; }
    if (used.has(r.sr)) { r.action = 'skip'; r.note = `Sr No ${r.sr} is used by another address in this party`; continue; }
    r.action = 'add'; r.newSr = r.sr; used.set(r.sr, -1); seen.add(norm(r.b.address1));
  }
  return rows;
}

// the grid after Add: matched addresses updated in place, new ones appended
export function applyDgft(rows, addresses) {
  const next = [...(addresses || [])]; let updated = 0, added = 0; const skipped = [];
  const fromDgft = (b) => {
    const st = up(b.state);
    return { address1: up(b.address1 || b.address).slice(0, 35), address2: up(b.address2).slice(0, 35), /* ICEGATE 35 + 35 (14-Nov-2026) */ city: up(b.city), state: st, country: 'IN',
      pinCode: b.pinCode || '', zip: b.pinCode || '', ctxType: 'GSTIN', ctxState: st };
  };
  for (const r of rows) {
    if (r.action === 'update') {
      const a = next[r.i];
      next[r.i] = { ...a, ...fromDgft(r.b), branchSrNo: r.newSr, regNo: r.b.gstin || a.regNo || '', gstin: r.b.gstin || a.gstin || a.regNo || '' };
      updated += 1;
    } else if (r.action === 'add') {
      next.push({ ...fromDgft(r.b), branchSrNo: r.newSr, branchName: up(r.b.city), branch: up(r.b.city), regNo: r.b.gstin || '', gstin: r.b.gstin || '',
        email: '', email1: '', default: false, isDefault: false });
      added += 1;
    } else skipped.push(r.sr);
  }
  return { next, updated, added, skipped };
}

// 14-Nov-2026: DGFT "Category of Exporters" -> the Party Master [R]Merc / [F]Manuf value
export const dgftMerc = (cat) => { const t = up(cat); if (!t) return ''; if (/MANUFACTUR/.test(t)) return 'Manufacturer'; if (/MERCHANT/.test(t)) return 'Merchant'; return ''; };
// the Party Master select shows the iCAFFE codes too (F / R / M / C / D were shown as "Manufacturer" before)
export const mercView = (v) => { const t = up(v); if (!t) return 'Manufacturer'; if (t === 'F') return 'Manufacturer'; if (t === 'R' || t === 'M') return 'Merchant';
  if (t === 'C') return 'Merchant Exporter Courier [C]'; if (t === 'D') return 'Manufacturer Exporter Courier [D]'; return v; };
// party name compare: case, dots, "M/S", PVT / LTD / & written differently do not count as a difference
export const nameKey = (n) => up(n).replace(/^M\s*\/\s*S\.?\s+/, '').replace(/&/g, ' AND ').replace(/\bPVT\b\.?/g, 'PRIVATE').replace(/\bLTD\b\.?/g, 'LIMITED')
  .replace(/\bCO\b\.?/g, 'COMPANY').replace(/[^A-Z0-9]/g, '');
