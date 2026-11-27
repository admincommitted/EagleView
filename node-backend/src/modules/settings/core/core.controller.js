import { isOfficeIp, normIp, publicBase, trustProxySetting } from '../../../utils/security/webSecurity.js';
import * as coreService from './core.service.js';

export async function getPublicSettings(req, res) {
  res.json(await coreService.getPublicSettings());
}

export async function saveSetting(req, res) {
  const { key, value } = req.body;
  await coreService.saveSetting(key, value);
  res.json({ success: true });
}

export async function saveSettings(req, res) {
  await coreService.saveSettings(req.body.settings);
  res.json({ success: true, message: 'Settings updated successfully' });
}

/** How this server sees the caller - for the Security tab. */
export function securityCheck(req, res) {
  res.json({
    success: true,
    data: {
      ip: normIp(req.ip),
      office: isOfficeIp(req.ip),
      https: !!req.secure,
      linkBase: publicBase(req),
      trustProxy: String(trustProxySetting()),
    },
  });
}

export async function testSftpConnection(req, res) {
  res.json(await coreService.testSftpConnection(req.body));
}

export async function exportPrivateKey(req, res) {
  res.json(await coreService.exportPrivateKey());
}

export async function exportPublicKey(req, res) {
  res.json(await coreService.exportPublicKey());
}

export async function generateSshKey(req, res) {
  const { saveToDb } = req.body;
  res.json(await coreService.generateSshKey(saveToDb));
}

export function defaultCompanyLogo(req, res) {
  res.json(coreService.defaultCompanyLogo());
}

export async function getCompanyProfile(req, res) {
  res.json(await coreService.getCompanyProfile());
}

export async function updateCompanyProfile(req, res) {
  res.json(await coreService.updateCompanyProfile(req.validated.body));
}

export function sftpConnectionStatus(req, res) {
  res.json(coreService.sftpConnectionStatus());
}

export async function getEmailSettings(req, res) {
  res.json(await coreService.getEmailSettings());
}

export async function updateEmailSettings(req, res) {
  res.json(await coreService.updateEmailSettings(req.validated.body));
}

export async function testEinvoiceConnection(req, res) {
  res.json(await coreService.testEinvoiceConnection(req.body));
}
