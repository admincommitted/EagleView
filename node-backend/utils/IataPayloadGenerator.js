const Airwaybill  = require('../models/Airwaybill');
const HouseAWB    = require('../models/HouseAWB');
const AwbRateLine = require('../models/AwbRateLine');
const AwbOtherCharge = require('../models/AwbOtherCharge');
const SpecialHandlingCode = require('../models/SpecialHandlingCode');
const AwbOci      = require('../models/AwbOci');

// Cargo-IMP rate description line (29-Oct-2026): /<line>/P<pieces>/<K|L><gross>/C<rate class>/W<chargeable>/R<rate>/T<total>
// (the line number and the K / C / W / R / T markers were missing: "/10/P120.0/Q/163.0/..."). An empty chargeable weight
// is the higher of gross and volumetric weight rounded up to the next 0.5 kg / whole lb (it went as 0.0).
function rtdLine(rt, li) {
    const lb = /^L/i.test(String(rt.gwUnit || ''));
    const p = parseInt(rt.pieces, 10) || 1;
    const gw = parseFloat(rt.grossWeight) || 0;
    let cw = parseFloat(rt.chargeableWeight) || 0;
    if (!cw) { let v = parseFloat(rt.volumetricWeight) || ((parseFloat(rt.volume) || 0) * 1e6 / 6000); if (lb) v /= 0.45359237; const c = Math.max(gw, v); cw = lb ? Math.ceil(c - 1e-9) : Math.ceil(c * 2 - 1e-9) / 2; }
    const rc = parseFloat(rt.rateCharge) || 0, tot = parseFloat(rt.total) || 0;
    let out = `/${li + 1}/P${p}/${lb ? 'L' : 'K'}${gw.toFixed(1)}/C${String(rt.rateClass || 'Q').charAt(0).toUpperCase()}/W${cw.toFixed(1)}/R${rc.toFixed(2)}/T${tot.toFixed(2)}\r\n`;
    return out;
}

class IataPayloadGenerator {

    // ─── Helpers ────────────────────────────────────────────────────────────
    static splitAddress(address) {
        if (!address) return { line1: '', line2: '' };
        const clean = address.trim();
        if (clean.length <= 35) return { line1: clean.toUpperCase(), line2: '' };
        let bp = clean.lastIndexOf(' ', 35);
        if (bp <= 0) bp = 35;
        return {
            line1: clean.substring(0, bp).trim().toUpperCase(),
            line2: clean.substring(bp).substring(0, 35).trim().toUpperCase()
        };
    }

    static pad(val, len) {
        return String(val || '').toUpperCase().padEnd(len).substring(0, len);
    }

    static fmtDate(d) {
        if (!d) return '';
        // Return DDMMMYY  e.g. 01SEP26
        try {
            const dt = new Date(d);
            const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
            const day  = String(dt.getDate()).padStart(2,'0');
            const mon  = months[dt.getMonth()];
            const yr   = String(dt.getFullYear()).slice(-2);
            return `${day}${mon}${yr}`;
        } catch { return ''; }
    }

    // ─── FWB (Freight Waybill — IATA Cargo-IMP) ─────────────────────────────
    static async generateFwb(awbId) {
        const awb = await Airwaybill.findByPk(awbId, {
            include: [{ all: true }]
        });
        if (!awb) throw new Error('AWB not found');

        const CRLF = '\r\n';
        const awbNo = (awb.awbNumber || '').replace('-', '');  // e.g. 17612345678

        let msg = '';

        // ── Segment 1 : FWB header ──
        msg += `FWB/17${CRLF}`;

        // ── Segment 2 : AWB number / routing / weight ──
        const pcs  = awb.totalPieces  || 1;
        const wt   = (parseFloat(awb.grossWeight) || 0).toFixed(1);
        // Cargo-IMP consignment detail: /T<pieces><K|L><weight> (the T and the lb unit were missing). 29-Oct-2026
        const wu   = /^L/i.test(String(((awb.AwbRateLines || [])[0] || {}).gwUnit || '')) ? 'L' : 'K';
        msg += `${awbNo}${awb.origin || 'UNK'}${awb.destination || 'UNK'}/T${pcs}${wu}${wt}${CRLF}`;

        // ── Segment 3 : Routing ──
        if (awb.by1 || awb.to1) {
            let routing = 'RTG/';
            if (awb.by1) routing += `${awb.by1}/${awb.to1 || ''}`;
            if (awb.by2) routing += `/${awb.by2}/${awb.to2 || ''}`;
            if (awb.by3) routing += `/${awb.by3}/${awb.to3 || ''}`;
            msg += routing + CRLF;
        }

        // ── Segment 4 : Flight details ──
        if (awb.flightNumber1) {
            msg += `FLT/${awb.flightNumber1}/${this.fmtDate(awb.flightDate1)}${CRLF}`;
        }

        // ── Segment 5 : Shipper ──
        const shpAddr = this.splitAddress(awb.shipperAddress);
        msg += `SHP${CRLF}`;
        msg += `/${(awb.shipperName || 'UNKNOWN').toUpperCase().substring(0, 35)}${CRLF}`;
        msg += `/${shpAddr.line1 || 'UNKNOWN'}${CRLF}`;
        if (shpAddr.line2) msg += `/${shpAddr.line2}${CRLF}`;
        msg += `/${(awb.shipperCity || '').toUpperCase()}`;
        if (awb.shipperState)   msg += `/${awb.shipperState.toUpperCase()}`;
        if (awb.shipperCountry) msg += `/${awb.shipperCountry.toUpperCase()}`;
        msg += CRLF;
        if (awb.shipperPhone) msg += `/TEL ${awb.shipperPhone}${CRLF}`;

        // ── Segment 6 : Consignee ──
        const cneAddr = this.splitAddress(awb.consigneeAddress);
        msg += `CNE${CRLF}`;
        msg += `/${(awb.consigneeName || 'UNKNOWN').toUpperCase().substring(0, 35)}${CRLF}`;
        msg += `/${cneAddr.line1 || 'UNKNOWN'}${CRLF}`;
        if (cneAddr.line2) msg += `/${cneAddr.line2}${CRLF}`;
        msg += `/${(awb.consigneeCity || '').toUpperCase()}`;
        if (awb.consigneeCountry) msg += `/${awb.consigneeCountry.toUpperCase()}`;
        msg += CRLF;
        if (awb.consigneePhone) msg += `/TEL ${awb.consigneePhone}${CRLF}`;

        // ── Segment 7 : Agent ──
        if (awb.agentName) {
            msg += `AGT${CRLF}`;
            msg += `/${(awb.agentName || '').toUpperCase().substring(0, 35)}${CRLF}`;
            if (awb.agentCode)      msg += `/CASS ${awb.agentCode}${CRLF}`;
            if (awb.agentAccountNo) msg += `/ACCT ${awb.agentAccountNo}${CRLF}`;
            if (awb.agentPlace)     msg += `/${awb.agentPlace.toUpperCase()}${CRLF}`;
        }

        // ── Segment 8 : Special Handling Codes ──
        const sphList = (awb.SpecialHandlingCodes || []).map(s => s.code).filter(c => c && c.trim());
        if (sphList.length > 0) {
            msg += `SSP/${sphList.join('/')}${CRLF}`;
        }

        // ── Segment 9 : Charge Summary ──
        const currency   = awb.currencyCode || 'USD';
        const chargeCode = awb.chargeCode   || 'PP';
        msg += `CHG/${currency}/${chargeCode}`;
        if (awb.wtVal) msg += `/${awb.wtVal}`;
        if (awb.other) msg += `/${awb.other}`;
        msg += CRLF;

        // ── Segment 10 : Declared Values ──
        msg += `DAV/${awb.declaredValueCarriage || 'NVD'}/${awb.declaredValueCustoms || 'NCV'}/${awb.amountOfInsurance || 'XXX'}${CRLF}`;

        // ── Segment 11 : Rate Description ──
        const rateLines = awb.AwbRateLines || [];
        if (rateLines.length > 0) {
            msg += `RTD${CRLF}`;
            rateLines.forEach((rt, li) => {
                msg += rtdLine(rt, li);
                if (rt.natureOfGoods) msg += `//${rt.natureOfGoods.toUpperCase().substring(0, 35)}${CRLF}`;
            });
        }

        // ── Segment 12 : Other Charges ──
        const charges = awb.AwbOtherCharges || [];
        if (charges.length > 0) {
            msg += `OCI${CRLF}`;
            charges.forEach(c => {
                const ent   = (c.ppcc || c.entitlement || 'PP').toUpperCase();
                const amt   = parseFloat(c.amount) || 0;
                msg += `/${c.chargeCode}/${ent}/${amt.toFixed(2)}${CRLF}`;
            });
        }

        // ── Segment 13 : OCI (Customs Info) ──
        const ocis = (awb.AwbOcis || []).filter(o => String(o.suppInfo || '').trim()); // empty rows were sent too (29-Oct-2026)
        if (ocis.length > 0) {
            ocis.forEach(o => {
                msg += `OCI/${(o.countryCode || '').toUpperCase()}/${(o.infoId || '').toUpperCase()}/${(o.customsId || '')}/${(o.suppInfo || '').toUpperCase()}${CRLF}`;
            });
        }

        // ── Segment 14 : SSR / OSI / SCI ──
        if (awb.ssr) msg += `SSR/${awb.ssr.substring(0, 70).toUpperCase()}${CRLF}`;
        if (awb.osi) msg += `OSI/${awb.osi.substring(0, 70).toUpperCase()}${CRLF}`;
        if (awb.sci) msg += `SCI/${awb.sci.substring(0, 3).toUpperCase()}${CRLF}`;

        // ── Segment 15 : Totals ──
        if (awb.totalChargePP || awb.totalChargeCC) {
            msg += `TOT${CRLF}`;
            msg += `/${(parseFloat(awb.weightChargePP) || 0).toFixed(2)}/${(parseFloat(awb.weightChargeCC) || 0).toFixed(2)}`;
            msg += `/${(parseFloat(awb.valChargePP) || 0).toFixed(2)}/${(parseFloat(awb.valChargeCC) || 0).toFixed(2)}`;
            msg += `/${(parseFloat(awb.totalChargePP) || 0).toFixed(2)}/${(parseFloat(awb.totalChargeCC) || 0).toFixed(2)}${CRLF}`;
        }

        // ── Segment 16 : Execution ──
        if (awb.executedPlace || awb.executedDate) {
            msg += `EXE/${this.fmtDate(awb.executedDate)}/${(awb.executedPlace || '').toUpperCase()}${CRLF}`;
        }

        return msg;
    }

    // ─── FHL (House Manifest — IATA Cargo-IMP) ──────────────────────────────
    static async generateFhl(masterAwbId) {
        const mawb = await Airwaybill.findByPk(masterAwbId);
        if (!mawb) throw new Error('Master AWB not found');

        // Find all linked HAWBs
        const hawbs = await HouseAWB.findAll({
            where: { masterAwbNumber: mawb.awbNumber },
            include: [{ all: true }]
        });

        const CRLF = '\r\n';
        const mawbNo = (mawb.awbNumber || '').replace('-', '');

        let msg = '';
        msg += `FHL/4${CRLF}`;
        msg += `MBI/${mawbNo}${mawb.origin || 'UNK'}${mawb.destination || 'UNK'}/T${mawb.totalPieces || 1}K${(parseFloat(mawb.grossWeight) || 0).toFixed(1)}${CRLF}`; // T = total consignment (was missing). 29-Oct-2026

        for (const h of hawbs) {
            const hawbNo = (h.awbNumber || '').replace('-', '');
            const pcs    = h.totalPieces || (h.AwbRateLines || []).reduce((s, r) => s + (parseInt(r.pieces) || 0), 0) || 1;
            const gw     = parseFloat(h.grossWeight) || 0;

            msg += `HAW${CRLF}`;
            msg += `/${hawbNo}/${pcs}K${gw.toFixed(1)}${CRLF}`;

            // Shipper
            msg += `SHP${CRLF}`;
            msg += `/${(h.shipperName || 'UNKNOWN').toUpperCase().substring(0, 35)}${CRLF}`;
            msg += `/${(h.shipperAddress || '').toUpperCase().substring(0, 35)}${CRLF}`;
            msg += `/${(h.shipperCity || '').toUpperCase()}${CRLF}`;

            // Consignee
            msg += `CNE${CRLF}`;
            msg += `/${(h.consigneeName || 'UNKNOWN').toUpperCase().substring(0, 35)}${CRLF}`;
            msg += `/${(h.consigneeAddress || '').toUpperCase().substring(0, 35)}${CRLF}`;
            msg += `/${(h.consigneeCity || '').toUpperCase()}${CRLF}`;

            // Rate lines
            if (h.AwbRateLines && h.AwbRateLines.length > 0) {
                msg += `RTD${CRLF}`;
                h.AwbRateLines.forEach((rt, li) => { msg += rtdLine(rt, li); });
            }

            // SPH
            const sph = (h.SpecialHandlingCodes || []).map(s => s.code).filter(Boolean);
            if (sph.length > 0) msg += `SSP/${sph.join('/')}${CRLF}`;

            if (h.ssr) msg += `SSR/${h.ssr.substring(0, 70).toUpperCase()}${CRLF}`;
        }

        if (hawbs.length === 0) {
            msg += `TXT/NO HOUSE WAYBILLS LINKED TO THIS MASTER${CRLF}`;
        }

        return msg;
    }
}

module.exports = IataPayloadGenerator;
