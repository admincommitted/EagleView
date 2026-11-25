import { PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Checkbox, DataTable, Field, Input, SelectBox } from '@/components/ui';
import { CTX_TYPES } from '../partyMasterData';
import { CheckField, PanelCard } from './formBits';

// ICEGATE takes 35 characters per address line and city
const ICEGATE_LINE = 35;
const FIELD_GRID = 'tw:grid tw:grid-cols-1 tw:items-center tw:gap-x-4 tw:gap-y-1 tw:md:grid-cols-3';

const textColumn = (key, header, read = (address) => address[key], className) => ({ key, header, className, cell: read });
const flagColumn = (key, header) => ({
  key, header, align: 'center',
  cell: (address) => <Checkbox checked={Boolean(address[key])} disabled />,
});

const ADDRESS_COLUMNS = [
  textColumn('branchName', 'Branch Name', (address) => address.branchName || address.branch, 'tw:font-medium'),
  textColumn('address1', 'Address1', (address) => address.address1 || address.address, 'tw:min-w-[200px] tw:whitespace-normal'),
  textColumn('address2', 'Address2'),
  textColumn('city', 'City'),
  textColumn('pinCode', 'Pin Code', (address) => address.pinCode || address.zip),
  textColumn('state', 'State'),
  textColumn('country', 'Country'),
  textColumn('ctxType', 'CTX Type'),
  textColumn('ctxState', 'CTX State'),
  textColumn('regNo', 'Reg. No', (address) => address.regNo || address.gstin),
  textColumn('phone', 'Phone'),
  textColumn('mobile', 'Mobile'),
  textColumn('fax', 'Fax'),
  textColumn('email1', 'Email1'),
  textColumn('email2', 'Email2'),
  textColumn('website', 'Website'),
  textColumn('tanNo', 'TAN No'),
  textColumn('unlocCity', 'UNLOC City'),
  flagColumn('disabled', 'Disabled'),
  flagColumn('sez', 'SEZ'),
  flagColumn('gstExempted', 'GST Exempted'),
  textColumn('sezWarehouseCode', 'SEZ Warehouse Code'),
];

export default function PartyAddressSection({ ctx }) {
  const {
    addressFormData, setAddressField, setAddressCountry, setAddressCtxState, setAddressPin, isIndia, statesOf,
    isEditingAddress, editAddress, saveAddress, deleteAddress, makeDefaultAddress, selectedParty, globalLocations,
  } = ctx;
  const addresses = selectedParty?.addresses || [];
  const stateOptions = [...new Set(statesOf(addressFormData.country).map((state) => state.stateName).filter(Boolean))];
  const countryOptions = globalLocations.map((location) => ({ value: location.code, label: `${location.code} - ${location.name}` }));

  const textField = (field, label, placeholder, { labelWidth = '80px', required, limitToLine, value, onChange, after, ...input } = {}) => {
    const text = value ?? addressFormData[field] ?? '';
    const atLimit = limitToLine && text.length >= ICEGATE_LINE;
    return (
      <Field label={label} required={required} labelWidth={labelWidth}>
        <Input data-allow-text="" required={required} placeholder={placeholder} value={text}
          maxLength={limitToLine ? ICEGATE_LINE : undefined} title={atLimit ? 'Max 35 characters reached!' : undefined}
          className={cn(atLimit && 'tw:ring-2 tw:ring-destructive/50')}
          onChange={(event) => (onChange ? onChange(event.target.value) : setAddressField(field, event.target.value))} {...input} />
        {after}
      </Field>
    );
  };
  const flagField = (field, label) => (
    <CheckField label={label} labelFirst checked={addressFormData[field]} onCheckedChange={(checked) => setAddressField(field, checked)} />
  );

  const columns = [
    { key: 'edit', header: 'Edit', cell: (address) => <Button variant="link" size="sm" onClick={() => editAddress(address)}>Edit</Button> },
    { key: 'delete', header: 'Delete', cell: (_, index) => <Button variant="link" size="sm" className="tw:text-destructive" onClick={() => deleteAddress(index)}>Delete</Button> },
    { key: 'branchSrNo', header: 'Sr. No', align: 'center', className: 'tw:font-semibold tw:text-primary' },
    {
      key: 'default', header: 'Default', align: 'center',
      cell: (address, index) => <Checkbox aria-label="Default address" checked={Boolean(address.default)} onCheckedChange={(checked) => checked === true && makeDefaultAddress(index)} />,
    },
    ...ADDRESS_COLUMNS,
  ];

  return (
    <PanelCard title="Party Address" className="tw:min-h-[450px] tw:flex-1" bodyClassName="tw:flex-1">
      <div className={FIELD_GRID}>
        <Field label="Sr. No / Def." labelWidth="80px" labelClassName="tw:font-bold">
          <Input required data-allow-text="" placeholder="SR. NO" className="tw:w-[60px]" value={addressFormData.branchSrNo || ''}
            onChange={(event) => setAddressField('branchSrNo', event.target.value)} />
          <CheckField label="Default" labelFirst className="tw:ml-auto tw:font-bold" checked={addressFormData.default} onCheckedChange={(checked) => setAddressField('default', checked)} />
        </Field>
        {textField('branchName', 'Branch Name', 'BRANCH NAME', { value: addressFormData.branchName || addressFormData.branch || '' })}
        {textField('contactPerson', 'Contact', 'CONTACT PERSON', { labelWidth: '60px' })}

        {textField('address1', 'Address1', 'ADDRESS LINE 1', { required: true, limitToLine: true })}
        {textField('address2', 'Address2', 'ADDRESS LINE 2', { limitToLine: true })}
        {textField('city', 'City', 'CITY', {
          labelWidth: '60px', required: true, limitToLine: true,
          after: (addressFormData.city || '').length > 17 && (
            <span className="tw:text-[10px] tw:whitespace-nowrap tw:normal-case tw:text-warning" title="ICEGATE takes 35; AWB / IATA EDI keeps the first 17 characters of the city">AWB keeps 17</span>
          ),
        })}

        <Field label="Country" required labelWidth="80px">
          <SelectBox options={countryOptions} value={addressFormData.country || ''} onValueChange={setAddressCountry} placeholder="SELECT COUNTRY" clearable clearLabel="SELECT COUNTRY" />
        </Field>
        <Field label="State" required labelWidth="80px">
          <SelectBox options={stateOptions} value={addressFormData.state || ''} onValueChange={(value) => setAddressField('state', value)} placeholder="SELECT STATE" clearable clearLabel="SELECT STATE" />
        </Field>
        {textField('pinCode', 'Pin', 'PIN CODE', {
          labelWidth: '60px', required: true, onChange: setAddressPin, maxLength: isIndia ? 6 : 9,
          title: 'India: 6 digits (ICEGATE). Other countries: up to 9 (AWB / IATA EDI)',
        })}

        <Field label="CTX Type" labelWidth="80px">
          <SelectBox required options={CTX_TYPES} value={addressFormData.ctxType || ''} onValueChange={(value) => setAddressField('ctxType', value)} placeholder="Select" />
        </Field>
        <Field label="CTX State" labelWidth="80px">
          <SelectBox options={stateOptions} value={addressFormData.ctxState || ''} onValueChange={setAddressCtxState} placeholder="SELECT" clearable clearLabel="SELECT" />
          <Input data-allow-text="" placeholder="CODE" className="tw:w-[60px] tw:shrink-0" value={addressFormData.ctxCode || ''} onChange={(event) => setAddressField('ctxCode', event.target.value)} />
        </Field>
        {textField('regNo', 'Reg. No', 'REG. NO', { labelWidth: '60px', required: true, value: addressFormData.regNo || addressFormData.gstin || '' })}

        {textField('phone', 'Phone', 'PHONE NO.')}
        {textField('mobile', 'Mobile', 'MOBILE NO.')}
        {textField('fax', 'Fax', 'FAX NO.', { labelWidth: '60px' })}

        {textField('email', 'Email1', 'EMAIL ID 1')}
        {textField('email2', 'Email2', 'EMAIL ID 2')}
        {textField('website', 'Website', 'WEBSITE', { labelWidth: '60px' })}

        {textField('tanNo', 'TAN No', 'PARTY TAN NO')}
        {textField('unlocCity', 'UNLOC City', 'UNLOC CODE CITY', { labelWidth: '100px' })}
        <div className="tw:flex tw:items-center tw:gap-4">
          {flagField('disabled', 'Disabled')}
          {flagField('sez', 'Sez')}
        </div>
      </div>

      <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border tw:pb-2 tw:md:flex-row tw:md:items-center tw:md:gap-4">
        <div className="tw:md:w-[120px]">{flagField('gstExempted', 'GST Exempted')}</div>
        <div className="tw:min-w-0 tw:flex-1">{textField('sezWarehouseCode', 'SEZ Warehouse Code', 'SEZ WAREHOUSE CODE', { labelWidth: '130px' })}</div>
        <Button variant="default" onClick={saveAddress}><PlusCircle /> {isEditingAddress ? 'Update' : 'Add'}</Button>
      </div>

      <DataTable columns={columns} rows={addresses} rowKey={(_, index) => index} className="tw:min-w-[2200px]"
        emptyText="No branch addresses saved for this party." containerClassName="tw:mt-2 tw:flex-1 tw:rounded-md tw:border tw:border-border" />
    </PanelCard>
  );
}
