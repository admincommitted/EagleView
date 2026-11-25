import { Plus, Trash2 } from 'lucide-react';
import { Button, DataTable, Field, Input, NumberInput, SelectBox, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import Heading from './BookingHeading';

const SIZE_TYPES = [
  { value: '20GP', label: "20' GP" }, { value: '40GP', label: "40' GP" }, { value: '40HQ', label: "40' HQ" },
  { value: '20RF', label: "20' RF" }, { value: '40RF', label: "40' RF" }, { value: 'LCL', label: 'LCL' },
];

export default function BookingContainers({ containers, onAdd, onRemove, onChange }) {
  const canRemove = containers.length > 1;
  const numberCell = (key, placeholder) => (row) => <NumberInput value={row[key]} placeholder={placeholder} onValueChange={(value) => onChange(row.id, key, value)} />;

  const columns = [
    {
      key: 'containerNo',
      header: 'Container No.',
      cell: (row) => <Input data-allow-text value={row.containerNo} placeholder="ABCD1234567" onChange={(event) => onChange(row.id, 'containerNo', event.target.value.toUpperCase())} />,
    },
    { key: 'sealNo', header: 'Seal No.', cell: (row) => <Input data-allow-text value={row.sealNo} placeholder="SEAL-998" onChange={(event) => onChange(row.id, 'sealNo', event.target.value)} /> },
    { key: 'sizeType', header: 'Size/Type', cell: (row) => <SelectBox value={row.sizeType} onValueChange={(value) => onChange(row.id, 'sizeType', value)} options={SIZE_TYPES} /> },
    { key: 'weight', header: 'Gross Wt. (Kgs)', cell: numberCell('weight', 'Kgs') },
    { key: 'volume', header: 'Volume (CBM)', cell: numberCell('volume', 'CBM') },
    { key: 'pkgs', header: 'Pkgs', cell: numberCell('pkgs', 'Qty') },
    {
      key: 'remove',
      header: '',
      align: 'center',
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Remove container"
          title={canRemove ? 'Remove this line' : 'At least one line is needed'}
          className={cn(canRemove ? 'tw:text-destructive' : 'tw:cursor-not-allowed tw:text-input')}
          onClick={() => onRemove(row.id)}
        >
          <Trash2 className="tw:size-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <Heading className="tw:m-0 tw:border-0 tw:pb-0">Container & VGM Details</Heading>
        <Button onClick={onAdd}><Plus /> Add Container</Button>
      </div>
      <DataTable columns={columns} rows={containers} className="tw:min-w-[760px]" />

      <Heading className="tw:mt-4 tw:border-0 tw:pb-0">Cargo Description (As printed on B/L)</Heading>
      <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:md:grid-cols-[1fr_2fr]">
        <Field layout="col" label="Marks & Numbers"><Textarea rows={5} placeholder="e.g. As Addressed" /></Field>
        <Field layout="col" label="Description of Goods (Include HS Code)">
          <Textarea rows={5} placeholder="e.g. 500 Cartons of Cotton Garments. HS Code: 6205..." />
        </Field>
      </div>
    </div>
  );
}
