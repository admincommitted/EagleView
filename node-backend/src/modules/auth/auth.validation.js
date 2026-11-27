import { z } from 'zod';

const MAX_USER_ID_LENGTH = 100;
const MIN_PASSWORD_LENGTH = 8;

export const APP_BACKGROUNDS = [
  'slate',
  'white',
  'warm',
  'sky',
  'mint',
  'lavender',
  'peach',
  'rose',
  'coolgrey',
  'ivory',
  'ice',
  'seagreen',
  'lemon',
];
export const APP_COLORS = [
  'ocean',
  'blue',
  'emerald',
  'forest',
  'violet',
  'plum',
  'rose',
  'crimson',
  'amber',
  'pumpkin',
  'cyan',
  'pink',
  'teal',
  'indigo',
  'midnight',
  'gray',
  'ruby',
  'lime',
  'sage',
  'coral',
  'magenta',
  'slate',
  'navy',
  'sky',
  'gold',
  'fuchsia',
  'tangerine',
  'cerulean',
  'olive',
  'berry',
  'chocolate',
  'lavender',
  'deepteal',
  'steel',
  'royal',
  'petrol',
  'bottle',
  'maroon',
  'bronze',
  'charcoal',
];
const APP_LANGUAGES = ['en', 'hi', 'es'];
const APP_THEMES = ['light', 'dark'];

const addProblem = (ctx, message) => ctx.addIssue({ code: 'custom', message });

/** The login page sends { username }; older clients send { email }. */
export const loginSchema = z.any().superRefine((body, ctx) => {
  const { email, username, password } = body;
  const userId = String(username || email || '').trim();
  if (!userId || !password) addProblem(ctx, 'User ID and Password are required');
});

export const forgotPasswordSchema = z.any().superRefine((body, ctx) => {
  const { userId } = body || {};
  if (!userId || typeof userId !== 'string' || userId.length > MAX_USER_ID_LENGTH)
    addProblem(ctx, 'User ID is required');
});

export const resetPasswordSchema = z.any().superRefine((body, ctx) => {
  const { token, newPassword } = body || {};
  if (!token || typeof token !== 'string') return addProblem(ctx, 'Reset link is missing or broken.');
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    addProblem(ctx, 'New password must be at least 8 characters.');
  }
});

const isKnownTimeZone = (timeZone) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: String(timeZone) });
    return true;
  } catch {
    return false;
  }
};

/** Problems with the App Settings fields that were sent (each field is checked only when present). */
function appSettingsProblems(body) {
  const problems = [];
  if (body.appBackground !== undefined && !APP_BACKGROUNDS.includes(body.appBackground)) {
    problems.push('Unknown background: ' + body.appBackground);
  }
  if (body.primaryColor !== undefined && !APP_COLORS.includes(body.primaryColor)) {
    problems.push('Unknown theme colour: ' + body.primaryColor);
  }
  if (body.language !== undefined && !APP_LANGUAGES.includes(body.language)) {
    problems.push('Unknown language: ' + body.language);
  }
  if (body.theme !== undefined && !APP_THEMES.includes(body.theme)) problems.push('Theme must be light or dark');
  if (body.timezone !== undefined && !isKnownTimeZone(body.timezone))
    problems.push('Unknown time zone: ' + body.timezone);
  return problems;
}

/** Only the six App Settings fields are taken from the body, so a request cannot change userId / id. */
function appSettingsValues(body) {
  const values = {};
  if (body.appBackground !== undefined) values.appBackground = body.appBackground;
  if (body.primaryColor !== undefined) values.primaryColor = body.primaryColor;
  if (body.language !== undefined) values.language = body.language;
  if (body.theme !== undefined) values.theme = body.theme;
  if (body.notificationsEnabled !== undefined) {
    values.notificationsEnabled = body.notificationsEnabled === true || body.notificationsEnabled === 'true';
  }
  if (body.timezone !== undefined) values.timezone = String(body.timezone);
  return values;
}

export const appSettingsSchema = z
  .any()
  .superRefine((body, ctx) => {
    const problems = appSettingsProblems(body || {});
    if (problems.length) addProblem(ctx, problems.join('; '));
  })
  .transform((body) => appSettingsValues(body || {}));
