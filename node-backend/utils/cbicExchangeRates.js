// CBIC customs exchange rates from ICEGATE 2.0 (ERAM), 29-Oct-2026.
// Since 04-Jul-2024 CBIC publishes the customs exchange rates (22 currencies, import and export) on ICEGATE on the
// evening of the 1st and 3rd Thursday, effective from the next midnight. ICEGATE 2.0 serves them from two public JSON
// endpoints (no login, no captcha) - checked live on 29-Oct-2026 from the user's machine:
//   POST https://foservices.icegate.gov.in/cbu/icegateapi/getnotdetails      {}                -> [{ notificationNumber: "29/2026", notPublishDate: "15-10-2026" }, ...]
//   POST https://foservices.icegate.gov.in/cbu/icegateapi/igexratepublishnot {"notNum":"29/2026"} -> { notificationNumber, notPublishDate: "16-10-2026" (the EFFECTIVE date),
//        status: 1, error: null, currencyDetail: [{ currencyCode: "EUR", currencyDesc: "EURO", units: "1.0", cbicImport: 108.55, cbicExport: 104.85 }, ...] }
// Rates are rupees per `units` of the currency (JPY / KRW per 100). Notification 29/2026 gave EUR 108.55 effective
// 16-10-2026 - the same rate and date as in a BE filed by another ERP, so these are the rates to put in the BE / SB.
//
// 18-Nov-2026: a notification is published the evening BEFORE it comes into force, and the sync took the newest one
// published on or before "today" (a UTC day) - CBIC 32/2026 (in force 19-Nov) went into the master at 18:27 on 18-Nov,
// so BEs of 18-Nov got tomorrow's rate. Now every notification read from ICEGATE is kept with its effective date in
// CurrencyRateHistory; the master gets only the one IN FORCE TODAY (India), switched by a 10-minute check from the
// history (no network) - so the new rates come in at midnight. A BE takes the rate in force on its job date
// (GET /api/masters/currencies/in-force?date=, used by the Invoices tab and the BE builder).
const Currency = require('../models/Currency');
const AppSetting = require('../models/AppSetting');
const CurrencyRateHistory = require('../models/CurrencyRateHistory');
const { Op } = require('sequelize');

const BASE = process.env.ICEGATE_FO_URL || 'https://foservices.icegate.gov.in';
const HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*', 'Accept-Language': 'en-US', channel: 'browser', Origin: BASE, Referer: BASE + '/' };
const TIMEOUT = 20000;

async function post(path, body) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT);
    let res;
    try { res = await fetch(`${BASE}/${path}`, { method: 'POST', headers: HEADERS, body: JSON.stringify(body || {}), signal: ctl.signal }); }
    catch (e) { throw new Error(e.name === 'AbortError' ? `ICEGATE did not answer within ${TIMEOUT / 1000} s` : `ICEGATE not reachable: ${e.message}`); }
    finally { clearTimeout(t); }
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch (e) { data = null; }
    if (!res.ok) throw new Error(`ICEGATE answered HTTP ${res.status}${data && data.message ? ': ' + data.message : ''}`);
    if (data === null) throw new Error('ICEGATE answered something that is not JSON (' + text.slice(0, 80) + ')');
    return data;
}
// "16-10-2026" -> "2026-10-16"
const dmyToIso = (s) => { const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(String(s || '').trim()); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };

// [{ number: "29/2026", published: "2026-10-15" }, ...] newest first
async function listNotifications() {
    const list = await post('cbu/icegateapi/getnotdetails', {});
    return (Array.isArray(list) ? list : []).map(n => ({ number: String(n.notificationNumber || ''), published: dmyToIso(n.notPublishDate) }))
        .filter(n => n.number && n.published).sort((a, b) => b.published.localeCompare(a.published));
}
// rates of one notification: { number, effective: "2026-10-16", rates: [{ code, name, units, importRate, exportRate }] }
async function getNotification(number) {
    const d = await post('cbu/icegateapi/igexratepublishnot', { notNum: number });
    if (!d || !Array.isArray(d.currencyDetail) || !d.currencyDetail.length) throw new Error(`ICEGATE has no rates for notification ${number}${d && d.error ? ': ' + d.error : ''}`);
    return {
        number: String(d.notificationNumber || number), effective: dmyToIso(d.notPublishDate),
        rates: d.currencyDetail.map(c => ({ code: String(c.currencyCode || '').toUpperCase(), name: String(c.currencyDesc || '').trim(), units: Number(c.units) || 1, importRate: Number(c.cbicImport), exportRate: Number(c.cbicExport) }))
            .filter(r => /^[A-Z]{3}$/.test(r.code) && r.importRate > 0 && r.exportRate > 0),
    };
}
// today in India, 'YYYY-MM-DD', whatever the zone of the machine (toISOString() is the UTC day: yesterday before 5:30 am)
const todayIST = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const labelOf = (number) => `CBIC ${number}`;

// the newest notification PUBLISHED on or before a date (ICEGATE's list has only the publish date; the effective date,
// normally the next day, comes with the notification itself)
async function notificationFor(isoDate) {
    const on = isoDate || todayIST();
    const list = await listNotifications();
    const hit = list.find(n => n.published <= on);
    if (!hit) throw new Error(`No CBIC exchange-rate notification on or before ${on}`);
    return hit;
}

// write a notification's rates into the Currency master. Rates per ONE unit (the screens and the BE builder work per
// unit; JPY / KRW are per 100 on ICEGATE). Returns what was done.
async function applyToMaster(notn, { createMissing = true, user = 'System' } = {}) {
    const label = `CBIC ${notn.number}`;
    const eff = notn.effective ? new Date(notn.effective + 'T00:00:00') : null;
    let updated = 0, created = 0, unchanged = 0;
    for (const r of notn.rates) {
        const imp = +(r.importRate / r.units).toFixed(6), exp = +(r.exportRate / r.units).toFixed(6);
        const row = await Currency.findOne({ where: { currencyCode: r.code } });
        if (row) {
            const same = Math.abs((parseFloat(row.importRate) || 0) - imp) < 1e-9 && Math.abs((parseFloat(row.exportRate) || 0) - exp) < 1e-9 && String(row.notificationNo || '') === label;
            if (same) { unchanged++; continue; }
            await row.update({ importRate: imp, exportRate: exp, standard: true, effectiveDate: eff, notificationNo: label, ...(row.currencyName ? {} : { currencyName: r.name }) });
            updated++;
        } else if (createMissing) {
            await Currency.create({ currencyCode: r.code, currencyName: r.name || r.code, importRate: imp, exportRate: exp, standard: true, effectiveDate: eff, notificationNo: label });
            created++;
        }
    }
    const [row] = await AppSetting.findOrCreate({ where: { key: 'cbic_exrate_notn' }, defaults: { key: 'cbic_exrate_notn', value: '', group: 'icegate', label: 'CBIC exchange-rate notification in the Currency master' } });
    await row.update({ value: JSON.stringify({ number: notn.number, effective: notn.effective, syncedAt: new Date().toISOString(), by: user, currencies: notn.rates.length }) });
    return { notification: notn.number, effective: notn.effective, currencies: notn.rates.length, updated, created, unchanged };
}

// ---- history -------------------------------------------------------------------------------------------------
let histReady = null;
const ensureHist = () => (histReady = histReady || CurrencyRateHistory.sync().catch((e) => { histReady = null; throw e; }));

// keep one notification's rates (per 1 unit) in the history; returns { added, changed }
async function storeNotification(notn, source = 'ICEGATE') {
    await ensureHist();
    if (!notn || !notn.number || !/^\d{4}-\d{2}-\d{2}$/.test(String(notn.effective || ''))) return { added: 0, changed: 0 };
    const lab = labelOf(notn.number);
    let added = 0, changed = 0;
    for (const r of notn.rates || []) {
        const units = Number(r.units) || 1;
        const imp = +(r.importRate / units).toFixed(6), exp = +(r.exportRate / units).toFixed(6);
        const row = await CurrencyRateHistory.findOne({ where: { currencyCode: r.code, notificationNo: lab } });
        if (!row) {
            await CurrencyRateHistory.create({ currencyCode: r.code, currencyName: r.name || r.code, units, importRate: imp, exportRate: exp, effectiveDate: notn.effective, notificationNo: lab, source });
            added++;
        } else if (Math.abs(Number(row.importRate) - imp) > 1e-9 || Math.abs(Number(row.exportRate) - exp) > 1e-9 || row.effectiveDate !== notn.effective) {
            await row.update({ importRate: imp, exportRate: exp, effectiveDate: notn.effective, units });
            changed++;
        }
    }
    return { added, changed };
}

// read from ICEGATE the newest `latest` notifications that are not in the history yet
async function refreshHistory({ latest = 8 } = {}) {
    await ensureHist();
    const list = await listNotifications();
    const have = new Set((await CurrencyRateHistory.findAll({ attributes: ['notificationNo'], group: ['notificationNo'], raw: true })).map(r => r.notificationNo));
    const fetched = [];
    for (const n of list.slice(0, latest)) {
        if (have.has(labelOf(n.number))) continue;
        const notn = await getNotification(n.number);
        const r = await storeNotification(notn);
        if (r.added || r.changed) fetched.push(`${notn.number} (effective ${notn.effective})`);
    }
    return { fetched, listed: list.length };
}

// the notifications in the history, newest effective date first: [{ label, number, effective, count }]
async function historyNotifications() {
    await ensureHist();
    const rows = await CurrencyRateHistory.findAll({ attributes: ['notificationNo', 'effectiveDate'], raw: true });
    const m = new Map();
    for (const r of rows) { const k = r.notificationNo + '|' + r.effectiveDate; m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].map(([k, count]) => { const [label, effective] = k.split('|'); return { label, number: label.replace(/^CBIC\s*/, ''), effective, count }; })
        .sort((a, b) => b.effective.localeCompare(a.effective) || b.label.localeCompare(a.label, undefined, { numeric: true }));
}
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
// the notification in force on a date (default today, India) / the next one after it
async function notificationInForce(date) { const on = isDay(date) ? date : todayIST(); return (await historyNotifications()).find(n => n.effective <= on) || null; }
async function nextNotification(date) { const on = isDay(date) ? date : todayIST(); const later = (await historyNotifications()).filter(n => n.effective > on); return later.length ? later[later.length - 1] : null; }

// rates in force on a date: per currency the history row with the newest effective date on or before it
async function ratesInForce(date) {
    await ensureHist();
    const on = isDay(date) ? date : todayIST();
    const rows = await CurrencyRateHistory.findAll({ where: { effectiveDate: { [Op.lte]: on } }, order: [['effectiveDate', 'DESC'], ['id', 'DESC']], raw: true });
    const by = new Map();
    for (const r of rows) if (!by.has(r.currencyCode)) by.set(r.currencyCode, r);
    return { date: on, rates: [...by.values()] };
}
// all history rows of some currencies, newest effective date first: Map code -> rows
async function historyOf(codes) {
    await ensureHist();
    const list = [...new Set((codes || []).map(c => String(c || '').trim().toUpperCase()).filter(Boolean))];
    if (!list.length) return new Map();
    const rows = await CurrencyRateHistory.findAll({ where: { currencyCode: { [Op.in]: list } }, order: [['effectiveDate', 'DESC'], ['id', 'DESC']], raw: true });
    const by = new Map();
    for (const r of rows) { if (!by.has(r.currencyCode)) by.set(r.currencyCode, []); by.get(r.currencyCode).push(r); }
    return by;
}

// put the notification in force today into the master, when it is not the one there already (force: always).
// No network: works from the history, so it can run often and switch the rates at midnight.
async function promote({ force = false, user = 'Auto' } = {}) {
    const now = await notificationInForce(todayIST());
    if (!now) return { skipped: true, message: 'No CBIC rates in the history yet' };
    const last = await lastSync();
    if (!force && last && last.number === now.number) return { skipped: true, notification: now.number, effective: now.effective, message: `Currency master already has CBIC notification ${now.number}` };
    const rows = await CurrencyRateHistory.findAll({ where: { notificationNo: now.label }, raw: true });
    const notn = { number: now.number, effective: now.effective, rates: rows.map(r => ({ code: r.currencyCode, name: r.currencyName, units: 1, importRate: Number(r.importRate), exportRate: Number(r.exportRate) })) };
    return applyToMaster(notn, { user });
}

async function lastSync() {
    const row = await AppSetting.findOne({ where: { key: 'cbic_exrate_notn' } }).catch(() => null);
    if (!row || !row.value) return null;
    try { return JSON.parse(row.value); } catch (e) { return null; }
}
async function autoEnabled() {
    const row = await AppSetting.findOne({ where: { key: 'cbic_exrate_auto' } }).catch(() => null);
    return !row || String(row.value) !== '0'; // on unless switched off
}

// read the new notifications from ICEGATE into the history, then put the one in force today into the master;
// `force` re-applies it even when it is the one already in the master. ICEGATE not reachable: the history is used.
async function syncNow({ force = false, user = 'System' } = {}) {
    let refreshed = null, refreshError = null;
    try { refreshed = await refreshHistory(); } catch (e) { refreshError = e.message; }
    if (!(await historyNotifications()).length) throw new Error(refreshError || 'No CBIC exchange-rate notification found');
    const r = await promote({ force, user });
    const next = await nextNotification();
    return { ...r, refreshed, refreshError, next };
}

// ICEGATE every 6 hours (rates change on the 1st / 3rd Thursday evening), first 1 minute after start; the switch to a
// notification that has come into force is checked every 10 minutes from the history (so it happens at midnight)
let timer = null, promoteTimer = null;
function startAutoSync(everyMs = 6 * 60 * 60 * 1000, promoteMs = 10 * 60 * 1000) {
    const run = async () => {
        try {
            if (!(await autoEnabled())) return;
            const r = await syncNow({ user: 'Auto' });
            if (r.refreshed && r.refreshed.fetched && r.refreshed.fetched.length) console.log(`[CBIC rates] history: ${r.refreshed.fetched.join(', ')}`);
            if (!r.skipped) console.log(`[CBIC rates] Currency master updated to notification ${r.notification} (effective ${r.effective}): ${r.updated} updated, ${r.created} new`);
            if (r.refreshError) console.warn('[CBIC rates] ICEGATE:', r.refreshError, '- the history was used');
        } catch (e) { console.warn('[CBIC rates] auto-sync:', e.message); }
    };
    const tick = async () => {
        try {
            if (!(await autoEnabled())) return;
            const r = await promote({ user: 'Auto' });
            if (!r.skipped) console.log(`[CBIC rates] notification ${r.notification} came into force (${r.effective}): Currency master updated, ${r.updated} updated, ${r.created} new`);
        } catch (e) { console.warn('[CBIC rates] promote:', e.message); }
    };
    setTimeout(run, 60 * 1000);
    timer = setInterval(run, everyMs);
    promoteTimer = setInterval(tick, promoteMs);
    if (promoteTimer.unref) promoteTimer.unref();
    return timer;
}

module.exports = { listNotifications, getNotification, notificationFor, applyToMaster, syncNow, lastSync, autoEnabled, startAutoSync, BASE,
    todayIST, storeNotification, refreshHistory, historyNotifications, notificationInForce, nextNotification, ratesInForce, historyOf, promote };
