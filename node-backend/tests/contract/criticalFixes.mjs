// Checks the critical bug fixes on a running backend that uses a COPY of the database (it saves a profile):
//   DB_STORAGE=<copy> node tests/contract/criticalFixes.mjs --base http://localhost:5003
import sqlite3 from 'sqlite3';
import { loginToken } from './contractToken.mjs';

const argValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : fallback;
};

const BASE_URL = argValue('--base', 'http://localhost:5003');
const DATABASE_FILE = process.env.DB_STORAGE;
const OTHER_USER_ID = 999999;
const TIMEOUT_MS = 120000;

if (!DATABASE_FILE) throw new Error('Set DB_STORAGE to the database copy the backend uses');

const token = await loginToken();
const results = [];

async function call(method, url, body) {
  const response = await fetch(BASE_URL + url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { status: response.status, body: json ?? text };
}

const check = (name, passed, detail = '') => results.push({ name, passed, detail });

const queryRows = (sql, params = []) =>
  new Promise((resolve, reject) => {
    const database = new sqlite3.Database(DATABASE_FILE, sqlite3.OPEN_READONLY);
    database.all(sql, params, (error, rows) => {
      database.close();
      return error ? reject(error) : resolve(rows);
    });
  });

async function checkDayBook() {
  const started = Date.now();
  const noDates = await call('GET', '/api/vouchers/daybook');
  check(
    'daybook without dates answers today only',
    noDates.status === 200 && Array.isArray(noDates.body?.data),
    `status ${noDates.status}, ${noDates.body?.data?.length} vouchers, ${Date.now() - started} ms`,
  );
  const tooLong = await call('GET', '/api/vouchers/daybook?startDate=2026-01-01&endDate=2026-11-25');
  check('daybook over 31 days is refused', tooLong.status === 400, `status ${tooLong.status}: ${tooLong.body?.error}`);
  const reversed = await call('GET', '/api/vouchers/daybook?startDate=2026-11-25&endDate=2026-11-01');
  check(
    'daybook with from after to is refused',
    reversed.status === 400,
    `status ${reversed.status}: ${reversed.body?.error}`,
  );
  const month = await call('GET', '/api/vouchers/daybook?startDate=2026-11-01&endDate=2026-11-25');
  check(
    'daybook of 25 days works',
    month.status === 200 && Array.isArray(month.body?.data),
    `${month.body?.data?.length} vouchers`,
  );
}

async function checkProfile() {
  const [before] = await queryRows('SELECT id, userId FROM UserProfiles WHERE userId = 1 ORDER BY id LIMIT 1');
  const answer = await call('PUT', '/api/auth/profile', { firstName: 'gyanender', userId: OTHER_USER_ID, id: 424242 });
  const [after] = await queryRows('SELECT id, userId FROM UserProfiles WHERE userId = 1 ORDER BY id LIMIT 1');
  const strangers = await queryRows('SELECT COUNT(*) AS n FROM UserProfiles WHERE userId = ? OR id = 424242', [
    OTHER_USER_ID,
  ]);
  check('profile save answers 200', answer.status === 200, `status ${answer.status}`);
  check(
    'profile row stays with its user',
    before?.id === after?.id && after?.userId === 1,
    `row ${after?.id} user ${after?.userId}`,
  );
  check('no row for another user was written', strangers[0].n === 0, `${strangers[0].n} rows`);
}

await checkDayBook();
await checkProfile();
for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'}  ${result.name}  (${result.detail})`);
process.exit(results.every((result) => result.passed) ? 0 : 1);
