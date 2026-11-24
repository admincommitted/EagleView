// 06-Nov-2026: JAI - JAIPUR was a duplicate of JPR - JAIPUR (iCAFFE's code, which holds Jaipur's vouchers and number series).
// JAI had nothing on it (no voucher, number series, shipment, GST invoice or user). It is made Inactive, not deleted.
const path = require('path');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));
const db = new sqlite3.Database(process.env.EDI_DB || path.join(__dirname, 'database.sqlite'));
const all = (s, p = []) => new Promise((ok, no) => db.all(s, p, (e, r) => (e ? no(e) : ok(r))));
const run = (s, p = []) => new Promise((ok, no) => db.run(s, p, function (e) { e ? no(e) : ok(this); }));
(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    const used = (await all("SELECT (SELECT count(*) FROM Vouchers WHERE branchCode = 'JAI') v")).map(r => r.v)[0];
    if (used) { console.log('JAI has ' + used + ' vouchers - not changed'); return; }
    const r = await run("UPDATE CompanyBranches SET status = 'Inactive', isDefault = 0, updatedAt = ? WHERE branchCode = 'JAI'", [new Date().toISOString()]);
    console.log(r.changes ? 'JAI - JAIPUR is now Inactive (JPR - JAIPUR stays).' : 'No branch JAI found.');
    console.log(await all("SELECT branchCode, branchName, status FROM CompanyBranches ORDER BY branchCode"));
  } catch (e) { console.log('FAILED: ' + e.message); } finally { db.close(); }
})();
