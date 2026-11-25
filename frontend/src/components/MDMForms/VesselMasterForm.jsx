import { Ship } from 'lucide-react';
import { Badge, Field, Input } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { activeColumn, masterActionsColumn } from './masterKit/masterColumns';
import { useMasterRecords } from './masterKit/useMasterRecords';
import { useActiveFlagRows } from './activeFlagRows';
import { LogoUploadButton } from './masterFormExtras';

const EMPTY_VESSEL = { id: '', vesselName: '', imoNumber: '', callSign: '', carrierAgent: '' };
const LIST_PARAMS = { all: 1 };
const SEARCH_FIELDS = ['vesselName', 'imoNumber'];

const CARRIER_LOGOS = [
  ['MSC', 'msc.com'],
  ['MAERSK', 'maersk.com'],
  ['CMA', 'cma-cgm.com'],
  ['EVERGREEN', 'evergreen-line.com'],
  ['HMM', 'hmm21.com'],
  ['OOCL', 'oocl.com'],
  ['COSCO', 'coscoshipping.com'],
  ['ONE', 'one-line.com'],
  ['HAPAG', 'hapag-lloyd.com'],
  ['ZIM', 'zim.com'],
];

const carrierLogoUrl = (carrierAgent) => {
  const name = String(carrierAgent || '').toUpperCase();
  const match = name && CARRIER_LOGOS.find(([carrier]) => name.includes(carrier));
  return match ? `https://logo.clearbit.com/${match[1]}` : null;
};

const TEXT_FIELDS = [
  { key: 'vesselName', label: 'Vessel Name', placeholder: 'Full Vessel Name' },
  { key: 'imoNumber', label: 'IMO Number', placeholder: 'e.g. 9777204' },
  { key: 'callSign', label: 'Call Sign', placeholder: 'Radio Call Sign' },
  { key: 'carrierAgent', label: 'Carrier Agent', placeholder: 'Shipping Line (e.g. MSC)' },
];

const validateVessel = (vessel) => {
  if (!vessel.vesselName || !vessel.imoNumber) return 'Please fill the required fields (*)';
  const imoNumber = String(vessel.imoNumber).trim();
  if (/^\d+$/.test(imoNumber) && imoNumber.length !== 7) return 'IMO number must be 7 digits';
  return '';
};

const LIST = {
  title: 'Search',
  searchPlaceholder: 'SEARCH...',
  primaryText: (vessel) => vessel.vesselName,
  secondaryText: (vessel) => `IMO: ${vessel.imoNumber || ''}`,
};

function CarrierCell({ vessel }) {
  const logo = vessel.customLogo || carrierLogoUrl(vessel.carrierAgent);
  return (
    <span className="tw:flex tw:items-center tw:gap-2 tw:font-semibold">
      {logo && <img src={logo} alt="logo" className="tw:h-4 tw:w-7 tw:object-contain" onError={(event) => { event.currentTarget.hidden = true; }} />}
      {vessel.carrierAgent}
    </span>
  );
}

export default function VesselMasterForm() {
  const master = useActiveFlagRows(useMasterRecords({
    resource: 'vessels',
    emptyRecord: EMPTY_VESSEL,
    listParams: LIST_PARAMS,
    searchFields: SEARCH_FIELDS,
    validate: validateVessel,
    describe: (vessel) => `vessel / flight ${vessel.vesselName || ''}`,
  }));
  const { form, setField } = master;

  const columns = [
    { key: 'vesselName', header: 'Vessel Name', className: 'tw:font-semibold' },
    { key: 'imoNumber', header: 'IMO Number', cell: (vessel) => <Badge variant="success">{vessel.imoNumber}</Badge> },
    { key: 'callSign', header: 'Call Sign', cell: (vessel) => vessel.callSign && <Badge variant="info">{vessel.callSign}</Badge> },
    { key: 'carrierAgent', header: 'Carrier Agent', cell: (vessel) => <CarrierCell vessel={vessel} /> },
    activeColumn,
    masterActionsColumn({ onEdit: master.editRecord, onSwitch: master.switchActive }),
  ];

  return (
    <MasterPage master={master} list={LIST} icon={Ship} formTitle="Add Vessel (Sea Operations)" columns={columns}>
      <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-[2fr_1fr_1fr_1.5fr_1fr]">
        {TEXT_FIELDS.map((field) => (
          <Field key={field.key} label={field.label} layout="col">
            <Input placeholder={field.placeholder} data-allow-text="" value={form[field.key] || ''}
              onChange={(event) => setField(field.key)(event.target.value.toUpperCase())} />
          </Field>
        ))}
        <Field label="Custom Logo" layout="col">
          <LogoUploadButton onLogo={setField('customLogo')}>{form.customLogo ? 'Change logo' : 'Choose image'}</LogoUploadButton>
        </Field>
      </div>
    </MasterPage>
  );
}
