/**
 * Every field the Import / Export screens send gets a real database column. 28-Oct-2026
 *
 * - ensureFieldColumns(Model, rows): before a save, adds a TEXT column for each field name in rows
 *   that the table does not have yet, then registers it on the model so Sequelize saves it.
 * - registerDbColumns(Model): at startup, registers columns that exist in the table but not in the
 *   model file (added earlier by ensureFieldColumns), so they are read and written again.
 * Lists/objects are stored as JSON text and read back as lists/objects.
 * Field names that cannot be column names stay in the extendedData / additionalData JSON column.
 */
const { DataTypes } = require('sequelize');

const VALID = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const NEVER = new Set(['invoices', 'Invoices', 'items', 'containers', 'Containers', 'docs', 'dbkItems', 'licenseItems',
    'createdAt', 'updatedAt', 'extendedData', 'additionalData']);

// true for the shapes this file itself stores: a plain object, or a list that is empty or holds only plain objects
function isStoredObject(x) {
    const plain = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
    if (Array.isArray(x)) return x.every(plain);
    return plain(x);
}

function jsonAttr(name) {
    return {
        type: DataTypes.TEXT,
        allowNull: true,
        _dynamic: true,
        get() {
            const v = this.getDataValue(name);
            // 30-Oct-2026: anything that merely STARTED with [ or { was parsed, so text an operator can really type
            // came back as data: marks and numbers "[1,10]" became the list [1, 10] (and was then filed as "1,10"),
            // and "[]" in a text box became an empty list. What the setter below writes is always an object, or a
            // list of objects (popup data and grid rows) - never a list of plain numbers or words - so only those
            // shapes are read back as data and everything else stays the text it was typed as. "[]" and "{}" stay
            // ambiguous and are read as the empty list / object, because the screens really do store empty grids.
            if (typeof v === 'string' && /^\s*[[{]/.test(v)) {
                try {
                    const parsed = JSON.parse(v);
                    if (isStoredObject(parsed)) return parsed;
                } catch (e) { /* plain text */ }
            }
            return v;
        },
        set(v) {
            this.setDataValue(name, (v && typeof v === 'object' && !(v instanceof Date)) ? JSON.stringify(v) : (v === undefined ? null : v));
        }
    };
}

function register(Model, names) {
    let changed = false;
    const have = new Set(Object.keys(Model.rawAttributes).map(k => k.toLowerCase()));
    for (const n of names) {
        if (have.has(n.toLowerCase())) continue;
        Model.rawAttributes[n] = jsonAttr(n);
        have.add(n.toLowerCase());
        changed = true;
    }
    if (changed) Model.refreshAttributes();
    return changed;
}

async function describe(Model) {
    try { return await Model.sequelize.getQueryInterface().describeTable(Model.getTableName()); } catch (e) { return null; }
}

async function registerDbColumns(Model) {
    const cols = await describe(Model);
    if (!cols) return [];
    const extra = Object.keys(cols).filter(c => !Model.rawAttributes[c] && !Object.values(Model.rawAttributes).some(a => a.field === c));
    register(Model, extra);
    return extra;
}

// rows: one object or an array of objects (e.g. all invoices of a job)
async function ensureFieldColumns(Model, rows) {
    const list = (Array.isArray(rows) ? rows : [rows]).filter(r => r && typeof r === 'object');
    const wanted = new Set();
    for (const r of list) for (const [k, v] of Object.entries(r)) {
        if (v === undefined || typeof v === 'function' || NEVER.has(k) || !VALID.test(k)) continue;
        wanted.add(k);
    }
    const known = new Set(Object.keys(Model.rawAttributes).map(k => k.toLowerCase()));
    const missing = [...wanted].filter(k => !known.has(k.toLowerCase()));
    if (!missing.length) return [];
    const cols = (await describe(Model)) || {};
    const inDb = new Set(Object.keys(cols).map(k => k.toLowerCase()));
    const qi = Model.sequelize.getQueryInterface();
    const added = [];
    for (const k of missing) {
        if (!inDb.has(k.toLowerCase())) {
            try { await qi.addColumn(Model.getTableName(), k, { type: DataTypes.TEXT, allowNull: true }); added.push(k); inDb.add(k.toLowerCase()); }
            catch (e) { console.warn(`[DB] could not add column ${k}: ${e.message}`); continue; }
        }
    }
    register(Model, missing.filter(k => inDb.has(k.toLowerCase())));
    if (added.length) console.log(`[DB] ${Model.name}: new column(s) for form fields: ${added.join(', ')}`);
    return added;
}

module.exports = { ensureFieldColumns, registerDbColumns };
