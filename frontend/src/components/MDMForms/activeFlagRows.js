import { useMemo } from 'react';

// rows saved before the switch-off column existed have no isActive: they count as on
const isSwitchedOn = (record) => !(record.isActive === false || record.isActive === 0);

// the master with isActive filled in on every row, so the kit's status / switch columns read them right
export function useActiveFlagRows(master) {
  const filtered = useMemo(() => master.filtered.map((record) => ({ ...record, isActive: isSwitchedOn(record) })), [master.filtered]);
  return { ...master, filtered };
}
