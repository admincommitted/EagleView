const DATE_TYPES = ['DATE', 'DATEONLY'];
const NUMBER_TYPES = ['INTEGER', 'BIGINT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'REAL'];
const DAY_MONTH_YEAR = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;

const isAutoIncrementKey = (name, attribute, primaryKey) => name === primaryKey && attribute.autoIncrement;

const isBlankValue = (value, type) =>
  value === '' || (typeof value === 'string' && value.trim() === '' && [...DATE_TYPES, ...NUMBER_TYPES].includes(type));

/** What a blank form value is saved as; undefined = keep the value as it came. */
function blankReplacement(type, attribute) {
  if (DATE_TYPES.includes(type)) return null;
  if (NUMBER_TYPES.includes(type)) {
    if (attribute.allowNull !== false) return null;
    return attribute.defaultValue != null ? attribute.defaultValue : 0;
  }
  if (type === 'BOOLEAN') return attribute.allowNull === false ? !!attribute.defaultValue : null;
  return undefined;
}

/** dd/mm/yyyy (as typed in Excel) -> yyyy-mm-dd; anything else that is not a date -> null */
function excelDateToIso(value) {
  const match = DAY_MONTH_YEAR.exec(value.trim());
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : null;
}

/**
 * Cleans a form body before create / update:
 * - an id '' from a "new" form is dropped (SQLite refuses '' as the key);
 * - '' in a date column becomes null (not the text "Invalid date"), '' in a number column null / its default;
 * - '' in a unique column becomes null, so two empty codes do not clash;
 * - createdAt / updatedAt from the browser are ignored.
 */
export function cleanBody(Model, body, { keepPk = false } = {}) {
  const cleaned = { ...body };
  delete cleaned.createdAt;
  delete cleaned.updatedAt;
  const primaryKey = Model.primaryKeyAttribute || 'id';

  for (const [name, attribute] of Object.entries(Model.rawAttributes)) {
    if (!(name in cleaned)) continue;
    const value = cleaned[name];
    if (isAutoIncrementKey(name, attribute, primaryKey) && !keepPk) {
      delete cleaned[name];
      continue;
    }
    if (isAutoIncrementKey(name, attribute, primaryKey) && (value === '' || value == null)) {
      delete cleaned[name];
      continue;
    }

    const type = attribute.type && attribute.type.key;
    if (value === '' && attribute.unique) {
      cleaned[name] = null;
      continue;
    }

    if (isBlankValue(value, type)) {
      const replacement = blankReplacement(type, attribute);
      if (replacement !== undefined) cleaned[name] = replacement;
    } else if (DATE_TYPES.includes(type) && typeof value === 'string' && Number.isNaN(new Date(value).getTime())) {
      cleaned[name] = excelDateToIso(value);
    }
  }
  return cleaned;
}
