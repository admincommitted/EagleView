/**
 * Keeps form fields that have no column of their own.
 *
 * The Import / Export screens send many fields (autoField_*, CTX details, CHA details, scheme grids…)
 * that are not columns of the job / invoice / item tables. Sequelize silently drops such keys, so they
 * were lost on every save. packExtra() stores them as JSON in one TEXT column; unpackExtra() puts them
 * back on read. Real columns always win over the JSON. Added 28-Oct-2026.
 */
const NESTED = new Set(['invoices', 'Invoices', 'items', 'containers', 'Containers', 'docs', 'dbkItems', 'licenseItems', 'createdAt', 'updatedAt']); // saved in their own tables

function parse(v) {
    if (!v) return {};
    if (typeof v === 'object') return v;
    try { const o = JSON.parse(v); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; }
}

// Returns a copy of obj where every non-column key is moved into obj[col] (JSON string).
function packExtra(Model, obj, col, previous) {
    const attrs = Model.rawAttributes;
    const out = {};
    const extra = {};
    for (const [k, v] of Object.entries(obj || {})) {
        if (k === col) continue;
        // a nested list that is also a text column of this table (ExportJob.Containers - the SB Header container list)
        // is stored as JSON: passed through as a list, the save failed ("Containers cannot be an array"). 29-Oct-2026
        if (NESTED.has(k) && !attrs[k]) { out[k] = v; continue; }
        if (attrs[k]) {
            // arrays/objects sent for a text column (e.g. ExportJob.PackingDetails) made the save fail
            const tk = attrs[k].type && (attrs[k].type.key || (attrs[k].type.constructor && attrs[k].type.constructor.key));
            out[k] = (v && typeof v === 'object' && !(v instanceof Date) && ['STRING', 'TEXT', 'CHAR'].includes(tk)) ? JSON.stringify(v) : v;
            continue;
        }
        if (v === undefined || typeof v === 'function') continue;
        extra[k] = v;
    }
    const merged = { ...parse(previous), ...parse(obj && obj[col]), ...extra };
    for (const k of Object.keys(merged)) if (attrs[k]) delete merged[k]; // old JSON must never shadow a real column
    out[col] = Object.keys(merged).length ? JSON.stringify(merged) : null;
    return out;
}

// Plain object with the JSON column merged back in (columns win) and the JSON column removed.
function unpackExtra(row, col) {
    if (!row) return row;
    const data = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
    const ext = parse(data[col]);
    delete data[col];
    // a column wins, except when it is empty and the JSON still has the value (field moved to a column later)
    const out = { ...ext };
    for (const [k, v] of Object.entries(data)) if ((v !== null && v !== undefined) || !(k in ext)) out[k] = v;
    return out;
}

module.exports = { packExtra, unpackExtra };
