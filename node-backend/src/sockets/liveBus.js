// Who receives which live (socket.io) message. A socket joins rooms when it connects (socket.server.js):
//   staff         - EagleView login                          -> online users, notifications for everybody
//   field-staff   - login with Field Tracking rights (admin,   -> GPS, agent status, tasks, alerts
//                   or no rights set yet, or Field Tracking view)
//   user:<id>     - that user's own notifications
//   agent:<id>    - a phone registered with its device token -> only its own siren / task messages
//   field-legacy  - a phone with the old field app (no token), only while "Old field app allowed" is on
//                   -> siren / task messages (they carry the agent id; the old app filters them itself)
import { loadPerms } from '../middlewares/permissions.middleware.js';
import { effective } from '../utils/common/moduleCatalog.js';
import { legacyNow } from './fieldAuth.js';

const STAFF_ROOM = 'staff';
const FIELD_STAFF_ROOM = 'field-staff';
const FIELD_LEGACY_ROOM = 'field-legacy';
const FIELD_TRACKING_MODULE = 'Field Tracking';

const isSocketServer = (value) =>
  value && typeof value.to === 'function' && typeof value.emit === 'function' && !value.get;

// accepts the socket.io server itself or the Express app that holds it (app.get('io'))
const ioOf = (appOrIo) => {
  if (isSocketServer(appOrIo)) return appOrIo;
  return appOrIo && appOrIo.get ? appOrIo.get('io') : null;
};

export function toField(appOrIo, eventName, data) {
  const io = ioOf(appOrIo);
  if (io) io.to(FIELD_STAFF_ROOM).emit(eventName, data);
}

/** A message for one field agent: the office (field-staff), his phone, and old-app phones while those are allowed. */
export function toAgent(appOrIo, agentId, eventName, data) {
  const io = ioOf(appOrIo);
  if (!io) return;
  let legacyAllowed = true;
  try {
    legacyAllowed = legacyNow();
  } catch {
    // default on
  }
  let rooms = io.to(FIELD_STAFF_ROOM).to(`agent:${agentId}`);
  if (legacyAllowed) rooms = rooms.to(FIELD_LEGACY_ROOM);
  rooms.emit(eventName, data);
}

async function maySeeFieldTracking(user) {
  if (String(user.role || '').toLowerCase() === 'admin') return true;
  const perms = await loadPerms(user.id);
  const fieldTracking = perms ? effective(perms, FIELD_TRACKING_MODULE) : null;
  return !perms || !!(fieldTracking && fieldTracking.canView);
}

/** Rooms for a logged-in user: field-staff too when he may see Field Tracking. */
export async function staffRooms(user) {
  const rooms = [STAFF_ROOM, `user:${user.id}`];
  try {
    if (await maySeeFieldTracking(user)) rooms.push(FIELD_STAFF_ROOM);
  } catch {
    // no field rooms
  }
  return rooms;
}
