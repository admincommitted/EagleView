import {
  defaultBranch,
  divOf as seriesDivisionOf,
  ensure as ensureNumberSeries,
  take as takeSeriesNumber,
  voucherDoc,
} from '../../../../utils/common/numberSeries.js';
import { runSql, runSqlQuietly, selectRows } from '../shared/hubQuery.service.js';
import { nowIso, round2, toNumber } from '../shared/hubFormat.service.js';
import { badRequest } from '../shared/hubHttp.js';

const MAX_NUMBER_SKIPS = 1000;

/** The "BRANCH A/C - <code>" ledger; entries go only to ledgers that exist in the accounts (iCAFFE rule). */
export async function branchLedgerId(branchCode, transaction) {
  const name = 'BRANCH A/C - ' + String(branchCode).toUpperCase();
  const ledger = (
    await selectRows('SELECT id FROM AccountLedgers WHERE lower(name) = lower(?)', [name], transaction)
  )[0];
  if (ledger) return ledger.id;
  throw badRequest(
    'Ledger "' +
      name +
      '" is not in the accounts - create it under Branch / Divisions in Accounts > Masters > Ledger Account',
  );
}

// the voucher type's own numbering: start + count, skipping numbers already typed by hand
async function nextTypeNumber(typeId, transaction) {
  const type = (await selectRows('SELECT * FROM VoucherTypes WHERE id = ?', [typeId], transaction))[0] || {};
  const count = (await selectRows('SELECT count(*) n FROM Vouchers WHERE voucherTypeId = ?', [typeId], transaction))[0]
    .n;
  let sequence = (Number(type.startingNumber) || 1) + Number(count);
  const numberOf = (value) => (type.prefix || '') + value + (type.suffix || '');
  for (let attempt = 0; attempt < MAX_NUMBER_SKIPS; attempt++) {
    const candidate = numberOf(sequence);
    if (
      !(
        await selectRows(
          'SELECT id FROM Vouchers WHERE voucherTypeId = ? AND voucherNumber = ?',
          [typeId, candidate],
          transaction,
        )
      ).length
    )
      return candidate;
    sequence++;
  }
  return numberOf(sequence);
}

// iCAFFE numbering (BA / CA / JN per branch + division) when the branch has the series, else the type's own numbering
async function voucherNumberFor({ base, date, branchCode, lines, division }, typeId, transaction) {
  await ensureNumberSeries();
  const ownBranch = String(branchCode || '').toUpperCase() || (await defaultBranch(transaction));
  const seriesDivision = seriesDivisionOf(division);
  const docType = await voucherDoc(
    base,
    lines.map((line) => line.ledgerId),
    transaction,
  );
  const series = await selectRows(
    'SELECT division FROM NumberSeries WHERE docType = ? AND branchCode = ? AND coalesce(isActive, 1) = 1',
    [docType, ownBranch],
    transaction,
  );
  if (!series.length) return { voucherNumber: await nextTypeNumber(typeId, transaction), seriesDivision };
  if (!seriesDivision)
    throw badRequest(
      "Choose the Division (AE / AI / SE / SI) - the voucher no comes from that division's series, as in iCAFFE",
    );
  if (!series.some((row) => row.division === seriesDivision || row.division === '')) {
    throw badRequest(
      'Number series not set for ' +
        docType +
        ', branch ' +
        ownBranch +
        ', division ' +
        seriesDivision +
        ' - set it in Settings > Number Series (iCAFFE)',
    );
  }
  const voucherNumber = await takeSeriesNumber(
    docType,
    { branchCode: ownBranch, division: seriesDivision, date },
    transaction,
  );
  return { voucherNumber, seriesDivision };
}

const sideTotal = (lines, side) =>
  round2(lines.filter((line) => line.dc === side).reduce((sum, line) => sum + toNumber(line.amount), 0));

/** Posts an approved voucher of the first type of `base` with its lines; answers { id, vno }. */
export async function postBranchVoucher(
  transaction,
  { base, date, narration, refNo, branchCode, lines, by, division },
) {
  const type = (
    await selectRows('SELECT id FROM VoucherTypes WHERE baseType = ? ORDER BY id LIMIT 1', [base], transaction)
  )[0];
  if (!type) throw badRequest('Voucher type "' + base + '" is missing');
  const debit = sideTotal(lines, 'Dr');
  const credit = sideTotal(lines, 'Cr');
  if (!debit || Math.abs(debit - credit) > 0.01) throw badRequest('Debit and credit must be equal');
  const { voucherNumber, seriesDivision } = await voucherNumberFor(
    { base, date, branchCode, lines, division },
    type.id,
    transaction,
  );
  const stamp = nowIso();
  await runSql(
    `INSERT INTO Vouchers (voucherTypeId, voucherNumber, date, narration, totalAmount, status, branchCode, refNo, createdByName, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      type.id,
      voucherNumber,
      date,
      narration || null,
      debit,
      'Approved',
      branchCode || null,
      refNo || null,
      by || null,
      stamp,
      stamp,
    ],
    transaction,
  );
  const voucherId = (
    await selectRows(
      'SELECT id FROM Vouchers WHERE voucherTypeId = ? AND voucherNumber = ? ORDER BY id DESC LIMIT 1',
      [type.id, voucherNumber],
      transaction,
    )
  )[0].id;
  for (const line of lines) {
    await runSql(
      'INSERT INTO VoucherDetails (voucherId, ledgerId, dc, amount, remarks, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)',
      [
        voucherId,
        line.ledgerId,
        line.dc,
        round2(toNumber(line.amount)),
        line.remarks ? String(line.remarks).slice(0, 300) : null,
        stamp,
        stamp,
      ],
      transaction,
    );
  }
  if (seriesDivision)
    await runSqlQuietly('UPDATE Vouchers SET division = ? WHERE id = ?', [seriesDivision, voucherId], transaction);
  return { id: voucherId, vno: voucherNumber };
}
