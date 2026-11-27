import { UserPreference } from '../../../models/index.js';
import { ApiError, UnauthorizedError } from '../../../core/http/index.js';

const MAX_VALUE_LENGTH = 10000; // characters of JSON
const PAYLOAD_TOO_LARGE = 413;

const failure = (message) => ({ body: { success: false, error: message } });

let tableReady = null;
const ensureTable = () => {
  tableReady =
    tableReady ||
    UserPreference.sync().catch((error) => {
      tableReady = null;
      throw error;
    });
  return tableReady;
};

function checkLoggedIn(userId) {
  if (!userId) throw new UnauthorizedError('Not logged in', failure('Not logged in'));
}

const parseStoredValue = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** A user reads only his own preference rows. */
export async function getPreference(userId, key) {
  checkLoggedIn(userId);
  await ensureTable();
  const row = await UserPreference.findOne({ where: { userId, prefKey: key } });
  const value = row && row.value != null ? parseStoredValue(row.value) : null;
  return { success: true, key, value, saved: !!row };
}

export async function savePreference(userId, key, body) {
  checkLoggedIn(userId);
  const text = JSON.stringify(body && 'value' in body ? body.value : null);
  if (text.length > MAX_VALUE_LENGTH) {
    throw new ApiError(PAYLOAD_TOO_LARGE, 'Preference too large', failure('Preference too large'));
  }
  await ensureTable();
  const where = { userId, prefKey: key };
  const [row, created] = await UserPreference.findOrCreate({ where, defaults: { ...where, value: text } });
  if (!created) await row.update({ value: text });
  return { success: true };
}
