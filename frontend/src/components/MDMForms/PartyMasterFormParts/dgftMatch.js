// How DGFT branches meet the branches already in the party:
//  - Sr No = DGFT Branch Code; a branch with no code is Sr No 0.
//  - A DGFT branch that matches an address already in the party (same start of address, PIN not different,
//    GSTIN not different) UPDATES that address: Sr No, address, city, state, PIN, GSTIN come from DGFT;
//    branch name, contact, phone, e-mail, TAN, default and the other fields stay.
//  - Other DGFT branches are added. A Sr No already used by an address that is not updated is never reused.
export const up = (value) => String(value ?? '').trim().toUpperCase();
const lettersAndDigits = (value) => up(value).replace(/[^A-Z0-9]/g, '');
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;
const isGstin = (gstin) => GSTIN_PATTERN.test(gstin);
const isIndianPin = (pin) => /^\d{6}$/.test(pin);

export const dgftSrNo = (branch) => {
  const code = String(branch?.branchCode || '').trim();
  return /^\d+$/.test(code) ? String(parseInt(code, 10)) : (code || '0');
};

function findMatch(branch, addresses, taken) {
  const dgftFull = lettersAndDigits(branch.address || branch.address1);
  const dgftLine1 = lettersAndDigits(branch.address1);
  const dgftGstin = up(branch.gstin);
  const dgftPin = String(branch.pinCode || '').trim();
  for (let index = 0; index < addresses.length; index += 1) {
    if (taken.has(index)) continue;
    const address = addresses[index];
    const ourLine1 = lettersAndDigits(address.address1 || address.address);
    if (ourLine1.length < 8) continue;
    const ourGstin = up(address.regNo || address.gstin);
    if (isGstin(ourGstin) && isGstin(dgftGstin) && ourGstin !== dgftGstin) continue;
    const ourPin = String(address.pinCode || address.zip || '').trim();
    if (isIndianPin(ourPin) && isIndianPin(dgftPin) && ourPin !== dgftPin) continue;
    const compareLength = Math.min(20, ourLine1.length);
    if (ourLine1 === dgftLine1 || dgftFull.slice(0, compareLength) === ourLine1.slice(0, compareLength)) return index;
  }
  return -1;
}

// branches = DGFT branches, addresses = the party grid. Returns what Add would do, row by row (same order as branches).
export function planDgft(branches, addresses) {
  const partyAddresses = addresses || [];
  const taken = new Set();
  const rows = (branches || []).map((branch) => {
    const index = findMatch(branch, partyAddresses, taken);
    if (index >= 0) taken.add(index);
    return { b: branch, sr: dgftSrNo(branch), i: index };
  });

  const usedSrNos = new Map();
  partyAddresses.forEach((address, index) => {
    if (taken.has(index)) return;
    const srNo = String(address.branchSrNo ?? '').trim();
    if (srNo !== '') usedSrNos.set(srNo, index);
  });

  for (const row of rows) {
    if (row.i < 0) continue;
    const oldSrNo = String(partyAddresses[row.i].branchSrNo ?? '').trim();
    row.action = 'update';
    if (usedSrNos.has(row.sr)) {
      row.newSr = oldSrNo;
      row.note = `Updates Sr ${oldSrNo} in this party (keeps Sr ${oldSrNo}: Sr ${row.sr} is used by another address)`;
      usedSrNos.set(oldSrNo, row.i);
    } else {
      row.newSr = row.sr;
      row.note = oldSrNo === row.sr ? `Updates Sr ${oldSrNo} in this party` : `Updates Sr ${oldSrNo} in this party to Sr ${row.sr}`;
      usedSrNos.set(row.sr, row.i);
    }
  }

  const seenLines = new Set(partyAddresses.map((address) => lettersAndDigits(address.address1)).filter(Boolean));
  for (const row of rows) {
    if (row.i >= 0) continue;
    if (seenLines.has(lettersAndDigits(row.b.address1))) {
      row.action = 'skip';
      row.note = 'Already in this party';
      continue;
    }
    if (usedSrNos.has(row.sr)) {
      row.action = 'skip';
      row.note = `Sr No ${row.sr} is used by another address in this party`;
      continue;
    }
    row.action = 'add';
    row.newSr = row.sr;
    usedSrNos.set(row.sr, -1);
    seenLines.add(lettersAndDigits(row.b.address1));
  }
  return rows;
}

// ICEGATE takes the address as 35 + 35 characters
const addressFromDgft = (branch) => {
  const state = up(branch.state);
  return {
    address1: up(branch.address1 || branch.address).slice(0, 35),
    address2: up(branch.address2).slice(0, 35),
    city: up(branch.city),
    state,
    country: 'IN',
    pinCode: branch.pinCode || '',
    zip: branch.pinCode || '',
    ctxType: 'GSTIN',
    ctxState: state,
  };
};

// the grid after Add: matched addresses updated in place, new ones appended
export function applyDgft(rows, addresses) {
  const next = [...(addresses || [])];
  let updated = 0;
  let added = 0;
  const skipped = [];
  for (const row of rows) {
    if (row.action === 'update') {
      const address = next[row.i];
      next[row.i] = {
        ...address,
        ...addressFromDgft(row.b),
        branchSrNo: row.newSr,
        regNo: row.b.gstin || address.regNo || '',
        gstin: row.b.gstin || address.gstin || address.regNo || '',
      };
      updated += 1;
    } else if (row.action === 'add') {
      next.push({
        ...addressFromDgft(row.b),
        branchSrNo: row.newSr,
        branchName: up(row.b.city),
        branch: up(row.b.city),
        regNo: row.b.gstin || '',
        gstin: row.b.gstin || '',
        email: '',
        email1: '',
        default: false,
        isDefault: false,
      });
      added += 1;
    } else {
      skipped.push(row.sr);
    }
  }
  return { next, updated, added, skipped };
}

// DGFT "Category of Exporters" -> the Party Master [R]Merc / [F]Manuf value
export const dgftMerc = (category) => {
  const text = up(category);
  if (!text) return '';
  if (/MANUFACTUR/.test(text)) return 'Manufacturer';
  if (/MERCHANT/.test(text)) return 'Merchant';
  return '';
};

// the [R]Merc / [F]Manuf select also shows the iCAFFE codes F / R / M / C / D
export const mercView = (value) => {
  const text = up(value);
  if (!text || text === 'F') return 'Manufacturer';
  if (text === 'R' || text === 'M') return 'Merchant';
  if (text === 'C') return 'Merchant Exporter Courier [C]';
  if (text === 'D') return 'Manufacturer Exporter Courier [D]';
  return value;
};

// party name compare: case, dots, "M/S", PVT / LTD / & written differently do not count as a difference
export const nameKey = (name) => up(name)
  .replace(/^M\s*\/\s*S\.?\s+/, '')
  .replace(/&/g, ' AND ')
  .replace(/\bPVT\b\.?/g, 'PRIVATE')
  .replace(/\bLTD\b\.?/g, 'LIMITED')
  .replace(/\bCO\b\.?/g, 'COMPANY')
  .replace(/[^A-Z0-9]/g, '');
