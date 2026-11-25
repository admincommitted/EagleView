import { Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Badge, Field, Input } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { activeColumn, masterActionsColumn } from './masterKit/masterColumns';
import { useMasterRecords } from './masterKit/useMasterRecords';
import { useActiveFlagRows } from './activeFlagRows';

const EMPTY_WAREHOUSE = { id: '', warehouseCode: '', warehouseName: '', linkedPortCode: '', address: '', capacity: '', city: '', state: '', country: 'IN', phone: '', contactPerson: '' };
const LIST_PARAMS = { all: 1 };
const SEARCH_FIELDS = ['warehouseName', 'warehouseCode'];

const FIELD_ROWS = [
  {
    className: 'tw:md:grid-cols-[1.5fr_2fr_1fr]',
    fields: [
      { key: 'warehouseCode', label: 'Customs Warehouse Code', placeholder: '8-digit code', maxLength: 8 },
      { key: 'warehouseName', label: 'Warehouse Name', placeholder: 'Full registered name' },
      { key: 'linkedPortCode', label: 'Linked Port Code', placeholder: 'e.g. INNSA1', maxLength: 6 },
    ],
  },
  { fields: [{ key: 'address', label: 'Address', placeholder: 'Complete address of the warehouse' }] },
  {
    className: 'tw:md:grid-cols-3',
    fields: [
      { key: 'city', label: 'City', placeholder: 'City' },
      { key: 'state', label: 'State', placeholder: 'State' },
      { key: 'country', label: 'Country', placeholder: 'IN', maxLength: 2, fallback: 'IN' },
    ],
  },
  {
    className: 'tw:md:grid-cols-3',
    fields: [
      { key: 'capacity', label: 'Capacity (SQ.FT / CBM)', placeholder: 'e.g. 5000 SQ.FT' },
      { key: 'phone', label: 'Phone', placeholder: 'Phone / Mobile', keepCase: true },
      { key: 'contactPerson', label: 'Contact Person', placeholder: 'Contact name' },
    ],
  },
];

const validateWarehouse = (warehouse) => (!warehouse.warehouseCode || !warehouse.warehouseName || !warehouse.linkedPortCode
  ? 'Please fill all required fields (Code, Name, Linked Port).'
  : '');

const LIST = {
  title: 'Search',
  searchPlaceholder: 'SEARCH...',
  primaryText: (warehouse) => warehouse.warehouseName,
  secondaryText: (warehouse) => warehouse.warehouseCode,
};

export default function WarehouseMasterForm() {
  const records = useActiveFlagRows(useMasterRecords({
    resource: 'warehouses',
    emptyRecord: EMPTY_WAREHOUSE,
    listParams: LIST_PARAMS,
    searchFields: SEARCH_FIELDS,
    validate: validateWarehouse,
    describe: (warehouse) => `warehouse ${warehouse.warehouseCode || ''} ${warehouse.warehouseName || ''}`,
  }));
  const { form, setField } = records;

  const save = async () => {
    const wasEdit = Boolean(form.id);
    if (await records.save()) toast.success(wasEdit ? 'Warehouse updated successfully!' : 'New Warehouse added successfully!');
  };
  const master = { ...records, save };

  const columns = [
    { key: 'warehouseCode', header: 'Warehouse Code', cell: (warehouse) => <Badge variant="warning">{warehouse.warehouseCode}</Badge> },
    { key: 'warehouseName', header: 'Warehouse Name', className: 'tw:font-medium' },
    { key: 'linkedPortCode', header: 'Linked Port', align: 'center', cell: (warehouse) => <Badge variant="info">{warehouse.linkedPortCode}</Badge> },
    { key: 'address', header: 'Address', className: 'tw:whitespace-normal', cell: (warehouse) => warehouse.address || '-' },
    activeColumn,
    masterActionsColumn({ onEdit: records.editRecord, onSwitch: records.switchActive }),
  ];

  return (
    <MasterPage master={master} list={LIST} icon={Building2} formTitle="Add Customs Warehouse" columns={columns}>
      <div className="tw:flex tw:flex-col tw:gap-4">
        {FIELD_ROWS.map((row) => (
          <div key={row.fields[0].key} className={cn('tw:grid tw:grid-cols-1 tw:gap-2', row.className)}>
            {row.fields.map((field) => (
              <Field key={field.key} label={field.label} layout="col">
                <Input placeholder={field.placeholder} maxLength={field.maxLength} data-allow-text="" className={field.keepCase ? undefined : 'tw:uppercase'}
                  value={form[field.key] || field.fallback || ''}
                  onChange={(event) => setField(field.key)(field.keepCase ? event.target.value : event.target.value.toUpperCase())} />
              </Field>
            ))}
          </div>
        ))}
      </div>
    </MasterPage>
  );
}
