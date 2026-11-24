// Save-time checks for an import job (30-Oct-2026). The screens were the only place that checked anything, so an
// Excel / JSON import, a copy, or a typo could put impossible data into the database (a BE date before the IGM date,
// a negative quantity, "12,000" as a number, an item under invoice 7 of a 2-invoice job...). Nothing here asks for a
// field to be FILLED - a draft may be incomplete; that is the ICEGATE validator's job before filing. This refuses
// values that cannot be right, and normalises the harmless ones (commas in numbers, spaces, letter case of codes).
const DATE_KEYS_JOB = ['jobDate', 'beDate', 'assessmentDate', 'dutyPaidDate', 'oocDate', 'igmDate', 'inwardDate', 'mawbDate', 'hawbDate', 'gatewayIgmDate', 'autoField_14', 'autoField_15', 'autoField_16', 'autoField_17', 'warehouseBEDate', 'autoField_31'];
const DATE_KEYS_INV = ['invDate', 'invoiceDate', 'poDate', 'purchaseOrderDate', 'contractDate', 'lcDate', 'svbReferenceDate'];
const NUM_KEYS_JOB = ['totalPkg', 'grossWt', 'itemTotal', 'invTotal', 'totalDuty', 'cifTotalInr'];
const NUM_KEYS_INV = ['value', 'invValue', 'invoiceValue', 'landingRate', 'freightValue', 'freightRate', 'insuranceValue', 'insuranceRate', 'miscCharges', 'miscChargesRate', 'loadingAmount', 'loadingRate', 'agencyCommAmount', 'agencyCommRate', 'discountAmount', 'discountRate', 'exRate', 'exchangeRate', 'hssLoadRate', 'hssLoadAmount'];
const NUM_KEYS_ITEM = ['qty', 'quantity', 'price', 'unitPrice', 'value', 'assessableValue', 'bcdRate', 'bcdAmount', 'swsRate', 'swsAmount', 'healthCessRate', 'healthCessAmount', 'cvdRate', 'cvdAmount', 'adlCvdRate', 'adlCvdAmount', 'saptaRate', 'saptaAmount', 'sqcQty', 'assessableValueInr', 'totalDuty'];

const str = (v) => (v === null || v === undefined) ? '' : String(v).trim();
const isBlank = (v) => str(v) === '';
// yyyy-mm-dd, dd-mm-yyyy, dd/mm/yyyy, yyyymmdd, ISO datetime -> yyyy-mm-dd; null when not a real date
function ymd(v) {
    const s = str(v); if (!s) return '';
    let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(s); let y, mo, d;
    if (m) [y, mo, d] = [m[1], m[2], m[3]];
    else if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s))) [y, mo, d] = [m[3], m[2].padStart(2, '0'), m[1].padStart(2, '0')];
    else if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) [y, mo, d] = [m[1], m[2], m[3]];
    else return null;
    const dt = new Date(Date.UTC(+y, +mo - 1, +d));
    if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +mo - 1 || dt.getUTCDate() !== +d) return null;
    if (+y < 1990 || +y > 2100) return null;
    return `${y}-${mo}-${d}`;
}
const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10); // IST
const plusDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
// "12,000.50" -> 12000.5 ; letters -> NaN
const numOf = (v) => { const s = str(v).replace(/,/g, ''); if (s === '') return null; const n = Number(s); return isFinite(n) ? n : NaN; };

function validateImportSave(p) {
    const errors = [], warnings = [], notes = [];
    const err = (w, m) => errors.push(`${w}: ${m}`);
    const warn = (w, m) => warnings.push(`${w}: ${m}`);
    if (!p || typeof p !== 'object') return { errors: ['Job: nothing to save'], warnings, notes };

    // ---- dates: normalise, refuse impossible ones ----
    const fixDates = (obj, keys, where) => {
        for (const k of keys) {
            if (isBlank(obj[k])) continue;
            const d = ymd(obj[k]);
            if (d === null) { err(where, `${k} "${str(obj[k])}" is not a date`); continue; }
            if (d !== str(obj[k])) { obj[k] = d; notes.push(`${where}: ${k} written as ${d}`); }
        }
    };
    // ---- numbers: normalise, refuse letters / negatives ----
    const fixNums = (obj, keys, where) => {
        for (const k of keys) {
            if (isBlank(obj[k])) continue;
            const n = numOf(obj[k]);
            if (Number.isNaN(n)) { err(where, `${k} "${str(obj[k])}" is not a number`); continue; }
            if (n < 0) { err(where, `${k} cannot be negative (${n})`); continue; }
            const clean = str(obj[k]).replace(/,/g, '');
            if (clean !== str(obj[k])) obj[k] = clean;
        }
    };

    // ---- job ----
    const J = 'Job';
    // ---- shadow copies (30-Oct-2026) ----
    // Some values live under two keys: the screen box and an older column / ICEGATE-named key that the JSON builder
    // and a few screens fall back to. The box wins: when the box key is in the payload, the shadow takes its value
    // (a cleared box clears the shadow), so a stale GSTIN / CTX type / MAWB / port can no longer be filed.
    const SHADOW_JOB = { autoField_50: 'commercialTaxType', autoField_13: 'commercialTaxRegistrationNo', autoField_11: 'ctxStateName', autoField_12: 'stateCode',
        mawbNo: 'mawbblNo', hawbNo: 'hawbhblNo', igmNumber: 'igmNo', portCode: 'autoField_2' };
    // fill-only shadows (older rows may hold the value only under the shadow key; never cleared from a blank box)
    const FILL_JOB = { autoField_4: 'nameOfImporter', autoField_5: 'iecCode', autoField_6: 'address1', autoField_7: 'address2', autoField_8: 'city', autoField_9: 'state', autoField_10: 'pin', autoField_48: 'branchSrNo', autoField_49: 'aeoCode' };
    for (const [box, shadow] of Object.entries(SHADOW_JOB)) if (Object.prototype.hasOwnProperty.call(p, box)) p[shadow] = isBlank(p[box]) ? '' : p[box];
    for (const [box, shadow] of Object.entries(FILL_JOB)) { if (!isBlank(p[box])) p[shadow] = p[box]; else if (!isBlank(p[shadow]) && Object.prototype.hasOwnProperty.call(p, box)) p[box] = p[shadow]; }
    fixDates(p, DATE_KEYS_JOB, J); fixNums(p, NUM_KEYS_JOB, J);
    if (!isBlank(p.jobDate) && ymd(p.jobDate) && ymd(p.jobDate) > plusDays(today(), 1)) err(J, `Job date ${p.jobDate} is in the future`);
    if (!isBlank(p.shipmentMode) && !['AIR', 'SEA', 'LAND'].includes(str(p.shipmentMode).toUpperCase())) err(J, `Shipment mode "${p.shipmentMode}" must be AIR, SEA or LAND`); else if (!isBlank(p.shipmentMode)) p.shipmentMode = str(p.shipmentMode).toUpperCase();
    if (!isBlank(p.boeType) && !['HOME_CONSUMPTION', 'WAREHOUSE', 'EX_BOND'].includes(str(p.boeType).toUpperCase())) err(J, `BE type "${p.boeType}" must be HOME_CONSUMPTION, WAREHOUSE or EX_BOND`); else if (!isBlank(p.boeType)) p.boeType = str(p.boeType).toUpperCase();
    if (!isBlank(p.autoField_5) && !/^[A-Z0-9]{10}$/i.test(str(p.autoField_5))) err(J, `IEC "${str(p.autoField_5)}" must be 10 letters / digits`);
    if (!isBlank(p.autoField_13) && /^G$/i.test(str(p.autoField_50)) && !/^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/i.test(str(p.autoField_13))) err(J, `GSTIN "${str(p.autoField_13)}" is not a valid 15-character GSTIN`);
    if (!isBlank(p.autoField_10) && !/^\d{6}$/.test(str(p.autoField_10))) err(J, `Importer PIN "${str(p.autoField_10)}" must be 6 digits`);
    if (!isBlank(p.beNo) && !/^\d{1,7}$/.test(str(p.beNo))) err(J, `BE No "${str(p.beNo)}" must be up to 7 digits`);
    if (!isBlank(p.autoField_48) && !/^\d{1,3}$/.test(str(p.autoField_48))) err(J, `Branch Sr No "${str(p.autoField_48)}" must be a number`);
    for (const k of ['beDate', 'assessmentDate', 'dutyPaidDate', 'oocDate', 'igmDate', 'inwardDate', 'mawbDate', 'hawbDate', 'gatewayIgmDate']) if (ymd(p[k]) && ymd(p[k]) > plusDays(today(), 1)) err(J, `${k} ${p[k]} is in the future`);
    const igm = ymd(p.igmDate || p.autoField_14), inw = ymd(p.inwardDate || p.autoField_17), be = ymd(p.beDate);
    if (igm && inw && inw < igm) err(J, `Inward date ${inw} is before the IGM date ${igm}`);
    if (be && ymd(p.assessmentDate) && ymd(p.assessmentDate) < be) err(J, `Assessment date is before the BE date ${be}`);
    if (be && ymd(p.dutyPaidDate) && ymd(p.dutyPaidDate) < be) err(J, `Duty paid date is before the BE date ${be}`);
    if (be && ymd(p.oocDate) && ymd(p.oocDate) < be) err(J, `Out of charge date is before the BE date ${be}`);
    if (!isBlank(p.totalPkg) && numOf(p.totalPkg) !== null && !Number.isInteger(numOf(p.totalPkg))) err(J, `Total packages "${str(p.totalPkg)}" must be a whole number`);
    for (const k of ['kachchaBE', 'highSeaSaleFlag', 'greenChannel', 'section48Requested', 'firstCheckRequested']) if (!isBlank(p[k]) && !/^[YN]$/i.test(str(p[k]))) err(J, `${k} must be Y or N (now "${str(p[k])}")`);
    // IGM grid rows
    let rows = p._igmRows; if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch (e) { rows = null; } }
    if (Array.isArray(rows)) rows.forEach((r, i) => { if (!r || typeof r !== 'object') return; const w = `IGM row ${i + 1}`; fixDates(r, ['igmDate', 'inwardDate', 'mawbDate', 'hawbDate'], w); fixNums(r, ['totalPkg', 'grossWt'], w);
        const a = ymd(r.igmDate), b = ymd(r.inwardDate); if (a && b && b < a) err(w, `Inward date ${b} is before the IGM date ${a}`); });
    if (Array.isArray(rows) && typeof p._igmRows === 'string') p._igmRows = JSON.stringify(rows);

    // ---- invoices + items ----
    const invs = Array.isArray(p.invoices) ? p.invoices : [];
    const seen = new Set();
    // the same invoice number twice on one job (case / space insensitive) - whatever path put it there (screen, Excel,
    // copy...). ICES keys the invoice by its serial, so two rows with one number would be filed as two invoices.
    const invKey = (inv) => str(inv && (inv.invNo || inv.invoiceNo || inv.invoiceNumber)).replace(/\s+/g, '').toUpperCase();
    const seenInv = new Map();
    invs.forEach((inv, i) => { const k = invKey(inv); if (!k) return; if (seenInv.has(k)) err(`Invoice ${i + 1}`, `Invoice No "${str(inv.invNo || inv.invoiceNo || inv.invoiceNumber)}" is already on this job as invoice ${seenInv.get(k) + 1} - a duplicate is not saved`); else seenInv.set(k, i); });
    invs.forEach((inv, i) => { if (inv && typeof inv === 'object' && !invKey(inv) && Array.isArray(inv.items) && inv.items.length) err(`Invoice ${i + 1}`, `has ${inv.items.length} item(s) but no Invoice No - enter the invoice in 3. Invoices (select the row, fill it, Modify)`); });
    invs.forEach((inv, i) => {
        if (!inv || typeof inv !== 'object') return;
        const W = `Invoice ${i + 1}${str(inv.invNo) ? ' (' + str(inv.invNo) + ')' : ''}`;
        // invoice shadows: the screen writes invNo / invDate / value / currency / terms; file imports also carry the
        // ICEGATE names. The builder read invoiceDate first, so an edited date was filed with the OLD date (30-Oct-2026)
        for (const [box, shadow] of Object.entries({ invNo: 'invoiceNo', invDate: 'invoiceDate', value: 'invoiceValue', currency: 'invoiceCurrency', terms: 'termsOfInvoice' }))
            if (Object.prototype.hasOwnProperty.call(inv, box)) inv[shadow] = isBlank(inv[box]) ? '' : inv[box];
        fixDates(inv, DATE_KEYS_INV, W); fixNums(inv, NUM_KEYS_INV, W);
        for (const k of ['invDate', 'invoiceDate']) if (ymd(inv[k]) && ymd(inv[k]) > plusDays(today(), 1)) err(W, `Invoice date ${inv[k]} is in the future`);
        const cur = str(inv.currency || inv.invoiceCurrency).toUpperCase();
        if (cur && !/^[A-Z]{3}$/.test(cur)) err(W, `Currency "${cur}" must be a 3-letter code`); else if (cur) { if (!isBlank(inv.currency)) inv.currency = cur; if (!isBlank(inv.invoiceCurrency)) inv.invoiceCurrency = cur; }
        const terms = str(inv.terms || inv.termsOfInvoice).toUpperCase();
        if (terms && !['CIF', 'FOB', 'CF', 'CI', 'C&F', 'CFR'].includes(terms)) err(W, `Terms "${terms}" must be CIF, FOB, CF or CI`); else if (terms) { if (!isBlank(inv.terms)) inv.terms = terms; if (!isBlank(inv.termsOfInvoice)) inv.termsOfInvoice = terms; }
        // 10-Nov-2026: a job read from iCAFFE (and its BE amendment copies) carries the rate AND the amount iCAFFE worked out
        // from it - that is how the BE was filed, so it is saved as it is (a fresh BE is still checked at filing)
        const fromIcaffe = !isBlank(p.icaffeRowId) || !isBlank(p._amendmentId);
        if (!fromIcaffe && !isBlank(inv.freightValue) && !isBlank(inv.freightRate) && numOf(inv.freightValue) && numOf(inv.freightRate)) err(W, 'Freight: give the amount OR the rate, not both');
        if (!fromIcaffe && !isBlank(inv.insuranceValue) && !isBlank(inv.insuranceRate) && numOf(inv.insuranceValue) && numOf(inv.insuranceRate)) err(W, 'Insurance: give the amount OR the rate, not both');
        if (['CIF', 'CF', 'C&F', 'CFR'].includes(terms) && (numOf(inv.freightValue) || numOf(inv.freightRate))) err(W, `Terms ${terms} already include freight - the freight amount / rate must be empty`);
        if (['CIF', 'CI'].includes(terms) && (numOf(inv.insuranceValue) || numOf(inv.insuranceRate))) err(W, `Terms ${terms} already include insurance - the insurance amount / rate must be empty`);
        const nt = str(inv.natureOfTransaction).toUpperCase(); if (nt && !/^[SCHFORPGM]$/.test(nt)) err(W, `Nature of transaction "${nt}" must be one of S C H F O R P G M`);
        for (const k of ['exRate', 'exchangeRate']) if (!isBlank(inv[k]) && numOf(inv[k]) === 0) err(W, `Exchange rate cannot be 0`);
        const items = Array.isArray(inv.items) ? inv.items : [];
        let itemSum = 0, itemSumKnown = false;
        items.forEach((it, k) => {
            if (!it || typeof it !== 'object') return;
            const Wi = `${W} item ${str(it.itemSrNo) || k + 1}`;
            fixNums(it, NUM_KEYS_ITEM, Wi);
            const sr = str(it.invSrNo); if (sr && /^\d+$/.test(sr) && (+sr < 1 || +sr > invs.length)) err(Wi, `Inv Sr No ${sr} does not exist (this job has ${invs.length} invoice(s))`);
            const isr = str(it.itemSrNo); if (isr && !/^\d{1,4}$/.test(isr)) err(Wi, `Item Sr No "${isr}" must be a whole number (1-9999)`); else if (isr && +isr < 1) err(Wi, 'Item Sr No must be 1 or more');
            const key = `${sr || i + 1}/${isr}`; if (isr) { if (seen.has(key)) err(Wi, `Item Sr No ${isr} is used twice in invoice ${sr || i + 1}`); seen.add(key); }
            const ritc = str(it.ritc || it.hsCode); if (ritc && !/^\d{4,8}$/.test(ritc)) err(Wi, `RITC "${ritc}" must be digits (8 for filing)`);
            const cth = str(it.cth); if (cth && !/^\d{4,8}$/.test(cth)) err(Wi, `CTH "${cth}" must be digits`);
            const coo = str(it.countryOfOrigin).toUpperCase(); if (coo && !/^[A-Z]{2}$/.test(coo)) err(Wi, `Country of origin "${coo}" must be a 2-letter code`); else if (coo && !isBlank(it.countryOfOrigin)) it.countryOfOrigin = coo;
            const rt = str(it.rateTypeFlag).toUpperCase(); if (rt && !/^[SP]$/.test(rt)) err(Wi, `Rate type "${rt}" must be S or P`); else if (rt) it.rateTypeFlag = rt;
            if (!isBlank(it.accessoryStatus) && !/^[012]$/.test(str(it.accessoryStatus))) err(Wi, `Accessory status must be 0, 1 or 2`);
            for (const r of ['bcdRate', 'swsRate', 'healthCessRate', 'cvdRate', 'adlCvdRate', 'saptaRate']) if (!isBlank(it[r]) && numOf(it[r]) > 1000) err(Wi, `${r} ${str(it[r])} % is not a rate`);
            const q = numOf(it.qty ?? it.quantity), pr = numOf(it.price ?? it.unitPrice);
            if (q !== null && !Number.isNaN(q) && q === 0 && (pr || 0) > 0) warn(Wi, 'Quantity is 0');
            // connected fields (30-Oct-2026): an item sits under the invoice its Inv Sr No says; value = qty x unit price;
            // the item currency is the invoice currency; the invoice value is the sum of its items
            if (sr && /^\d+$/.test(sr) && +sr !== i + 1 && +sr >= 1 && +sr <= invs.length) err(Wi, `Inv Sr No ${sr} but the item is under invoice ${i + 1}`);
            const v = numOf(it.value);
            if (q !== null && pr !== null && v !== null && q > 0 && pr > 0 && v > 0 && str(it.foc).toUpperCase() !== 'Y' && Math.abs(v - q * pr) > Math.max(1, q * pr * 0.01)) err(Wi, `Value ${v} does not match Qty ${q} x Unit price ${pr} = ${(q * pr).toFixed(2)}`);
            if (v !== null && v > 0) { itemSum += v; itemSumKnown = true; }
            const icur = str(it.currency || it.itemCurrency).toUpperCase(); if (icur && cur && icur !== cur) err(Wi, `Item currency ${icur} differs from the invoice currency ${cur}`);
        });
        const invVal = numOf(inv.value ?? inv.invoiceValue);
        // 18-Nov-2026: items are typed one by one, so while a job is being entered they add up to LESS than the invoice
        // value - that is incomplete, not impossible, and refusing it kept every item on the screen only (a reload lost
        // them). Items worth MORE than the invoice cannot be right and are still refused; the exact tally (ICEGATE error
        // 260) is checked when the BE is validated / filed (utils/icegateValidate.js).
        if (itemSumKnown && invVal !== null && invVal > 0 && Math.abs(invVal - itemSum) > Math.max(1, invVal * 0.005)) {
            if (itemSum > invVal) err(W, `Items ${itemSum.toFixed(2)} are worth more than the invoice value ${invVal} - correct the invoice value or the item values`);
            else warn(W, `Items so far ${itemSum.toFixed(2)} of invoice value ${invVal} (${(invVal - itemSum).toFixed(2)} still to enter) - the BE can be filed only when they tally`);
        }
    });
    // containers
    const conts = Array.isArray(p.containers) ? p.containers : [];
    conts.forEach((c, i) => { if (!c || typeof c !== 'object') return; const W = `Container ${i + 1}`; const no = str(c.containerNo || c.contNo || c.ContainerNumber || c.contNumber).toUpperCase();
        if (no && !/^[A-Z]{4}\d{7}$/.test(no)) err(W, `Container no "${no}" must be 4 letters + 7 digits`); });
    return { errors, warnings, notes };
}

module.exports = { validateImportSave, ymd, numOf };
