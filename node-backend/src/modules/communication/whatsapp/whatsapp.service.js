import { User } from '../../../models/index.js';
import { sequelize } from '../../../config/database.js';
import * as whatsappWeb from '../../../utils/integrations/WhatsappWebService.js';
import {
  sendInternalNotification as sendInternalByApi,
  sendWhatsapp,
} from '../../../utils/integrations/WhatsappService.js';
import {
  flushQueue as flushSchedulerQueue,
  getQueueStats,
  handleStatusUpdate,
  startScheduler,
} from '../../../utils/integrations/WhatsappScheduler.js';
import * as settingsStore from '../../../utils/common/settingsStore.js';
import { BadRequestError, NotFoundError } from '../../../core/http/index.js';

const API_TEST_TEXT = 'Hello! This is a test from Committed Cargo ERP via API. ✅';
// with a template set, the API test goes as that template ({{1}} name, {{2}} ref, {{3}} status)
const API_TEST_TEMPLATE_VALUES = ['Test', 'TEST-001', 'WhatsApp API test from Committed Cargo ERP'];
const QR_TEST_TEXT = 'Hello! This is a test message from Committed Cargo ERP. WhatsApp is working correctly. ✅';

const errorWith = (ErrorClass, message) => new ErrorClass(message, { body: { error: message } });

/** QR (WhatsApp Web) or API, as chosen in Settings > WhatsApp. */
const sendingMode = async () => ((await settingsStore.get('whatsapp_mode')) === 'api' ? 'api' : 'qr');

/** The QR that links a phone to the company WhatsApp is shown only to an admin. */
export function connectionStateFor(role) {
  const state = { ...whatsappWeb.getState() };
  if (String(role || '').toLowerCase() !== 'admin') state.qr = null;
  return state;
}

export const currentState = () => whatsappWeb.getState();

/** Calls listener(message) on every QR / status change; returns the function that stops it. */
export const subscribeToUpdates = (listener) => whatsappWeb.subscribe(listener);

export async function sendApiTest(toNumber) {
  return { success: true, result: await sendWhatsapp(toNumber, API_TEST_TEXT, null, API_TEST_TEMPLATE_VALUES) };
}

/** A start that failed or hung is restarted. */
export function connect(force) {
  const { status } = whatsappWeb.getState();
  whatsappWeb.initClient(status === 'disconnected' || status === 'starting' || !!force);
  return { success: true, message: 'WhatsApp client starting. QR code will appear shortly.' };
}

export async function disconnect() {
  await whatsappWeb.disconnect();
  return { success: true, message: 'WhatsApp disconnected.' };
}

export async function sendTestMessage(toNumber, message) {
  return { success: true, result: await whatsappWeb.sendMessage(toNumber, message || QR_TEST_TEXT) };
}

/** An internal notification to an employee, on his user's mobile number. */
export async function sendInternalMessage({ userId, messageType, data }) {
  const user = await User.findByPk(userId);
  if (!user) throw errorWith(NotFoundError, 'User not found');
  if (!user.contactNumber) throw errorWith(BadRequestError, 'No mobile number set for this user.');
  const send = (await sendingMode()) === 'api' ? sendInternalByApi : whatsappWeb.sendInternalNotification;
  const result = await send(user.fullName || user.username, user.contactNumber, messageType || 'custom', data || {});
  return { success: true, sentTo: user.contactNumber, result };
}

/** Pending queue count and mode. */
export function queueStats() {
  return getQueueStats();
}

/** Sends everything pending now. */
export async function flushQueue() {
  return { success: true, ...(await flushSchedulerQueue()) };
}

/** Reloads the schedule after a settings change. */
export async function restartScheduler() {
  await startScheduler();
  return { success: true, message: 'Scheduler restarted.' };
}

/** A shipment status: sent at once or queued, as the instant / scheduled mode says. */
export async function sendStatusMessage({ partyName, mobileNumber, awbNumber, statusText }) {
  return { success: true, result: await handleStatusUpdate(partyName, mobileNumber, awbNumber, statusText) };
}

// ---- Module-wise WhatsApp numbers (Settings > WhatsApp): one WhatsappModuleNumber row per module ---------------
const sameModule = (name) => (entry) => entry.moduleName.toLowerCase() === name.toLowerCase();

export async function readModuleNumbers() {
  await settingsStore.ready();
  const rows = await settingsStore.models.WhatsappModuleNumber.findAll({ order: [['moduleName', 'ASC']] });
  return rows.map((row) => ({ moduleName: row.moduleName, phoneNumber: row.phoneNumber }));
}

async function writeModuleNumbers(list) {
  await settingsStore.ready();
  const { WhatsappModuleNumber } = settingsStore.models;
  await sequelize.transaction(async (transaction) => {
    await WhatsappModuleNumber.destroy({ where: {}, transaction });
    for (const entry of list) {
      await WhatsappModuleNumber.create(
        { moduleName: entry.moduleName, phoneNumber: entry.phoneNumber },
        { transaction },
      );
    }
  });
}

/** Adds the module's number, replacing the one it had (module names compared in any case). */
export async function saveModuleNumber({ moduleName, phoneNumber }) {
  const isSame = sameModule(moduleName);
  const list = (await readModuleNumbers()).filter((entry) => !isSame(entry));
  list.push({ moduleName, phoneNumber });
  await writeModuleNumbers(list);
  return list;
}

export async function removeModuleNumber(moduleName) {
  const isSame = sameModule(String(moduleName));
  const list = await readModuleNumbers();
  const remaining = list.filter((entry) => !isSame(entry));
  if (remaining.length === list.length) throw errorWith(NotFoundError, 'Not found');
  await writeModuleNumbers(remaining);
  return remaining;
}
