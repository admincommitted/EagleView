import { useEffect, useState } from 'react';
import { DataTable, Field, Input, Section, SelectBox } from '@/components/ui';
import { cn } from '@/lib/utils';
import { FLAG_NAMES, itemAssessableINR, computeItemDuty, refreshItemDutyBoxes, dutyBasisText } from '../helpers';
import PopupFlagField from './PopupFlagField';

const DUTY_LINES = [
  { prefix: 'bcd', label: 'BCD' },
  { prefix: 'cvd', label: 'CVD' },
  { prefix: 'adlCvd', label: 'Adl. CVD' },
  { prefix: 'sws', label: 'SWS', defaults: { Rate: '10', Flag: 'A' } },
  { prefix: 'sapta', label: 'SAPTA' },
  { prefix: 'healthCess', label: 'Health Cess' },
];

const DUTY_BOXES = [
  { suffix: 'NotificationNo', header: 'Notification' },
  { suffix: 'SrNo', header: 'Serial No.' },
  { suffix: 'Rate', header: 'Rate (%)' },
  { suffix: 'Flag', header: 'Flag' },
  { suffix: 'Amount', header: 'Amount' },
  { suffix: 'Unit', header: 'Unit' },
];

const RECALCULATING_BOXES = ['bcdRate', 'bcdUnit', 'swsRate', 'healthCessRate'];
const BOX_EXTRAS = {
  bcdUnit: { title: 'Unit the specific BCD rate is per (from the tariff, e.g. KGS)', className: 'tw:uppercase' },
};

// A tariff line is not always a percentage: most of chapters 50-63 read "20% or Rs 115 per kg, whichever is higher",
// and cigarettes / gold / bulk oils are per unit only. The BCD Unit box is the unit the specific rate is per.
const RATE_BASIS_OPTIONS = [
  { value: 'A', label: 'Rate % only' },
  { value: 'S', label: 'Specific only' },
  { value: 'H', label: 'Whichever is higher' },
  { value: 'L', label: 'Whichever is lower' },
  { value: 'B', label: 'Both added' },
];

// the RSP flag is a code (Y/S/N/Q/T/D) - only Y opens the popup
const OTHER_DUTY_FLAGS = [
  { label: 'Scheme Code Category', opener: 'openSchemeCategoryModal' },
  { label: 'Licence', opener: 'openLicenceModal' },
  { label: 'Re-Import', opener: 'openReimportModal' },
  { label: 'RSP Duty', note: '[Y,S/N/Q/T/D]', opener: 'openRspModal' },
  { label: 'NCD Custom Duty', opener: 'openNcdModal' },
  { label: 'Anti Dumping Duty', opener: 'openAntiDumpingModal' },
  { label: 'Other Duty', opener: 'openOtherDutyModal' },
];

const SINGLE_WINDOW_FLAGS = [
  { label: 'SW Infotype', opener: 'openSwInfoModal', required: true },
  { label: 'SW Constituent', opener: 'openSwConstModal' },
  { label: 'SW Production', opener: 'openSwProductionModal' },
  { label: 'SW Control', opener: 'openSwControlModal' },
  { label: 'SW Statement', opener: 'openSwStatementModal' },
  { label: 'Supporting Docs', opener: 'openSupportingDocsModal' },
  { label: 'Customs CVD', opener: 'openCustomsCvdModal' },
];

// the flag box shows Y when the item already has that popup's data (e.g. an imported BE) even if the flag was never typed
const POPUP_DATA_KEY = {
  schemeCodCategoryFlag: 'schemeCatData', licenceFlag: 'licenceData', reImportFlag: 'reimportData', ncdCustomDutyFlag: 'ncdData',
  antiDumpingDutyFlag: 'addData', otherDutyFlag: 'otherDutyData', swInfotypeFlag: 'swInfoData', swConstituentFlag: 'swConstData',
  swProductionFlag: 'swProdData', swControlFlag: 'swCtrlData', swStatementFlag: 'swStmtData', supportingDocsFlag: 'docsData', customsCvdFlag: 'cvdData',
};
const NOT_DATA_KEYS = ['flag', 'type', 'id'];

const parseJson = (stored, fallback) => {
  if (typeof stored !== 'string') return stored;
  try {
    return JSON.parse(stored);
  } catch {
    return fallback;
  }
};
const rowsOf = (stored) => {
  const rows = parseJson(stored, []);
  return Array.isArray(rows) ? rows : [];
};
const hasPopupData = (stored) => {
  const data = parseJson(stored, null);
  if (Array.isArray(data)) return data.length > 0;
  return Boolean(data) && typeof data === 'object'
    && Object.entries(data).some(([key, value]) => !NOT_DATA_KEYS.includes(key) && String(value ?? '').trim() !== '');
};

function FlagColumn({ title, flags, ctx, flagValue, labelWidth }) {
  return (
    <Section title={title} className="tw:lg:flex-1">
      {flags.map((flag) => {
        const name = FLAG_NAMES[flag.label];
        return (
          <PopupFlagField key={name} label={flag.label} note={flag.note} name={name} required={flag.required} labelWidth={labelWidth}
            defaultValue={flagValue(name)} onOpen={ctx[flag.opener]} />
        );
      })}
    </Section>
  );
}

export default function ItemSDutySection({ ctx }) {
  const { selectedItem, invoices, jobData, esanchitDocs } = ctx;
  const recalcDuty = () => refreshItemDutyBoxes(selectedItem, invoices, jobData);

  // The Basis select writes its value into its hidden native select after the render, and the duty refresh reads
  // the form - so the refresh runs in an effect after each change.
  const [rateBasis, setRateBasis] = useState(RATE_BASIS_OPTIONS.some((option) => option.value === selectedItem.bcdRateBasis) ? selectedItem.bcdRateBasis : '');
  const [refreshAfterRender, setRefreshAfterRender] = useState(null);
  useEffect(() => {
    refreshAfterRender?.();
  }, [refreshAfterRender]);
  const changeRateBasis = (value) => {
    setRateBasis(value);
    setRefreshAfterRender(() => recalcDuty);
  };

  // duty estimate on the assessable value in INR (exchange rate + freight / insurance share); ICEGATE calculates the real duty
  const assessableText = () => {
    const form = document.getElementById('item-form');
    const live = (name) => form?.elements.namedItem(name)?.value || '';
    const estimate = itemAssessableINR({ itemValue: live('value') || selectedItem.value, invNo: live('invNo') || selectedItem.invNo, invSrNo: selectedItem.invSrNo }, invoices, jobData);
    return estimate.rateFound
      ? `Ass. value ₹ ${estimate.av.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (estimate)`
      : `Exchange rate for ${estimate.currency || 'invoice currency'} missing - duty not calculated`;
  };

  // BE / invoice level statements and supporting documents are kept once on the job; the item's popup shows them
  const invoiceSr = String(selectedItem.invSrNo || '');
  const keptOnJob = {
    swStatementFlag: () => rowsOf(jobData?._statements).some((row) => {
      const rowInvoice = String(row.invoiceSerialNumber ?? row.invoiceSrNo ?? '0');
      const rowItem = String(row.itemSerialNumber ?? row.itemSrNo ?? '0');
      return rowItem === '0' && (rowInvoice === '0' || rowInvoice === invoiceSr);
    }),
    supportingDocsFlag: () => rowsOf(esanchitDocs).some((doc) => {
      const docFor = String(doc.docFor || 'HEADER').toUpperCase();
      return docFor === 'HEADER' || (docFor === 'INVOICE' && String(doc.invSrNo || '') === invoiceSr);
    }),
  };
  const flagValue = (name) => selectedItem[name]
    || (POPUP_DATA_KEY[name] && hasPopupData(selectedItem[POPUP_DATA_KEY[name]]) ? 'Y' : '')
    || (keptOnJob[name]?.() ? 'Y' : '');

  const dutyColumns = [
    { key: 'label', header: '', width: 80, className: 'tw:font-bold', cell: (line) => line.label },
    ...DUTY_BOXES.map((box) => ({
      key: box.suffix,
      header: box.header,
      cell: (line) => {
        const name = line.prefix + box.suffix;
        const extras = BOX_EXTRAS[name] || {};
        return (
          <Input name={name} defaultValue={selectedItem[name] || line.defaults?.[box.suffix] || ''} title={extras.title} className={cn('tw:min-w-[70px]', extras.className)}
            onChange={RECALCULATING_BOXES.includes(name) ? recalcDuty : undefined} />
        );
      },
    })),
  ];
  const bcdUnit = String(selectedItem.bcdUnit || '').toUpperCase();

  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:lg:flex-row">
      <Section title="Item's Duty Details" className="tw:lg:flex-[2]"
        actions={<span id="item-av-hint" className="tw:text-[11px] tw:normal-case">{assessableText()}</span>}>
        <DataTable columns={dutyColumns} rows={DUTY_LINES} rowKey="prefix" stickyHeader={false} />
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:border-t tw:border-dashed tw:border-border tw:pt-1.5 tw:normal-case">
          <Field label="Specific rate ₹">
            <Input name="bcdSpecAmount" inputMode="decimal" defaultValue={selectedItem.bcdSpecAmount || ''} placeholder="per unit" className="tw:w-20"
              title="Rupees per unit of the BCD Unit above - from the tariff, e.g. Rs 115 per KGS" onChange={recalcDuty} />
          </Field>
          <span className="tw:text-muted-foreground">per {bcdUnit || 'BCD Unit'}</span>
          <Field label="Basis" hint="How the tariff says to apply the two rates">
            <SelectBox name="bcdRateBasis" clearable clearLabel="Auto" placeholder="Auto" className="tw:w-[150px]"
              options={RATE_BASIS_OPTIONS} value={rateBasis} onValueChange={changeRateBasis} />
          </Field>
          <Field label="Qty in duty unit">
            <Input name="specQty" inputMode="decimal" defaultValue={selectedItem.specQty || ''} placeholder={bcdUnit || 'same as item qty'} className="tw:w-[90px]"
              title="Only needed when the item quantity is in a different unit than the specific rate (fabric billed in metres, duty per kg)" onChange={recalcDuty} />
          </Field>
          <span id="item-bcd-basis-note" className="tw:min-w-[180px] tw:flex-1 tw:text-muted-foreground">
            {dutyBasisText(computeItemDuty(selectedItem, invoices, jobData).bcdBasis)}
          </span>
        </div>
      </Section>

      <FlagColumn title="Other Duty" flags={OTHER_DUTY_FLAGS} ctx={ctx} flagValue={flagValue} labelWidth="150px" />
      <FlagColumn title="Single Window" flags={SINGLE_WINDOW_FLAGS} ctx={ctx} flagValue={flagValue} labelWidth="120px" />
    </div>
  );
}
