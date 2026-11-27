import { selectRows, selectRowsOrEmpty, sqlPlaceholders } from '../shared/hubQuery.service.js';

// Job details for the registers: MAWB / HAWB / SB-BE no, branch and division from the export / import jobs and the
// freight dockets of Shipment Registration (matched on the job no).
const DIVISIONS = {
  AE: 'Export Air',
  AI: 'Import Air',
  SE: 'Export Sea',
  SI: 'Import Sea',
  CE: 'Customs Export',
  CI: 'Customs Import',
  CC: 'Custom Clearance',
  TR: 'Transport',
  CO: 'Courier',
};
const DIVISION_IN_JOB_NO = /(?:^|[/-])(AE|AI|SE|SI|CE|CI|CC|TR|CO)(?=[/-]|$)/;

export const divisionOfJob = (jobNo) => {
  const match = String(jobNo || '')
    .toUpperCase()
    .match(DIVISION_IN_JOB_NO);
  return match ? DIVISIONS[match[1]] : '';
};

export const jobKey = (jobNo) =>
  String(jobNo || '')
    .toUpperCase()
    .trim();

const dateOnly = (value) => (value ? String(value).slice(0, 10) : '');

/** Map jobKey -> { jobDate, mawb, hawb, sbBe, sbBeDate, branch, mode, party, marketingPerson } */
export async function loadJobDetails(jobNos) {
  const keys = [...new Set((jobNos || []).map(jobKey).filter(Boolean))];
  const details = new Map();
  if (!keys.length) return details;
  const marks = sqlPlaceholders(keys);
  const exportJobs = await selectRowsOrEmpty(
    `SELECT jobNo, jobDate, mawbNo, hawbNo, coalesce(sbNo, sbNumber) sbBe, sbDate beDate, branchCode, shipmentMode mode, shipperName party FROM ExportJobs WHERE upper(trim(jobNo)) IN (${marks})`,
    keys,
  );
  const importJobs = await selectRowsOrEmpty(
    `SELECT jobNo, jobDate, coalesce(mawbNo, mawbblNo) mawbNo, coalesce(hawbNo, hawbhblNo) hawbNo, coalesce(beNo, beNumber) sbBe, beDate, branchCode, coalesce(modeOfTransport, shipmentMode) mode, nameOfImporter party FROM ImportJobs WHERE upper(trim(jobNo)) IN (${marks})`,
    keys,
  );
  const dockets = await selectRowsOrEmpty(
    `SELECT docketNo jobNo, docketDate jobDate, mawbNo, hawbNo, ediJobNo sbBe, NULL beDate, branchCode, CASE WHEN division LIKE 'A%' THEN 'AIR' ELSE 'SEA' END mode, mainParty party, marketingPerson FROM Shipments WHERE upper(trim(docketNo)) IN (${marks})`,
    keys,
  );
  for (const job of [...exportJobs, ...importJobs, ...dockets]) {
    details.set(jobKey(job.jobNo), {
      jobDate: dateOnly(job.jobDate),
      mawb: job.mawbNo || '',
      hawb: job.hawbNo || '',
      sbBe: job.sbBe || '',
      sbBeDate: dateOnly(job.beDate),
      branch: job.branchCode || '',
      mode: job.mode || '',
      party: job.party || '',
      marketingPerson: job.marketingPerson || '',
    });
  }
  return details;
}

/** The job columns every register shows. */
export const jobColumns = (job, jobNo) => ({
  mawb: (job && job.mawb) || '',
  hawb: (job && job.hawb) || '',
  sbBe: (job && job.sbBe) || '',
  jobType: (job && job.mode) || '',
  division: divisionOfJob(jobNo),
  jobDate: (job && job.jobDate) || '',
});

const personKey = (name) =>
  String(name || '')
    .toUpperCase()
    .replace(/\b(MR|MRS|MS|DR)\.?\s+/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

/**
 * Sales person of a bill: the docket's marketing person (as its sales person when the name is matched), else the KAM
 * of the customer billed (Sales module: SalesCustomers / SalesCustomerLedgers). Answers (job, ledgerId) -> name.
 */
export async function salesPersonLookup() {
  try {
    const persons = await selectRows('SELECT id, name, aliases FROM SalesPersons');
    const nameByKey = new Map();
    for (const person of persons) {
      nameByKey.set(personKey(person.name), person.name);
      String(person.aliases || '')
        .split(',')
        .forEach((alias) => {
          if (alias.trim()) nameByKey.set(personKey(alias), person.name);
        });
    }
    const kamByLedger = new Map();
    const kamRows =
      await selectRows(`SELECT c.ledgerId lid, p.name FROM SalesCustomers c JOIN SalesPersons p ON p.id = c.kamId WHERE c.ledgerId IS NOT NULL
        UNION ALL SELECT cl.ledgerId, p.name FROM SalesCustomerLedgers cl JOIN SalesCustomers c ON c.id = cl.customerId JOIN SalesPersons p ON p.id = c.kamId`);
    for (const row of kamRows) kamByLedger.set(row.lid, row.name);
    return (job, ledgerId) => {
      const marketingPerson = job && job.marketingPerson;
      if (marketingPerson) return nameByKey.get(personKey(marketingPerson)) || marketingPerson;
      return kamByLedger.get(ledgerId) || '';
    };
  } catch {
    // no Sales tables yet
    return (job) => (job && job.marketingPerson) || '';
  }
}
