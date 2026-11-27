import { selectRows } from './hubQuery.service.js';

const MAX_GROUP_DEPTH = 20;

/**
 * Every account group with helpers:
 *   path(groupId)          names from the top group down to this one
 *   descendants(rootIds)   Set of the root ids and every group under them
 */
export async function loadGroupTree() {
  const groups = await selectRows('SELECT id, name, parentId, nature FROM AccountGroups');
  const byId = new Map(groups.map((group) => [group.id, group]));
  const path = (groupId) => {
    const names = [];
    let group = byId.get(groupId);
    let depth = 0;
    while (group && depth++ < MAX_GROUP_DEPTH) {
      names.unshift(group.name);
      group = byId.get(group.parentId);
    }
    return names;
  };
  const descendants = (rootIds) => {
    const found = new Set(rootIds);
    let grew = true;
    while (grew) {
      grew = false;
      for (const group of groups) {
        if (group.parentId && found.has(group.parentId) && !found.has(group.id)) {
          found.add(group.id);
          grew = true;
        }
      }
    }
    return found;
  };
  return { groups, byId, path, descendants };
}

/** Group name compared case- and space-insensitively ("Sundry  Debtors" = "sundry debtors"). */
export const normalisedGroupName = (name) => name.toLowerCase().replace(/\s+/g, ' ').trim();

export const groupIdsNamed = (groups, name) =>
  groups.filter((group) => normalisedGroupName(group.name) === name).map((group) => group.id);

/** Top groups of a nature (Assets / Liabilities / Income / Expenses) and every group under them. */
export const natureGroupIds = ({ groups, descendants }, nature) =>
  descendants(groups.filter((group) => group.nature === nature && !group.parentId).map((group) => group.id));
