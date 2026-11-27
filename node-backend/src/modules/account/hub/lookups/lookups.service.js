import { selectRows } from '../shared/hubQuery.service.js';
import { ensureLedgerColumns } from '../shared/ledgerColumns.service.js';
import { ensureMasterTable } from '../shared/masterDefinitions.service.js';

// a blacklisted / inactive ledger shows it in front of its group name in every picker
export async function listLedgerChoices() {
  await ensureLedgerColumns();
  return selectRows(`SELECT l.id, l.name, l.groupId, (CASE WHEN coalesce(l.isBlacklisted, 0) = 1 THEN 'BLACKLISTED - ' WHEN coalesce(l.isActive, 1) = 0 THEN 'INACTIVE - ' ELSE '' END) || coalesce(g.name, '') groupName,
      coalesce(l.isBlacklisted, 0) isBlacklisted, coalesce(l.isActive, 1) isActive FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId ORDER BY l.name`);
}

export const listGroupChoices = () => selectRows('SELECT id, name, parentId, nature FROM AccountGroups ORDER BY name');

export const listTdsNatureChoices = () =>
  selectRows('SELECT id, name, section, rate FROM TdsNatures ORDER BY section, name');

export const listCostCentreChoices = () => selectRows('SELECT id, name FROM CostCentres ORDER BY name');

export async function listSacChoices() {
  await ensureMasterTable('sac');
  return selectRows('SELECT code, description, gstRate FROM AccSacCodes WHERE isActive = 1 ORDER BY code');
}

export const listFinancialYearChoices = () =>
  selectRows(
    'SELECT id, code, name, startDate, endDate, isDefault FROM FinancialYears WHERE coalesce(isDeleted, 0) = 0 ORDER BY startDate DESC',
  );
