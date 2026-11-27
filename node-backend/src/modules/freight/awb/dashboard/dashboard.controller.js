import { fyWhere, where as branchWhereOf } from '../../../../utils/awb/awbBranch.js';
import * as dashboardService from './dashboard.service.js';

export async function listDashboardRows(req, res) {
  const scope = { branchWhere: await branchWhereOf(req), yearWhere: await fyWhere(req) };
  res.json(await dashboardService.listDashboardRows(req.query, scope));
}

export async function dashboardInsights(req, res) {
  res.json(await dashboardService.dashboardInsights(await branchWhereOf(req)));
}
