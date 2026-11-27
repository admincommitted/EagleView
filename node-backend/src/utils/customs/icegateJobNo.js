// ICEGATE job number of a BE / SB (headerField.jobNumber).
//
// ICEGATE wants a number, and keys a filing by custom house + job number + job date. Sending the database id would make
// ICEGATE mails / replies name a number nobody can find in EagleView, so the number is:
//   - the number stored at the job's first filing (icegateJobNo) - an amendment / re-check must keep it;
//   - else the job no itself when it is all digits (iCAFFE jobs: 7342 -> 7342);
//   - else the running number of the job no (DEL-AI-1002 -> 1002, NDL/AE/26/0045 -> 45).
// One number is used once per custom house in a financial year (April - March): checked against the other BE (or
// SB) jobs before a file is made, so the operator sees it before ICEGATE does.
import { Op } from '../../config/database.js';
import { ExportJob, ImportJob } from '../../models/index.js';
import { checkExchangeRates } from './exchangeRateCheck.js';

const MAX_CLASH_ROWS = 200;
const CUSTOM_HOUSE_CODE_LENGTH = 6;

const positiveInt = (v) => {
  const x = parseInt(String(v == null ? '' : v).trim(), 10);
  return Number.isFinite(x) && x > 0 ? x : 0;
};

// running number of a job no: all digits -> the number; else the last group of 3+ digits (the year part "26" of
// NDL/AE/26/0045 is skipped), else the last group of digits
function runningNo(jobNo) {
  const s = String(jobNo || '').trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return positiveInt(s);
  const digitGroups = s.match(/\d+/g) || [];
  const chosen = [...digitGroups].reverse().find((x) => x.length >= 3) || digitGroups[digitGroups.length - 1] || '';
  return positiveInt(chosen);
}

// the number a job goes to ICEGATE with
function icegateJobNoOf(job) {
  if (!job) return 0;
  return positiveInt(job.icegateJobNo) || runningNo(job.jobNo);
}

// financial year of a job date (yyyy-mm-dd / dd-mm-yyyy / Date): { code: '2026-27', from: '2026-04-01', to: '2027-03-31' }
function fyOfDate(d) {
  let y, m;
  if (d instanceof Date && !isNaN(d)) {
    y = d.getFullYear();
    m = d.getMonth() + 1;
  } else {
    const t = String(d || '').trim();
    let r = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    if (r) {
      y = +r[1];
      m = +r[2];
    } else if ((r = /^(\d{2})[-/](\d{2})[-/](\d{4})/.exec(t))) {
      y = +r[3];
      m = +r[2];
    } else if ((r = /^(\d{4})(\d{2})(\d{2})$/.exec(t))) {
      y = +r[1];
      m = +r[2];
    }
  }
  if (!y || !m || m < 1 || m > 12) return null;
  const start = m >= 4 ? y : y - 1;
  return {
    code: `${start}-${String((start + 1) % 100).padStart(2, '0')}`,
    from: `${start}-04-01`,
    to: `${start + 1}-03-31`,
  };
}

const dmy = (d) => {
  if (d instanceof Date && !isNaN(d))
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  const r = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return r ? `${r[3]}-${r[2]}-${r[1]}` : String(d || '');
};
const isAmendCopy = (job) => /^AMD\//i.test(String((job && job.jobNo) || ''));

// Look for another job of the same kind with the same ICEGATE job number, custom house and financial year.
// kind 'BE' (ImportJobs) or 'SB' (ExportJobs). screen = the job as on the screen (jobNo, jobDate, custom house, id).
// Returns { number, fy, house, clash: [{ id, jobNo, jobDate, by }] } - clash empty when the number is free.
async function findClash(kind, screen, number, house) {
  const out = { number, fy: null, house, clash: [] };
  if (!number) return out;
  const fy = fyOfDate(screen && screen.jobDate);
  out.fy = fy;
  if (!fy) return out;
  const isSb = kind === 'SB';
  const Model = isSb ? ExportJob : ImportJob;
  const houseColumns = isSb ? ['customsPortCode', 'customsPort'] : ['portCode', 'customHouseCode'];
  const attributes = ['id', 'jobNo', 'jobDate', ...houseColumns, ...(isSb ? [] : ['icegateJobNo', 'createdBy'])];
  const numberMatches = [
    { jobNo: String(number) },
    { jobNo: { [Op.like]: '%' + String(number) } },
    { jobNo: { [Op.like]: '%' + String(number) + '/%' } },
  ];
  if (!isSb) numberMatches.push({ icegateJobNo: number });
  const where = { jobDate: { [Op.between]: [fy.from, fy.to + ' 23:59:59'] }, [Op.or]: numberMatches };
  if (screen && screen.id) where.id = { [Op.ne]: screen.id };
  let rows = [];
  try {
    rows = await Model.findAll({ where, attributes, limit: MAX_CLASH_ROWS });
  } catch {
    return out;
  }
  const wantedHouse = String(house || '')
    .trim()
    .toUpperCase();
  for (const row of rows) {
    if (isAmendCopy(row)) continue; // an amendment copy shares its BE's number
    if (icegateJobNoOf(row) !== number) continue;
    const rowHouse = String(houseColumns.map((c) => row[c]).find((v) => v && String(v).trim()) || '')
      .trim()
      .toUpperCase()
      .slice(0, CUSTOM_HOUSE_CODE_LENGTH);
    if (wantedHouse && rowHouse && rowHouse !== wantedHouse) continue; // another custom house: ICEGATE keeps them apart
    out.clash.push({ id: row.id, jobNo: row.jobNo, jobDate: row.jobDate, by: row.createdBy || '' });
  }
  return out;
}

// For a BE route: take the stored ICEGATE number from the saved job (the screen copy may not carry it), so the file and
// the check use the number the BE was filed with. Returns the job row fields read (or {}).
async function withStoredNo(kind, jobData) {
  if (!jobData || !jobData.id || kind === 'SB') return {};
  try {
    const row = await ImportJob.findByPk(jobData.id, { attributes: ['id', 'icegateJobNo'] });
    if (row && row.icegateJobNo) jobData.icegateJobNo = row.icegateJobNo;
    return row ? row.get({ plain: true }) : {};
  } catch {
    return {};
  }
}

// Add the job-number checks to a validation result ({ ok, errors, warnings }) built for a file of this job.
// file = the CACHI01 / CACHE01 JSON (its headerField.jobNumber and receiver / custom house are what goes to ICEGATE).
async function checkJobNo(kind, validation, jobData, file) {
  if (!validation || !jobData) return validation;
  const header = (file && file.headerField) || {};
  const number = positiveInt(header.jobNumber);
  const W = 'Header';
  const documentName = kind === 'SB' ? 'Shipping Bill' : 'BE';
  // the job no must carry a number (DRAFT / letters only cannot go to ICEGATE)
  // (an unsaved job already gets "save the job first" from the file checks)
  if (jobData.id && !runningNo(jobData.jobNo) && !positiveInt(jobData.icegateJobNo)) {
    validation.errors.push(
      `${W}: Job No "${jobData.jobNo || ''}" has no number - ICEGATE needs a numeric job number. Save the job (it gets its number from Settings > Sequence Config)`,
    );
  }
  if (!fyOfDate(jobData.jobDate))
    validation.errors.push(
      `${W}: Job Date is blank or not a date - ICEGATE keys the ${documentName} by job number + job date`,
    );
  const house = String(
    header.receiverID ||
      jobData.portCode ||
      jobData.customHouseCode ||
      jobData.customsPortCode ||
      jobData.customsPort ||
      '',
  )
    .trim()
    .toUpperCase();
  if (number) {
    const result = await findClash(kind, jobData, number, house);
    if (result.clash.length) {
      const first = result.clash[0];
      const more = result.clash.length > 1 ? ` (and ${result.clash.length - 1} more)` : '';
      const msg = `${W}: ICEGATE job number ${number} is already used in FY ${result.fy.code}${house ? ' at ' + house : ''} by job ${first.jobNo} dated ${dmy(first.jobDate)}${first.by === 'iCAFFE' ? ' (iCAFFE)' : ''}${more}. One job number can be filed only once in a financial year - set the job number series of this branch beyond the numbers iCAFFE uses (Settings > Sequence Config, e.g. start 20001) and make the job again, or file this BE from the other job`;
      // a BE already filed with this number keeps it (its amendments / reply checks must use the same number)
      if (positiveInt(jobData.icegateJobNo) === number && jobData.icegateJobNo) {
        validation.warnings.push(
          msg.replace(/ One job number[\s\S]*$/, ' This job was filed with that number already, so it is kept.'),
        );
      } else {
        validation.errors.push(msg);
      }
    }
  }
  // BE exchange rates against the CBIC rate in force (warnings) - every BE route that checks the job number
  // (preview, file, sign, submit) gets this check too
  if (kind === 'BE') {
    try {
      await checkExchangeRates(validation, jobData, file);
    } catch {
      /* history not readable */
    }
  }
  validation.ok = validation.errors.length === 0;
  return validation;
}

export { runningNo, withStoredNo, checkJobNo };
