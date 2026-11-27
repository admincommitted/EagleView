import { runSql, selectRows, selectRowsOrEmpty } from '../shared/hubQuery.service.js';
import { nowIso, round2, todayIso } from '../shared/hubFormat.service.js';
import { loadGroupTree } from '../shared/groupTree.service.js';
import { NO_MOVEMENT, ledgerMovements, signedOpening } from '../shared/ledgerMovements.service.js';
import { badRequest, notFound } from '../shared/hubHttp.js';

const NATURES = ['Assets', 'Liabilities', 'Income', 'Expenses'];

/** Closing balance and number of ledgers posted directly under each group. */
async function balancesByGroup() {
  const ledgers = await selectRows('SELECT id, groupId, openingBalance, balanceType FROM AccountLedgers');
  const movements = await ledgerMovements(null, todayIso());
  const ownBalance = new Map();
  const ledgerCount = new Map();
  for (const ledger of ledgers) {
    const movement = movements.get(ledger.id) || NO_MOVEMENT;
    ownBalance.set(
      ledger.groupId,
      round2((ownBalance.get(ledger.groupId) || 0) + signedOpening(ledger) + movement.dr - movement.cr),
    );
    ledgerCount.set(ledger.groupId, (ledgerCount.get(ledger.groupId) || 0) + 1);
  }
  return { ownBalance, ledgerCount };
}

/** Groups with parent, nature, number of sub-groups / ledgers and the closing balance of the whole branch. */
export async function listGroupTree() {
  const { groups, descendants } = await loadGroupTree();
  const { ownBalance, ledgerCount } = await balancesByGroup();
  const builtInFlags = await selectRowsOrEmpty('SELECT id, isBuiltIn FROM AccountGroups');
  const isBuiltIn = new Map(builtInFlags.map((group) => [group.id, group.isBuiltIn]));
  return groups
    .map((group) => {
      let balance = 0;
      let ledgers = 0;
      descendants([group.id]).forEach((id) => {
        balance += ownBalance.get(id) || 0;
        ledgers += ledgerCount.get(id) || 0;
      });
      return {
        ...group,
        isBuiltIn: !!isBuiltIn.get(group.id),
        subGroups: groups.filter((child) => child.parentId === group.id).length,
        ownLedgers: ledgerCount.get(group.id) || 0,
        ledgers,
        balance: round2(balance),
      };
    })
    .sort((first, second) => first.name.localeCompare(second.name));
}

const groupById = async (id) => (await selectRows('SELECT * FROM AccountGroups WHERE id = ?', [id]))[0];

export async function createGroup(body) {
  const name = String(body.name || '').trim();
  const parentId = body.parentId ? Number(body.parentId) : null;
  if ((await selectRows('SELECT id FROM AccountGroups WHERE lower(trim(name)) = lower(?)', [name])).length)
    throw badRequest('A group with this name already exists');
  let { nature } = body;
  if (parentId) {
    const parent = (await selectRows('SELECT nature FROM AccountGroups WHERE id = ?', [parentId]))[0];
    if (!parent) throw badRequest('Under group not found');
    nature = parent.nature;
  }
  if (!NATURES.includes(nature)) throw badRequest('Choose the nature (Assets, Liabilities, Income or Expenses)');
  const stamp = nowIso();
  await runSql(
    'INSERT INTO AccountGroups (name, parentId, nature, isBuiltIn, createdAt, updatedAt) VALUES (?,?,?,0,?,?)',
    [name, parentId, nature, stamp, stamp],
  );
  return (await selectRows('SELECT * FROM AccountGroups WHERE name = ?', [name]))[0];
}

// a group under another one takes its parent's nature, and its own sub-groups follow
export async function updateGroup(id, body) {
  const group = await groupById(id);
  if (!group) throw notFound('Group not found');
  const name = String(body.name || group.name).trim();
  const parentId = body.parentId ? Number(body.parentId) : null;
  if (
    (await selectRows('SELECT id FROM AccountGroups WHERE lower(trim(name)) = lower(?) AND id <> ?', [name, id])).length
  )
    throw badRequest('A group with this name already exists');
  const { descendants } = await loadGroupTree();
  if (parentId && descendants([id]).has(parentId))
    throw badRequest('A group cannot be placed under itself or its own sub-group');
  let nature = body.nature || group.nature;
  if (parentId)
    nature =
      ((await selectRows('SELECT nature FROM AccountGroups WHERE id = ?', [parentId]))[0] || {}).nature || nature;
  if (group.isBuiltIn && (parentId || null) !== (group.parentId || null))
    throw badRequest('A built-in group cannot be moved');
  await runSql('UPDATE AccountGroups SET name = ?, parentId = ?, nature = ?, updatedAt = ? WHERE id = ?', [
    name,
    parentId,
    nature,
    nowIso(),
    id,
  ]);
  const subGroupIds = [...descendants([id])].filter((groupId) => groupId !== id);
  if (subGroupIds.length)
    await runSql(`UPDATE AccountGroups SET nature = ? WHERE id IN (${subGroupIds.join(',')})`, [nature]);
}

export async function deleteGroup(id) {
  const group = await groupById(id);
  if (!group) throw notFound('Group not found');
  if (group.isBuiltIn) throw badRequest('Built-in groups cannot be deleted');
  if ((await selectRows('SELECT count(*) n FROM AccountGroups WHERE parentId = ?', [id]))[0].n)
    throw badRequest('Move or delete its sub-groups first');
  if ((await selectRows('SELECT count(*) n FROM AccountLedgers WHERE groupId = ?', [id]))[0].n)
    throw badRequest('Move its ledgers to another group first');
  await runSql('DELETE FROM AccountGroups WHERE id = ?', [id]);
}
