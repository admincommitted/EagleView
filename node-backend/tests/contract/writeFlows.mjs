// Runs the same sequence of saves (create / change / delete, job re-save, error cases) against one backend and keeps
// every answer. Run it on two backends that each have their OWN fresh copy of the database, then compare:
//   node tests/contract/writeFlows.mjs --base http://localhost:5002 --out tests/contract/runs/write-old
//   node tests/contract/writeFlows.mjs --base http://localhost:5003 --out tests/contract/runs/write-new
//   node tests/contract/compareWrites.mjs runs/write-old runs/write-new
import fs from 'node:fs';
import path from 'node:path';
import { loginToken } from './contractToken.mjs';

const argValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : fallback;
};

const BASE_URL = argValue('--base', 'http://localhost:5002');
const OUT_DIR = path.resolve(argValue('--out', path.join(import.meta.dirname, 'runs', 'write-latest')));
const IMPORT_JOB_ID = 813;
const TIMEOUT_MS = 180000;

const token = await loginToken();

async function call(method, url, body, { withToken = true } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(withToken && { Authorization: `Bearer ${token}` }) };
  const response = await fetch(BASE_URL + url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: response.status, body: json ?? text };
}

const idOf = (answer) => answer.body?.data?.id ?? answer.body?.id;
const findUqc = (answer, code) =>
  (Array.isArray(answer.body) ? answer.body : answer.body?.data || []).find((row) => row.uqcCode === code);

// each step: [name, async (results) => answer]
const STEPS = [
  ['uqc create', () => call('POST', '/api/masters/uqcs', { uqcCode: 'ZZT', description: 'CONTRACT TEST UNIT' })],
  ['uqc list after create', () => call('GET', '/api/masters/uqcs')],
  [
    'uqc update',
    (results) =>
      call('PUT', `/api/masters/uqcs/${findUqc(results['uqc list after create'], 'ZZT')?.id}`, {
        uqcCode: 'ZZT',
        description: 'CONTRACT TEST UNIT 2',
      }),
  ],
  [
    'uqc delete',
    (results) => call('DELETE', `/api/masters/uqcs/${findUqc(results['uqc list after create'], 'ZZT')?.id}`),
  ],
  ['uqc create without body fields', () => call('POST', '/api/masters/uqcs', {})],
  ['uqc create without login', () => call('POST', '/api/masters/uqcs', { uqcCode: 'ZZU' }, { withToken: false })],
  [
    'port create',
    () => call('POST', '/api/masters/ports', { portCode: 'ZZTST', portName: 'CONTRACT TEST PORT', category: 'AIR' }),
  ],
  [
    'port update',
    (results) =>
      call('PUT', `/api/masters/ports/${idOf(results['port create'])}`, { portName: 'CONTRACT TEST PORT 2' }),
  ],
  ['port delete', (results) => call('DELETE', `/api/masters/ports/${idOf(results['port create'])}`)],
  ['user pref save', () => call('PUT', '/api/user-prefs/contract.test', { value: { favourite: ['a', 'b'] } })],
  ['user pref read', () => call('GET', '/api/user-prefs/contract.test')],
  ['user pref bad key', () => call('PUT', '/api/user-prefs/bad%20key!', { value: 1 })],
  [
    'timeline add remark',
    () =>
      call('POST', '/api/timeline', {
        module: 'IMPORT',
        jobId: IMPORT_JOB_ID,
        remark: 'CONTRACT TEST REMARK',
        eventType: 'REMARK',
      }),
  ],
  ['timeline list', () => call('GET', `/api/timeline/IMPORT/${IMPORT_JOB_ID}`)],
  ['timeline delete remark', (results) => call('DELETE', `/api/timeline/${idOf(results['timeline add remark'])}`)],
  ['app settings save', () => call('PUT', '/api/auth/settings', { primaryColor: 'emerald', appBackground: 'mint' })],
  ['app settings bad colour', () => call('PUT', '/api/auth/settings', { primaryColor: 'no-such-colour' })],
  ['app settings back', () => call('PUT', '/api/auth/settings', { primaryColor: 'cerulean', appBackground: 'sky' })],
  ['import job load', () => call('GET', `/api/import-jobs/${IMPORT_JOB_ID}`)],
  ['import job re-save', (results) => call('POST', '/api/import-jobs', results['import job load'].body?.data)],
  ['import job load after save', () => call('GET', `/api/import-jobs/${IMPORT_JOB_ID}`)],
  [
    'import job items patch',
    (results) => {
      const job = results['import job load after save'].body?.data || {};
      const firstItem = (job.items || job.invoices?.[0]?.items || [])[0];
      return call('POST', `/api/import-jobs/${IMPORT_JOB_ID}/items-patch`, { items: firstItem ? [firstItem] : [] });
    },
  ],
  ['import job save empty body', () => call('POST', '/api/import-jobs', {})],
  ['export job list', () => call('GET', '/api/export-jobs')],
  [
    'export job load',
    (results) => {
      const list = results['export job list'].body?.data || results['export job list'].body || [];
      return call('GET', `/api/export-jobs/${(Array.isArray(list) ? list : [])[0]?.id}`);
    },
  ],
  ['export job re-save', (results) => call('POST', '/api/export-jobs', results['export job load'].body?.data)],
  ['voucher post empty', () => call('POST', '/api/vouchers', {})],
  ['unknown api', () => call('POST', '/api/no-such-thing', {})],
];

async function runSteps() {
  const results = {};
  for (const [name, step] of STEPS) {
    try {
      results[name] = await step(results);
    } catch (error) {
      results[name] = { status: 'ERROR', body: error.message };
    }
    console.log(`${String(results[name].status).padEnd(5)} ${name}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'writes.json'), JSON.stringify(results, null, 2));
}

await runSteps();
