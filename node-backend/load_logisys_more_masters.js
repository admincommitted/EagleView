// More masters read from Logi-Sys (system directories, read only, 21-Nov-2026) - ADD ONLY.
// Source: _tariff_load/logisys_more_masters_20261121.json (the whole Logi-Sys lists; what is missing is worked out
// against THIS database when the script runs).
//   add        anti-dumping rows -> AddDutyRates. A notification already there (same number) is skipped WHOLE.
//   rsp        RSP abatement by CETH -> RspAbatements. A CETH already there is skipped.
//   bcd        BCD % by tariff code -> TariffComponents, only for a code that IS in the Tariff master and has NO BCD row.
//   vessels    -> Vessels. A name already there is skipped.
//   ports      world ports (UN/LOCODE) -> ForeignPorts. A code already there is skipped.
//   countries  -> Countries. A code already there is skipped.
// Nothing is changed or deleted; one transaction; a second run adds nothing. Rates are as Logi-Sys shows them - they
// were NOT checked against CBIC. The result file has the counts, the ids added and the undo statements. No DB copy is made.
//   node load_logisys_more_masters.js --check            (writes nothing)
//   node load_logisys_more_masters.js [--only=add,rsp]   (lists to load; default all but bcd)
//   node load_logisys_more_masters.js --only=bcd         (the BCD rates alone)
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const DATA = path.join(__dirname, '_tariff_load', 'logisys_more_masters_20261121.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const LOG = path.join(__dirname, '_tariff_load', 'logisys_more_masters_result_' + stamp + '.txt');
const CHECK = process.argv.includes('--check');
const onlyArg = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const ALL = ['add', 'rsp', 'bcd', 'vessels', 'ports', 'countries'];
// the BCD rates are loaded only when asked for (--with-bcd or --only=bcd): several of the codes are old headings
// (9009, 2851, 22082010 at 182 %) and a wrong rate would be offered on the item screen
const ONLY = onlyArg ? onlyArg.split(',').map((s) => s.trim().toLowerCase()).filter((s) => ALL.includes(s)) : ALL.filter((k) => k !== 'bcd' || process.argv.includes('--with-bcd'));

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const log = []; const say = (s) => { console.log(s); log.push(s); };
const U = (v) => String(v === null || v === undefined ? '' : v).trim().toUpperCase();
// "1/2019", "001/2019", "001/19" are one notification
const normNo = (v) => { const m = /^0*(\d+)\s*\/\s*(\d{2,4})$/.exec(U(v)); if (!m) return U(v); const y = m[2].length === 2 ? (Number(m[2]) > 50 ? '19' : '20') + m[2] : m[2]; return m[1].padStart(3, '0') + '/' + y; };
const colsOf = async (t) => (await all(`PRAGMA table_info(${t})`)).map((c) => c.name);
// INSERT with only the columns the table has (isActive / createdAt may be missing on an older table)
const insert = async (t, cols, obj) => { const ks = Object.keys(obj).filter((k) => cols.includes(k)); return run(`INSERT INTO ${t} (${ks.join(', ')}) VALUES (${ks.map(() => '?').join(', ')})`, ks.map((k) => obj[k])); };

(async () => {
  let open = false;
  try {
    await run('PRAGMA busy_timeout = 60000');
    const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    say(CHECK ? 'CHECK ONLY - nothing is written.' : 'Loading more Logi-Sys masters (add only).');
    if (!CHECK) { await run('BEGIN IMMEDIATE'); open = true; }
    const undo = [];
    const done = async (name, t, inFile, ids, skipped, note) => {
      say(`${name}: in the file ${inFile}, ${CHECK ? 'would add' : 'added'} ${ids.n}, skipped (already there) ${skipped}${note ? ' - ' + note : ''}.`);
      if (!CHECK && ids.n) undo.push(`  DELETE FROM ${t} WHERE id BETWEEN ${ids.first} AND ${ids.last};   -- ${ids.n} row(s) of ${name}`);
    };
    const track = () => ({ n: 0, first: null, last: null, hit(r) { this.n++; if (r) { if (this.first === null) this.first = r.lastID; this.last = r.lastID; } } });

    if (ONLY.includes('add')) {
      const t = 'AddDutyRates'; const cols = await colsOf(t);
      if (!cols.length) say('Anti-dumping: table AddDutyRates is not in this database - skipped.');
      else {
        const have = new Set((await all(`SELECT DISTINCT notifNo FROM ${t}`)).map((r) => normNo(r.notifNo)));
        const ids = track(); let skipped = 0; const notns = new Set(), skNotns = new Set();
        for (const r of data.add) {
          const n = normNo(r[0]);
          if (have.has(n)) { skipped++; skNotns.add(n); continue; }
          notns.add(n);
          const calc = String(r[14] || ''); const flag = /^specific/i.test(calc) ? 'S' : /^%age/i.test(calc) ? 'A' : null;
          const memo = [calc && !flag ? calc : '', r[11] ? 'Exporter: ' + r[11] : '', r[12] && r[12] !== r[11] ? 'Producer: ' + r[12] : '', r[13] || ''].filter(Boolean).join(' | ').slice(0, 600) || null;
          const ts = now();
          ids.hit(CHECK ? null : await insert(t, cols, { notifNo: n, serialNo: r[1] || null, cthSlNo: r[3] || null, cth: r[2], specSeries: r[4] || null, originCountry: r[5] || null, exportCountry: r[6] || null,
            flag, rate: r[10], amount: r[7], uqc: r[8] || null, currency: r[9] || null, factor: 1, memorandum: memo, isActive: 1, createdAt: ts, updatedAt: ts }));
        }
        await done('Anti-dumping rows', t, data.add.length, ids, skipped, `${notns.size} notification(s) added, ${skNotns.size} already in the master`);
      }
    }
    if (ONLY.includes('rsp')) {
      const t = 'RspAbatements'; const cols = await colsOf(t);
      if (!cols.length) say('RSP: table RspAbatements is not in this database - skipped.');
      else {
        const have = new Set((await all(`SELECT cethCode FROM ${t}`)).map((r) => U(r.cethCode)));
        const desc = new Map((await all('SELECT hsnCode, description FROM TariffHeaders').catch(() => [])).map((r) => [String(r.hsnCode), r.description]));
        const ids = track(); let skipped = 0;
        for (const [ceth, rate] of data.rsp) {
          if (have.has(ceth)) { skipped++; continue; } have.add(ceth);
          const ts = now();
          ids.hit(CHECK ? null : await insert(t, cols, { cethCode: ceth, description: String(desc.get(ceth) || 'RSP ABATEMENT (LOGI-SYS LIST)').slice(0, 250), abatementRate: rate, isActive: 1, createdAt: ts, updatedAt: ts }));
        }
        await done('RSP abatement', t, data.rsp.length, ids, skipped);
      }
    }
    if (ONLY.includes('bcd')) {
      const t = 'TariffComponents'; const cols = await colsOf(t);
      const heads = new Map((await all('SELECT id, hsnCode FROM TariffHeaders').catch(() => [])).map((r) => [String(r.hsnCode), r.id]));
      if (!cols.length || !heads.size) say('BCD: the Tariff master tables are not in this database - skipped.');
      else {
        const hasBcd = new Set((await all(`SELECT DISTINCT tariffHeaderId FROM ${t} WHERE upper(dutyCategory) LIKE '%BCD%' OR upper(dutyCategory) LIKE '%BASIC%'`)).map((r) => r.tariffHeaderId));
        const ids = track(); let skipped = 0, noCode = 0; const list = [];
        for (const [code, rate] of data.bcd) {
          const id = heads.get(code);
          if (!id) { noCode++; continue; }
          if (hasBcd.has(id)) { skipped++; continue; } hasBcd.add(id); list.push(code + ' ' + rate + '%');
          const ts = now();
          ids.hit(CHECK ? null : await insert(t, cols, { dutyCategory: 'BCD', calculationFlag: 'A', rate, amount: 0, uqc: '', tariffHeaderId: id, createdAt: ts, updatedAt: ts }));
        }
        await done('BCD rate on tariff codes that had none', t, data.bcd.length, ids, skipped, `${noCode} code(s) are not in the Tariff master (not added)`);
        if (list.length) say('  codes: ' + list.join(', '));
      }
    }
    if (ONLY.includes('vessels')) {
      const t = 'Vessels'; const cols = await colsOf(t);
      if (!cols.length) say('Vessels: table is not in this database - skipped.');
      else {
        const have = new Set((await all(`SELECT vesselName FROM ${t}`)).map((r) => U(r.vesselName)));
        const ids = track(); let skipped = 0;
        for (const [name, imo, call, line] of data.vessels) {
          if (have.has(U(name))) { skipped++; continue; } have.add(U(name));
          const ts = now();
          ids.hit(CHECK ? null : await insert(t, cols, { vesselName: U(name), imoNumber: imo || '', callSign: call || null, carrierAgent: line ? U(line) : null, isActive: 1, createdAt: ts, updatedAt: ts }));
        }
        await done('Vessels', t, data.vessels.length, ids, skipped, 'Logi-Sys has no IMO number for most of them - the IMO box is empty');
      }
    }
    if (ONLY.includes('ports')) {
      const t = 'ForeignPorts'; const cols = await colsOf(t);
      if (!cols.length) say('World ports: table ForeignPorts is not in this database - skipped.');
      else {
        const have = new Set((await all(`SELECT code FROM ${t}`)).map((r) => U(r.code)));
        const ids = track(); let skipped = 0, india = 0;
        for (const [code, name, cc] of data.ports) {
          if (have.has(code)) { skipped++; continue; } have.add(code); if (cc === 'IN') india++;
          const ts = now();
          ids.hit(CHECK ? null : await insert(t, cols, { code, name, countryCode: cc, isActive: 1, createdAt: ts, updatedAt: ts }));
        }
        await done('World ports (UN/LOCODE)', t, data.ports.length, ids, skipped, `${india} of the new ones are Indian`);
      }
    }
    if (ONLY.includes('countries')) {
      const t = 'Countries'; const cols = await colsOf(t);
      if (!cols.length) say('Countries: table is not in this database - skipped.');
      else {
        const have = new Set((await all(`SELECT code FROM ${t}`)).map((r) => U(r.code)));
        const ids = track(); let skipped = 0; const list = [];
        for (const [code, name] of data.countries) {
          if (have.has(code)) { skipped++; continue; } have.add(code); list.push(code + ' ' + name);
          const ts = now();
          ids.hit(CHECK ? null : await insert(t, cols, { code, name, createdAt: ts, updatedAt: ts }));
        }
        await done('Countries', t, data.countries.length, ids, skipped, list.join(', '));
      }
    }
    if (!CHECK) { await run('COMMIT'); open = false; if (undo.length) { say('Undo (only if needed):'); undo.forEach((u) => say(u)); } }
    say('DONE');
  } catch (e) {
    if (open) { try { await run('ROLLBACK'); } catch (x) { /* nothing to roll back */ } }
    say('FAILED - nothing was written: ' + e.message);
    process.exitCode = 1;
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n') + '\r\n'); console.log('Result file: ' + LOG); } catch (e) { /* the screen has it */ }
    db.close();
  }
})();
