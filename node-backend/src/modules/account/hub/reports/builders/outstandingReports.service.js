import { openItems } from '../../../../../utils/common/openItems.js';
import { daysBetween, round2, splitDrCr, toNumber, todayIso } from '../../shared/hubFormat.service.js';
import { NO_MOVEMENT, ledgerMovements, signedOpening } from '../../shared/ledgerMovements.service.js';

const DEFAULT_INTERVAL_DAYS = 30;
const UNKNOWN_BILL_AGE = 9999;
const HALF_RUPEE = 0.5;
const INTERVAL_COUNT = 5;

/** The five intervals the user sets (r1..r5 days) as upper edges, and their labels ("0-30", ..., "> 150"). */
function ageIntervals(params) {
  const lengths = [1, 2, 3, 4, 5].map((index) =>
    Math.max(1, Math.round(toNumber(params['r' + index]) || DEFAULT_INTERVAL_DAYS)),
  );
  const edges = lengths.reduce((sum, length) => [...sum, (sum[sum.length - 1] || 0) + length], []);
  const labels = edges
    .map((edge, index) => (index === 0 ? 0 : edges[index - 1] + 1) + '-' + edge)
    .concat(['> ' + edges[4]]);
  const bucketOf = (days) => {
    const index = edges.findIndex((edge) => days <= edge);
    return index < 0 ? INTERVAL_COUNT : index;
  };
  return { lengths, labels, bucketOf };
}

const withEmptyBuckets = (row, labels) => {
  labels.forEach((label, index) => {
    if (row['b' + index] == null) row['b' + index] = 0;
  });
  return row;
};

function billRow(item, asOn, labels, bucketOf) {
  const age = item.date ? Math.max(0, daysBetween(item.date, asOn)) : UNKNOWN_BILL_AGE;
  const bucket = bucketOf(age);
  const row = {
    _v: item.voucherId,
    party: item.party,
    billNo: item.refNo,
    billDate: item.date,
    age,
    outstanding: round2(item.pending),
  };
  labels.forEach((label, index) => {
    row['b' + index] = index === bucket ? round2(item.pending) : 0;
  });
  return row;
}

function partyRows(items, ledgers, movements, { asOn, type, labels, bucketOf }) {
  const byParty = new Map();
  for (const item of items) {
    const age = item.date ? Math.max(0, daysBetween(item.date, asOn)) : UNKNOWN_BILL_AGE;
    const bucket = bucketOf(age);
    const row = withEmptyBuckets(
      byParty.get(item.ledgerId) || { _l: item.ledgerId, party: item.party, outstanding: 0 },
      labels,
    );
    row['b' + bucket] = round2(row['b' + bucket] + item.pending);
    row.outstanding = round2(row.outstanding + item.pending);
    byParty.set(item.ledgerId, row);
  }
  // the ledger's own balance beside the bills: what is on account and any difference
  for (const ledger of ledgers) {
    const existing = byParty.get(ledger.id);
    const movement = movements.get(ledger.id) || NO_MOVEMENT;
    const balance = signedOpening(ledger) + movement.dr - movement.cr;
    if (!existing && Math.abs(balance) < HALF_RUPEE) continue;
    const row = withEmptyBuckets(existing || { _l: ledger.id, party: ledger.name, outstanding: 0 }, labels);
    const asPerLedger = splitDrCr(balance);
    row.ledgerDr = asPerLedger.dr;
    row.ledgerCr = asPerLedger.cr;
    const net = type === 'payable' ? -balance : balance;
    row.onAccount = round2(Math.max(0, row.outstanding - net));
    row.diff = round2(net - (row.outstanding - row.onAccount));
    byParty.set(ledger.id, row);
  }
  return [...byParty.values()]
    .filter((row) => row.outstanding || row.ledgerDr || row.ledgerCr)
    .sort((first, second) => first.party.localeCompare(second.party));
}

// Ageing Analysis (iCAFFE, receivable / payable): bills by age in five intervals the user sets, outstanding vs the ledger
export async function ageing(params) {
  const asOn = params.asOn || todayIso();
  const type = params.type === 'payable' ? 'payable' : 'receivable';
  const { lengths, labels, bucketOf } = ageIntervals(params);
  const { items, ledgers } = await openItems({ type, asOn });
  const movements = await ledgerMovements(null, asOn);
  const detail = params.detail === '1';
  const rows = detail
    ? items.map((item) => billRow(item, asOn, labels, bucketOf))
    : partyRows(items, ledgers, movements, { asOn, type, labels, bucketOf });
  const bucketColumns = labels.map((label, index) => ['b' + index, label, 'money', 'Interval In Days']);
  return {
    subtitle:
      'Ageing Analysis ' +
      (type === 'payable' ? 'Payable' : 'Receivable') +
      ' - as on ' +
      asOn.split('-').reverse().join('/') +
      ' - interval (' +
      lengths.join(' - ') +
      ') days',
    groupBy: detail ? 'party' : '',
    columns: detail
      ? [
          ['party', 'Party Name'],
          ['billNo', 'Bill No'],
          ['billDate', 'Bill Date', 'date'],
          ['age', 'Days', 'int'],
          ...bucketColumns,
          ['outstanding', 'Outstanding', 'money'],
        ]
      : [
          ['party', 'Party Name'],
          ...bucketColumns,
          ['outstanding', 'Outstanding', 'money', 'Balance'],
          ['ledgerDr', 'As per Ledger Dr.', 'money', 'Balance'],
          ['ledgerCr', 'As per Ledger Cr.', 'money', 'Balance'],
          ['onAccount', 'On Account', 'money', 'Balance'],
          ['diff', 'Diff.', 'money', 'Balance'],
        ],
    rows,
    totals: [
      ...bucketColumns.map((column) => column[0]),
      'outstanding',
      ...(detail ? [] : ['ledgerDr', 'ledgerCr', 'onAccount', 'diff']),
    ],
  };
}
