import { Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { asList } from '@/utils/asList';
import { Button, Checkbox, ComboInput, Field, Input, Label, NumberInput, SelectBox } from '@/components/ui';
import { PanelBand } from '../../ExportInvoiceTabParts/sections/FormPanel';
import SegmentedChoice from '../../ExportInvoiceTabParts/sections/SegmentedChoice';
import { districtsOf } from '../districtCodes';
import { detailCount } from '../itemDetailWindows';
import { FORM_TARGET } from '../hooks/useItemPopups';
import ItemSwitch from './ItemSwitch';
import ItemActionsBar from './ItemActionsBar';
import ItemDetailWindow from './ItemDetailWindow';

const END_USE_OPTIONS = [
  ['GNX100', 'Generic -For Consumer use under commercial distribution'],
  ['GNX200', 'Generic -For Commercial Assembly or processing'],
  ['GNX300', 'Generic -For use as Fertilizers or soil promoters'],
  ['GNX600', 'Generic -For Repair or Refurbishing as defective or second hand goods'],
  ['GNX650', 'Generic -For Recycling or Recovery'],
  ['GNX680', 'Generic -For Disposal as waste'],
  ['GNX700', 'Generic -For Public Display or Exhibition'],
  ['GNX810', 'Generic -For Research & Development'],
  ['GNX815', 'Generic -For Medical Or Biomedical Research'],
  ['GNX915', 'Generic -For display as a Trophy'],
].map(([value, label]) => ({ value, label }));
const IGST_STATUSES = ['Select', 'Not Applicable (NA)', 'Export Under Bond (LUT)', 'Export Against Payment (P)'];
const PMV_OPTIONS = [['Percentage', '%'], ['Manual', 'Manual']];
const BODY = 'tw:flex tw:min-w-0 tw:flex-col tw:gap-1.5 tw:px-2.5 tw:py-1.5';
const QUANTITY_FIELDS = [
  { key: 'qty', label: 'Qty', number: true },
  { key: 'unit', label: 'Qty Unit', className: 'tw:bg-success/10' },
  { key: 'per', label: 'Per', number: true },
  { key: 'rate', label: 'Rate', number: true },
  { key: 'rateUnit', label: 'Rate UQC', className: 'tw:bg-success/10' },
  { key: 'totalFc', label: 'Total FC', number: true, labelWidth: '70px', className: 'tw:font-bold' },
];
const PMV_FIELDS = [
  { key: 'pmvPer', label: 'PMV %' },
  { key: 'pmv', label: 'PMV/Unit' },
  { key: 'totalPmv', label: 'Total PMV', labelWidth: '70px' },
];

const stateMatches = (state, query) => state.stateName?.toLowerCase().includes(query.toLowerCase()) || state.taxCode?.includes(query);
const stateOption = (state) => (
  <span className="tw:flex tw:flex-col">
    <b className="tw:text-[11px] tw:text-primary">{state.stateName}</b>
    <span className="tw:text-[10px] tw:text-muted-foreground">Code: {state.taxCode}</span>
  </span>
);
const schemeCodeOf = (scheme) => String(scheme || '').split(' ')[0] || '';
const schemeDescriptionOf = (scheme) => (String(scheme || '').includes('-') ? String(scheme).split('-')[1].trim() : '');

function SearchButton({ title, onClick }) {
  return <Button variant="ghost" size="icon-sm" tabIndex={-1} title={title} aria-label={title} onClick={onClick}><Info className="tw:text-primary" /></Button>;
}

function ItemDetailsFields({ ctx }) {
  const { exportData, formData, handleFormChange, schemesList, tariffs, openSchemeSearch, openRitcSearch, showCcr } = ctx;
  const invoices = exportData?.invoices || [];
  const invoiceOptions = invoices.length
    ? invoices.map((invoice, index) => ({ value: String(index + 1), label: `${index + 1} - ${invoice.no || 'NEW'}` }))
    : [{ value: '1', label: '1 - NEW' }];

  const completeScheme = () => {
    const code = String(formData.scheme || '').trim();
    if (!code || code.includes('-')) return;
    const found = schemesList.find((scheme) => scheme.code === code);
    if (found) handleFormChange('scheme', `${found.code} - ${found.desc}`);
  };
  const completeRitc = () => {
    const found = tariffs.find((tariff) => tariff.hsnCode === String(formData.ritc || '').trim());
    if (!found) return;
    handleFormChange('desc', found.description);
    handleFormChange('unit', found.uqc);
    handleFormChange('rateUnit', found.uqc);
  };
  const searchRitc = () => {
    const typed = formData.ritc || '';
    if (typed.length < 2) {
      toast.error('Please enter at least 2 digits to search RITC');
      return;
    }
    openRitcSearch(FORM_TARGET, typed);
  };
  const numberBox = (key, extra = {}) => (
    <NumberInput align="right" value={formData[key] ?? ''} onValueChange={(value) => handleFormChange(key, value)} {...extra} />
  );

  return (
    <div className={BODY}>
      <div className="tw:grid tw:grid-cols-1 tw:items-center tw:gap-x-3 tw:gap-y-1.5 tw:md:grid-cols-2 tw:lg:grid-cols-[1.1fr_.6fr_2fr_1.6fr]">
        <Field label="Inv Sr No" labelWidth="86px">
          <SelectBox className="tw:font-bold tw:text-primary" options={invoiceOptions} value={String(formData.invSr || 1)} onValueChange={(serial) => handleFormChange('invSr', serial)} />
        </Field>
        <Field label="Item Sr" labelWidth="46px">
          <Input value={formData.itemSr ?? ''} onChange={(event) => handleFormChange('itemSr', event.target.value)} />
        </Field>
        <Field label="Scheme" labelWidth="54px">
          <Input data-allow-text="" className="tw:w-[82px] tw:flex-none" value={schemeCodeOf(formData.scheme)}
            onChange={(event) => handleFormChange('scheme', event.target.value)} onBlur={completeScheme} />
          <SearchButton title="Search scheme codes" onClick={() => openSchemeSearch(FORM_TARGET)} />
          <Input readOnly tabIndex={-1} title="Scheme description" value={schemeDescriptionOf(formData.scheme)} />
        </Field>
        <Field label="RITC" labelWidth="34px">
          <Input maxLength={8} value={formData.ritc || ''} onChange={(event) => handleFormChange('ritc', event.target.value)} onBlur={completeRitc} />
          <SearchButton title="Search RITC" onClick={searchRitc} />
          <Button variant="warning" tabIndex={-1} title="Compulsory compliance requirements of this RITC" onClick={() => showCcr(formData)}>CCRs</Button>
        </Field>
      </div>
      <Field label="Description" labelWidth="86px">
        <Input data-allow-text="" className="tw:border-success tw:bg-success/10" value={formData.desc ?? ''} onChange={(event) => handleFormChange('desc', event.target.value)} />
      </Field>
      <Field label="Checklist" labelWidth="86px">
        <Input data-allow-text="" placeholder="only printed on the checklist, not sent to customs" value={formData.chkDesc ?? ''} onChange={(event) => handleFormChange('chkDesc', event.target.value)} />
      </Field>
      <div className="tw:grid tw:grid-cols-1 tw:items-center tw:gap-x-3 tw:gap-y-1.5 tw:sm:grid-cols-2 tw:md:grid-cols-3 tw:xl:grid-cols-6">
        {QUANTITY_FIELDS.map(({ key, label, number, labelWidth = '62px', className }) => (
          <Field key={key} label={label} labelWidth={labelWidth}>
            {number
              ? numberBox(key, { className })
              : <Input data-allow-text="" className={className} value={formData[key] ?? ''} onChange={(event) => handleFormChange(key, event.target.value)} />}
          </Field>
        ))}
        <Field label="PMV" labelWidth="62px">
          <SegmentedChoice title="PMV as % of value or typed by hand (arrow keys / P / M)" value={formData.pmvOption} options={PMV_OPTIONS} onChange={(option) => handleFormChange('pmvOption', option)} />
        </Field>
        {PMV_FIELDS.map(({ key, label, labelWidth = '62px' }) => (
          <Field key={key} label={label} labelWidth={labelWidth}>{numberBox(key)}</Field>
        ))}
        <Field label="FOB ₹" labelWidth="62px" className="tw:sm:col-span-2">
          <Input readOnly tabIndex={-1} className="tw:text-right tw:font-bold" title="Item FOB (INR), worked out from the invoice" value={formData.itemFob ?? ''} />
        </Field>
      </div>
    </div>
  );
}

function GstOriginFields({ ctx }) {
  const { formData, setFormData, handleFormChange, states } = ctx;
  const igstPaid = /\(P\)/.test(String(formData.igstPayStatus || ''));
  const districtOptions = districtsOf(formData.stateCode).map(([code, name]) => ({ value: code, label: `${name} (${code})` }));
  const districtPrompt = formData.stateCode ? 'Select district' : 'Pick state first';
  const pickState = (state) => setFormData((previous) => ({
    ...previous, sourceState: state.stateName, stateCode: state.taxCode,
    districtCode: districtsOf(state.taxCode).some(([code]) => code === previous.districtCode) ? previous.districtCode : '',
  }));
  const igstBox = (key, extra) => (
    <NumberInput align="right" disabled={!igstPaid} value={formData[key] || ''} onValueChange={(value) => handleFormChange(key, value)} {...extra} />
  );

  return (
    <div className="tw:grid tw:grid-cols-1 tw:items-center tw:gap-x-3 tw:gap-y-1.5 tw:px-2.5 tw:py-1.5 tw:md:grid-cols-2 tw:lg:grid-cols-4">
      <Field label="Job Work Notn" labelWidth="86px">
        <Input data-allow-text="" maxLength={10} placeholder="notification no" title="Job-work notification number (SB jobWorkNotificationNo); blank when the export is not under job work"
          value={formData.jobWorkNotificationNo || ''} onChange={(event) => handleFormChange('jobWorkNotificationNo', event.target.value.toUpperCase())} />
      </Field>
      <Field label="End Use" labelWidth="86px">
        <ComboInput upper placeholder="e.g. GNX100" listClassName="tw:min-w-80" options={END_USE_OPTIONS}
          value={formData.endUse || ''} onValueChange={(code) => handleFormChange('endUse', code.toUpperCase())} />
      </Field>
      <Field label="IGST Status" labelWidth="86px">
        <SelectBox options={IGST_STATUSES} value={formData.igstPayStatus} onValueChange={(status) => handleFormChange('igstPayStatus', status)} />
      </Field>
      <Field label="Taxable ₹" labelWidth="86px">{igstBox('taxableValue')}</Field>
      <Field label="IGST % / ₹" labelWidth="86px">
        {igstBox('igstRate', { className: 'tw:w-[30%] tw:flex-none', title: 'IGST rate %' })}
        {igstBox('igstAmt', { title: 'IGST amount (INR)' })}
      </Field>
      <Field label="Source State" labelWidth="86px">
        <ComboInput placeholder="State Name" options={states} getValue={(state) => state.stateName} filter={stateMatches} renderOption={stateOption}
          value={formData.sourceState} onValueChange={(name) => handleFormChange('sourceState', name)} onSelect={pickState} />
        <Input readOnly tabIndex={-1} className="tw:w-10 tw:flex-none tw:text-center" title="State code" value={formData.stateCode || ''} />
      </Field>
      <Field label="District" labelWidth="86px">
        <SelectBox clearable clearLabel={districtPrompt} placeholder={districtPrompt} options={districtOptions}
          value={formData.districtCode || ''} onValueChange={(code) => handleFormChange('districtCode', code)} />
      </Field>
      <Field label="HAWB No" labelWidth="86px">
        <Input data-allow-text="" value={formData.hawb || ''} onChange={(event) => handleFormChange('hawb', event.target.value.toUpperCase())} />
      </Field>
      <Field label="Total Pkgs" labelWidth="86px">
        <NumberInput decimals={0} align="right" value={formData.totalPkgs || ''} onValueChange={(packages) => handleFormChange('totalPkgs', packages)} />
      </Field>
    </div>
  );
}

function SwitchesFields({ ctx }) {
  const { formData, handleFormChange, setIsSwInfoModalOpen, setIsSwStatementModalOpen, setIsESanchitModalOpen, setIsReExportModalOpen, setDetailWindow } = ctx;
  const detailProps = (key) => ({ onOpen: () => setDetailWindow(key), count: detailCount(key, formData) });
  const singleWindow = [
    { label: 'RoDTEP', field: 'rodtep' },
    { label: 'SW Info', field: 'swInfo', onOpen: () => setIsSwInfoModalOpen(true), count: asList(formData.swInfos).length },
    { label: 'SW Statement', field: 'swStatement', onOpen: () => setIsSwStatementModalOpen(true) },
    { label: 'Supporting Docs', field: 'suppDocs', onOpen: () => setIsESanchitModalOpen(true), count: asList(formData.eSanchitList).length },
    { label: 'Re-Export', field: 'reExport', onOpen: () => setIsReExportModalOpen(true), count: Array.isArray(formData.reExports) ? formData.reExports.length : 0 },
    { label: 'Manufacturer', field: 'manfDetails', ...detailProps('manf') },
    { label: 'SW Constituent', field: 'swConst', ...detailProps('swConst') },
    { label: 'SW Production', field: 'swProd', ...detailProps('swProd') },
    { label: 'SW Control', field: 'swCtrl', ...detailProps('swCtrl') },
  ];
  const other = [
    { label: 'Accessory', field: 'accessory', ...detailProps('accessory') },
    { label: 'Cess', field: 'cess', ...detailProps('cess') },
    { label: 'Third Party', field: 'thirdParty', ...detailProps('thirdParty') },
    { label: 'AR4', field: 'ar4' },
    { label: 'Reward', field: 'reward' },
  ];
  const switchRow = (heading, switches) => (
    <>
      <span className="tw:self-center tw:text-[10px] tw:font-bold tw:tracking-widest tw:text-muted-foreground">{heading}</span>
      {switches.map((props) => <ItemSwitch key={props.field} {...props} formData={formData} handleFormChange={handleFormChange} />)}
    </>
  );

  return (
    <div className={BODY}>
      <div className="tw:flex tw:flex-wrap tw:gap-1.5">{switchRow('SW', singleWindow)}</div>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5">
        {switchRow('OTHER', other)}
        <span className="tw:hidden tw:flex-1 tw:lg:block" />
        <Label className="tw:h-[26px] tw:cursor-pointer tw:gap-1.5 tw:rounded-full tw:border tw:border-border tw:bg-background tw:px-2 tw:text-[11px] tw:font-semibold">
          <Checkbox checked={!!formData.addInTemplate} onCheckedChange={(checked) => handleFormChange('addInTemplate', checked === true)} />
          Add in template
        </Label>
        <Field label={<span title="Add in middle: before item no">Add before item</span>} labelWidth="104px" className="tw:w-full tw:sm:w-[186px]">
          <NumberInput decimals={0} placeholder="no" value={formData.addInMiddle || ''} onValueChange={(itemNo) => handleFormChange('addInMiddle', itemNo)} />
        </Field>
        <Field label={<span title="Copy licence rows from item no">Copy licence of</span>} labelWidth="104px" className="tw:w-full tw:sm:w-[186px]">
          <NumberInput decimals={0} placeholder="item" value={formData.copyLicence || ''} onValueChange={(itemNo) => handleFormChange('copyLicence', itemNo)} />
        </Field>
      </div>
    </div>
  );
}

export default function ItemFormSection({ ctx }) {
  const { editing, formData, setFormData, detailWindow, setDetailWindow } = ctx;
  return (
    <div className="glass-panel tw:mb-2 tw:p-0 tw:text-entry">
      {detailWindow && (
        <ItemDetailWindow key={detailWindow} which={detailWindow} onClose={() => setDetailWindow('')} formData={formData} setFormData={setFormData} />
      )}
      <PanelBand title="Item Details" note={editing ? `editing item ${formData.itemSr || ''} of invoice ${formData.invSr || 1}` : 'new item'} />
      <ItemDetailsFields ctx={ctx} />
      <PanelBand title="GST, Origin & Packages" className="tw:border-t" />
      <GstOriginFields ctx={ctx} />
      <PanelBand title="Single Window & Other Details" note="click Y/N to switch · … opens the details" className="tw:border-t" />
      <SwitchesFields ctx={ctx} />
      <ItemActionsBar ctx={ctx} />
    </div>
  );
}
