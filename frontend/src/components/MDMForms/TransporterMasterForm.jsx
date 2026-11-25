import { Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Field, Input } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { activeColumn, masterActionsColumn } from './masterKit/masterColumns';
import { useMasterRecords } from './masterKit/useMasterRecords';
import { useActiveFlagRows } from './activeFlagRows';

const EMPTY_TRANSPORTER = { id: '', transporterName: '', gstin: '', vehicleType: '' };
const LIST_PARAMS = { all: 1 };
const SEARCH_FIELDS = ['transporterName', 'gstin'];

const validateTransporter = (transporter) => (!transporter.transporterName || !transporter.gstin ? 'Transporter Name and GSTIN are required!' : '');
const withoutEmptyId = ({ id, ...transporter }) => (id ? { id, ...transporter } : transporter);

const LIST = {
  title: 'Search',
  searchPlaceholder: 'SEARCH...',
  primaryText: (transporter) => transporter.transporterName,
  secondaryText: (transporter) => <span className="tw:font-mono">{transporter.gstin}</span>,
};

export default function TransporterMasterForm() {
  const records = useActiveFlagRows(useMasterRecords({
    resource: 'transporters',
    emptyRecord: EMPTY_TRANSPORTER,
    listParams: LIST_PARAMS,
    searchFields: SEARCH_FIELDS,
    validate: validateTransporter,
    describe: (transporter) => `transporter ${transporter.transporterName || ''}`,
    prepareSave: withoutEmptyId,
  }));
  const { form, setField } = records;

  const save = async () => {
    if (await records.save()) toast.success('Saved successfully!');
  };
  const master = { ...records, save };

  const columns = [
    { key: 'transporterName', header: 'Transporter Name', className: 'tw:font-semibold' },
    { key: 'gstin', header: 'GSTIN', className: 'tw:font-mono' },
    { key: 'vehicleType', header: 'Vehicle Type' },
    activeColumn,
    masterActionsColumn({ onEdit: records.editRecord, onSwitch: records.switchActive }),
  ];

  return (
    <MasterPage master={master} list={LIST} icon={Truck} formTitle={`${form.id ? 'Edit' : 'Add'} Transporter (e-Way Bill)`} columns={columns}>
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-[2fr_1fr_1fr]">
        <Field label="Transporter Name" layout="col">
          <Input placeholder="Full registered name" data-allow-text="" value={form.transporterName}
            onChange={(event) => setField('transporterName')(event.target.value)} />
        </Field>
        <Field label="GSTIN" layout="col">
          <Input placeholder="15-digit GSTIN" maxLength={15} data-allow-text="" value={form.gstin}
            onChange={(event) => setField('gstin')(event.target.value)} />
        </Field>
        <Field label="Vehicle Type" layout="col">
          <Input placeholder="Trailer, LCV, etc." data-allow-text="" value={form.vehicleType || ''}
            onChange={(event) => setField('vehicleType')(event.target.value)} />
        </Field>
      </div>
    </MasterPage>
  );
}
