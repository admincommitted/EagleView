// iCAFFE vouchers (Apr-2022 to date) into EagleView accounts (05-Nov-2026).
// Source: _tariff_load\icaffe_vouchers.json.gz - read from iCAFFE's Ledger report (all branches & divisions, without opening,
//   one month at a time; every month checked Dr = Cr per voucher before it was saved). One record per account line:
//   account name, voucher no, date, iCAFFE voucher type, Dr, Cr, docket / cheque details, branch, division.
// What it does:
//   - each iCAFFE voucher becomes one Voucher (status Approved, made by "iCAFFE") with its account lines in VoucherDetails;
//   - accounts are found by name among the ledgers loaded from iCAFFE (load_icaffe_accounts); only iCAFFE accounts listed
//     in the file as new (made in iCAFFE after its account master was read) are made, under their iCAFFE group;
//     a voucher with an account not found is left out whole (so the books stay Dr = Cr) and listed in the log;
//   - voucher type from iCAFFE's type (bank / cash receipt & payment, contra, journal, sales invoices, credit note,
//     trade / non-trade purchase); branch and division from the report; job no = docket; ref no = cheque / UTR no;
//   - Vouchers.icaffeRef (= voucher no | date) and icaffeSig (its lines) mark what came from iCAFFE. A re-run with a newer
//     read of some months keeps EagleView the same as iCAFFE for those months: new vouchers are added, vouchers changed in
//     iCAFFE are replaced, vouchers no longer in iCAFFE are removed. Vouchers made in EagleView itself are never touched,
//     nor is an iCAFFE voucher that has bills set off against it in EagleView (listed instead).
//   Extra files: node load_icaffe_vouchers.js [--check] file2.json.gz ... (a month is taken from the last file that has it)
// Bill-wise set-off is not in iCAFFE's ledger report, so receipts / payments are not tied to bills (on account).
// One transaction; a full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');
const crypto = require('crypto');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const extra = process.argv.slice(2).filter(a => !a.startsWith('--'));
// default: the full read, then every later top-up read (icaffe_vouchers_update_YYYYMMDD_HHMM.json.gz) in date order
const TL = path.join(__dirname, '_tariff_load');
const defaults = () => [path.join(TL, 'icaffe_vouchers.json.gz')].concat((fs.existsSync(TL) ? fs.readdirSync(TL) : []).filter(f => /^icaffe_vouchers_update_.*\.json\.gz$/.test(f)).sort().map(f => path.join(TL, f)));
const SRCS = (process.env.EDI_SRC ? process.env.EDI_SRC.split(';') : defaults()).concat(extra).filter(Boolean);
const SRC = SRCS[SRCS.length - 1];
const DRY = process.argv.includes('--check');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_icaffe_vouchers_' + stamp + '.sqlite');
const LOG = path.join(path.dirname(SRC), 'icaffe_vouchers_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const log = []; const say = (s) => { console.log(s); log.push(s); };

const norm = (s) => String(s || '').toUpperCase().replace(/&AMP;/g, '&').replace(/\s+/g, ' ').trim();
const ymd = (d) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(d || '')); return m ? m[3] + '-' + m[2] + '-' + m[1] : null; };
const BRANCH = { 'NEW DELHI': 'DEL', DELHI: 'DEL', MUMBAI: 'MUM', JAIPUR: 'JPR', LUDHIANA: 'LDH' };
const BRCODE = { NDL: 'DEL', MUM: 'MUM', JPR: 'JPR', LDH: 'LDH' };
const DIV = { 'EXPORT AIR': 'AE', 'IMPORT AIR': 'AI', 'EXPORT SEA': 'SE', 'IMPORT SEA': 'SI' };
const STATE_BR = { DL: 'DEL', MH: 'MUM', RJ: 'JPR', PB: 'LDH' };
// iCAFFE voucher type -> EagleView voucher type (by base name)
function typeOf(t, vno) {
  const s = norm(t).replace(/\s*\(TDS\)\s*$/, '');
  if (/^(BANK|CASH) TO (BANK|CASH)$/.test(s)) return 'Contra';
  if (/^(BANK|CASH) RECEIPT/.test(s)) return 'Receipt';
  if (/^(BANK|CASH) PAY/.test(s)) return 'Payment';
  if (/CREDIT NOTE/.test(s)) return 'Credit Note';
  if (/DEBIT NOTE/.test(s)) return 'Debit Note';
  if (/TRADE INVOICE|TRADE REVERSE|NONTRADE|NON TRADE|INVOICE INWARD/.test(s)) return 'Purchase';
  if (/^(SERVICE|OTHER|REIMBURSABLE|CONSULTANCY|COURIER|CAN|TIEUP|FREIGHT|BULK FREIGHT|OVERSEAS)/.test(s)) return 'Sales';
  if (/^BA\//.test(vno)) return /RECEIPT/.test(s) ? 'Receipt' : 'Payment';
  if (/^CA\//.test(vno)) return /RECEIPT/.test(s) ? 'Receipt' : 'Payment';
  return 'Journal';
}
// docket / cheque details iCAFFE prints with each line: "NDL/AI/8201/26\nCQ No.:X\nDt.:..\nHWB No.:..\nMAWB No.:.."
function details(s) {
  const t = String(s || '');
  const first = t.split('\n')[0].trim();
  const dk = (first.match(/[A-Z]{3}\/(?:AE|AI|SE|SI)\/\d+\/\d{2}/) || [])[0] || null;
  const cq = ((t.match(/CQ No\.:([^\n]*)/) || [])[1] || '').trim() || null;
  return { docket: dk, chq: cq };
}

(async () => {
  try {
    // Several files may be given (EDI_SRC = a;b, or the extra files after the options): the full history first, then
    // later top-ups. A month found in more than one file is taken from the LAST file that has it.
    // Each file: one JSON per line - a month {"m":"2026-10","V":[...],"L":[...]}, the account names {"m":"ACC","A":[...]}
    // and optionally iCAFFE accounts that were not in the account master read earlier {"m":"NEWACC","A":[{...}]}.
    const files = SRCS;
    const eachPart = async (file, fn) => {
      const rl = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
      for await (const line of rl) { if (!line.trim()) continue; for (const p of line.split(/(?<=\})(?=\{\s*"m"\s*:)/)) await fn(p); }
    };
    const kindOf = (p) => ((/^\s*\{\s*"m"\s*:\s*"([^"]*)"/.exec(p) || [])[1] || '');
    const fileInfo = []; const monthFile = new Map();
    for (let fi = 0; fi < files.length; fi++) {
      const info = { file: files[fi], accL: null, newAcc: [], months: [] };
      await eachPart(files[fi], async (p) => {
        const k = kindOf(p);
        if (k === 'ACC') info.accL = JSON.parse(p).A;
        else if (k === 'NEWACC') info.newAcc = JSON.parse(p).A || [];
        else if (/^\d{4}-\d{2}$/.test(k)) { info.months.push(k); monthFile.set(k, fi); }
      });
      if (!info.accL) throw new Error('account list missing in ' + files[fi]);
      info.months.sort();
      say('Source: ' + files[fi] + ' - ' + info.months.length + ' months' + (info.months.length ? ' (' + info.months[0] + ' to ' + info.months[info.months.length - 1] + ')' : '') + ', ' + info.accL.length + ' account names' + (info.newAcc.length ? ', ' + info.newAcc.length + ' new iCAFFE accounts' : ''));
      fileInfo.push(info);
    }
    await run('PRAGMA busy_timeout = 30000');
    if (!DRY) {
      fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
      say('Backup: ' + BACKUP);
      await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");
    }
    await run('BEGIN IMMEDIATE');
    const vc = new Set((await all('PRAGMA table_info(Vouchers)')).map(c => c.name));
    if (!vc.has('division')) await run('ALTER TABLE Vouchers ADD COLUMN division TEXT');
    if (!vc.has('icaffeRef')) { await run('ALTER TABLE Vouchers ADD COLUMN icaffeRef TEXT'); say('Vouchers: column added icaffeRef'); }
    if (!vc.has('icaffeType')) await run('ALTER TABLE Vouchers ADD COLUMN icaffeType TEXT');
    if (!vc.has('icaffeSig')) await run('ALTER TABLE Vouchers ADD COLUMN icaffeSig TEXT');
    await run('CREATE INDEX IF NOT EXISTS idx_Vouchers_icaffeRef ON Vouchers (icaffeRef)');
    await run('CREATE INDEX IF NOT EXISTS idx_Vouchers_date ON Vouchers (date)');
    await run('CREATE INDEX IF NOT EXISTS idx_Vouchers_voucherNumber ON Vouchers (voucherNumber)');
    await run('CREATE INDEX IF NOT EXISTS idx_VoucherDetails_ledgerId ON VoucherDetails (ledgerId)');
    const S = new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00'); // 14-Nov-2026: the form Sequelize (SQLite) reads; 'T...Z' came back as null (job created time, timeline)

    // iCAFFE accounts made after the account master was read: made here, under their iCAFFE group (nothing else is made)
    const lc = new Set((await all('PRAGMA table_info(AccountLedgers)')).map(c => c.name));
    const gc = new Set((await all('PRAGMA table_info(AccountGroups)')).map(c => c.name));
    for (const info of fileInfo) for (const a of info.newAcc) {
      const useId = lc.has('icaffeId') && a.icaffeId;
      const exists = (await all('SELECT id FROM AccountLedgers WHERE ' + (useId ? 'icaffeId = ? OR ' : '') + 'upper(trim(name)) = ?', useId ? [a.icaffeId, norm(a.name)] : [norm(a.name)]))[0];
      if (exists) continue;
      const g = gc.has('icaffeId') ? (await all('SELECT id FROM AccountGroups WHERE icaffeId = ?', [a.groupIcaffeId]))[0] : null;
      const g2 = g || (await all('SELECT id FROM AccountGroups WHERE upper(trim(name)) = ?', [norm(a.groupName)]))[0];
      if (!g2) { say('  New account ' + a.name + ' (' + a.icaffeId + '): group ' + (a.groupName || a.groupIcaffeId) + ' not found - not made'); continue; }
      const cols = ['name', 'groupId', 'openingBalance', 'balanceType', 'createdAt', 'updatedAt']; const vals = [String(a.name).trim(), g2.id, Math.abs(+a.opening || 0), (+a.opening || 0) < 0 ? 'Cr' : 'Dr', S, S];
      if (useId) { cols.push('icaffeId'); vals.push(a.icaffeId); }
      if (lc.has('pan') && a.pan) { cols.push('pan'); vals.push(a.pan); }
      await run('INSERT INTO AccountLedgers (' + cols.join(', ') + ') VALUES (' + cols.map(() => '?').join(', ') + ')', vals);
      say('  New account made: ' + a.name + (a.icaffeId ? ' (' + a.icaffeId + ')' : '') + ' under ' + (a.groupName || a.groupIcaffeId));
    }

    // ledgers: name -> id (iCAFFE ledgers first; " - ACC/x" added to duplicate names on load is ignored here)
    const led = await all('SELECT id, name' + (lc.has('icaffeId') ? ', icaffeId' : '') + ' FROM AccountLedgers' + (lc.has('icaffeId') ? ' ORDER BY (icaffeId IS NULL), id' : ' ORDER BY id'));
    const byName = new Map();
    for (const l of led) { const k = norm(String(l.name).replace(/ - ACC\/\d+$/, '')); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(l.id); }
    // iCAFFE's system account "ROUND OFF A/C" is not in its account master: it is EagleView's own Round Off ledger
    const ALIAS = { 'ROUND OFF A/C': ['ROUND OFF A/C', 'ROUND OFF', 'ROUND OFF ACCOUNT', 'ROUNDING OFF'] };
    const find = (n) => { for (const k of (ALIAS[norm(n)] || [norm(n)])) { const h = byName.get(k); if (h) return h; } return null; };
    for (const info of fileInfo) {
      info.accId = info.accL.map(n => { const h = find(n); return h ? h[0] : null; });
      const dupNames = info.accL.filter(n => (find(n) || []).length > 1);
      const missing = info.accL.filter((n, i) => !info.accId[i]);
      say('Accounts (' + path.basename(info.file) + '): ' + (info.accL.length - missing.length) + ' found, ' + missing.length + ' not found' + (dupNames.length ? ', ' + dupNames.length + ' names used by two ledgers (first one used): ' + dupNames.join('; ') : ''));
      if (missing.length) say('  Not found: ' + missing.slice(0, 60).join('; ') + (missing.length > 60 ? ' ...' : ''));
    }

    const types = new Map((await all('SELECT id, name FROM VoucherTypes')).map(t => [t.name, t.id]));
    for (const n of ['Contra', 'Payment', 'Receipt', 'Journal', 'Sales', 'Purchase', 'Credit Note', 'Debit Note']) if (!types.has(n)) throw new Error('Voucher type missing: ' + n);
    const haveN = (await all('SELECT count(*) n FROM Vouchers WHERE icaffeRef IS NOT NULL'))[0].n;
    say('Already loaded from iCAFFE before: ' + haveN + ' vouchers');
    // vouchers another voucher is set off against (or that carry a set-off) are never removed by a re-run
    const ac = new Set((await all('PRAGMA table_info(VoucherAllocations)').catch(() => [])).map(c => c.name));
    const tied = ac.size ? new Set((await all('SELECT voucherId id FROM VoucherAllocations UNION SELECT againstVoucherId FROM VoucherAllocations WHERE againstVoucherId IS NOT NULL')).map(r => r.id)) : new Set();

    const insV = db.prepare('INSERT INTO Vouchers (voucherTypeId, voucherNumber, date, narration, totalAmount, createdAt, updatedAt, status, jobNo, branchCode, refNo, createdByName, division, icaffeRef, icaffeType, icaffeSig) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const insD = db.prepare('INSERT INTO VoucherDetails (voucherId, ledgerId, dc, amount, createdAt, updatedAt, remarks) VALUES (?,?,?,?,?,?,?)');
    const pv = (a) => new Promise((ok, no) => insV.run(a, function (e) { e ? no(e) : ok(this.lastID); }));
    let pdErr = null; const pd = (a) => insD.run(a, (e) => { if (e && !pdErr) pdErr = e; });
    const sigOf = (ls, accL) => crypto.createHash('md5').update(ls.map(L => norm(accL[L[0]]) + '|' + (+L[2] || 0).toFixed(2) + '|' + (+L[3] || 0).toFixed(2)).sort().join(';')).digest('hex').slice(0, 16);

    let tv = 0, tl = 0, skipped = 0, already = 0, changed = 0, removed = 0, keptTied = 0, totDr = 0, totCr = 0; const skippedList = []; const typeCount = {}; const changeList = [];
    for (let fi = 0; fi < fileInfo.length; fi++) {
      const info = fileInfo[fi]; const { accL, accId } = info;
      await eachPart(info.file, async (part) => {
        if (!/^\d{4}-\d{2}$/.test(kindOf(part))) return;
        const mo = JSON.parse(part);
        if (monthFile.get(mo.m) !== fi) return; // a later file has this month
        // what EagleView already has from iCAFFE for this month
        const inDb = new Map((await all("SELECT id, icaffeRef, icaffeSig FROM Vouchers WHERE icaffeRef IS NOT NULL AND substr(date, 1, 7) = ?", [mo.m])).map(r => [r.icaffeRef, r]));
        const lines = new Map(); // voucher index -> lines
        for (const L of mo.L) { if (!lines.has(L[1])) lines.set(L[1], []); lines.get(L[1]).push(L); }
        const seen = new Set();
        let mv = 0, ml = 0, mc = 0, mr = 0;
        const drop = async (id) => { await run('DELETE FROM VoucherDetails WHERE voucherId = ?', [id]); await run('DELETE FROM Vouchers WHERE id = ?', [id]); };
        for (let vi = 0; vi < mo.V.length; vi++) {
          const [vno, d, vt, brName, divName, narr] = mo.V[vi];
          const ls = lines.get(vi) || [];
          const date = ymd(d); const ref = vno + '|' + d;
          if (!date || !ls.length) continue;
          seen.add(ref);
          const sig = sigOf(ls, accL);
          const old = inDb.get(ref);
          if (old && (!old.icaffeSig || old.icaffeSig === sig)) { already++; continue; }
          if (old && tied.has(old.id)) { keptTied++; if (changeList.length < 40) changeList.push(vno + ' ' + d + ' changed in iCAFFE but kept (bills are set off against it here)'); continue; }
          if (ls.some(L => !accId[L[0]])) { skipped++; if (skippedList.length < 40) skippedList.push(vno + ' ' + d + ' (' + ls.filter(L => !accId[L[0]]).map(L => accL[L[0]]).join(', ') + ')'); continue; }
          let dr = 0, cr = 0; for (const L of ls) { dr += +L[2] || 0; cr += +L[3] || 0; }
          if (Math.abs(dr - cr) > 0.05) { skipped++; if (skippedList.length < 40) skippedList.push(vno + ' ' + d + ' Dr ' + dr.toFixed(2) + ' <> Cr ' + cr.toFixed(2)); continue; }
          if (old) { await drop(old.id); mc++; if (changeList.length < 40) changeList.push(vno + ' ' + d + ' changed in iCAFFE - replaced'); }
          const base = typeOf(vt, vno); typeCount[base] = (typeCount[base] || 0) + 1;
          const m = /^[A-Z]{2}\/([A-Z]{3})\/(AE|AI|SE|SI)\//.exec(vno) || [];
          const st = /^([A-Z]{2})\/\d{2}\//.exec(vno) || [];
          const branch = BRANCH[norm(brName)] || BRCODE[m[1]] || STATE_BR[st[1]] || null;
          const division = DIV[norm(divName)] || m[2] || null;
          let docket = null, chq = null; for (const L of ls) { const x = details(L[4]); docket = docket || x.docket; chq = chq || x.chq; }
          // 09-Nov-2026: a sales bill's own docket is the one its narration names ("DOCKET#NDL/AE/854/26"); the first line's
          // docket was another one on about 5,500 bills (see fix_voucher_jobno.js)
          { const nd = /DOCKET#\s*([A-Z]{2,4}\/[A-Z]{2}\/\d+\/\d{2})/i.exec(narr || ''); if (nd) docket = nd[1].toUpperCase(); }
          // iCAFFE gives some vouchers no number (tie-up / overseas agent bills, some credit notes): the reader keys them
          // "NN/<hash of date, type, agent invoice>"; here they are shown as TIEUP/<agent invoice no> when it is known
          const nnInv = /^NN\//.test(vno) ? (((/INV#(.*?) DT\./.exec(narr || '') || [])[1]) || '').trim() : '';
          const shownNo = /^NN\//.test(vno) ? (nnInv ? ('TIEUP/' + nnInv).slice(0, 120) : vno) : vno;
          const vid = await pv([types.get(base), shownNo, date, narr || null, Math.round(dr * 100) / 100, S, S, 'Approved', docket, branch, (chq || nnInv) ? (chq || nnInv).slice(0, 80) : null, 'iCAFFE', division, ref, vt, sig]);
          for (const L of ls) {
            const rem = String(L[6] || '').replace(/\s+/g, ' ').trim().slice(0, 300) || null;
            if (+L[2]) { pd([vid, accId[L[0]], 'Dr', +L[2], S, S, rem]); ml++; }
            if (+L[3]) { pd([vid, accId[L[0]], 'Cr', +L[3], S, S, rem]); ml++; }
          }
          totDr += dr; totCr += cr; if (!old) mv++;
        }
        // deleted (or re-dated) in iCAFFE since the last load
        for (const [ref, r] of inDb) {
          if (seen.has(ref)) continue;
          if (tied.has(r.id)) { keptTied++; if (changeList.length < 40) changeList.push(ref + ' no longer in iCAFFE but kept (bills are set off against it here)'); continue; }
          await drop(r.id); mr++; if (changeList.length < 40) changeList.push(ref + ' no longer in iCAFFE - removed');
        }
        await all('SELECT 1'); // waits for this month's line inserts (statements run in order)
        tv += mv; tl += ml; changed += mc; removed += mr;
        say('  ' + mo.m + ': ' + mv + ' added' + (mc ? ', ' + mc + ' changed' : '') + (mr ? ', ' + mr + ' removed' : '') + ', ' + ml + ' lines');
      });
    }
    if (pdErr) throw pdErr;
    await new Promise(ok => insV.finalize(ok)); await new Promise(ok => insD.finalize(ok));
    say('Vouchers added: ' + tv + '; changed in iCAFFE and replaced: ' + changed + '; removed (no longer in iCAFFE): ' + removed + '; unchanged: ' + already + '; left out: ' + skipped + (keptTied ? '; kept because bills are set off against them: ' + keptTied : '') + ' (' + tl + ' lines written)');
    say('By type: ' + Object.entries(typeCount).map(([k, v]) => k + ' ' + v).join(', '));
    say('Total Dr ' + totDr.toFixed(2) + '  Cr ' + totCr.toFixed(2));
    if (changeList.length) say('Changes (first 40):\n  ' + changeList.join('\n  '));
    if (skippedList.length) say('Left out (first 40):\n  ' + skippedList.join('\n  '));
    if (DRY) { await run('ROLLBACK'); say('Check only (--check) - nothing saved.'); }
    else { await run('COMMIT'); say('Done.'); }
  } catch (e) {
    say('FAILED - nothing was changed: ' + (e && e.stack || e));
    try { await run('ROLLBACK'); } catch (e2) { /* not in a transaction */ }
  } finally {
    try { fs.writeFileSync(LOG, log.join('\n')); console.log('Log: ' + LOG); } catch (e) { /* ignore */ }
    db.close();
  }
})();
