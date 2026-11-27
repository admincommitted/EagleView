// Bulk Invoice as iCAFFE does it: tick Bulk Invoice -> the party must be chosen -> the "Bulk invoice" popup (From / To
// date, Search) lists the dockets whose shipper / importer is this party -> tick dockets -> Ok pulls each docket's cost
// sheet into the charge grid, docket-wise; a charge already in the grid for that docket is not added twice.
import { badRequest, ensureInvoiceTables, parseJsonList, selectRows, todayIso, toNumber } from '../shared/invoiceDb.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_FROM_DATE = '2000-01-01';
const DEFAULT_GST_RATE = 18;

const upperKey = (value) => String(value).toUpperCase();
const day = (value) => (value ? String(value).slice(0, 10) : '');
const directionOf = (division) => (/I$/.test(division) ? 'Import' : 'Export');

/** dd/mm/yyyy from the screen -> yyyy-mm-dd (other values: their first 10 characters). */
const isoFromDmy = (value) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || '').trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : String(value || '').slice(0, 10);
};

/** Invoice numbers each job / docket has been billed on (credit notes and void bills left out). */
async function billedJobs() {
  const billed = new Map();
  const invoices = await selectRows(
    "SELECT invoiceNo, jobNo, dockets, linesJson FROM AccSalesInvoices WHERE coalesce(status, '') <> 'Void' AND kind <> 'creditnote'",
  );
  for (const invoice of invoices) {
    const jobs = new Set(
      [
        invoice.jobNo,
        ...(invoice.dockets ? JSON.parse(invoice.dockets) : []),
        ...parseJsonList(invoice.linesJson).map((line) => line.jobNo),
      ]
        .filter(Boolean)
        .map(upperKey),
    );
    for (const job of jobs) billed.set(job, [...(billed.get(job) || []), invoice.invoiceNo]);
  }
  return billed;
}

function jobFilter(dateColumn, partyColumn, { from, to, search, party }) {
  const conditions = [`date(${dateColumn}) >= date(?)`, `date(${dateColumn}) <= date(?)`];
  const values = [from, to];
  if (search) {
    conditions.push('upper(jobNo) LIKE ?');
    values.push('%' + search.toUpperCase() + '%');
  }
  if (party) {
    conditions.push(`upper(${partyColumn}) LIKE ?`);
    values.push('%' + party.toUpperCase() + '%');
  }
  return [conditions.join(' AND '), values];
}

/** Dockets (Shipments) and customs jobs to put on one invoice, each with the invoices it is already on. */
export async function jobsForBulkInvoice(query) {
  await ensureInvoiceTables();
  const filter = {
    search: String(query.q || '').trim(),
    party: String(query.party || '').trim(),
    from: query.from || DEFAULT_FROM_DATE,
    to: query.to || todayIso(),
  };
  const [exportWhere, exportValues] = jobFilter('jobDate', 'shipperName', filter);
  const [importWhere, importValues] = jobFilter('jobDate', 'nameOfImporter', filter);
  const exportJobs = await selectRows(
    `SELECT jobNo, jobDate, mawbNo, hawbNo, shipperName party, 'Export' dir, shipmentMode mode FROM ExportJobs WHERE ${exportWhere}
      ORDER BY jobDate DESC LIMIT 200`,
    exportValues,
  ).catch(() => []);
  const importJobs = await selectRows(
    `SELECT jobNo, jobDate, coalesce(mawbNo, mawbblNo) mawbNo, coalesce(hawbNo, hawbhblNo) hawbNo, nameOfImporter party, 'Import' dir,
      shipmentMode mode FROM ImportJobs WHERE ${importWhere} ORDER BY jobDate DESC LIMIT 200`,
    importValues,
  ).catch(() => []);
  const [shipmentWhere, shipmentValues] = jobFilter('docketDate', 'mainParty', filter);
  const shipments = await selectRows(
    `SELECT docketNo jobNo, docketDate jobDate, mawbNo, hawbNo, mainParty party, division FROM Shipments
      WHERE coalesce(stage, '') <> 'Cancelled' AND ${shipmentWhere.replace(/upper\(jobNo\)/, 'upper(docketNo)')}
      ORDER BY docketDate DESC LIMIT 300`,
    shipmentValues,
  ).catch(() => []);
  exportJobs.unshift(
    ...shipments.map((job) => ({
      ...job,
      dir: directionOf(job.division),
      mode: /^A/.test(job.division) ? 'AIR' : 'SEA',
    })),
  );
  const billed = await billedJobs();
  return [...exportJobs, ...importJobs]
    .filter((job) => job.jobNo)
    .map((job) => ({ ...job, jobDate: day(job.jobDate), billedOn: billed.get(upperKey(job.jobNo)) || [] }))
    .sort((first, second) => String(second.jobDate).localeCompare(String(first.jobDate)));
}

async function docketRowsOfParty({ partyName, partyId, from, to }) {
  const partyKey = partyName.toUpperCase();
  const shipments = await selectRows(
    `SELECT id shipmentId, docketNo, docketDate, division, mainParty party, mawbNo, hawbNo FROM Shipments
      WHERE coalesce(stage, '') <> 'Cancelled' AND date(docketDate) BETWEEN date(?) AND date(?)
      AND (upper(trim(mainParty)) = ?${partyId ? ' OR mainPartyId = ?' : ''}) ORDER BY docketDate, docketNo`,
    [from, to, partyKey, ...(partyId ? [partyId] : [])],
  ).catch(() => []);
  const exportJobs = await selectRows(
    `SELECT id shipmentId, jobNo docketNo, jobDate docketDate, shipmentMode mode, shipperName party, mawbNo, hawbNo FROM ExportJobs
      WHERE date(jobDate) BETWEEN date(?) AND date(?) AND upper(trim(shipperName)) = ? ORDER BY jobDate, jobNo`,
    [from, to, partyKey],
  ).catch(() => []);
  const importJobs = await selectRows(
    `SELECT id shipmentId, jobNo docketNo, jobDate docketDate, shipmentMode mode, nameOfImporter party, coalesce(mawbNo, mawbblNo) mawbNo,
      coalesce(hawbNo, hawbhblNo) hawbNo FROM ImportJobs
      WHERE date(jobDate) BETWEEN date(?) AND date(?) AND upper(trim(nameOfImporter)) = ? ORDER BY jobDate, jobNo`,
    [from, to, partyKey],
  ).catch(() => []);
  return { shipments, exportJobs, importJobs };
}

/** iCAFFE SearchDocketList: the party's dockets in the period, each with its cost sheet flag and the bills it is on. */
export async function bulkDockets(query) {
  await ensureInvoiceTables();
  const partyName = String(query.party || '').trim();
  const partyId = Number(query.partyId) || null;
  const from = isoFromDmy(query.from);
  const to = isoFromDmy(query.to);
  if (!partyName || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    throw badRequest('Please fill in all required fields: Party, From Date, and To Date.');
  }
  const { shipments, exportJobs, importJobs } = await docketRowsOfParty({
    partyName,
    partyId,
    from,
    to,
  });
  // a customs job that has its own freight docket is listed once, as the docket
  const linkedJobs = new Set(
    (
      await selectRows("SELECT upper(ediJobNo) j FROM Shipments WHERE coalesce(ediJobNo, '') <> ''").catch(() => [])
    ).map((row) => row.j),
  );
  const notLinked = (row) => !linkedJobs.has(upperKey(row.docketNo));
  const rows = [
    ...shipments.map((row) => ({
      ...row,
      dir: directionOf(row.division),
      mode: /^A/.test(row.division) ? 'Air' : 'Sea',
      src: 'Docket',
    })),
    ...exportJobs.filter(notLinked).map((row) => ({ ...row, dir: 'Export', src: 'Customs job' })),
    ...importJobs.filter(notLinked).map((row) => ({ ...row, dir: 'Import', src: 'Customs job' })),
  ].filter((row) => row.docketNo);
  const costSheets = new Set(
    (await selectRows('SELECT upper(jobNo) j FROM AccProvisionalSheets').catch(() => [])).map((row) => row.j),
  );
  const billed = await billedJobs();
  return rows.map((row) => ({
    ...row,
    docketDate: String(row.docketDate || '').slice(0, 10),
    costSheet: costSheets.has(upperKey(row.docketNo)),
    billedOn: billed.get(upperKey(row.docketNo)) || [],
  }));
}

function costSheetLine(docketNo, line, chargeMaster) {
  const master = chargeMaster.get(upperKey(line.charge)) || {};
  let gstRate = DEFAULT_GST_RATE;
  if (line.gstRate != null && line.gstRate !== '') gstRate = toNumber(line.gstRate);
  else if (master.gstRate != null) gstRate = toNumber(master.gstRate);
  return {
    jobNo: docketNo,
    charge: upperKey(line.charge),
    sac: line.sac || master.sacCode || '',
    gstRate,
    currency: line.currency || 'INR',
    exRate: toNumber(line.exRate) || 1,
    qty: toNumber(line.qty) || 1,
    rate: toNumber(line.sellRate),
    unit: line.basis || '',
  };
}

/** The saved Provisional Cost Sheet (sell side) of each ticked docket, in the order ticked. */
export async function bulkCostSheets(body) {
  await ensureInvoiceTables();
  const requested = (body || {}).dockets;
  const dockets = (Array.isArray(requested) ? requested : [])
    .map((docket) =>
      String(docket || '')
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean);
  if (!dockets.length) throw badRequest('No docket records selected.');
  const chargeMaster = new Map(
    (await selectRows('SELECT chargeName, sacCode, gstRate FROM AccGstCharges').catch(() => [])).map((charge) => [
      upperKey(charge.chargeName),
      charge,
    ]),
  );
  const sheets = [];
  for (const docketNo of dockets) {
    const sheet = (
      await selectRows('SELECT linesJson FROM AccProvisionalSheets WHERE upper(jobNo) = ?', [docketNo])
    )[0];
    const lines = (sheet ? parseJsonList(sheet.linesJson) : [])
      .filter((line) => toNumber(line.sellRate) !== 0)
      .map((line) => costSheetLine(docketNo, line, chargeMaster));
    sheets.push({ docketNo, hasSheet: !!sheet, lines });
  }
  return sheets;
}

/** iCAFFE warns "<kind> Invoice already generated for this party and docket no." when the docket is entered. */
export async function existingInvoicesForDocket(query) {
  await ensureInvoiceTables();
  const kind = String(query.kind || '');
  const party = String(query.party || '')
    .trim()
    .toUpperCase();
  const jobNo = String(query.jobNo || '')
    .trim()
    .toUpperCase();
  const exceptId = Number(query.not) || 0;
  if (!kind || !party || !jobNo) return [];
  const rows = await selectRows(
    `SELECT id, invoiceNo, date, jobNo, dockets FROM AccSalesInvoices WHERE kind = ? AND coalesce(status, '') <> 'Void'
      AND upper(trim(partyName)) = ? AND id <> ? AND (upper(jobNo) = ? OR dockets LIKE ? OR linesJson LIKE ?)`,
    [kind, party, exceptId, jobNo, '%"' + jobNo + '"%', '%"jobNo":"' + jobNo + '"%'],
  );
  return rows.map((row) => ({ id: row.id, invoiceNo: row.invoiceNo, date: row.date }));
}
