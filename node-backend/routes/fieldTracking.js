const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const FieldAgent = require('../models/FieldAgent');
const FieldAgentLocation = require('../models/FieldAgentLocation');
// Office-only endpoints need a login (28-Oct-2026). The field app on phones uses the other endpoints without a token.
const requireLogin = require('../middleware/auth');
// 14-Nov-2026: phones register with the office code and send their own device token (utils/fieldAuth.js); live
// messages go only to logged-in office users / the phone concerned (utils/liveBus.js)
const fieldAuth = require('../utils/fieldAuth');
const bus = require('../utils/liveBus');
const adminOnly = (req, res, next) => (String((req.user && req.user.role) || '').toLowerCase() === 'admin' ? next() : res.status(403).json({ success: false, error: 'Only an admin can change phone access.' }));
// =====================================================================
// HELPER: Generate unique agent ID
// =====================================================================
// 09-Nov-2026: next number after the highest one used (count + 1 gave an ID already taken once an agent was removed)
async function generateAgentId() {
    const ids = await FieldAgent.findAll({ attributes: ['id'], raw: true });
    const max = ids.reduce((m, r) => Math.max(m, parseInt(String(r.id).replace(/^\D+/, ''), 10) || 0), 0);
    return `FB-${String(max + 1).padStart(2, '0')}`;
}

// 09-Nov-2026: a phone that has not sent its location for this long is shown Offline (before, an agent whose app was
// closed stayed "In Transit" for weeks), and the time since is written in minutes, hours or days
const OFFLINE_AFTER_MIN = 10;
function sinceText(lastSeen) {
    if (!lastSeen) return 'Never';
    const mins = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} mins ago`;
    if (mins < 48 * 60) return `${Math.floor(mins / 60)} hours ago`;
    return `${Math.floor(mins / 1440)} days ago`;
}
const isStale = (a) => !a.lastSeen || (Date.now() - new Date(a.lastSeen).getTime()) > OFFLINE_AFTER_MIN * 60000;

// =====================================================================
// GET /api/field-tracking/agents
// Returns all active field agents with latest location
// =====================================================================
router.get('/agents', async (req, res) => {
    try {
        const who = await fieldAuth.caller(req);
        if (!who || who.bad) return res.status(401).json({ success: false, needRegister: true, error: 'Register this phone with the office code first.' });
        // a registered phone: only its own name
        if (who.agent) { const a = who.agent; return res.json({ success: true, data: [{ id: a.id, name: a.name, role: a.role, vehicleNumber: a.vehicleNumber || '', status: a.status }] }); }
        const agents = await FieldAgent.findAll({
            where: { isActive: true },
            order: [['lastSeen', 'DESC']]
        });

        // Format lastSeen as human readable
        const formatted = agents.map(agent => {
            const a = agent.toJSON();
            a.lastSeenText = sinceText(a.lastSeen);
            // never sent a location yet: "Not started"; app closed / no signal: Offline
            if (a.currentLat == null && a.status !== 'Offline') a.status = isStale(a) ? 'Offline' : a.status;
            else if (isStale(a) && a.status !== 'Offline') a.status = 'Offline';
            return a;
        });

        // 14-Nov-2026: without an EagleView login (the field app on a phone, or anyone who has the internet link) only
        // what the field app's "choose your name" list needs: no live location, battery, task, and the phone masked
        if (!who.staff) {
            const mask = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length >= 4 ? '******' + d.slice(-4) : ''; };
            return res.json({ success: true, data: formatted.map(a => ({ id: a.id, name: a.name, role: a.role, phone: mask(a.phone), vehicleNumber: a.vehicleNumber || '', status: a.status })) });
        }
        res.json({ success: true, data: formatted });
    } catch (err) {
        console.error('[FieldTracking] GET agents error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 09-Nov-2026: the internet address of the field app while start_field_internet.bat runs (field_gateway.js writes it)
router.get('/public-url', requireLogin, (req, res) => {
    try {
        const u = require('fs').readFileSync(require('path').join(__dirname, '..', 'FIELD_PUBLIC_URL.txt'), 'utf8').trim();
        res.json({ success: true, url: /^https:\/\/[a-z0-9.-]+$/i.test(u) ? u : null });
    } catch (e) { res.json({ success: true, url: null }); }
});

// =====================================================================
// GET /api/field-tracking/agents/:id
// Returns single agent details
// =====================================================================
router.get('/agents/:id', requireLogin, async (req, res) => {
    try {
        const agent = await FieldAgent.findByPk(req.params.id);
        if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });
        res.json({ success: true, data: agent });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =====================================================================
// POST /api/field-tracking/agents
// Add a new field agent (Admin use)
// =====================================================================
router.post('/agents', async (req, res) => {
    try {
        // 14-Nov-2026: office screens (login) or the old field app while it is allowed; the new app uses /device/register
        const who = await fieldAuth.caller(req);
        if (!who || who.bad || who.agent) return res.status(401).json({ success: false, needRegister: true, error: 'Register this phone with the office code (new field app).' });
        const brief = (a) => (who.staff ? a : { id: a.id, name: a.name, role: a.role, vehicleNumber: a.vehicleNumber || '', status: a.status });
        const { name, role, phone, vehicleNumber } = req.body;
        if (!name || !phone) {
            return res.status(400).json({ success: false, error: 'Name and phone are required' });
        }
        // 09-Nov-2026: the same mobile number registering again (from the field app) gets its own agent back, not a copy
        const digits = String(phone).replace(/\D/g, '').slice(-10);
        if (digits.length === 10) {
            const same = (await FieldAgent.findAll({ where: { isActive: true } })).find(a => String(a.phone || '').replace(/\D/g, '').slice(-10) === digits);
            if (same) return res.json({ success: true, data: brief(same.toJSON()), existing: true });
        }

        const id = await generateAgentId();
        const agent = await FieldAgent.create({
            id,
            name,
            role: role || 'Fleet Driver',
            phone,
            vehicleNumber: vehicleNumber || '',
            status: 'Idle',
            currentLat: null,
            currentLng: null,
            currentLocation: 'Location Unknown',
            battery: 100,
            speed: '0 km/h',
            currentTask: 'None',
            taskStatus: 'N/A',
            lastSeen: new Date()
        });

        // Broadcast to all connected dashboards via Socket.io
        bus.toField(req.app, 'agent_added', agent.toJSON());

        res.status(201).json({ success: true, data: brief(agent.toJSON()) });
    } catch (err) {
        console.error('[FieldTracking] POST agents error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// =====================================================================
// POST /api/field-tracking/location
// Field agent mobile app sends GPS ping here (called from mobile/app)
// Body: { agentId, lat, lng, accuracy, speed, heading, battery, locationName }
// =====================================================================
router.post('/location', fieldAuth.guard(req => [req.body && req.body.agentId]), async (req, res) => {
    try {
        const { agentId, lat, lng, accuracy, speed, heading, battery, locationName } = req.body;

        if (!agentId || lat === undefined || lng === undefined) {
            return res.status(400).json({ success: false, error: 'agentId, lat, lng required' });
        }

        // Update agent's current position in DB
        const speedStr = speed !== undefined ? `${Math.round(speed)} km/h` : undefined;
        const updateData = { currentLat: lat, currentLng: lng, lastSeen: new Date(), status: 'In Transit' };
        if (battery !== undefined) updateData.battery = battery;
        if (speedStr !== undefined) updateData.speed = speedStr;
        if (locationName) updateData.currentLocation = locationName;

        // Auto-create agent if not found (for manually registered agents)
        const existing = await FieldAgent.findByPk(agentId);
        if (!existing && !req.field.legacy && !req.field.staff) return res.status(404).json({ success: false, error: 'Agent not found' });
        if (!existing) {
            const agentName = req.body.agentName || agentId;
            const agentRole = req.body.role || 'Fleet Driver';
            const agentPhone = req.body.phone || '';
            await FieldAgent.create({
                id: agentId,
                name: agentName,
                role: agentRole,
                phone: agentPhone,
                status: 'In Transit',
                currentLat: lat,
                currentLng: lng,
                currentLocation: locationName || 'Unknown',
                battery: battery || 100,
                speed: speedStr || '0 km/h',
                lastSeen: new Date()
            });
            console.log('[FieldTracking] Auto-created agent:', agentId, agentName);
        } else {
            await FieldAgent.update(updateData, { where: { id: agentId } });
        }

        // Save to location history
        await FieldAgentLocation.create({
            agentId, lat, lng,
            accuracy:     accuracy || null,
            speed:        speed || 0,
            heading:      heading || null,
            battery:      battery || null,
            locationName: locationName || null,
            recordedAt:   req.body.timestamp ? new Date(req.body.timestamp) : new Date()
        });

        // Broadcast real-time update to the office screens with Field Tracking rights (14-Nov-2026: not to everyone)
        {
            bus.toField(req.app, 'agent_location_update', {
                agentId, lat, lng,
                speed:        speedStr || '0 km/h',
                battery,
                locationName,
                lastSeen:     new Date().toISOString()
            });
        }

        res.json({ success: true, message: 'Location updated' });
    } catch (err) {
        console.error('[FieldTracking] POST location error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// =====================================================================
// POST /api/field-tracking/location/bulk
// Offline queue flush — app ek saath bahut saari pings bhejti hai
// Body: { pings: [{ agentId, lat, lng, timestamp, ... }, ...] }
// =====================================================================
router.post('/location/bulk', fieldAuth.guard(req => (Array.isArray(req.body && req.body.pings) ? req.body.pings.slice(0, 200).map(p => p && p.agentId) : [])), async (req, res) => {
    try {
        const { pings } = req.body;
        if (!Array.isArray(pings) || pings.length === 0) {
            return res.status(400).json({ success: false, error: 'pings array required' });
        }

        const limit  = Math.min(pings.length, 200); // max 200 at a time
        let accepted = 0;
        let lastByAgent = {}; // Track latest per agent for broadcast

        for (let i = 0; i < limit; i++) {
            const { agentId, lat, lng, accuracy, speed, heading, battery, locationName, timestamp } = pings[i];
            if (!agentId || lat === undefined || lng === undefined) continue;

            try {
                await FieldAgentLocation.create({
                    agentId, lat, lng,
                    accuracy:     accuracy || null,
                    speed:        speed || 0,
                    heading:      heading || null,
                    battery:      battery || null,
                    locationName: locationName || null,
                    recordedAt:   timestamp ? new Date(timestamp) : new Date()
                });
                accepted++;
                lastByAgent[agentId] = { agentId, lat, lng, speed, battery, locationName, ts: timestamp };
            } catch(e) { /* skip bad record */ }
        }

        // Update each agent's position to their most recent ping
        for (const [agentId, loc] of Object.entries(lastByAgent)) {
            const speedStr = loc.speed !== undefined ? `${Math.round(loc.speed)} km/h` : undefined;
            const updateData = { currentLat: loc.lat, currentLng: loc.lng, lastSeen: new Date(), status: 'In Transit' };
            if (loc.battery !== undefined) updateData.battery = loc.battery;
            if (speedStr) updateData.speed = speedStr;
            await FieldAgent.update(updateData, { where: { id: agentId } });
            bus.toField(req.app, 'agent_location_update', { agentId, lat: loc.lat, lng: loc.lng, speed: speedStr || '0 km/h', battery: loc.battery, lastSeen: new Date().toISOString() });
        }

        res.json({ success: true, accepted, total: pings.length });
    } catch (err) {
        console.error('[FieldTracking] Bulk location error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// =====================================================================
// GET /api/field-tracking/health
// Simple health check — PWA uses this to detect server availability
// =====================================================================
// 14-Nov-2026: phone access ------------------------------------------------------------------------------
// the new field app: office code + mobile number (+ name for a new person) -> the phone's own device token
router.post('/device/register', fieldAuth.register);

// office (admin): the office code, "old field app allowed", and which phones are registered
router.get('/device/settings', requireLogin, async (req, res) => {
    try {
        const c = await fieldAuth.cfg();
        const agents = (await FieldAgent.findAll({ where: { isActive: true }, order: [['name', 'ASC']] })).map(a => ({ id: a.id, name: a.name, phone: a.phone, phoneSecure: !!a.deviceTokenHash, deviceIssuedAt: a.deviceIssuedAt, lastLegacyAt: a.lastLegacyAt }));
        const isAdmin = String((req.user && req.user.role) || '').toLowerCase() === 'admin';
        res.json({ success: true, data: { codeSet: !!c.code, code: isAdmin ? c.code : undefined, legacy: c.legacy, isAdmin, agents } });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
router.put('/device/settings', requireLogin, adminOnly, async (req, res) => {
    try {
        const b = req.body || {}; const set = {};
        if (b.code !== undefined) {
            const code = String(b.code || '').trim().toUpperCase();
            if (code && !/^[A-Z0-9]{6,20}$/.test(code)) return res.status(400).json({ success: false, error: 'Office code: 6 to 20 letters or digits.' });
            set.field_app_secret_code = code;
        }
        if (b.legacy !== undefined) set.field_app_legacy = b.legacy ? 'on' : 'off';
        if (!Object.keys(set).length) return res.status(400).json({ success: false, error: 'Nothing to change' });
        // an empty code is "clear": settingsStore keeps an empty secret, so write the loose AppSetting row directly
        if (set.field_app_secret_code === '') {
            await require('../models/AppSetting').destroy({ where: { key: 'field_app_secret_code' } });
            delete set.field_app_secret_code;
        }
        if (Object.keys(set).length) await require('../utils/settingsStore').setMany(set);
        fieldAuth.clearCfg();
        res.json({ success: true });
    } catch (e) { res.status(e.status || 500).json({ success: false, error: e.message }); }
});
// a lost / changed phone: its token stops working; the phone has to register again with the office code
router.post('/agents/:id/disconnect', requireLogin, adminOnly, async (req, res) => {
    try {
        const [n] = await FieldAgent.update({ deviceTokenHash: null, deviceIssuedAt: null }, { where: { id: req.params.id } });
        if (!n) return res.status(404).json({ success: false, error: 'Agent not found' });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/health', (req, res) => {
    res.json({ ok: true, ts: Date.now() });
});



// =====================================================================
// GET /api/field-tracking/history/:agentId
// Returns location history for last N hours
// =====================================================================
router.get('/history/:agentId', requireLogin, async (req, res) => {
    try {
        const { agentId } = req.params;
        const hours = parseInt(req.query.hours) || 8;

        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        const locations = await FieldAgentLocation.findAll({
            where: {
                agentId,
                recordedAt: { [Op.gte]: since }
            },
            order: [['recordedAt', 'ASC']]
        });

        res.json({ success: true, data: locations });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =====================================================================
// POST /api/field-tracking/task
// Assign/dispatch task to an agent
// Body: { agentId, task, location, priority }
// =====================================================================
router.post('/task', fieldAuth.guard(req => [req.body && req.body.agentId]), async (req, res) => {
    try {
        const { agentId, task, location, priority, assignedBy } = req.body;

        if (!agentId || !task) {
            return res.status(400).json({ success: false, error: 'agentId and task are required' });
        }

        const isSelfAssigned = assignedBy && assignedBy.includes('Self-Assigned');

        await FieldAgent.update({
            currentTask: task,
            taskStatus: 'Pending',
            // Only auto-set In Transit for Urgent/High or self-assigned
            ...((priority === 'Urgent' || priority === 'High' || isSelfAssigned) && { status: 'In Transit' }),
            ...(location && { currentLocation: location })
        }, { where: { id: agentId } });

        const agentRecord = await FieldAgent.findByPk(agentId);

        // Broadcast task assignment via socket
        {
            bus.toAgent(req.app, agentId, 'agent_task_updated', {
                agentId,
                task,
                priority: priority || 'Normal',
                location,
                assignedBy: assignedBy || 'Admin',
                isSelfAssigned,
                assignedAt: new Date().toISOString()
            });

            // If self-assigned, also emit a separate urgent alert for admin dashboard
            if (isSelfAssigned) {
                bus.toField(req.app, 'self_task_reported', {
                    agentId,
                    agentName: agentRecord?.name || agentId,
                    task,
                    priority: priority || 'Normal',
                    location,
                    reportedAt: new Date().toISOString()
                });
            }
        }

        res.json({ success: true, data: agentRecord, message: `Task assigned to ${agentRecord?.name}` });
    } catch (err) {
        console.error('[FieldTracking] POST task error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});


// =====================================================================
// PATCH /api/field-tracking/agents/:id/status
// Update agent status (Idle/Offline/In Transit)
// =====================================================================
router.patch('/agents/:id/status', fieldAuth.guard(req => [req.params.id]), async (req, res) => {
    try {
        const { status } = req.body;
        if (!['In Transit', 'Idle', 'Offline'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        await FieldAgent.update({ status, lastSeen: new Date() }, { where: { id: req.params.id } });
        
        bus.toField(req.app, 'agent_status_updated', { agentId: req.params.id, status });

        res.json({ success: true, message: 'Status updated' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =====================================================================
// PATCH /api/field-tracking/agents/:id/task-complete
// Field boy ya admin task Done mark kare
// =====================================================================
router.patch('/agents/:id/task-complete', fieldAuth.guard(req => [req.params.id]), async (req, res) => {
    try {
        const agent = await FieldAgent.findByPk(req.params.id);
        if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });

        const completedTask = agent.currentTask;

        await FieldAgent.update({
            taskStatus:   'Done',
            status:       'Idle',
            lastSeen:     new Date()
        }, { where: { id: req.params.id } });

        {
            bus.toField(req.app, 'task_completed', {
                agentId:       req.params.id,
                agentName:     agent.name,
                completedTask,
                completedAt:   new Date().toISOString()
            });
            bus.toField(req.app, 'agent_status_updated', { agentId: req.params.id, status: 'Idle' });
        }

        res.json({ success: true, message: `Task completed by ${agent.name}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// =====================================================================
// DELETE /api/field-tracking/agents/:id
// Soft delete (deactivate) an agent
// =====================================================================
router.delete('/agents/:id', requireLogin, async (req, res) => {
    try {
        await FieldAgent.update({ isActive: false }, { where: { id: req.params.id } });
        bus.toField(req.app, 'agent_removed', { agentId: req.params.id });
        res.json({ success: true, message: 'Agent deactivated' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =====================================================================
// POST /api/field-tracking/siren
// Send emergency siren alert to agent
// =====================================================================
router.post('/siren', requireLogin, async (req, res) => {
    try {
        const { agentId, message } = req.body;
        const agent = await FieldAgent.findByPk(agentId);
        if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });

        // In production: send push notification / SMS to agent's device
        // For now, broadcast via socket so admin sees confirmation
        {
            bus.toAgent(req.app, agentId, 'siren_triggered', {
                agentId,
                agentName: agent.name,
                message: message || 'URGENT: Call Operations immediately!',
                triggeredAt: new Date().toISOString()
            });
        }

        res.json({ 
            success: true, 
            message: `Emergency siren sent to ${agent.name}`,
            note: 'Integrate with FCM/SMS gateway for mobile push in production'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =====================================================================
// GET /api/field-tracking/stats
// Returns summary stats for dashboard KPI pills
// =====================================================================
router.get('/stats', fieldAuth.guard(null), async (req, res) => {
    try {
        // 09-Nov-2026: counted with the same Offline rule as the agent list
        const all = (await FieldAgent.findAll({ where: { isActive: true }, raw: true })).map(a => ({ ...a, status: isStale(a) ? 'Offline' : a.status }));
        const total = all.length;
        const inTransit = all.filter(a => a.status === 'In Transit').length;
        const idle = all.filter(a => a.status === 'Idle').length;
        const offline = all.filter(a => a.status === 'Offline').length;

        res.json({ success: true, data: { total, inTransit, idle, offline } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Haversine distance in km
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLng = (lng2-lng1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// GET /api/field-tracking/report/summary?date=YYYY-MM-DD
router.get('/report/summary', requireLogin, async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const date   = req.query.date || new Date().toISOString().split('T')[0];
    const start  = new Date(date + 'T00:00:00.000Z');
    const end    = new Date(date + 'T23:59:59.999Z');
    const agents = await FieldAgent.findAll({ order: [['name','ASC']] });
    const summary = await Promise.all(agents.map(async (agent) => {
      const locs = await FieldAgentLocation.findAll({
        where: { agentId: agent.id, recordedAt: { [Op.between]: [start, end] } },
        order: [['recordedAt','ASC']]
      });
      let distanceKm = 0;
      for (let i = 1; i < locs.length; i++) {
        const d = haversineKm(locs[i-1].lat, locs[i-1].lng, locs[i].lat, locs[i].lng);
        if (d < 1) distanceKm += d; // ignore jumps > 1km (GPS error)
      }
      const totalPings  = locs.length;
      const firstPing   = locs[0]?.recordedAt || null;
      const lastPing    = locs[locs.length-1]?.recordedAt || null;
      const activeHours = firstPing && lastPing
        ? ((new Date(lastPing) - new Date(firstPing)) / 3600000).toFixed(1)
        : 0;
      const speeds   = locs.map(l => parseFloat(l.speed)||0).filter(s => s > 0 && s < 200);
      const avgSpeed = speeds.length ? Math.round(speeds.reduce((a,b)=>a+b,0)/speeds.length) : 0;
      return {
        agentId:     agent.id,
        agentName:   agent.name,
        role:        agent.role,
        phone:       agent.phone,
        totalPings,
        distanceKm:  parseFloat(distanceKm.toFixed(2)),
        activeHours: parseFloat(activeHours),
        avgSpeed,
        firstPing,
        lastPing
      };
    }));
    res.json({ success: true, data: summary });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/field-tracking/report/:agentId?date=YYYY-MM-DD
router.get('/report/:agentId', requireLogin, async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const date  = req.query.date || new Date().toISOString().split('T')[0];
    const start = new Date(date + 'T00:00:00.000Z');
    const end   = new Date(date + 'T23:59:59.999Z');
    const agent = await FieldAgent.findByPk(req.params.agentId);
    if (!agent) return res.status(404).json({ success:false, error:'Agent not found' });
    const locs  = await FieldAgentLocation.findAll({
      where: { agentId: req.params.agentId, recordedAt: { [Op.between]: [start, end] } },
      order: [['recordedAt','ASC']]
    });
    let distanceKm = 0;
    for (let i=1; i<locs.length; i++) {
      const d = haversineKm(locs[i-1].lat, locs[i-1].lng, locs[i].lat, locs[i].lng);
      if (d < 1) distanceKm += d;
    }
    const speeds   = locs.map(l=>parseFloat(l.speed)||0).filter(s=>s>0&&s<200);
    const avgSpeed = speeds.length ? Math.round(speeds.reduce((a,b)=>a+b,0)/speeds.length) : 0;
    res.json({ success:true, data: {
      agentId: agent.id, agentName: agent.name, role: agent.role, date,
      totalPings: locs.length,
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      activeHours: locs.length > 1 ? ((new Date(locs[locs.length-1].recordedAt) - new Date(locs[0].recordedAt))/3600000).toFixed(1) : 0,
      avgSpeed,
      firstPing: locs[0]?.recordedAt,
      lastPing: locs[locs.length-1]?.recordedAt,
      locations: locs.map(l => ({ lat:l.lat, lng:l.lng, speed:l.speed, recordedAt:l.recordedAt }))
    }});
  } catch(err) {
    res.status(500).json({ success:false, error:err.message });
  }
});

module.exports = router;
