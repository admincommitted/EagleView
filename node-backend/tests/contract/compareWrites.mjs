// Compares two writeFlows.mjs runs. Clock values (createdAt, updatedAt, dates with a time, _loadedAt …) are masked.
import fs from 'node:fs';
import path from 'node:path';

const [, , oldName, newName] = process.argv;
const readRun = (name) =>
  JSON.parse(fs.readFileSync(path.join(path.resolve(import.meta.dirname, name), 'writes.json'), 'utf8'));

const CLOCK_KEYS = /^(createdAt|updatedAt|timestamp|_loadedAt|savedAt|lastSeen|at|time|ref)$/i;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const SERVER_REF = /\(ref [0-9A-Z]+\)/g;

const mask = (value, key = '') => {
  if (Array.isArray(value)) return value.map((item) => mask(item));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((name) => [name, mask(value[name], name)]),
    );
  if (typeof value === 'string') {
    if (CLOCK_KEYS.test(key) || DATE_TIME.test(value)) return '<time>';
    return value.replace(SERVER_REF, '(ref <ref>)');
  }
  return value;
};

const oldRun = readRun(oldName);
const newRun = readRun(newName);
let differences = 0;
for (const name of Object.keys(oldRun)) {
  const before = oldRun[name];
  const after = newRun[name];
  const sameStatus = before.status === after?.status;
  const sameBody = JSON.stringify(mask(before.body)) === JSON.stringify(mask(after?.body));
  if (sameStatus && sameBody) {
    console.log(`same  ${name}`);
    continue;
  }
  differences++;
  console.log(`DIFF  ${name}: status ${before.status} -> ${after?.status}`);
  if (!sameBody) {
    console.log('   old:', JSON.stringify(mask(before.body)).slice(0, 400));
    console.log('   new:', JSON.stringify(mask(after?.body)).slice(0, 400));
  }
}
console.log(`${Object.keys(oldRun).length} steps, ${differences} different`);
process.exit(differences ? 1 : 0);
