// Who receives which live (socket.io) message (14-Nov-2026).
// Before, every message went to every connected socket, and a socket needed no login: anyone could connect and get
// the names / e-mails / roles of the logged-in users and the live GPS of the field staff. Now a socket joins rooms when
// it connects (server.js io.use):
//   staff         - EagleView login                          -> online users, notifications for everybody
//   field-staff   - login with Field Tracking rights (admin,   -> GPS, agent status, tasks, alerts
//                   or no rights set yet, or Field Tracking view)
//   user:<id>     - that user's own notifications
//   agent:<id>    - a phone registered with its device token -> only its own siren / task messages
//   field-legacy  - a phone with the old field app (no token), only while "Old field app allowed" is on
//                   -> siren / task messages (they carry the agent id; the old app filters them itself)
const ioOf = (x) => (x && typeof x.to === 'function' && typeof x.emit === 'function' && !x.get) ? x : (x && x.get ? x.get('io') : null);

function toStaff(appOrIo, ev, data) { const io = ioOf(appOrIo); if (io) io.to('staff').emit(ev, data); }
function toField(appOrIo, ev, data) { const io = ioOf(appOrIo); if (io) io.to('field-staff').emit(ev, data); }
// a message for one field agent: the office (field-staff), his phone, and old-app phones while those are allowed
function toAgent(appOrIo, agentId, ev, data) {
  const io = ioOf(appOrIo); if (!io) return;
  let legacy = true;
  try { legacy = require('./fieldAuth').legacyNow(); } catch (e) { /* default on */ }
  let b = io.to('field-staff').to('agent:' + agentId);
  if (legacy) b = b.to('field-legacy');
  b.emit(ev, data);
}

// rooms for a logged-in user: field-staff when he may see Field Tracking
async function staffRooms(user) {
  const rooms = ['staff', 'user:' + user.id];
  try {
    if (String(user.role || '').toLowerCase() === 'admin') rooms.push('field-staff');
    else {
      const perms = await require('../middleware/permissions').loadPerms(user.id);
      const p = perms ? require('./moduleCatalog').effective(perms, 'Field Tracking') : null;
      if (!perms || (p && p.canView)) rooms.push('field-staff');
    }
  } catch (e) { /* no field rooms */ }
  return rooms;
}

module.exports = { toStaff, toField, toAgent, staffRooms };
