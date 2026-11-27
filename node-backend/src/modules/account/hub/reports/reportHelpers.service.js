import { round2 } from '../shared/hubFormat.service.js';

export const IGST_LEDGER = /igst|integrated/i;
export const CGST_LEDGER = /cgst|central/i;
export const SGST_LEDGER = /sgst|utgst|state/i;
export const TDS_LEDGER = /tds/i;

/** GST of the tax lines whose ledger name matches `pattern` (TDS ledgers never count). */
export const gstAmountOf = (taxLines, pattern) =>
  round2(
    taxLines
      .filter((line) => pattern.test(line.ledgerName) && !TDS_LEDGER.test(line.ledgerName))
      .reduce((sum, line) => sum + line.amount, 0),
  );

/** The register column of a ledger posted on a voucher ("L<ledgerId>"). */
export const ledgerColumnKey = (line) => 'L' + line.ledgerId;

/** A register filtered by party name keeps only vouchers whose party contains the text. */
export const partyMatches = (party, partyFilter) =>
  !partyFilter || !!(party && party.ledgerName.toLowerCase().includes(String(partyFilter).toLowerCase()));

/** Bill type filter of the sales registers: invoice / creditnote / both. */
export const salesBaseTypes = (billType) => {
  if (billType === 'invoice') return ['Sales'];
  if (billType === 'creditnote') return ['Credit Note'];
  return ['Sales', 'Credit Note'];
};

/** Ledger columns found on the vouchers, sorted by ledger name, as [key, name, 'money', header]. */
export const sortedLedgerColumns = (columnNames, header) =>
  [...columnNames.entries()]
    .sort((first, second) => first[1].localeCompare(second[1]))
    .map(([key, name]) => [key, name, 'money', header]);
