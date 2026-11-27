import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { ForbiddenError, NotFoundError } from '../../../core/http/index.js';
import { loadPerms } from '../../../middlewares/permissions.middleware.js';
import { effective } from '../../../utils/common/moduleCatalog.js';

const IMPORT_RIGHT = 'Bill of Entry (Import)';
const EXPORT_RIGHT = 'Shipping Bill (Export)';
const FULL_ACCESS = Object.freeze({ import: true, export: true });

const NO_RIGHT = {
  Import: 'You have no rights for Import (Bill of Entry) in EagleView',
  Export: 'You have no rights for Export (Shipping Bill) in EagleView',
};

export const selectRows = (sql, replacements = []) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

/** The EagleView user named in the signer's logs and notes. */
export const signerUserName = (user) => (user && (user.username || user.email)) || 'user';

/**
 * The divisions the user may handle (User Management view rights): Import = "Bill of Entry (Import)", Export =
 * "Shipping Bill (Export)". Admin, and a user with no rights saved yet (unrestricted, as everywhere in EagleView): both.
 */
export async function divisionAccess(user) {
  const currentUser = user || {};
  if (String(currentUser.role || '').toLowerCase() === 'admin') return { ...FULL_ACCESS };
  let permissions = null;
  try {
    permissions = await loadPerms(currentUser.id);
  } catch {
    permissions = {};
  }
  if (!permissions) return { ...FULL_ACCESS };
  const canView = (moduleName) => {
    const permission = effective(permissions, moduleName);
    return !!(permission && permission.canView);
  };
  return { import: canView(IMPORT_RIGHT), export: canView(EXPORT_RIGHT) };
}

const DIVISION_LOOKUPS = [
  { division: 'Import', sql: 'SELECT 1 FROM ImportJobs WHERE extendedData LIKE ? LIMIT 1' },
  { division: 'Import', sql: 'SELECT 1 FROM ImportItems WHERE extendedData LIKE ? LIMIT 1' },
  { division: 'Export', sql: 'SELECT 1 FROM ExportJobs WHERE eSanchitList LIKE ? LIMIT 1' },
  { division: 'Export', sql: 'SELECT 1 FROM ExportItems WHERE eSanchitList LIKE ? LIMIT 1' },
];

async function anyRowMatches(sql, pattern) {
  try {
    return (await selectRows(sql, [pattern])).length > 0;
  } catch {
    return false;
  }
}

/** The division of an archived e-Sanchit PDF: the job / item row that has it (or its signed copy). */
async function divisionOfArchivedPdf(folder, file) {
  const stem = String(file).replace(/(_signed)?\.pdf$/i, '');
  const pattern = `%esanchit_archive/${folder}/${stem}%`;
  for (const lookup of DIVISION_LOOKUPS) {
    if (await anyRowMatches(lookup.sql, pattern)) return lookup.division;
  }
  return '';
}

/** Refuses a PDF of a division the user has no rights for. */
export async function assertMayHandlePdf(user, folder, file) {
  const access = await divisionAccess(user);
  if (access.import && access.export) return;
  const division = await divisionOfArchivedPdf(folder, file);
  if (!division) throw new NotFoundError('This PDF is not on any job: ' + file);
  if (!access[division.toLowerCase()]) {
    throw new ForbiddenError(NO_RIGHT[division] + ' - this PDF is on an ' + division.toLowerCase() + ' job');
  }
}

/** Refuses the division (Import / Export) when the user has no rights for it. */
export async function assertDivisionRight(user, division, detail = '') {
  if (!(await divisionAccess(user))[division.toLowerCase()]) throw new ForbiddenError(NO_RIGHT[division] + detail);
}
