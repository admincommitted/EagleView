// Customer shipment updates. OFF until switched on in Track Shipments -> Customer updates.
// Settings are one JSON value in AppSetting (key awb_customer_notify):
//   { enabled, email, whatsapp, milestones: ['DEP','ARR','DLV'], toShipper, toConsignee, ccEmails: 'a@b.com, c@d.com' }
// Who gets it: for a direct AWB its shipper / consignee; for a MAWB the shippers / consignees of its live houses
// (the MAWB's own shipper is normally the forwarder); for a house event, that house's parties.
// Email uses Settings -> Email (SMTP); WhatsApp uses Settings -> WhatsApp (QR or API, instant or scheduled).
import { Op } from '../../config/database.js';
import { AppSetting, Airwaybill, HouseAWB } from '../../models/index.js';
import { sendMail } from '../integrations/mailer.js';
import { handleStatusUpdate } from '../integrations/WhatsappScheduler.js';
import { CODE_NAME } from './awbTrackingEvents.js';

const KEY = 'awb_customer_notify';
const DEFAULTS = {
  enabled: false,
  email: false,
  whatsapp: false,
  milestones: ['DEP', 'ARR', 'DLV'],
  toShipper: true,
  toConsignee: false,
  ccEmails: '',
};
const ALLOWED_MILESTONES = ['FNA', 'FMA', 'FOH', 'RCS', 'DEP', 'ARR', 'TFD', 'RCF', 'NFD', 'DLV'];
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const MIN_MOBILE_DIGITS = 10;
const MAX_ERROR_TEXT = 120;
const MAX_SENT_SUMMARY = 2000;

async function getSettings() {
  const row = await AppSetting.findOne({ where: { key: KEY } });
  let saved = {};
  if (row && row.value) {
    try {
      saved = JSON.parse(row.value);
    } catch {
      saved = {};
    }
  }
  return { ...DEFAULTS, ...saved };
}

const isOn = (value) => value === true || value === 'true';
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

function cleanSettings(input) {
  const settings = { ...DEFAULTS, ...input };
  const milestones = (Array.isArray(settings.milestones) ? settings.milestones : [])
    .map((code) => String(code).toUpperCase())
    .filter((code) => ALLOWED_MILESTONES.includes(code));
  const cleaned = {
    enabled: isOn(settings.enabled),
    email: isOn(settings.email),
    whatsapp: isOn(settings.whatsapp),
    toShipper: isOn(settings.toShipper),
    toConsignee: isOn(settings.toConsignee),
    milestones: [...new Set(milestones)],
    ccEmails: String(settings.ccEmails || '')
      .split(/[,;\s]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', '),
  };
  const badEmails = cleaned.ccEmails ? cleaned.ccEmails.split(', ').filter((address) => !EMAIL_RE.test(address)) : [];
  if (badEmails.length) throw badRequest('Not a valid email: ' + badEmails.join(', '));
  if (cleaned.enabled && !cleaned.email && !cleaned.whatsapp)
    throw badRequest('Pick email and / or WhatsApp, or switch updates off');
  if (cleaned.enabled && !cleaned.milestones.length) throw badRequest('Pick at least one milestone');
  if (cleaned.enabled && !cleaned.toShipper && !cleaned.toConsignee && !cleaned.ccEmails) {
    throw badRequest('Pick who gets the update (shipper, consignee or CC emails)');
  }
  return cleaned;
}

async function saveSettings(input) {
  const cleaned = cleanSettings(input);
  const [row] = await AppSetting.findOrCreate({
    where: { key: KEY },
    defaults: { key: KEY, value: '{}', label: 'Customer shipment updates', group: 'awb' },
  });
  await row.update({ value: JSON.stringify(cleaned) });
  return cleaned;
}

const bare = (number) =>
  String(number || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
const formatEventTime = (iso) => {
  const date = new Date(iso);
  if (isNaN(date)) return String(iso || '');
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

// the records whose customers should hear about this event
async function recordsFor(event) {
  const live = { [Op.or]: [{ [Op.ne]: 'VOID' }, null] };
  const numbers = [...new Set([event.awbNumber, bare(event.awbNumber)])];
  if (event.hawbNumber) {
    return HouseAWB.findAll({ where: { awbNumber: event.hawbNumber, masterAwbNumber: numbers, status: live } });
  }
  const own = await Airwaybill.findAll({ where: { awbNumber: numbers, status: live } });
  const houses = await HouseAWB.findAll({ where: { masterAwbNumber: numbers, status: live } });
  if (houses.length) return [...own.filter((awb) => (awb.type || 'MAWB') === 'AWB'), ...houses];
  return own;
}

function messageFor(event, record) {
  const what = CODE_NAME[event.code] || event.code;
  const ref = record.masterAwbNumber
    ? `HAWB ${record.awbNumber} (MAWB ${record.masterAwbNumber})`
    : `AWB ${record.awbNumber}`;
  const bits = [
    what,
    event.station ? `at ${event.station}` : '',
    event.flight ? `on ${event.flight}` : '',
    formatEventTime(event.eventAt),
  ]
    .filter(Boolean)
    .join(' ');
  const route = record.origin || record.destination ? `${record.origin || ''} → ${record.destination || ''}` : '';
  return { ref, bits, route, statusText: `${bits}${route ? ` (${route})` : ''}` };
}

function recipientsOf(record, settings) {
  const people = [];
  if (settings.toShipper) {
    people.push({ name: record.shipperName, email: record.shipperEmail, phone: record.shipperPhone, role: 'shipper' });
  }
  if (settings.toConsignee) {
    people.push({
      name: record.consigneeName,
      email: record.consigneeEmail,
      phone: record.consigneePhone,
      role: 'consignee',
    });
  }
  return people;
}

async function sendEmailUpdate({ event, record, message, people, settings, sentLog }) {
  const to = [
    ...new Set(people.map((person) => String(person.email || '').trim()).filter((address) => EMAIL_RE.test(address))),
  ];
  const cc = settings.ccEmails ? settings.ccEmails.split(', ') : [];
  if (!to.length && !cc.length) {
    sentLog.push(`EMAIL ${record.awbNumber}: no email on AWB`);
    return;
  }
  const mainList = to.length ? to : cc;
  const greetingName = people[0] && people[0].name ? people[0].name : 'Customer';
  try {
    await sendMail({
      to: mainList.join(', '),
      cc: to.length && cc.length ? cc.join(', ') : undefined,
      subject: `Shipment update: ${message.ref} - ${event.code}`,
      text: `Dear ${greetingName},\n\nYour shipment ${message.ref}:\n${message.statusText}\n\nShipper: ${record.shipperName || '-'}\nConsignee: ${record.consigneeName || '-'}\n\nThis is an automatic update.`,
    });
    sentLog.push(`EMAIL ${record.awbNumber} -> ${mainList.length} address(es)`);
  } catch (e) {
    sentLog.push(`EMAIL ${record.awbNumber} FAILED: ${String(e.message).slice(0, MAX_ERROR_TEXT)}`);
  }
}

const mobileDigits = (phone) => String(phone || '').replace(/\D/g, '');

async function sendWhatsappUpdates({ record, message, people, sentLog }) {
  const withMobile = people.filter((person) => mobileDigits(person.phone).length >= MIN_MOBILE_DIGITS);
  const uniqueByMobile = [
    ...new Map(withMobile.map((person) => [String(person.phone).replace(/\D/g, ''), person])).values(),
  ];
  if (!uniqueByMobile.length) sentLog.push(`WA ${record.awbNumber}: no mobile on AWB`);
  const shipmentRef = record.masterAwbNumber ? `${record.awbNumber} / ${record.masterAwbNumber}` : record.awbNumber;
  for (const person of uniqueByMobile) {
    try {
      const result = await handleStatusUpdate(person.name || 'Customer', person.phone, shipmentRef, message.statusText);
      sentLog.push(`WA ${record.awbNumber} -> ${person.role}${result && result.queued ? ' (queued)' : ''}`);
    } catch (e) {
      sentLog.push(`WA ${record.awbNumber} FAILED: ${String(e.message).slice(0, MAX_ERROR_TEXT)}`);
    }
  }
}

// returns a short text of what was sent (kept on the event), or '' when nothing is switched on for this event
async function notifyEvent(event) {
  const settings = await getSettings();
  if (!settings.enabled || !settings.milestones.includes(event.code)) return '';
  const records = await recordsFor(event);
  const sentLog = [];
  for (const record of records) {
    const message = messageFor(event, record);
    const people = recipientsOf(record, settings);
    if (settings.email) await sendEmailUpdate({ event, record, message, people, settings, sentLog });
    if (settings.whatsapp) await sendWhatsappUpdates({ record, message, people, sentLog });
  }
  if (!records.length) sentLog.push('no live AWB / HAWB found for this event');
  return sentLog.join('; ').slice(0, MAX_SENT_SUMMARY);
}

export { getSettings, saveSettings, notifyEvent, KEY };
