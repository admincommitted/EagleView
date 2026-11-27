// A socket needs a login (office screens: the EagleView token in handshake auth) or a registered phone (fieldToken);
// the old field app (no token) only while "Old field app allowed" is on, and then it hears only siren / task messages.
// Rooms decide who hears what (liveBus.js).
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { JWT_SECRET } from '../middlewares/auth.middleware.js';
import { User } from '../models/index.js';
import { originAllowed } from '../utils/security/webSecurity.js';
import { isRevoked } from '../utils/security/tokenRevoke.js';
import { agentForToken, cfg as fieldAppConfig } from './fieldAuth.js';
import { staffRooms } from './liveBus.js';

const STAFF_ROOM = 'staff';
const FIELD_LEGACY_ROOM = 'field-legacy';
const INACTIVE_STATUSES = ['inactive', 'locked'];

const SOCKET_CORS = {
  origin: (origin, callback) => callback(null, originAllowed(origin)),
  methods: ['GET', 'POST'],
};

/** The logged-in user behind a socket token; identity comes from the verified JWT, not from what the browser says. */
async function staffFromToken(token) {
  const payload = jwt.verify(String(token || ''), JWT_SECRET);
  if (isRevoked(payload)) throw new Error('logged out');
  const user = await User.findByPk(payload.id, { attributes: ['username', 'fullName', 'email', 'status'] });
  if (!user || INACTIVE_STATUSES.includes(String(user.status || '').toLowerCase())) {
    throw new Error('account not active');
  }
  return { p: payload, name: user.fullName || user.username || payload.username, email: user.email || payload.email };
}

// io.use: office login, registered phone, or (while allowed) the old field app
async function authenticateSocket(socket, next) {
  try {
    const auth = socket.handshake.auth || {};
    if (auth.token) {
      try {
        socket.data.staff = await staffFromToken(auth.token);
        return next();
      } catch {
        return next(new Error('Login expired - please log in again'));
      }
    }
    if (auth.fieldToken) {
      const agent = await agentForToken(String(auth.fieldToken));
      if (!agent) return next(new Error('Phone not registered - register it again with the office code'));
      socket.data.agentId = agent.id;
      return next();
    }
    if ((await fieldAppConfig()).legacy) {
      socket.data.legacy = true;
      return next();
    }
    return next(new Error('Login required'));
  } catch {
    return next(new Error('Could not check the login'));
  }
}

/**
 * Starts socket.io on the HTTP server and keeps the online users list.
 * Sets app 'io' (the server) and 'userSockets' (userId -> socketId) for the routes.
 */
export function createSocketServer(httpServer, app) {
  const io = new Server(httpServer, { cors: SOCKET_CORS });
  const onlineUsers = {}; // socketId -> user data
  const userSockets = {}; // userId -> socketId

  app.set('io', io);
  app.set('userSockets', userSockets);

  // one entry per user: several tabs of the same user show once, with their count
  const onlineList = () => {
    const byUser = {};
    for (const user of Object.values(onlineUsers)) {
      const key = String(user.userId);
      if (byUser[key]) byUser[key].sessions++;
      else byUser[key] = { ...user, sessions: 1 };
    }
    return Object.values(byUser);
  };

  const broadcastOnlineUsers = () => io.to(STAFF_ROOM).emit('online_users', onlineList());

  async function joinStaff(socket, staff) {
    const { p: payload, name, email } = staff;
    for (const room of await staffRooms(payload)) socket.join(room);
    onlineUsers[socket.id] = {
      userId: payload.id,
      username: payload.username,
      name,
      firstName: name,
      email,
      role: payload.role,
    };
    userSockets[payload.id] = socket.id;
    broadcastOnlineUsers();
  }

  // older screens send their token in this event after connecting: the same check
  async function onUserConnected(socket, userData) {
    try {
      if (onlineUsers[socket.id]) {
        socket.emit('online_users', onlineList());
        return;
      }
      const staff = await staffFromToken(userData && userData.token);
      socket.data.staff = staff;
      socket.leave(FIELD_LEGACY_ROOM);
      await joinStaff(socket, staff);
    } catch {
      // bad / expired token: hears nothing
    }
  }

  function onDisconnect(socket) {
    const userData = onlineUsers[socket.id];
    delete onlineUsers[socket.id];
    if (userData && userSockets[userData.userId] === socket.id) {
      // another tab of the same user still open? keep notifications going to it
      const otherSocketId = Object.keys(onlineUsers).find(
        (socketId) => String(onlineUsers[socketId].userId) === String(userData.userId),
      );
      if (otherSocketId) userSockets[userData.userId] = otherSocketId;
      else delete userSockets[userData.userId];
    }
    if (userData) broadcastOnlineUsers();
  }

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    if (socket.data.staff) joinStaff(socket, socket.data.staff).catch(() => {});
    else if (socket.data.agentId) socket.join(`agent:${socket.data.agentId}`);
    else if (socket.data.legacy) socket.join(FIELD_LEGACY_ROOM);

    socket.on('user_connected', (userData) => onUserConnected(socket, userData));
    socket.on('disconnect', () => onDisconnect(socket));
  });

  return io;
}
