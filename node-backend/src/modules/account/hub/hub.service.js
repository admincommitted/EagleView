import { runSql, runSqlQuietly } from './shared/hubQuery.service.js';
import {
  ensureChequeLeavesTable,
  ensureInterBranchTable,
  ensureMonthClosingTable,
  ensurePurchaseInfoTable,
  ensureTdsChallansTable,
  ensureVoucherAuditTable,
} from './shared/hubTables.service.js';
import { MASTER_DEFINITIONS, ensureMasterTable } from './shared/masterDefinitions.service.js';
import { ensureLedgerColumns } from './shared/ledgerColumns.service.js';

// Used by the voucher module before a voucher is saved
export { heldBills } from './purchase-info/purchaseInfo.service.js';
export { isMonthClosed } from './month-closing/monthClosing.service.js';
export { isJobClosed } from './job-closing/jobClosing.service.js';

const TABLE_SETUP_DELAY_MS = 4000;

async function createIndexes() {
  await runSql('CREATE INDEX IF NOT EXISTS idx_accaudit_voucher ON AccVoucherAudit (voucherId)');
  await runSql('CREATE INDEX IF NOT EXISTS idx_accpinfo_voucher ON AccPurchaseInfo (voucherId)');
  await runSql('CREATE INDEX IF NOT EXISTS idx_accib_status ON AccInterBranch (status, date)');
  // set-offs, ledger addresses / banks and the outstanding snapshot are read per ledger / voucher
  await runSqlQuietly('CREATE INDEX IF NOT EXISTS idx_valloc_ledger ON VoucherAllocations (ledgerId)');
  await runSqlQuietly('CREATE INDEX IF NOT EXISTS idx_valloc_voucher ON VoucherAllocations (voucherId)');
  await runSqlQuietly('CREATE INDEX IF NOT EXISTS idx_valloc_against ON VoucherAllocations (againstVoucherId)');
  await runSqlQuietly('CREATE INDEX IF NOT EXISTS idx_accledaddr_ledger ON AccLedgerAddresses (ledgerId)');
  await runSqlQuietly('CREATE INDEX IF NOT EXISTS idx_accledbank_ledger ON AccLedgerBanks (ledgerId)');
  await runSqlQuietly('CREATE INDEX IF NOT EXISTS idx_vdocs_voucher ON VoucherDocuments (voucherId)');
  await runSqlQuietly('CREATE INDEX IF NOT EXISTS idx_vouchers_branch_date ON Vouchers (branchCode, date)');
}

/**
 * Makes every accounts-hub table (CREATE TABLE IF NOT EXISTS / ADD COLUMN only - nothing is dropped or changed) and
 * logs which were made; a step that fails is listed and the others still run.
 */
async function setUpAccountsHubTables() {
  const done = [];
  const failed = [];
  const step = async (name, setUp) => {
    try {
      await setUp();
      done.push(name);
    } catch (error) {
      failed.push(name + ': ' + error.message);
    }
  };
  for (const kind of Object.keys(MASTER_DEFINITIONS))
    await step(MASTER_DEFINITIONS[kind].table, () => ensureMasterTable(kind));
  await step('AccMonthClosings', ensureMonthClosingTable);
  await step('AccLedgerAddresses / AccLedgerBanks / AccLedgerOpenings', ensureLedgerColumns);
  await step('AccChequeLeaves', ensureChequeLeavesTable);
  await step('AccTdsChallans', ensureTdsChallansTable);
  await step('AccVoucherAudit', ensureVoucherAuditTable);
  await step('AccPurchaseInfo', ensurePurchaseInfoTable);
  await step('AccInterBranch', ensureInterBranchTable);
  await step('indexes', createIndexes);
  console.log(
    '[accounts-hub] tables ready: ' + done.length + (failed.length ? ' - NOT made: ' + failed.join('; ') : ''),
  );
}

/** Startup: the accounts tables are made 4 seconds after the backend starts (once the database is open). */
export function initAccountsHubTables() {
  setTimeout(setUpAccountsHubTables, TABLE_SETUP_DELAY_MS);
}
