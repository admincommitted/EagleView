/**
 * Adds columns that a model defines but the database table does not have yet.
 * Only ADDs nullable columns — never drops, renames or changes existing ones,
 * so it is safe on a live database (unlike sync({ alter: true })).
 */
async function ensureColumns(model) {
  const qi = model.sequelize.getQueryInterface();
  const table = model.getTableName();
  let existing;
  try { existing = await qi.describeTable(table); } catch (e) { return []; } // table not created yet: sync() makes it
  const added = [];
  for (const [name, attr] of Object.entries(model.rawAttributes)) {
    const field = attr.field || name;
    if (existing[field] || attr.primaryKey) continue;
    const key = attr.type && (attr.type.key || (attr.type.constructor && attr.type.constructor.key));
    if (key === 'VIRTUAL') continue; // not a real column
    const dv = attr.defaultValue;
    const constDefault = dv === undefined || dv === null || ['string', 'number', 'boolean'].includes(typeof dv);
    try {
      await qi.addColumn(table, field, constDefault && dv !== undefined
        ? { type: attr.type, allowNull: true, defaultValue: dv }
        : { type: attr.type, allowNull: true }); // NOW/UUID etc. are filled by Sequelize on insert
      added.push(field);
    } catch (e) {
      console.warn(`[DB] could not add column ${field}: ${e.message}`);
    }
  }
  if (added.length) console.log(`[DB] ${typeof table === 'string' ? table : table.tableName}: added missing column(s) ${added.join(', ')}`);
  return added;
}

module.exports = { ensureColumns };
