import { sequelize } from '../../../config/database.js';
import { isImportDivision } from './shipments.constants.js';
import { badRequest, docketNotFound } from './shipments.errors.js';
import { defaultBranch, nextDocket, today } from './shipments.series.js';
import { ensureShipmentTables, execute, selectRows } from './shipments.tables.js';

/**
 * A docket straight from a customs (EDI) job, as on iCAFFE: "Generate Docket No" on the Import BE / Export SB job makes
 * the docket of the right division from the job's data (parties, MAWB / HAWB, packages, weight, ports, IGM) and links
 * it (EDI Job No). One docket per job.
 */
const MAX_COPIED_TEXT = 500;
const COPIED_JOB_FIELDS = [
  'mainParty',
  'mainAddress',
  'otherParty',
  'mawbNo',
  'mawbDate',
  'hawbNo',
  'hawbDate',
  'igmNo',
  'igmDate',
  'originPort',
  'destinationPort',
  'dischargePort',
  'clearanceAt',
  'carrier',
  'flightVessel',
  'pkgs',
  'pkgUnit',
  'grossWeight',
  'chargeableWeight',
  'goodsDesc',
  'cha',
  'subAgent',
];

/** "20261105", "2026-11-05T..", "5/11/2026" -> "2026-11-05" ('' when not a date). */
export function dateToYmd(value) {
  const text = String(value || '').trim();
  if (/^\d{8}$/.test(text)) return text.slice(0, 4) + '-' + text.slice(4, 6) + '-' + text.slice(6, 8);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
}

/** The first filled value, trimmed ('' when none). */
const firstFilled = (...values) => {
  for (const value of values) if (value != null && String(value).trim() !== '') return String(value).trim();
  return '';
};
const portText = (code, name) => [firstFilled(code), firstFilled(name)].filter(Boolean).join(' - ');
const toNumber = (value) => {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

async function findCustomsJob(side, { jobId, jobNo }) {
  const table = side === 'Export' ? 'ExportJobs' : 'ImportJobs';
  const rows = jobId
    ? await selectRows(`SELECT * FROM ${table} WHERE id = ?`, [jobId])
    : await selectRows(`SELECT * FROM ${table} WHERE upper(trim(jobNo)) = upper(?)`, [String(jobNo || '').trim()]);
  return rows[0] || null;
}

function importDocketFields(job, isAir) {
  return {
    division: isAir ? 'AI' : 'SI',
    branchCode: firstFilled(job.branchCode),
    mainParty: firstFilled(job.nameOfImporter, job.autoField_4),
    mainAddress: [job.address1, job.address2, job.city, job.state, job.pin].filter(Boolean).join(', '),
    otherParty: firstFilled(job.supplierName),
    mawbNo: firstFilled(job.mawbNo, job.mawbblNo),
    mawbDate: dateToYmd(job.mawbDate),
    hawbNo: firstFilled(job.hawbNo, job.hawbhblNo),
    hawbDate: dateToYmd(job.hawbDate),
    igmNo: firstFilled(job.igmNumber, job.igmNo, job.gatewayIgmNo),
    igmDate: dateToYmd(firstFilled(job.igmDate, job.gatewayIgmDate)),
    originPort: portText(firstFilled(job.portOfOrigin, job.portOfShipment), job.portOfOriginName),
    destinationPort: firstFilled(job.portCode, job.customHouseCode, job.customsPort),
    clearanceAt: portText(firstFilled(job.portCode, job.customHouseCode), job.locationName),
    carrier: firstFilled(job.lineName),
    flightVessel: firstFilled(job.flightVoyage, job.vessel),
    pkgs: toNumber(firstFilled(job.totalNoOfPackages, job.totalPkg)) || null,
    pkgUnit: firstFilled(job.packageCode, job.pkg) || 'PKG',
    grossWeight: toNumber(firstFilled(job.grossWeight, job.grossWt)) || null,
    chargeableWeight: toNumber(job.chargableWeight) || null,
    goodsDesc: firstFilled(job.headDesc),
    cha: firstFilled(job.chaName),
    subAgent: firstFilled(job.subagentName),
    data: {
      inwardDate: dateToYmd(job.inwardDate),
      marks: [job.marksAndNumbers1, job.marksAndNumbers2, job.marksAndNumbers3].filter(Boolean).join(' '),
      grossUnit: firstFilled(job.grossWtUnit, job.unitOfMeasurement) || 'KGS',
    },
  };
}

function exportDocketFields(job, isAir) {
  return {
    division: isAir ? 'AE' : 'SE',
    branchCode: firstFilled(job.branchCode),
    mainParty: firstFilled(job.shipperName),
    mainAddress: [job.shipperAddress1, job.shipperAddress2, job.shipperCity, job.shipperState, job.shipperPin]
      .filter(Boolean)
      .join(', '),
    otherParty: firstFilled(job.consigneeName),
    mawbNo: firstFilled(job.mawbNo),
    mawbDate: dateToYmd(job.mawbDate),
    hawbNo: firstFilled(job.hawbNo),
    hawbDate: dateToYmd(job.hawbDate),
    originPort: portText(job.loadingPortCode, job.loadingPortName),
    destinationPort: portText(job.destPortCode, job.destPortName),
    dischargePort: portText(job.discPortCode, job.discPortName),
    clearanceAt: portText(job.customsPortCode, job.customsPortName),
    carrier: firstFilled(job.carrierName),
    pkgs: toNumber(job.totalPackages) || null,
    pkgUnit: firstFilled(job.pkgsUnit) || 'PKG',
    grossWeight: toNumber(job.grossWeight) || null,
    goodsDesc: firstFilled(job.headDesc),
    cha: firstFilled(job.chaName),
    subAgent: firstFilled(job.subAgentName),
    data: { grossUnit: 'KGS' },
  };
}

function docketFieldsFromJob(side, job) {
  const modeText = String(firstFilled(job.shipmentMode, job.modeOfTransport, job.trans)).toUpperCase();
  const isAir = /^A|AIR|COURIER/.test(modeText);
  const isLand = /^L|LAND|ROAD|RAIL/.test(modeText);
  if (isLand) throw badRequest('This is a land (ICD / road) job - Shipment Registration has Air and Sea dockets only');
  return side === 'Import' ? importDocketFields(job, isAir) : exportDocketFields(job, isAir);
}

/** Customs milestones (BE / SB, assessment, duty, OOC / LEO) -> Shipment Status of the docket. Returns how many. */
async function syncCustomsStatus(shipmentId, side, job, user, transaction) {
  const milestones =
    side === 'Import'
      ? [
          ['BE filed', job.beDate, job.beNo || job.beNumber],
          ['Assessment', job.assessmentDate],
          ['Duty paid', job.dutyPaidDate, job.challanNo],
          ['Out of charge', job.oocDate],
        ]
      : [
          ['SB filed', job.sbDate, job.sbNo || job.sbNumber],
          ['Let export order', job.leoDate],
        ];
  const now = new Date().toISOString();
  let synced = 0;
  for (const [title, date, reference] of milestones) {
    const eventDate = dateToYmd(date);
    if (!eventDate) continue;
    const remarks = reference ? 'From customs job: ' + reference : 'From customs job';
    const existing = (
      await selectRows(
        "SELECT id FROM ShipmentEvents WHERE shipmentId = ? AND kind = 'status' AND title = ?",
        [shipmentId, title],
        transaction,
      )
    )[0];
    if (existing) {
      await execute(
        'UPDATE ShipmentEvents SET eventDate = ?, remarks = ?, updatedAt = ? WHERE id = ?',
        [eventDate, remarks, now, existing.id],
        transaction,
      );
    } else {
      await execute(
        "INSERT INTO ShipmentEvents (shipmentId, kind, title, eventDate, remarks, createdBy, createdAt, updatedAt) VALUES (?, 'status', ?, ?, ?, ?, ?, ?)",
        [shipmentId, title, eventDate, remarks, user, now, now],
        transaction,
      );
    }
    synced++;
  }
  const latest = (
    await selectRows(
      "SELECT title FROM ShipmentEvents WHERE shipmentId = ? AND kind = 'status' ORDER BY eventDate DESC, id DESC LIMIT 1",
      [shipmentId],
      transaction,
    )
  )[0];
  if (latest)
    await execute('UPDATE Shipments SET currentStatus = ? WHERE id = ?', [latest.title, shipmentId], transaction);
  return synced;
}

/** GET /by-job?jobNo= - the live docket of a customs job (null when none). */
export async function docketOfJob(jobNo) {
  await ensureShipmentTables();
  const number = String(jobNo || '').trim();
  if (!number || /^draft$/i.test(number)) return null;
  const rows = await selectRows(
    "SELECT id, docketNo, division, stage, currentStatus FROM Shipments WHERE upper(trim(ediJobNo)) = upper(?) AND coalesce(stage, '') <> 'Cancelled' ORDER BY id LIMIT 1",
    [number],
  );
  return rows[0] || null;
}

async function assertJobCanBeRegistered(side, job) {
  if (!job)
    throw badRequest(
      'Save the ' + (side === 'Export' ? 'shipping bill' : 'BE') + ' job first - the docket is made from the saved job',
    );
  if (!job.jobNo || /^draft$/i.test(job.jobNo)) throw badRequest('Save the job first (it has no job no yet)');
}

/** iCAFFE: no shipment is registered for a job without an invoice. */
async function assertJobHasInvoice(side, job) {
  const sql =
    side === 'Export'
      ? 'SELECT count(*) n FROM ExportInvoices WHERE exportJobId = ?'
      : 'SELECT count(*) n FROM ImportInvoices WHERE importJobId = ?';
  const invoiceCount = (await selectRows(sql, [job.id]).catch(() => [{ n: 1 }]))[0].n;
  if (!Number(invoiceCount)) {
    throw badRequest(
      'There is no invoice in this job (' +
        job.jobNo +
        '). Kindly check the details - save the invoice first, then register the shipment',
    );
  }
}

function docketRowFromJob({ docketNo, fields, branch, date, job, user, now }) {
  const row = {
    docketNo,
    division: fields.division,
    branchCode: branch,
    docketDate: date,
    jobType: 'CC',
    shipmentType: 'Consol',
    houseType: fields.hawbNo ? 'House' : 'Master',
    cargoType: 'General',
    freightTerm: 'Prepaid',
    customsOnly: fields.mawbNo ? 0 : 1,
    stage: 'Register',
    ediJobNo: job.jobNo,
    remarks: 'Made from customs job ' + job.jobNo,
    createdBy: user,
    createdAt: now,
    updatedAt: now,
    containersJson: '[]',
    dimensionsJson: '[]',
    docsJson: '{}',
    dataJson: JSON.stringify(fields.data || {}),
  };
  for (const key of COPIED_JOB_FIELDS) {
    const value = fields[key];
    if (value != null && value !== '') row[key] = typeof value === 'string' ? value.slice(0, MAX_COPIED_TEXT) : value;
  }
  return row;
}

async function insertDocketFromJob({ side, job, fields, branch, user }) {
  const date = today();
  const transaction = await sequelize.transaction();
  try {
    const docketNo = await nextDocket(branch, fields.division, date, transaction, true);
    const now = new Date().toISOString();
    const row = docketRowFromJob({ docketNo, fields, branch, date, job, user, now });
    const keys = Object.keys(row);
    await execute(
      `INSERT INTO Shipments (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(',')})`,
      keys.map((key) => row[key]),
      transaction,
    );
    const id = (await selectRows('SELECT id FROM Shipments WHERE docketNo = ?', [docketNo], transaction))[0].id;
    await execute(
      "INSERT INTO ShipmentEvents (shipmentId, kind, title, eventDate, status, remarks, createdBy, createdAt, updatedAt) VALUES (?, 'activity', ?, ?, 'Done', ?, ?, ?, ?)",
      [id, 'Docket made from customs job', date, job.jobNo, user, now, now],
      transaction,
    );
    await syncCustomsStatus(id, side, job, user, transaction);
    await transaction.commit();
    return { id, docketNo };
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

/** POST /from-job { side, jobId | jobNo, branchCode } - "Change Branch" in the popup wins over the job's branch. */
export async function registerDocketFromJob(body, user) {
  await ensureShipmentTables();
  const side = body.side === 'Export' ? 'Export' : 'Import';
  const job = await findCustomsJob(side, body);
  await assertJobCanBeRegistered(side, job);
  const existing = (
    await selectRows(
      "SELECT id, docketNo, division FROM Shipments WHERE upper(trim(ediJobNo)) = upper(?) AND coalesce(stage, '') <> 'Cancelled' LIMIT 1",
      [job.jobNo],
    )
  )[0];
  if (existing) {
    return {
      ...existing,
      created: false,
      message: 'Shipment is already registered for job ' + job.jobNo + ' - Docket No. ' + existing.docketNo,
    };
  }
  await assertJobHasInvoice(side, job);
  const fields = docketFieldsFromJob(side, job);
  if (!fields.mainParty)
    throw badRequest(
      (side === 'Import' ? 'Importer' : 'Exporter') + ' name is empty on the job - fill it and save the job first',
    );
  const branch = String(body.branchCode || fields.branchCode || (await defaultBranch())).toUpperCase();
  const { id, docketNo } = await insertDocketFromJob({ side, job, fields, branch, user });
  return {
    id,
    docketNo,
    division: fields.division,
    created: true,
    message: 'Shipment registered successfully. Docket No. ' + docketNo + ' generated for job ' + job.jobNo,
  };
}

/** POST /:id/sync-customs - refresh the customs milestones of a docket from its EDI job. */
export async function syncDocketWithJob(shipmentId, user) {
  await ensureShipmentTables();
  const docket = (await selectRows('SELECT id, ediJobNo, division FROM Shipments WHERE id = ?', [shipmentId]))[0];
  if (!docket) throw docketNotFound();
  if (!docket.ediJobNo) throw badRequest('No EDI Job No on this docket');
  const side = isImportDivision(docket.division) ? 'Import' : 'Export';
  const job = await findCustomsJob(side, { jobNo: docket.ediJobNo });
  if (!job) throw badRequest('Customs job ' + docket.ediJobNo + ' not found in ' + side + ' jobs');
  return { ok: true, milestones: await syncCustomsStatus(docket.id, side, job, user) };
}
