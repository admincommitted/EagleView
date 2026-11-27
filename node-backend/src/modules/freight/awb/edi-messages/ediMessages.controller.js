import * as ediService from './ediMessages.service.js';

function sendXmlFile(res, xml, fileName) {
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(xml);
}

export async function transmitFwbText(req, res) {
  res.status(200).json(await ediService.generateFwbText(req.params.id));
}

export async function downloadXfwb(req, res) {
  sendXmlFile(res, await ediService.buildXfwb(req.params.id), `AWB_${req.params.id}_XFWB.xml`);
}

export async function previewXfwb(req, res) {
  res.status(200).json({ success: true, xml: await ediService.buildXfwb(req.params.id) });
}

export async function downloadXfhl(req, res) {
  sendXmlFile(res, await ediService.buildXfhl(req.params.id), `AWB_${req.params.id}_XFHL.xml`);
}

export async function previewXfhl(req, res) {
  res.status(200).json({ success: true, xml: await ediService.buildXfhl(req.params.id) });
}

export async function sftpStatus(req, res) {
  res.json(await ediService.sftpStatus());
}

export async function pollFsu(req, res) {
  res.json(await ediService.pollFsuNow());
}

export async function sendXfwb(req, res) {
  res.json(await ediService.sendXfwb(req.params.id, req.body));
}

export async function sendXfhl(req, res) {
  res.json(await ediService.sendXfhl(req.params.id, req.body));
}

export async function sendXfzb(req, res) {
  res.json(await ediService.sendXfzb(req.params.id, req.body));
}

export async function sendXffm(req, res) {
  res.json(await ediService.sendXffm(req.params.id));
}

export function validateEdiDryRun(req, res) {
  const errors = ediService.dryRunValidationErrors(req.body);
  if (errors.length) return res.status(400).json({ errors });
  return res.status(200).json({ valid: true, message: 'No errors found.' });
}

export async function previewFwb(req, res) {
  res.status(200).json(await ediService.generateFwbText(req.params.id));
}

export async function previewFhl(req, res) {
  res.status(200).json(await ediService.generateFhlText(req.params.id));
}
