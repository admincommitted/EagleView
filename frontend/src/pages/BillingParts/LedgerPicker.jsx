import { useMemo } from 'react';
import { SearchSelect } from '@/components/ui';
import { ledgerId } from './billingData';

/** A searchable ledger box; `getValue` picks what is stored (the id unless told otherwise). */
export default function LedgerPicker({ ledgers, value, onChange, getValue = ledgerId, showGroup = false, describe, ...props }) {
  const options = useMemo(
    () => ledgers.map((ledger) => ({
      value: String(getValue(ledger)),
      label: describe ? describe(ledger) : ledger.name,
      hint: showGroup ? ledger.group : undefined,
    })),
    [ledgers, getValue, showGroup, describe]
  );
  return <SearchSelect options={options} value={value} onValueChange={onChange} {...props} />;
}
