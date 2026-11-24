// Sales module API (/api/sales-hub) - 11-Nov-2026.
// Step 1: sales persons (master + iCAFFE "marketing person" names), the customer's sales profile (prospect / customer,
// KAM and secondary sales persons with history, industry, segment, source, services, potential, competitors, credit asked),
// contacts, lanes, editable lists, and the customer's figures from the books / dockets.
const express = require('express');
const router = express.Router();
const S = require('../utils/salesHub');
const { q, x, now, today, clean, upper, numOrNull, listOf, csv } = S;

const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const send = (res, e) => res.status(e.status || 500).json({ success: false, error: e.message });
router.param('id', (req, res, next, id) => (/^\d+$/.test(String(id)) ? next() : next('route')));
const fyStart = (d = today()) => { const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)); return `${m < 4 ? y - 1 : y}-04-01`; };
const addYears = (d, n) => `${Number(d.slice(0, 4)) + n}${d.slice(4)}`;
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

// ------------------------------------------------------------------ lists
router.get('/meta', async (req, res) => {
  try {
    await S.ensure();
    const v = await S.viewer(req);
    const look = await q('SELECT id, kind, value, sortOrder, isActive FROM SalesLookups ORDER BY kind, sortOrder, value');
    const lookups = {}; for (const r of look) (lookups[r.kind] = lookups[r.kind] || []).push(r);
    const persons = await q('SELECT id, code, name, role, reportingToId, branchCodes, isActive, userId FROM SalesPersons ORDER BY isActive DESC, name');
    const branches = await q("SELECT branchCode code, branchName name FROM CompanyBranches WHERE coalesce(status, 'Active') <> 'Inactive' ORDER BY isDefault DESC, branchCode").catch(() => []);
    const countries = await q('SELECT code, name FROM Countries ORDER BY name').catch(() => []);
    const currencies = await q('SELECT currencyCode code FROM Currencies ORDER BY currencyCode').catch(() => []);
    res.json({
      success: true, statuses: S.CUSTOMER_STATUS, customerTypes: S.CUSTOMER_TYPES, segments: S.SEGMENTS, services: S.SERVICES, volumeUnits: S.VOLUME_UNITS,
      incoterms: S.INCOTERMS, containerTypes: S.CONTAINER_TYPES, roles: S.SP_ROLES, turnover: S.TURNOVER, creditTerms: S.CREDIT_TERMS, lookupKinds: Object.keys(S.LOOKUP_KINDS),
      lookups, persons, branches, countries, currencies: currencies.map(c => c.code),
      me: v.me ? { id: v.me.id, name: v.me.name, role: v.me.role } : null, isAdmin: v.isAdmin, canManage: v.canManage,
    });
  } catch (e) { send(res, e); }
});

// editable lists (industries, sources, competitors, lost reasons, departments, commodities)
router.post('/lookups', async (req, res) => {
  try {
    await S.ensure();
    const v = await S.viewer(req); if (!v.canManage) throw bad('Only a sales manager or admin can change the lists', 403);
    const kind = upper(req.body.kind), value = clean(req.body.value);
    if (!S.LOOKUP_KINDS[kind]) throw bad('Unknown list ' + kind);
    if (!value) throw bad('Type the value');
    const dup = (await q('SELECT id FROM SalesLookups WHERE kind = ? AND upper(value) = ?', [kind, value.toUpperCase()]))[0];
    if (dup) throw bad(`"${value}" is already in the list`);
    const max = (await q('SELECT max(sortOrder) m FROM SalesLookups WHERE kind = ?', [kind]))[0].m || 0;
    await x('INSERT INTO SalesLookups (kind, value, sortOrder, isActive, createdAt, updatedAt) VALUES (?,?,?,1,?,?)', [kind, value, max + 1, now(), now()]);
    res.json({ success: true });
  } catch (e) { send(res, e); }
});
router.put('/lookups/:id', async (req, res) => {
  try {
    await S.ensure();
    const v = await S.viewer(req); if (!v.canManage) throw bad('Only a sales manager or admin can change the lists', 403);
    const r = (await q('SELECT * FROM SalesLookups WHERE id = ?', [req.params.id]))[0]; if (!r) throw bad('Not found', 404);
    const value = req.body.value !== undefined ? clean(req.body.value) : r.value; if (!value) throw bad('Type the value');
    await x('UPDATE SalesLookups SET value = ?, isActive = ?, sortOrder = ?, updatedAt = ? WHERE id = ?',
      [value, req.body.isActive === undefined ? r.isActive : (req.body.isActive ? 1 : 0), numOrNull(req.body.sortOrder) ?? r.sortOrder, now(), r.id]);
    res.json({ success: true });
  } catch (e) { send(res, e); }
});

// ------------------------------------------------------------------ sales persons
async function personCounts() {
  const rows = await q("SELECT kamId, count(*) n, sum(CASE WHEN status = 'PROSPECT' THEN 1 ELSE 0 END) prospects FROM SalesCustomers GROUP BY kamId");
  return new Map(rows.map(r => [r.kamId, r]));
}
router.get('/persons', async (req, res) => {
  try {
    await S.ensure();
    const rows = await q(`SELECT p.*, r.name reportingToName, u.username loginName, u.email loginEmail FROM SalesPersons p LEFT JOIN SalesPersons r ON r.id = p.reportingToId
      LEFT JOIN Users u ON u.id = p.userId ORDER BY coalesce(p.isActive, 1) DESC, p.name`);
    const counts = await personCounts();
    res.json({ success: true, data: rows.map(r => ({ ...r, customers: (counts.get(r.id) || {}).n || 0, prospects: (counts.get(r.id) || {}).prospects || 0 })) });
  } catch (e) { send(res, e); }
});
router.get('/users', async (req, res) => {
  try { res.json({ success: true, data: await q("SELECT id, username, fullName, email, contactNumber, designation, department, branch FROM Users WHERE coalesce(status, 'Active') <> 'Inactive' ORDER BY coalesce(fullName, username)") }); }
  catch (e) { send(res, e); }
});
function personFields(b) {
  const f = {
    name: clean(b.name), code: upper(b.code), userId: numOrNull(b.userId), mobile: clean(b.mobile), phone: clean(b.phone), email: clean(b.email), whatsapp: clean(b.whatsapp),
    designation: clean(b.designation), role: upper(b.role) || 'EXECUTIVE', reportingToId: numOrNull(b.reportingToId), branchCodes: csv((listOf(b.branchCodes)).map(s => s.toUpperCase())),
    services: csv(b.services), aliases: csv(b.aliases), joinDate: clean(b.joinDate), leaveDate: clean(b.leaveDate), isActive: b.isActive === false || b.isActive === 0 || b.isActive === '0' ? 0 : 1,
    remarks: clean(b.remarks),
  };
  if (!f.name) throw bad('Name is required');
  if (!S.SP_ROLES.some(r => r[0] === f.role)) throw bad('Role must be one of ' + S.SP_ROLES.map(r => r[1]).join(', '));
  if (f.email && !S.EMAIL_RE.test(f.email)) throw bad(`E-mail "${f.email}" is not valid`);
  for (const k of ['mobile', 'whatsapp']) if (f[k] && !/^\+?[0-9 -]{10,15}$/.test(f[k])) throw bad(`${k === 'mobile' ? 'Mobile' : 'WhatsApp'} "${f[k]}" must be 10 to 15 digits`);
  if (f.joinDate && f.leaveDate && f.leaveDate < f.joinDate) throw bad('Leaving date is before the joining date');
  if (f.leaveDate && f.leaveDate <= today()) f.isActive = 0;
  return f;
}
async function checkPerson(f, id) {
  if ((await q('SELECT id FROM SalesPersons WHERE upper(name) = ? AND id <> ?', [f.name.toUpperCase(), id || 0]))[0]) throw bad(`A sales person named "${f.name}" already exists`);
  if (f.code && (await q('SELECT id FROM SalesPersons WHERE code = ? AND id <> ?', [f.code, id || 0]))[0]) throw bad(`Code ${f.code} is already used`);
  if (f.userId && (await q('SELECT id, name FROM SalesPersons WHERE userId = ? AND id <> ?', [f.userId, id || 0]))[0]) throw bad('That login is already linked to another sales person');
  if (f.reportingToId) {
    if (id && f.reportingToId === Number(id)) throw bad('A sales person cannot report to himself');
    const all = await q('SELECT id, reportingToId FROM SalesPersons'); const up = new Map(all.map(r => [r.id, r.reportingToId]));
    let cur = f.reportingToId; for (let i = 0; i < 50 && cur; i++) { if (id && cur === Number(id)) throw bad('This reporting line makes a loop'); cur = up.get(cur); }
  }
  // the same name / alias must not belong to two persons (iCAFFE names are matched by it)
  const all = await q('SELECT id, name, aliases FROM SalesPersons WHERE id <> ?', [id || 0]);
  for (const a of [f.name, ...listOf(f.aliases)]) {
    const k = S.nameKey(a);
    const hit = all.find(p => S.nameKey(p.name) === k || listOf(p.aliases).some(z => S.nameKey(z) === k));
    if (hit) throw bad(`"${a}" is already the name / alias of ${hit.name}`);
  }
}
async function nextPersonCode() {
  const rows = await q("SELECT code FROM SalesPersons WHERE code LIKE 'SP%'");
  let max = 0; rows.forEach(r => { const m = /^SP(\d+)$/.exec(r.code || ''); if (m) max = Math.max(max, Number(m[1])); });
  return 'SP' + String(max + 1).padStart(3, '0');
}
router.post('/persons', async (req, res) => {
  try {
    await S.ensure();
    const v = await S.viewer(req); if (!v.canManage) throw bad('Only a sales manager or admin can add sales persons', 403);
    const f = personFields(req.body || {}); if (!f.code) f.code = await nextPersonCode();
    await checkPerson(f);
    if (f.userId) { const u = (await q('SELECT username FROM Users WHERE id = ?', [f.userId]))[0]; if (!u) throw bad('Login not found'); f.username = u.username; }
    const keys = Object.keys(f);
    await x(`INSERT INTO SalesPersons (${keys.join(', ')}, createdBy, updatedBy, createdAt, updatedAt) VALUES (${keys.map(() => '?').join(', ')}, ?, ?, ?, ?)`, [...keys.map(k => f[k]), v.user, v.user, now(), now()]);
    const row = (await q('SELECT * FROM SalesPersons WHERE code = ?', [f.code]))[0];
    res.json({ success: true, data: row });
  } catch (e) { send(res, e); }
});
router.put('/persons/:id', async (req, res) => {
  try {
    await S.ensure();
    const v = await S.viewer(req); if (!v.canManage) throw bad('Only a sales manager or admin can change sales persons', 403);
    const cur = (await q('SELECT * FROM SalesPersons WHERE id = ?', [req.params.id]))[0]; if (!cur) throw bad('Sales person not found', 404);
    const f = personFields({ ...cur, ...req.body }); if (!f.code) f.code = cur.code || await nextPersonCode();
    await checkPerson(f, cur.id);
    f.username = null; if (f.userId) { const u = (await q('SELECT username FROM Users WHERE id = ?', [f.userId]))[0]; if (!u) throw bad('Login not found'); f.username = u.username; }
    // a person who leaves while still KAM of customers: the screen asks to move them first
    if (!f.isActive && cur.isActive !== 0) {
      const n = (await q("SELECT count(*) n FROM SalesCustomers WHERE kamId = ? AND status NOT IN ('LOST', 'BLOCKED')", [cur.id]))[0].n;
      if (n && !req.body.allowWithCustomers) return res.status(409).json({ success: false, needsMove: true, customers: n, error: `${cur.name} is still the KAM of ${n} customer(s) - move them to another sales person first` });
    }
    const keys = Object.keys(f);
    await x(`UPDATE SalesPersons SET ${keys.map(k => k + ' = ?').join(', ')}, updatedBy = ?, updatedAt = ? WHERE id = ?`, [...keys.map(k => f[k]), v.user, now(), cur.id]);
    res.json({ success: true, data: (await q('SELECT * FROM SalesPersons WHERE id = ?', [cur.id]))[0] });
  } catch (e) { send(res, e); }
});
// move all customers of one sales person to another (leaving / re-allocation) - with history
router.post('/persons/:id/move-customers', async (req, res) => {
  try {
    await S.ensure();
    const v = await S.viewer(req); if (!v.canManage) throw bad('Only a sales manager or admin can move customers', 403);
    const from = Number(req.params.id), to = numOrNull(req.body.toId);
    if (!to || to === from) throw bad('Pick the sales person who takes the customers');
    const tp = (await q('SELECT id, name, isActive FROM SalesPersons WHERE id = ?', [to]))[0]; if (!tp || tp.isActive === 0) throw bad('That sales person is not active');
    const reason = clean(req.body.reason) || 'Customers moved';
    const ids = (await q("SELECT id FROM SalesCustomers WHERE kamId = ? AND status NOT IN ('LOST', 'BLOCKED')", [from])).map(r => r.id);
    const d = clean(req.body.fromDate) || today();
    await sequelizeTx(async (t) => {
      for (const id of ids) {
        await x("UPDATE SalesAssignments SET toDate = ? WHERE customerId = ? AND role = 'KAM' AND toDate IS NULL", [d, id], t);
        await x("INSERT INTO SalesAssignments (customerId, salesPersonId, role, fromDate, toDate, reason, changedBy, createdAt) VALUES (?,?, 'KAM', ?, NULL, ?, ?, ?)", [id, to, d, reason, v.user, now()], t);
        await x('UPDATE SalesCustomers SET kamId = ?, updatedBy = ?, updatedAt = ? WHERE id = ?', [to, v.user, now(), id], t);
      }
    });
    res.json({ success: true, moved: ids.length, to: tp.name });
  } catch (e) { send(res, e); }
});
const sequelizeTx = (fn) => require('../db').sequelize.transaction(fn);

// add several iCAFFE names as sales persons at once (from the "Names found in iCAFFE" list); an existing name is skipped
router.post('/persons/from-names', async (req, res) => {
  try {
    await S.ensure();
    const v = await S.viewer(req); if (!v.canManage) throw bad('Only a sales manager or admin can add sales persons', 403);
    const names = listOf(req.body.names).map(n => n.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (!names.length) throw bad('Pick the names to add');
    const added = [], skipped = [];
    for (const n of names) {
      if (await S.personByName(n)) { skipped.push(n); continue; }
      const name = n === n.toUpperCase() ? n.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()) : n;
      const code = await nextPersonCode();
      await x(`INSERT INTO SalesPersons (code, name, role, branchCodes, aliases, isActive, remarks, createdBy, updatedBy, createdAt, updatedAt) VALUES (?, ?, 'EXECUTIVE', ?, ?, 1, ?, ?, ?, ?, ?)`,
        [code, name, csv(req.body.branchCodes) || null, name !== n ? n : null, 'Added from the names in iCAFFE', v.user, v.user, now(), now()]);
      added.push(name);
    }
    res.json({ success: true, added, skipped });
  } catch (e) { send(res, e); }
});

// names written in iCAFFE (docket "marketing person", party marketing person 1-3) that no sales person has yet
router.get('/persons/unmatched-names', async (req, res) => {
  try {
    await S.ensure();
    const src = [];
    const sh = await q("SELECT marketingPerson n, count(*) c, max(docketDate) last FROM Shipments WHERE trim(coalesce(marketingPerson, '')) <> '' GROUP BY upper(trim(marketingPerson))").catch(() => []);
    sh.forEach(r => src.push({ name: r.n.trim(), dockets: r.c, parties: 0, last: r.last }));
    for (const col of ['marketingPerson1', 'marketingPerson2', 'marketingPerson3']) {
      const pr = await q(`SELECT ${col} n, count(*) c FROM Parties WHERE trim(coalesce(${col}, '')) <> '' GROUP BY upper(trim(${col}))`).catch(() => []);
      pr.forEach(r => src.push({ name: r.n.trim(), dockets: 0, parties: r.c, last: null }));
    }
    // iCAFFE debtor groups named after a sales person ("SUNDRY DEBTORS (DEEPAK KUMAR)")
    const dg = [...await S.debtorGroupIds()];
    if (dg.length) {
      const gs = await q(`SELECT g.id, g.name, (SELECT count(*) FROM AccountLedgers l WHERE l.groupId = g.id) n FROM AccountGroups g WHERE g.id IN (${dg.join(',')})`);
      for (const g of gs) { const gi = S.groupInfo(g.name); if (gi.person) src.push({ name: gi.person, dockets: 0, parties: 0, ledgers: g.n, group: g.name, last: null }); }
    }
    const all = await q('SELECT id, name, aliases FROM SalesPersons');
    const by = new Map();
    for (const s of src) {
      const k = S.nameKey(s.name); if (!k) continue;
      const hit = all.find(p => S.nameKey(p.name) === k || listOf(p.aliases).some(a => S.nameKey(a) === k));
      const o = by.get(k) || { name: s.name, dockets: 0, parties: 0, ledgers: 0, groups: [], last: null, matchedTo: hit ? hit.name : null, matchedId: hit ? hit.id : null };
      o.dockets += s.dockets; o.parties += s.parties; o.ledgers += s.ledgers || 0; if (s.group) o.groups.push(s.group); if (s.last && (!o.last || s.last > o.last)) o.last = s.last;
      by.set(k, o);
    }
    res.json({ success: true, data: [...by.values()].sort((a, b) => (a.matchedTo ? 1 : 0) - (b.matchedTo ? 1 : 0) || b.dockets - a.dockets || a.name.localeCompare(b.name)) });
  } catch (e) { send(res, e); }
});

// ------------------------------------------------------------------ customers
// figures from the books, per accounts ledger: billed (sales less credit notes, incl. GST) this FY / last FY, last bill
let actCache = { at: 0, key: '', map: new Map() };
async function activity() {
  const fy = fyStart(); const key = fy;
  if (actCache.key === key && Date.now() - actCache.at < 600000) return actCache.map;
  const from = addYears(fy, -1);
  const rows = await q(`SELECT d.ledgerId id,
      sum(CASE WHEN v.date >= ? THEN (CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) ELSE 0 END) cy,
      sum(CASE WHEN v.date < ? THEN (CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) ELSE 0 END) ly,
      max(CASE WHEN t.baseType = 'Sales' THEN v.date END) lastBill, count(DISTINCT CASE WHEN t.baseType = 'Sales' AND v.date >= ? THEN v.id END) billsCy
    FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN VoucherDetails d ON d.voucherId = v.id
    WHERE t.baseType IN ('Sales', 'Credit Note') AND v.date >= ? AND coalesce(v.status, '') <> 'Rejected' GROUP BY d.ledgerId`, [fy, fy, fy, from]);
  const map = new Map(rows.map(r => [r.id, { cy: Math.round(r.cy || 0), ly: Math.round(r.ly || 0), lastBill: r.lastBill ? String(r.lastBill).slice(0, 10) : null, billsCy: r.billsCy || 0 }]));
  actCache = { at: Date.now(), key, map };
  return map;
}
// every ledger of each customer: the main one (SalesCustomers.ledgerId) and the linked ones
async function ledgersByCustomer(ids) {
  const out = new Map();
  if (!ids.length) return out;
  for (let i = 0; i < ids.length; i += 800) {
    const part = ids.slice(i, i + 800).join(',');
    for (const r of await q(`SELECT c.id customerId, c.ledgerId, 'MAIN' kind, l.name, g.name groupName FROM SalesCustomers c JOIN AccountLedgers l ON l.id = c.ledgerId
        LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE c.id IN (${part})
        UNION ALL SELECT customerId, ledgerId, kind, NULL, NULL FROM SalesCustomerLedgers WHERE customerId IN (${part})`)) {
      // a customer whose main ledger is itself a duty account (only duty is billed to it): its billing is reimbursement
      if (r.kind === 'MAIN' && S.isReimbLedger(r.name, r.groupName)) r.kind = 'REIMB';
      if (!out.has(r.customerId)) out.set(r.customerId, []); out.get(r.customerId).push(r);
    }
  }
  return out;
}
// billed figures of a customer over all its ledgers: service (main / other) and reimbursement (duty / DO accounts) apart
function sumActivity(list, act) {
  const o = { billedCy: 0, billedLy: 0, reimbCy: 0, reimbLy: 0, lastBill: null, billsCy: 0 };
  for (const l of list || []) {
    const a = act.get(l.ledgerId); if (!a) continue;
    if (l.kind === 'REIMB') { o.reimbCy += a.cy; o.reimbLy += a.ly; } else { o.billedCy += a.cy; o.billedLy += a.ly; o.billsCy += a.billsCy; }
    if (a.lastBill && (!o.lastBill || a.lastBill > o.lastBill)) o.lastBill = a.lastBill;
  }
  return o;
}
const activityFlag = (last) => {
  if (!last) return 'NONE';
  const d = daysBetween(last, today());
  return d <= 60 ? 'ACTIVE' : d <= 120 ? 'SLOWING' : 'DORMANT';
};

router.get('/customers', async (req, res) => {
  try {
    await S.ensure();
    const v = await S.viewer(req);
    const { w, p } = S.customerWhere(v);
    const Q = req.query;
    if (Q.status) { w.push('c.status = ?'); p.push(upper(Q.status)); }
    if (Q.kamId) { if (Q.kamId === 'none') w.push('c.kamId IS NULL'); else { w.push("(c.kamId = ? OR (',' || coalesce(c.secondaryIds, '') || ',') LIKE ?)"); p.push(Number(Q.kamId), `%,${Number(Q.kamId)},%`); } }
    if (Q.industry) { w.push('c.industry = ?'); p.push(Q.industry); }
    if (Q.segment) { w.push('c.segment = ?'); p.push(upper(Q.segment)); }
    if (Q.customerType) { w.push('c.customerType = ?'); p.push(upper(Q.customerType)); }
    if (Q.branch) { w.push('upper(c.branchCode) = ?'); p.push(upper(Q.branch)); }
    if (Q.service) { w.push("(',' || coalesce(c.services, '') || ',') LIKE ?"); p.push(`%,${upper(Q.service)},%`); }
    if (Q.reviewDue === '1') { w.push('c.nextReviewDate IS NOT NULL AND c.nextReviewDate <= ?'); p.push(today()); }
    if (clean(Q.q)) {
      const t = '%' + clean(Q.q).toLowerCase() + '%';
      w.push(`(lower(c.name) LIKE ? OR lower(coalesce(c.gstin, '')) LIKE ? OR lower(coalesce(c.city, '')) LIKE ? OR lower(coalesce(c.email, '')) LIKE ? OR lower(coalesce(c.phone, '')) LIKE ?
        OR c.id IN (SELECT customerId FROM SalesContacts WHERE lower(name) LIKE ? OR lower(coalesce(email, '')) LIKE ? OR coalesce(mobile, '') LIKE ?))`);
      p.push(t, t, t, t, t, t, t, t);
    }
    const rows = await q(`SELECT c.id, c.ledgerId, c.name, c.status, c.customerType, c.industry, c.segment, c.kamId, c.secondaryIds, c.branchCode, c.services, c.city, c.state, c.country,
        c.gstin, c.potentialRevenue, c.nextReviewDate, c.updatedAt, k.name kamName,
        (SELECT count(*) FROM SalesContacts s WHERE s.customerId = c.id AND coalesce(s.isActive, 1) = 1) contacts,
        (SELECT count(*) FROM SalesLanes l WHERE l.customerId = c.id AND coalesce(l.isActive, 1) = 1) lanes
      FROM SalesCustomers c LEFT JOIN SalesPersons k ON k.id = c.kamId ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY c.name`, p);
    const act = await activity();
    const lg = await ledgersByCustomer(rows.map(r => r.id));
    let data = rows.map(r => { const a = sumActivity(lg.get(r.id), act); return { ...r, ...a, ledgers: (lg.get(r.id) || []).length, activity: lg.get(r.id) ? activityFlag(a.lastBill) : 'NONE' }; });
    if (Q.activity) data = data.filter(r => r.activity === upper(Q.activity));
    const sort = Q.sort || 'name';
    if (sort === 'billed') data.sort((a, b) => b.billedCy - a.billedCy);
    else if (sort === 'lastBill') data.sort((a, b) => String(b.lastBill || '').localeCompare(String(a.lastBill || '')));
    else if (sort === 'potential') data.sort((a, b) => (b.potentialRevenue || 0) - (a.potentialRevenue || 0));
    const counts = {}; data.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    const limit = Math.min(Number(Q.limit) || 300, 5000);
    res.json({ success: true, total: data.length, counts, data: data.slice(0, limit), fy: fyStart() });
  } catch (e) { send(res, e); }
});

async function canSee(v, id) {
  const { w, p } = S.customerWhere(v);
  return !!(await q(`SELECT c.id FROM SalesCustomers c WHERE c.id = ?${w.length ? ' AND ' + w.join(' AND ') : ''}`, [id, ...p]))[0];
}

router.get('/customers/:id', async (req, res) => {
  try {
    await S.ensure();
    const v = await S.viewer(req);
    const c = (await q('SELECT c.*, k.name kamName FROM SalesCustomers c LEFT JOIN SalesPersons k ON k.id = c.kamId WHERE c.id = ?', [req.params.id]))[0];
    if (!c || !(await canSee(v, c.id))) throw bad('Customer not found', 404);
    const contacts = await q('SELECT * FROM SalesContacts WHERE customerId = ? ORDER BY isPrimary DESC, coalesce(isActive, 1) DESC, name', [c.id]);
    const lanes = await q('SELECT * FROM SalesLanes WHERE customerId = ? ORDER BY coalesce(isActive, 1) DESC, service, origin, destination', [c.id]);
    const history = await q('SELECT a.*, p.name personName FROM SalesAssignments a LEFT JOIN SalesPersons p ON p.id = a.salesPersonId WHERE a.customerId = ? ORDER BY a.fromDate DESC, a.id DESC', [c.id]);
    const ledger = c.ledgerId ? (await q('SELECT l.id, l.name, l.gstin, l.pan, l.creditDays, l.creditLimit, l.isBlacklisted, l.blacklistReason, l.dealingBranch, l.partyId, l.isActive, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE l.id = ?', [c.ledgerId]))[0] : null;
    const ledgers = await q(`SELECT cl.id, cl.ledgerId, cl.kind, l.name, l.gstin, g.name groupName FROM SalesCustomerLedgers cl JOIN AccountLedgers l ON l.id = cl.ledgerId
      LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE cl.customerId = ? ORDER BY cl.kind, l.name`, [c.id]);
    res.json({ success: true, data: { ...c, contacts, lanes, history, ledger, ledgers, figures: await figures(c, ledger, ledgers) } });
  } catch (e) { send(res, e); }
});

// what the books and the dockets say about this customer
async function figures(c, ledger, linked = []) {
  const out = { months: [], billedCy: 0, billedLy: 0, reimbCy: 0, reimbLy: 0, lastBill: null, billsCy: 0, activity: 'NONE', dockets: { cy: 0, ly: 0, last: null, byDivision: {} }, marketingNames: [] };
  const fy = fyStart(), lfy = addYears(fy, -1);
  const ids = [...(ledger ? [{ ledgerId: ledger.id, kind: S.isReimbLedger(ledger.name, ledger.groupName) ? 'REIMB' : 'MAIN' }] : []), ...linked];
  if (ids.length) {
    const reimb = new Set(ids.filter(l => l.kind === 'REIMB').map(l => l.ledgerId));
    const rows = await q(`SELECT d.ledgerId lid, substr(v.date, 1, 7) m, sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) amt, count(DISTINCT CASE WHEN t.baseType = 'Sales' THEN v.id END) bills, max(CASE WHEN t.baseType = 'Sales' THEN v.date END) last
      FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
      WHERE d.ledgerId IN (${ids.map(l => Number(l.ledgerId)).join(',')}) AND t.baseType IN ('Sales', 'Credit Note') AND coalesce(v.status, '') <> 'Rejected' AND v.date >= ? GROUP BY d.ledgerId, m ORDER BY m`, [lfy]);
    const byM = new Map();
    for (const r of rows) {
      const amt = Math.round(r.amt || 0); const isR = reimb.has(r.lid);
      const o = byM.get(r.m) || { month: r.m, billed: 0, reimb: 0, bills: 0 };
      if (isR) o.reimb += amt; else { o.billed += amt; o.bills += r.bills; }
      byM.set(r.m, o);
      const cy = `${r.m}-01` >= fy;
      if (isR) { if (cy) out.reimbCy += amt; else out.reimbLy += amt; } else if (cy) { out.billedCy += amt; out.billsCy += r.bills; } else out.billedLy += amt;
      if (r.last && (!out.lastBill || r.last > out.lastBill)) out.lastBill = String(r.last).slice(0, 10);
    }
    out.months = [...byM.values()].sort((a, b) => a.month.localeCompare(b.month));
    if (!out.lastBill) { const l = (await q(`SELECT max(v.date) d FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE d.ledgerId IN (${ids.map(l => Number(l.ledgerId)).join(',')}) AND t.baseType = 'Sales'`))[0]; out.lastBill = l && l.d ? String(l.d).slice(0, 10) : null; }
    out.activity = activityFlag(out.lastBill);
  }
  // dockets (Shipment Registration): the party of the ledger, or the same name as main / billing party
  const partyId = (ledger && ledger.partyId) || c.partyId;
  const nm = String(c.name || '').trim().toUpperCase();
  const sh = await q(`SELECT division, docketDate, marketingPerson FROM Shipments WHERE coalesce(stage, '') <> 'Cancelled' AND docketDate >= ?
      AND (${partyId ? 'mainPartyId = ? OR ' : ''}upper(trim(mainParty)) = ? OR upper(trim(billingParty)) = ?)`, [lfy, ...(partyId ? [partyId] : []), nm, nm]).catch(() => []);
  const names = new Map();
  for (const s of sh) {
    const d = String(s.docketDate || '').slice(0, 10);
    if (d >= fy) { out.dockets.cy++; out.dockets.byDivision[s.division] = (out.dockets.byDivision[s.division] || 0) + 1; } else out.dockets.ly++;
    if (!out.dockets.last || d > out.dockets.last) out.dockets.last = d;
    const mp = String(s.marketingPerson || '').trim(); if (mp) names.set(mp, (names.get(mp) || 0) + 1);
  }
  out.marketingNames = [...names.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, dockets: n }));
  return out;
}

function customerFields(b, cur = {}) {
  const f = {
    ledgerId: b.ledgerId !== undefined ? numOrNull(b.ledgerId) : cur.ledgerId ?? null,
    partyId: b.partyId !== undefined ? numOrNull(b.partyId) : cur.partyId ?? null,
    name: clean(b.name), status: upper(b.status) || 'PROSPECT', customerType: upper(b.customerType), industry: clean(b.industry), segment: upper(b.segment),
    source: clean(b.source), sourceDetail: clean(b.sourceDetail), kamId: numOrNull(b.kamId), secondaryIds: csv(listOf(b.secondaryIds).map(Number).filter(n => n && n !== numOrNull(b.kamId))),
    branchCode: upper(b.branchCode), services: csv(listOf(b.services).map(s => s.toUpperCase())),
    address: clean(b.address), city: clean(b.city), state: clean(b.state), country: upper(b.country), pinCode: clean(b.pinCode),
    gstin: upper(b.gstin), pan: upper(b.pan), iec: upper(b.iec), website: clean(b.website), phone: clean(b.phone), email: clean(b.email),
    turnoverBand: clean(b.turnoverBand), employees: clean(b.employees),
    potentialAirKg: numOrNull(b.potentialAirKg), potentialSeaFclTeu: numOrNull(b.potentialSeaFclTeu), potentialSeaLclCbm: numOrNull(b.potentialSeaLclCbm),
    potentialCustomsJobs: numOrNull(b.potentialCustomsJobs), potentialTrucks: numOrNull(b.potentialTrucks), potentialRevenue: numOrNull(b.potentialRevenue),
    currentSharePct: numOrNull(b.currentSharePct), competitors: csv(b.competitors),
    creditTerm: upper(b.creditTerm), creditDaysAsked: numOrNull(b.creditDaysAsked), creditLimitAsked: numOrNull(b.creditLimitAsked),
    firstContactDate: clean(b.firstContactDate), nextReviewDate: clean(b.nextReviewDate),
    lostReason: clean(b.lostReason), lostTo: clean(b.lostTo), lostDate: clean(b.lostDate), remarks: clean(b.remarks),
  };
  const errs = [];
  if (!f.name) errs.push('Customer name is required');
  if (!S.CUSTOMER_STATUS.some(s => s[0] === f.status)) errs.push('Unknown status ' + f.status);
  if (f.customerType && !S.CUSTOMER_TYPES.some(s => s[0] === f.customerType)) errs.push('Unknown customer type ' + f.customerType);
  if (f.segment && !S.SEGMENTS.some(s => s[0] === f.segment)) errs.push('Unknown segment ' + f.segment);
  for (const s of listOf(f.services)) if (!S.SERVICES.some(z => z[0] === s)) errs.push('Unknown service ' + s);
  if (f.creditTerm && !S.CREDIT_TERMS.some(s => s[0] === f.creditTerm)) errs.push('Unknown credit term ' + f.creditTerm);
  if (f.gstin && !S.GSTIN_RE.test(f.gstin)) errs.push(`GSTIN "${f.gstin}" is not a valid 15-character GSTIN`);
  if (f.pan && !S.PAN_RE.test(f.pan)) errs.push(`PAN "${f.pan}" is not valid (5 letters, 4 digits, 1 letter)`);
  if (f.gstin && f.pan && f.gstin.slice(2, 12) !== f.pan) errs.push('PAN does not match the GSTIN (characters 3 to 12)');
  if (f.iec && !/^[A-Z0-9]{10}$/.test(f.iec)) errs.push(`IEC "${f.iec}" must be 10 letters / digits`);
  if (f.email && !S.EMAIL_RE.test(f.email)) errs.push(`E-mail "${f.email}" is not valid`);
  if (f.pinCode && f.country === 'IN' && !/^\d{6}$/.test(f.pinCode)) errs.push('PIN must be 6 digits');
  for (const k of ['potentialAirKg', 'potentialSeaFclTeu', 'potentialSeaLclCbm', 'potentialCustomsJobs', 'potentialTrucks', 'potentialRevenue', 'creditDaysAsked', 'creditLimitAsked'])
    if (f[k] != null && f[k] < 0) errs.push(k + ' cannot be negative');
  if (f.currentSharePct != null && (f.currentSharePct < 0 || f.currentSharePct > 100)) errs.push('Our share must be 0 to 100 %');
  if (f.status === 'LOST' && !f.lostReason) errs.push('A lost customer needs the reason it was lost');
  if (f.status === 'LOST' && !f.lostDate) f.lostDate = today();
  if (f.status !== 'LOST') { f.lostReason = null; f.lostTo = null; f.lostDate = null; }
  if (f.status === 'ACTIVE' && !f.ledgerId) errs.push('An active customer must be linked to its accounts ledger (it is billed there) - keep it a prospect until then');
  if (errs.length) throw Object.assign(bad(errs[0]), { errors: errs });
  return f;
}
function contactRows(list) {
  const out = []; const errs = [];
  (Array.isArray(list) ? list : []).forEach((c, i) => {
    const r = { name: clean(c.name), designation: clean(c.designation), department: clean(c.department), mobile: clean(c.mobile), phone: clean(c.phone), email: clean(c.email),
      whatsapp: clean(c.whatsapp), isPrimary: c.isPrimary ? 1 : 0, isDecisionMaker: c.isDecisionMaker ? 1 : 0, sendQuotes: c.sendQuotes === false || c.sendQuotes === 0 ? 0 : 1,
      birthday: clean(c.birthday), anniversary: clean(c.anniversary), linkedin: clean(c.linkedin), remarks: clean(c.remarks), isActive: c.isActive === false || c.isActive === 0 ? 0 : 1 };
    if (!r.name && !r.email && !r.mobile) return;
    if (!r.name) errs.push(`Contact ${i + 1}: name is required`);
    if (r.email && !S.EMAIL_RE.test(r.email)) errs.push(`Contact ${r.name || i + 1}: e-mail "${r.email}" is not valid`);
    for (const k of ['mobile', 'whatsapp']) if (r[k] && !/^\+?[0-9 -]{10,15}$/.test(r[k])) errs.push(`Contact ${r.name || i + 1}: ${k} "${r[k]}" must be 10 to 15 digits`);
    if (!r.email && !r.mobile && !r.phone) errs.push(`Contact ${r.name || i + 1}: give a mobile, phone or e-mail`);
    out.push(r);
  });
  if (out.filter(r => r.isPrimary).length > 1) errs.push('Only one contact can be the primary contact');
  if (out.length && !out.some(r => r.isPrimary)) out[0].isPrimary = 1;
  return { out, errs };
}
function laneRows(list) {
  const out = []; const errs = [];
  (Array.isArray(list) ? list : []).forEach((l, i) => {
    const r = { service: upper(l.service), origin: upper(l.origin), originCountry: upper(l.originCountry), destination: upper(l.destination), destinationCountry: upper(l.destinationCountry),
      commodity: clean(l.commodity), hsCode: clean(l.hsCode), incoterm: upper(l.incoterm), containerType: upper(l.containerType), shipmentsPerMonth: numOrNull(l.shipmentsPerMonth),
      volumePerShipment: numOrNull(l.volumePerShipment), volumeUnit: upper(l.volumeUnit), isDg: l.isDg ? 1 : 0, isTempControlled: l.isTempControlled ? 1 : 0,
      currentVendor: clean(l.currentVendor), currentRate: numOrNull(l.currentRate), rateCurrency: upper(l.rateCurrency), rateBasis: clean(l.rateBasis), targetRate: numOrNull(l.targetRate),
      status: upper(l.status) || 'OPEN', remarks: clean(l.remarks), isActive: l.isActive === false || l.isActive === 0 ? 0 : 1 };
    if (!r.service && !r.origin && !r.destination && !r.commodity) return;
    const W = `Lane ${i + 1}`;
    if (!r.service || !S.SERVICES.some(s => s[0] === r.service)) errs.push(`${W}: pick the service`);
    if (!r.origin && !r.originCountry) errs.push(`${W}: origin is required`);
    if (!r.destination && !r.destinationCountry) errs.push(`${W}: destination is required`);
    if (r.incoterm && !S.INCOTERMS.includes(r.incoterm)) errs.push(`${W}: incoterm ${r.incoterm} is not valid`);
    if (r.volumeUnit && !S.VOLUME_UNITS.some(u => u[0] === r.volumeUnit)) errs.push(`${W}: unit ${r.volumeUnit} is not valid`);
    if (r.containerType && !S.CONTAINER_TYPES.includes(r.containerType)) errs.push(`${W}: container type ${r.containerType} is not valid`);
    if (/FCL/.test(r.service || '') && !r.containerType) errs.push(`${W}: FCL needs the container type`);
    for (const k of ['shipmentsPerMonth', 'volumePerShipment', 'currentRate', 'targetRate']) if (r[k] != null && r[k] < 0) errs.push(`${W}: ${k} cannot be negative`);
    if ((r.currentRate != null || r.targetRate != null) && !r.rateCurrency) r.rateCurrency = 'INR';
    if (!['OPEN', 'QUOTED', 'WON', 'LOST'].includes(r.status)) errs.push(`${W}: status must be OPEN, QUOTED, WON or LOST`);
    out.push(r);
  });
  return { out, errs };
}
async function duplicateOf(f, id) {
  if (f.ledgerId) {
    const d = (await q('SELECT id, name FROM SalesCustomers WHERE ledgerId = ? AND id <> ?', [f.ledgerId, id || 0]))[0]; if (d) throw bad(`This ledger already has a sales profile: ${d.name}`);
    const l = (await q('SELECT c.name FROM SalesCustomerLedgers cl JOIN SalesCustomers c ON c.id = cl.customerId WHERE cl.ledgerId = ? AND cl.customerId <> ?', [f.ledgerId, id || 0]))[0];
    if (l) throw bad(`This ledger is already linked to the customer ${l.name}`);
  }
  if (f.gstin) { const d = (await q('SELECT id, name FROM SalesCustomers WHERE gstin = ? AND id <> ?', [f.gstin, id || 0]))[0]; if (d) return `GSTIN ${f.gstin} is already on ${d.name}`; }
  const k = S.nameKey(f.name).replace(/\b(PVT|PRIVATE|LTD|LIMITED|LLP|INC|CO|COMPANY|THE)\b/g, '').replace(/\s+/g, ' ').trim();
  if (k) {
    const same = (await q('SELECT id, name FROM SalesCustomers WHERE id <> ?', [id || 0])).find(r => S.nameKey(r.name).replace(/\b(PVT|PRIVATE|LTD|LIMITED|LLP|INC|CO|COMPANY|THE)\b/g, '').replace(/\s+/g, ' ').trim() === k);
    if (same) return `A customer with almost the same name exists: ${same.name}`;
  }
  return '';
}
async function saveChildren(id, body, t) {
  if (body.ledgers !== undefined) {
    const list = (Array.isArray(body.ledgers) ? body.ledgers : []).map(l => ({ ledgerId: numOrNull(l.ledgerId), kind: upper(l.kind) === 'REIMB' ? 'REIMB' : 'OTHER' })).filter(l => l.ledgerId);
    const main = (await q('SELECT ledgerId FROM SalesCustomers WHERE id = ?', [id], t))[0].ledgerId;
    const seen = new Set();
    for (const l of list) {
      if (l.ledgerId === main) throw bad('The main ledger is already the customer\'s ledger - do not add it again');
      if (seen.has(l.ledgerId)) throw bad('A ledger is listed twice'); seen.add(l.ledgerId);
      if (!(await q('SELECT id FROM AccountLedgers WHERE id = ?', [l.ledgerId], t))[0]) throw bad('Ledger ' + l.ledgerId + ' not found');
      const other = (await q('SELECT c.name FROM SalesCustomers c WHERE c.ledgerId = ? AND c.id <> ? UNION SELECT c.name FROM SalesCustomerLedgers cl JOIN SalesCustomers c ON c.id = cl.customerId WHERE cl.ledgerId = ? AND cl.customerId <> ?', [l.ledgerId, id, l.ledgerId, id], t))[0];
      if (other) throw bad('That ledger already belongs to the customer ' + other.name);
    }
    await x('DELETE FROM SalesCustomerLedgers WHERE customerId = ?', [id], t);
    for (const l of list) await x('INSERT INTO SalesCustomerLedgers (customerId, ledgerId, kind, createdAt) VALUES (?,?,?,?)', [id, l.ledgerId, l.kind, now()], t);
  }
  if (body.contacts !== undefined) {
    const { out } = contactRows(body.contacts);
    await x('DELETE FROM SalesContacts WHERE customerId = ?', [id], t);
    for (const r of out) { const k = Object.keys(r); await x(`INSERT INTO SalesContacts (customerId, ${k.join(', ')}, createdAt, updatedAt) VALUES (?, ${k.map(() => '?').join(', ')}, ?, ?)`, [id, ...k.map(z => r[z]), now(), now()], t); }
  }
  if (body.lanes !== undefined) {
    const { out } = laneRows(body.lanes);
    await x('DELETE FROM SalesLanes WHERE customerId = ?', [id], t);
    for (const r of out) { const k = Object.keys(r); await x(`INSERT INTO SalesLanes (customerId, ${k.join(', ')}, createdAt, updatedAt) VALUES (?, ${k.map(() => '?').join(', ')}, ?, ?)`, [id, ...k.map(z => r[z]), now(), now()], t); }
  }
}
function validateAll(body, cur) {
  const errors = [];
  let f = null;
  try { f = customerFields(body, cur); } catch (e) { errors.push(...(e.errors || [e.message])); }
  if (body.contacts !== undefined) errors.push(...contactRows(body.contacts).errs);
  if (body.lanes !== undefined) errors.push(...laneRows(body.lanes).errs);
  if (errors.length) throw Object.assign(bad(errors[0]), { errors });
  return f;
}
async function assignmentChange(id, oldKam, newKam, reason, by, t) {
  if ((oldKam || null) === (newKam || null)) return;
  await x("UPDATE SalesAssignments SET toDate = ? WHERE customerId = ? AND role = 'KAM' AND toDate IS NULL", [today(), id], t);
  if (newKam) await x("INSERT INTO SalesAssignments (customerId, salesPersonId, role, fromDate, toDate, reason, changedBy, createdAt) VALUES (?,?, 'KAM', ?, NULL, ?, ?, ?)", [id, newKam, today(), reason || (oldKam ? 'KAM changed' : 'KAM given'), by, now()], t);
}

router.post('/customers', async (req, res) => {
  try {
    await S.ensure();
    const v = await S.viewer(req);
    const b = req.body || {};
    if (v.team && !b.kamId) b.kamId = v.me.id; // a sales person's new customer is his own
    if (!b.branchCode) b.branchCode = (v.branches && v.branches[0]) || (v.me && listOf(v.me.branchCodes)[0]) || null;
    const f = validateAll(b);
    if (v.team && f.kamId && !v.team.has(f.kamId)) throw bad('You can give a customer only to yourself or your team', 403);
    if (f.kamId && !(await q('SELECT id FROM SalesPersons WHERE id = ? AND coalesce(isActive, 1) = 1', [f.kamId]))[0]) throw bad('The KAM picked is not an active sales person');
    const dup = await duplicateOf(f);
    if (dup && !b.allowDuplicate) return res.status(409).json({ success: false, duplicate: true, error: dup });
    if (f.ledgerId) { const l = (await q('SELECT partyId FROM AccountLedgers WHERE id = ?', [f.ledgerId]))[0]; if (!l) throw bad('Ledger not found'); if (!f.partyId) f.partyId = l.partyId || null; }
    if (!f.firstContactDate) f.firstContactDate = today();
    let id;
    await sequelizeTx(async (t) => {
      const k = Object.keys(f);
      await x(`INSERT INTO SalesCustomers (${k.join(', ')}, createdBy, updatedBy, createdAt, updatedAt) VALUES (${k.map(() => '?').join(', ')}, ?, ?, ?, ?)`, [...k.map(z => f[z]), v.user, v.user, now(), now()], t);
      id = (await q('SELECT max(id) id FROM SalesCustomers', [], t))[0].id;
      await assignmentChange(id, null, f.kamId, 'New customer', v.user, t);
      await saveChildren(id, b, t);
    });
    res.json({ success: true, id });
  } catch (e) { e.errors ? res.status(e.status || 400).json({ success: false, error: e.message, errors: e.errors }) : send(res, e); }
});

router.put('/customers/:id', async (req, res) => {
  try {
    await S.ensure();
    const v = await S.viewer(req);
    const cur = (await q('SELECT * FROM SalesCustomers WHERE id = ?', [req.params.id]))[0];
    if (!cur || !(await canSee(v, cur.id))) throw bad('Customer not found', 404);
    const b = { ...cur, ...req.body };
    const f = validateAll(b, cur);
    if (f.kamId !== cur.kamId && !v.canManage) throw bad('Only a sales manager or admin can change the KAM', 403);
    if (f.kamId && f.kamId !== cur.kamId && !(await q('SELECT id FROM SalesPersons WHERE id = ? AND coalesce(isActive, 1) = 1', [f.kamId]))[0]) throw bad('The KAM picked is not an active sales person');
    if (f.kamId !== cur.kamId && !clean(req.body.kamReason) && cur.kamId) throw bad('Give the reason the KAM is changed');
    const dup = await duplicateOf(f, cur.id);
    if (dup && !req.body.allowDuplicate) return res.status(409).json({ success: false, duplicate: true, error: dup });
    if (f.ledgerId && f.ledgerId !== cur.ledgerId) { const l = (await q('SELECT partyId FROM AccountLedgers WHERE id = ?', [f.ledgerId]))[0]; if (!l) throw bad('Ledger not found'); f.partyId = f.partyId || l.partyId || null; }
    await sequelizeTx(async (t) => {
      const k = Object.keys(f);
      await x(`UPDATE SalesCustomers SET ${k.map(z => z + ' = ?').join(', ')}, updatedBy = ?, updatedAt = ? WHERE id = ?`, [...k.map(z => f[z]), v.user, now(), cur.id], t);
      await assignmentChange(cur.id, cur.kamId, f.kamId, clean(req.body.kamReason), v.user, t);
      await saveChildren(cur.id, req.body, t);
    });
    res.json({ success: true, id: cur.id });
  } catch (e) { e.errors ? res.status(e.status || 400).json({ success: false, error: e.message, errors: e.errors }) : send(res, e); }
});

// a prospect that never did business can be removed; anything else is marked Lost / Blocked instead
router.delete('/customers/:id', async (req, res) => {
  try {
    await S.ensure();
    const v = await S.viewer(req); if (!v.canManage) throw bad('Only a sales manager or admin can delete', 403);
    const c = (await q('SELECT * FROM SalesCustomers WHERE id = ?', [req.params.id]))[0]; if (!c) throw bad('Not found', 404);
    if (c.status !== 'PROSPECT' || c.ledgerId) throw bad('Only a prospect without a ledger can be deleted - mark this one Lost or Blocked');
    await sequelizeTx(async (t) => {
      for (const tb of ['SalesContacts', 'SalesLanes', 'SalesAssignments', 'SalesCustomerLedgers']) await x(`DELETE FROM ${tb} WHERE customerId = ?`, [c.id], t);
      await x('DELETE FROM SalesCustomers WHERE id = ?', [c.id], t);
    });
    res.json({ success: true });
  } catch (e) { send(res, e); }
});

// debtor ledgers for linking / picking (not yet with a profile unless asked)
router.get('/ledgers', async (req, res) => {
  try {
    await S.ensure();
    const groups = [...await S.debtorGroupIds()];
    if (!groups.length) return res.json({ success: true, data: [] });
    const t = '%' + String(req.query.q || '').trim().toLowerCase() + '%';
    const rows = await q(`SELECT l.id, l.name, l.gstin, l.pan, l.state, l.address, l.pinCode, l.country, l.email, l.phone, l.contactPerson, l.dealingBranch, l.creditDays, l.creditLimit, l.partyId,
        coalesce((SELECT id FROM SalesCustomers c WHERE c.ledgerId = l.id), (SELECT customerId FROM SalesCustomerLedgers cl WHERE cl.ledgerId = l.id)) profileId,
        (SELECT g.name FROM AccountGroups g WHERE g.id = l.groupId) groupName
      FROM AccountLedgers l WHERE l.groupId IN (${groups.join(',')}) AND coalesce(l.isActive, 1) = 1 AND (lower(l.name) LIKE ? OR lower(coalesce(l.gstin, '')) LIKE ?)
      ORDER BY l.name LIMIT 50`, [t, t]);
    res.json({ success: true, data: req.query.all === '1' ? rows : rows.filter(r => !r.profileId || String(r.profileId) === String(req.query.keep || '')) });
  } catch (e) { send(res, e); }
});

// Load customers from the books: every debtor ledger billed since a date gets a sales profile. A customer's ledgers are
// put together - same PAN (from GSTIN / PAN) or the same name without the account suffixes - so "X PVT LTD" and
// "X PVT LTD (IMPORT DUTY ACCOUNT)" / "-DUTY A/C" / "- DO" are one customer: the main ledger is the service one billed
// most, the duty / DO / direct-party ones are linked as reimbursement accounts.
// From the iCAFFE debtor group: the KAM (group named after a sales person, when that name is a sales person here), Blocked
// (CASE / Blocked Recoveries), On hold (Disputed / W-KYC), Overseas agent, Courier. Else the KAM is the sales person whose
// iCAFFE name is on most of its dockets. Branch = the branch it is billed from most. Existing profiles are not changed; a new
// ledger of an existing customer is linked to it.
router.post('/customers/load-from-books', async (req, res) => {
  try {
    await S.ensure();
    const v = await S.viewer(req); if (!v.isAdmin && !v.canManage) throw bad('Only a sales manager or admin can load customers', 403);
    const since = clean(req.body.since) || addYears(fyStart(), -1);
    const dry = req.body.dryRun === true || req.body.dryRun === '1';
    const groups = [...await S.debtorGroupIds()];
    if (!groups.length) throw bad('No Sundry Debtors group in the accounts');
    const billed = await q(`SELECT d.ledgerId id, count(DISTINCT v.id) bills, max(v.date) last, sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) amt,
        (SELECT v2.branchCode FROM Vouchers v2 JOIN VoucherDetails d2 ON d2.voucherId = v2.id WHERE d2.ledgerId = d.ledgerId AND v2.date >= ? GROUP BY v2.branchCode ORDER BY count(*) DESC LIMIT 1) branch
      FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
      WHERE t.baseType = 'Sales' AND v.date >= ? AND coalesce(v.status, '') <> 'Rejected' AND d.ledgerId IN (SELECT id FROM AccountLedgers WHERE groupId IN (${groups.join(',')}))
      GROUP BY d.ledgerId`, [since, since]);
    const gname = new Map((await q(`SELECT id, name FROM AccountGroups WHERE id IN (${groups.join(',')})`)).map(g => [g.id, g.name]));
    const L = new Map();
    for (const b of billed) {
      const l = (await q('SELECT id, name, groupId, gstin, pan, partyId, address, state, pinCode, country, email, phone, contactPerson, creditDays, dealingBranch FROM AccountLedgers WHERE id = ?', [b.id]))[0];
      if (!l) continue;
      const g = gname.get(l.groupId) || '';
      L.set(l.id, { ...l, bills: b.bills, last: String(b.last).slice(0, 10), amt: b.amt || 0, branch: b.branch, group: g, gi: S.groupInfo(g), reimb: S.isReimbLedger(l.name, g), pan: S.panOf(l.gstin, l.pan), base: S.baseName(l.name) });
    }
    // put the ledgers of one customer together (union by PAN and by base name)
    const parent = new Map([...L.keys()].map(k => [k, k]));
    const find = (a) => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
    const join = (a, b) => { const x1 = find(a), y1 = find(b); if (x1 !== y1) parent.set(x1, y1); };
    const byPan = new Map(), byBase = new Map();
    for (const l of L.values()) {
      if (l.pan) { if (byPan.has(l.pan)) join(l.id, byPan.get(l.pan)); else byPan.set(l.pan, l.id); }
      if (l.base && l.base.length >= 4) { if (byBase.has(l.base)) join(l.id, byBase.get(l.base)); else byBase.set(l.base, l.id); }
    }
    const clusters = new Map();
    for (const l of L.values()) { const r = find(l.id); if (!clusters.has(r)) clusters.set(r, []); clusters.get(r).push(l); }
    // what is already there
    const owner = new Map();
    for (const r of await q('SELECT id, ledgerId FROM SalesCustomers WHERE ledgerId IS NOT NULL')) owner.set(r.ledgerId, r.id);
    for (const r of await q('SELECT customerId, ledgerId FROM SalesCustomerLedgers')) owner.set(r.ledgerId, r.customerId);
    const persons = await q('SELECT id, name, aliases FROM SalesPersons WHERE coalesce(isActive, 1) = 1');
    const match = (n) => { const k = S.nameKey(n); return k ? persons.find(p => S.nameKey(p.name) === k || listOf(p.aliases).some(a => S.nameKey(a) === k)) || null : null; };
    const res1 = { made: 0, linked: 0, withKam: 0, kamFromGroup: 0, kamFromDockets: 0, blocked: 0, onHold: 0, multiLedger: 0, unmatchedNames: new Map() };
    const sample = [];
    const run = async (t) => {
      for (const list of clusters.values()) {
        const svc = list.filter(l => !l.reimb);
        // main ledger: a service one, not closed in iCAFFE ("XX...XX" names), billed most
        const closed = (l) => /^\s*XX/i.test(l.name || '') || /XX\s*$/i.test(l.name || '');
        const main = (svc.length ? svc : list).slice().sort((a, b) => (closed(a) - closed(b)) || b.bills - a.bills || b.amt - a.amt)[0];
        const existing = list.map(l => owner.get(l.id)).find(Boolean);
        if (existing) { // new ledgers of a customer already here are linked to it
          for (const l of list) if (!owner.has(l.id)) { res1.linked++; if (!dry) await x('INSERT INTO SalesCustomerLedgers (customerId, ledgerId, kind, createdBy, createdAt) VALUES (?,?,?,?,?)', [existing, l.id, l.reimb ? 'REIMB' : 'OTHER', v.user, now()], t); owner.set(l.id, existing); }
          continue;
        }
        // KAM: debtor group person, else the iCAFFE marketing person on most dockets
        let kam = null, kamFrom = '';
        for (const l of [main, ...list]) if (l.gi.person) { const m = match(l.gi.person); if (m) { kam = m; kamFrom = 'debtor group ' + l.group; break; } res1.unmatchedNames.set(l.gi.person, (res1.unmatchedNames.get(l.gi.person) || 0) + 1); }
        if (!kam) {
          const nm = String(main.name || '').trim().toUpperCase();
          const mp = (await q(`SELECT marketingPerson n, count(*) c FROM Shipments WHERE trim(coalesce(marketingPerson, '')) <> '' AND docketDate >= ? AND (${main.partyId ? 'mainPartyId = ? OR ' : ''}upper(trim(billingParty)) = ? OR upper(trim(mainParty)) = ?)
            GROUP BY upper(trim(marketingPerson)) ORDER BY c DESC LIMIT 1`, [since, ...(main.partyId ? [main.partyId] : []), nm, nm], t).catch(() => []))[0];
          if (mp) { const m = match(mp.n); if (m) { kam = m; kamFrom = 'iCAFFE marketing person on its dockets'; } else res1.unmatchedNames.set(mp.n, (res1.unmatchedNames.get(mp.n) || 0) + 1); }
        }
        const status = list.map(l => l.gi.status).find(Boolean) || 'ACTIVE';
        const svcAmt = svc.reduce((a, l) => a + l.amt, 0), svcBills = (svc.length ? svc : list).reduce((a, l) => a + l.bills, 0);
        const services = [...new Set(list.map(l => l.gi.service).filter(Boolean))];
        const gst = main.gstin && S.GSTIN_RE.test(String(main.gstin).toUpperCase()) ? String(main.gstin).toUpperCase() : (list.map(l => String(l.gstin || '').toUpperCase()).find(g => S.GSTIN_RE.test(g)) || null);
        const branchCount = new Map(); list.forEach(l => { const b = upper(l.branch || l.dealingBranch); if (b) branchCount.set(b, (branchCount.get(b) || 0) + l.bills); });
        const branch = [...branchCount.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0])[0] || null;
        // the customer's name without iCAFFE's ledger marks ("XX...XX" closed, "-DR" / "_DR" debtor copy)
        const showName = String(main.name).trim().replace(/^XX+\s*/i, '').replace(/\s*XX+$/i, '').replace(/\s*[-_]\s*DR\.?$/i, '').trim() || String(main.name).trim();
        const row = { ledgerId: main.id, partyId: main.partyId || null, name: showName, status,
          customerType: list.map(l => l.gi.customerType).find(Boolean) || null,
          segment: svcAmt >= 2500000 || svcBills >= 50 ? 'KEY' : svcBills >= 6 ? 'REGULAR' : 'OCCASIONAL', // key: Rs 25 lakh+ billed or 50+ bills in the period
          source: 'Existing customer', kamId: kam ? kam.id : null, branchCode: branch, services: services.length ? services.join(',') : null,
          address: clean(main.address), state: clean(main.state), country: upper(main.country) || 'IN', pinCode: clean(main.pinCode), gstin: gst, pan: main.pan || (gst ? gst.slice(2, 12) : null),
          email: clean(main.email), phone: clean(main.phone), creditTerm: main.creditDays ? 'CREDIT' : null, creditDaysAsked: numOrNull(main.creditDays),
          remarks: `Loaded from the books: ${svcBills} bills since ${since}, last ${list.map(l => l.last).sort().pop()}${list.length > 1 ? `; ${list.length} ledgers` : ''}${kam ? `; KAM from ${kamFrom}` : ''}` };
        res1.made++; if (kam) { res1.withKam++; if (kamFrom.startsWith('debtor')) res1.kamFromGroup++; else res1.kamFromDockets++; }
        if (status === 'BLOCKED') res1.blocked++; if (status === 'ON_HOLD') res1.onHold++; if (list.length > 1) res1.multiLedger++;
        if (sample.length < 25 && (list.length > 1 || kam || sample.length < 10)) sample.push({ name: row.name, ledgers: list.map(l => `${l.name}${l.reimb ? ' [duty/DO]' : ''}`), billed: Math.round(svcAmt), bills: svcBills, segment: row.segment, status, kam: kam ? kam.name : '', branch });
        if (dry) continue;
        const k = Object.keys(row);
        await x(`INSERT INTO SalesCustomers (${k.join(', ')}, createdBy, updatedBy, createdAt, updatedAt) VALUES (${k.map(() => '?').join(', ')}, ?, ?, ?, ?)`, [...k.map(z => row[z]), v.user, v.user, now(), now()], t);
        const id = (await q('SELECT id FROM SalesCustomers WHERE ledgerId = ?', [main.id], t))[0].id;
        for (const l of list) { owner.set(l.id, id); if (l.id !== main.id) await x('INSERT INTO SalesCustomerLedgers (customerId, ledgerId, kind, createdBy, createdAt) VALUES (?,?,?,?,?)', [id, l.id, l.reimb ? 'REIMB' : 'OTHER', v.user, now()], t); }
        if (kam) await x("INSERT INTO SalesAssignments (customerId, salesPersonId, role, fromDate, reason, changedBy, createdAt) VALUES (?,?, 'KAM', ?, ?, ?, ?)", [id, kam.id, today(), 'Loaded from the books (' + kamFrom + ')', v.user, now()], t);
        const ct = list.find(l => clean(l.contactPerson) || clean(l.email)) || main;
        if (clean(ct.contactPerson) || clean(ct.email) || /^\+?[0-9 -]{10,15}$/.test(String(ct.phone || ''))) {
          await x('INSERT INTO SalesContacts (customerId, name, email, mobile, isPrimary, sendQuotes, isActive, remarks, createdAt, updatedAt) VALUES (?,?,?,?,1,1,1,?,?,?)',
            [id, clean(ct.contactPerson) || 'Accounts', S.EMAIL_RE.test(String(ct.email || '').trim()) ? clean(ct.email) : null, /^\+?[0-9 -]{10,15}$/.test(String(ct.phone || '')) ? clean(ct.phone) : null, 'From the accounts ledger', now(), now()], t);
        }
      }
    };
    if (dry) await run(); else await sequelizeTx(run);
    actCache.at = 0;
    const { unmatchedNames, ...counts } = res1;
    res.json({ success: true, dryRun: dry, since, ledgersBilled: L.size, customers: clusters.size, ...counts,
      unmatchedNames: [...unmatchedNames.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, customers: n })), sample });
  } catch (e) { send(res, e); }
});

// the sales person of a bill / docket: the docket's marketing person when it is matched, else the customer's KAM
// the dashboard of the sales person who is logged in (a manager: his team; admin: all, or any person picked)
router.get('/dashboard', async (req, res) => {
  try { await S.ensure(); res.json(await require('../utils/salesDashboard').build(req)); } catch (e) { send(res, e); }
});

router.get('/kam-of-ledger/:id', async (req, res) => {
  try {
    await S.ensure();
    const r = (await q('SELECT c.id, c.kamId, p.name FROM SalesCustomers c LEFT JOIN SalesPersons p ON p.id = c.kamId WHERE c.ledgerId = ?', [req.params.id]))[0];
    res.json({ success: true, data: r || null });
  } catch (e) { send(res, e); }
});

// 14-Nov-2026: enquiries and quotations (Step 2 / 3)
router.use(require('./salesDeals'));

module.exports = router;
