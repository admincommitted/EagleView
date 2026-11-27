import { sequelize } from '../../../../config/database.js';
import { auditLedger } from '../../../../utils/common/ledgerGuard.js';
import { runSql, runSqlQuietly, selectRows } from '../shared/hubQuery.service.js';
import { nowIso, round2 } from '../shared/hubFormat.service.js';
import { clearEarlierYearsMovements, signedOpening } from '../shared/ledgerMovements.service.js';
import { badRequest, forbidden } from '../shared/hubHttp.js';

const changedRowsOf = (result) => (result && result[1] && result[1].changes) || 0;

// Merge Account: every entry of one ledger moves onto another and the first one is deleted. Moving one party's entries
// onto another account is for an admin only, and is written to AccLedgerAudit.
function checkMergeAllowed(role, fromId, toId) {
  if (String(role || '').toLowerCase() !== 'admin') throw forbidden('Only an admin can merge accounts');
  if (!fromId || !toId || fromId === toId) throw badRequest('Choose two different ledgers');
}

async function moveEntries(transaction, fromId, toId, userName) {
  const [from] = await selectRows('SELECT * FROM AccountLedgers WHERE id = ?', [fromId], transaction);
  const [into] = await selectRows('SELECT * FROM AccountLedgers WHERE id = ?', [toId], transaction);
  if (!from || !into) throw new Error('Ledger not found');
  const moved = await runSql('UPDATE VoucherDetails SET ledgerId = ? WHERE ledgerId = ?', [toId, fromId], transaction);
  await runSqlQuietly('UPDATE VoucherAllocations SET ledgerId = ? WHERE ledgerId = ?', [toId, fromId], transaction);
  await runSqlQuietly(
    'UPDATE InvoiceItems SET chargeLedgerId = ? WHERE chargeLedgerId = ?',
    [toId, fromId],
    transaction,
  );
  // the two openings add up on the account kept
  const opening = signedOpening(from) + signedOpening(into);
  await runSql(
    'UPDATE AccountLedgers SET openingBalance = ?, balanceType = ?, updatedAt = ? WHERE id = ?',
    [Math.abs(round2(opening)), opening < 0 ? 'Cr' : 'Dr', nowIso(), toId],
    transaction,
  );
  await runSql('DELETE FROM AccountLedgers WHERE id = ?', [fromId], transaction);
  const lines = changedRowsOf(moved);
  await auditLedger(transaction, toId, 'MERGED', userName, { mergedFrom: from }, { name: into.name, lines });
  return { merged: from.name, into: into.name, lines };
}

/** Moves ledger fromId onto toId; answers { merged, into, lines }. */
export async function mergeLedgers(fromId, toId, { role, userName }) {
  checkMergeAllowed(role, fromId, toId);
  const transaction = await sequelize.transaction();
  try {
    const result = await moveEntries(transaction, fromId, toId, userName);
    await transaction.commit();
    clearEarlierYearsMovements(); // the earlier years' totals per ledger changed
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
