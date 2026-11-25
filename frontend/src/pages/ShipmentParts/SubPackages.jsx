import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, NumberInput } from '@/components/ui';
import { cn } from '@/lib/utils';
import { GridField, RemovableChip } from './layout';
import { MasterLookup } from './MasterLookup';
import { toNumber } from './shipmentForm';

// package break-up, e.g. 10 CTN + 2 PLT; the total fills No. Of Pkgs
export default function SubPackages({ rows, total, onChange, onClose }) {
  const [draft, setDraft] = useState({ pkgs: '', unit: '' });
  const sum = rows.reduce((runningTotal, row) => runningTotal + toNumber(row.pkgs), 0);
  const mismatch = rows.length && toNumber(total) && sum !== toNumber(total);

  const add = () => {
    if (!(toNumber(draft.pkgs) > 0) || !draft.unit) return;
    onChange([...rows, draft]);
    setDraft({ pkgs: '', unit: '' });
  };

  return (
    <div className="tw:flex tw:flex-wrap tw:items-end tw:gap-1.5 tw:rounded-md tw:border tw:border-dashed tw:border-primary/30 tw:bg-primary/5 tw:p-1.5">
      <b className="tw:self-center tw:text-[11px]">Sub Pkgs</b>
      <GridField label="Pkgs" className="tw:w-20"><NumberInput value={draft.pkgs} onValueChange={(pkgs) => setDraft({ ...draft, pkgs })} /></GridField>
      <GridField label="Unit (UQC)" className="tw:w-[150px]">
        <MasterLookup what="uqc" value={draft.unit} upper noAdd onText={(unit) => setDraft({ ...draft, unit })} onPick={(unit) => setDraft({ ...draft, unit: unit.code })} />
      </GridField>
      <Button size="sm" variant="default" onClick={add}><Plus className="tw:size-3" /> Add</Button>
      {rows.map((row, index) => (
        <RemovableChip key={index} onRemove={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>{row.pkgs} {row.unit}</RemovableChip>
      ))}
      <span className={cn('tw:self-center tw:text-[11px]', mismatch ? 'tw:text-destructive' : 'tw:text-muted-foreground')}>
        {rows.length ? 'Total ' + sum + ' pkgs (fills No. Of Pkgs)' : 'Break-up of the packages'}
      </span>
      <X role="button" aria-label="Close" className="tw:ml-auto tw:size-3 tw:cursor-pointer tw:self-center" onClick={onClose} />
    </div>
  );
}
