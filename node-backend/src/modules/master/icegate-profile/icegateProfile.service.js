import { BadRequestError, NotFoundError } from '../../../core/http/index.js';
import { IcegateProfile } from '../../../models/index.js';

// the password, API key and IMAP app password never go back to the browser
const MASK = '********';
const MASK_PREFIX = '****';
const API_KEY_HINT_LENGTH = 4;
const REQUIRED_FIELDS = ['profileName', 'loginId', 'password', 'apiKey'];
const TRIMMED_FIELDS = ['profileName', 'loginId', 'apiKey', 'baseUrl', 'linkedChaCode', 'imapEmail'];
const SECRET_FIELDS = ['password', 'apiKey', 'imapAppPassword'];

const failed = (ErrorClass, message) => new ErrorClass(message, { body: { success: false, error: message } });
const profileNotFound = () => failed(NotFoundError, 'Profile not found');

const isMasked = (value) => String(value).startsWith(MASK_PREFIX);

function listedProfile(profile) {
  const data = profile.toJSON();
  data.password = MASK;
  data.apiKeyHint = profile.apiKey ? `...${String(profile.apiKey).slice(-API_KEY_HINT_LENGTH)}` : '';
  data.apiKey = profile.apiKey ? MASK : '';
  data.imapAppPassword = profile.imapAppPassword ? MASK : '';
  return data;
}

const savedProfile = (profile) => ({
  ...profile.toJSON(),
  password: MASK,
  apiKey: MASK,
  imapAppPassword: profile.imapAppPassword ? MASK : '',
});

const clearDefaultProfile = () => IcegateProfile.update({ isDefault: false }, { where: { isDefault: true } });

export async function listProfiles() {
  const profiles = await IcegateProfile.findAll({ order: [['createdAt', 'DESC']] });
  return profiles.map(listedProfile);
}

/** The first profile becomes the default. */
export async function createProfile(body) {
  // the old default is switched off before the fields are checked, so a refused save leaves no default
  if (body.isDefault) await clearDefaultProfile();
  const values = { ...body };
  delete values.id;
  for (const field of REQUIRED_FIELDS) {
    if (!String(values[field] || '').trim() || isMasked(values[field]))
      throw failed(BadRequestError, `${field} is required`);
  }
  for (const field of TRIMMED_FIELDS) if (typeof values[field] === 'string') values[field] = values[field].trim();
  if (values.imapAppPassword && isMasked(values.imapAppPassword)) delete values.imapAppPassword;
  if (!(await IcegateProfile.count())) values.isDefault = true;
  return savedProfile(await IcegateProfile.create(values));
}

/** A masked or empty secret keeps the saved one. */
export async function updateProfile(id, body) {
  const profile = await IcegateProfile.findByPk(id);
  if (!profile) throw profileNotFound();
  const changes = { ...body };
  for (const field of SECRET_FIELDS) if (!changes[field] || isMasked(changes[field])) delete changes[field];
  delete changes.id;
  delete changes.apiKeyHint;
  if (profile.isDefault && changes.isDefault === false)
    throw failed(BadRequestError, 'Make another profile the default first');
  if (changes.isDefault && !profile.isDefault) await clearDefaultProfile();
  await profile.update(changes);
  return savedProfile(profile);
}

/** Deleting the default profile makes the oldest remaining one the default. */
export async function deleteProfile(id) {
  const profile = await IcegateProfile.findByPk(id);
  if (!profile) throw profileNotFound();
  await profile.destroy();
  if (!profile.isDefault) return;
  const nextProfile = await IcegateProfile.findOne({ order: [['id', 'ASC']] });
  if (nextProfile) await nextProfile.update({ isDefault: true });
}
