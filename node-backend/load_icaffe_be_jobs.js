// iCAFFE Import Bill of Entry jobs into EagleView Import Jobs (09-Nov-2026).
// Source: icaffe_be_jobs_*.json.gz - read from iCAFFE job by job (EDI Operation > Bill Of Entry; methods of
//   iCaffe2022.forms.EDI.Import.Forms.BillofEntry: GetImpJobDetails_OnGridCellClick, GetImpInvoiceList / Details,
//   GetImpItemList / Details):
//   {tag, chunk, chunks, read, jobs:[{grid:{ROWID, JOB_NO, JOB_DT, BENUMBER, ...}, job:[[header], [bond], [cert], [hss],
//    [permission], [igm], [container], [invoice list], [cumulative], ..., [be no]], invoices:[{invNo, detail, itemList,
//    items:[{list, detail}]}]}]}
//   Files are looked for in node-backend\_tariff_load, D:\DOWNLOAD and the Windows Downloads folder (or EDI_BE_DIR).
//   The same job read twice (a re-run) is taken once - the latest read wins.
// What it does: one Import Job per iCAFFE BE job, with the iCAFFE job no (7017) as the job no, so the docket's
//   "EDI Job No" (Shipment Registration) finds it. Job header (importer, IEC, address, GSTIN, CHA, port, countries,
//   BE type, flags, BE no / date, warehouse), IGM / MAWB / HAWB rows, bond / certificate / high-sea-sale rows,
//   invoices (supplier, terms, freight / insurance / misc), items (description, RITC / CTH / CETH, qty, price, value,
//   BCD / SWS / IGST / cess notifications, rates and amounts, manufacturer, brand, model, end use, origin, licence,
//   re-import), exchange rates, info / statement rows. The importer is linked to the Party Master by its iCAFFE code.
//   Ex-bond jobs are linked to their warehouse BE job when that job is loaded too.
//   A job loaded from iCAFFE before is refreshed - unless someone saved it in EagleView since (then it is left as it
//   is). A job made in EagleView is never touched.
// One transaction; a full copy of the database is written to backups\ first. --check = dry run, nothing saved.
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const TL = path.join(__dirname, '_tariff_load');
const DIRS = (process.env.EDI_BE_DIR ? process.env.EDI_BE_DIR.split(';') : [TL, 'D:\\DOWNLOAD', path.join(os.homedir(), 'Downloads')]).filter((d, i, a) => d && a.indexOf(d) === i && fs.existsSync(d));
const DRY = process.argv.includes('--check');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_icaffe_be_jobs_' + stamp + '.sqlite');
const LOG = path.join(fs.existsSync(TL) ? TL : __dirname, 'icaffe_be_jobs_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const log = []; const say = (x) => { console.log(x); log.push(x); };

// values: text trimmed (blank -> null), numbers as iCAFFE gave them, dd/mm/yyyy or dd-Mon-yyyy -> yyyy-mm-dd
// 12-Nov-2026: inner double spaces are kept (iCAFFE files them as typed: 'BORGWARNER  EMISSIONS ...'); only line breaks / tabs become a space
const t = (v) => { if (v == null) return null; const s = String(v).replace(/[\r\n\t]+/g, ' ').trim(); return s === '' ? null : s; };
const nz = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const MON = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
const ymd = (v) => {
  const s = String(v == null ? '' : v).trim(); let m;
  if ((m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s))) return m[3] > '1900' ? `${m[3]}-${m[2]}-${m[1]}` : null;
  if ((m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(s))) return MON[m[2].toUpperCase()] ? `${m[3]}-${MON[m[2].toUpperCase()]}-${m[1].padStart(2, '0')}` : null;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s))) { // iCAFFE sends Indian dates as UTC (18:30 the day before)
    const d = new Date(Date.parse(s) + 330 * 60000); return isNaN(d) || d.getUTCFullYear() < 1901 ? null : d.toISOString().slice(0, 10);
  }
  return null;
};
const rows = (a, k) => (Array.isArray(a) && Array.isArray(a[k]) ? a[k].filter(r => r && typeof r === 'object' && Object.keys(r).length) : []);
const one = (a, k) => rows(a, k)[0] || {};
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ''));
// a long description is split over ITEM_DESC1..3 at a fixed width: joined without a space when the cut was mid-word
const joinDesc = (...p) => p.map(x => (x == null ? '' : String(x))).filter(x => x.trim()).reduce((a, x) => (!a ? x.trim() : (a.length >= 60 && !/\s$/.test(a) ? a + x.trimEnd() : a.trimEnd() + ' ' + x.trim())), '');
const MODE = { A: 'AIR', S: 'SEA', L: 'LAND' };
// e-Sanchit supporting document (item detail [18]) -> the screen's Supporting Docs panel row (tab 5 / item popup)
// 12-Nov-2026: kept as iCAFFE has it - its .be sends the trailing commas ('KOWLOON,') and a ',' alone; only '`' alone is empty
const tx = (v) => { const s = t(v); return s && s !== '`' ? s : null; };
const docRow = (r, docFor, invSrNo, itemSrNo) => clean({ docFor, invSrNo, itemSrNo, irn: t(r.IRN), docCode: t(r.DOC_TYP_CD), drn: tx(r.DOC_REF_NO), fileType: t(r.FILE_TYP) || 'PDF', fileName: tx(r.FILE_NAME),
  icegateId: t(r.ICEGATEID), issuerCode: tx(r.DOC_ISSUPARTY_CODE), issuerName: tx(r.DOC_ISSUPARTY_NAME), issuerAddr1: tx(r.DOC_ISSUPARTY_NMADD), issuerAddr2: tx(r.DOC_ISSUPARTY_NMADD1),
  issuerCity: tx(r.DOC_ISSUPARTY_CITY), issuerPin: tx(r.DOC_ISSUPARTY_PIN), beneCode: tx(r.BNF_ISSUPARTY_CODE), beneName: tx(r.BNF_ISSUPARTY_NAME), beneAddr1: tx(r.BNF_ISSUPARTY_NMADD),
  beneAddr2: tx(r.BNF_ISSUPARTY_NMADD1), beneCity: tx(r.BNF_ISSUPARTY_CITY), benePin: tx(r.BNF_ISSUPARTY_PIN), placeOfIssue: tx(r.ISSUE_PLACE), issueDate: ymd(r.ISSUE_DATE), expiryDate: ymd(r.EXPIRY_DATE || r.EXP_DATE) });
const BOE = { H: 'HOME_CONSUMPTION', W: 'WAREHOUSE', X: 'EX_BOND' };

function readFiles() {
  const files = [];
  for (const d of DIRS) for (const f of fs.readdirSync(d)) if (/^icaffe_be_jobs_.*\.json(\.gz)?$/i.test(f)) files.push(path.join(d, f));
  const seen = new Set(), list = [];
  for (const f of files.sort()) { const b = path.basename(f).toLowerCase(); if (seen.has(b)) continue; seen.add(b); list.push(f); } // same file in two folders: once
  const jobs = new Map(); const bad = []; let n = 0;
  for (const f of list) {
    try {
      let buf = fs.readFileSync(f); if (/\.gz$/i.test(f)) buf = zlib.gunzipSync(buf);
      const j = JSON.parse(buf.toString('utf8')); n++;
      const when = Date.parse(j.read || '') || 0;
      for (const x of j.jobs || []) {
        const g = x && x.grid; if (!g || !g.ROWID || !Array.isArray(x.job) || !one(x.job, 0).JOB_NO) continue;
        const o = jobs.get(g.ROWID); if (!o || when >= o.when) jobs.set(g.ROWID, { ...x, when, file: path.basename(f) });
      }
    } catch (e) { bad.push(path.basename(f) + ' (' + e.message.slice(0, 60) + ')'); }
  }
  return { jobs, files: n, bad, dirs: DIRS };
}

// ---------- iCAFFE job -> the Import Job screen's own fields (same names as "Read JSON" gives, utils/ErpFileParser) ----------
function mapJob(x, ctx) {
  const g = x.grid, J = x.job, h = one(J, 0);
  const typ = String(h.TYP || g.TYP || 'H').trim().toUpperCase(), mt = String(h.MT || 'A').trim().toUpperCase();
  const beRow = one(J, 11);
  const beNo = t(g.BENUMBER || beRow.BENUMBER), beDate = ymd(g.BEDATE) || ymd(beRow.BEDATE);
  const docket = t(g.DOCKET_NO_TEXT || String(g.DOCKET_NO || '').replace(/<[^>]+>/g, ''));
  const jobDate = ymd(g.JOB_DT) || ymd(h.JOB_DT1) || ymd(h.JOB_DT);
  const igm = rows(J, 5).map(r => clean({ igmNumber: t(r.ROT_NO), igmDate: ymd(r.ROT_DT), inwardDate: ymd(r.INWARD_DATE), gatewayInwardDate: ymd(r.GINW_DT),
    mawbNo: t(r.MAWB_NO), mawbDate: ymd(r.MAWB_DT), hawbNo: t(r.HAWB_NO), hawbDate: ymd(r.HAWB_DT), totalPkg: nz(r.TOTPKG), pkgCode: t(r.PKG_CD), grossWt: nz(r.GROSS_WT),
    wtUnit: t(r.UQC), marks1: t(r.MRKNUM1), marks2: t(r.MRKNUM2), marks3: t(r.MRKNUM3), lineNo: t(r.IGM_SER_NO) }));
  const g0 = igm[0] || {};
  const void_ = String(g.VOID_JOB || h.VOID_JOB || '').trim() === 'Y';
  const br = ctx.branch(t(g.BRANCH_CODE) || t(h.MAOOFFICEID));
  const fy = ctx.fy(jobDate);
  const pid = ctx.party.get(t(h.IMPID)) || null;
  const job = clean({
    jobNo: String(g.JOB_NO), jobDate, shipmentMode: MODE[mt] || 'AIR', trans: mt, autoField_52: mt, modeOfTransport: mt,
    boeType: BOE[typ] || 'HOME_CONSUMPTION', autoField_51: typ, beType: typ,
    status: void_ ? 'VOID' : beNo ? 'BE FILED (iCAFFE)' : 'DRAFT (iCAFFE)',
    branchCode: br.code, branchId: br.id, financialYear: fy.name, financialYearId: fy.id,
    // location / port
    autoField_1: t(h.LOCATION_NAME || g.PORT_NM), locationName: t(h.LOCATION_NAME || g.PORT_NM), portCode: t(h.PORT_CD || g.PORT_CD), autoField_2: t(h.PORT_CD || g.PORT_CD),
    customHouseCode: t(h.PORT_CD || g.PORT_CD), portName: t(h.LOCATION_NAME || g.PORT_NM),
    // importer
    autoField_3: t(h.CHA_NO), chaCode: t(h.CHA_NO),
    autoField_4: t(h.IMP_NAME || g.IMP_NAME), nameOfImporter: t(h.IMP_NAME || g.IMP_NAME), importerPartyId: pid ? String(pid) : null,
    autoField_5: t(h.IEC), iecCode: t(h.IEC), autoField_48: t(h.BRANCH_SLNO), branchSrNo: t(h.BRANCH_SLNO),
    autoField_6: t(h.IMP_ADD1), address1: t(h.IMP_ADD1), autoField_7: t(h.IMP_ADD2), address2: t(h.IMP_ADD2), autoField_8: t(h.IMP_CITY), city: t(h.IMP_CITY),
    autoField_9: t(h.IMP_STATE), state: t(h.IMP_STATE), autoField_10: t(h.IMP_PIN), pin: t(h.IMP_PIN),
    autoField_50: t(h.CTX_TYPE), commercialTaxType: t(h.CTX_TYPE), autoField_13: t(h.CTX_REGISTRATION_NO), commercialTaxRegistrationNo: t(h.CTX_REGISTRATION_NO),
    autoField_12: t(h.CTX_STATE_CODE), stateCode: t(h.CTX_STATE_CODE), autoField_11: t(h.CTX_STATE_NAME), ctxStateName: t(h.CTX_STATE_NAME),
    // 12-Nov-2026: iCAFFE's GOVT is the BE's importer type (P / G / O: 7966 filed G), IMP_CLASS1 is the BE class it files (P)
    autoField_53: t(h.GOVT) || t(h.IMP_CLASS1), importerType: t(h.GOVT) || t(h.IMP_CLASS1), beClass: t(h.IMP_CLASS1), importerClass: t(h.IMP_CLASS), govtPrivate: t(h.GOVT), adCode: t(h.AD_CD), aeoCode: t(h.AD_CD), autoField_49: t(h.AD_CD), // the BE's AD code box (Job Header 'AEO / AD code')
    // countries / port of shipment
    autoField_20: t(h.CORG || g.CORG), countryOfOrigin: t(h.CORG || g.CORG), countryOfOriginName: t(h.CNTRY_NM_ORIGIN),
    autoField_21: t(h.CCON), countryOfConsignment: t(h.CCON), countryOfConsignmentName: t(h.CNTRY_NM_CONSIGNEE),
    autoField_22: t(h.POS), portOfOrigin: t(h.POS), portOfShipment: t(h.POS), portOfOriginName: t(h.PORT_NM),
    // flags
    autoField_55: t(h.GREEN_CHANNEL), greenChannel: t(h.GREEN_CHANNEL), greenChannelRequested: t(h.GREEN_CHANNEL), kachchaBE: t(h.KBE), highSeaSaleFlag: t(h.HSS),
    section48Requested: t(h.SEC_48), firstCheckRequested: t(h.FIRST_CHK), whetherPriorBE: t(h.PRIOR_BE), provAssess: t(h.PROVISIONAL_ASSESSMENT),
    paymentMethodCode: t(h.PAY_MODE), paymentMethod: t(h.PAY_MODE), bond: t(h.Bond_flag), certificate: t(h.CERT_FLAG),
    cumulativeMiscCharge: t(h.CumulativeMiscCharge),
    // BE / warehouse
    beNo, beDate, warehouseCode: t(h.WH_CODE), warehouseBENo: t(h.WBE_NO), warehouseBEDate: ymd(h.WBE_DT), warehouseCustomSiteId: t(h.WH_CUS_SITE),
    // ex-bond: the packages / weight released by this BE (the IGM line is the warehouse BE's whole consignment) - 12-Nov-2026
    noOfPackagesReleased: typ === 'X' ? nz(h.NO_OF_PKG) : null, releasedPkgCode: typ === 'X' ? t(h.PKG_CD) : null, releasedGrossWt: typ === 'X' ? nz(h.GROSS_WT) : null, releasedWtUnit: typ === 'X' ? t(h.UNIT) : null,
    // first IGM row on the header too (job list columns, docket link)
    _igmRows: igm.length ? igm : null, igmNumber: g0.igmNumber, igmNo: g0.igmNumber, igmDate: g0.igmDate, inwardDate: g0.inwardDate,
    mawbNo: g0.mawbNo || t(String(g.MAWB_STUFF || '').trim()), mawbblNo: g0.mawbNo, mawbDate: g0.mawbDate, hawbNo: g0.hawbNo || t(String(g.HAWB_STUFF || '').trim()), hawbhblNo: g0.hawbNo, hawbDate: g0.hawbDate,
    totalPkg: g0.totalPkg, pkg: g0.pkgCode, grossWt: g0.grossWt, grossWtUnit: g0.wtUnit, marksAndNumbers1: g0.marks1, marks1: g0.marks1,
    chargableWeight: nz(h.CHARGABLE_WEIGHT) || null, lineName: t(h.SHIPPINGLINE),
    userJobNo: t(h.USER_JOB_NO), whJobNo: t(h.WH_JOB_NO), whJobDate: ymd(h.WH_JOB_DT),
    // totals as iCAFFE worked them out
    totalAssessableValue: nz(h.A_TOT_ASS_VAL || g.TOTAL_ASSVAL), totalDuty: nz(h.A_TOT_DUTY || g.GROSS_TOTAL),
    // grids
    _bondRows: rows(J, 1).length ? rows(J, 1).map((b, i) => clean({ id: i + 1, bondNo: t(b.BOND_NO), bondCode: t(b.BOND_CD), bondPort: t(b.BOND_PORT), bondAmount: nz(b.BOND_AMT), bgAmount: nz(b.BG_AMT), bgRate: nz(b.BG_RATE) })) : null,
    _certRows: rows(J, 2).length ? rows(J, 2).map((c, i) => clean({ id: i + 1, certNo: t(c.CERT_NO), certDate: ymd(c.CERT_DT), certType: t(c.CERT_TYPE) })) : null,
    _hssRows: rows(J, 3).length ? rows(J, 3).map((r, i) => clean({ id: i + 1, importerName: t(r.IMP_NAME), iecNo: t(r.IEC), branchSrNo: t(r.BRANCH_SLNO), address1: t(r.IMP_ADD1), address2: t(r.IMP_ADD2), city: t(r.IMP_CITY), pin: t(r.IMP_PIN), precedingLevel: 'Level- ' + (t(r.PRECEDING_LEVEL) || '0') })) : null,
    _permissionRows: rows(J, 4).length ? rows(J, 4).map(p => clean({ permissionCode: t(p.PERM_CD), reasonsForRequest: t(p.REQ_TXT) })) : null,
    // where it came from
    docketNo: docket && !/REGISTERED/i.test(docket) ? docket : null, icaffeShipmentId: t(g.SHIPMENT_ID || h.SHIPMENT_ID), icaffeRowId: g.ROWID, icaffeJobNo: g.JOB_NO,
    icaffeEnteredBy: t(h.ENTERED_BY || g.ENTERED_BY), icaffeModifiedBy: t(h.MODIFIED_BY), icaffeQueue: t(g.QUEUE_SUBMISSION), icaffeCreatedFrom: t(h.CREATED_FROM) ? `${h.CREATED_FROM} ${h.CREATED_FROM_JOB_NO || ''}`.trim() : null,
    voidReason: void_ ? (t(h.VOID_REASON) || 'Void in iCAFFE') : null, icaffeFile: x.file,
    createdBy: 'iCAFFE', updatedBy: 'iCAFFE',
  });
  if (job.bond === 'N') delete job.bond; if (job.certificate === 'N') delete job.certificate;

  // invoices, items, exchange rates, info and statement rows
  const invoices = [], ex = new Map(), info = [], stmt = new Map(), jobDocs = new Map(); let nItems = 0;
  for (const iv of x.invoices || []) {
    const D = iv.detail || [], r = one(D, 0), cum = one(D, 14), tp = one(D, 8);
    const invSr = String(r.INV_NO || iv.invNo || invoices.length + 1);
    for (const e of rows(D, 13)) { const c = t(e.CURR_CD); if (c && !ex.has(c)) ex.set(c, clean({ currencyCode: c, rate: nz(e.RATE), unitInRs: nz(e.UNIT_IN_RS) || 1, effectiveDate: ymd(e.EFF_DT), standard: t(e.STND) })); }
    const inv = clean({
      invSrNo: invSr, invoiceSrNo: invSr, invoiceSerialNumber: invSr,
      invNo: t(r.AINV_NO), invoiceNo: t(r.AINV_NO), actualInvoiceNumber: t(r.AINV_NO), invDate: ymd(r.INV_DT), invoiceDate: ymd(r.INV_DT),
      currency: t(r.INV_CUR), invoiceCurrency: t(r.INV_CUR), value: nz(r.INV_VAL), invValue: nz(r.INV_VAL), invoiceValue: nz(r.INV_VAL), exchangeRate: nz(r.INV_EXCNG_RATE),
      terms: t(r.INV_TERM), termsOfInvoice: t(r.INV_TERM), incoterm: t(r.INV_TERM),
      supplierName: t(r.SUP_NM), supplierAddress1: t(r.SUP_ADD1), supplierAddress2: t(r.SUP_ADD2), supplierAddress3: t(r.SUP_ADD3), // ',' kept: iCAFFE files it (12-Nov-2026)
      supplierCountry: t(r.SUP_CNTRY), supplierCountryName: t(r.SUP_CNTRY), sellerSameAsSupplier: t(r.FLG_SELLER_SAME_AS_SUPPLIER),
      // 12-Nov-2026: a rate OR an amount, as iCAFFE files them: with a rate (insurance 1.125 %) INS_VAL is only iCAFFE's
      // working - sending both is ICEGATE's "amount or rate, not both". 0 = not given (iCAFFE leaves the box empty).
      freightValue: nz(r.FRT_RT) ? null : nz(r.FRT_VAL) || null, freightAmount: nz(r.FRT_RT) ? null : nz(r.FRT_VAL) || null, freightCurrency: nz(r.FRT_RT) || !nz(r.FRT_VAL) ? null : t(r.FRT_CUR), freightRate: nz(r.FRT_RT) || null, whetherFreightActual: t(r.FRT_FLG),
      insuranceValue: nz(r.INS_RT) ? null : nz(r.INS_VAL) || null, insuranceAmount: nz(r.INS_RT) ? null : nz(r.INS_VAL) || null, insuranceCurrency: nz(r.INS_RT) || !nz(r.INS_VAL) ? null : t(r.INS_CUR), insuranceRate: nz(r.INS_RT) || null,
      freightWorkedOut: nz(r.FRT_RT) ? nz(r.FRT_VAL) || null : null, insuranceWorkedOut: nz(r.INS_RT) ? nz(r.INS_VAL) || null : null,
      miscCharges: nz(r.MIS_CH) || null, miscCurrency: t(r.MIS_CUR), miscChargesRate: nz(r.MIS_RT) || null, miscChargesNotIncluded: t(r.MISC_CHRG_NOT_INVOICE),
      agencyCommAmount: nz(r.AG_COMM) || null, agencyCommRate: nz(r.AG_RT) || null, loadingAmount: nz(r.LOAD_CH) || null, loadingRate: nz(r.LOAD_RT) || null, landingRate: nz(r.LAND_RT) || null,
      discountAmount: nz(r.DISC_AMT) || null, discountRate: nz(r.DISC_RT) || null, hssLoadRate: nz(r.HSS_LOAD_RTA) || null, hssLoadAmount: nz(r.HSS_LOAD_AMT) || null,
      natureOfTransaction: t(r.TRANS_NAT), paymentTerms: t(r.PAY_TERMS), valuationMethod: t(r.VAL_MTHD), valuationMethodApplicable: t(r.VAL_MTHD),
      buyerSellerRelated: t(r.BUYER_SELLER_RELATED) || 'N', whetherBuyerAndSellerAreRelated: t(r.BUYER_SELLER_RELATED) || 'N',
      svbFlag: t(r.SVB_FLG), svbReferenceNumber: t(r.SVB_NO), svbReferenceDate: ymd(r.SVB_DT), // 12-Nov-2026: iCAFFE keeps the SVB load % on the assessable value in ASSVAL (5940: 147.11 -> item AV = CIF x 2.4711);
      // it was put in the invoice's assessableValueInr. An SVB invoice files the % even when it is 0 (0.00000).
      svbLoadAssessableValue: t(r.SVB_NO) ? (nz(r.ASSVAL) || nz(r.SVB_LOAD) || 0) : null, svbLoadOnDuty: t(r.SVB_NO) ? nz(r.SVB_LOAD_ON_DUTY) || null : null,
      customHouseCodeWhichHasImposedLoad: t(r.SVB_CS), whetherloadProvisionalOnAssValue: t(r.SVB_SFLG), whetherProvisionalOnDuty: t(r.SVB_DUTYFLG),
      relationInfluencedPrice: /^Y/i.test(String(r.RELTN || (one(D, 10).RELTN) || '')) ? 'Y' : (t(r.RELTN || one(D, 10).RELTN) ? 'N' : null),
      thirdPartyName: t(tp.TP_NAME || r.TP_NAME), thirdPartyAddress1: t(tp.TP_ADD1 || r.TP_ADD1), thirdPartyAddress2: t(tp.TP_ADD2 || r.TP_ADD2), thirdPartyCity: t(tp.TP_CITY || r.TP_CITY),
      thirdPartyPin: t(tp.TP_PIN || r.TP_PIN), thirdPartyCountryCode: t(tp.TP_CTRY || r.TP_CTRY),
      cumulativeFreightFlag: t(cum.CUMULATIVE_FRT_INS_FLG), cumulativeMiscCharge: t(cum.CUMULATIVEMISCCHARGE),
      assessableValueInr: nz(r.A_ASSVAL) || null, totalDuty: nz(r.A_TOT_DUTY || r.TOT_DUTY) || null,
    });
    // invoice level [15] is iCAFFE's list of the info types that MAY be given (greyed, no code / text) - only rows with a value are taken
    for (const q of rows(D, 15)) if (t(q.INFO_CODE) || t(q.INFO_TEXT) || nz(q.INFO_MSR)) info.push(clean({ invoiceSrNo: invSr, itemSrNo: '0', infoType: t(q.INFO_TYPE), infoQualifier: t(q.INFO_QUALIFIER), infoCode: t(q.INFO_CODE), infoText: t(q.INFO_TEXT), infoMsr: nz(q.INFO_MSR) || null, infoUqc: t(q.INFO_UQC) })); // 0 = empty, as iCAFFE files it
    const items = [];
    const list = new Map((Array.isArray(iv.itemList) ? (Array.isArray(iv.itemList[0]) ? iv.itemList[0] : iv.itemList) : []).filter(Boolean).map(l => [String(l.ITEM_NO), l]));
    for (const it of iv.items || []) {
      const I = it.detail || [], d = { ...(it.list || {}), ...one(I, 0) }, mf = one(I, 1);
      const sr = String(d.ITEM_NO || items.length + 1); const L = list.get(sr) || {};
      const d0 = one(I, 0);
      const duty = rows(I, 12).map(r2 => clean({ notificationNo: t(r2.NOTN_NO), notificationSrNo: t(r2.NOTN_SLNO), dutyType: t(r2.DUTY_TYPE), addlDutyFlag: t(r2.ADD_DUTY_FLG),
        // 12-Nov-2026: IGST_FLG = "customs notification exempting IGST" (C) / GST exemption (G) and its notification -
        // with C and no notification on the row iCAFFE files the item's aggregate / BCD notification (8088: 072/2017)
        exmpNotificationNo: t(r2.EXMP_NOTN_NO) || (t(r2.IGST_FLG) === 'C' ? t(d0.AGG_NOTN) || t(d0.BCD_NOTN) : null), exmpNotificationSrNo: t(r2.EXMP_NOTN_SLNO),
        igstFlag: t(r2.IGST_FLG), rate: nz(r2.SBE_RTA), amount: nz(r2.SBE_AMT) })).filter(r2 => r2.notificationNo); // igstFlag: the item's duty popup column
      const ig = duty.find(r2 => r2.dutyType === 'G' && r2.addlDutyFlag === 'I');
      const qty = nz(d.NOU != null ? d.NOU : L.NOU), price = nz(d.UPI != null ? d.UPI : L.UPI), val = nz(d.TOTAL_AMT != null ? d.TOTAL_AMT : L.TOTAL_AMT);
      const desc = joinDesc(d.ITEM_DESC1 || L.ITEM_DESC1, d.ITEM_DESC2, d.ITEM_DESC3);
      const item = clean({
        invSrNo: invSr, invoiceSrNo: invSr, itemSrNo: sr, srNo: sr, itemNo: sr, invNo: inv.invNo,
        desc, description: desc, productDescription: desc, genericDesc: t(d.GEN_DESC || mf.GEN_DESC),
        ritc: t(d.RITC_CD || L.RITC_CD), hsCode: t(d.RITC_CD || L.RITC_CD), hsnCode: t(d.RITC_CD || L.RITC_CD), cth: t(d.CTH),
        // 12-Nov-2026: iCAFFE's CETH box repeats the CTH, but it files NOEXCISE - except goods still under central excise
        // (chapters 22 / 24 / 27: 6833 filed 22042190)
        ceth: /^(22|24|27)/.test(String(d.RITC_CD || L.RITC_CD || '')) ? t(d.CETH) || t(d.CTH) : 'NOEXCISE',
        qty: qty == null ? null : String(qty), quantity: qty, uqc: t(d.UQC || L.UQC), unit: t(d.UQC || L.UQC), price: price == null ? null : String(price), unitPrice: price,
        value: val == null ? null : String(val), assessableValue: val, currency: t(d.UPI_CURCD || d.TOTAL_AMT_CURR), foc: t(d.FOC_FLG || L.FOC_FLG) || 'N',
        assessableValueInr: nz(d.ASSESS_VAL), cifInr: nz(d.CIF_LC), itemFreight: nz(d.ITEM_FRT_VAL) || null, itemInsurance: nz(d.ITEM_INS_VAL) || null, itemMisc: nz(d.ITEM_MIS_CH) || null, totalDuty: nz(d.ITEM_DUTY),
        bcdNotificationNo: t(d.BCD_NOTN), bcdSrNo: t(d.BCD_NSNO), bcdRate: nz(d.BCD_RTA), bcdFlag: t(d.BCD_F),
        // 12-Nov-2026: ITEM_DUTY_FG is iCAFFE's "duty foregone" - the part of the item's duty not paid in cash: BCD debited
        // to a licence / scrip (job 11: BCD 27,406 at 15 %, SWS + IGST paid) or every duty under an EOU / exemption
        // notification (6160, 052/2003). BCD_AMT is then empty. dutyForegone keeps it out of the duty payable.
        bcdAmount: nz(d.BCD_AMT), dutyForegone: nz(d.ITEM_DUTY_FG) || null,
        bcdSpecAmount: nz(d.BCD_AMTS) || null, bcdUnit: nz(d.BCD_AMTS) ? t(d.BCD_UQC) : null, // specific BCD (Rs per unit)
        swsNotificationNo: t(d.CEX_NOTN), swsSrNo: t(d.CEX_NSNO), swsFlag: t(d.CEX_F),
        itemCategory: t(d.ITEMC) ? String(d.ITEMC).trim().toUpperCase() : null,
        swsRate: nz(d.CessOnCVD) ? nz(d.CEX_RTA) : null, swsAmount: nz(d.CessOnCVD) ? +(+d.CessOnCVD).toFixed(2) : null,
        igstData: ig ? clean({ notnNo: ig.notificationNo, srNo: ig.notificationSrNo, flag: 'A', rate: ig.rate, amount: ig.amount, exmpNotnNo: ig.exmpNotificationNo, exmpSrNo: ig.exmpNotificationSrNo, igstFlag: ig.igstFlag,
          // an exemption notification with IGST still charged (8088: 072/2017, 18 %) - the estimate takes an exemption as full otherwise
          exmpRate: ig.exmpNotificationNo && ig.amount > 0 ? ig.rate : null }) : null,
        igstDutyFlag: ig ? 'Y' : null, // the Items screen's "IGST Duty" box (Y = the IGST popup is filled)
        igstRate: ig ? ig.rate : null, igstAmount: ig ? ig.amount : null, igst: ig ? ig.amount : null, basicCustomsDuty: nz(d.BCD_AMT),
        dutyRows: duty.length ? duty.map(({ rate, amount, ...k }) => k) : null,
        healthCessRate: nz(d.HLTH_RTA) || nz(d.HCESS_RTA) || null, healthCessAmount: nz(d.HLTH_AMT) || nz(d.HCESS_AMT) || null,
        antiDumpingDutyNotification: t(d.AND_NOTN), antiDumpingDutySerialNumber: t(d.AND_NSNO), antiDumpingRate: nz(d.AND_RTA) || null, antiDumpingAmount: nz(d.AND_AMT) || null,
        adlCvdRate: nz(d.ADDCVD_RTA) || null, adlCvdAmount: nz(d.ADDCVD_AMT) || null, saptaRate: nz(d.SAPT_RTA) || null, saptaNotificationNo: t(d.SAPT_NOTN), saptaSrNo: t(d.SAPT_NSNO),
        safeguardDutyNotn: t(d.SFGD_NOTN), safeguardDutyNotnSrNo: t(d.SFGD_NOTN_SLNO), aggregateDutyNotn: t(d.AGG_NOTN), aggregateDutyNotnSrNo: t(d.AGG_NOTN_SLNO),
        manufacturer: t(d.MNF_NM || mf.MNF_NM), manufacturerName: t(d.MNF_NM || mf.MNF_NM), itemManufacturerAddress1: t(d.MNF_ADD1 || mf.MNF_ADD1), itemManufacturerAddress2: t(d.MNF_ADD2 || mf.MNF_ADD2),
        itemManufacturerCity: t(d.MNF_CITY || mf.MNF_CITY), itemManufacturerPin: t(d.MNF_PIN || mf.MNF_PIN), itemManufacturerCountry: t(d.MNF_CTRY || mf.MNF_CTRY), itemManufacturerSubdivision: t(d.MNF_CTRY_SUBDV || mf.MNF_CTRY_SUBDV),
        brandName: t(d.BRAND || mf.BRAND), model: t(d.MODEL || mf.MODEL), endUse: t(d.END_USE || mf.END_USE), countryOfOrigin: t(d.CRG || mf.CRG),
        sourceCountry: t(d.SOURCE_CTRY || mf.SOURCE_CTRY), transitCountry: t(d.TRANSIT_CTRY || mf.TRANSIT_CTRY), accessoryStatus: t(d.ACCESSORY_STATUS), accessories: t(d.ITEM_ACC || mf.ITEM_ACC),
        preferentialStandard: t(d.PREF), rspApplicability: t(d.RSP) || 'N', whetherReimport: t(d.REIMPORT_F) === 'Y' ? 'Y' : 'N', productCode: t(d.PRODUCT_CODE),
        previousBeFlag: t(d.PRV_BE_FLG), svbFlag: t(d.SVB_DSFLG),
      });
      // AIDC (notification row C/A) -> Other Duty popup "Infra Cess"; anti-dumping -> Anti Dumping popup (addData)
      const aidc = duty.find(r2 => r2.dutyType === 'C' && r2.addlDutyFlag === 'A');
      if (aidc) { item.otherDutyData = clean({ 'Infra Cess_notnNo': aidc.notificationNo, 'Infra Cess_srNo': aidc.notificationSrNo, 'Infra Cess_rate': nz(d.INFRACESS_RTA) != null ? nz(d.INFRACESS_RTA) : aidc.rate, 'Infra Cess_dutyAmount': nz(d.INFRACESS_AMT) != null ? nz(d.INFRACESS_AMT) : aidc.amount }); item.otherDutyFlag = 'Y'; }
      if (t(d.AGG_NOTN)) { item.otherDutyData = clean({ ...(item.otherDutyData || {}), Aggregate_notnNo: t(d.AGG_NOTN), Aggregate_srNo: t(d.AGG_NOTN_SLNO), Aggregate_rate: nz(d.AGG_RTA), Aggregate_dutyAmount: nz(d.AGG_AMT) || nz(d.AGG_AMT_FG),
        // 12-Nov-2026: exempted (only AGG_AMT_FG, 'foregone'): not in the IGST base nor in the duty payable - 072/2017 re-imports
        Aggregate_foregone: !nz(d.AGG_AMT) && nz(d.AGG_AMT_FG) ? 'Y' : null }); item.otherDutyFlag = 'Y'; }
      if (t(d.AND_NOTN)) { item.addData = clean({ notnNo: t(d.AND_NOTN), srNo: t(d.AND_NSNO), cth: t(d.CTH_SLNO), supSlNo: t(d.SUP_SLNO), qty: nz(d.NOU3), rate: nz(d.AND_RTA), amount: nz(d.AND_AMT), uqc: t(d.AND_UQC), currency: t(d.ANTI_CUR) === '0' ? null : t(d.ANTI_CUR) }); item.antiDumpingDutyFlag = 'Y'; }
      const lic = rows(I, 10).map((r2, k) => clean({ id: k + 1, licenceNo: t(r2.LIC_NO), licenceDate: ymd(r2.LIC_DT), licenceCode: t(r2.LIC_CD), licenceType: t(r2.LICENCE_TYPE), regnPort: t(r2.POR),
        regnNo: t(r2.REGN_NO), regnDate: ymd(r2.REGN_DT), itemSrNoLicence: t(r2.SLNO_IN_LIC), debitValue: nz(r2.DEBIT_VAL), debitQty: nz(r2.DEBIT_QTY), debitUqc: t(r2.DEBIT_UQC), debitDuty: nz(r2.DEBIT_DUTY) }));
      if (lic.length) { item.licenceData = lic; item.licenceFlag = 'Y'; }
      const re = one(I, 8);
      if (re.SB_NO) { item.whetherReimport = 'Y'; item.reimportData = clean({ type: 'Y', shippingBillNo: t(re.SB_NO), shippingBillDate: ymd(re.SB_DT), portOfExport: t(re.PORT), invoiceNoSb: t(re.SB_INV_NO),
        itemNoSb: t(re.SB_ITEM_NO), notificationNo: t(re.NOTN_NO), notificationSrNo: t(re.NOTN_SLNO), exportFreight: nz(re.EXP_FRT), exportInsurance: nz(re.EXP_INS), customsDuty: nz(re.CUSTOM_DUTY), exciseDuty: nz(re.EXCISE_DUTY) }); }
      for (const q of rows(I, 13)) info.push(clean({ invoiceSrNo: invSr, itemSrNo: sr, infoType: t(q.INFO_TYPE), infoQualifier: t(q.INFO_QUALIFIER), infoCode: t(q.INFO_CODE), infoText: t(q.INFO_TEXT), infoMsr: nz(q.INFO_MSR) || null, infoUqc: t(q.INFO_UQC) })); // 0 = empty, as iCAFFE files it
      // statements: M = whole BE, N = this invoice, otherwise this item
      for (const s of rows(I, 17)) {
        const f = String(s.STMNT_FOR || '').trim().toUpperCase(); const iS = f === 'M' ? '0' : invSr, tS = f === 'M' || f === 'N' ? '0' : sr;
        const k = [iS, tS, s.STMNT_TYPE_CODE, s.STMNT_CODE].join('|');
        if (!stmt.has(k)) stmt.set(k, clean({ invoiceSrNo: iS, itemSrNo: tS, statementType: t(s.STMNT_TYPE_CODE), statementCode: t(s.STMNT_CODE), statementText: t(s.STMNT_TEXT) || '', stmtFor: f }));
      }
      // Single Window constituents / production batches / control (item detail [14] [15] [16]) -> the SW popups
      const swc = rows(I, 14).filter(r2 => t(r2.CONST_ELEMENT_NM) || t(r2.CONST_ELEMENT_CODE)).map((r2, k) => clean({ id: k + 1, srNo: t(r2.CONST_SRNO) || String(k + 1), name: t(r2.CONST_ELEMENT_NM), code: t(r2.CONST_ELEMENT_CODE),
        percent: nz(r2.CONST_PERCENTAGE), yield: nz(r2.CONST_YIELD_PERCENTAGE), active: t(r2.ACTIVE_INGREDIENT) }));
      if (swc.length) { item.swConstData = swc; item.swConstituentFlag = 'Y'; }
      const swp = rows(I, 15).filter(r2 => t(r2.BATCH_IDTFR) || nz(r2.BATCH_QTY)).map((r2, k) => clean({ id: k + 1, batch: t(r2.BATCH_IDTFR), qty: nz(r2.BATCH_QTY), uqc: t(r2.UQC),
        mnfDate: ymd(r2.MNF_DT), expDate: ymd(r2.EXP_DT), bestBefore: ymd(r2.BST_BEFORE) }));
      if (swp.length) { item.swProdData = swp; item.swProductionFlag = 'Y'; }
      const swk = rows(I, 16).filter(r2 => t(r2.CTRL_TYPE_CODE)).map((r2, k) => clean({ id: k + 1, typeCode: t(r2.CTRL_TYPE_CODE), location: t(r2.CTRL_LOCATION), startDate: ymd(r2.CTRL_STMSTMP),
        endDate: ymd(r2.CTRL_ETMSTMP), resultCode: t(r2.CTRL_RESULT_CODE), resultText: t(r2.CTRL_RESULT_TEXT), msr: nz(r2.CTRL_MSR), uqc: t(r2.CTRL_UQC), slNo: t(r2.CTRL_SLNO) }));
      if (swk.length) { item.swCtrlData = swk; item.swControlFlag = 'Y'; }
      // supporting documents: BE and invoice level once on the job (tab 5 "Supporting Docs"), item level on the item
      const own = [];
      for (const r2 of rows(I, 18)) {
        if (!t(r2.IRN) && !t(r2.DOC_TYP_CD)) continue;
        const f = String(r2.STMNT_FOR || 'BE').trim().toUpperCase();
        if (f === 'ITEM') { if (!own.some(o => o.irn === t(r2.IRN) && o.docCode === t(r2.DOC_TYP_CD))) own.push(docRow(r2, 'ITEM', invSr, sr)); continue; }
        const lv = f === 'INVOICE' ? 'INVOICE' : 'HEADER', key = [lv, lv === 'INVOICE' ? invSr : '', t(r2.IRN), t(r2.DOC_TYP_CD)].join('|');
        if (!jobDocs.has(key)) jobDocs.set(key, docRow(r2, lv, lv === 'INVOICE' ? invSr : '', ''));
      }
      if (own.length) { item.docsData = own.map((o, k) => ({ id: k + 1, srNo: k + 1, ...o })); item.supportingDocsFlag = 'Y'; }
      items.push(item); nItems++;
    }
    inv.items = items; invoices.push(inv);
  }
  if (ex.size) job._exchangeRates = [...ex.values()];
  if (jobDocs.size) job.esanchitDocs = [...jobDocs.values()].map((o, k) => ({ id: k + 1, srNo: k + 1, ...o }));
  if (info.length) job._infoTypes = info;
  if (stmt.size) job._statements = [...stmt.values()];
  // what the job list shows from the invoices
  if (invoices[0]) Object.assign(job, clean({ invNo: invoices.map(i => i.invNo).filter(Boolean).join(', '), invDt: invoices[0].invDate, supplierName: invoices[0].supplierName, currency: invoices[0].currency }));
  return { job, invoices, nItems, typ, beNo, warehouseBENo: job.warehouseBENo };
}

// split an object into table columns and the extendedData JSON (as utils/extraFields.packExtra does)
function pack(cols, obj) {
  const out = {}, extra = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'items' || k === 'extendedData' || v === undefined) continue;
    if (cols.has(k)) out[k] = v !== null && typeof v === 'object' ? JSON.stringify(v) : v; else extra[k] = v;
  }
  if (cols.has('extendedData')) out.extendedData = Object.keys(extra).length ? JSON.stringify(extra) : null;
  return out;
}
const insert = async (table, o) => { const ks = Object.keys(o); const sql = `INSERT INTO ${table} (${ks.map(k => '"' + k + '"').join(', ')}) VALUES (${ks.map(() => '?').join(', ')})`; return run(sql, ks.map(k => o[k])); };

(async () => {
  try {
    const src = readFiles();
    say('Database: ' + DB);
    say('Looked in: ' + src.dirs.join(' ; '));
    say('Files read: ' + src.files + (src.bad.length ? '  (could not read ' + src.bad.length + ': ' + src.bad.join(', ') + ')' : ''));
    if (!src.jobs.size) throw new Error('No icaffe_be_jobs_*.json.gz files with jobs found');
    const byMon = {}; for (const x of src.jobs.values()) { const k = String(x.grid.JOB_DT || '').slice(3); byMon[k] = (byMon[k] || 0) + 1; }
    say('BE jobs in the files: ' + src.jobs.size + '  (' + Object.entries(byMon).sort((a, b) => a[0].slice(3) + a[0] < b[0].slice(3) + b[0] ? -1 : 1).map(([k, v]) => k + ' ' + v).join(', ') + ')');
    // how much of the iCAFFE job list is covered
    for (const f of (fs.existsSync(TL) ? fs.readdirSync(TL) : []).filter(f => /^icaffe_be_joblist_.*\.json$/.test(f))) {
      try { const r = JSON.parse(fs.readFileSync(path.join(TL, f), 'utf8')).rows || []; const miss = {}; for (const x of r) if (!src.jobs.has(x.ROWID)) { const k = String(x.JOB_DT || '').slice(3); miss[k] = (miss[k] || 0) + 1; }
        say(`  iCAFFE job list ${f}: ${r.length} jobs, not read yet: ${Object.values(miss).reduce((a, b) => a + b, 0)}` + (Object.keys(miss).length ? ' (' + Object.entries(miss).sort((a, b) => a[0].slice(3) + a[0] < b[0].slice(3) + b[0] ? -1 : 1).map(([k, v]) => k + ' ' + v).join(', ') + ')' : '')); } catch (e) { /* skip */ }
    }

    await run('PRAGMA busy_timeout = 30000');
    const colsOf = async (tb) => new Set((await all(`PRAGMA table_info(${tb})`)).map(c => c.name));
    const C = { job: await colsOf('ImportJobs'), inv: await colsOf('ImportInvoices'), item: await colsOf('ImportItems') };
    if (!C.job.size) throw new Error('ImportJobs table not found - start the EagleView backend once, then run this again');
    // lookups
    const brs = await all('SELECT * FROM CompanyBranches').catch(() => []);
    const branch = (code) => {
      const c = String(code || '').toUpperCase();
      const b = brs.find(x => String(x.icaffeCode || '').toUpperCase() === c) || brs.find(x => String(x.branchCode || '').toUpperCase() === c) || (c === 'NDL' || c === 'OFF/1' ? brs.find(x => /^DEL/i.test(x.branchCode || '')) : null);
      return b ? { code: b.branchCode, id: b.id } : { code: c || null, id: null };
    };
    const fys = await all('SELECT * FROM FinancialYears').catch(() => []);
    const fy = (d) => { const f = d && fys.find(y => y.startDate && y.endDate && String(y.startDate).slice(0, 10) <= d && d <= String(y.endDate).slice(0, 10) && !y.isDeleted); return f ? { id: f.id, name: f.name || f.code } : { id: null, name: null }; };
    const party = new Map(); for (const p of await all('SELECT id, code FROM Parties WHERE code IS NOT NULL')) if (!party.has(p.code)) party.set(p.code, p.id);
    // jobs already in EagleView
    const old = await all('SELECT id, jobNo, branchCode, createdBy, updatedBy, icegateStatus, extendedData FROM ImportJobs');
    const byRow = new Map(), byNo = new Map();
    for (const o of old) {
      let e = {}; try { e = JSON.parse(o.extendedData || '{}') || {}; } catch (x) { /* none */ }
      const rid = o.icaffeRowId || e.icaffeRowId; if (rid) byRow.set(rid, o);
      byNo.set(String(o.jobNo || '').trim().toUpperCase(), o);
    }
    const mapped = []; const cnt = { added: 0, refreshed: 0, keptEdited: 0, keptEagle: 0, invoices: 0, items: 0, party: 0, filed: 0, void: 0, linkedWh: 0 }; const byType = {};
    for (const x of src.jobs.values()) mapped.push(mapJob(x, { branch, fy, party }));
    mapped.sort((a, b) => +a.job.jobNo - +b.job.jobNo);

    if (!DRY) { fs.mkdirSync(path.dirname(BACKUP), { recursive: true }); say('Backup: ' + BACKUP); await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'"); }
    await run('BEGIN IMMEDIATE');
    // a job's invoices / items are found by these (a re-run deletes and re-writes them)
    await run('CREATE INDEX IF NOT EXISTS idx_importinvoices_job ON ImportInvoices (importJobId)');
    await run('CREATE INDEX IF NOT EXISTS idx_importitems_invoice ON ImportItems (importInvoiceId)');
    const S = new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00'); // 14-Nov-2026: the form Sequelize (SQLite) reads; 'T...Z' came back as null (job created time, timeline)
    const done = new Map(); // ROWID -> EagleView id
    for (const m of mapped) {
      const j = m.job;
      let o = byRow.get(j.icaffeRowId);
      if (!o) { const same = byNo.get(String(j.jobNo).toUpperCase()); if (same && same.createdBy !== 'iCAFFE') { cnt.keptEagle++; continue; } if (same && same.createdBy === 'iCAFFE' && (!same.branchCode || same.branchCode === j.branchCode)) o = same; }
      if (o && o.createdBy === 'iCAFFE' && o.updatedBy !== 'iCAFFE') { cnt.keptEdited++; done.set(j.icaffeRowId, o.id); continue; } // saved in EagleView after loading
      if (o && o.createdBy !== 'iCAFFE') { cnt.keptEagle++; continue; }
      const row = pack(C.job, j);
      let id;
      if (o) {
        const ks = Object.keys(row);
        // every iCAFFE field is set again (one dropped in iCAFFE becomes empty here too)
        const clear = [...C.job].filter(c => !['id', 'createdAt', 'updatedAt', 'jobNo', 'createdBy', 'extendedData'].includes(c) && !(c in row) && !/^(icegate|filed|amend)/.test(c) && !['beNo', 'beDate', 'assessmentDate', 'dutyPaidDate', 'challanNo', 'oocDate', 'isAmended'].includes(c));
        await run(`UPDATE ImportJobs SET ${ks.map(k => '"' + k + '" = ?').concat(clear.map(c => '"' + c + '" = NULL')).join(', ')}, updatedAt = ? WHERE id = ?`, [...ks.map(k => row[k]), S, o.id]);
        id = o.id;
        const invIds = (await all('SELECT id FROM ImportInvoices WHERE importJobId = ?', [id])).map(r => r.id);
        if (invIds.length) await run(`DELETE FROM ImportItems WHERE importInvoiceId IN (${invIds.map(() => '?').join(',')})`, invIds);
        await run('DELETE FROM ImportInvoices WHERE importJobId = ?', [id]);
        cnt.refreshed++;
      } else {
        const ent = Date.parse(one(src.jobs.get(j.icaffeRowId).job, 0).ENTERED_DT || ''); const created = isNaN(ent) ? S : new Date(ent).toISOString().replace('T', ' ').replace('Z', ' +00:00'); // when it was made in iCAFFE
        id = (await insert('ImportJobs', { ...row, createdAt: created, updatedAt: S })).lastID;
        cnt.added++;
      }
      done.set(j.icaffeRowId, id);
      for (const inv of m.invoices) {
        const ir = pack(C.inv, { ...inv, importJobId: id });
        const invId = (await insert('ImportInvoices', { ...ir, createdAt: S, updatedAt: S })).lastID; cnt.invoices++;
        for (const it of inv.items) { await insert('ImportItems', { ...pack(C.item, { ...it, importInvoiceId: invId, importJobId: id }), createdAt: S, updatedAt: S }); cnt.items++; }
      }
      if (j.importerPartyId) cnt.party++; if (m.beNo) cnt.filed++; if (j.status === 'VOID') cnt.void++;
      const k = j.boeType + ' ' + j.shipmentMode; byType[k] = (byType[k] || 0) + 1;
    }
    // ex-bond -> its warehouse BE job (loaded here, or already in EagleView with that BE no)
    const whByBe = new Map();
    for (const m of mapped) if (m.typ === 'W' && m.beNo && done.has(m.job.icaffeRowId)) whByBe.set(String(m.beNo), done.get(m.job.icaffeRowId));
    for (const r of await all("SELECT id, beNo FROM ImportJobs WHERE beNo IS NOT NULL AND boeType = 'WAREHOUSE'").catch(() => [])) if (!whByBe.has(String(r.beNo))) whByBe.set(String(r.beNo), r.id);
    for (const m of mapped) {
      if (m.typ !== 'X' || !m.warehouseBENo || !done.has(m.job.icaffeRowId)) continue;
      const wh = whByBe.get(String(m.warehouseBENo)); if (!wh) continue;
      const id = done.get(m.job.icaffeRowId);
      if (C.job.has('inBondJobId')) await run("UPDATE ImportJobs SET inBondJobId = ? WHERE id = ? AND coalesce(updatedBy, 'iCAFFE') = 'iCAFFE'", [String(wh), id]);
      cnt.linkedWh++;
    }
    say('Import jobs added: ' + cnt.added + ', refreshed (loaded from iCAFFE before): ' + cnt.refreshed + ', saved in EagleView since loading (left as they are): ' + cnt.keptEdited + ', made in EagleView (not touched): ' + cnt.keptEagle);
    say('  ' + Object.entries(byType).sort().map(([k, v]) => k + ' ' + v).join(', '));
    say('Invoices: ' + cnt.invoices + ', items: ' + cnt.items + '; BE no. filed in iCAFFE: ' + cnt.filed + '; void in iCAFFE: ' + cnt.void + '; importer linked to the Party Master: ' + cnt.party + '; ex-bond linked to its warehouse BE: ' + cnt.linkedWh);
    { let jd = 0, jn = 0, idoc = 0; for (const m of mapped) { if (m.job.esanchitDocs) { jd += m.job.esanchitDocs.length; jn++; } for (const iv of m.invoices) for (const it of iv.items) idoc += (it.docsData || []).length; }
      say('Supporting docs (e-Sanchit): ' + jd + ' BE / invoice level on ' + jn + ' jobs, ' + idoc + ' item level'); }
    const ex = mapped.slice(-3).map(m => `${m.job.jobNo} ${m.job.jobDate} ${m.job.nameOfImporter || ''} BE ${m.beNo || '-'} (${m.invoices.length} inv, ${m.nItems} items)`);
    say('Examples: ' + ex.join(' | '));
    say('Import jobs in EagleView now: ' + (await all('SELECT count(*) n FROM ImportJobs'))[0].n);
    if (DRY) { await run('ROLLBACK'); say('Check only (--check) - nothing saved.'); } else { await run('COMMIT'); say('Done. Restart the backend.'); }
  } catch (e) {
    say('FAILED - nothing was changed: ' + (e && e.stack || e));
    try { await run('ROLLBACK'); } catch (e2) { /* none open */ }
    process.exitCode = 1;
  } finally {
    try { fs.writeFileSync(LOG, log.join('\n')); console.log('Log: ' + LOG); } catch (e) { /* ignore */ }
    db.close();
  }
})();
