import toast from 'react-hot-toast';
import { AwbDrawer, LooseFields } from '../awbParts';
import { firstBranchOf } from '../awbFormat';

const NOTIFY_FIELDS = [
  { label: 'Notify Name', required: true, placeholder: 'Enter the Notify Name' },
  { label: 'Notify Code', required: true, className: 'tw:bg-muted' },
  { label: 'Address Line One', required: true, wide: true },
  { label: 'Account Number', wide: true },
  { label: 'Country', required: true, kind: 'select', placeholder: 'Select the Country' },
  { label: 'State' },
  { label: 'City', required: true, kind: 'select', placeholder: 'Select the City' },
  { label: 'Postal Code' },
  { label: 'Phone Number' },
  { label: 'Mobile Number' },
  { label: 'Fax Number' },
  { label: 'Email ID' },
  { label: 'Billing Address', kind: 'textarea', wide: true },
];

const AWB_DETAIL_FIELDS = [
  { label: 'Execution Date', kind: 'date', wide: true },
  { label: 'Execution Place', defaultValue: 'DELHI', wide: true },
  { label: 'Signature of Shipper', wide: true },
  { label: 'Signature of Issuing Carrier', wide: true },
  { label: 'Reference Number', wide: true },
  { label: 'Optional Shipping Info', kind: 'textarea', wide: true, className: 'tw:h-20' },
];

const IATA_AGENT_FIELDS = [
  { label: 'CASS Address', wide: true },
  { label: 'Agent Account No.', wide: true },
  { label: 'Customs Code', wide: true },
  { label: 'Commission %', wide: true },
  { label: 'TDS %', wide: true },
  { label: 'Remarks', kind: 'textarea', wide: true, className: 'tw:h-20' },
];

const REMARK_FIELDS = [
  { label: 'Shipment Remarks', kind: 'textarea', wide: true, className: 'tw:h-[100px]' },
  { label: 'Handling Instructions', kind: 'select', wide: true, placeholder: 'Select the pre-defined instructions' },
  { label: null, kind: 'textarea', wide: true, className: 'tw:h-[100px]', placeholder: 'Enter the Handling Instructions' },
];

// The drawers that keep what is typed only on screen; the confirm button just says so.
const INFO_DRAWERS = [
  { mode: 'notify', title: 'Notify Details', fields: NOTIFY_FIELDS, confirmLabel: 'Add', confirmed: 'Notify Details Added!' },
  { mode: 'awb', title: 'AWB Advanced Details', fields: AWB_DETAIL_FIELDS, confirmLabel: 'Save', confirmed: 'AWB Details Updated!', className: 'tw:sm:w-[500px]' },
  { mode: 'iataAgent', title: 'IATA Agent Details', fields: IATA_AGENT_FIELDS, confirmLabel: 'Save', confirmed: 'IATA Agent Info Updated!', className: 'tw:sm:w-[500px]' },
  { mode: 'remarks', title: 'Remarks/Handling Information', fields: REMARK_FIELDS, confirmLabel: 'Done', confirmed: 'Remarks Updated!' },
];

function partyFields(party) {
  const branch = firstBranchOf(party);
  return [
    { label: 'Address Line One', required: true, wide: true, defaultValue: branch.address1 || party.street || '' },
    { label: 'Address Line Two', wide: true, defaultValue: branch.address2 || '' },
    { label: 'Country', required: true, defaultValue: branch.country || party.countryCode || '' },
    { label: 'State', defaultValue: branch.state || party.stateProvince || '' },
    { label: 'City', required: true, defaultValue: branch.city || party.city || '' },
    { label: 'Postal Code', defaultValue: branch.pinCode || party.zipPostcode || '' },
    { label: 'Phone Number', defaultValue: branch.phone || party.phoneNumber || '' },
    { label: 'Mobile Number', defaultValue: branch.mobile || '' },
    { label: 'Fax Number', defaultValue: branch.fax || '' },
    { label: 'Email ID', defaultValue: branch.email1 || party.email || '' },
    { label: 'GSTIN Number', wide: true, defaultValue: branch.gstin || party.taxId || '' },
  ];
}

function PartyDrawer({ mode, party, onClose }) {
  const title = mode === 'shipper' ? 'Shipper Details' : 'Consignee Details';
  return (
    <AwbDrawer open title={title} onClose={onClose} confirmLabel="Update" onConfirm={() => { toast.success(`${title} Updated!`); onClose(); }}>
      <div className="tw:mb-5 tw:flex tw:items-center tw:gap-3">
        <div className="tw:rounded-sm tw:border tw:border-input tw:px-3 tw:py-2 tw:font-bold">{party.name.charAt(0).toUpperCase()}</div>
        <div className="tw:text-xs">
          <div className="tw:font-bold">{party.name}</div>
          <div className="tw:text-[11px] tw:text-primary">CODE: {party.code || 'N/A'}</div>
        </div>
      </div>
      <LooseFields key={mode} fields={partyFields(party)} />
    </AwbDrawer>
  );
}

export default function AwbDrawers({ ctx }) {
  const { drawer, closeDrawer, selectedShipper, selectedConsignee } = ctx;
  const party = drawer === 'shipper' ? selectedShipper : drawer === 'consignee' ? selectedConsignee : null;
  return (
    <>
      {party && <PartyDrawer mode={drawer} party={party} onClose={closeDrawer} />}
      {INFO_DRAWERS.map((info) => (
        <AwbDrawer
          key={info.mode}
          open={drawer === info.mode}
          title={info.title}
          className={info.className}
          onClose={closeDrawer}
          confirmLabel={info.confirmLabel}
          onConfirm={() => { toast.success(info.confirmed); closeDrawer(); }}
        >
          <LooseFields fields={info.fields} />
        </AwbDrawer>
      ))}
    </>
  );
}
