import { z } from 'zod';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_PORT = 65536;
const MAX_LUT_LENGTH = 60;
const MAX_FAX_LENGTH = 30;
const MASKED_PASSWORD = '********';

const addProblem = (ctx, message) => ctx.addIssue({ code: 'custom', message });

export const singleSettingSchema = z.any().superRefine((body, ctx) => {
  if (!(body || {}).key) addProblem(ctx, 'Key is required');
});

export const bulkSettingsSchema = z.any().superRefine((body, ctx) => {
  const { settings } = body;
  if (!settings || typeof settings !== 'object') addProblem(ctx, 'Settings object is required');
});

// ---- Company profile ----------------------------------------------------------------------------------------------
const COMPANY_FIELDS = [
  'companyName',
  'legalName',
  'address1',
  'address2',
  'city',
  'state',
  'pincode',
  'country',
  'gstin',
  'pan',
  'iec',
  'cin',
  'phone',
  'email',
  'website',
  'defaultCurrency',
  'timezone',
  'dateFormat',
  'tagline',
  'lutNo',
  'logoDataUrl',
  'bankName',
  'accountName',
  'accountNo',
  'ifsc',
  'swift',
  'einvoiceUser',
  'einvoicePass',
  'einvoiceBaseUrl',
  'fax',
  'registeredOffice',
  'invoiceNotes',
];
const UPPER_CASE_COMPANY_FIELDS = [
  'gstin',
  'pan',
  'iec',
  'cin',
  'defaultCurrency',
  'state',
  'country',
  'ifsc',
  'swift',
];

/** The company fields that were sent, trimmed (empty = null), codes in upper case. */
function companyValues(body) {
  const values = {};
  for (const field of COMPANY_FIELDS) {
    if (body[field] !== undefined) values[field] = body[field] == null ? null : String(body[field]).trim() || null;
  }
  for (const field of UPPER_CASE_COMPANY_FIELDS) if (values[field]) values[field] = values[field].toUpperCase();
  return values;
}

function companyProblems(values, body) {
  const problems = [];
  if (!values.companyName && body.companyName !== undefined) problems.push('Company name is required');
  if (values.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(values.gstin)) {
    problems.push('GSTIN must be 15 characters like 07AAACC1234D1Z5');
  }
  if (values.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(values.pan)) problems.push('PAN must be like AAACC1234D');
  if (values.iec && !/^[A-Z0-9]{10}$/.test(values.iec)) problems.push('IEC must be 10 characters');
  if (values.gstin && values.pan && values.gstin.slice(2, 12) !== values.pan) {
    problems.push('PAN does not match the GSTIN (characters 3-12)');
  }
  if (values.pincode && !/^\d{6}$/.test(values.pincode)) problems.push('PIN code must be 6 digits');
  if (values.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(values.ifsc.toUpperCase())) {
    problems.push('IFSC must be 11 characters like HDFC0000123');
  }
  if (values.swift && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(values.swift.toUpperCase())) {
    problems.push('SWIFT / BIC must be 8 or 11 characters like HDFCINBB or HDFCINBBXXX');
  }
  if (values.accountNo && !/^[0-9A-Z]{5,34}$/.test(values.accountNo.toUpperCase())) {
    problems.push('Bank account number looks wrong (5 to 34 letters or digits, no spaces)');
  }
  if (values.lutNo && values.lutNo.length > MAX_LUT_LENGTH) problems.push('LUT number is too long');
  if (values.email && !EMAIL_PATTERN.test(values.email)) problems.push('Email is not valid');
  if (values.defaultCurrency && !/^[A-Z]{3}$/.test(values.defaultCurrency)) {
    problems.push('Currency must be a 3-letter code (INR)');
  }
  // the fax length is reported alone, only when everything else is right
  if (!problems.length && values.fax && values.fax.length > MAX_FAX_LENGTH) problems.push('Fax number is too long');
  return problems;
}

export const companyProfileSchema = z
  .any()
  .superRefine((body, ctx) => {
    const sent = body || {};
    for (const problem of companyProblems(companyValues(sent), sent)) addProblem(ctx, problem);
  })
  .transform((body) => companyValues(body || {}));

// ---- Email (SMTP) block of the Company Settings screen ----------------------------------------------------------
const EMAIL_FIELDS = ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'smtpSecure', 'fromName'];

const hasPortValue = (port) => port !== undefined && port !== null && port !== '';
const isValidPort = (port) => {
  const number = parseInt(port, 10);
  return number > 0 && number < MAX_PORT;
};

function emailProblems(body) {
  const problems = [];
  if (hasPortValue(body.smtpPort) && !isValidPort(body.smtpPort)) {
    problems.push('SMTP port must be a number between 1 and 65535');
  }
  if (body.smtpUser && !EMAIL_PATTERN.test(String(body.smtpUser)))
    problems.push('SMTP username should be the full email address');
  return problems;
}

/** An empty or masked password box means "leave the stored one alone", not "clear it". */
function emailValues(body) {
  const values = {};
  for (const field of EMAIL_FIELDS) if (body[field] !== undefined) values[field] = body[field];
  if (hasPortValue(values.smtpPort)) values.smtpPort = parseInt(values.smtpPort, 10);
  if (values.smtpPass === '' || values.smtpPass === MASKED_PASSWORD) delete values.smtpPass;
  if (values.smtpSecure !== undefined) values.smtpSecure = !!values.smtpSecure;
  return values;
}

export const emailSettingsSchema = z
  .any()
  .superRefine((body, ctx) => {
    for (const problem of emailProblems(body || {})) addProblem(ctx, problem);
  })
  .transform((body) => emailValues(body || {}));

/** Answer shape of these two screens: every problem, joined and as a list. */
export const problemListBody = (message, issues) => {
  const problems = issues.map((issue) => issue.message);
  return { success: false, error: problems.join('; '), errors: problems };
};
