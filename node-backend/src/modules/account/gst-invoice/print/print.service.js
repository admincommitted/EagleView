// What the invoice print needs besides the invoice itself, laid out as on iCAFFE's tax invoice: the company head
// (name, address, CIN, GSTIN, PAN, logo, bank, registered office, notes), the billing branch, the party's address /
// state / PAN, the SAC and GST rate of each charge (bills loaded from iCAFFE carry neither on their lines) and the
// shipment details of every docket on the bill (Shipment Registration, else the docket details read from iCAFFE).
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { ASSETS_DIR } from '../../../../config/env.js';
import { invoiceNotFound, parseJsonList, selectRows, toNumber } from '../shared/invoiceDb.js';
import { GST_STATES } from '../shared/invoiceKinds.js';
import { COMPANY_NAME } from '../shared/ourCompany.js';

const QR_OPTIONS = { margin: 1, width: 220 };

// the head as on the iCAFFE invoice - used where Company Profile (Settings) is still empty
const HEAD_DEFAULT = {
  name: COMPANY_NAME,
  address1: 'A-406, Road No. 4, Street No. 8, Mahipalpur Extn.',
  address2: 'New Delhi - 110037, India',
  phone: '011-46151111',
  fax: '011-46040343',
  email: 'accts6@committedcargo.com',
  cin: 'U63090DL1998PLC096746',
  gstin: '07AAACC6689E1ZJ',
  pan: 'AAACC6689E',
  bank: {
    name: 'Committed Cargo Care Limited',
    bankName: 'Kotak Mahindra Bank',
    accountNo: '2647171181',
    ifsc: 'KKBK0004591',
    branch: 'M-3, Hauz Khas Enclave, Aurobindo Marg, New Delhi - 110016',
  },
  regOffice:
    'A-406, Road No. 4,Street No.8, Mahipalpur Extn. New Delhi - 110037, India Tel : +91 (11) 46151111 Email : contact@committedcargo.com',
  notes: [
    'This Invoice System Generated Signature No Require.',
    'E & O. E.,',
    'We reserve the right to charge interest @ 18% p.a. on amount outstanding after the due date.',
    "All Cheques & Demand Drafts should be in favour of 'COMMITTED CARGO CARE LIMITED'",
    'Cheques / Drafts are subject to realisation.',
    'Any dispute, discrepany or any supporting documents required must be notified within 7 days, failing which the Invoice will be treated as true and correct.',
    'All disputes are subject to NEW DELHI jurisdiction.',
  ],
};

let defaultLogo = null;
function defaultLogoDataUrl() {
  if (defaultLogo !== null) return defaultLogo;
  try {
    defaultLogo =
      'data:image/jpeg;base64,' + fs.readFileSync(path.join(ASSETS_DIR, 'company_logo.jpg')).toString('base64');
  } catch {
    defaultLogo = '';
  }
  return defaultLogo;
}

const firstRow = async (sql, replacements) => (await selectRows(sql, replacements).catch(() => []))[0];

/** The first of `keys` with a real value (not blank, not '0'). */
const pick = (row, keys) => {
  for (const key of keys) {
    const value = row && row[key];
    if (value != null && String(value).trim() !== '' && String(value).trim() !== '0') return String(value).trim();
  }
  return '';
};
const printDate = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return match ? match[3] + '/' + match[2] + '/' + match[1] : text;
};
const parseOr = (text, fallback) => {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
};

function shipmentDocketView(shipment) {
  const isImport = /^(AI|SI)$/.test(String(shipment.division || ''));
  const data = parseOr(shipment.dataJson, {});
  const containers = parseOr(shipment.containersJson || '[]', []);
  return {
    docketNo: shipment.docketNo,
    mawbNo: shipment.mawbNo,
    mawbDate: printDate(shipment.mawbDate),
    hawbNo: shipment.hawbNo,
    hawbDate: printDate(shipment.hawbDate),
    carrier: shipment.carrier || shipment.flightVessel,
    origin: shipment.originPort,
    destination: shipment.destinationPort,
    pkgs: [shipment.pkgs, shipment.pkgUnit].filter(Boolean).join(' '),
    grossWt: shipment.grossWeight,
    chargeableWt: shipment.chargeableWeight,
    cbm: shipment.volume,
    // import: the overseas supplier ships to the importer (main party); export: the exporter (main party) ships to the buyer
    consignee: isImport ? shipment.mainParty : shipment.otherParty,
    shipper: isImport ? shipment.otherParty : shipment.mainParty,
    freightTerms: shipment.freightTerm,
    shipmentTerms: shipment.shipmentTerm,
    goods: shipment.goodsDesc,
    partyInvoice: isImport ? '' : shipment.referenceNo,
    sbNo: isImport ? data.beNo || '' : data.sbNo || '',
    sbDate: isImport ? printDate(data.beDate) : printDate(data.sbDate),
    isImport,
    igmNo: shipment.igmNo,
    containers: containers
      .map((container) => container.no)
      .filter(Boolean)
      .join(', '),
    division: shipment.division,
  };
}

const FREIGHT_NATURE = { P: 'PREPAID', C: 'COLLECT' };

// docket details read from iCAFFE (InfoAgent.FetchImportDocketByShipmentIdNew and the export / sea equivalents)
const icaffeDocketView = (docket) => ({
  docketNo: pick(docket, ['DOCKETNO', 'DocketNo']),
  mawbNo: pick(docket, ['MAWBNO', 'MBLNO', 'MBL_NO']).replace(/^NOMAWB$/i, ''),
  mawbDate: pick(docket, ['IMPMAWBNODATE', 'MAWBDATE', 'MAWB_DATE', 'MBLDATE']),
  hawbNo: pick(docket, ['HAWBNO', 'HBLNO', 'HBL_NO']),
  hawbDate: pick(docket, ['IMPHAWBNODATE', 'HAWBDATE', 'HAWB_DATE', 'HBLDATE']),
  carrier: pick(docket, ['AIRLINE_NAME', 'AIRLINENAME', 'AIRLINE', 'CARRIERNAME', 'SHIPPINGLINE', 'VESSELNAME']),
  origin: pick(docket, ['ORIGINPORT', 'ORIGIN', 'ORIGINPORTNAME', 'PORTOFLOADING']),
  destination: pick(docket, ['DESTINATION', 'DESTINATIONPORT', 'DESTINATIONPORTNAME', 'PORTOFDISCHARGE']),
  pkgs: pick(docket, ['NOOFPKGS', 'NO_OF_PKGS', 'PKGS']),
  grossWt: pick(docket, ['GROSS_WEIGHT', 'GROSSWEIGHT']),
  chargeableWt: pick(docket, ['CHARGEABLE_WEIGHT', 'CHARGEABLEWEIGHT']),
  cbm: pick(docket, ['CBM', 'VOLUME']),
  consignee: pick(docket, ['ConsigneeName', 'CONSIGNEENAME', 'CONSIGNEE_NAME']),
  shipper: pick(docket, ['ShipperName', 'SHIPPERNAME', 'SHIPPER_NAME']),
  freightTerms:
    FREIGHT_NATURE[pick(docket, ['NATURE', 'FREIGHT_NATURE'])] || pick(docket, ['FREIGHTTERMS', 'FREIGHT_TERMS']),
  shipmentTerms: pick(docket, ['SHIPMENT_TERMS', 'SHIPMENTTERMS']),
  goods: pick(docket, ['GOODSDESCRIPTION', 'GOODS_DESC', 'DESCRIPTION']),
  partyInvoice: pick(docket, ['INVOICENO', 'INVOICE_NO', 'PARTYINVOICENO']),
  sbNo: pick(docket, ['SBNO', 'SB_NO', 'BILLOFENTRY']),
  sbDate: pick(docket, ['SBDATE', 'SB_DATE', 'BILLOFENTRYDATE']),
  division: '',
});

/** Company head from Company Profile (Settings) with the iCAFFE defaults where it is empty. */
async function companyHead() {
  // never the e-invoice user / password columns
  const profile =
    (await firstRow(
      `SELECT companyName, legalName, address1, address2, city, state, pincode, country, gstin, pan, cin, phone, email, website, logoDataUrl,
      lutNo, tagline, fax, registeredOffice, invoiceNotes FROM CompanyProfile ORDER BY id LIMIT 1`,
    )) || {};
  const defaults = HEAD_DEFAULT;
  return {
    name: profile.legalName || profile.companyName || defaults.name,
    address1: profile.address1 || defaults.address1,
    address2:
      [profile.address2, profile.city, profile.country, profile.pincode ? 'PIN-' + profile.pincode : '']
        .filter(Boolean)
        .join(' ,') || defaults.address2,
    phone: profile.phone || defaults.phone,
    fax: profile.fax || (profile.address1 ? '' : defaults.fax),
    email: profile.email || defaults.email,
    website: profile.website || '',
    cin: profile.cin || defaults.cin,
    gstin: profile.gstin || defaults.gstin,
    pan: profile.pan || defaults.pan,
    lutNo: profile.lutNo || '',
    logo: profile.logoDataUrl || defaultLogoDataUrl(),
    tagline: profile.tagline || '',
    // the bank block on the invoice is fixed (the user's choice) - not taken from Company Settings
    bank: defaults.bank,
    regOffice: profile.registeredOffice || defaults.regOffice,
    notes: profile.invoiceNotes
      ? String(profile.invoiceNotes)
          .split(/\r?\n/)
          .map((note) => note.trim())
          .filter(Boolean)
      : defaults.notes,
  };
}

// the bill's branch (Branch Master) gives the address, GSTIN, e-mail and phone of the head where it has them; the
// registered office line at the foot stays the company's
function applyBillingBranch(head, branch) {
  if (!branch) return;
  const address = String(branch.address || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (address) {
    head.address1 = address;
    head.address2 = '';
  }
  if (branch.gstin && String(branch.gstin).trim()) head.gstin = String(branch.gstin).trim().toUpperCase();
  if (branch.email && String(branch.email).trim()) head.email = String(branch.email).trim();
  if (branch.phone && String(branch.phone).trim()) {
    head.phone = String(branch.phone).trim();
    head.fax = '';
  }
}

const branchAddress = (branch) =>
  branch
    ? [branch.address1, branch.address2, branch.city, branch.pinCode, branch.state, branch.country]
        .filter(Boolean)
        .join(', ')
    : '';

// the party: invoice address, else the party branch, else the ledger (addresses loaded from iCAFFE); a party with
// several GSTINs: the branch with this bill's GSTIN, the ledger's only when it is the same GSTIN
async function partyOfInvoice(invoice) {
  const ledger = invoice.ledgerId
    ? await firstRow('SELECT address, state, pinCode, country, gstin, pan FROM AccountLedgers WHERE id = ?', [
        invoice.ledgerId,
      ])
    : null;
  const partyBranch = invoice.partyBranchId
    ? await firstRow(
        'SELECT address1, address2, city, state, pinCode, country, gstin FROM PartyBranches WHERE id = ?',
        [invoice.partyBranchId],
      )
    : null;
  const gstin = invoice.gstin || (partyBranch && partyBranch.gstin) || (ledger && ledger.gstin) || '';
  const gstinBranch =
    !partyBranch && gstin
      ? await firstRow(
          'SELECT address1, address2, city, state, pinCode, country FROM PartyBranches WHERE upper(trim(gstin)) = ? OR upper(trim(regNo)) = ? ORDER BY id LIMIT 1',
          [gstin.toUpperCase(), gstin.toUpperCase()],
        )
      : null;
  const ledgerFits =
    ledger && (!gstin || !ledger.gstin || String(ledger.gstin).trim().toUpperCase() === gstin.toUpperCase());
  const stateCode = String(invoice.stateCode || gstin.slice(0, 2) || '').padStart(2, '0');
  const ledgerAddress = ledgerFits
    ? [ledger.address, ledger.pinCode, ledger.state, ledger.country === 'IN' ? 'INDIA' : ledger.country]
        .filter(Boolean)
        .join(', ')
    : '';
  return {
    address: invoice.address || [partyBranch, gstinBranch].map(branchAddress).find(Boolean) || ledgerAddress,
    gstin,
    stateCode: /^\d\d$/.test(stateCode) && stateCode !== '00' ? stateCode : '',
    stateName: GST_STATES[stateCode] || (partyBranch && partyBranch.state) || (ledgerFits && ledger.state) || '',
    pan: (ledgerFits && ledger.pan) || (/^\d\d[A-Z]{5}\d{4}[A-Z]/.test(gstin) ? gstin.slice(2, 12) : ''),
  };
}

// SAC / GST rate of each charge name: GST Charges first, then the operations charges
async function sacOfCharges(lines) {
  const names = [
    ...new Set(
      lines
        .map((line) =>
          String(line.charge || '')
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean),
    ),
  ];
  const sac = {};
  if (!names.length) return sac;
  const placeholders = names.map(() => '?').join(',');
  for (const table of ['AccGstCharges', 'Charges']) {
    const rows = await selectRows(
      `SELECT upper(trim(chargeName)) n, sacCode, gstRate FROM ${table} WHERE upper(trim(chargeName)) IN (${placeholders}) AND coalesce(sacCode, '') <> ''`,
      names,
    ).catch(() => []);
    for (const row of rows) if (!sac[row.n]) sac[row.n] = { sac: row.sacCode, rate: toNumber(row.gstRate) };
  }
  return sac;
}

const docketKey = (docketNo) => String(docketNo).trim().toUpperCase();

async function docketsOfInvoice(invoice, lines) {
  const docketNos = [
    ...new Set(
      [invoice.jobNo, ...(invoice.dockets ? JSON.parse(invoice.dockets) : []), ...lines.map((line) => line.jobNo)]
        .map((docket) =>
          String(docket || '')
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean),
    ),
  ];
  const dockets = {};
  if (!docketNos.length) return dockets;
  const shipments = await selectRows(
    `SELECT * FROM Shipments WHERE upper(trim(docketNo)) IN (${docketNos.map(() => '?').join(',')})`,
    docketNos,
  ).catch(() => []);
  for (const shipment of shipments) dockets[docketKey(shipment.docketNo)] = shipmentDocketView(shipment);
  const left = docketNos.filter((docketNo) => !dockets[docketNo]);
  if (
    !left.length ||
    !(await selectRows("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'IcaffeDockets'")).length
  ) {
    return dockets;
  }
  const icaffeDockets = await selectRows(
    `SELECT docketNo, data FROM IcaffeDockets WHERE upper(trim(docketNo)) IN (${left.map(() => '?').join(',')})`,
    left,
  ).catch(() => []);
  for (const docket of icaffeDockets) {
    try {
      dockets[docketKey(docket.docketNo)] = icaffeDocketView(JSON.parse(docket.data));
    } catch {
      // a row that cannot be read is left out
    }
  }
  return dockets;
}

export async function printData(id) {
  const invoice = (
    await selectRows(
      'SELECT id, branchCode, ledgerId, partyBranchId, gstin, stateCode, address, jobNo, dockets, linesJson, kind FROM AccSalesInvoices WHERE id = ?',
      [id],
    )
  )[0];
  if (!invoice) throw invoiceNotFound();
  const head = await companyHead();
  const branch =
    (await firstRow(
      'SELECT branchCode, branchName, address, gstin, stateCode, phone, email FROM CompanyBranches WHERE branchCode = ? OR icaffeCode = ? LIMIT 1',
      [invoice.branchCode || '', invoice.branchCode || ''],
    )) || null;
  applyBillingBranch(head, branch);
  head.stateCode = String(head.gstin || '').slice(0, 2);
  head.stateName = GST_STATES[head.stateCode] || '';
  head.branchName = branch ? branch.branchName : '';
  const party = await partyOfInvoice(invoice);
  const lines = parseJsonList(invoice.linesJson);
  const sac = await sacOfCharges(lines);
  const dockets = await docketsOfInvoice(invoice, lines);
  return {
    head,
    party,
    sac,
    dockets,
  };
}

/** QR for the print: the signed QR from the IRP when there is one, else the IRN. */
export async function invoiceQr(id) {
  const invoice = (await selectRows('SELECT signedQr, irn FROM AccSalesInvoices WHERE id = ?', [id]))[0];
  if (!invoice || !(invoice.signedQr || invoice.irn)) return { dataUrl: '' };
  return { dataUrl: await QRCode.toDataURL(invoice.signedQr || invoice.irn, QR_OPTIONS) };
}
