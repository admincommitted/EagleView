// Shared field mapping for POST /api/awb/create and PUT /api/awb/update/:id (29-Oct-2026).
//
// Before, create and update each had their own copy and they had drifted apart:
// - update used "form value || saved value", so a field cleared on screen (flight 2, buyer, SSR, signature...) kept
//   the old value in the column (and in the XML) while the form copy was cleared. Now a key sent by the screen is
//   used as sent (even empty); only keys not sent at all keep the saved value;
// - addresses were cut to 35 / city to 17 characters in the columns and the cut copy came back on the next edit, so
//   the text was lost for good. The columns now keep the full text; the XML builder already cuts to the IATA lengths;
// - destinationCurrency (create only), agentCity / agentCountry / flight 3 (never written), other-charge description
//   (update), ccChargesDest (update reset it to 0) are now written on both;
// - rate lines: CBM volume and volumetric weight were mixed up, the rate class was saved as the whole label
//   ("Q - QUANTITY RATE"), chargeable-weight unit and the line's dimensions were dropped;
// - dimension rows: the Dimension window sends pkgs / unit / volWt, which were read as pcs / cmIn / vol, so pieces and
//   volume were saved empty; on update also cm/inch and the rate-line link were lost.
const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;
const str = (v) => (v === null || v === undefined ? '' : String(v));

// first key the screen sent (even empty) -> its value; none sent -> saved value; nothing saved -> default
function field(fd, keys, prev, col, dflt = '') {
    for (const k of keys) if (has(fd, k)) return fd[k] === null ? '' : fd[k];
    if (prev && prev[col] !== undefined && prev[col] !== null) return prev[col];
    return dflt;
}
// party block (shipper / consignee / buyer): when the screen sends the party, its fields are used as sent
function party(fd, key, prev, prefix) {
    const p = has(fd, key) && fd[key] && typeof fd[key] === 'object' ? fd[key] : null;
    const old = (c) => (prev ? str(prev[prefix + c]) : '');
    const g = (k, c) => (p ? str(p[k]) : old(c));
    const out = {
        [prefix + 'Name']: g('name', 'Name'), [prefix + 'Address']: g('street', 'Address'), [prefix + 'City']: g('city', 'City'),
        [prefix + 'State']: g('state', 'State'), [prefix + 'Country']: g('country', 'Country'), [prefix + 'Zip']: g('zip', 'Zip'),
        [prefix + 'Phone']: g('phone', 'Phone'),
    };
    const emailKey = key + 'Email';
    out[prefix + 'Email'] = has(fd, emailKey) ? str(fd[emailKey]) : (p && p.email !== undefined ? str(p.email) : old('Email'));
    return out;
}
const numOr = (v, fallback) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : fallback; };

function mainFields(body, prev) {
    const fd = body.formData || {};
    const rl = Array.isArray(body.rateLines) ? body.rateLines : [];
    const sumPcs = rl.reduce((s, r) => s + (parseInt(r.noOfPcs || r.pieces, 10) || 0), 0);
    const sumWt = rl.reduce((s, r) => s + (parseFloat(r.grossWeight) || 0), 0);
    const ag = fd.agentDetails && typeof fd.agentDetails === 'object' ? fd.agentDetails : {};
    const agent = (keys, agKey, col) => { const v = field(fd, keys, null, col, undefined); if (v !== undefined) return str(v); if (has(ag, agKey)) return str(ag[agKey]); return prev ? str(prev[col]) : ''; };
    const top = (k) => (has(body, k) ? str(body[k]) : (prev ? str(prev[k]) : ''));
    const shipper = party(fd, 'shipper', prev, 'shipper');
    const consignee = party(fd, 'consignee', prev, 'consignee');
    if (!shipper.shipperName && has(fd, 'shipperName')) shipper.shipperName = str(fd.shipperName);
    if (!consignee.consigneeName && has(fd, 'consigneeName')) consignee.consigneeName = str(fd.consigneeName);
    const o = {
        ...shipper, ...consignee, ...party(fd, 'buyer', prev, 'buyer'),
        shipperName: shipper.shipperName || 'UNKNOWN', consigneeName: consignee.consigneeName || 'UNKNOWN',
        formData: fd,
        agentName: agent(['agentName'], 'name', 'agentName'),
        agentCode: agent(['agentCode'], 'code', 'agentCode'),
        agentAccountNo: agent(['agentAccountNo'], 'accountNo', 'agentAccountNo'),
        agentPlace: agent(['agentPlace'], 'place', 'agentPlace'),
        agentCity: agent(['agentCity'], 'city', 'agentCity'),
        agentCountry: agent(['agentCountry'], 'country', 'agentCountry'),
        agentDocs: str(field(fd, ['agentDocs'], prev, 'agentDocs')),
        agentEori: str(field(fd, ['agentEori'], prev, 'agentEori')),
        agentAccountingInfo: str(field(fd, ['agentAccountingInfo'], prev, 'agentAccountingInfo')),
        origin: str(field(fd, ['dep', 'origin'], prev, 'origin', '')) || 'UNK',
        destination: str(field(fd, ['dest', 'destination'], prev, 'destination', '')) || 'UNK',
        totalPieces: parseInt(fd.totalPieces, 10) || sumPcs || (prev && prev.totalPieces) || 1,
        grossWeight: numOr(fd.grossWeight, 0) || sumWt || (prev && prev.grossWeight) || 0.1,
        totalVolume: has(fd, 'totalVolume') ? numOr(fd.totalVolume, 0) : (prev ? numOr(prev.totalVolume, 0) : 0),
        flightNumber1: str(field(fd, ['flight1', 'flightNumber1'], prev, 'flightNumber1')),
        flightDate1: str(field(fd, ['flightDate1'], prev, 'flightDate1')),
        flightNumber2: str(field(fd, ['flight2', 'flightNumber2'], prev, 'flightNumber2')),
        flightDate2: str(field(fd, ['flightDate2'], prev, 'flightDate2')),
        flightNumber3: str(field(fd, ['flight3', 'flightNumber3'], prev, 'flightNumber3')),
        flightDate3: str(field(fd, ['flightDate3'], prev, 'flightDate3')),
        to1: str(field(fd, ['to1'], prev, 'to1')), by1: str(field(fd, ['by1'], prev, 'by1')),
        to2: str(field(fd, ['to2'], prev, 'to2')), by2: str(field(fd, ['by2'], prev, 'by2')),
        to3: str(field(fd, ['to3'], prev, 'to3')), by3: str(field(fd, ['by3'], prev, 'by3')),
        depAirport: str(field(fd, ['depAirport'], prev, 'depAirport')),
        destAirport: str(field(fd, ['destAirport'], prev, 'destAirport')),
        natureOfGoods: str(field(fd, ['natureOfGoods'], prev, 'natureOfGoods')),
        productId: str(field(fd, ['productId'], prev, 'productId')),
        currencyCode: str(field(fd, ['currencyCode'], prev, 'currencyCode')).slice(0, 3) || null,
        destinationCurrency: str(field(fd, ['destinationCurrency'], prev, 'destinationCurrency')).slice(0, 3) || null,
        chargeCode: str(field(fd, ['chargeCode'], prev, 'chargeCode')) || 'PP',
        wtVal: str(field(fd, ['wtVal'], prev, 'wtVal')) || 'P',
        other: str(field(fd, ['other'], prev, 'other')) || 'P',
        declaredValueCarriage: str(field(fd, ['carriageValue', 'declaredValueCarriage'], prev, 'declaredValueCarriage')) || 'NVD',
        declaredValueCustoms: str(field(fd, ['customsValue', 'declaredValueCustoms'], prev, 'declaredValueCustoms')) || 'NCV',
        amountOfInsurance: str(field(fd, ['insurance', 'amountOfInsurance'], prev, 'amountOfInsurance')) || 'XXX',
        accountingInformation: str(field(fd, ['accountingInfo', 'accountingInformation'], prev, 'accountingInformation')),
        // the screens send it at the top level (handlingInformation), not inside formData
        handlingInformation: str(field({ ...(has(body, 'handlingInformation') ? { handlingInformation: body.handlingInformation } : {}), ...fd }, ['handlingInfo', 'handlingInformation'], prev, 'handlingInformation')),
        ssr: top('ssr'), osi: top('osi'), sci: top('sci'),
        signatureShipper: str(field(fd, ['signatureShipper'], prev, 'signatureShipper')),
        signatureCarrier: str(field(fd, ['signatureCarrier'], prev, 'signatureCarrier')),
        executedDate: str(field(fd, ['executedDate'], prev, 'executedDate')),
        executedPlace: str(field(fd, ['executedPlace'], prev, 'executedPlace')),
    };
    for (const [col, keys] of [['weightChargePP', ['weightChargePP']], ['weightChargeCC', ['weightChargeCC']], ['valChargePP', ['valChargePP']], ['valChargeCC', ['valChargeCC']],
        ['taxPP', ['taxPP']], ['taxCC', ['taxCC']], ['totalChargePP', ['totalPP', 'totalChargePP']], ['totalChargeCC', ['totalCC', 'totalChargeCC']], ['ccChargesDest', ['ccChargesDest']]]) {
        o[col] = numOr(field(fd, keys, prev, col, 0), 0);
    }
    return o;
}

// rate class code: the window sends rateClass "Q" and rateClassCode "Q - QUANTITY RATE"
// 11-Nov-2026: the grid's select changes rateClassCode only, and rateClass (the old value) won - a change from Q to N was
// not saved. Now the code (the select) wins, as a letter; "N - NORMAL RATE" style old values become "N".
const RATE_CLASSES = ['M', 'N', 'Q', 'B', 'K', 'C', 'E', 'R', 'S', 'U', 'X', 'Y', 'W', 'P'];
const rcLetter = (v) => { const t = str(v).trim().toUpperCase().split(/\s*-\s*/)[0].trim(); return RATE_CLASSES.includes(t) ? t : ''; };
const rateClassOf = (r) => rcLetter(r.rateClassCode) || rcLetter(r.rateClass) || (str(r.rateClass).trim() && !/^SELECT/i.test(str(r.rateClass).trim()) ? str(r.rateClass).trim().toUpperCase().charAt(0) : '');
const CBM_PER_KG = 1 / 166.6667; // IATA 6000 cm3 per kg
function rateLineRow(r, awbId, type) {
    const volWt = numOr(r.volumetricWeight, 0);
    const vol = numOr(r.volume, 0) || (volWt ? +(volWt * CBM_PER_KG).toFixed(3) : 0);
    return {
        awbId, awbType: type,
        pieces: str(r.noOfPcs || r.pieces), grossWeight: str(r.grossWeight), rateClass: rateClassOf(r),
        commodityItemNo: str(r.commodityItemNumber || r.commodityItemNo), chargeableWeight: str(r.chargeableWeight), rateCharge: str(r.rateCharge),
        total: str(r.totalAmount || r.total), natureOfGoods: str(r.goodsDescription || r.natureOfGoods), slac: str(r.slac), rcp: str(r.rcp),
        rateClassPercentage: str(r.rateClassPercentage), volume: vol ? String(vol) : '', volumetricWeight: volWt ? String(volWt) : '', cwUnit: str(r.cwUnit),
        mc: str(r.mc), harmonisedCode: str(r.harmonisedCode || r.hsCode), isRounded: r.isRounded !== false /* 0.5 kg rounding on unless switched off (IATA), 29-Oct-2026 */, rateAsAgreed: !!r.rateAsAgreed, gwUnit: str(r.gwUnit) || 'K',
        length: str(r.length), width: str(r.width), height: str(r.height), cmIn: str(r.cmIn), noOfUnits: str(r.noOfUnits),
        dimensions: Array.isArray(r.dimensions) && r.dimensions.length ? JSON.stringify(r.dimensions) : null,
        uldType: str(r.uldType), uldSerial: str(r.uldSerial), uldOwner: str(r.uldOwner), uldRateClass: str(r.uldRateClass),
    };
}
function dimRow(d, awbId, type, i) {
    const pcs = parseInt(d.pcs || d.pieces || d.pkgs || d.noOfUnits, 10) || null;
    const L = numOr(d.len ?? d.length, null), W = numOr(d.wid ?? d.width, null), H = numOr(d.ht ?? d.height, null);
    const u = str(d.cmIn || d.unit || 'CM').toUpperCase();
    const unit = u.startsWith('IN') ? 'IN' : 'CM';
    let vol = numOr(d.vol ?? d.volume, null);
    if (!vol && L && W && H) vol = +((L * W * H * (pcs || 1) * (unit === 'IN' ? 16.387064 : 1)) / 1e6).toFixed(4); // CBM
    return {
        awbId, awbType: type, rateLineIndex: d.rateLineIndex ?? d.lineIndex ?? null, pieces: pcs, length: L, width: W, height: H, volume: vol, cmIn: unit,
        volumetricWeight: numOr(d.volWt ?? d.volumetricWeight, null),
    };
}

async function writeChildren(models, awbId, type, body, t, isUpdate, prevType) {
    const { SpecialHandlingCode, AwbRateLine, AwbOtherCharge, AwbOci, AwbDimension } = models;
    if (isUpdate) {
        // rows of this record: an AWB opened on the MAWB screen may have been saved as type 'AWB' (or the reverse)
        const types = type === 'HAWB' ? ['HAWB'] : [...new Set([type, prevType, 'AWB', 'MAWB'].filter(Boolean))];
        // 11-Nov-2026: only the parts the caller sent are replaced - a change that did not send the rate lines (or charges,
        // codes, OCI, dimensions) used to delete them. The AWB screens always send all five.
        for (const [M, key] of [[SpecialHandlingCode, 'sphCodes'], [AwbRateLine, 'rateLines'], [AwbOtherCharge, 'otherCharges'], [AwbOci, 'ociRows'], [AwbDimension, 'dimRows']]) {
            if (Array.isArray(body[key])) await M.destroy({ where: { awbId, awbType: types }, transaction: t });
        }
    }
    for (const code of Array.isArray(body.sphCodes) ? body.sphCodes : []) {
        if (code && String(code).trim()) await SpecialHandlingCode.create({ awbId, awbType: type, code: String(code).trim() }, { transaction: t });
    }
    for (const r of Array.isArray(body.rateLines) ? body.rateLines : []) {
        if (!(r && (r.noOfPcs || r.pieces || r.grossWeight || r.goodsDescription || r.natureOfGoods))) continue;
        await AwbRateLine.create(rateLineRow(r, awbId, type), { transaction: t });
    }
    for (const c of Array.isArray(body.otherCharges) ? body.otherCharges : []) {
        if (!(c && c.code)) continue;
        await AwbOtherCharge.create({ awbId, awbType: type, chargeCode: c.code, description: c.description || c.chargeDescription || c.name || null,
            entitlement: c.entitlement, ppcc: c.ppcc || c.entitlement || 'PP', amount: c.amount, rate: c.rate }, { transaction: t });
    }
    for (const o of Array.isArray(body.ociRows) ? body.ociRows : []) {
        if (!(o && (o.country || o.infoId || o.countryCode))) continue;
        await AwbOci.create({ awbId, awbType: type, countryCode: o.country || o.countryCode || '', infoId: o.infoId || '', customsId: o.customsId || '', suppInfo: o.suppInfo || '' }, { transaction: t });
    }
    // extra documents (DG declaration, SLI, DO ...): { DGD: {...fields}, SLI: {...} } - upsert, a null value removes it
    if (models.AwbExtraDoc && body.extraDocs && typeof body.extraDocs === 'object') {
        for (const [docType, data] of Object.entries(body.extraDocs)) {
            const key = String(docType).toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 30);
            if (!key) continue;
            const types = type === 'HAWB' ? ['HAWB'] : ['AWB', 'MAWB'];
            await models.AwbExtraDoc.destroy({ where: { awbId, awbType: types, docType: key }, transaction: t });
            if (data !== null && data !== undefined) await models.AwbExtraDoc.create({ awbId, awbType: type, docType: key, data: JSON.stringify(data), updatedBy: body.user || null }, { transaction: t });
        }
    }
    const dims = Array.isArray(body.dimRows) ? body.dimRows : [];
    for (let i = 0; i < dims.length; i++) {
        const d = dims[i];
        if (!(d && (d.pcs || d.pieces || d.pkgs || d.noOfUnits || d.len || d.length))) continue;
        await AwbDimension.create(dimRow(d, awbId, type, i), { transaction: t });
    }
}

// ---- server-side checks for create / update (29-Oct-2026). Before, the API saved whatever came in and filled gaps
// with made-up values (origin 'UNK', shipper 'UNKNOWN', 1 piece, 0.1 kg) and never checked the AWB check digit on create.
const AWB_RE = /^\d{11}$/;
function awbNoError(no, label = 'AWB') {
    const bare = String(no || '').replace(/[\s-]/g, '');
    if (!AWB_RE.test(bare)) return `${label} number must be 11 digits (3-digit airline prefix + 8 digits), got "${no || ''}"`;
    if (Number(bare.slice(3, 10)) % 7 !== Number(bare[10])) return `${label} ${no}: check digit is wrong (for ${bare.slice(3, 10)} it must be ${Number(bare.slice(3, 10)) % 7})`;
    return null;
}
const nameOf = (fd, key) => { const p = fd && fd[key]; if (p && typeof p === 'object') return str(p.name).trim(); return str(fd && fd[key + 'Name']).trim(); };
const n = (v) => { if (v === null || v === undefined || String(v).trim() === '') return null; const x = parseFloat(String(v).replace(/,/g, '')); return Number.isFinite(x) ? x : NaN; };

// returns a list of messages; [] = ok. On update only the parts the screen sent are checked.
// prev = saved record on update: a number that did not change is not checked again (old records keep working)
const sameNo = (a, b) => !!a && !!b && String(a).replace(/[^A-Za-z0-9]/g, '').toUpperCase() === String(b).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
function validateAwb(body, type, isCreate, prev) {
    const errs = [];
    const fd = (body && body.formData) || {};
    const T = String(type || '').toUpperCase();
    if (!['AWB', 'MAWB', 'HAWB'].includes(T)) errs.push(`Unknown type "${type || ''}" (AWB, MAWB or HAWB)`);
    const no = body.awbNumber;
    if (isCreate || (no !== undefined && no !== 'DRAFT' && !(prev && sameNo(no, prev.awbNumber)))) {
        if (!no || no === 'DRAFT') errs.push(T === 'HAWB' ? 'HAWB number is required' : 'AWB number is required');
        else if (T === 'HAWB') { if (!/^[A-Za-z0-9][A-Za-z0-9\-\/]{0,34}$/.test(String(no).trim())) errs.push('HAWB number: up to 35 letters / digits (- and / allowed)'); }
        else { const e = awbNoError(no); if (e) errs.push(e); }
    }
    if (T === 'HAWB' && (isCreate || (body.masterAwbNumber !== undefined && !(prev && sameNo(body.masterAwbNumber, prev.masterAwbNumber))))) {
        if (!body.masterAwbNumber) errs.push('MAWB number is required for a HAWB');
        else { const e = awbNoError(body.masterAwbNumber, 'MAWB'); if (e) errs.push(e); }
    }
    const orgSent = has(fd, 'dep') || has(fd, 'origin'), dstSent = has(fd, 'dest') || has(fd, 'destination');
    const org = str(has(fd, 'dep') ? fd.dep : fd.origin).trim().toUpperCase(), dst = str(has(fd, 'dest') ? fd.dest : fd.destination).trim().toUpperCase();
    if ((isCreate || orgSent) && !/^[A-Z]{3}$/.test(org)) errs.push('Origin airport must be a 3-letter code');
    if ((isCreate || dstSent) && !/^[A-Z]{3}$/.test(dst)) errs.push('Destination airport must be a 3-letter code');
    if (org && dst && org === dst) errs.push('Origin and destination cannot be the same airport');
    for (const [k, label] of [['shipper', 'Shipper'], ['consignee', 'Consignee']]) {
        const sent = has(fd, k) || has(fd, k + 'Name');
        if ((isCreate || sent) && !nameOf(fd, k)) errs.push(`${label} name is required`);
    }
    if (isCreate || Array.isArray(body.rateLines)) {
        const lines = (Array.isArray(body.rateLines) ? body.rateLines : []).filter((r) => r && (r.noOfPcs || r.pieces || r.grossWeight || r.goodsDescription || r.natureOfGoods || r.chargeableWeight));
        if (!lines.some((r) => n(r.grossWeight) > 0)) errs.push('At least one rate line with gross weight is required');
        lines.forEach((r, i) => {
            const L = `Rate line ${i + 1}`;
            const pcs = n(r.noOfPcs ?? r.pieces), gw = n(r.grossWeight), cw = n(r.chargeableWeight), rate = n(r.rateCharge), tot = n(r.totalAmount ?? r.total);
            if (Number.isNaN(pcs) || (pcs !== null && (pcs < 1 || !Number.isInteger(pcs)))) errs.push(`${L}: pieces must be a whole number of 1 or more`);
            if (gw > 0 && pcs === null) errs.push(`${L}: pieces are required`);
            if (Number.isNaN(gw) || gw < 0) errs.push(`${L}: gross weight must be 0 or more`);
            if (Number.isNaN(cw) || cw < 0) errs.push(`${L}: chargeable weight must be 0 or more`);
            else if (cw !== null && cw > 0 && gw > 0 && cw + 0.001 < gw) errs.push(`${L}: chargeable weight (${cw}) cannot be less than gross weight (${gw})`);
            if (Number.isNaN(rate) || rate < 0) errs.push(`${L}: rate must be 0 or more`);
            if (Number.isNaN(tot) || tot < 0) errs.push(`${L}: total must be 0 or more`);
        });
    }
    if (Array.isArray(body.otherCharges)) body.otherCharges.forEach((c, i) => {
        if (!c || !c.code) return;
        const a = n(c.amount);
        if (Number.isNaN(a) || a < 0) errs.push(`Other charge ${c.code} (row ${i + 1}): amount must be 0 or more`);
        if (c.entitlement && !/^(A|C|AGENT|CARRIER|DUE ?AGENT|DUE ?CARRIER)$/i.test(String(c.entitlement))) errs.push(`Other charge ${c.code}: due must be Agent or Carrier`);
    });
    if (Array.isArray(body.dimRows)) body.dimRows.forEach((d, i) => {
        for (const k of ['len', 'length', 'wid', 'width', 'ht', 'height', 'pcs', 'pieces', 'pkgs']) { const v = d && n(d[k]); if (Number.isNaN(v) || v < 0) { errs.push(`Dimension row ${i + 1}: ${k} must be 0 or more`); break; } }
    });
    for (const k of ['weightChargePP', 'weightChargeCC', 'valChargePP', 'valChargeCC', 'taxPP', 'taxCC', 'totalPP', 'totalCC']) {
        const v = n(fd[k]); if (Number.isNaN(v) || v < 0) errs.push(`${k} must be 0 or more`);
    }
    for (const k of ['currencyCode', 'destinationCurrency']) if (fd[k] && !/^[A-Za-z]{3}$/.test(String(fd[k]).trim())) errs.push(`${k} must be a 3-letter currency code`);
    if (body.extraDocs && typeof body.extraDocs === 'object') for (const [k, v] of Object.entries(body.extraDocs)) {
        if (v !== null && v !== undefined && JSON.stringify(v).length > 200000) errs.push(`Document ${k} is too large to save`);
    }
    return errs;
}

// minimum the airline needs in an FWB / FHL / FZB (29-Oct-2026). Before, the message generator filled the gaps itself
// (shipper country "IN", consignee country empty, city = airport code) and the airline rejected or mis-filed it.
function ediReadyErrors(awb, type) {
    const errs = [];
    const T = String(type || '').toUpperCase();
    const g = (k) => str(awb && awb[k]).trim();
    if (T === 'HAWB') {
        if (!/^[A-Za-z0-9]{1,12}$/.test(g('awbNumber'))) errs.push(`HAWB number "${g('awbNumber')}": EDI allows letters and digits only, up to 12`);
        const m = awbNoError(g('masterAwbNumber'), 'MAWB'); if (m) errs.push(m);
    } else { const e = awbNoError(g('awbNumber')); if (e) errs.push(e); }
    if (!/^[A-Z]{3}$/i.test(g('origin'))) errs.push('Origin airport (3 letters) missing');
    if (!/^[A-Z]{3}$/i.test(g('destination'))) errs.push('Destination airport (3 letters) missing');
    for (const [p, L] of [['shipper', 'Shipper'], ['consignee', 'Consignee']]) {
        if (!g(p + 'Name')) errs.push(`${L} name missing`);
        if (!g(p + 'Address')) errs.push(`${L} address missing`);
        if (!g(p + 'City')) errs.push(`${L} city missing`);
        if (!/^[A-Z]{2}$/i.test(g(p + 'Country'))) errs.push(`${L} country must be the 2-letter ISO code (now "${g(p + 'Country')}")`);
    }
    if (T !== 'HAWB') { // 11-Nov-2026: routing - the first "to" cannot be the departure, the last one must be the destination
        const to = [g('to1'), g('to2'), g('to3')].map(x => x.toUpperCase()).filter(Boolean);
        if (to.length && to[0] === g('origin').toUpperCase()) errs.push(`Routing: first "To" ${to[0]} is the airport of departure - give the next airport`);
        if (to.length && g('destination') && to[to.length - 1] !== g('destination').toUpperCase()) errs.push(`Routing ends at ${to[to.length - 1]} but the destination is ${g('destination').toUpperCase()}`);
    }
    if (!(parseInt(g('totalPieces'), 10) >= 1)) errs.push('Total pieces missing');
    if (!(parseFloat(g('grossWeight')) > 0)) errs.push('Gross weight missing');
    return errs;
}

module.exports = { mainFields, writeChildren, rateLineRow, dimRow, rateClassOf, validateAwb, awbNoError, ediReadyErrors };
