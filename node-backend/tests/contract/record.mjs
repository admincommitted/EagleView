// Calls every endpoint of endpoints.json on a running backend and saves what it answered (status + a fingerprint of
// the body) so two backends can be compared.
//   node tests/contract/record.mjs --base http://localhost:5002 --out tests/contract/runs/old-1 [--no-auth-check]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loginToken } from './contractToken.mjs';

const argValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : fallback;
};

const BASE_URL = argValue('--base', 'http://localhost:5002');
const OUT_DIR = path.resolve(argValue('--out', path.join(import.meta.dirname, 'runs', 'latest')));
const CONCURRENCY = Number(argValue('--parallel', '1'));
const TIMEOUT_MS = Number(argValue('--timeout', '180000'));
const PREVIEW_CHARS = 600;

const endpoints = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'endpoints.json'), 'utf8'));

// object keys in a fixed order, so the same data always gives the same fingerprint
const sortKeys = (value) => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])]),
    );
  return value;
};

const shapeOf = (value) => {
  if (Array.isArray(value)) return [value.length ? shapeOf(value[0]) : 'empty'];
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, shapeOf(value[key])]),
    );
  return value === null ? 'null' : typeof value;
};

async function callEndpoint(endpoint, headers) {
  const started = Date.now();
  try {
    const response = await fetch(BASE_URL + endpoint.url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const text = await response.text();
    let body = text;
    let isJson = false;
    try {
      body = sortKeys(JSON.parse(text));
      isJson = true;
    } catch {
      /* not JSON */
    }
    const normalized = isJson ? JSON.stringify(body) : text;
    return {
      url: endpoint.url,
      status: response.status,
      contentType: (response.headers.get('content-type') || '').split(';')[0],
      hash: crypto.createHash('sha256').update(normalized).digest('hex'),
      size: normalized.length,
      shape: isJson ? shapeOf(body) : 'text',
      preview: normalized.slice(0, PREVIEW_CHARS),
      ms: Date.now() - started,
    };
  } catch (error) {
    return { url: endpoint.url, status: 'ERROR', error: error.message, ms: Date.now() - started };
  }
}

async function runAll() {
  const headers = { Authorization: `Bearer ${await loginToken()}` };
  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < endpoints.length) {
      const endpoint = endpoints[next++];
      results.push(await callEndpoint(endpoint, headers));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const unauthenticated = await callEndpoint({ url: '/api/masters/currencies' }, {});
  results.push({ ...unauthenticated, url: 'NO-TOKEN /api/masters/currencies' });
  results.sort((first, second) => first.url.localeCompare(second.url));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 2));
  const failed = results.filter((result) => result.status === 'ERROR').length;
  console.log(`${results.length} calls recorded in ${OUT_DIR} (${failed} without an answer)`);
}

await runAll();
