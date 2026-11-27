import * as customsWatch from '../../../utils/customs/cbicCustomsWatch.js';
import * as settingsStore from '../../../utils/common/settingsStore.js';
import { ApiError } from '../../../core/http/index.js';

const SERVER_ERROR = 500;
const BAD_GATEWAY = 502;
const EXCHANGE_RATE_SOURCE = 'cbic_exrate';

/** A failure of the watch answers { success: false, error } with the given status. */
const watchFailure = (status, error) =>
  new ApiError(status, error.message, { body: { success: false, error: error.message } });

export async function watchStatus() {
  try {
    return { success: true, ...(await customsWatch.status()) };
  } catch (error) {
    throw watchFailure(SERVER_ERROR, error);
  }
}

/** The newest customs entries on the CBIC portal now; a portal problem answers 502. */
export async function latestEntries() {
  try {
    return { success: true, items: await customsWatch.latest() };
  } catch (error) {
    throw watchFailure(BAD_GATEWAY, error);
  }
}

/** values: the checked fields from cbicWatch.validation.js, stored under the watch's own setting keys. */
export async function saveWatchSettings(values) {
  const keys = customsWatch.K;
  const settings = {};
  if (values.to !== undefined) settings[keys.to] = values.to;
  if (values.on !== undefined) settings[keys.on] = values.on;
  if (values.off !== undefined) settings[keys.off] = values.off;
  if (values.pages !== undefined) settings[keys.pages] = values.pages;
  await settingsStore.setMany(settings);
  return { success: true, ...(await customsWatch.status()) };
}

/** Checks the portal now and mails anything new. */
export async function checkNow(checkedBy) {
  try {
    const result = await customsWatch.checkNow({ by: checkedBy });
    return { success: !result.error && !result.busy, ...result };
  } catch (error) {
    throw watchFailure(SERVER_ERROR, error);
  }
}

/** A test mail with the newest entry and its PDF, or the newest exchange rates for { source: 'cbic_exrate' }. */
export async function sendTestMail(source) {
  try {
    const testSource = source === EXCHANGE_RATE_SOURCE ? EXCHANGE_RATE_SOURCE : undefined;
    return { success: true, ...(await customsWatch.sendTest(testSource)) };
  } catch (error) {
    throw watchFailure(error.status || BAD_GATEWAY, error);
  }
}
