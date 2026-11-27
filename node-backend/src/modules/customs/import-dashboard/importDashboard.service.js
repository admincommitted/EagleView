import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { ImportFinalDoc, Party } from '../../../models/index.js';

const DAY_MS = 86400000;
const HOUR_MS = 3600000;
const TABLE_COLUMNS_CACHE_MS = 10 * 60 * 1000;
const TRACKED_JOBS = 3000;
const RECENT_JOBS_SHOWN = 60;
const RISK_JOBS_SHOWN = 10;
const ACTIVITY_SHOWN = 8;
const RISK = { RED: '#ef4444', AMBER: '#f59e0b' };
const DASHBOARD_FIELDS = [
  'id',
  'jobNo',
  'status',
  'icegateStatus',
  'icegateUniqueId',
  'jobDate',
  'createdAt',
  'updatedAt',
  'shipmentMode',
  'boeType',
  'autoField_4',
  'nameOfImporter',
  'autoField_5',
  'iecCode',
  'importerPartyId',
  'beNo',
  'beDate',
  'mawbNo',
  'hawbNo',
  'igmNumber',
  'igmNo',
  'inwardDate',
  'autoField_17',
  '_igmRows',
];
const NOT_FROM_JSON = new Set(['id', 'createdAt', 'updatedAt']);

const upper = (value) =>
  String(value || '')
    .trim()
    .toUpperCase();

const isoDay = (value) => {
  const text = String(value || '').trim();
  let match = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(text);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return '';
};
const dayStartMs = (value) => {
  const day = isoDay(value);
  return day ? new Date(`${day}T00:00:00`).getTime() : NaN;
};
const jsonRows = (value) => {
  let rows = value;
  if (typeof rows === 'string') {
    try {
      rows = JSON.parse(rows);
    } catch {
      rows = [];
    }
  }
  return Array.isArray(rows) ? rows : [];
};

/**
 * Stage of a job from what really happened to it:
 *   OOC    - OOC copy / gate pass received, or status OOC
 *   QUERY  - status QUERY_RAISED / QUERY_REPLIED (or ICEGATE status says query)
 *   FILED  - sent to ICEGATE or BE No received, OOC not yet
 *   DRAFT  - not sent yet
 */
function stageOf(job, docs) {
  const status = upper(job.status);
  const icegateStatus = upper(job.icegateStatus);
  if (status === 'CANCELLED' || status === 'VOID') return 'CANCELLED';
  if (
    status === 'OOC' ||
    status === 'DELIVERED' ||
    docs.some((doc) => ['OOC_COPY', 'GATEPASS'].includes(upper(doc.docType)))
  )
    return 'OOC';
  if (['QUERY_RAISED', 'QUERY_REPLIED', 'QUERY'].includes(status) || icegateStatus.includes('QUERY')) return 'QUERY';
  if (
    job.beNo ||
    ['FILED', 'AMENDED', 'SUBMITTED', 'SENT'].includes(icegateStatus) ||
    ['PENDING', 'SUBMITTED', 'FILED', 'ASSESSMENT', 'ASSESSED', 'DUTY_PAID'].includes(status)
  )
    return 'FILED';
  return 'DRAFT';
}

let jobColumnsCache = null;

async function importJobColumns() {
  if (!jobColumnsCache || Date.now() - jobColumnsCache.at > TABLE_COLUMNS_CACHE_MS) {
    const columns = await sequelize.query('PRAGMA table_info(ImportJobs)', { type: QueryTypes.SELECT });
    jobColumnsCache = { at: Date.now(), set: new Set(columns.map((column) => column.name)) };
  }
  return jobColumnsCache.set;
}

const toIso = (value) => {
  if (!value) return value;
  const date = new Date(String(value).replace(' ', 'T').replace(' +00:00', 'Z'));
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
};

// plain SQL with only the fields used here (a full findAll of thousands of jobs held up every other request); the
// same rule as unpackExtra: the column, else the value kept in extendedData. Amended-job copies (AMD/...) are left out.
async function slimJobs(limit) {
  const columns = await importJobColumns();
  const hasExtendedData = columns.has('extendedData');
  const fromJson = (key) => `CASE WHEN json_valid(extendedData) THEN json_extract(extendedData, '$.${key}') END`;
  const fieldSql = (key) => {
    if (columns.has(key))
      return hasExtendedData && !NOT_FROM_JSON.has(key) ? `coalesce("${key}", ${fromJson(key)})` : `"${key}"`;
    return hasExtendedData ? fromJson(key) : 'NULL';
  };
  const rows = await sequelize.query(
    `SELECT ${DASHBOARD_FIELDS.map((key) => `${fieldSql(key)} AS "${key}"`).join(', ')} FROM ImportJobs WHERE coalesce(jobNo, '') NOT LIKE 'AMD/%' ORDER BY id DESC LIMIT ?`,
    { replacements: [limit], type: QueryTypes.SELECT },
  );
  for (const row of rows) {
    row.createdAt = toIso(row.createdAt);
    row.updatedAt = toIso(row.updatedAt);
  }
  return rows;
}

async function finalDocsOf(jobs) {
  try {
    const beNumbers = [
      ...new Set(
        jobs
          .map((job) => job.beNo)
          .filter(Boolean)
          .map(String),
      ),
    ];
    if (beNumbers.length) return await ImportFinalDoc.findAll({ where: { beNo: { [Op.in]: beNumbers } } });
  } catch {
    // final docs table not there yet
  }
  return [];
}

// importer phone for the WhatsApp button
async function importerPhones(jobs) {
  const phones = {};
  try {
    const partyIds = [...new Set(jobs.map((job) => job.importerPartyId).filter(Boolean))];
    if (partyIds.length) {
      for (const party of await Party.findAll({ where: { id: partyIds }, attributes: ['id', 'phoneNumber'] })) {
        phones[String(party.id)] = party.phoneNumber || '';
      }
    }
  } catch {
    // no party table
  }
  return phones;
}

function dashboardJob(job, finalDocs, phones) {
  const docs = finalDocs.filter((doc) => String(doc.beNo) === String(job.beNo || ''));
  const igm = jsonRows(job._igmRows)[0] || {};
  const oocCopy = docs.find((doc) => upper(doc.docType) === 'OOC_COPY');
  return {
    id: job.id,
    jobNo: job.jobNo || null,
    status: job.status || 'DRAFT',
    icegateStatus: job.icegateStatus || '',
    icegateUniqueId: job.icegateUniqueId || '',
    macroStatus: stageOf(job, docs),
    jobDate: isoDay(job.jobDate) || isoDay(job.createdAt && new Date(job.createdAt).toISOString()),
    mode: job.shipmentMode || 'AIR',
    boeType: job.boeType || '',
    importerName: job.autoField_4 || job.nameOfImporter || '',
    iec: job.autoField_5 || job.iecCode || '',
    importerPhone: phones[String(job.importerPartyId)] || '',
    beNo: job.beNo || null,
    beDate: isoDay(job.beDate) || null,
    mawbNo: job.mawbNo || igm.mawbNo || '',
    hawbNo: job.hawbNo || igm.hawbNo || '',
    igmNo: job.igmNumber || job.igmNo || igm.igmNumber || '',
    inwardDate: isoDay(job.inwardDate || job.autoField_17 || igm.inwardDate) || null,
    oocAt: oocCopy ? oocCopy.createdAt : null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

// total = every import job (the stages are counted on the newest jobs only)
async function countAllJobs(shownCount) {
  try {
    const rows = await sequelize.query(
      "SELECT count(*) AS n FROM ImportJobs WHERE coalesce(jobNo, '') NOT LIKE 'AMD/%'",
      { type: QueryTypes.SELECT },
    );
    return Number(rows[0] && rows[0].n) || shownCount;
  } catch {
    return shownCount;
  }
}

const SUMMARY_KEY_BY_STAGE = { DRAFT: 'draft', FILED: 'submitted', QUERY: 'query_raised', OOC: 'ooc' };

function stageSummary(jobs, total) {
  const summary = { draft: 0, submitted: 0, query_raised: 0, ooc: 0, total };
  for (const job of jobs) {
    if (Object.hasOwn(SUMMARY_KEY_BY_STAGE, job.macroStatus)) summary[SUMMARY_KEY_BY_STAGE[job.macroStatus]]++;
  }
  return summary;
}

// average TAT (hours) of the OOCs received today: job created -> OOC copy
function averageTatToday(jobs, today) {
  const hours = jobs
    .filter((job) => job.oocAt && new Date(job.oocAt).toISOString().slice(0, 10) === today)
    .map((job) => (new Date(job.oocAt).getTime() - new Date(job.createdAt).getTime()) / HOUR_MS)
    .filter((tat) => tat >= 0);
  const average = hours.length ? Math.round((hours.reduce((sum, tat) => sum + tat, 0) / hours.length) * 10) / 10 : 0;
  return { averageTat: average, tatCount: hours.length };
}

const modeLabel = (mode) => {
  if (upper(mode) === 'SEA') return 'SEA';
  if (upper(mode) === 'LAND') return 'LAND';
  return 'AIR';
};

/**
 * Risk radar: no BE after the arrival (inward) date (late presentation charges), query open 2+ days, BE filed but no
 * OOC after 3 days (demurrage), draft untouched 5+ days.
 */
function riskOf(job, now) {
  const age = Math.floor((now - new Date(job.createdAt).getTime()) / DAY_MS);
  const quietDays = Math.floor((now - new Date(job.updatedAt || job.createdAt).getTime()) / DAY_MS);
  const inward = dayStartMs(job.inwardDate);
  const daysAfterArrival = Number.isNaN(inward) ? null : Math.floor((now - inward) / DAY_MS);
  const daysSinceBe = () => Math.floor((now - dayStartMs(job.beDate)) / DAY_MS);
  if (
    !job.beNo &&
    daysAfterArrival !== null &&
    daysAfterArrival >= 1 &&
    job.macroStatus !== 'OOC' &&
    upper(job.boeType) !== 'EX_BOND'
  ) {
    return {
      rank: 3,
      color: RISK.RED,
      riskType: `No BE ${daysAfterArrival} day(s) after arrival - late presentation charges`,
    };
  }
  if (job.macroStatus === 'QUERY' && quietDays >= 2)
    return { rank: 2, color: RISK.RED, riskType: `Query open for ${quietDays} day(s)` };
  if (job.macroStatus === 'FILED' && job.beNo && job.beDate && daysSinceBe() >= 3) {
    return {
      rank: 1,
      color: RISK.AMBER,
      riskType: `BE ${job.beNo} filed ${daysSinceBe()} days ago - no OOC yet (demurrage)`,
    };
  }
  if (job.macroStatus === 'DRAFT' && age >= 5 && quietDays >= 5)
    return { rank: 0, color: RISK.AMBER, riskType: `Draft untouched for ${quietDays} days` };
  return null;
}

function riskJobsOf(jobs, now) {
  const riskJobs = [];
  for (const job of jobs) {
    if (job.macroStatus === 'CANCELLED') continue;
    const risk = riskOf(job, now);
    if (risk) riskJobs.push({ id: job.id, jobNo: job.jobNo || 'NO-JOB-NO', mode: modeLabel(job.mode), job, ...risk });
  }
  return riskJobs.sort((a, b) => b.rank - a.rank);
}

function activityText(job) {
  if (job.macroStatus === 'CANCELLED') return 'Job cancelled';
  if (job.macroStatus === 'OOC') return 'Out of charge (OOC copy received)';
  if (job.macroStatus === 'QUERY') return 'Customs query raised';
  if (job.beNo) return `BE ${job.beNo} received`;
  if (job.icegateUniqueId) return `Sent to ICEGATE (${job.icegateUniqueId})`;
  return String(job.updatedAt) !== String(job.createdAt) ? 'Draft updated' : 'Job created';
}

// recent activity: newest change first
const recentActivity = (jobs) =>
  jobs
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, ACTIVITY_SHOWN)
    .map((job) => ({ id: job.id, jobNo: job.jobNo, at: job.oocAt || job.updatedAt, text: activityText(job) }));

/** Import dashboard (0. Dashboard tab): stage counts, TAT, risk radar and activity of the newest jobs. */
export async function importLiveTracking() {
  const slim = await slimJobs(TRACKED_JOBS);
  const finalDocs = await finalDocsOf(slim);
  const phones = await importerPhones(slim);
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const jobs = slim.map((job) => dashboardJob(job, finalDocs, phones));
  const summary = stageSummary(jobs, await countAllJobs(jobs.length));
  const { averageTat, tatCount } = averageTatToday(jobs, today);
  const riskJobs = riskJobsOf(jobs, now);
  return {
    success: true,
    summary,
    recentJobs: jobs.slice(0, RECENT_JOBS_SHOWN),
    riskJobs: riskJobs.slice(0, RISK_JOBS_SHOWN),
    averageTat,
    tatCount,
    activity: recentActivity(jobs),
  };
}
