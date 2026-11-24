// iCAFFE GST invoice remarks into the GST invoice register (09-Nov-2026).
// Source: _tariff_load\icaffe_invoice_remarks_YYYYMMDD.json(.gz) - read (read only) from iCAFFE's GST Invoice > Search
//   (InfoAgent.GetInvoiceListWithStatus) for every branch, division and invoice type from 01-Apr-2022:
//   {"rows":[[billNo, billDate dd/mm/yyyy, remark, billId, voucherMasId, invoiceType], ...], "counts":{...}}
// What it does:
//   - a bill loaded from iCAFFE (createdBy = 'iCAFFE') gets iCAFFE's own remark in AccSalesInvoices.remarks;
//   - the loader's note "Loaded from iCAFFE Sales Register" on the other iCAFFE bills is cleared (blank remark), since
//     those bills have no remark in iCAFFE.
//   Bills made in EagleView are never touched. No voucher is made or changed.
// One transaction; a full copy of the database is written to backups\ first. --check = dry run, nothing saved.
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const TL = path.join(__dirname, '_tariff_load');
// every file read (the 09-Nov read came in two parts: import / common types, then the export Service type)
const SRCS = process.env.EDI_SRC ? process.env.EDI_SRC.split(';') : (fs.existsSync(TL) ? fs.readdirSync(TL).filter(f => /^icaffe_invoice_remarks_\d+.*\.json(\.gz)?$/.test(f)).sort().map(f => path.join(TL, f)) : []);
const SRC = SRCS[0] || null;
const DRY = process.argv.includes('--check');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_icaffe_invoice_remarks_' + stamp + '.sqlite');
const LOG = path.join(SRC ? path.dirname(SRC) : TL, 'icaffe_invoice_remarks_result_' + stamp + '.txt');
const NOTE = 'Loaded from iCAFFE%';

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const log = []; const say = (s) => { console.log(s); log.push(s); };
const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 500);
const ymd = (d) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(d || '').trim()); return m ? m[3] + '-' + m[2] + '-' + m[1] : null; };

(async () => {
  try {
    if (!SRCS.length) throw new Error('No icaffe_invoice_remarks_*.json(.gz) in ' + TL);
    const rowsIn = []; let bills = 0;
    for (const f of SRCS) {
      let buf = fs.readFileSync(f); if (/\.gz$/.test(f)) buf = zlib.gunzipSync(buf);
      const data = JSON.parse(buf.toString('utf8'));
      const n = Object.values(data.counts || {}).reduce((a, b) => a + b, 0); bills += n;
      say('Source: ' + f + ' - ' + n + ' bills read in iCAFFE, ' + (data.rows || []).length + ' with a remark');
      rowsIn.push(...(data.rows || []));
    }
    say('Bills read in iCAFFE (all files): ' + bills);
    const src = new Map(); let dup = 0;
    for (const r of rowsIn) {
      const no = clean(r[0]).toUpperCase(); const rem = clean(r[2]); if (!no || !rem) continue;
      if (src.has(no) && src.get(no).rem !== rem) dup++;
      src.set(no, { rem, date: ymd(r[1]) });
    }
    say('Bills with a remark in iCAFFE: ' + src.size + (dup ? ' (' + dup + ' bill nos read twice with a different remark - the last one kept)' : ''));

    const inv = await all("SELECT id, upper(trim(invoiceNo)) no, date, remarks, createdBy FROM AccSalesInvoices");
    const byNo = new Map(inv.map(r => [r.no, r]));
    let set = 0, same = 0, ours = 0, dateDiff = 0; const missing = [];
    const plan = [];
    for (const [no, s] of src) {
      const r = byNo.get(no);
      if (!r) { missing.push(no); continue; }
      if (r.createdBy !== 'iCAFFE') { ours++; continue; } // made in EagleView - not touched
      if (s.date && r.date && s.date !== String(r.date).slice(0, 10)) dateDiff++;
      if (r.remarks === s.rem) { same++; continue; }
      plan.push([s.rem, r.id]); set++;
    }
    const note = inv.filter(r => r.createdBy === 'iCAFFE' && /^Loaded from iCAFFE/i.test(String(r.remarks || '')) && !src.has(r.no)).length;
    say('EagleView bills that get iCAFFE\'s remark: ' + set + (same ? ', already the same: ' + same : ''));
    say('iCAFFE bills with no remark in iCAFFE - loader note cleared (blank): ' + note);
    if (ours) say('Bill nos that are EagleView-made bills (left as they are): ' + ours);
    if (dateDiff) say('Bill date differs from iCAFFE on ' + dateDiff + ' bills (remark still set - same bill no)');
    say('Remarks read from iCAFFE for bills not in EagleView: ' + missing.length + (missing.length ? ' e.g. ' + missing.slice(0, 15).join(', ') : ''));

    if (!DRY) { fs.mkdirSync(path.dirname(BACKUP), { recursive: true }); say('Backup: ' + BACKUP); await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'"); }
    await run('BEGIN IMMEDIATE');
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    for (const [rem, id] of plan) await run("UPDATE AccSalesInvoices SET remarks = ?, updatedAt = ? WHERE id = ? AND createdBy = 'iCAFFE'", [rem, now, id]);
    const c = await run("UPDATE AccSalesInvoices SET remarks = NULL WHERE createdBy = 'iCAFFE' AND remarks LIKE ?", [NOTE]);
    say('Rows updated: ' + plan.length + ' remarks set, ' + c.changes + ' loader notes cleared');
    if (DRY) { await run('ROLLBACK'); say('Check only (--check) - nothing saved.'); } else { await run('COMMIT'); say('Done.'); }
  } catch (e) {
    say('ERROR: ' + e.message); try { await run('ROLLBACK'); } catch (x) { /* none open */ }
    process.exitCode = 1;
  } finally {
    try { fs.writeFileSync(LOG, log.join('\n')); console.log('Log: ' + LOG); } catch (e) { /* ignore */ }
    db.close();
  }
})();
