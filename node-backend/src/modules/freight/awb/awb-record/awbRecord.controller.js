import { scope } from '../../../../utils/awb/awbBranch.js';
import * as awbRecordService from './awbRecord.service.js';

/** What the save needs from the request: the user, the branch picked in the top bar (read only when needed), X-FY. */
const saveContextOf = (req) => ({
  user: req.user,
  resolveSaveBranchId: async () => (await scope(req)).saveId,
  yearHeader: req.get('x-fy'),
});

export async function createAwb(req, res) {
  res.status(201).json(await awbRecordService.createAwb(req.body, saveContextOf(req)));
}

export async function findAwbByNumber(req, res) {
  res.json(await awbRecordService.findAwbByNumber(req.params.awbNumber));
}

export async function updateAwb(req, res) {
  res.json(await awbRecordService.updateAwb(req.params.id, req.body, saveContextOf(req)));
}

export async function voidAwb(req, res) {
  res.json(await awbRecordService.voidAwb(req.params.id, req.body, req.user));
}

export async function duplicateAwb(req, res) {
  const type = String((req.body && req.body.type) || req.query.type || 'AWB').toUpperCase();
  res.json(await awbRecordService.duplicateAwb(req.params.id, type, req.body, req.user));
}

/** An unexpected failure answers 200 { success: false, message } (what the log window reads). */
export async function listActivityLog(req, res) {
  try {
    res.json({ success: true, data: await awbRecordService.activityLogOf(req.params.awbNumber) });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
}
