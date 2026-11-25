import { Checkbox } from '@/components/ui';

// a tick column for a module Grid: label = tick all shown rows
export const tickColumn = ({ rows, picked, setPicked, keyOf }) => ({
  label: (
    <Checkbox aria-label="Tick all" checked={rows.length > 0 && rows.every((row) => picked[keyOf(row)])}
      onCheckedChange={(checked) => setPicked(checked === true ? Object.fromEntries(rows.map((row) => [keyOf(row), 1])) : {})} />
  ),
  w: 30,
  render: (row) => (
    <Checkbox aria-label="Tick row" checked={!!picked[keyOf(row)]}
      onCheckedChange={(checked) => setPicked((current) => ({ ...current, [keyOf(row)]: checked === true ? 1 : 0 }))} />
  ),
});
