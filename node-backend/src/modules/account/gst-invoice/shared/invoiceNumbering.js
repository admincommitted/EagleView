import * as numberSeries from '../../../../utils/common/numberSeries.js';
import { badRequest, selectRows } from './invoiceDb.js';
import { KINDS } from './invoiceKinds.js';

const APRIL = 4;
const NUMBER_PAD = 4;
const BRANCH_PART_LENGTH = 3;
const DEFAULT_BRANCH = 'HO';

/** Financial year code of a date: 2026-05-10 -> 2627. */
const fyCode = (date) => {
  const year = Number(String(date).slice(0, 4));
  const month = Number(String(date).slice(5, 7));
  const startYear = month < APRIL ? year - 1 : year;
  return String(startYear).slice(2) + String(startYear + 1).slice(2);
};

const docketsOf = (body) => {
  if (Array.isArray(body.dockets)) return body.dockets;
  try {
    return JSON.parse(body.dockets || '[]');
  } catch {
    return [];
  }
};

/** Division of an invoice: chosen, else from the job no, the first docket, or the first line's job. */
export const divisionOfInvoice = (body) =>
  numberSeries.divOf(body.division) ||
  numberSeries.divOf(body.jobNo) ||
  numberSeries.divOf(docketsOf(body)[0]) ||
  numberSeries.divOf((body.lines || []).map((line) => line.jobNo).find(Boolean));

/**
 * The fallback numbering for a branch with no Number Series: SI/DEL/2627/0001 - one series per kind, branch and year
 * (16 characters at most: the e-invoice portal does not take a longer document no).
 */
async function nextFallbackNumber(kind, branch, date, transaction) {
  const branchPart = String(branch || DEFAULT_BRANCH)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, BRANCH_PART_LENGTH);
  const head = `${KINDS[kind].prefix}/${branchPart}/${fyCode(date)}/`;
  const rows = await selectRows(
    'SELECT invoiceNo FROM AccSalesInvoices WHERE invoiceNo LIKE ?',
    [head + '%'],
    transaction,
  );
  const highest = rows.reduce((max, row) => Math.max(max, Number(String(row.invoiceNo).slice(head.length)) || 0), 0);
  return head + String(highest + 1).padStart(NUMBER_PAD, '0');
}

/**
 * The invoice no from Settings > Number Series (iCAFFE), per branch + division + year (e.g. Service DL/26/EX/0000027).
 * `takeIt` moves the series on (on save); otherwise the next number is only shown.
 */
export async function invoiceNumberFor(kind, branch, date, transaction, division, takeIt) {
  await numberSeries.ensure();
  const branchCode = String(branch || (await numberSeries.defaultBranch(transaction))).toUpperCase();
  const doc = 'INV_' + kind;
  const activeSeries = await selectRows(
    'SELECT division FROM NumberSeries WHERE docType = ? AND branchCode = ? AND coalesce(isActive, 1) = 1',
    [doc, branchCode],
    transaction,
  );
  if (!activeSeries.length) return nextFallbackNumber(kind, branchCode, date, transaction);
  if (!division) {
    throw badRequest(
      "Choose the Division (AE / AI / SE / SI) - the invoice no comes from that division's series, as in iCAFFE",
    );
  }
  if (!activeSeries.some((series) => series.division === division || series.division === '')) {
    throw badRequest(
      'Number series not set for ' +
        doc.replace('INV_', '') +
        ' invoice, branch ' +
        branchCode +
        ', division ' +
        division +
        ' - set it in Settings > Number Series (iCAFFE)',
    );
  }
  const request = { branchCode, division, date };
  return takeIt ? numberSeries.take(doc, request, transaction) : numberSeries.peek(doc, request, transaction);
}
