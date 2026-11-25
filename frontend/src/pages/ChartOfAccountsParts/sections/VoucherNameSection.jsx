// Voucher type, cost category, cost centre, currency and TDS nature forms, with Cancel / Save
import { Save } from 'lucide-react';
import { Button } from '@/components/ui';
import { chartTabOf } from '../chartTabs';
import { CheckField, FieldRow, NumberField, OptionPanel, SelectField, TextField } from '../formFields';

const BASE_TYPES = ['Receipt', 'Payment', 'Contra', 'Journal', 'Sales', 'Purchase', 'Credit Note', 'Debit Note'];
const NUMBERING_METHODS = ['Automatic', 'Manual', 'None'];
const editorOf = (setForm) => (key) => (value) => setForm((form) => ({ ...form, [key]: value }));
const idOptions = (list) => list.map((entry) => ({ value: String(entry.id), label: entry.name }));

function VoucherTypeForm({ form, setForm }) {
  const set = editorOf(setForm);
  return (
    <>
      <TextField label="Voucher Name" required value={form.name} onChange={set('name')} placeholder="e.g. Custom Receipt" />
      <FieldRow>
        <SelectField label="Base Type" value={form.baseType} onChange={set('baseType')} options={BASE_TYPES} />
        <SelectField label="Method of Numbering" value={form.numberingMethod} onChange={set('numberingMethod')} options={NUMBERING_METHODS} />
      </FieldRow>
      {form.numberingMethod === 'Automatic' && (
        <OptionPanel className="tw:flex-col tw:gap-3">
          <h5 className="tw:m-0 tw:text-[13px] tw:font-semibold tw:text-foreground">Advanced Configuration (Prefix/Suffix)</h5>
          <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-[1fr_80px_1fr]">
            <TextField label="Prefix" value={form.prefix} onChange={set('prefix')} placeholder="e.g. REC/" />
            <NumberField label="Start No." decimals={0} value={form.startingNumber} onChange={(text) => set('startingNumber')(parseInt(text) || 1)} />
            <TextField label="Suffix" value={form.suffix} onChange={set('suffix')} placeholder="e.g. /26-27" />
          </div>
        </OptionPanel>
      )}
    </>
  );
}

function CategoryForm({ form, setForm }) {
  const set = editorOf(setForm);
  return (
    <>
      <TextField label="Category Name" required value={form.name} onChange={set('name')} placeholder="e.g. Marketing Projects" />
      <OptionPanel className="tw:mt-2">
        <CheckField label="Allocate Revenue Items" checked={form.allocateRevenue} onChange={set('allocateRevenue')} />
        <CheckField label="Allocate Non-Revenue Items" checked={form.allocateNonRevenue} onChange={set('allocateNonRevenue')} />
      </OptionPanel>
    </>
  );
}

function CentreForm({ form, setForm, masterData }) {
  const set = editorOf(setForm);
  return (
    <>
      <TextField label="Cost Centre Name" required value={form.name} onChange={set('name')} placeholder="e.g. Website Overhaul" />
      <SelectField label="Category" value={form.categoryId} onChange={set('categoryId')} options={idOptions(masterData.costCategories)} emptyLabel="-- Select Category --" />
      <SelectField label="Under (Parent Centre)" value={form.parentId} onChange={set('parentId')} options={idOptions(masterData.costCentresFlat)} emptyLabel="-- Primary --" />
    </>
  );
}

function CurrencyForm({ form, setForm }) {
  const set = editorOf(setForm);
  return (
    <>
      <FieldRow>
        <TextField label="Symbol" required value={form.symbol} onChange={set('symbol')} placeholder="e.g. $" />
        <TextField label="Formal Name" required value={form.formalName} onChange={set('formalName')} placeholder="e.g. US Dollar" className="tw:md:flex-2" />
      </FieldRow>
      <FieldRow>
        <NumberField label="Decimal Places" decimals={0} value={form.decimalPlaces} onChange={set('decimalPlaces')} />
        <NumberField label="Standard Rate (₹)" value={form.standardRate} onChange={set('standardRate')} />
      </FieldRow>
    </>
  );
}

function TdsNatureForm({ form, setForm }) {
  const set = editorOf(setForm);
  return (
    <>
      <TextField label="Nature of Payment" required value={form.name} onChange={set('name')} placeholder="e.g. Payment to Contractors" />
      <FieldRow>
        <TextField label="Section" value={form.section} onChange={set('section')} placeholder="e.g. 194C" />
        <NumberField label="Rate (%)" value={form.rate} onChange={set('rate')} />
      </FieldRow>
      <FieldRow>
        <NumberField label="Rate (without PAN)" value={form.rateWithoutPan} onChange={set('rateWithoutPan')} />
        <NumberField label="Exemption Limit (₹)" value={form.exemptionLimit} onChange={set('exemptionLimit')} />
      </FieldRow>
    </>
  );
}

export default function VoucherNameSection({ chart }) {
  const { activeTab, editMode, handleSave, masterData, setShowForm } = chart;
  return (
    <>
      {activeTab === 'vouchers' && <VoucherTypeForm form={chart.voucherForm} setForm={chart.setVoucherForm} />}
      {activeTab === 'categories' && <CategoryForm form={chart.categoryForm} setForm={chart.setCategoryForm} />}
      {activeTab === 'centres' && <CentreForm form={chart.centreForm} setForm={chart.setCentreForm} masterData={masterData} />}
      {activeTab === 'currencies' && <CurrencyForm form={chart.currencyForm} setForm={chart.setCurrencyForm} />}
      {activeTab === 'tds' && <TdsNatureForm form={chart.tdsForm} setForm={chart.setTdsForm} />}

      <div className="tw:mt-3 tw:flex tw:gap-3 tw:border-t tw:border-border/60 tw:pt-5">
        <Button size="lg" onClick={() => setShowForm(false)} className="tw:h-10 tw:flex-1 tw:rounded-lg tw:text-foreground/75">Cancel</Button>
        <Button variant="default" size="lg" onClick={handleSave} className="tw:h-10 tw:flex-2 tw:rounded-lg">
          <Save className="tw:size-4.5" /> {editMode ? 'Update' : 'Save'} {chartTabOf(activeTab).entryLabel}
        </Button>
      </div>
    </>
  );
}
