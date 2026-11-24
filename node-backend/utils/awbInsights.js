// Air Export dashboard insights (29-Oct-2026) - GET /api/awb/insights
// Everything is read from data the system already keeps: AWB / MAWB / HAWB records, tracking rows (FSU milestones),
// rate lines, AWB stock, AWB logs and the SFTP poller state. Only live (not VOID) records are counted.
const { Op } = require('sequelize');

const HOUR = 3600 * 1000;
const RCS_TO_DEP_HOURS = 24;   // received by airline but not departed after this -> stuck
const DEP_TO_ARR_HOURS = 48;   // departed but no arrival / receipt at destination after this -> stuck
const LOW_STOCK = 10;          // fewer available AWB numbers than this for an airline -> low stock
const RESERVE_HOURS = 4;       // stock reservation that is not saved on an AWB is released after this (routes/stock.js)

const bare = (n) => String(n || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const dashed = (n) => { const b = bare(n); return /^\d{11}$/.test(b) ? `${b.slice(0, 3)}-${b.slice(3)}` : String(n || ''); };
const num = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(x) ? x : 0; };
const when = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d; };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
// flight date as the screens save it: 2026-10-30T10:30 / 2026-10-30; also 30-10-2026 / 30/10/2026
function flightDay(v) {
    const s = String(v || '').trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return null;
}
const round = (x, d = 1) => +(+x).toFixed(d);

async function buildInsights(models, opts = {}) {
    const { Airwaybill, HouseAWB, AwbTracking, AwbRateLine, AwbLog, AwbStock } = models;
    const now = opts.now ? new Date(opts.now) : new Date();
    const live = { [Op.or]: [{ [Op.ne]: 'VOID' }, null] };
    // 10-Nov-2026: only the branch picked in the top bar (opts.scope from utils/awbBranch). Not the year: a shipment still
    // pending from last year must still be shown.
    const scope = opts.scope && Reflect.ownKeys(opts.scope).length ? opts.scope : null;
    const sw = (w) => (scope ? { [Op.and]: [w, scope] } : w);

    const awbs = await Airwaybill.findAll({ where: sw({ status: live }), attributes: ['id', 'awbNumber', 'type', 'status', 'shipperName', 'consigneeName', 'origin', 'destination', 'flightNumber1', 'flightDate1', 'totalPieces', 'grossWeight', 'currencyCode', 'totalChargePP', 'totalChargeCC', 'createdAt'] });
    const houses = await HouseAWB.findAll({ where: sw({ status: live }), attributes: ['id', 'awbNumber', 'masterAwbNumber', 'status', 'shipperName', 'consigneeName', 'origin', 'destination', 'totalPieces', 'grossWeight', 'createdAt'] });
    const tracks = await AwbTracking.findAll();
    const tKey = (awb, hawb) => bare(awb) + '|' + bare(hawb);
    const trackOf = {};
    tracks.forEach((t) => { trackOf[tKey(t.awbNumber, t.hawbNumber)] = t; });
    const awbTrack = (a) => trackOf[tKey(a.awbNumber, '')] || {};
    const sent = (a, tr) => !!(tr.submittedToAirline || a.status === 'TRANSMITTED' || tr.fma || tr.rcs || tr.dep);
    const rejected = (tr) => !!(tr.fna && !(tr.fma && String(tr.fma) > String(tr.fna)) && !tr.rcs && !tr.dep);
    const liveAwbNos = new Set(awbs.map((a) => bare(a.awbNumber)));
    const housesOf = {};
    houses.forEach((h) => { const k = bare(h.masterAwbNumber); if (k) (housesOf[k] = housesOf[k] || []).push(h); });
    const brief = (a, extra = {}) => ({ id: a.id, type: a.type || 'MAWB', awbNumber: a.awbNumber, shipperName: a.shipperName || '', origin: a.origin || '', destination: a.destination || '', ...extra });

    // 1. flights today / tomorrow (and missed in the last 7 days) whose FWB has not gone, or was rejected
    const today = ymd(now), tomorrow = ymd(new Date(now.getTime() + 24 * HOUR)), weekAgo = ymd(new Date(now.getTime() - 7 * 24 * HOUR));
    const dueFlights = [];
    for (const a of awbs) {
        const day = flightDay(a.flightDate1); if (!day) continue;
        const tr = awbTrack(a);
        const isRej = rejected(tr);
        if (sent(a, tr) && !isRej) continue;
        let when_ = null;
        if (day === today) when_ = 'TODAY'; else if (day === tomorrow) when_ = 'TOMORROW'; else if (day < today && day >= weekAgo) when_ = 'MISSED';
        if (!when_) continue;
        dueFlights.push(brief(a, { flight: a.flightNumber1 || '', flightDate: a.flightDate1, due: when_, problem: isRej ? 'REJECTED (FNA)' : 'NOT SENT' }));
    }
    const dueOrder = { MISSED: 0, TODAY: 1, TOMORROW: 2 };
    dueFlights.sort((x, y) => dueOrder[x.due] - dueOrder[y.due] || String(x.flightDate).localeCompare(String(y.flightDate)));

    // 2. stuck shipments (airline / own AWBs and MAWBs)
    const stuck = [];
    for (const a of awbs) {
        const tr = awbTrack(a);
        const rcs = when(tr.rcs || tr.foh), dep = when(tr.dep);
        if (tr.dlv) continue;
        if (rcs && !dep && now - rcs > RCS_TO_DEP_HOURS * HOUR) stuck.push(brief(a, { problem: 'RCS, NOT DEPARTED', since: rcs.toISOString(), hours: Math.floor((now - rcs) / HOUR) }));
        else if (dep && !tr.arr && !tr.rcf && !tr.nfd && now - dep > DEP_TO_ARR_HOURS * HOUR) stuck.push(brief(a, { problem: 'DEPARTED, NO ARRIVAL', since: dep.toISOString(), hours: Math.floor((now - dep) / HOUR) }));
    }
    stuck.sort((x, y) => y.hours - x.hours);

    // 3. MAWB sent but some of its houses' FHL not sent
    const fhlPending = [];
    for (const a of awbs) {
        if ((a.type || 'MAWB') !== 'MAWB') continue;
        if (!sent(a, awbTrack(a))) continue;
        const hs = housesOf[bare(a.awbNumber)] || [];
        const notSent = hs.filter((h) => { const t = trackOf[tKey(a.awbNumber, h.awbNumber)]; return !(t && t.submittedToAirline) && h.status !== 'TRANSMITTED'; });
        if (notSent.length) fhlPending.push(brief(a, { houses: hs.length, notSent: notSent.length, hawbs: notSent.slice(0, 10).map((h) => h.awbNumber) }));
    }

    // 4. houses with no (live) master, and masters with no houses
    const orphanHawbs = houses.filter((h) => !h.masterAwbNumber || !liveAwbNos.has(bare(h.masterAwbNumber)))
        .map((h) => ({ id: h.id, type: 'HAWB', hawbNumber: h.awbNumber, masterAwbNumber: h.masterAwbNumber || '', shipperName: h.shipperName || '', destination: h.destination || '', problem: h.masterAwbNumber ? 'MAWB NOT SAVED / VOID' : 'NO MAWB' }));
    const emptyMawbs = awbs.filter((a) => (a.type || 'MAWB') === 'MAWB' && !(housesOf[bare(a.awbNumber)] || []).length)
        .map((a) => brief(a, { createdAt: a.createdAt }));

    // 5. AWB stock per airline
    const stockRows = AwbStock ? await AwbStock.findAll({ attributes: ['airlinePrefix', 'fullAwbNumber', 'status', 'updatedAt'] }) : [];
    const stockMap = {};
    for (const s of stockRows) {
        const p = s.airlinePrefix || String(s.fullAwbNumber || '').slice(0, 3);
        const x = stockMap[p] = stockMap[p] || { prefix: p, available: 0, reserved: 0, expiredReservations: 0, used: 0, availableButUsed: 0 };
        if (s.status === 'AVAILABLE') { if (liveAwbNos.has(bare(s.fullAwbNumber))) x.availableButUsed += 1; else x.available += 1; }
        else if (s.status === 'ALLOCATED') { x.reserved += 1; if (now - new Date(s.updatedAt) > RESERVE_HOURS * HOUR) x.expiredReservations += 1; }
        else if (s.status === 'USED') x.used += 1;
    }
    const stock = Object.values(stockMap).map((x) => ({ ...x, low: x.available < LOW_STOCK })).sort((a, b) => a.available - b.available);

    // 6-8. business numbers (airline AWBs = direct AWB + MAWB; customers = direct AWB shippers + house shippers)
    const thisM = monthKey(now), lastM = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const ids = awbs.map((a) => a.id);
    const lines = ids.length ? await AwbRateLine.findAll({ where: { awbId: ids, awbType: ['AWB', 'MAWB'] }, attributes: ['awbId', 'chargeableWeight', 'grossWeight'] }) : [];
    const cwOf = {};
    lines.forEach((l) => { cwOf[l.awbId] = (cwOf[l.awbId] || 0) + (num(l.chargeableWeight) || num(l.grossWeight)); });
    const monthOf = (r) => monthKey(new Date(r.createdAt));
    const sumMonth = (m) => { const rs = awbs.filter((a) => monthOf(a) === m); return { awbs: rs.length, grossWeight: round(rs.reduce((s, a) => s + num(a.grossWeight), 0)), chargeableWeight: round(rs.reduce((s, a) => s + (cwOf[a.id] || num(a.grossWeight)), 0)), pieces: rs.reduce((s, a) => s + (parseInt(a.totalPieces, 10) || 0), 0) }; };
    const tonnage = { thisMonth: { month: thisM, ...sumMonth(thisM) }, lastMonth: { month: lastM, ...sumMonth(lastM) } };
    const byAirline = {};
    awbs.filter((a) => monthOf(a) === thisM).forEach((a) => { const p = bare(a.awbNumber).slice(0, 3); const x = byAirline[p] = byAirline[p] || { prefix: p, awbs: 0, grossWeight: 0, chargeableWeight: 0 }; x.awbs += 1; x.grossWeight += num(a.grossWeight); x.chargeableWeight += cwOf[a.id] || num(a.grossWeight); });
    tonnage.byAirline = Object.values(byAirline).map((x) => ({ ...x, grossWeight: round(x.grossWeight), chargeableWeight: round(x.chargeableWeight) })).sort((a, b) => b.chargeableWeight - a.chargeableWeight);

    const top = (rows, keyFn, n = 5) => { const m = {}; rows.forEach((r) => { const k = keyFn(r); if (!k) return; const x = m[k] = m[k] || { name: k, shipments: 0, grossWeight: 0 }; x.shipments += 1; x.grossWeight += num(r.grossWeight); }); return Object.values(m).map((x) => ({ ...x, grossWeight: round(x.grossWeight) })).sort((a, b) => b.shipments - a.shipments || b.grossWeight - a.grossWeight).slice(0, n); };
    const monthAwbs = awbs.filter((a) => monthOf(a) === thisM);
    const customerRows = [...monthAwbs.filter((a) => (a.type || 'MAWB') === 'AWB'), ...houses.filter((h) => monthOf(h) === thisM)];
    const topDestinations = top(monthAwbs, (a) => String(a.destination || '').toUpperCase().trim());
    const topCustomers = top(customerRows, (r) => String(r.shipperName || '').toUpperCase().trim());

    const months = []; for (let i = 5; i >= 0; i--) months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    const fv = {};
    awbs.forEach((a) => { const m = monthOf(a); if (!months.includes(m)) return; const c = String(a.currencyCode || 'INR').toUpperCase(); const x = fv[c] = fv[c] || Object.fromEntries(months.map((k) => [k, { pp: 0, cc: 0 }])); x[m].pp += num(a.totalChargePP); x[m].cc += num(a.totalChargeCC); });
    const freightValue = { months, byCurrency: Object.entries(fv).map(([currency, per]) => ({ currency, months: months.map((m) => ({ month: m, prepaid: round(per[m].pp, 2), collect: round(per[m].cc, 2), total: round(per[m].pp + per[m].cc, 2) })) })) };

    // 9. recent activity
    const inScope = (n) => !scope || ownNos.has(bare(n));
    const ownNos = new Set([...awbs.map((a) => bare(a.awbNumber)), ...houses.map((h) => bare(h.awbNumber)), ...houses.map((h) => bare(h.masterAwbNumber))]);
    const activity = AwbLog ? (await AwbLog.findAll({ order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: scope ? 400 : 15 })).filter((l) => inScope(l.awbNumber)).slice(0, 15).map((l) => ({ awbNumber: l.awbNumber, action: l.action, user: l.user || '', details: l.details || '', at: l.createdAt })) : [];

    // 10. airline connection (SFTP poller state + last FSU / last FWB sent)
    let poller = {};
    try { poller = require('./FsuService').getSftpStatus(); } catch (e) { poller = {}; }
    let configured = null;
    try { configured = (await require('./SftpService').getSftpConfigStatus()).configured; } catch (e) { configured = null; }
    const ms = ['fna', 'fma', 'foh', 'rcs', 'dep', 'arr', 'tfd', 'rcf', 'nfd', 'dlv'];
    let lastFsuAt = null;
    tracks.forEach((t) => ms.forEach((k) => { const d = when(t[k]); if (d && (!lastFsuAt || d > lastFsuAt)) lastFsuAt = d; }));
    const lastSent = AwbLog ? ((await AwbLog.findAll({ where: { action: { [Op.in]: ['FWB_TRANSMITTED', 'FHL_TRANSMITTED'] } }, order: [['createdAt', 'DESC']], limit: scope ? 200 : 1 })).find((l) => inScope(l.awbNumber)) || null) : null;
    const connection = {
        configured,
        connected: !!poller.connected,
        lastConnectedAt: poller.lastConnectedAt || null,
        lastCheckedAt: poller.lastCheckedAt || null,
        lastError: poller.lastError || null,
        env: poller.env || null,
        lastFsuAt: lastFsuAt ? lastFsuAt.toISOString() : null,
        lastSentAt: lastSent ? lastSent.createdAt : null,
        lastSentAwb: lastSent ? lastSent.awbNumber : null,
    };

    return {
        generatedAt: now.toISOString(),
        rules: { rcsToDepHours: RCS_TO_DEP_HOURS, depToArrHours: DEP_TO_ARR_HOURS, lowStock: LOW_STOCK },
        dueFlights, stuck, fhlPending,
        orphanHawbs: orphanHawbs.slice(0, 20), orphanCount: orphanHawbs.length,
        emptyMawbs: emptyMawbs.slice(0, 20), emptyMawbCount: emptyMawbs.length,
        stock, tonnage, topDestinations, topCustomers, freightValue, activity, connection,
    };
}

module.exports = { buildInsights, flightDay, dashed };
