const express = require('express');
const router = express.Router();
const Country = require('../models/Country');
const State = require('../models/State');
const City = require('../models/City');
// 28-Oct-2026: new state / city from the screen came with id '' -> SQLite "datatype mismatch", so Add always failed
const clean = (M, b) => { const o = { ...(b || {}) }; if (o.id === '' || o.id == null) delete o.id; delete o.createdAt; delete o.updatedAt; delete o.cities; delete o.states;
    for (const [k, a] of Object.entries(M.rawAttributes)) if (o[k] === '' && a.type && ['INTEGER', 'FLOAT', 'DECIMAL', 'DOUBLE', 'DATE', 'DATEONLY'].includes(a.type.key)) o[k] = null; return o; };
const fail = (res, err) => res.status(err.name === 'SequelizeUniqueConstraintError' ? 409 : 400).json({ error: err.errors ? err.errors.map(e => e.message).join(', ') : err.message });

// 04-Nov-2026: foreign port codes (UN/LOCODE, e.g. AEJEA, CNSHA) read from iCAFFE - 45,000+ rows, so served as a compact
// list [[code, name, countryCode], ...] and cached by the browser for a day. Filled by load_icaffe_masters2.js.
let FOREIGN_PORTS = null;
router.get('/foreign-ports', async (req, res) => {
    try {
        if (!FOREIGN_PORTS) {
            const { sequelize } = require('../db');
            const { QueryTypes } = require('sequelize');
            const rows = await sequelize.query('SELECT code, name, countryCode FROM ForeignPorts WHERE isActive = 1 ORDER BY code', { type: QueryTypes.SELECT });
            FOREIGN_PORTS = JSON.stringify(rows.map(r => [r.code, r.name, r.countryCode]));
        }
        res.set('Cache-Control', 'private, max-age=86400').type('application/json').send(FOREIGN_PORTS);
    } catch (err) {
        // table not loaded yet: an empty list, the screens keep working with the ports master
        res.json([]);
    }
});

// GET all locations (Nested)
// GET total stats
// GET total stats
router.get('/lite', async (req, res) => {
    try {
        const countries = await Country.findAll({
            include: [{
                model: State,
                as: 'states',
                attributes: ['id', 'stateName', 'stateCode', 'taxCode']
            }],
            attributes: ['id', 'code', 'name'],
            order: [['name', 'ASC']]
        });
        res.json(countries);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const countryCount = await Country.count();
        const stateCount = await State.count();
        const cityCount = await City.count();
        const { Op } = require('sequelize');
        const airportCount = await City.count({
            where: {
                iataCode: {
                    [Op.and]: [
                        { [Op.not]: null },
                        { [Op.ne]: '-' }
                    ]
                }
            }
        });
        res.json({ countries: countryCount, states: stateCount, cities: cityCount, airports: airportCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const countries = await Country.findAll({
            include: [{
                model: State,
                as: 'states',
                include: [{
                    model: City,
                    as: 'cities',
                    // cities without an IATA code (NULL) were dropped by "!= '-'" and never showed. 28-Oct-2026
                    where: { [require('sequelize').Op.or]: [{ iataCode: null }, { iataCode: { [require('sequelize').Op.ne]: '-' } }] },
                    required: false
                }]
            }],
            order: [['name', 'ASC']]
        });
        res.json(countries);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all states (flat)
router.get('/states', async (req, res) => {
    try {
        const states = await State.findAll();
        res.json(states);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// GET all airports (flat)
router.get('/airports', async (req, res) => {
    try {
        const { Op, QueryTypes } = require('sequelize');
        const { sequelize } = require('../db');
        const airports = await sequelize.query(`
            SELECT c.id, c."cityName", c."airportName", c."iataCode", c."countryId",
                   co.code as "countryCode"
            FROM "Cities" c
            LEFT JOIN "Countries" co ON c."countryId" = co.id
            WHERE c."iataCode" IS NOT NULL AND c."iataCode" != '-'
        `, { type: QueryTypes.SELECT });
        res.json(airports);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all cities (flat)

router.get('/cities', async (req, res) => {
    try {
        // 12-Nov-2026: ?q= searches (name starting with the text first, then containing it; at most ?limit=, default 50).
        // The export SB Header loaded all 1,50,187 cities (about 48 MB, twice) each time it opened, which held up the
        // port / state / UQC lists for seconds. Without q the whole list is still returned (masters screens).
        if (req.query.q !== undefined) {
            const { Op } = require('sequelize');
            const q = String(req.query.q || '').trim();
            const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
            if (q.length < 2) return res.json([]);
            const attrs = ['id', 'cityName', 'stateId', 'countryId', 'iataCode', 'unlocCode'];
            const starts = await City.findAll({ where: { cityName: { [Op.like]: q + '%' } }, attributes: attrs, order: [['cityName', 'ASC']], limit });
            let out = starts;
            if (starts.length < limit) {
                const more = await City.findAll({ where: { cityName: { [Op.like]: '%' + q + '%', [Op.notLike]: q + '%' } }, attributes: attrs, order: [['cityName', 'ASC']], limit: limit - starts.length });
                out = starts.concat(more);
            }
            return res.json(out);
        }
        const cities = await City.findAll();
        res.json(cities);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST a new state
router.post('/states', async (req, res) => {
    try {
        const b = clean(State, req.body);
        if (b.taxCode && !/^\d{2}$/.test(String(b.taxCode))) return res.status(400).json({ error: 'GST state code (tax code) must be 2 digits, e.g. 07' });
        const newState = await State.create(b);
        res.status(201).json(newState);
    } catch (err) {
        fail(res, err);
    }
});

// PUT (Modify) a state
router.put('/states/:id', async (req, res) => {
    try {
        const b = clean(State, req.body); delete b.id;
        if (b.taxCode && !/^\d{2}$/.test(String(b.taxCode))) return res.status(400).json({ error: 'GST state code (tax code) must be 2 digits, e.g. 07' });
        await State.update(b, { where: { id: req.params.id } });
        const updated = await State.findByPk(req.params.id);
        if (!updated) return res.status(404).json({ error: 'State not found' });
        res.json(updated);
    } catch (err) {
        fail(res, err);
    }
});

// DELETE a state
router.delete('/states/:id', async (req, res) => {
    try {
        const { sequelize } = require('../db');
        let n = 0;
        await sequelize.transaction(async (t) => {
            n = await City.destroy({ where: { stateId: req.params.id }, transaction: t }); // its cities go with it
            await State.destroy({ where: { id: req.params.id }, transaction: t });
        });
        res.json({ success: true, citiesDeleted: n });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST a new city
router.post('/cities', async (req, res) => {
    try {
        const b = clean(City, req.body);
        if (b.iataCode) b.iataCode = String(b.iataCode).trim().toUpperCase();
        if (b.iataCode && b.iataCode !== '-' && !/^[A-Z]{3}$/.test(b.iataCode)) return res.status(400).json({ error: 'IATA code must be 3 letters' });
        const newCity = await City.create(b);
        res.status(201).json(newCity);
    } catch (err) {
        fail(res, err);
    }
});

// PUT (Modify) a city
router.put('/cities/:id', async (req, res) => {
    try {
        const b = clean(City, req.body); delete b.id;
        if (b.iataCode) b.iataCode = String(b.iataCode).trim().toUpperCase();
        if (b.iataCode && b.iataCode !== '-' && !/^[A-Z]{3}$/.test(b.iataCode)) return res.status(400).json({ error: 'IATA code must be 3 letters' });
        await City.update(b, { where: { id: req.params.id } });
        const updated = await City.findByPk(req.params.id);
        if (!updated) return res.status(404).json({ error: 'City not found' });
        res.json(updated);
    } catch (err) {
        fail(res, err);
    }
});

// DELETE a city
router.delete('/cities/:id', async (req, res) => {
    try {
        await City.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
