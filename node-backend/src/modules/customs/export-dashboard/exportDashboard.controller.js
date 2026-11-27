import { exportLiveTracking } from './exportDashboard.service.js';

export async function liveTracking(req, res) {
  const { branchId, financialYearId } = req.query;
  res.json(await exportLiveTracking({ branchId, financialYearId }));
}
