// GET /api/tariff/:ritc → { description, bcdRate, igstRate } from the Tariff masters. Added 28-Oct-2026.
const express = require('express');
const { Op } = require('sequelize');
const TariffHeader = require('../models/TariffHeader');
const TariffComponent = require('../models/TariffComponent');
const TariffDutyComponent = require('../models/TariffDutyComponent');
const router = express.Router();
// 22-Nov-2026: anti-dumping / CVD / export cess / tariff value lists for the Customs Duty Lists screen (before '/:ritc')
router.use('/dutylists', require('./dutyLists'));

// 04-Nov-2026: IGST notification / serial per CTH, read from iCAFFE (notn 009/2025 + 014/2025) - most specific serial
// first. Several serials (often with different rates) apply to one CTH when GST depends on the description or value.
const path = require('path');
const fs = require('fs');
let IGST_OPTIONS = null;
const igstOptionsOf = (cth) => {
    if (IGST_OPTIONS === null) {
        try { IGST_OPTIONS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '_tariff_load', 'igst_options.json'), 'utf8')); }
        catch (e) { IGST_OPTIONS = {}; }
    }
    return (IGST_OPTIONS[cth] || []).map(([notnNo, srNo, rate]) => ({ notnNo, srNo, rate }));
};

// 04-Nov-2026: other government agencies (FSSAI, PQIS, AQCS, CDSCO, WCCB, ...) that clear goods of a CTH - read from
// iCAFFE's Agencywise CTH master. The item screen warns, so the SWIFT / PGA details are not missed on the BE.
let AGENCY_CTH = null;
const agenciesOf = (cth) => {
    if (AGENCY_CTH === null) {
        try { AGENCY_CTH = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '_tariff_load', 'agency_cth.json'), 'utf8')); }
        catch (e) { AGENCY_CTH = {}; }
    }
    return AGENCY_CTH[cth] || [];
};

if (!TariffHeader.associations.components) TariffHeader.hasMany(TariffComponent, { foreignKey: 'tariffHeaderId', as: 'components' });

const compOf = (list, re) => (list || []).find(x => re.test(String(x.dutyCategory || '')));
const rateOf = (list, re) => {
    const c = compOf(list, re);
    return c && c.rate != null && c.rate !== '' ? Number(c.rate) : null;
};

// 30-Oct-2026: only the percentage was served, so a tariff line like "20% or Rs 115 per kg, whichever is higher"
// (most of chapters 50-63, and the tonnage / litre lines) reached the duty estimate as a bare 20%. The component
// rows have carried the specific amount, its UQC and the calculation flag all along - they are passed on now.
//   basis: 'A' ad-valorem only | 'S' specific only | 'H' higher of the two | 'L' lower of the two | 'B' both added
const BASIS = { A: 'A', ADVALOREM: 'A', 'AD-VALOREM': 'A', PERCENT: 'A', P: 'A', S: 'S', SPECIFIC: 'S', Q: 'S',
    H: 'H', HIGHER: 'H', MAX: 'H', 'WHICHEVER IS HIGHER': 'H', L: 'L', LOWER: 'L', MIN: 'L', B: 'B', BOTH: 'B', SUM: 'B' };
const dutyOf = (list, re) => {
    const c = compOf(list, re);
    if (!c) return null;
    const n = (v) => (v != null && v !== '' && !isNaN(Number(v)) ? Number(v) : null);
    const rate = n(c.rate);
    const amount = n(c.amount);
    const flag = String(c.calculationFlag || '').trim().toUpperCase();
    // no flag in the row: a specific amount with no percentage is specific, both present reads as "whichever is higher"
    const basis = BASIS[flag] || (amount != null && rate != null ? 'H' : amount != null ? 'S' : 'A');
    return { rate, amount, uqc: c.uqc || null, flag: flag || null, basis };
};

// 04-Nov-2026: anti-dumping duty rows (notification, serial, CTH serial, country, rate / specific amount) read from
// iCAFFE's Antidumping Master, loaded by load_icaffe_antidumping.js into AddDutyRates.
//   GET /api/tariff/add/:cth?origin=CN -> rows whose CTH (8, 6 or 4 digits) covers the code, newest notification first;
//   matchOrigin marks rows of the given country of origin / export.
// 04-Nov-2026: customs concession / FTA rows for a CTH and a country of origin. Which notification belongs to which
// country comes from iCAFFE's Notification Country master (_tariff_load/notif_country.json); the serial rows are the
// CUSTOM notifications loaded from iCAFFE (DutyNotifDetails).  GET /api/tariff/fta/:cth?origin=JP
let NOTIF_COUNTRY = null;
const notifCountry = () => {
    if (NOTIF_COUNTRY === null) {
        try { NOTIF_COUNTRY = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '_tariff_load', 'notif_country.json'), 'utf8')); }
        catch (e) { NOTIF_COUNTRY = {}; }
    }
    return NOTIF_COUNTRY;
};
// 22-Nov-2026: BCD exemption / concession notifications for a RITC, for the item screen. The tariff rate alone
// over-states the duty where a general exemption applies (8542 39 00: tariff 7.5 %, filed at 0 % under 024/2005 Sl 24 on
// 1,525 of 1,526 items). Two sources, merged by notification + serial:
//   used   - what the saved import items of this RITC carry in the BCD notification boxes (how often, how many
//            importers, last job date) - what the office actually files;
//   master - the CUSTOM notification rows of the Notification master whose tariff head covers the RITC.
// A notification tied to countries (FTA / preferential, _tariff_load/notif_country.json) is marked: it needs a
// certificate of origin. Read only.  GET /api/tariff/exemptions/85423900
router.get('/exemptions/:ritc', async (req, res) => {
    try {
        const ritc = String(req.params.ritc || '').replace(/\D/g, '');
        if (ritc.length !== 8) return res.status(400).json({ success: false, message: '8-digit RITC required' });
        const { sequelize } = require('../db'); const { QueryTypes } = require('sequelize');
        const map = notifCountry();
        const normNo = (v) => { const s = String(v === null || v === undefined ? '' : v).trim().toUpperCase(); const m = /^0*(\d+)\s*\/\s*(\d{4})$/.exec(s); return m ? m[1].padStart(3, '0') + '/' + m[2] : s; };
        const key = (n, s) => normNo(n) + '|' + String(s === null || s === undefined ? '' : s).trim().toUpperCase();
        const out = new Map();
        // what the office files
        let total = 0;
        try {
            const cols = new Set((await sequelize.query('PRAGMA table_info(ImportItems)', { type: QueryTypes.SELECT })).map(c => c.name));
            if (['ritc', 'bcdNotificationNo', 'bcdSrNo', 'bcdRate'].every(c => cols.has(c))) {
                const rows = await sequelize.query(
                    `SELECT TRIM(COALESCE(it.bcdNotificationNo, '')) AS n, TRIM(COALESCE(it.bcdSrNo, '')) AS s, TRIM(COALESCE(it.bcdRate, '')) AS r,
                            COUNT(*) AS c, COUNT(DISTINCT inv.importJobId) AS jobs, COUNT(DISTINCT j.iecCode) AS importers, MAX(j.jobDate) AS last
                       FROM ImportItems it JOIN ImportInvoices inv ON inv.id = it.importInvoiceId JOIN ImportJobs j ON j.id = inv.importJobId
                      WHERE it.ritc = ? GROUP BY 1, 2, 3`, { replacements: [ritc], type: QueryTypes.SELECT });
                for (const r of rows) {
                    total += r.c; if (!r.n) continue;
                    const k = key(r.n, r.s); let g = out.get(k);
                    if (!g) { g = { notifNo: normNo(r.n), serialNo: String(r.s || '').trim(), rate: null, used: 0, jobs: 0, importers: 0, lastUsed: null, inMaster: false }; out.set(k, g); }
                    g.used += r.c; g.jobs += r.jobs; g.importers = Math.max(g.importers, r.importers); if (!g.lastUsed || String(r.last || '') > g.lastUsed) g.lastUsed = r.last || g.lastUsed;
                    if (r.r !== '' && !isNaN(Number(r.r)) && (g._rc || 0) < r.c) { g.rate = Number(r.r); g._rc = r.c; } // the rate most often filed with it
                }
            }
        } catch (e) { /* no item history: the master rows still answer */ }
        // the Notification master
        const mrows = await sequelize.query(
            `SELECT h.notifNo, h.effectiveDate, d.serialNo, d.tariffHead, d.dutyRate, d.itemDescription, d.conditionNo
               FROM DutyNotifDetails d JOIN DutyNotifHeaders h ON h.id = d.headerId
              WHERE upper(h.type) = 'CUSTOM' AND h.isActive = 1 AND length(replace(d.tariffHead, ' ', '')) >= 4 AND ? LIKE replace(d.tariffHead, ' ', '') || '%'`,
            { replacements: [ritc], type: QueryTypes.SELECT }).catch(() => []);
        // a notification with ONE serial for this RITC can be offered as it is; one with many serials (025/1999 has 29 for
        // 8542 39 00 - each for a different end use) is only named, the operator picks the serial from the notification
        const origin = String(req.query.origin || '').trim().toUpperCase();
        const byNotn = new Map();
        for (const r of mrows) { const n = normNo(r.notifNo); if (!byNotn.has(n)) byNotn.set(n, []); byNotn.get(n).push(r); }
        const also = [];
        for (const [n, rows] of byNotn) {
            const m = map[n]; const countries = m ? (m.countries || []) : [];
            for (const r of rows) { // rows the office already files: say they are in the master, take the condition
                const g = out.get(key(r.notifNo, r.serialNo)); if (!g) continue;
                g.inMaster = true; g.conditionNo = r.conditionNo || ''; g.masterRate = r.dutyRate === null || r.dutyRate === undefined || r.dutyRate === '' ? null : Number(r.dutyRate);
                if (g.rate === null && g.masterRate !== null) g.rate = g.masterRate;
            }
            const fresh = rows.filter(r => !out.has(key(r.notifNo, r.serialNo)));
            if (!fresh.length) continue;
            const rated = fresh.filter(r => !(r.dutyRate === null || r.dutyRate === undefined || r.dutyRate === ''));
            const okCountry = !countries.length || (origin && countries.includes(origin));
            if (fresh.length === 1 && rated.length === 1 && okCountry) {
                const r = rated[0]; const what = String(r.itemDescription || '').trim();
                out.set(key(r.notifNo, r.serialNo), { notifNo: n, serialNo: String(r.serialNo || '').trim(), rate: Number(r.dutyRate), used: 0, jobs: 0, importers: 0, lastUsed: null, inMaster: true, masterRate: Number(r.dutyRate), conditionNo: r.conditionNo || '',
                    ...(what && what.toUpperCase() !== 'BCD' ? { description: what.slice(0, 160) } : {}) });
            } else also.push({ notifNo: n, serials: fresh.length, minRate: rated.length ? Math.min(...rated.map(r => Number(r.dutyRate))) : null, countries, scheme: m ? (m.subtype || null) : null });
        }
        const list = [...out.values()].map(g => { const m = map[g.notifNo]; delete g._rc; return { ...g, countries: m ? (m.countries || []) : [], scheme: m ? (m.subtype || null) : null }; })
            .sort((a, b) => b.used - a.used || (a.rate === null ? 1 : 0) - (b.rate === null ? 1 : 0) || (a.rate || 0) - (b.rate || 0)).slice(0, 6);
        also.sort((a, b) => (a.countries.length ? 1 : 0) - (b.countries.length ? 1 : 0) || a.notifNo.localeCompare(b.notifNo));
        // a country's own notification is named only for that country of origin
        res.json({ success: true, ritc, itemsFiled: total, data: list, also: also.filter(a => !a.countries.length || (origin && a.countries.includes(origin))).slice(0, 8) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/fta/:cth', async (req, res) => {
    try {
        const cth = String(req.params.cth || '').replace(/\D/g, '');
        const origin = String(req.query.origin || '').trim().toUpperCase();
        if (cth.length < 4) return res.status(400).json({ success: false, message: 'CTH required' });
        const map = notifCountry();
        const notns = Object.keys(map).filter(n => !origin || (map[n].countries || []).includes(origin));
        if (!notns.length) return res.json({ success: true, data: [] });
        const { sequelize } = require('../db');
        const { QueryTypes } = require('sequelize');
        const rows = await sequelize.query(
            `SELECT h.notifNo, h.effectiveDate, d.serialNo, d.tariffHead, d.dutyRate, d.itemDescription, d.conditionNo
             FROM DutyNotifDetails d JOIN DutyNotifHeaders h ON h.id = d.headerId
             WHERE upper(h.type) = 'CUSTOM' AND h.isActive = 1 AND h.notifNo IN (${notns.map(() => '?').join(',')})
               AND ? LIKE replace(d.tariffHead, ' ', '') || '%'
             ORDER BY h.effectiveDate DESC, h.notifNo`,
            { replacements: [...notns, cth], type: QueryTypes.SELECT });
        res.json({ success: true, data: rows.map(r => ({ ...r, scheme: (map[r.notifNo] || {}).subtype || null, countries: (map[r.notifNo] || {}).countries || [] })) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/add/:cth', async (req, res) => {
    try {
        const cth = String(req.params.cth || '').replace(/\D/g, '');
        if (cth.length < 4) return res.status(400).json({ success: false, message: 'CTH required' });
        const origin = String(req.query.origin || '').trim().toUpperCase();
        const { sequelize } = require('../db');
        const { QueryTypes } = require('sequelize');
        let rows = [];
        try {
            rows = await sequelize.query(
                `SELECT notifNo, notifDate, endDate, serialNo, cthSlNo, cth, specSeries, originCountry, exportCountry, flag, rate, amount, uqc, currency, factor
                 FROM AddDutyRates WHERE isActive = 1 AND ? LIKE cth || '%' ORDER BY notifDate DESC, notifNo DESC, CAST(serialNo AS INTEGER), CAST(cthSlNo AS INTEGER)`,
                { replacements: [cth], type: QueryTypes.SELECT });
        } catch (e) { rows = []; } // table not loaded yet
        const yearsOld = (d) => (d ? (Date.now() - new Date(d).getTime()) / (365.25 * 864e5) : null);
        res.json({ success: true, data: rows.map(r => ({
            ...r,
            matchOrigin: !!origin && (r.originCountry === origin || r.exportCountry === origin),
            // anti-dumping duty normally runs 5 years unless extended - an older notification may have lapsed
            maybeExpired: r.endDate ? new Date(r.endDate) < new Date() : (yearsOld(r.notifDate) || 0) > 5
        })) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/:ritc', async (req, res) => {
    try {
        const ritc = String(req.params.ritc || '').replace(/\D/g, '');
        if (ritc.length < 4) return res.status(400).json({ success: false, message: 'Valid RITC / HS code required' });
        // 30-Oct-2026: an exact 8-digit line, else the nearest line of the same 6-digit heading - reported as exact:false
        // so the screens show it as "nearest line, check" and never fill rates from it as if it were the item's own
        const exactHeader = await TariffHeader.findOne({ where: { hsnCode: ritc }, include: [{ model: TariffComponent, as: 'components' }] });
        const header = exactHeader || await TariffHeader.findOne({ where: { hsnCode: { [Op.like]: ritc.slice(0, 6) + '%' } }, order: [['hsnCode', 'ASC']], include: [{ model: TariffComponent, as: 'components' }] });
        let comps = header ? header.components : [];
        if (!comps || !comps.length) comps = await TariffDutyComponent.findAll({ where: { hsnCode: header ? header.hsnCode : ritc } });
        if (!header && !comps.length) return res.status(404).json({ success: false, message: 'RITC not found in Tariff master' });
        const matchedCode = header ? header.hsnCode : ritc;
        const igstOptions = String(matchedCode) === ritc ? igstOptionsOf(matchedCode) : [];
        res.json({
            success: true,
            data: {
                ritc: matchedCode,
                requested: ritc,
                matchedCode,
                exact: String(matchedCode) === ritc,
                description: header ? header.description : null,
                bcdRate: rateOf(comps, /BCD|BASIC/i),
                igstRate: rateOf(comps, /IGST/i),
                // the full picture per duty, so the estimate can apply a per-unit or "whichever is higher" rate
                bcd: dutyOf(comps, /BCD|BASIC/i),
                igst: dutyOf(comps, /IGST/i),
                sws: dutyOf(comps, /SWS|SOCIAL/i),
                aidc: dutyOf(comps, /AIDC|INFRA/i),
                healthCess: dutyOf(comps, /HEALTH/i),
                // IGST notification + serial of the loaded rate, and every serial that applies to this CTH
                igstNotnNo: igstOptions[0] ? igstOptions[0].notnNo : null,
                igstSrNo: igstOptions[0] ? igstOptions[0].srNo : null,
                igstOptions,
                igstRateVaries: new Set(igstOptions.map(o => o.rate)).size > 1,
                pgaAgencies: String(matchedCode) === ritc ? agenciesOf(matchedCode) : [],
                uqc: header ? header.uqc : null,
                components: comps
            }
        });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
