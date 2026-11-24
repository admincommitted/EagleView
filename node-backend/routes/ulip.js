const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');
const AppSetting = require('../models/AppSetting');

const { httpsAgent: agent } = require('../utils/tls'); // certificate check on by default (28-Oct-2026)

let cachedUlipToken = null;
let tokenExpiry = 0;
const store = require('../utils/settingsStore');
const DEFAULT_BASE = 'https://www.ulip.dpiit.gov.in/ulip/v1.0.0';
async function baseUrl() { return String((await store.get('ULIP_BASE_URL')) || DEFAULT_BASE).replace(/\/+$/, ''); }

async function getUlipToken() {
    if (cachedUlipToken && Date.now() < tokenExpiry) {
        return cachedUlipToken;
    }
    try {
        const loginUrl = (await baseUrl()) + "/user/login";
        // Settings > ULIP (table UlipConfig). The user / password written in this file as a fallback were removed. 28-Oct-2026
        const u = await require('../utils/settingsStore').getMany(['ULIP_USERNAME', 'ULIP_PASSWORD']);
        if (!u.ULIP_USERNAME || !u.ULIP_PASSWORD) throw new Error('ULIP user / password not set in Settings > ULIP Integration');
        const payload = { username: u.ULIP_USERNAME, password: u.ULIP_PASSWORD };
        const resp = await axios.post(loginUrl, payload, { httpsAgent: agent });
        if (resp.data && resp.data.response && resp.data.response.id) {
            cachedUlipToken = resp.data.response.id;
            tokenExpiry = Date.now() + (55 * 60 * 1000); 
            return cachedUlipToken;
        } else {
            throw new Error("Invalid response from ULIP Login");
        }
    } catch (error) {
        console.error("ULIP Login Error:", error.response?.data || error.message);
        const why = (error.response && error.response.data && (error.response.data.message || error.response.data.error)) || error.message;
        throw new Error(/not set in Settings/.test(error.message) ? error.message : "Failed to authenticate with ULIP: " + why);
    }
}

router.post('/dgft/iec', async (req, res) => {
    try {
        const { iec } = req.body;
        if (!iec) return res.status(400).json({ success: false, error: "IEC Number is required" });

        const token = await getUlipToken();
        const dgftUrl = (await baseUrl()) + "/DGFT/01";
        
        const resp = await axios.post(dgftUrl, { iecnumber: iec.toUpperCase() }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            httpsAgent: agent
        });

        if (resp.data && resp.data.response && resp.data.response.length > 0) {
            const dgftData = resp.data.response[0].response;
            res.json({ success: true, data: dgftData });
        } else {
            res.json({ success: false, error: "No data found for this IEC" });
        }
    } catch (error) {
        console.error("ULIP DGFT Error:", error.response?.data || error.message);
        res.status(500).json({ success: false, error: "Error fetching data from ULIP API" });
    }
});


// POST /api/ulip/test-login
router.post('/test-login', async (req, res) => {
    try {
        let { username, password } = req.body;
        // the saved password is not sent back to the screen: empty / *** = use the saved one (28-Oct-2026)
        if (!password || String(password).startsWith('***')) password = await store.get('ULIP_PASSWORD');
        if (!username || !password) return res.status(400).json({ success: false, error: "Username and Password required" });

        const loginUrl = (await baseUrl()) + "/user/login";
        const payload = { username, password };
        const resp = await axios.post(loginUrl, payload, { httpsAgent: agent });

        if (resp.data && resp.data.response && resp.data.response.id) {
            res.json({ success: true, message: "Login successful!" });
        } else {
            res.json({ success: false, error: "Invalid credentials or response from ULIP" });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.response?.data?.response || error.message || "Failed to authenticate with ULIP" });
    }
});

// ───────────── ULIP API list (Settings > ULIP Integration). 28-Oct-2026 ─────────────
// Each ULIP API is a row of table UlipApi: code, name, category, method, path, request body template with
// {placeholders}. Added / edited / tested on the screen; POST /api/ulip/call/:apiCode runs one from anywhere.
const UlipApi = () => store.models.UlipApi;
const API_FIELDS = ['apiCode', 'apiName', 'category', 'method', 'path', 'requestTemplate', 'description', 'isActive', 'sortOrder'];
const placeholders = (tpl) => [...new Set((String(tpl || '').match(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g) || []).map(s => s.slice(1, -1)))];
function apiBody(b, isNew) {
    const v = {};
    for (const f of API_FIELDS) if (b[f] !== undefined) v[f] = b[f];
    ['apiCode', 'apiName', 'category', 'method', 'path'].forEach(f => { if (v[f] !== undefined) v[f] = String(v[f] == null ? '' : v[f]).trim(); });
    if (v.apiCode !== undefined) v.apiCode = v.apiCode.toUpperCase().replace(/\s+/g, '');
    if (v.category) v.category = v.category.toUpperCase();
    if (v.method !== undefined) v.method = (v.method || 'POST').toUpperCase();
    if (v.isActive !== undefined) v.isActive = !!v.isActive;
    if (v.sortOrder !== undefined) v.sortOrder = parseInt(v.sortOrder, 10) || 0;
    const errors = [];
    if ((isNew || v.apiCode !== undefined) && !/^[A-Z0-9][A-Z0-9_/.-]{1,59}$/.test(v.apiCode || '')) errors.push('API code: letters / numbers / _ - . / (e.g. VAHAN/01)');
    if ((isNew || v.apiName !== undefined) && !v.apiName) errors.push('API name is required');
    if ((isNew || v.path !== undefined) && !(/^\/[^\s]*$/.test(v.path || '') || /^https:\/\/[^\s]+$/.test(v.path || ''))) errors.push('Path must start with / (e.g. /VAHAN/01) or be a full https:// URL');
    if (v.method !== undefined && !['GET', 'POST', 'PUT'].includes(v.method)) errors.push('Method must be GET, POST or PUT');
    if (v.requestTemplate) {
        // placeholders are replaced by text, so test the JSON with a dummy value
        try { JSON.parse(String(v.requestTemplate).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, 'X')); } catch (e) { errors.push('Request body is not valid JSON: ' + e.message); }
    }
    if (errors.length) { const e = new Error(errors.join('; ')); e.status = 400; throw e; }
    return v;
}
const apiOut = (r) => ({ ...r.toJSON(), params: placeholders(r.requestTemplate) });
const apiErr = (res, e) => res.status(e.name === 'SequelizeUniqueConstraintError' ? 409 : (e.status || 500)).json({ success: false, error: e.name === 'SequelizeUniqueConstraintError' ? 'This API code already exists' : e.message });

router.get('/apis', async (req, res) => {
    try {
        await store.ready();
        const rows = await UlipApi().findAll({ order: [['sortOrder', 'ASC'], ['category', 'ASC'], ['apiCode', 'ASC']] });
        res.json({ success: true, baseUrl: await baseUrl(), data: rows.map(apiOut) });
    } catch (e) { apiErr(res, e); }
});
router.post('/apis', async (req, res) => {
    try { await store.ready(); const row = await UlipApi().create(apiBody(req.body || {}, true)); res.json({ success: true, data: apiOut(row) }); }
    catch (e) { apiErr(res, e); }
});
router.put('/apis/:id', async (req, res) => {
    try {
        await store.ready();
        const row = await UlipApi().findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'API not found' });
        await row.update(apiBody(req.body || {}, false));
        res.json({ success: true, data: apiOut(row) });
    } catch (e) { apiErr(res, e); }
});
router.delete('/apis/:id', async (req, res) => {
    try {
        await store.ready();
        const row = await UlipApi().findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'API not found' });
        await row.destroy();
        res.json({ success: true });
    } catch (e) { apiErr(res, e); }
});

// run one API: {placeholders} in the body filled from params (JSON-escaped)
async function runApi(row, params = {}) {
    const need = placeholders(row.requestTemplate);
    const missing = need.filter(k => params[k] == null || String(params[k]).trim() === '');
    if (missing.length) { const e = new Error('Enter: ' + missing.join(', ')); e.status = 400; throw e; }
    const bodyText = String(row.requestTemplate || '').replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, k) => JSON.stringify(String(params[k]).trim()).slice(1, -1));
    const body = bodyText.trim() ? JSON.parse(bodyText) : undefined;
    const url = /^https:\/\//.test(row.path) ? row.path : (await baseUrl()) + row.path;
    const token = await getUlipToken();
    const t0 = Date.now();
    const resp = await axios({ method: row.method || 'POST', url, data: row.method === 'GET' ? undefined : body, params: row.method === 'GET' ? body : undefined,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' }, httpsAgent: agent, timeout: 60000, validateStatus: () => true });
    return { status: resp.status, ms: Date.now() - t0, data: resp.data };
}
router.post('/apis/:id/test', async (req, res) => {
    let row;
    try {
        await store.ready();
        row = await UlipApi().findByPk(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'API not found' });
        const out = await runApi(row, (req.body && req.body.params) || {});
        const ok = out.status >= 200 && out.status < 300 && !(out.data && /fail|error/i.test(String(out.data.code || out.data.message || '')) && !out.data.response);
        await row.update({ lastTestAt: new Date(), lastTestOk: ok, lastTestMessage: `HTTP ${out.status} in ${out.ms} ms` });
        res.json({ success: ok, httpStatus: out.status, ms: out.ms, data: out.data });
    } catch (e) {
        if (row && e.status !== 400) await row.update({ lastTestAt: new Date(), lastTestOk: false, lastTestMessage: String(e.message).slice(0, 480) }).catch(() => {});
        res.status(e.status || 502).json({ success: false, error: e.message });
    }
});
// POST /api/ulip/call/:apiCode { params } - for other screens (code may contain "/", so it is sent as VAHAN~01 or URL-encoded)
router.post('/call/*apiCode', async (req, res) => {
    try {
        await store.ready();
        const raw = Array.isArray(req.params.apiCode) ? req.params.apiCode.join('/') : String(req.params.apiCode || ''); // Express 5 wildcard
        const code = decodeURIComponent(raw).replace(/~/g, '/').toUpperCase();
        const row = await UlipApi().findOne({ where: { apiCode: code } });
        if (!row) return res.status(404).json({ success: false, error: `ULIP API ${code} is not set up (Settings > ULIP Integration)` });
        if (!row.isActive) return res.status(400).json({ success: false, error: `ULIP API ${code} is switched off` });
        const out = await runApi(row, (req.body && req.body.params) || req.body || {});
        res.status(out.status >= 200 && out.status < 300 ? 200 : 502).json({ success: out.status >= 200 && out.status < 300, httpStatus: out.status, data: out.data });
    } catch (e) { res.status(e.status || 502).json({ success: false, error: e.message }); }
});

module.exports = router;
