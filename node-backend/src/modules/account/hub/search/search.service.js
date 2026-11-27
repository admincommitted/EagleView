import { selectRows } from '../shared/hubQuery.service.js';

const MIN_SEARCH_LENGTH = 2;
const RESULTS_EACH = 8;

/** Quick search of ledgers (name / GSTIN / PAN) and vouchers (number, ref, job, narration, or the exact amount). */
export async function searchAccounts(searchText) {
  const text = String(searchText || '').trim();
  if (text.length < MIN_SEARCH_LENGTH) return { ledgers: [], vouchers: [] };
  const like = '%' + text + '%';
  const ledgers = await selectRows(
    `SELECT l.id, l.name, l.gstin, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId
        WHERE l.name LIKE ? OR l.gstin LIKE ? OR l.pan LIKE ? ORDER BY CASE WHEN l.name LIKE ? THEN 0 ELSE 1 END, l.name LIMIT ${RESULTS_EACH}`,
    [like, like, like, text + '%'],
  );
  const amount = Number(text.replace(/,/g, ''));
  const byAmount = isFinite(amount) && amount > 0;
  const vouchers = await selectRows(
    `SELECT v.id, v.voucherNumber, v.date, v.refNo, v.jobNo, v.totalAmount, t.name typeName, t.baseType FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
        WHERE v.voucherNumber LIKE ? OR v.refNo LIKE ? OR v.jobNo LIKE ? OR v.narration LIKE ? ${byAmount ? 'OR abs(v.totalAmount - ?) < 0.01' : ''}
        ORDER BY v.date DESC LIMIT ${RESULTS_EACH}`,
    byAmount ? [like, like, like, like, amount] : [like, like, like, like],
  );
  return { ledgers, vouchers };
}
