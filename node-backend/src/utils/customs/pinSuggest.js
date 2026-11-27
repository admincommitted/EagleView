// Importer PIN for a BE job.
// Many BE jobs loaded from iCAFFE have no importer PIN: iCAFFE's job export has no IMP_PIN for them (iCAFFE put the
// PIN into the .be from its own importer-branch master when it made the file). EagleView needs it ("Header: PIN is
// mandatory"), so a re-file or an amendment of such a job would stop there. This gives the PINs known for the same
// importer (IEC) and branch Sr No:
//   - Party master branches (PartyBranches, filled by iCAFFE and by "Fetch from DGFT")
//   - other BE jobs of the same IEC + branch, with how many jobs used each PIN; "same address" when address 1 matches
// iCAFFE's own data is not always one PIN per branch (one address can have two PINs over many jobs), so the screen
// only offers these - the user picks. pick() is the strict rule used by the blank-PIN fix script: one PIN only.
const PIN = /^[1-9]\d{5}$/;
const ADDRESS_KEY_LENGTH = 20;

const okPin = (pin) => PIN.test(String(pin || '').trim());
const addrKey = (text) =>
  String(text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ADDRESS_KEY_LENGTH);

// a PIN written inside the address / city ("SOUTH DELHI 110049", "HAPUR-245304")
function pinInText(...parts) {
  const all = parts.map((x) => String(x || '')).join(' ');
  const matches = all.match(/(?<!\d)[1-9]\d{5}(?!\d)/g) || [];
  const distinct = [...new Set(matches)];
  return distinct.length === 1 ? distinct[0] : '';
}

// first digit of an Indian PIN by state (India Post zones); a PIN from another zone than the job's state is not used
const ZONES = [
  [1, /DELHI|HARYANA|PUNJAB|HIMACHAL|JAMMU|KASHMIR|CHANDIGARH|LADAKH/],
  [2, /UTTAR\s*PRADESH|UTTARAKHAND|UTTARANCHAL/],
  [3, /RAJASTHAN|GUJARAT|DAMAN|DIU|DADRA/],
  [4, /MAHARASHTRA|MADHYA\s*PRADESH|CHHATTISGARH|CHATTISGARH|GOA/],
  [5, /ANDHRA|TELANGANA|KARNATAKA/],
  [6, /TAMIL|KERALA|PUDUCHERRY|PONDICHERRY|LAKSHADWEEP/],
  [7, /BENGAL|ODISHA|ORISSA|ASSAM|ARUNACHAL|MANIPUR|MEGHALAYA|MIZORAM|NAGALAND|TRIPURA|SIKKIM|ANDAMAN/],
  [8, /BIHAR|JHARKHAND/],
];

function zoneOf(state) {
  const text = String(state || '').toUpperCase();
  const zone = ZONES.find(([, re]) => re.test(text));
  return zone ? zone[0] : 0;
}
const fitsState = (pin, state) => {
  const zone = zoneOf(state);
  return !zone || String(pin).charAt(0) === String(zone);
};

// q(sql, params) -> rows (SELECT). jobId: leave this job out.
async function suggest(q, { iec, branchSrNo, address1, jobId, state } = {}) {
  const importerIec = String(iec || '')
    .trim()
    .toUpperCase();
  if (!importerIec) return [];
  const branch = String(branchSrNo ?? '').trim() || '0';
  const byPin = new Map(); // pin -> { pin, jobs, sameAddress, master }
  const addPin = (pin, update) => {
    const cleanPin = String(pin || '').trim();
    if (!okPin(cleanPin)) return null;
    if (!byPin.has(cleanPin)) byPin.set(cleanPin, { pin: cleanPin, jobs: 0, sameAddress: 0, master: false });
    const entry = byPin.get(cleanPin);
    Object.assign(entry, update(entry));
    return entry;
  };
  const masterBranches = await q(
    `SELECT b.pinCode, b.address1 FROM PartyBranches b JOIN Parties p ON p.id = b.partyId
      WHERE upper(trim(p.taxId)) = ? AND trim(CAST(coalesce(b.branchSrNo, 0) AS TEXT)) = ?`,
    [importerIec, branch],
  );
  masterBranches.forEach((r) => addPin(r.pinCode, () => ({ master: true })));
  const addressKey = addrKey(address1);
  const jobs = await q(
    `SELECT id, coalesce(nullif(trim(autoField_10), ''), trim(pin)) AS p, address1 FROM ImportJobs
      WHERE upper(trim(iecCode)) = ? AND trim(CAST(coalesce(branchSrNo, 0) AS TEXT)) = ? AND coalesce(jobNo, '') NOT LIKE 'AMD/%'`,
    [importerIec, branch],
  );
  jobs.forEach((r) => {
    if (jobId && String(r.id) === String(jobId)) return;
    addPin(r.p, (entry) => ({
      jobs: entry.jobs + 1,
      sameAddress: entry.sameAddress + (addressKey && addrKey(r.address1) === addressKey ? 1 : 0),
    }));
  });
  const list = [...byPin.values()];
  list.forEach((x) => {
    x.stateOk = fitsState(x.pin, state);
  });
  return list.sort(
    (a, b) => b.stateOk - a.stateOk || b.master - a.master || b.sameAddress - a.sameAddress || b.jobs - a.jobs,
  );
}

// strict: one PIN only - written in the job's own address, or the only PIN of all other jobs with the same IEC + branch +
// address 1, or the only PIN of all other jobs with the same IEC + branch. Returns { pin, how } or null.
async function pick(q, job) {
  const own = pinInText(job.address1, job.address2, job.city);
  if (own) return fitsState(own, job.state) ? { pin: own, how: 'written in the address' } : null;
  const list = await suggest(q, {
    iec: job.iecCode,
    branchSrNo: job.branchSrNo,
    address1: job.address1,
    jobId: job.id,
    state: job.state,
  });
  if (list.some((x) => !x.stateOk)) return null; // a PIN of another state is in the data for this branch - the user decides
  const fromJobs = list.filter((x) => x.jobs > 0);
  const sameAddress = fromJobs.filter((x) => x.sameAddress > 0);
  // the Party master branch must not say otherwise
  const masterAgrees = (pin) => !list.some((x) => x.master && x.pin !== pin);
  if (sameAddress.length === 1 && masterAgrees(sameAddress[0].pin)) {
    return {
      pin: sameAddress[0].pin,
      how: `same importer, branch and address on ${sameAddress[0].sameAddress} other job(s)`,
    };
  }
  if (sameAddress.length === 0 && fromJobs.length === 1 && masterAgrees(fromJobs[0].pin)) {
    return { pin: fromJobs[0].pin, how: `same importer and branch on ${fromJobs[0].jobs} other job(s)` };
  }
  const master = list.filter((x) => x.master);
  if (!fromJobs.length && master.length === 1) return { pin: master[0].pin, how: 'Party master branch' };
  return null;
}

export { suggest, pick };
