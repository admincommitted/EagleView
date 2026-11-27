import { MASTER_DEFINITIONS, ensureMasterTable, isNumericFieldType } from '../shared/masterDefinitions.service.js';
import { runSql, selectRows } from '../shared/hubQuery.service.js';
import { nowIso } from '../shared/hubFormat.service.js';
import { badRequest, notFound } from '../shared/hubHttp.js';

const isTrue = (value) => value === true || value === 1 || value === '1' || value === 'true';
const isFalse = (value) => value === false || value === 0 || value === '0';

function masterKindOf(kind) {
  const masterKind = String(kind || '').toLowerCase();
  if (!MASTER_DEFINITIONS[masterKind]) throw notFound('Unknown master');
  return masterKind;
}

function cleanFieldValue(type, value) {
  if (type === 'bool') return isTrue(value) ? 1 : 0;
  if (isNumericFieldType(type)) return value === '' || value == null ? null : Number(value);
  return value == null ? null : String(value).trim() || null;
}

/** The row to save: every field of the master cleaned to its type; a required field left empty is refused. */
function cleanMasterRow(master, body) {
  const row = {};
  for (const [key, label, type, required] of master.fields) {
    const value = cleanFieldValue(type, body[key]);
    if (required && (value == null || value === '')) throw badRequest(label + ' is required');
    row[key] = value;
  }
  if (body.isActive !== undefined) row.isActive = isFalse(body.isActive) ? 0 : 1;
  return row;
}

export const listMasterKinds = () =>
  Object.entries(MASTER_DEFINITIONS).map(([kind, master]) => ({ kind, title: master.title }));

export function describeMaster(kind) {
  const masterKind = masterKindOf(kind);
  const master = MASTER_DEFINITIONS[masterKind];
  return {
    kind: masterKind,
    title: master.title,
    fields: master.fields.map(([key, label, type, required]) => ({
      key,
      label,
      type: type.split(':')[0],
      options: type.includes(':') ? type.split(':')[1].split(',') : null,
      required: !!required,
    })),
  };
}

export async function listMasterRows(kind) {
  const master = await ensureMasterTable(masterKindOf(kind));
  return selectRows(`SELECT * FROM ${master.table} ORDER BY id DESC`);
}

export async function createMasterRow(kind, body) {
  const master = await ensureMasterTable(masterKindOf(kind));
  const row = cleanMasterRow(master, body);
  const stamp = nowIso();
  const keys = Object.keys(row);
  await runSql(
    `INSERT INTO ${master.table} (${keys.join(', ')}, createdAt, updatedAt) VALUES (${keys.map(() => '?').join(', ')}, ?, ?)`,
    [...keys.map((key) => row[key]), stamp, stamp],
  );
}

export async function updateMasterRow(kind, id, body) {
  const master = await ensureMasterTable(masterKindOf(kind));
  const row = cleanMasterRow(master, body);
  const keys = Object.keys(row);
  await runSql(`UPDATE ${master.table} SET ${keys.map((key) => key + ' = ?').join(', ')}, updatedAt = ? WHERE id = ?`, [
    ...keys.map((key) => row[key]),
    nowIso(),
    id,
  ]);
}

export async function deleteMasterRow(kind, id) {
  const master = await ensureMasterTable(masterKindOf(kind));
  await runSql(`DELETE FROM ${master.table} WHERE id = ?`, [id]);
}
