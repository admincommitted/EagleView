// Compares two recorded runs. Endpoints whose answer changes between two runs of the SAME backend (clock, random ids)
// are listed in volatile.json and only their status and shape are compared.
//   node tests/contract/compare.mjs runs/old-1 runs/new-1
import fs from 'node:fs';
import path from 'node:path';

const runDir = (name) => path.resolve(import.meta.dirname, name);
const readRun = (name) =>
  new Map(
    JSON.parse(fs.readFileSync(path.join(runDir(name), 'results.json'), 'utf8')).map((result) => [result.url, result]),
  );
const VOLATILE_FILE = path.join(import.meta.dirname, 'volatile.json');

const [, , oldName, newName, mode] = process.argv;
if (!oldName || !newName) {
  console.log('usage: node tests/contract/compare.mjs <old run> <new run> [--learn-volatile]');
  process.exit(1);
}

const oldRun = readRun(oldName);
const newRun = readRun(newName);

if (mode === '--learn-volatile') {
  const volatile = [...oldRun.values()]
    .filter((result) => newRun.get(result.url)?.hash !== result.hash)
    .map((result) => result.url);
  fs.writeFileSync(VOLATILE_FILE, JSON.stringify(volatile, null, 2));
  console.log(`${volatile.length} endpoints change between two runs of the same backend - saved to volatile.json`);
  process.exit(0);
}

const volatile = new Set(fs.existsSync(VOLATILE_FILE) ? JSON.parse(fs.readFileSync(VOLATILE_FILE, 'utf8')) : []);
const sameShape = (first, second) => JSON.stringify(first.shape) === JSON.stringify(second.shape);

const differences = [];
for (const [url, before] of oldRun) {
  const after = newRun.get(url);
  if (!after) {
    differences.push({ url, problem: 'missing in the new run' });
    continue;
  }
  if (before.status !== after.status) {
    differences.push({
      url,
      problem: `status ${before.status} -> ${after.status}`,
      before: before.preview,
      after: after.preview,
    });
    continue;
  }
  if (volatile.has(url)) {
    if (!sameShape(before, after))
      differences.push({ url, problem: 'shape changed (volatile endpoint)', before: before.shape, after: after.shape });
    continue;
  }
  if (before.hash !== after.hash)
    differences.push({
      url,
      problem: sameShape(before, after) ? 'same shape, different data' : 'shape changed',
      before: before.preview,
      after: after.preview,
    });
}

const reportFile = path.join(runDir(newName), 'differences.json');
fs.writeFileSync(reportFile, JSON.stringify(differences, null, 2));
console.log(
  `${oldRun.size} endpoints compared, ${volatile.size} volatile, ${differences.length} different${differences.length ? ` - see ${reportFile}` : ''}`,
);
for (const difference of differences.slice(0, 25)) console.log(`  ${difference.url}: ${difference.problem}`);
process.exit(differences.length ? 1 : 0);
