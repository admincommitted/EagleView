import * as emailService from './email.service.js';

export async function sendTestMail(req, res) {
  const { to, smtp } = req.body;
  res.json(await emailService.sendTestMail(to, smtp));
}

export async function sendMail(req, res) {
  res.json(await emailService.sendMail(req.body, req.user));
}
