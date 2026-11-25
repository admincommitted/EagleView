export const FORMAT_TAGS = ['{BRANCH}', '{DEPT}', '{FY}', '{YY}', '{MM}', '{DD}'];

export const DEPT_CODE = {
  ALL: 'GEN', 'Air Export': 'AE', 'Air Import': 'AI', 'Sea Export': 'SE', 'Sea Import': 'SI', Customs: 'CUS', Accounts: 'ACC', HR: 'HR',
};

export const EMPTY_RULE = {
  id: null, docType: '', branchCode: 'ALL', dept: 'ALL', fyCode: '', format: '{BRANCH}/{DEPT}/INV/{FY}/', pad: 4, nextNumber: 1, isActive: true,
};

const NOT_SAVED_FIELDS = ['id', 'createdAt', 'updatedAt', 'example'];

const twoDigits = (number) => String(number).padStart(2, '0');

// Same rule as the server: an unknown branch prints HO, an unknown department GEN.
export function previewNumber(rule, number, date = new Date()) {
  const values = {
    BRANCH: rule.branchCode && rule.branchCode !== 'ALL' ? rule.branchCode : 'HO',
    DEPT: DEPT_CODE[rule.dept] || 'GEN',
    FY: rule.fyCode || 'FY',
    YY: String(date.getFullYear()).slice(2),
    MM: twoDigits(date.getMonth() + 1),
    DD: twoDigits(date.getDate()),
  };
  const prefix = String(rule.format || '').replace(/\{(BRANCH|DEPT|FY|YY|MM|DD)\}/g, (tag, name) => values[name]);
  const parsed = parseInt(number, 10);
  return prefix + String(Number.isFinite(parsed) ? parsed : 1).padStart(parseInt(rule.pad, 10) || 1, '0');
}

export const defaultYear = (years) => years.find((year) => year.isDefault) || years[0];

/** The text of the first rule broken, or '' when the rule can be saved. */
export function ruleProblem(rule) {
  if (!rule.docType || !rule.format) return 'Document Type and Format are required!';
  if (!rule.fyCode) return 'Choose a financial year';
  const pad = parseInt(rule.pad, 10);
  if (!(pad >= 1 && pad <= 8)) return 'Padding must be 1 - 8';
  if (!(parseInt(rule.nextNumber, 10) >= 1)) return 'Next number must be 1 or more';
  return '';
}

export const ruleBody = (rule, allowBack) => ({
  ...Object.fromEntries(Object.entries(rule).filter(([key]) => !NOT_SAVED_FIELDS.includes(key))),
  pad: parseInt(rule.pad, 10),
  nextNumber: parseInt(rule.nextNumber, 10),
  allowBack,
});
