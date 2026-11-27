import * as whatsappService from './whatsapp.service.js';

const HEARTBEAT_MS = 25 * 1000;
// a first block of 4 KB pushes the stream through proxies that buffer small answers
const STREAM_PADDING = ':' + Array(4096).join(' ') + '\n\n';

const sendEvent = (res, data) => res.write('data: ' + data + '\n\n');

export function connectionState(req, res) {
  res.json(whatsappService.connectionStateFor(req.user && req.user.role));
}

/** Server-Sent Events: the current state at once, then every QR / status change; a heartbeat keeps it open. */
export function streamEvents(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(STREAM_PADDING);

  sendEvent(res, JSON.stringify({ type: 'state', ...whatsappService.currentState() }));
  const unsubscribe = whatsappService.subscribeToUpdates((message) => sendEvent(res, message));
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), HEARTBEAT_MS);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

export async function sendApiTest(req, res) {
  res.json(await whatsappService.sendApiTest(req.body.toNumber));
}

export function connect(req, res) {
  res.json(whatsappService.connect(req.body && req.body.force));
}

export async function disconnect(req, res) {
  res.json(await whatsappService.disconnect());
}

export async function sendTestMessage(req, res) {
  const { toNumber, message } = req.body;
  res.json(await whatsappService.sendTestMessage(toNumber, message));
}

export async function sendInternalMessage(req, res) {
  res.json(await whatsappService.sendInternalMessage(req.body));
}

export async function queueStats(req, res) {
  res.json(await whatsappService.queueStats());
}

export async function flushQueue(req, res) {
  res.json(await whatsappService.flushQueue());
}

export async function restartScheduler(req, res) {
  res.json(await whatsappService.restartScheduler());
}

export async function sendStatusMessage(req, res) {
  res.json(await whatsappService.sendStatusMessage(req.body));
}

export async function listModuleNumbers(req, res) {
  res.json(await whatsappService.readModuleNumbers());
}

export async function saveModuleNumber(req, res) {
  res.json(await whatsappService.saveModuleNumber(req.validated.body));
}

export async function removeModuleNumber(req, res) {
  res.json(await whatsappService.removeModuleNumber(req.params.moduleName));
}
