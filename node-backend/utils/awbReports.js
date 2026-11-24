// Air Export reports (29-Oct-2026): Tonnage report and CSR statement (Cargo Sales Report, IATA CASS style).
// Only live (not VOID) records. Airline documents = direct AWB + MAWB; houses are used only for "by customer".
const { Op } = require('sequelize');

const num = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(x) ? x : 0; };
const r2 = (x) => Math.round(x * 100) / 100;
const r1 = (x) => Math.round(x * 10) / 10;
const bare = (n) => String(n || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const pad = (x) => String(x).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MNAME = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

// a date as the screens save it -> 'YYYY-MM-DD' (2026-10-30T10:00 / 2026-10-30 / 30-10-2026 / 30/10/2026 / 30OCT26 / 30-Oct-2026)
function dayOf(v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : ymd(v);
    const s = String(v).trim().toUpperCase();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{2})[-/.](\d{2})[-/.](\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = s.match(/^(\d{1,2})[-\s]?([A-Z]{3})[-\s]?(\d{2,4})$/); if (m && MON[m[2]]) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(MON[m[2]])}-${pad(m[1])}`;
    const d = new Date(v); return isNaN(d) ? null : ymd(d);
}
// IATA agent (forwarder) on the AWB: code without spaces / dashes / slashes, else the name (29-Oct-2026)
const agentKey = (a) => bare(a.agentCode) || String(a.agentName || '').trim().toUpperCase() || '-';
const agentLabel = (a) => { const n = String(a.agentName || '').trim(), c = String(a.agentCode || '').trim(); return n || c ? `${n || '(no name)'}${c ? ` (${c})` : ''}` : '(no agent on AWB)'; };
// agent filter: IATA code (any format) or part of the name
const agentMatch = (a, want) => { if (!want) return true; const w = String(want).trim(); const b = bare(w); return (b.length >= 4 && bare(a.agentCode).includes(b)) || String(a.agentName || '').toUpperCase().includes(w.toUpperCase()); };
// AWB date: execution date on the AWB, else the first flight date, else the day it was saved
const awbDay = (a) => dayOf(a.executedDate) || dayOf(a.flightDate1) || dayOf(a.createdAt);

// CASS billing periods: 1-15 and 16-end of month. "2026-10-1" / "2026-10-2"
function periodRange(period) {
    const m = String(period || '').match(/^(\d{4})-(\d{2})-([12])$/);
    if (!m) return null;
    const y = +m[1], mo = +m[2], half = +m[3];
    const last = new Date(y, mo, 0).getDate();
    return { from: `${m[1]}-${m[2]}-${half === 1 ? '01' : '16'}`, to: `${m[1]}-${m[2]}-${half === 1 ? '15' : pad(last)}`, label: `${half === 1 ? '01' : '16'}-${half === 1 ? '15' : last} ${MNAME[mo - 1]} ${y}`, period: `${m[1]}-${m[2]}-${half}` };
}
function recentPeriods(n = 24, now = new Date()) {
    const out = [];
    let y = now.getFullYear(), mo = now.getMonth() + 1, half = now.getDate() <= 15 ? 1 : 2;
    for (let i = 0; i < n; i++) {
        out.push(periodRange(`${y}-${pad(mo)}-${half}`));
        if (half === 2) half = 1; else { half = 2; mo -= 1; if (mo === 0) { mo = 12; y -= 1; } }
    }
    return out;
}

// 10-Nov-2026: only the branch picked in the top bar (models.scopeWhere from utils/awbBranch; the report's own dates pick the period)
const scoped = (models, w) => (models && models.scopeWhere && Reflect.ownKeys(models.scopeWhere).length ? { [Op.and]: [w, models.scopeWhere] } : w);

async function loadLines(models, ids, types) {
    if (!ids.length) return {};
    const out = {};
    for (const l of await models.AwbRateLine.findAll({ where: { awbId: ids, awbType: types }, attributes: ['awbId', 'pieces', 'grossWeight', 'chargeableWeight', 'rateCharge', 'total', 'rateClass'] })) {
        (out[l.awbId] = out[l.awbId] || []).push(l);
    }
    return out;
}
const chgOf = (rec, lines) => { const s = (lines || []).reduce((t, l) => t + num(l.chargeableWeight), 0); return s || num(rec.grossWeight); };

// ---------------- Tonnage ----------------
// q: from, to (YYYY-MM-DD), dateBasis AWB|FLIGHT, groupBy airline|destination|origin|customer|month|day, airline (prefix), type ALL|AWB|MAWB
async function buildTonnage(models, q = {}) {
    const { Airwaybill, HouseAWB, Airline } = models;
    const live = { [Op.or]: [{ [Op.ne]: 'VOID' }, null] };
    const groupBy = ['airline', 'agent', 'destination', 'origin', 'customer', 'month', 'day'].includes(q.groupBy) ? q.groupBy : 'airline';
    const from = dayOf(q.from), to = dayOf(q.to);
    if (!from || !to) throw Object.assign(new Error('Give a from and to date'), { status: 400 });
    if (from > to) throw Object.assign(new Error('From date is after to date'), { status: 400 });
    const pickDay = (r) => (q.dateBasis === 'FLIGHT' ? dayOf(r.flightDate1) : awbDay(r));
    const inRange = (d) => d && d >= from && d <= to;
    const attrs = ['id', 'awbNumber', 'type', 'masterAwbNumber', 'agentName', 'agentCode', 'shipperName', 'origin', 'destination', 'totalPieces', 'grossWeight', 'totalVolume', 'flightNumber1', 'flightDate1', 'executedDate', 'createdAt'];
    const prefix = q.airline && /^\d{3}$/.test(String(q.airline)) ? String(q.airline) : null;

    let awbs = (await Airwaybill.findAll({ where: scoped(models, { status: live }), attributes: attrs.filter((a) => a !== 'masterAwbNumber') }))
        .filter((a) => inRange(pickDay(a)) && (!prefix || bare(a.awbNumber).startsWith(prefix)) && agentMatch(a, q.agent));
    if (q.type === 'AWB') awbs = awbs.filter((a) => (a.type || 'MAWB') === 'AWB');
    if (q.type === 'MAWB') awbs = awbs.filter((a) => (a.type || 'MAWB') === 'MAWB');
    const aLines = await loadLines(models, awbs.map((a) => a.id), ['AWB', 'MAWB']);

    // rows that are counted: airline docs; for "customer" the direct AWBs + the houses (a MAWB's customers are its houses)
    let rows = awbs.map((a) => ({ agentKey: agentKey(a), agent: agentLabel(a), kind: a.type || 'MAWB', no: a.awbNumber, hawb: '', customer: a.shipperName || '', origin: a.origin || '', destination: a.destination || '', day: pickDay(a), pieces: parseInt(a.totalPieces, 10) || 0, gross: num(a.grossWeight), chargeable: chgOf(a, aLines[a.id]), volume: num(a.totalVolume), flight: a.flightNumber1 || '' }));
    if (groupBy === 'customer') {
        const masterDay = {}; awbs.forEach((a) => { masterDay[bare(a.awbNumber)] = pickDay(a); });
        let houses = await HouseAWB.findAll({ where: scoped(models, { status: live }), attributes: attrs });
        houses = houses.filter((h) => { const d = q.dateBasis === 'FLIGHT' ? (dayOf(h.flightDate1) || masterDay[bare(h.masterAwbNumber)]) : awbDay(h); return inRange(d) && (!prefix || bare(h.masterAwbNumber).startsWith(prefix)) && (!q.agent || masterDay[bare(h.masterAwbNumber)] !== undefined); });
        const hLines = await loadLines(models, houses.map((h) => h.id), ['HAWB']);
        const mastersWithHouses = new Set(houses.map((h) => bare(h.masterAwbNumber)));
        rows = [
            ...rows.filter((r) => r.kind === 'AWB' || !mastersWithHouses.has(bare(r.no))),
            ...houses.map((h) => ({ agentKey: agentKey(h), agent: agentLabel(h), kind: 'HAWB', no: h.masterAwbNumber || '', hawb: h.awbNumber, customer: h.shipperName || '', origin: h.origin || '', destination: h.destination || '', day: q.dateBasis === 'FLIGHT' ? (dayOf(h.flightDate1) || masterDay[bare(h.masterAwbNumber)]) : awbDay(h), pieces: parseInt(h.totalPieces, 10) || 0, gross: num(h.grossWeight), chargeable: chgOf(h, hLines[h.id]), volume: num(h.totalVolume), flight: h.flightNumber1 || '' })),
        ];
    }

    const airlines = await Airline.findAll({ attributes: ['prefix', 'code2', 'name'] });
    const alName = (p) => { const a = airlines.find((x) => String(x.prefix) === p); return a ? `${p} ${a.code2 || ''} ${a.name}`.replace(/\s+/g, ' ') : p; };
    const keyOf = (r) => {
        switch (groupBy) {
            case 'airline': { const p = bare(r.no).slice(0, 3); return [p, alName(p)]; }
            case 'agent': return [r.agentKey, r.agent];
            case 'destination': return [r.destination.toUpperCase() || '-', r.destination.toUpperCase() || '(none)'];
            case 'origin': return [r.origin.toUpperCase() || '-', r.origin.toUpperCase() || '(none)'];
            case 'customer': { const c = r.customer.toUpperCase().trim() || '(no shipper)'; return [c, c]; }
            case 'month': { const m = String(r.day).slice(0, 7); return [m, `${MNAME[+m.slice(5, 7) - 1] || ''} ${m.slice(0, 4)}`]; }
            default: return [r.day, r.day];
        }
    };
    const groups = {};
    rows.forEach((r) => {
        const [k, label] = keyOf(r);
        const g = groups[k] = groups[k] || { key: k, label, docs: 0, pieces: 0, grossWeight: 0, chargeableWeight: 0, volume: 0 };
        g.docs += 1; g.pieces += r.pieces; g.grossWeight += r.gross; g.chargeableWeight += r.chargeable; g.volume += r.volume;
    });
    const sortTime = groupBy === 'month' || groupBy === 'day';
    const list = Object.values(groups).map((g) => ({ ...g, grossWeight: r1(g.grossWeight), chargeableWeight: r1(g.chargeableWeight), volume: r2(g.volume) }))
        .sort((a, b) => (sortTime ? String(a.key).localeCompare(String(b.key)) : b.chargeableWeight - a.chargeableWeight));
    const tot = list.reduce((t, g) => ({ docs: t.docs + g.docs, pieces: t.pieces + g.pieces, grossWeight: t.grossWeight + g.grossWeight, chargeableWeight: t.chargeableWeight + g.chargeableWeight, volume: t.volume + g.volume }), { docs: 0, pieces: 0, grossWeight: 0, chargeableWeight: 0, volume: 0 });
    list.forEach((g) => { g.share = tot.chargeableWeight ? r1((g.chargeableWeight / tot.chargeableWeight) * 100) : 0; });
    return {
        from, to, dateBasis: q.dateBasis === 'FLIGHT' ? 'FLIGHT' : 'AWB', groupBy,
        groups: list,
        totals: { ...tot, grossWeight: r1(tot.grossWeight), chargeableWeight: r1(tot.chargeableWeight), volume: r2(tot.volume), tonnes: r2(tot.chargeableWeight / 1000) },
        rows: rows.map((r) => ({ ...r, group: keyOf(r)[1], gross: r1(r.gross), chargeable: r1(r.chargeable) })).sort((a, b) => String(a.day).localeCompare(String(b.day)) || String(a.no).localeCompare(String(b.no))),
    };
}

// ---------------- CSR (Cargo Sales Report) ----------------
// q: period 'YYYY-MM-1|2' (CASS fortnight) or from/to; airline prefix or 'ALL'
// Per AWB: weight charge, valuation, tax, due carrier, due agent split PP / CC (from the AWB's saved charges),
// commission = airline commission % of the weight charge (none when the airline is on NET),
// payable to airline = PP weight + valuation + tax + due carrier - commission on PP;
// receivable from airline = CC due agent + commission on CC;  net = payable - receivable (in each currency).
async function buildCsr(models, q = {}) {
    const { Airwaybill, Airline, AwbOtherCharge } = models;
    let range = q.period ? periodRange(q.period) : null;
    if (!range && q.from && q.to) range = { from: dayOf(q.from), to: dayOf(q.to), label: `${dayOf(q.from)} to ${dayOf(q.to)}`, period: null };
    if (!range || !range.from || !range.to) throw Object.assign(new Error('Pick a CASS period (1-15 or 16-end of month)'), { status: 400 });
    const prefix = q.airline && q.airline !== 'ALL' ? String(q.airline) : null;
    const agentWant = q.agent && q.agent !== 'ALL' ? String(q.agent) : '';
    if (prefix && !/^\d{3}$/.test(prefix)) throw Object.assign(new Error('Airline must be a 3-digit AWB prefix'), { status: 400 });

    const live = { [Op.or]: [{ [Op.ne]: 'VOID' }, null] };
    const awbs = (await Airwaybill.findAll({ where: scoped(models, { status: live }) }))
        .filter((a) => { const d = awbDay(a); return d && d >= range.from && d <= range.to && (!prefix || bare(a.awbNumber).startsWith(prefix)) && agentMatch(a, agentWant); });
    const ids = awbs.map((a) => a.id);
    const lines = await loadLines(models, ids, ['AWB', 'MAWB']);
    const ocs = {};
    if (ids.length) for (const c of await AwbOtherCharge.findAll({ where: { awbId: ids, awbType: ['AWB', 'MAWB'] } })) (ocs[c.awbId] = ocs[c.awbId] || []).push(c);
    const airlines = await Airline.findAll();
    const alOf = (p) => airlines.find((x) => String(x.prefix) === p);

    const isCC = (v) => /^C/i.test(String(v || '').trim());
    const items = awbs.map((a) => {
        const p = bare(a.awbNumber).slice(0, 3);
        const al = alOf(p);
        const commType = String((al && al.commType) || 'NET').toUpperCase();
        const commRate = commType === 'NET' ? 0 : num(al && al.commRate);
        const wtCC = isCC(a.wtVal) || (!a.wtVal && isCC(a.chargeCode));
        const otCC = isCC(a.other) || (!a.other && isCC(a.chargeCode));
        // weight charge: the saved PP / CC figures, else the rate-line totals on the AWB's PP/CC side
        let wPP = num(a.weightChargePP), wCC = num(a.weightChargeCC);
        if (!wPP && !wCC) { const lt = (lines[a.id] || []).reduce((t, l) => t + num(l.total), 0); if (wtCC) wCC = lt; else wPP = lt; }
        const vPP = num(a.valChargePP), vCC = num(a.valChargeCC), tPP = num(a.taxPP), tCC = num(a.taxCC);
        let dcPP = 0, dcCC = 0, daPP = 0, daCC = 0;
        (ocs[a.id] || []).forEach((c) => {
            const amt = num(c.amount);
            const cc = /^(CC|C)$/i.test(String(c.ppcc || '')) ? true : /^(PP|P)$/i.test(String(c.ppcc || '')) ? false : otCC;
            // due agent / due carrier: the saved entitlement; without it the IATA code's 3rd letter (MYC = carrier, AWA = agent)
            const ent = String(c.entitlement || '').trim().toUpperCase();
            const agent = /^(A|AGENT|DUE ?AGENT)$/.test(ent) || (!ent && /^[A-Z]{2}A$/i.test(String(c.chargeCode || '')));
            if (agent) { if (cc) daCC += amt; else daPP += amt; } else if (cc) dcCC += amt; else dcPP += amt;
        });
        const commPP = r2((wPP * commRate) / 100), commCC = r2((wCC * commRate) / 100);
        const payable = r2(wPP + vPP + tPP + dcPP - commPP);
        const receivable = r2(daCC + commCC);
        return {
            id: a.id, type: a.type || 'MAWB', awbNumber: a.awbNumber, date: awbDay(a), airlinePrefix: p, airline: al ? al.name : p,
            agentKey: agentKey(a), agent: agentLabel(a), agentName: a.agentName || '', agentCode: a.agentCode || '',
            origin: a.origin || '', destination: a.destination || '', flight: a.flightNumber1 || '', shipper: a.shipperName || '', consignee: a.consigneeName || '',
            pieces: parseInt(a.totalPieces, 10) || 0, grossWeight: r1(num(a.grossWeight)), chargeableWeight: r1(chgOf(a, lines[a.id])),
            rate: (lines[a.id] || []).map((l) => num(l.rateCharge)).find((x) => x) || 0,
            currency: String(a.currencyCode || 'INR').toUpperCase(), ppcc: wtCC ? 'CC' : 'PP',
            weightPP: r2(wPP), weightCC: r2(wCC), valuationPP: r2(vPP), valuationCC: r2(vCC), taxPP: r2(tPP), taxCC: r2(tCC),
            dueCarrierPP: r2(dcPP), dueCarrierCC: r2(dcCC), dueAgentPP: r2(daPP), dueAgentCC: r2(daCC),
            commRate, commType, commissionPP: commPP, commissionCC: commCC, payable, receivable, net: r2(payable - receivable),
        };
    }).sort((x, y) => x.agentKey.localeCompare(y.agentKey) || x.airlinePrefix.localeCompare(y.airlinePrefix) || String(x.date).localeCompare(String(y.date)) || x.awbNumber.localeCompare(y.awbNumber));

    const SUM = ['pieces', 'grossWeight', 'chargeableWeight', 'weightPP', 'weightCC', 'valuationPP', 'valuationCC', 'taxPP', 'taxCC', 'dueCarrierPP', 'dueCarrierCC', 'dueAgentPP', 'dueAgentCC', 'commissionPP', 'commissionCC', 'payable', 'receivable', 'net'];
    const summary = {};
    items.forEach((i) => {
        // one CSR per IATA agent code, airline and currency (CASS bills each agent code separately)
        const k = `${i.agentKey}|${i.airlinePrefix}|${i.currency}`;
        const s = summary[k] = summary[k] || { agentKey: i.agentKey, agent: i.agent, agentCode: i.agentCode, airlinePrefix: i.airlinePrefix, airline: i.airline, currency: i.currency, awbs: 0, commRate: i.commRate, commType: i.commType, ...Object.fromEntries(SUM.map((f) => [f, 0])) };
        s.awbs += 1; SUM.forEach((f) => { s[f] += i[f]; });
    });
    const airlineSummary = Object.values(summary).map((s) => { SUM.forEach((f) => { s[f] = f === 'pieces' ? s[f] : r2(s[f]); }); return s; })
        .sort((a, b) => a.agentKey.localeCompare(b.agentKey) || a.airlinePrefix.localeCompare(b.airlinePrefix) || a.currency.localeCompare(b.currency));
    return { period: range.period, from: range.from, to: range.to, label: range.label, airline: prefix || 'ALL', agent: agentWant || 'ALL', items, airlineSummary };
}

module.exports = { buildTonnage, buildCsr, periodRange, recentPeriods, dayOf, awbDay };
