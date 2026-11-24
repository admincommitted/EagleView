const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const TactCountryRule = require('../models/TactCountryRule');
const TactCarrierRule = require('../models/TactCarrierRule');
const TactEquipmentRule = require('../models/TactEquipmentRule');
const IataExchangeRate = require('../models/IataExchangeRate');
const IataDgrMaster = require('../models/IataDgrMaster');
const IataShcConflict = require('../models/IataShcConflict');
const TactRateSector = require('../models/TactRateSector');
const TactRateDetail = require('../models/TactRateDetail');
const TactProportionalRate = require('../models/TactProportionalRate');
const TactSurcharge = require('../models/TactSurcharge');

TactRateSector.hasMany(TactRateDetail, { foreignKey: 'sectorId', as: 'rateDetails' });
TactRateDetail.belongsTo(TactRateSector, { foreignKey: 'sectorId' });

const createGetRoute = (model) => {
    return async (req, res) => {
        try {
            const data = await model.findAll();
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
};

router.get('/country-rules', createGetRoute(TactCountryRule));
router.get('/carrier-rules', createGetRoute(TactCarrierRule));
router.get('/equipment', createGetRoute(TactEquipmentRule));
router.get('/dgr', createGetRoute(IataDgrMaster));
router.get('/surcharges', createGetRoute(TactSurcharge));
router.get('/exchange-rates', createGetRoute(IataExchangeRate));
router.get('/shc-conflicts', createGetRoute(IataShcConflict));
router.get('/proportional-rates', createGetRoute(TactProportionalRate));

router.get('/rates', async (req, res) => {
    try {
        const data = await TactRateSector.findAll({
            include: [{ model: TactRateDetail, as: 'rateDetails' }]
        });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


const parseCsv = (buffer) => {
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        let rowStr = lines[i];
        let rowArr = [];
        let inQuotes = false;
        let currentVal = '';
        
        for (let j = 0; j < rowStr.length; j++) {
            const char = rowStr[j];
            if (char === '"' && inQuotes && rowStr[j + 1] === '"') {
                currentVal += '"'; j++; // "" inside quotes = one quote
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                rowArr.push(currentVal.trim());
                currentVal = '';
            } else {
                currentVal += char;
            }
        }
        rowArr.push(currentVal.trim());
        
        let obj = {};
        headers.forEach((header, index) => {
            obj[header] = rowArr[index] || '';
        });
        data.push(obj);
    }
    return data;
};

// POST /api/tact/upload/:type?mode=replace|append  (CSV with a header row)
// 28-Oct-2026:
// - the screen sends its tab id: 'rates' (surcharges), 'icer', 'shc', 'addons' were refused as "Invalid master type";
//   all tabs with a flat table now map to their table (GCR rates have sector + detail rows, not one CSV row);
// - only columns of that table are saved; id / createdAt / updatedAt from a downloaded file are dropped (a
//   download uploaded again failed on duplicate ids);
// - mode=replace swaps the whole table in one transaction (uploading the same file twice doubled every row);
// - row errors are reported with the line number; 5 MB file limit.
const UPLOAD_TYPES = {
    country: TactCountryRule, carrier: TactCarrierRule, dgr: IataDgrMaster, equipment: TactEquipmentRule,
    surcharges: TactSurcharge, rates: TactSurcharge, icer: IataExchangeRate, 'exchange-rates': IataExchangeRate,
    shc: IataShcConflict, 'shc-conflicts': IataShcConflict, addons: TactProportionalRate, 'proportional-rates': TactProportionalRate,
};
const uploadLimited = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.post('/upload/:type', uploadLimited.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const type = String(req.params.type || '').toLowerCase();
        if (type === 'gcr') return res.status(400).json({ error: 'GCR rates cannot be bulk uploaded from CSV (sector + rate rows)' });
        const Model = UPLOAD_TYPES[type];
        if (!Model) return res.status(400).json({ error: 'Invalid master type' });
        const data = parseCsv(Buffer.from(req.file.buffer.toString('utf-8').replace(/^\uFEFF/, ''), 'utf-8'));
        if (data.length === 0) return res.status(400).json({ error: 'Empty or invalid CSV file' });
        const attrs = Object.keys(Model.rawAttributes).filter(k => !['id', 'createdAt', 'updatedAt'].includes(k));
        const unknown = Object.keys(data[0]).filter(h => h && !attrs.includes(h) && !['id', 'createdAt', 'updatedAt'].includes(h));
        if (!Object.keys(data[0]).some(h => attrs.includes(h))) return res.status(400).json({ error: 'No known column in the header. Expected: ' + attrs.join(', ') });
        const rows = data.map((r) => {
            const o = {};
            for (const k of attrs) {
                if (r[k] === undefined) continue;
                let v = r[k];
                const t = Model.rawAttributes[k].type && Model.rawAttributes[k].type.key;
                if (v === '') v = null;
                else if (t === 'BOOLEAN') v = ['1', 'true', 'yes', 'y'].includes(String(v).toLowerCase());
                o[k] = v;
            }
            return o;
        });
        const replace = String(req.query.mode || '').toLowerCase() === 'replace';
        const { sequelize } = require('../db');
        try {
            await sequelize.transaction(async (t) => {
                if (replace) await Model.destroy({ where: {}, transaction: t });
                for (let i = 0; i < rows.length; i++) {
                    try { await Model.create(rows[i], { transaction: t }); }
                    catch (e) { const err = new Error(`Line ${i + 2}: ${e.errors ? e.errors.map(x => x.message).join(', ') : e.message}`); err.rowError = true; throw err; }
                }
            });
        } catch (e) {
            if (e.rowError) return res.status(400).json({ error: e.message + ' - nothing was imported' });
            throw e;
        }
        res.json({ message: `Successfully imported ${rows.length} records` + (replace ? ' (old rows replaced)' : '') + (unknown.length ? `. Ignored columns: ${unknown.join(', ')}` : '') + '.', count: rows.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ---------------------------------------------------------------------------
// GET /api/tact/quote?origin=BOM&destination=DXB&carrier=EK&weight=250&rateClass=Q
// The AWB screen's "Auto Rate" button did nothing. This picks the rate out of the
// TACT data already loaded in this system: the right sector, the right carrier
// (a carrier-specific sector beats an ALL one), and the highest weight break at
// or below the chargeable weight - which is how an IATA break works.
//
// If there is no sector or no break for that weight it says so. It does not
// invent a rate: a quoted freight rate that came from nowhere is worse than none.
// Added 30-Oct-2026.
// ---------------------------------------------------------------------------
router.get('/quote', async (req, res) => {
    try {
        const U = (v) => String(v || '').trim().toUpperCase();
        const origin = U(req.query.origin), destination = U(req.query.destination);
        const carrier = U(req.query.carrier);
        const weight = parseFloat(req.query.weight);
        const wantClass = U(req.query.rateClass);
        const onDate = String(req.query.date || new Date().toISOString().slice(0, 10)).slice(0, 10);

        if (!origin || !destination) return res.status(400).json({ success: false, error: 'origin and destination are both needed (3-letter airport codes)' });
        if (!(weight > 0)) return res.status(400).json({ success: false, error: 'A chargeable weight is needed - a rate break cannot be chosen without it' });

        const sectors = await TactRateSector.findAll({
            where: { originCode: origin, destinationCode: destination },
            include: [{ model: TactRateDetail, as: 'rateDetails' }],
        });
        if (!sectors.length) {
            return res.status(404).json({ success: false, error: 'No TACT sector loaded for ' + origin + ' to ' + destination +
                '. Load the TACT rates for this sector in Masters > TACT, or type the rate by hand.' });
        }
        const inDate = (s) => (!s.effectiveFrom || String(s.effectiveFrom) <= onDate) && (!s.effectiveTo || String(s.effectiveTo) >= onDate);
        const live = sectors.filter(inDate);
        if (!live.length) {
            return res.status(404).json({ success: false, error: 'The TACT rates loaded for ' + origin + '-' + destination +
                ' are not valid on ' + onDate + ' (they cover ' + sectors.map(s => (s.effectiveFrom || '?') + ' to ' + (s.effectiveTo || '?')).join(', ') + ').' });
        }
        // a sector for this carrier wins over the ALL one
        const mine = carrier ? live.filter(s => U(s.carrierCode) === carrier) : [];
        const chosenSectors = mine.length ? mine : live.filter(s => ['ALL', ''].includes(U(s.carrierCode)));
        if (!chosenSectors.length) {
            return res.status(404).json({ success: false, error: 'No TACT rate for carrier ' + carrier + ' on ' + origin + '-' + destination +
                ' and no "ALL" carrier rate either.' });
        }
        const sector = chosenSectors[0];
        let details = (sector.rateDetails || []).slice();
        if (wantClass) details = details.filter(d => U(d.rateClassCode) === wantClass);
        if (!details.length) {
            return res.status(404).json({ success: false, error: 'The sector ' + origin + '-' + destination + ' has no' +
                (wantClass ? ' "' + wantClass + '" class' : '') + ' rate line loaded.' });
        }
        // the highest break at or below the weight; the minimum (M) line has no break
        const eligible = details.filter(d => (parseFloat(d.weightBreak) || 0) <= weight);
        if (!eligible.length) {
            const lowest = Math.min(...details.map(d => parseFloat(d.weightBreak) || 0));
            return res.status(404).json({ success: false, error: 'The lowest weight break loaded for this sector is ' + lowest +
                ' kg, which is above the chargeable weight of ' + weight + ' kg. Load the lower break, or use the minimum charge.' });
        }
        eligible.sort((a2, b2) => (parseFloat(b2.weightBreak) || 0) - (parseFloat(a2.weightBreak) || 0));
        const d = eligible[0];
        const rate = parseFloat(d.rateAmount) || 0;
        const pct = parseFloat(d.percentageMultiplier);
        const effectiveRate = Number.isFinite(pct) && pct > 0 ? Math.round(rate * (pct / 100) * 100) / 100 : rate;
        res.json({
            success: true,
            origin, destination, carrier: U(sector.carrierCode), currency: sector.currencyCode,
            rateClass: U(d.rateClassCode), weightBreak: parseFloat(d.weightBreak) || 0,
            rate: effectiveRate, baseRate: rate, percentageMultiplier: Number.isFinite(pct) ? pct : null,
            chargeableWeight: weight,
            amount: Math.round(effectiveRate * weight * 100) / 100,
            commodityItemNo: d.commodityItemNo || null,
            effectiveFrom: sector.effectiveFrom, effectiveTo: sector.effectiveTo,
            carrierSpecific: !!mine.length,
            breaksAvailable: details.map(x => ({ rateClass: U(x.rateClassCode), weightBreak: parseFloat(x.weightBreak) || 0, rate: parseFloat(x.rateAmount) || 0 }))
                .sort((a2, b2) => a2.weightBreak - b2.weightBreak),
            note: 'From the TACT rates loaded in this system' + (mine.length ? ' for carrier ' + U(sector.carrierCode) : ' (the "ALL carriers" sector - no ' + (carrier || 'carrier') + '-specific rate is loaded)') +
                  '. Surcharges and any carrier deal are not in this figure.',
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
