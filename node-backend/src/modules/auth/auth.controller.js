import { publicBase } from '../../utils/security/webSecurity.js';
import * as authService from './auth.service.js';

const clientOf = (req) => ({ ip: req.ip, address: req.ip || (req.socket && req.socket.remoteAddress) });

export async function login(req, res) {
  res.json(await authService.login(req.body, clientOf(req)));
}

export async function verifyLoginCode(req, res) {
  res.json(await authService.verifyLoginCode(req.body || {}));
}

export async function logout(req, res) {
  await authService.logout(req.header('Authorization'));
  res.json({ message: 'Logout successful' });
}

export async function getProfile(req, res) {
  res.json(await authService.getProfile(req.user));
}

export async function updateProfile(req, res) {
  res.json(await authService.updateProfile(req.user.id, req.body));
}

export async function getAppSettings(req, res) {
  res.json(await authService.getAppSettings(req.user.id));
}

export async function updateAppSettings(req, res) {
  res.json(await authService.updateAppSettings(req.user.id, req.validated.body));
}

export async function createFirstAdmin(req, res) {
  res.json(await authService.createFirstAdmin());
}

/** Always the same answer, also on an error, so the answer never tells whether a User ID exists. */
export async function forgotPassword(req, res) {
  try {
    await authService.sendPasswordResetLink(req.body.userId, publicBase(req));
  } catch (error) {
    console.error('Forgot password error:', error);
  }
  res.json(authService.FORGOT_PASSWORD_ANSWER);
}

export async function resetPassword(req, res) {
  res.json(await authService.resetPassword(req.body));
}

export async function createSystemBackup(req, res) {
  res.json(await authService.createSystemBackup());
}
