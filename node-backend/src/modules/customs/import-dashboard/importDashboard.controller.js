import { importLiveTracking } from './importDashboard.service.js';

export async function liveTracking(req, res) {
  res.json(await importLiveTracking());
}
