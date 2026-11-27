import { Op } from 'sequelize';
import { Airwaybill, AwbLog, AwbRateLine, AwbStock, AwbTracking, HouseAWB } from '../../../../models/index.js';
import { buildInsights } from '../../../../utils/awb/awbInsights.js';
import { loadAwbRows } from '../shared/awbRows.js';
import { bareAwbNo, liveStatus } from '../shared/awbNumbers.js';
import { logUnexpectedError } from '../shared/errorLog.js';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 1000;

function pageOf(query) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  return { limit, offset };
}

/** ?status=VOID lists that status; otherwise the live records (VOID too with includeVoid). */
function statusWhereOf(query) {
  const statusFilter = query.status ? String(query.status).toUpperCase() : null;
  if (statusFilter) return { status: statusFilter };
  return query.includeVoid ? {} : { status: liveStatus() };
}

function kpisOf(rows) {
  const countStage = (stage) => rows.filter((row) => row.stage === stage).length;
  const kpi = {
    total: rows.length,
    savedNotSubmitted: countStage('SAVED'),
    submittedPendingRcs: countStage('SUBMITTED'),
    rejected: countStage('REJECTED'),
    readyForCarriage: countStage('READY_FOR_CARRIAGE'),
    departed: countStage('DEPARTED'),
    delivered: countStage('DELIVERED'),
  };
  // submitted / pending are read by other screens
  kpi.submitted = rows.filter((row) => row.submittedToAirline).length;
  kpi.pending = rows.filter((row) => !row.dep && !row.dlv).length;
  return kpi;
}

/** Airline-wise count of this month's airline AWBs (direct AWB + MAWB, not houses), most first. */
function airlinesThisMonthOf(mawbs) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const countByPrefix = {};
  mawbs
    .filter((master) => master.status !== 'VOID' && new Date(master.createdAt) >= monthStart)
    .forEach((master) => {
      const prefix = bareAwbNo(master.awbNumber).slice(0, 3);
      if (prefix) countByPrefix[prefix] = (countByPrefix[prefix] || 0) + 1;
    });
  return Object.entries(countByPrefix)
    .map(([prefix, count]) => ({ prefix, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Air Export dashboard: every record of the branch / year with its stage; the KPIs count all of them, the page is cut
 * after sorting and after the stage filter.
 */
export function listDashboardRows(query, { branchWhere, yearWhere }) {
  return logUnexpectedError(
    (error) => console.error('AWB list error:', error),
    async () => {
      const { limit, offset } = pageOf(query);
      const stageFilter = query.stage ? String(query.stage).toUpperCase() : null;
      const { rows, mawbs } = await loadAwbRows({ [Op.and]: [statusWhereOf(query), branchWhere, yearWhere] });
      const kpi = kpisOf(rows);
      const airlinesThisMonth = airlinesThisMonthOf(mawbs);
      const shown = stageFilter ? rows.filter((row) => row.stage === stageFilter) : rows;
      return {
        success: true,
        data: shown.slice(offset, offset + limit),
        total: shown.length,
        kpi,
        airlinesThisMonth,
      };
    },
  );
}

/** Air Export dashboard alerts and numbers of the branch. */
export function dashboardInsights(branchWhere) {
  return logUnexpectedError(
    (error) => console.error('AWB insights error:', error),
    async () => {
      const models = { Airwaybill, HouseAWB, AwbTracking, AwbRateLine, AwbLog, AwbStock };
      return { success: true, ...(await buildInsights(models, { scope: branchWhere })) };
    },
  );
}
