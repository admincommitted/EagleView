import { userNameOf } from '../shared/routeHandler.js';
import { matchGstr2b } from './gstr2bMatch.service.js';
import {
  createVoucher,
  heldBillRefusal,
  nextVoucherNumber,
  pendingApprovals,
  recentVouchers,
  updateVoucherStatus,
} from './voucher.service.js';
import {
  claimDraftDocuments,
  deleteVoucherDocument,
  listVoucherDocuments,
  saveVoucherDocuments,
} from './voucherDocuments.service.js';
import {
  bankReconciliation,
  cashFlow,
  dayBook,
  gstReturns,
  ledgerStatement,
  ledgersByGroup,
  outstanding,
  pendingBills,
  reconcileBank,
} from './voucherReports.service.js';

const userOf = (req) => ({ id: (req.user && req.user.id) || null, name: userNameOf(req) });

export async function getNextNumber(req, res) {
  res.json(await nextVoucherNumber(req.params.typeId, req.query));
}

export async function saveVoucher(req, res) {
  const refusal = await heldBillRefusal(req.body);
  if (refusal) return res.status(400).json({ error: refusal });
  const {
    voucherTypeId,
    voucherNumber,
    date,
    narration,
    details,
    jobNo,
    branchCode,
    refNo,
    allocations,
    ownBranch,
    division,
    isRcm,
  } = req.body;
  const voucher = {
    voucherTypeId,
    voucherNumber,
    date,
    narration,
    details,
    jobNo,
    branchCode,
    refNo,
    allocations,
    ownBranch,
    division,
    isRcm,
  };
  return res.json(await createVoucher(voucher, userOf(req)));
}

export async function listRecentVouchers(req, res) {
  res.json(await recentVouchers());
}

export async function getDayBook(req, res) {
  res.json(await dayBook(req.query));
}

export async function getLedgerStatement(req, res) {
  res.json(await ledgerStatement(req.params.id, req.query));
}

export async function getBankReconciliation(req, res) {
  res.json(await bankReconciliation(req.params.id));
}

export async function saveBankReconciliation(req, res) {
  const { updates } = req.body;
  res.json(await reconcileBank(updates));
}

export async function getGstReturns(req, res) {
  res.json(await gstReturns(req.query));
}

export async function getPendingApprovals(req, res) {
  res.json(await pendingApprovals());
}

export async function changeVoucherStatus(req, res) {
  const { status, rejectionReason, userId } = req.body;
  res.json(await updateVoucherStatus(req.params.id, { status, rejectionReason, userId }));
}

export async function getOutstanding(req, res) {
  res.json(await outstanding(req.query));
}

export async function getCashFlow(req, res) {
  res.json(await cashFlow(req.query));
}

export async function uploadVoucherDocuments(req, res) {
  res.json(await saveVoucherDocuments(req.body, req.files, userOf(req)));
}

export async function claimVoucherDocuments(req, res) {
  res.json(await claimDraftDocuments(req.body || {}));
}

export async function getVoucherDocuments(req, res) {
  res.json(await listVoucherDocuments(req.query));
}

export async function removeVoucherDocument(req, res) {
  res.json(await deleteVoucherDocument(req.params.id));
}

export async function matchGstr2bFile(req, res) {
  res.json(await matchGstr2b(req.file, req.body, req.query.tolerance));
}

export async function getPendingBills(req, res) {
  res.json(await pendingBills(req.query));
}

export async function getLedgersByGroup(req, res) {
  res.json(await ledgersByGroup(req.query.groups));
}
