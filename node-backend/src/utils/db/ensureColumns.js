/**
 * Adds columns that a model defines but the database table does not have yet.
 * Only ADDs nullable columns — never drops, renames or changes existing ones,
 * so it is safe on a live database (unlike sync({ alter: true })).
 */

const typeKeyOf = (attribute) =>
  attribute.type && (attribute.type.key || (attribute.type.constructor && attribute.type.constructor.key));

const isConstantDefault = (value) =>
  value === undefined || value === null || ['string', 'number', 'boolean'].includes(typeof value);

// NOW / UUID etc. defaults are not written into the column: Sequelize fills them on insert
function columnDefinitionFor(attribute) {
  const defaultValue = attribute.defaultValue;
  if (isConstantDefault(defaultValue) && defaultValue !== undefined) {
    return { type: attribute.type, allowNull: true, defaultValue };
  }
  return { type: attribute.type, allowNull: true };
}

async function ensureColumns(model) {
  const queryInterface = model.sequelize.getQueryInterface();
  const table = model.getTableName();
  let existing;
  try {
    existing = await queryInterface.describeTable(table);
  } catch {
    return []; // table not created yet: sync() makes it
  }
  const added = [];
  for (const [name, attribute] of Object.entries(model.rawAttributes)) {
    const field = attribute.field || name;
    if (existing[field] || attribute.primaryKey) continue;
    if (typeKeyOf(attribute) === 'VIRTUAL') continue; // not a real column
    try {
      await queryInterface.addColumn(table, field, columnDefinitionFor(attribute));
      added.push(field);
    } catch (error) {
      console.warn(`[DB] could not add column ${field}: ${error.message}`);
    }
  }
  if (added.length) {
    const tableName = typeof table === 'string' ? table : table.tableName;
    console.log(`[DB] ${tableName}: added missing column(s) ${added.join(', ')}`);
  }
  return added;
}

export { ensureColumns };
