import { runSql, selectRows } from '../shared/hubQuery.service.js';
import { nowIso } from '../shared/hubFormat.service.js';
import { badRequest } from '../shared/hubHttp.js';

const DEFAULT_RATE_WITHOUT_PAN = 20;

const STANDARD_SECTIONS = [
  ['194C', 'Payment to contractors - individual / HUF', 1],
  ['194C', 'Payment to contractors - others', 2],
  ['194J', 'Fees for professional services', 10],
  ['194J', 'Fees for technical services', 2],
  ['194H', 'Commission or brokerage', 2],
  ['194I', 'Rent - land, building, furniture', 10],
  ['194I', 'Rent - plant and machinery', 2],
  ['194A', 'Interest other than on securities', 10],
  ['194Q', 'Purchase of goods', 0.1],
  ['195', 'Payment to non-residents', 20],
];

/** TDS schedule (TdsNatures) with how many ledgers use each section. */
export const listTdsSchedule = () =>
  selectRows(
    'SELECT t.*, (SELECT count(*) FROM AccountLedgers l WHERE l.tdsNatureId = t.id) ledgers FROM TdsNatures t ORDER BY t.section, t.name',
  );

// the body is checked by tdsSchedule.validation.js
const tdsNatureValues = (body) => [
  String(body.name || '').trim(),
  String(body.section || '')
    .trim()
    .toUpperCase(),
  Number(body.rate),
  body.rateWithoutPan === '' || body.rateWithoutPan == null ? DEFAULT_RATE_WITHOUT_PAN : Number(body.rateWithoutPan),
  body.exemptionLimit === '' || body.exemptionLimit == null ? 0 : Number(body.exemptionLimit),
];

export async function createTdsNature(body) {
  const stamp = nowIso();
  await runSql(
    'INSERT INTO TdsNatures (name, section, rate, rateWithoutPan, exemptionLimit, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)',
    [...tdsNatureValues(body), stamp, stamp],
  );
}

export async function updateTdsNature(id, body) {
  await runSql(
    'UPDATE TdsNatures SET name = ?, section = ?, rate = ?, rateWithoutPan = ?, exemptionLimit = ?, updatedAt = ? WHERE id = ?',
    [...tdsNatureValues(body), nowIso(), id],
  );
}

export async function deleteTdsNature(id) {
  const ledgers = (await selectRows('SELECT count(*) n FROM AccountLedgers WHERE tdsNatureId = ?', [id]))[0].n;
  if (ledgers) throw badRequest(ledgers + ' ledgers use this TDS section - change them first');
  await runSql('DELETE FROM TdsNatures WHERE id = ?', [id]);
}

/** Adds the standard TDS sections that are missing (by name); answers how many were added. */
export async function addStandardTdsSections() {
  let added = 0;
  const stamp = nowIso();
  for (const [section, name, rate] of STANDARD_SECTIONS) {
    if ((await selectRows('SELECT id FROM TdsNatures WHERE lower(name) = lower(?)', [name])).length) continue;
    await runSql(
      'INSERT INTO TdsNatures (name, section, rate, rateWithoutPan, exemptionLimit, createdAt, updatedAt) VALUES (?,?,?,20,0,?,?)',
      [name, section, rate, stamp, stamp],
    );
    added++;
  }
  return added;
}
