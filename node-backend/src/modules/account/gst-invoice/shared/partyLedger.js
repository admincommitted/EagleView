import { findOne as findOneLedger } from '../../../../utils/common/ledgerGuard.js';
import { badRequest, runSql } from './invoiceDb.js';

/**
 * The party's account (ledger), only when exactly one fits: the ledger picked, then the party master link, then GSTIN
 * + name, then the name ignoring spaces / dots. Look-alike accounts are never guessed: the ledger guard answers which
 * ones to choose from. A party found by its master id is linked to that ledger for next time.
 */
export async function findPartyLedger(transaction, body) {
  const partyId = Number(body.partyId) || null;
  const ledgerId = await findOneLedger(
    {
      ledgerId: body.ledgerId,
      partyId,
      gstin: body.gstin,
      name: String(body.partyName || '').trim(),
    },
    transaction,
  );
  if (ledgerId && partyId && !body.ledgerId) {
    await runSql(
      'UPDATE AccountLedgers SET partyId = ? WHERE id = ? AND partyId IS NULL',
      [partyId, ledgerId],
      transaction,
    ).catch(() => null);
  }
  return ledgerId;
}

/** iCAFFE rule: an invoice is made only on the party's account - nothing is created here. */
export async function partyLedgerOrRefuse(transaction, body) {
  if (!String(body.partyName || '').trim() && !body.ledgerId) throw badRequest('Please Select Party');
  const ledgerId = await findPartyLedger(transaction, body);
  if (!ledgerId) {
    throw badRequest(
      'Party Account not created ! Make the ledger of "' +
        String(body.partyName || '').trim() +
        '" in Accounts > Masters > Ledger Account (under Sundry Debtors / Creditors), then pick the party again.',
    );
  }
  return ledgerId;
}
