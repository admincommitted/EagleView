// Customer shipment updates (29-Oct-2026). OFF until switched on in Track Shipments -> Customer updates.
// Settings are one JSON value in AppSetting (key awb_customer_notify):
//   { enabled, email, whatsapp, milestones: ['DEP','ARR','DLV'], toShipper, toConsignee, ccEmails: 'a@b.com, c@d.com' }
// Who gets it: for a direct AWB its shipper / consignee; for a MAWB the shippers / consignees of its live houses
// (the MAWB's own shipper is normally the forwarder); for a house event, that house's parties.
// Email uses Settings -> Email (SMTP); WhatsApp uses Settings -> WhatsApp (QR or API, instant or scheduled).
const { Op } = require('sequelize');
const AppSetting = require('../models/AppSetting');

const KEY = 'awb_customer_notify';
const DEFAULTS = { enabled: false, email: false, whatsapp: false, milestones: ['DEP', 'ARR', 'DLV'], toShipper: true, toConsignee: false, ccEmails: '' };
const ALLOWED = ['FNA', 'FMA', 'FOH', 'RCS', 'DEP', 'ARR', 'TFD', 'RCF', 'NFD', 'DLV'];
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

async function getSettings() {
    const row = await AppSetting.findOne({ where: { key: KEY } });
    let v = {};
    if (row && row.value) { try { v = JSON.parse(row.value); } catch (e) { v = {}; } }
    return { ...DEFAULTS, ...v };
}

function cleanSettings(input) {
    const s = { ...DEFAULTS, ...(input || {}) };
    const out = {
        enabled: s.enabled === true || s.enabled === 'true',
        email: s.email === true || s.email === 'true',
        whatsapp: s.whatsapp === true || s.whatsapp === 'true',
        toShipper: s.toShipper === true || s.toShipper === 'true',
        toConsignee: s.toConsignee === true || s.toConsignee === 'true',
        milestones: [...new Set((Array.isArray(s.milestones) ? s.milestones : []).map((m) => String(m).toUpperCase()).filter((m) => ALLOWED.includes(m)))],
        ccEmails: String(s.ccEmails || '').split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean).join(', '),
    };
    const bad = out.ccEmails ? out.ccEmails.split(', ').filter((x) => !EMAIL_RE.test(x)) : [];
    if (bad.length) throw Object.assign(new Error('Not a valid email: ' + bad.join(', ')), { status: 400 });
    if (out.enabled && !out.email && !out.whatsapp) throw Object.assign(new Error('Pick email and / or WhatsApp, or switch updates off'), { status: 400 });
    if (out.enabled && !out.milestones.length) throw Object.assign(new Error('Pick at least one milestone'), { status: 400 });
    if (out.enabled && !out.toShipper && !out.toConsignee && !out.ccEmails) throw Object.assign(new Error('Pick who gets the update (shipper, consignee or CC emails)'), { status: 400 });
    return out;
}

async function saveSettings(input) {
    const v = cleanSettings(input);
    const [row] = await AppSetting.findOrCreate({ where: { key: KEY }, defaults: { key: KEY, value: '{}', label: 'Customer shipment updates', group: 'awb' } });
    await row.update({ value: JSON.stringify(v) });
    return v;
}

const bare = (n) => String(n || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const fmt = (iso) => { const d = new Date(iso); return isNaN(d) ? String(iso || '') : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); };

// the records whose customers should hear about this event
async function recordsFor(event) {
    const Airwaybill = require('../models/Airwaybill');
    const HouseAWB = require('../models/HouseAWB');
    const live = { [Op.or]: [{ [Op.ne]: 'VOID' }, null] };
    const nos = [...new Set([event.awbNumber, bare(event.awbNumber)])];
    if (event.hawbNumber) {
        return HouseAWB.findAll({ where: { awbNumber: event.hawbNumber, masterAwbNumber: nos, status: live } });
    }
    const own = await Airwaybill.findAll({ where: { awbNumber: nos, status: live } });
    const houses = await HouseAWB.findAll({ where: { masterAwbNumber: nos, status: live } });
    if (houses.length) return [...own.filter((a) => (a.type || 'MAWB') === 'AWB'), ...houses];
    return own;
}

function messageFor(event, rec) {
    const what = require('./awbTrackingEvents').CODE_NAME[event.code] || event.code;
    const ref = rec.masterAwbNumber ? `HAWB ${rec.awbNumber} (MAWB ${rec.masterAwbNumber})` : `AWB ${rec.awbNumber}`;
    const bits = [what, event.station ? `at ${event.station}` : '', event.flight ? `on ${event.flight}` : '', fmt(event.eventAt)].filter(Boolean).join(' ');
    const route = rec.origin || rec.destination ? `${rec.origin || ''} → ${rec.destination || ''}` : '';
    return { ref, bits, route, statusText: `${bits}${route ? ` (${route})` : ''}` };
}

// returns a short text of what was sent (kept on the event), or '' when nothing is switched on for this event
async function notifyEvent(event) {
    const s = await getSettings();
    if (!s.enabled || !s.milestones.includes(event.code)) return '';
    const recs = await recordsFor(event);
    const done = [];
    for (const rec of recs) {
        const m = messageFor(event, rec);
        const people = [];
        if (s.toShipper) people.push({ name: rec.shipperName, email: rec.shipperEmail, phone: rec.shipperPhone, role: 'shipper' });
        if (s.toConsignee) people.push({ name: rec.consigneeName, email: rec.consigneeEmail, phone: rec.consigneePhone, role: 'consignee' });
        if (s.email) {
            const to = [...new Set(people.map((p) => String(p.email || '').trim()).filter((x) => EMAIL_RE.test(x)))];
            const cc = s.ccEmails ? s.ccEmails.split(', ') : [];
            if (to.length || cc.length) {
                try {
                    await require('./mailer').sendMail({
                        to: (to.length ? to : cc).join(', '), cc: to.length && cc.length ? cc.join(', ') : undefined,
                        subject: `Shipment update: ${m.ref} - ${event.code}`,
                        text: `Dear ${people[0] && people[0].name ? people[0].name : 'Customer'},\n\nYour shipment ${m.ref}:\n${m.statusText}\n\nShipper: ${rec.shipperName || '-'}\nConsignee: ${rec.consigneeName || '-'}\n\nThis is an automatic update.`,
                    });
                    done.push(`EMAIL ${rec.awbNumber} -> ${(to.length ? to : cc).length} address(es)`);
                } catch (e) { done.push(`EMAIL ${rec.awbNumber} FAILED: ${String(e.message).slice(0, 120)}`); }
            } else done.push(`EMAIL ${rec.awbNumber}: no email on AWB`);
        }
        if (s.whatsapp) {
            const phones = [...new Map(people.filter((p) => String(p.phone || '').replace(/\D/g, '').length >= 10).map((p) => [String(p.phone).replace(/\D/g, ''), p])).values()];
            if (!phones.length) done.push(`WA ${rec.awbNumber}: no mobile on AWB`);
            for (const p of phones) {
                try {
                    const r = await require('./WhatsappScheduler').handleStatusUpdate(p.name || 'Customer', p.phone, rec.masterAwbNumber ? `${rec.awbNumber} / ${rec.masterAwbNumber}` : rec.awbNumber, m.statusText);
                    done.push(`WA ${rec.awbNumber} -> ${p.role}${r && r.queued ? ' (queued)' : ''}`);
                } catch (e) { done.push(`WA ${rec.awbNumber} FAILED: ${String(e.message).slice(0, 120)}`); }
            }
        }
    }
    if (!recs.length) done.push('no live AWB / HAWB found for this event');
    return done.join('; ').slice(0, 2000);
}

module.exports = { getSettings, saveSettings, cleanSettings, notifyEvent, DEFAULTS, KEY };
