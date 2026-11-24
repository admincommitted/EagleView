// Importer PIN for a BE job (16-Nov-2026).
// 537 of the 4,143 BE jobs loaded from iCAFFE have no importer PIN: iCAFFE's job export has no IMP_PIN for them (iCAFFE
// put the PIN into the .be from its own importer-branch master when it made the file). EagleView needs it ("Header: PIN
// is mandatory"), so a re-file or an amendment of such a job stopped there. This gives the PINs known for the same
// importer (IEC) and branch Sr No:
//   - Party master branches (PartyBranches, filled by iCAFFE and by "Fetch from DGFT")
//   - other BE jobs of the same IEC + branch, with how many jobs used each PIN; "same address" when address 1 matches
// iCAFFE's own data is not always one PIN per branch (one DHL address has 122001 on 59 jobs and 201301 on 27), so the
// screen only offers these - the user picks. pick() is the strict rule used by fix_blank_be_pin.js: one PIN only.
const PIN = /^[1-9]\d{5}$/;
const okPin = (p) => PIN.test(String(p || '').trim());
const addrKey = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
// a PIN written inside the address / city ("SOUTH DELHI 110049", "HAPUR-245304")
function pinInText(...parts) {
  const all = parts.map(x => String(x || '')).join(' ');
  const m = all.match(/(?<!\d)[1-9]\d{5}(?!\d)/g) || [];
  const set = [...new Set(m)];
  return set.length === 1 ? set[0] : '';
}

// first digit of an Indian PIN by state (India Post zones); a PIN from another zone than the job's state is not used
const ZONES = [[1, /DELHI|HARYANA|PUNJAB|HIMACHAL|JAMMU|KASHMIR|CHANDIGARH|LADAKH/], [2, /UTTAR\s*PRADESH|UTTARAKHAND|UTTARANCHAL/],
  [3, /RAJASTHAN|GUJARAT|DAMAN|DIU|DADRA/], [4, /MAHARASHTRA|MADHYA\s*PRADESH|CHHATTISGARH|CHATTISGARH|GOA/],
  [5, /ANDHRA|TELANGANA|KARNATAKA/], [6, /TAMIL|KERALA|PUDUCHERRY|PONDICHERRY|LAKSHADWEEP/],
  [7, /BENGAL|ODISHA|ORISSA|ASSAM|ARUNACHAL|MANIPUR|MEGHALAYA|MIZORAM|NAGALAND|TRIPURA|SIKKIM|ANDAMAN/], [8, /BIHAR|JHARKHAND/]];
function zoneOf(state) { const t = String(state || '').toUpperCase(); const z = ZONES.find(([, re]) => re.test(t)); return z ? z[0] : 0; }
const fitsState = (pin, state) => { const z = zoneOf(state); return !z || String(pin).charAt(0) === String(z); };

// q(sql, params) -> rows (SELECT). jobId: leave this job out.
async function suggest(q, { iec, branchSrNo, address1, jobId, state } = {}) {
  const i = String(iec || '').trim().toUpperCase();
  if (!i) return [];
  const br = String(branchSrNo ?? '').trim() || '0';
  const out = new Map(); // pin -> { pin, jobs, sameAddress, master }
  const add = (pin, k) => { const p = String(pin || '').trim(); if (!okPin(p)) return null; if (!out.has(p)) out.set(p, { pin: p, jobs: 0, sameAddress: 0, master: false }); const o = out.get(p); Object.assign(o, k(o)); return o; };
  const pb = await q(`SELECT b.pinCode, b.address1 FROM PartyBranches b JOIN Parties p ON p.id = b.partyId
      WHERE upper(trim(p.taxId)) = ? AND trim(CAST(coalesce(b.branchSrNo, 0) AS TEXT)) = ?`, [i, br]);
  pb.forEach(r => add(r.pinCode, () => ({ master: true })));
  const key = addrKey(address1);
  const jobs = await q(`SELECT id, coalesce(nullif(trim(autoField_10), ''), trim(pin)) AS p, address1 FROM ImportJobs
      WHERE upper(trim(iecCode)) = ? AND trim(CAST(coalesce(branchSrNo, 0) AS TEXT)) = ? AND coalesce(jobNo, '') NOT LIKE 'AMD/%'`, [i, br]);
  jobs.forEach(r => { if (jobId && String(r.id) === String(jobId)) return; add(r.p, o => ({ jobs: o.jobs + 1, sameAddress: o.sameAddress + (key && addrKey(r.address1) === key ? 1 : 0) })); });
  const list = [...out.values()];
  list.forEach(x => { x.stateOk = fitsState(x.pin, state); });
  return list.sort((a, b) => (b.stateOk - a.stateOk) || (b.master - a.master) || (b.sameAddress - a.sameAddress) || (b.jobs - a.jobs));
}

// strict: one PIN only - written in the job's own address, or the only PIN of all other jobs with the same IEC + branch +
// address 1, or the only PIN of all other jobs with the same IEC + branch. Returns { pin, how } or null.
async function pick(q, job) {
  const own = pinInText(job.address1, job.address2, job.city);
  if (own) return fitsState(own, job.state) ? { pin: own, how: 'written in the address' } : null;
  const all = await suggest(q, { iec: job.iecCode, branchSrNo: job.branchSrNo, address1: job.address1, jobId: job.id, state: job.state });
  if (all.some(x => !x.stateOk)) return null; // a PIN of another state is in the data for this branch - the user decides
  const list = all;
  const fromJobs = list.filter(x => x.jobs > 0);
  const same = fromJobs.filter(x => x.sameAddress > 0);
  // the Party master branch must not say otherwise
  const masterOk = (p) => !list.some(x => x.master && x.pin !== p);
  if (same.length === 1 && masterOk(same[0].pin)) return { pin: same[0].pin, how: `same importer, branch and address on ${same[0].sameAddress} other job(s)` };
  if (same.length === 0 && fromJobs.length === 1 && masterOk(fromJobs[0].pin)) return { pin: fromJobs[0].pin, how: `same importer and branch on ${fromJobs[0].jobs} other job(s)` };
  const master = list.filter(x => x.master);
  if (!fromJobs.length && master.length === 1) return { pin: master[0].pin, how: 'Party master branch' };
  return null;
}

module.exports = { suggest, pick, okPin, pinInText, zoneOf, fitsState };
