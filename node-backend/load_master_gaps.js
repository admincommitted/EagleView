// Master gaps found on 18-Nov-2026 (values used in filed jobs that the masters did not have):
//   1. UQC master: the standard customs UQCs (CBEC circular F.No.528/69/2012-STO(TU), 23-Dec-2013) that were missing -
//      MGS, THD, FTS, MTS (used in filed import items) and CCM, CMS, CTM, GIF, HKS, INC, SQI, TKW.
//      Codes already in the master are not changed (nothing is made inactive or deleted).
//   2. Currency master: RUR (ICEGATE "ROUBLE") - the code used in the BEs filed with Russian roubles (BE 3903151,
//      3903152, 4772369). The master had only RUB, which no invoice uses. Non-standard currency (not in the CBIC
//      notification): the rate is the one of the last filed BE (30-Oct-2026) - check it against the bank rate each time.
//   3. Airport list (Cities.iataCode, read by /api/locations/airports): the IATA city codes that cover all airports of a
//      city (MIL, NYC, LON, TYO ...). Old import jobs carry them as Port of Shipment, but only airport codes were listed.
//      Each new row copies the country / state of the city's main airport; airportName = "ALL AIRPORTS (CITY CODE)".
// One transaction. Before it the Uqcs and Currencies tables are copied to backups\master_gaps_before_<time>.json;
// the ids of the airport rows added are written to the result file (only rows are added, nothing else changes).
// Running it again changes nothing.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = path.join(__dirname, 'database.sqlite');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'master_gaps_before_' + stamp + '.json');
const LOG = path.join(__dirname, '_tariff_load', 'master_gaps_result_' + stamp + '.txt');

const UQCS = [
  ['MGS', 'MILLIGRAMS'], ['THD', 'THOUSANDS'], ['FTS', 'FEET'], ['MTS', 'METRIC TON'],
  ['CCM', 'CUBIC CENTIMETERS'], ['CMS', 'CENTIMETERS'], ['CTM', 'CARATS'], ['GIF', 'GRAMS OF FISSILE ISOTOPES'],
  ['HKS', 'HANKS'], ['INC', 'INCHES'], ['SQI', 'SQUARE INCHES'], ['TKW', 'THOUSAND KILOWATT HOURS'],
];
const RUR = { code: 'RUR', name: 'ROUBLE (RUSSIA)', rate: 1.2314, date: '2026-10-30 00:00:00.000 +00:00' };
// [city code, city name, main airport whose country / state is copied]
const CITY_CODES = [
  ['MIL', 'MILAN', 'LIN'], ['CHI', 'CHICAGO', 'ORD'], ['NYC', 'NEW YORK', 'JFK'], ['SEL', 'SEOUL', 'ICN'],
  ['BUH', 'BUCHAREST', 'OTP'], ['TYO', 'TOKYO', 'NRT'], ['BJS', 'BEIJING', 'PEK'], ['PAR', 'PARIS', 'CDG'],
  ['MOW', 'MOSCOW', 'SVO'], ['YTO', 'TORONTO', 'YYZ'], ['OSA', 'OSAKA', 'KIX'], ['ROM', 'ROME', 'FCO'],
  ['LON', 'LONDON', 'LHR'], ['MMA', 'MALMO', 'MMX'], ['WAS', 'WASHINGTON', 'IAD'], ['JKT', 'JAKARTA', 'CGK'],
  ['YMQ', 'MONTREAL', 'YUL'], ['STO', 'STOCKHOLM', 'ARN'], ['BUE', 'BUENOS AIRES', 'EZE'], ['RIO', 'RIO DE JANEIRO', 'GIG'],
  ['SAO', 'SAO PAULO', 'GRU'], ['DTT', 'DETROIT', 'DTW'], ['YEA', 'EDMONTON', 'YEG'], ['REK', 'REYKJAVIK', 'KEF'],
];

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const log = [];
const say = (s) => { console.log(s); log.push(s); };

(async () => {
  let open = false;
  try {
    await run('PRAGMA busy_timeout = 30000');
    const uqcs = await all('SELECT * FROM Uqcs ORDER BY id');
    const curs = await all('SELECT * FROM Currencies ORDER BY id');
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    fs.writeFileSync(BACKUP, JSON.stringify({ Uqcs: uqcs, Currencies: curs }, null, 1));
    say('Backup of the UQC (' + uqcs.length + ') and Currency (' + curs.length + ') masters: ' + BACKUP);

    await run('BEGIN IMMEDIATE'); open = true;
    // 1. UQC
    const haveU = new Set(uqcs.map(r => String(r.uqcCode || '').trim().toUpperCase()));
    let u = 0;
    for (const [code, desc] of UQCS) {
      if (haveU.has(code)) { say('  UQC already there: ' + code); continue; }
      await run('INSERT INTO Uqcs (uqcCode, description, isActive, createdAt, updatedAt) VALUES (?,?,1,?,?)', [code, desc, now(), now()]);
      say('  UQC added: ' + code + ' - ' + desc); u++;
    }
    // 2. RUR
    let cAdded = 0;
    if (curs.some(r => String(r.currencyCode || '').trim().toUpperCase() === RUR.code)) say('  Currency already there: RUR');
    else {
      const maxId = (await all('SELECT max(id) m FROM Currencies'))[0].m || 0;
      await run("INSERT INTO Currencies (id, currencyCode, currencyName, importRate, exportRate, standard, effectiveDate, createdAt, updatedAt, notificationNo) VALUES (?,?,?,?,?,0,?,?,?,'')",
        [maxId + 1, RUR.code, RUR.name, RUR.rate, RUR.rate, RUR.date, now(), now()]);
      say('  Currency added: RUR - ' + RUR.name + ' (rate ' + RUR.rate + ' from BE 4772369 of 30-Oct-2026, non-standard)'); cAdded++;
    }
    // 3. IATA city codes
    let a = 0; const ids = [];
    for (const [code, city, main] of CITY_CODES) {
      const ex = await all('SELECT id FROM Cities WHERE upper(iataCode) = ? LIMIT 1', [code]);
      if (ex.length) { say('  City code already there: ' + code); continue; }
      const m = await all('SELECT stateId, countryId FROM Cities WHERE upper(iataCode) = ? ORDER BY id LIMIT 1', [main]);
      if (!m.length) { say('  City code skipped (airport ' + main + ' not in the list): ' + code); continue; }
      const r = await run("INSERT INTO Cities (stateId, countryId, cityName, airportName, iataCode, portCategory, isActive, isSez, createdAt, updatedAt) VALUES (?,?,?,'ALL AIRPORTS (CITY CODE)',?,'AIR',1,0,?,?)",
        [m[0].stateId, m[0].countryId, city, code, now(), now()]);
      ids.push(r.lastID); say('  City code added: ' + code + ' - ' + city + ' (id ' + r.lastID + ')'); a++;
    }
    await run('COMMIT'); open = false;
    say('UQC added: ' + u + ' | currency added: ' + cAdded + ' | city codes added: ' + a);
    if (ids.length) say('Airport rows added (to undo: DELETE FROM Cities WHERE id IN (' + ids.join(',') + ')): ' + ids.join(','));
    say('DONE');
  } catch (e) {
    if (open) { try { await run('ROLLBACK'); } catch (x) { /* ignore */ } }
    say('FAILED - nothing was changed: ' + (e && e.message));
  } finally {
    try { fs.mkdirSync(path.dirname(LOG), { recursive: true }); fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* ignore */ }
    db.close();
  }
})();
