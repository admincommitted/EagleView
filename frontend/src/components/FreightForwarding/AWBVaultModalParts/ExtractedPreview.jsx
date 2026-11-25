import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, DataTable, Modal } from '@/components/ui';

const PARTY_ROLES = [
  { role: 'Shipper', field: 'shipper' },
  { role: 'Consignee', field: 'consignee' },
  { role: 'Buyer', field: 'buyer' },
];

const DIMENSION_COLUMNS = ['pieces', 'length', 'width', 'height', 'unit'].map((key) => ({ key, header: key[0].toUpperCase() + key.slice(1) }));

const FULL_WIDTH_KEYS = ['commodityDescription', 'marksAndNumbers'];
const isFullWidth = (key) => key.includes('Address') || FULL_WIDTH_KEYS.includes(key);
const fieldTitle = (key) => key.replace(/([A-Z])/g, ' $1').trim();

const partyDetails = (data, field) => ({
  name: data[`${field}Name`],
  address: data[`${field}Address`],
  city: data[`${field}City`],
  state: data[`${field}State`],
  country: data[`${field}Country`],
  zip: data[`${field}Zip`],
});

function PartyCheck({ role, field, data, mdmStatus, onRequestAddParty }) {
  let status;
  if (!mdmStatus[`${field}Exists`]) {
    status = <Button size="sm" variant="destructive" className="tw:text-[10px] tw:font-bold" onClick={() => onRequestAddParty?.(role, partyDetails(data, field))}>[+] ADD TO MASTER</Button>;
  } else if (mdmStatus[`${field}AddressMatch`]) {
    status = <span className="tw:font-bold tw:text-success">✓ Verified in Master</span>;
  } else {
    status = <span className="tw:font-bold tw:text-warning" title={`DB: ${mdmStatus[`db${role}Address`]}`}>⚠ Address Mismatch</span>;
  }
  return (
    <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:text-entry">
      <div><b>{role}:</b> {data[`${field}Name`]}</div>
      {status}
    </div>
  );
}

function ExtractedField({ name, value }) {
  if (name === 'dimensions' && Array.isArray(value)) {
    return (
      <div className="tw:col-span-full tw:border-b tw:border-border tw:pb-1">
        <span className="tw:mb-1 tw:block tw:text-[10px] tw:font-bold tw:text-muted-foreground tw:uppercase">DIMENSIONS (L x W x H)</span>
        {value.length > 0
          ? <DataTable columns={DIMENSION_COLUMNS} rows={value} rowKey={(row, index) => index} stickyHeader={false} />
          : <span className="tw:text-entry tw:text-muted-foreground">No Dimensions Found</span>}
      </div>
    );
  }
  return (
    <div className={cn('tw:flex tw:flex-col tw:border-b tw:border-border tw:pb-1', isFullWidth(name) && 'tw:col-span-full')}>
      <span className="tw:text-[10px] tw:font-bold tw:text-muted-foreground tw:uppercase">{fieldTitle(name)}</span>
      <span className={cn('tw:text-[13px] tw:font-medium tw:break-words', value ? 'tw:text-foreground' : 'tw:text-muted-foreground')}>{value || 'Not Found'}</span>
    </div>
  );
}

export default function ExtractedPreview({ data, mdmStatus, onApply, onCancel, onRequestAddParty }) {
  const partiesFound = PARTY_ROLES.filter((party) => data[`${party.field}Name`]);

  return (
    <Modal
      open
      onClose={onCancel}
      width={700}
      title={<span className="tw:flex tw:items-center tw:gap-2"><Zap className="tw:size-5 tw:text-warning" /> AI Extracted Data Preview</span>}
      footer={(
        <>
          <Button size="lg" variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button size="lg" variant="success" onClick={onApply}>Apply to Form</Button>
        </>
      )}
      bodyClassName="tw:gap-3 tw:normal-case"
    >
      {mdmStatus && (
        <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-md tw:border tw:border-border tw:bg-secondary tw:p-3">
          <h4 className="tw:m-0 tw:text-entry tw:text-foreground">MDM Party Validation</h4>
          {partiesFound.map((party) => (
            <PartyCheck key={party.role} {...party} data={data} mdmStatus={mdmStatus} onRequestAddParty={onRequestAddParty} />
          ))}
        </div>
      )}
      <div className="tw:grid tw:max-h-[450px] tw:grid-cols-1 tw:gap-4 tw:overflow-y-auto tw:rounded-md tw:border tw:border-border tw:bg-page tw:p-4 tw:text-entry tw:sm:grid-cols-2">
        {Object.keys(data).map((name) => <ExtractedField key={name} name={name} value={data[name]} />)}
      </div>
    </Modal>
  );
}
