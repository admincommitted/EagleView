#!/usr/bin/env node
/*
 * screenAudit.js - "kya kuch missing hai" ka automatic jawab (30-Oct-2026)
 *
 * Why this exists: between 28-Oct and 30-Oct the three big Job Entry files (100-250 KB each) were split into
 * sections. Every split moved boxes around, and three different kinds of hole were left behind, each of which
 * had to be found by hand, one screen at a time:
 *    1. a field the ICEGATE message carries but no screen box fills   (filed blank / filed stale)
 *    2. a box on the screen that nothing reads                        (operator types, nothing happens)
 *    3. a button or popup with no handler / no way to open it         (dead control)
 * This script looks for all three across the whole frontend in one run, so the answer is a list, not a surprise.
 *
 *   node tools/screenAudit.js            # summary
 *   node tools/screenAudit.js --full     # every line
 *
 * It only reads files; it changes nothing. False positives are possible (a key written through a computed name),
 * so each finding prints where to look.
 */
const fs = require('fs');
const path = require('path');

const BE = path.join(__dirname, '..');
// the frontend sits next to node-backend in the installation; FE_SRC overrides it for a check run elsewhere
const FE = (() => {
  const tries = [process.env.FE_SRC, path.resolve(BE, '..', 'frontend', 'src'), path.resolve(BE, '..', '..', 'frontend', 'src')].filter(Boolean);
  for (const t of tries) { try { if (fs.statSync(path.join(t, 'components')).isDirectory()) return t; } catch (e) { /* next */ } }
  console.error('Frontend source not found - set FE_SRC=<path to frontend/src>'); process.exit(2);
})();
const full = process.argv.includes('--full');

function walk(dir, out = []) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return out; }
  for (const n of names) {
    if (n === 'node_modules' || n === 'dist' || n.startsWith('.')) continue;
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(jsx?|tsx?)$/.test(n)) out.push(p);
  }
  return out;
}
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };
const rel = (p) => path.relative(path.resolve(BE, '..'), p).replace(/\\/g, '/');

// ---------------------------------------------------------------- screen keys
// every key the screens write or read, however they spell it
const FE_FILES = walk(FE);
const screenKeys = new Map(); // key -> Set(file)
const addKey = (k, f) => { if (!k) return; if (!screenKeys.has(k)) screenKeys.set(k, new Set()); screenKeys.get(k).add(rel(f)); };
const KEY_PATTERNS = [
  /name="([A-Za-z0-9_]+)"/g, /name=\{`([A-Za-z0-9_]+)/g, /name=\{([A-Za-z0-9_]+)\}/g,
  /\.\.\.prev,\s*([A-Za-z0-9_]+):/g, /\.\.\.it,\s*([A-Za-z0-9_]+):/g, /\.\.\.inv,\s*([A-Za-z0-9_]+):/g,
  /setV\('([A-Za-z0-9_]+)'/g, /\bP\('([A-Za-z0-9_]+)'/g, /codeBox\('([A-Za-z0-9_]+)'/g,
  /\bbox\('([A-Za-z0-9_]+)'/g, /\bcur\('([A-Za-z0-9_]+)'/g, /cumBox\('([A-Za-z0-9_]+)'/g,
  /flagRow\('[^']*',\s*'([A-Za-z0-9_]+)'/g, /fd\.get\('([A-Za-z0-9_]+)'\)/g,
  /jobData\.([A-Za-z0-9_]+)/g, /jobData\["([A-Za-z0-9_]+)"\]/g, /jobData\['([A-Za-z0-9_]+)'\]/g,
  /invoiceFormData\.([A-Za-z0-9_]+)/g, /invoiceFormData\["([A-Za-z0-9_]+)"\]/g,
  /selectedItem\??\.([A-Za-z0-9_]+)/g, /selectedInvoice\??\.([A-Za-z0-9_]+)/g,
  /\btemp[A-Za-z]*Data\.([A-Za-z0-9_]+)/g, /\b[a-z][A-Za-z]*Form\.([A-Za-z0-9_]+)/g,
  // the export screens keep their state under other names (exportData, formData, inv, item, row, updates ...)
  /\bexportData\.([A-Za-z0-9_]+)/g, /\bexportData\["([A-Za-z0-9_]+)"\]/g, /\bformData\.([A-Za-z0-9_]+)/g,
  // field lists: { k: 'manfProdCode', l: 'Code' } and helpers like codeInput('discPortCode', ...)
  /\{\s*k:\s*'([A-Za-z0-9_]+)'/g, /\b[a-zA-Z]+Input\('([A-Za-z0-9_]+)'/g, /\bfield\('([A-Za-z0-9_]+)'/g,
  /\bformData\["([A-Za-z0-9_]+)"\]/g, /\b(?:inv|item|row|updates|data|d)\.([A-Za-z0-9_]+)\s*(?:\|\||\?\?|\)|,|;|\})/g,
  // 30-Oct-2026: the export item screen draws its Y/N flags as <Chip ... field="thirdParty" />, which has no
  // name="..." - so every one of them read as "no screen box" even though the box is right there and its value
  // reaches the SB file. Any component that names the key with field="..." counts.
  /\bfield="([A-Za-z0-9_]+)"/g, /\bfield=\{'([A-Za-z0-9_]+)'\}/g,
  /'([A-Za-z0-9_]+)',\s*'[^']*',\s*'[A-Za-z0-9_]+',\s*'[A-Za-z0-9_]+'/g,
];
for (const f of FE_FILES) {
  const s = read(f);
  for (const re of KEY_PATTERNS) { let m; re.lastIndex = 0; while ((m = re.exec(s))) addKey(m[1], f); }
  // row('Label', 'amt', 'rate', 'cur') helpers
  let m; const rowRe = /row\('[^']*',\s*'([A-Za-z0-9_]+)',\s*'([A-Za-z0-9_]+)',\s*'([A-Za-z0-9_]+)'/g;
  while ((m = rowRe.exec(s))) { addKey(m[1], f); addKey(m[2], f); addKey(m[3], f); }
  // boxes built from a list of tuples: [['warehouseBENo', 'WH BE No', 'text', 7], ...].map(([k, l]) => <input name={k} ...
  const tupleRe = /\[\s*'([A-Za-z0-9_]+)'\s*,\s*'[^']{2,40}'/g;
  while ((m = tupleRe.exec(s))) addKey(m[1], f);
  // numbered boxes written with a template literal: name={`conditionsAttachedWithSale${num}`}
  const tmplRe = /name=\{`([A-Za-z0-9_]+)\$\{/g;
  while ((m = tmplRe.exec(s))) for (let i = 1; i <= 9; i++) addKey(m[1] + i, f);
  // boxes whose name is built in a loop: name={k + 'Rate'} over [['Freight', 'freight'], ['Insurance', 'insurance'], ...]
  const sufRe = /name=\{\s*[A-Za-z_$][A-Za-z0-9_$]*\s*\+\s*'([A-Za-z0-9_]+)'\s*\}/g;
  const sufs = [...s.matchAll(sufRe)].map(x => x[1]);
  if (sufs.length) {
    const prefRe = /\[\s*'[^']{1,40}'\s*,\s*'([a-z][A-Za-z0-9_]*)'\s*\]/g;
    const prefs = [...s.matchAll(prefRe)].map(x => x[1]);
    for (const pre of prefs) for (const suf of sufs) addKey(pre + suf, f);
  }
}

// ------------------------------------------------ 1. message fields with no box
const builder = read(path.join(BE, 'utils', 'IcegateJsonBuilder.js'));
// keys that flattenItemPopups copies from a popup object into a flat item key
const popupKeys = new Set([...builder.matchAll(/set\('([A-Za-z0-9_]+)'/g)].map(m => m[1]));
function modelBlock(startMark, endMark, nth = 1) {
  let i = -1;
  for (let k = 0; k < nth; k++) { i = builder.indexOf(startMark, i + 1); if (i < 0) return ''; }
  const j = builder.indexOf(endMark, i);
  return builder.slice(i, j > 0 ? j : i + 12000);
}
const MODELS = [
  ['BE header', '      beModel: [{', '      }],', 'd'],
  ['BE invoice', 'const invoiceModel = (invoices', '  }));', 'inv'],
  ['BE item', '      itemsModel:', '      })),', 'item'],
  // the Shipping Bill side (CACHE01) - same three questions for the export screens
  ['SB header', '      sbModel: [{', '      }],', 'd'],
  ['SB invoice', 'const invoiceModel = (invoices', '  }));', 'inv', 2],
  ['SB item', 'const itemsModel = (items', '  });', 'item', 2],
];
const noBox = [];
for (const [name, a, b, varName, nth] of MODELS) {
  const blk = modelBlock(a, b, nth || 1);
  const re = new RegExp('\\n\\s{4,12}([a-zA-Z0-9_]+):\\s+(.+)', 'g');
  let m;
  while ((m = re.exec(blk))) {
    const field = m[1], expr = m[2];
    const reads = [...expr.matchAll(new RegExp('\\b' + varName + '\\.([A-Za-z0-9_]+)', 'g'))].map(x => x[1]);
    if (!reads.length) continue;
    if (reads.some(r => screenKeys.has(r) || popupKeys.has(r))) continue;
    // fields the message format fixes for every BE - the builder sets them, there is nothing for an operator to type
    if (['beClass', 'messageType', 'customHouseCode'].includes(field)) continue;
    noBox.push({ model: name, field, reads });
  }
}

// ------------------------------------------- 2. screen boxes nothing ever reads
// a named box whose key the backend never stores as a column, never appears in the builder, and is not a known
// screen-only flag -> the operator types into nothing
const backend = [path.join(BE, 'utils'), path.join(BE, 'routes'), path.join(BE, 'models')]
  .flatMap(d => walk(d)).map(read).join('\n');
const formCols = read(path.join(BE, 'utils', 'formFieldColumns.js'));
const SCREEN_ONLY = /Flag$|^show|^is[A-Z]|^temp|^_/;
// only real input boxes count here: name="x" on an input / select / textarea, in a screen file (not an Excel column
// map, a report or a sample-file builder, where the same strings are column headings rather than boxes)
const boxKeys = new Map();
for (const f of FE_FILES) {
  if (/excel|report|sample|Checklist/i.test(path.basename(f))) continue;
  const s2 = read(f);
  const re = /<(?:input|select|textarea)\b[^>]*\bname="([A-Za-z0-9_]+)"/g; let m;
  while ((m = re.exec(s2))) { if (!boxKeys.has(m[1])) boxKeys.set(m[1], new Set()); boxKeys.get(m[1]).add(rel(f)); }
}
// 30-Oct-2026: how a box reaches storage, so the two very different cases are not reported as one.
//   A controlled box - value={jobData["eta"]} / {jobData.eta} with the shared onChange - puts its value in the job,
//   and every key of the job becomes a real column (utils/dynamicColumns), so it is saved and read back. It is only
//   absent from the ICEGATE message, which is right for operations information (ETA, CFS name, flight no, our own
//   job ref). An uncontrolled box is saved when the tab's save reads it as fd.get('key').
//   Before this the whole lot came out as "typed value goes nowhere", which put 13 false alarms in the import
//   module alone - enough to hide a real one. They are counted separately now and the save is the proof.
const ALL_FE = FE_FILES.map(read).join('\n');
// A box is "kept" when some state object of the screen carries the key - jobData["eta"], exportData.docketOwner,
// invoiceFormData.supplierSellerSame, tempIgstData.cessRate - because every key of the job / invoice / item becomes
// a real column on save (utils/dynamicColumns, used by routes/importJobs.js and routes/exportJobs.js), or when a
// tab's save reads it with fd.get('key'). A box with nothing but its name="..." anywhere is the real dead one.
const keptOnJob = (k) => {
  const bound = new RegExp('[A-Za-z_$][A-Za-z0-9_$]*\\s*(\\.' + k + '\\b|\\[[\'"]' + k + '[\'"]\\])');
  return bound.test(ALL_FE) || ALL_FE.includes("fd.get('" + k + "')") || ALL_FE.includes('fd.get("' + k + '")');
};
// 30-Oct-2026: a few screens save themselves by walking their own DOM - they collect every
// input / select / textarea inside a ref and PUT the lot (EcsdForm, and the Delivery Order / SLI /
// Consignment Security Declaration windows through useAwbExtraDoc). Every box in such a file IS
// saved, including radio groups, even though no code mentions the box's name. Reporting those as
// dead was a false positive: it sent me looking for a bug three times over.
// a radio / checkbox whose name is only the group label, because the element is controlled.
// Kept per file: the same name could be a real data key on another screen.
const CONTROLLED_RADIO = new Map();   // file -> Set(name)
for (const f of FE_FILES) {
  const src = read(f);
  const re = /<input[^>]*>/g; let m;
  const here = new Set();
  while ((m = re.exec(src))) {
    const tag = m[0];
    if (!/type=\s*["']?(radio|checkbox)/.test(tag)) continue;
    if (!/\bchecked=\{/.test(tag)) continue;
    const nm = /name="([A-Za-z0-9_]+)"/.exec(tag);
    if (nm) here.add(nm[1]);
  }
  if (here.size) CONTROLLED_RADIO.set(rel(f), here);
}
const isControlledRadioEverywhere = (k, files) =>
  [...files].every(f => (CONTROLLED_RADIO.get(f) || new Set()).has(k));

const DOM_WALK = /querySelectorAll\(\s*['"]input, ?select, ?textarea['"]|querySelectorAll\(\s*['"]input, ?textarea['"]/;
const domWalkFiles = new Set();
for (const f of FE_FILES) {
  const src = read(f);
  if (DOM_WALK.test(src) && /useAwbExtraDoc|method:\s*['"]PUT['"]|method:\s*['"]POST['"]/.test(src)) domWalkFiles.add(rel(f));
}
// a window that delegates its saving to the hook counts too
for (const f of FE_FILES) {
  const src = read(f);
  if (/useAwbExtraDoc\s*\(/.test(src)) domWalkFiles.add(rel(f));
}

const deadBoxes = [];
const savedOnly = [];
const domWalkSaved = [];
for (const [k, files] of boxKeys) {
  if (k.length < 3 || SCREEN_ONLY.test(k) || /^[0-9]+$/.test(k)) continue;
  if ([...files].every(f => domWalkFiles.has(f))) { domWalkSaved.push({ key: k, where: [...files][0] }); continue; }
  // 30-Oct-2026: on a radio, name="..." is the browser's group label, not a data key. When the same
  // element is controlled (checked={...}), the chosen value lives in whatever that expression reads -
  // e.g. name="default_addr" with checked={!!addr.default} stores it in addr.default. Reporting the
  // group label as a dead box was a false positive.
  if (isControlledRadioEverywhere(k, files)) continue;
  const inBuilder = builder.includes("." + k) || builder.includes("'" + k + "'") || builder.includes('"' + k + '"');
  const inBackend = backend.includes("'" + k + "'") || backend.includes('"' + k + '"') || backend.includes('.' + k);
  const inCols = formCols.includes('"' + k + '"') || formCols.includes("'" + k + "'");
  const readBack = [...screenKeys.get(k) || []].length > 1;
  if (inBuilder || inBackend || inCols || readBack) continue;
  if (keptOnJob(k)) savedOnly.push({ key: k, where: [...files][0] });
  else deadBoxes.push({ key: k, where: [...files][0] });
}

// --------------------------------------------------- 3. dead buttons / handlers
const deadButtons = [];
const unusedHandlers = [];
for (const f of FE_FILES) {
  const s = read(f);
  // <button ...> without onClick and without type="submit"
  // read the whole opening tag, not just up to the first ">" - an arrow function in an attribute contains one
  const re = /<button\b/g; let m;
  while ((m = re.exec(s))) {
    let k = m.index + 7, depth = 0, attrs = '';
    while (k < s.length) {
      const ch = s[k];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) break;
      attrs += ch; k++;
    }
    if (/onClick|type="submit"|disabled/.test(attrs)) continue;
    const label = (s.slice(m.index, m.index + 400).match(/>\s*([A-Za-z][A-Za-z0-9 .&/-]{2,40})\s*</) || [])[1] || '';
    deadButtons.push({ file: rel(f), label: label.trim(), line: s.slice(0, m.index).split('\n').length });
  }
  // const handleX = ... defined in a hook file but never named anywhere else
  if (/use[A-Z]/.test(path.basename(f))) {
    const hs = [...s.matchAll(/const (handle[A-Za-z0-9]+|open[A-Z][A-Za-z0-9]+)\s*=/g)].map(x => x[1]);
    for (const h of new Set(hs)) {
      const used = FE_FILES.some(g => g !== f && read(g).includes(h));
      const usedHere = (s.split(h).length - 1) > 2; // definition + export line only = not really used
      if (!used && !usedHere) unusedHandlers.push({ file: rel(f), handler: h });
    }
  }
}

// ------------------------------------------------------------------- 4. output
const H = (t) => console.log('\n' + t + '\n' + '-'.repeat(t.length));
let problems = 0;

H('1. ICEGATE message fields with no screen box');
if (!noBox.length) console.log('   none - every field the BE message carries can be filled on a screen');
for (const x of noBox) { problems++; console.log(`   ${x.model}: ${x.field}  <- reads ${x.reads.join(', ')}`); }

H('2. Screen boxes that nothing reads (typed value goes nowhere)');
if (!deadBoxes.length) console.log('   none');
for (const x of (full ? deadBoxes : deadBoxes.slice(0, 25))) { problems++; console.log(`   ${x.key}  (${x.where})`); }
if (!full && deadBoxes.length > 25) console.log(`   ... ${deadBoxes.length - 25} more (--full)`);
if (domWalkSaved.length) console.log(`   (${domWalkSaved.length} box(es) are in screens that save by walking their own form - every box in those is stored. Run with --domwalk to list them.)`);
if (process.argv.includes('--domwalk')) for (const x of domWalkSaved) console.log(`   domwalk: ${x.key}  (${x.where})`);

console.log(`   (${savedOnly.length} more box(es) are kept on the job but are not in the ICEGATE message - operations`
  + ` information, e.g. ETA / CFS / our own job ref. Run with --saved to list them.)`);
if (process.argv.includes('--saved')) for (const x of savedOnly) console.log(`     ${x.key}  (${x.where})`);

H('3. Buttons with no handler');
if (!deadButtons.length) console.log('   none');
for (const x of (full ? deadButtons : deadButtons.slice(0, 25))) { problems++; console.log(`   ${x.file}:${x.line}  "${x.label}"`); }
if (!full && deadButtons.length > 25) console.log(`   ... ${deadButtons.length - 25} more (--full)`);

H('4. Handlers defined but never wired to anything');
if (!unusedHandlers.length) console.log('   none');
for (const x of (full ? unusedHandlers : unusedHandlers.slice(0, 25))) { problems++; console.log(`   ${x.handler}  (${x.file})`); }
if (!full && unusedHandlers.length > 25) console.log(`   ... ${unusedHandlers.length - 25} more (--full)`);

console.log(`\n${problems} thing(s) to look at. Screen keys seen: ${screenKeys.size}. Frontend files read: ${FE_FILES.length}.`);
