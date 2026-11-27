import { sendMail } from '../../../utils/integrations/mailer.js';
import { DIVISIONS } from './shipments.constants.js';
import { badRequest, docketNotFound } from './shipments.errors.js';
import { ensureShipmentTables, execute, selectRows } from './shipments.tables.js';

/**
 * Send Mail (Shipment Status tab): the status mail to the customer. To = the party's e-mails from the party master
 * (billing party, then main party); the docket's milestones in a table.
 */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CELL = 'style="border:1px solid #cbd5e1;padding:4px 8px;font-size:12px"';

const escapeHtml = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
/** "2026-11-05" -> "05-11-2026" */
const displayDate = (value) =>
  value ? String(value).slice(8, 10) + '-' + String(value).slice(5, 7) + '-' + String(value).slice(0, 4) : '';
const splitAddresses = (text) => String(text || '').split(/[;,\s]+/);

async function loadDocket(shipmentId) {
  await ensureShipmentTables();
  const docket = (await selectRows('SELECT * FROM Shipments WHERE id = ?', [shipmentId]))[0];
  if (!docket) throw docketNotFound();
  return docket;
}

async function partyEmails(docket) {
  const emails = [];
  for (const name of [docket.billingParty, docket.mainParty]) {
    if (!name) continue;
    const party = (
      await selectRows('SELECT id, email FROM Parties WHERE upper(name) = upper(?) LIMIT 1', [name]).catch(() => [])
    )[0];
    if (!party) continue;
    const branches = await selectRows(
      'SELECT email1, email2 FROM PartyBranches WHERE partyId = ? ORDER BY isDefault DESC, id LIMIT 3',
      [party.id],
    ).catch(() => []);
    for (const text of [party.email, ...branches.flatMap((branch) => [branch.email1, branch.email2])]) {
      splitAddresses(text)
        .filter((address) => /@/.test(address))
        .forEach((address) => {
          if (!emails.includes(address.toLowerCase())) emails.push(address.toLowerCase());
        });
    }
  }
  return emails;
}

function docketFacts(docket, division, isAir, data) {
  const isImport = division.side === 'Import';
  const numberWithDate = (number, date) => [number, displayDate(date)].filter(Boolean).join(' dt ');
  return [
    ['Docket No', docket.docketNo],
    [isImport ? 'Importer' : 'Shipper', docket.mainParty],
    [isImport ? 'Supplier' : 'Consignee', docket.otherParty],
    [(isAir ? 'MAWB' : 'MBL') + ' No', numberWithDate(docket.mawbNo, docket.mawbDate)],
    [(isAir ? 'HAWB' : 'HBL') + ' No', numberWithDate(docket.hawbNo, docket.hawbDate)],
    [
      isAir ? 'Airline / Flight' : 'Line / Vessel',
      [docket.carrier, docket.flightVessel, docket.voyage].filter(Boolean).join(' / '),
    ],
    ['Origin > Destination', [docket.originPort, docket.destinationPort].filter(Boolean).join('  >  ')],
    [
      'Pkgs / Gross Wt',
      [
        docket.pkgs ? docket.pkgs + ' ' + (docket.pkgUnit || '') : '',
        docket.grossWeight ? docket.grossWeight + ' ' + (data.grossUnit || 'KGS') : '',
      ]
        .filter(Boolean)
        .join(' / '),
    ],
    ['ETD / ETA', [displayDate(docket.etd), displayDate(docket.eta)].filter(Boolean).join(' / ')],
    [isImport ? 'IGM' : 'EGM', numberWithDate(docket.igmNo, docket.igmDate)],
    ['Reference / PO', [docket.referenceNo, docket.poNo].filter(Boolean).join(' / ')],
  ].filter((fact) => fact[1]);
}

function statusMailHtml(docket, division, facts, events) {
  const factRows = facts
    .map((fact) => `<tr><td ${CELL}><b>${escapeHtml(fact[0])}</b></td><td ${CELL}>${escapeHtml(fact[1])}</td></tr>`)
    .join('');
  const eventRows = events.length
    ? events
        .map(
          (event) =>
            `<tr><td ${CELL}>${escapeHtml(event.title)}</td><td ${CELL}>${displayDate(event.eventDate)}</td><td ${CELL}>${escapeHtml(event.eventTime || '')}</td><td ${CELL}>${escapeHtml(event.remarks || '')}</td></tr>`,
        )
        .join('')
    : `<tr><td ${CELL} colspan="4">No status updated yet</td></tr>`;
  return `<p>Dear Sir / Madam,</p><p>Please find below the status of your ${escapeHtml(division.label || '')} shipment.</p>
<table style="border-collapse:collapse;margin:8px 0">${factRows}</table>
<table style="border-collapse:collapse;margin:8px 0"><tr><th ${CELL}>Status</th><th ${CELL}>Date</th><th ${CELL}>Time</th><th ${CELL}>Remarks</th></tr>
${eventRows}</table>
<p>Current status: <b>${escapeHtml(docket.currentStatus || 'Registered')}</b></p><p>Regards</p>`;
}

async function mailDraft(docket) {
  const division = DIVISIONS[docket.division] || {};
  const isAir = division.mode === 'Air';
  const data = docket.dataJson ? JSON.parse(docket.dataJson) : {};
  const events = await selectRows(
    "SELECT title, eventDate, eventTime, remarks FROM ShipmentEvents WHERE shipmentId = ? AND kind = 'status' ORDER BY eventDate, coalesce(eventTime, ''), id",
    [docket.id],
  );
  const emails = await partyEmails(docket);
  const html = statusMailHtml(docket, division, docketFacts(docket, division, isAir, data), events);
  const houseText = docket.hawbNo ? ' - ' + (isAir ? 'HAWB ' : 'HBL ') + docket.hawbNo : '';
  const statusText = docket.currentStatus ? ' - ' + docket.currentStatus : '';
  return {
    to: emails.join(', '),
    subject: `Shipment status - ${docket.docketNo}${houseText}${statusText}`,
    html,
    note: '',
  };
}

/** GET /:id/mail - the draft and the last mails sent. */
export async function statusMail(shipmentId) {
  const docket = await loadDocket(shipmentId);
  const log = await selectRows(
    "SELECT title, eventDate, eventTime, remarks, createdBy FROM ShipmentEvents WHERE shipmentId = ? AND kind = 'mail' ORDER BY id DESC LIMIT 20",
    [docket.id],
  );
  return { ...(await mailDraft(docket)), log };
}

/** POST /:id/mail { to, cc, subject, message } - sends the status mail and logs it on the docket. */
export async function sendStatusMail(shipmentId, body, user) {
  const docket = await loadDocket(shipmentId);
  const recipients = splitAddresses(body.to).filter(Boolean);
  if (!recipients.length || recipients.some((address) => !EMAIL_PATTERN.test(address)))
    throw badRequest('Enter the e-mail address(es) to send to');
  const draft = await mailDraft(docket);
  const extraMessage = String(body.message || '').trim();
  const html = (extraMessage ? '<p>' + escapeHtml(extraMessage).replace(/\n/g, '<br>') + '</p>' : '') + draft.html;
  const subject = String(body.subject || draft.subject);
  await sendMail({ to: recipients.join(', '), cc: body.cc || undefined, subject, html });
  const now = new Date().toISOString();
  await execute(
    'INSERT INTO ShipmentEvents (shipmentId, kind, title, eventDate, eventTime, status, remarks, dataJson, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [
      docket.id,
      'mail',
      subject,
      now.slice(0, 10),
      new Date().toTimeString().slice(0, 5),
      'Sent',
      'To ' + recipients.join(', ') + (body.cc ? '; cc ' + body.cc : ''),
      '{}',
      user,
      now,
      now,
    ],
  );
  return { ok: true, to: recipients };
}
