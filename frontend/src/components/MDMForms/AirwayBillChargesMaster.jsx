import { Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, Button, Checkbox, Field, Input, NumberInput, SelectBox } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { activeColumn, masterActionsColumn } from './masterKit/masterColumns';
import { useMasterRecords } from './masterKit/useMasterRecords';
import switchRow from './switchRow';

// The AWB screens read this table for the "Other Charges" code list (inactive charges are hidden there).
const NON_TAXABLE = 'Non-Taxable';
const CHARGE_TYPES = ['Taxable(Due Agent)', 'Taxable(Due Carrier)', NON_TAXABLE];
const ENTITLEMENT_OF_TYPE = { 'Taxable(Due Carrier)': 'DUE_CARRIER', 'Taxable(Due Agent)': 'DUE_AGENT' };
const ENTITLEMENTS = [{ value: 'DUE_AGENT', label: 'Due Agent' }, { value: 'DUE_CARRIER', label: 'Due Carrier' }];
const DUE_TEXT = { DUE_CARRIER: 'Carrier', DUE_AGENT: 'Agent' };
const EMPTY_CHARGE = { id: null, chargeType: 'Taxable(Due Agent)', chargeName: '', awbChargeName: '', awbChargeCode: '', entitlement: 'DUE_AGENT', sacCode: '', gstRate: '18', isActive: true };
const SEARCH_FIELDS = ['awbChargeCode', 'awbChargeName', 'chargeName', 'sacCode'];

const normalizeCharge = (charge) => ({
  ...charge,
  chargeName: charge.chargeName.trim().toUpperCase(),
  awbChargeName: (charge.awbChargeName || charge.chargeName).trim().toUpperCase(),
  awbChargeCode: charge.awbChargeCode.trim().toUpperCase(),
  sacCode: String(charge.sacCode || '').trim(),
});

const gstRateOf = (charge) => (charge.gstRate === '' || charge.gstRate == null ? 0 : Number(charge.gstRate));

const validateCharge = (form, records) => {
  const charge = normalizeCharge(form);
  if (!charge.chargeName) return 'Charge Name is mandatory';
  if (!charge.awbChargeName) return 'AWB Charge Name is mandatory';
  if (charge.awbChargeCode && !/^[A-Z]{2}[AC]?$/.test(charge.awbChargeCode)) return 'AWB Charge Code: 2 letters (IATA other-charge code, e.g. MY, SC, XR), optional A / C for agent / carrier';
  if (charge.sacCode && !/^\d{6}$/.test(charge.sacCode)) return 'SAC code must be 6 digits (e.g. 996531)';
  const rate = gstRateOf(charge);
  if (!Number.isFinite(rate) || rate < 0 || rate > 28) return 'GST rate must be 0 - 28 %';
  if (charge.chargeType !== NON_TAXABLE && rate === 0) return 'Taxable charge needs a GST rate (or choose Non-Taxable)';
  if (records.some((row) => row.id !== charge.id && String(row.awbChargeName || '').toUpperCase() === charge.awbChargeName)) return 'Duplicate: this AWB Charge Name already exists';
  return '';
};

const chargeBody = (form) => {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...body } = normalizeCharge(form);
  return { ...body, gstRate: gstRateOf(body) };
};

// a charge with no isActive value counts as active
const chargeForm = (row) => ({
  ...EMPTY_CHARGE,
  ...row,
  chargeName: row.chargeName || row.awbChargeName || '',
  awbChargeCode: row.awbChargeCode || '',
  sacCode: row.sacCode || '',
  gstRate: row.gstRate == null ? '' : String(row.gstRate),
  entitlement: row.entitlement || (row.chargeType === 'Taxable(Due Carrier)' ? 'DUE_CARRIER' : 'DUE_AGENT'),
  isActive: row.isActive !== false,
});

const LIST = {
  title: 'Search Charge',
  searchPlaceholder: 'Search code / name / SAC',
  primaryText: (charge) => charge.awbChargeName,
  secondaryText: (charge) => `${charge.awbChargeCode || '-'} · ${charge.chargeType || ''}`,
};

export default function AirwayBillChargesMaster() {
  const master = useMasterRecords({
    resource: 'charges',
    emptyRecord: EMPTY_CHARGE,
    searchFields: SEARCH_FIELDS,
    validate: (form) => validateCharge(form, master.records),
    prepareSave: chargeBody,
  });
  const { form, setForm, setField, clearForm, reload } = master;

  const changeChargeType = (chargeType) => setForm((current) => ({
    ...current,
    chargeType,
    ...(chargeType === NON_TAXABLE && { gstRate: '0' }),
    ...(ENTITLEMENT_OF_TYPE[chargeType] && { entitlement: ENTITLEMENT_OF_TYPE[chargeType] }),
  }));

  const editCharge = (row) => setForm(chargeForm(row));

  const saveCharge = async () => {
    const wasEditing = Boolean(form.id);
    if (await master.save()) toast.success(wasEditing ? 'Charge updated' : 'Charge added');
  };

  const switchCharge = async (row) => {
    const isOn = row.isActive !== false;
    const changed = await switchRow('charges', { ...row, isActive: isOn }, `charge ${row.awbChargeName || row.chargeName || ''}`);
    if (!changed) return;
    toast.success(isOn ? 'Charge switched off' : 'Charge switched on');
    if (form.id === row.id) clearForm();
    reload();
  };

  const rows = master.filtered.map((row) => ({ ...row, isActive: row.isActive !== false }));

  const columns = [
    { key: 'awbChargeCode', header: 'Code', className: 'tw:font-bold', cell: (row) => row.awbChargeCode || '-' },
    { key: 'awbChargeName', header: 'AWB Charge Name' },
    { key: 'chargeName', header: 'Charge Name', cell: (row) => row.chargeName || '-' },
    { key: 'chargeType', header: 'Type' },
    { key: 'entitlement', header: 'Due', cell: (row) => DUE_TEXT[row.entitlement] || '-' },
    { key: 'sacCode', header: 'SAC', cell: (row) => row.sacCode || '-' },
    { key: 'gstRate', header: 'GST %', align: 'right', cell: (row) => (row.gstRate == null ? '-' : Number(row.gstRate)) },
    activeColumn,
    masterActionsColumn({ onEdit: editCharge, onSwitch: switchCharge }),
  ];

  const switchButton = form.id && (
    <Button variant="warning" size="lg" onClick={() => switchCharge(form)}>{form.isActive !== false ? 'Switch off' : 'Switch on'}</Button>
  );

  return (
    <MasterPage master={{ ...master, filtered: rows, editRecord: editCharge, save: saveCharge }} list={LIST} icon={Receipt}
      formTitle={<>Airway Bill Charges Master {form.id && <Badge variant="info">editing</Badge>}</>}
      columns={columns} actions={switchButton} emptyText="No charges yet">
      <div className="tw:grid tw:grid-cols-1 tw:gap-x-4 tw:gap-y-3 tw:md:grid-cols-2 tw:xl:grid-cols-3">
        <Field label="Charge Type" required labelWidth="110px">
          <SelectBox options={CHARGE_TYPES} value={form.chargeType} onValueChange={changeChargeType} required />
        </Field>
        <Field label="Charge Name" required labelWidth="110px">
          <Input required placeholder="X-RAY CHGS" data-allow-text="" value={form.chargeName}
            onChange={(event) => setField('chargeName')(event.target.value.toUpperCase())} />
        </Field>
        <Field label="AWB Charge Name" labelWidth="110px">
          <Input placeholder="same as Charge Name" data-allow-text="" value={form.awbChargeName}
            onChange={(event) => setField('awbChargeName')(event.target.value.toUpperCase())} />
        </Field>
        <Field label="AWB Charge Code" labelWidth="110px">
          <Input maxLength={3} placeholder="XR" data-allow-text="" value={form.awbChargeCode}
            onChange={(event) => setField('awbChargeCode')(event.target.value.toUpperCase())} />
        </Field>
        <Field label="Due" labelWidth="110px">
          <SelectBox options={ENTITLEMENTS} value={form.entitlement} onValueChange={setField('entitlement')} />
        </Field>
        <Field label="SAC Code" labelWidth="110px">
          <NumberInput decimals={0} maxLength={6} placeholder="996531" value={form.sacCode} onValueChange={setField('sacCode')} />
        </Field>
        <Field label="GST Rate %" labelWidth="110px">
          <NumberInput decimals={2} value={form.gstRate} disabled={form.chargeType === NON_TAXABLE} onValueChange={setField('gstRate')} />
        </Field>
        <Field label="Active (shown in AWB screens)">
          <Checkbox checked={form.isActive !== false} onCheckedChange={(checked) => setField('isActive')(checked === true)} />
        </Field>
      </div>
    </MasterPage>
  );
}
