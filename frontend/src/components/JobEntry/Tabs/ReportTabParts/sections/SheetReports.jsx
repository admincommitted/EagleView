// ADC sheet and Stamp duty sheet. No office sample was available, so both follow a standard layout:
//  - ADC sheet: the particulars the Assistant Drugs Controller (CDSCO port office) asks for to give the NOC for drugs /
//    cosmetics / medical devices - importer, BE, AWB / BL, invoices, and per item the product, CTH, manufacturer and the
//    batch / mfg / expiry rows of 4. Items > SW production details. Licence numbers are not kept in EagleView: they are
//    typed on the sheet (click the dotted box) before printing.
//  - Stamp duty sheet: office rule: (assessable value + total duty) x 0.1 %, rounded up to the next Rs 10
//    (their B/E: 2,76,80,235.00 + 76,77,113.20 = 3,53,57,348.20 -> 35,357.35 -> Rs 35,360). Rate / basis /
//    rounding can still be changed on the sheet; the choice is kept in this browser.
// Values (assessable value, duty) are the same estimate as the Duty Sheet (computeItemDuty).
import { useEffect, useState } from 'react';
import { computeItemDuty } from '../../ItemGridTabParts/helpers';
import { cn } from '@/lib/utils';
import { Input, SelectBox } from '@/components/ui';
import { ReportJobHeader } from './SimpleReports';
import {
  formatAmount, invoiceSrOf, itemCthOf, itemDescriptionOf, itemInvoiceSr, itemQtyOf, itemTagOf, itemUqcOf, parseJsonList,
  parseNumber,
} from './reportFormat';
import {
  ReportBody, ReportCell, ReportColumnGrid, ReportFootnote, ReportLabelCell, ReportNote, ReportPage, ReportRow,
  ReportTable, ReportTitle,
} from '../reportTable';

// also takes the compact YYYYMMDD form
const toDmy = (value) => {
  const text = String(value || '').trim();
  const match = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(text);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
};
const joinParts = (...parts) => parts.map((part) => String(part || '').trim()).filter(Boolean).join(', ');
const datedText = (no, date) => `${no || ''} ${date ? 'Dt. ' + toDmy(date) : ''}`;

// a box the operator types into before printing (its text goes into the print and the mail; inputs would not)
function Fill({ className }) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      className={cn('tw:inline-block tw:min-h-[14px] tw:min-w-[160px] tw:border-b tw:border-dotted tw:border-[#64748b] tw:outline-none', className)}
    />
  );
}

const SheetLabel = ({ className, ...props }) => <ReportLabelCell className={cn('tw:w-[22%]', className)} {...props} />;

const adcRowsOf = (items, invoices, job) => (items || []).flatMap((item, index) => {
  const duty = computeItemDuty(item, invoices, job);
  const qty = parseNumber(itemQtyOf(item));
  const uqc = itemUqcOf(item);
  const batches = parseJsonList(item.swProdData).filter((batch) => batch && (batch.batch || batch.mnfDate || batch.expDate));
  const base = {
    tag: itemTagOf(item, index),
    description: itemDescriptionOf(item),
    generic: item.genericDesc || '',
    cth: itemCthOf(item),
    manufacturer: joinParts(item.manufacturerName || item.manufacturer, item.itemManufacturerCity),
    assessableValue: duty.av || 0,
  };
  if (!batches.length) return [{ ...base, batch: '', mfg: '', exp: '', qty, uqc, value: base.assessableValue }];
  const batchQty = batches.reduce((sum, batch) => sum + parseNumber(batch.qty), 0);
  return batches.map((batch, batchIndex) => {
    const thisQty = parseNumber(batch.qty);
    // the item's value is shared by batch quantity when the batch quantities add up to the item; else it stays on the first row
    const value = batchQty > 0 && Math.abs(batchQty - qty) < 1e-6
      ? base.assessableValue * thisQty / batchQty
      : (batchIndex === 0 ? base.assessableValue : 0);
    return {
      ...base,
      batch: batch.batch || '',
      mfg: batch.mnfDate || '',
      exp: batch.expDate || batch.bestBefore || '',
      qty: thisQty || (batchIndex === 0 ? qty : 0),
      uqc: batch.uqc || uqc,
      value,
      continued: batchIndex > 0,
    };
  });
});

export function AdcSheetReport({ jobData, items }) {
  const job = jobData || {};
  const invoices = job.invoices || [];
  const port = job.portName || job.locationName || job.autoField_1 || job.portCode || job.customHouseCode || '';
  const invoiceText = invoices
    .map((invoice) => [invoice.invNo || invoice.invoiceNo, invoice.invDate || invoice.invoiceDate ? 'Dt. ' + toDmy(invoice.invDate || invoice.invoiceDate) : ''].filter(Boolean).join(' '))
    .filter(Boolean)
    .join('; ');
  const rows = adcRowsOf(items, invoices, job);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const noBatch = (items || []).length > 0 && rows.some((row) => !row.batch);
  const itemCell = (row, value) => (row.continued ? '' : value);
  return (
    <ReportPage>
      <ReportTitle className="tw:uppercase">ADC Sheet</ReportTitle>
      <div className="tw:mb-[6px] tw:text-center tw:text-[9pt]">
        Particulars for the NOC of the Assistant Drugs Controller (India), Port Office{port ? ' - ' + port : ''}<br />Drugs / Cosmetics / Medical Devices
      </div>
      <ReportNote tone="info">
        Click the dotted boxes to type the licence / registration details before printing. Batch, Mfg and Expiry come from 4. Items &gt; SW production details{noBatch ? ' - some items have none (blank on the sheet).' : '.'}
      </ReportNote>
      <ReportTable className="tw:mb-[8px]">
        <ReportBody>
          <ReportRow>
            <SheetLabel>Importer</SheetLabel>
            <ReportCell colSpan={3}>
              <b>{job.nameOfImporter || job.autoField_4 || ''}</b><br />
              {joinParts(job.address1 || job.autoField_6, job.address2 || job.autoField_7, job.city || job.autoField_8, job.state || job.autoField_9, job.pin || job.autoField_10)}
            </ReportCell>
          </ReportRow>
          <ReportRow>
            <SheetLabel>IEC</SheetLabel><ReportCell>{job.iecCode || job.autoField_5 || ''}</ReportCell>
            <SheetLabel>GSTIN</SheetLabel><ReportCell>{job.commercialTaxRegistrationNo || job.autoField_13 || ''}</ReportCell>
          </ReportRow>
          <ReportRow>
            <SheetLabel>Job No / Date</SheetLabel><ReportCell>{datedText(job.jobNo && job.jobNo !== 'DRAFT' ? job.jobNo : 'DRAFT', job.jobDate)}</ReportCell>
            <SheetLabel>B/E No / Date</SheetLabel><ReportCell>{datedText(job.beNo, job.beDate)}</ReportCell>
          </ReportRow>
          <ReportRow>
            <SheetLabel>MAWB / BL</SheetLabel><ReportCell>{datedText(job.mawbNo || job.mawbblNo, job.mawbDate)}</ReportCell>
            <SheetLabel>HAWB / HBL</SheetLabel><ReportCell>{datedText(job.hawbNo || job.hawbhblNo, job.hawbDate)}</ReportCell>
          </ReportRow>
          <ReportRow>
            <SheetLabel>IGM No / Date</SheetLabel><ReportCell>{datedText(job.igmNumber || job.igmNo, job.igmDate)}</ReportCell>
            <SheetLabel>Packages / Gross Wt</SheetLabel><ReportCell>{job.totalPkg || ''} {job.pkg || ''} / {job.grossWt || ''} {job.grossWtUnit || ''}</ReportCell>
          </ReportRow>
          <ReportRow>
            <SheetLabel>Supplier</SheetLabel><ReportCell>{job.supplierName || ''}</ReportCell>
            <SheetLabel>Country of Origin / Consignment</SheetLabel>
            <ReportCell>{job.countryOfOriginName || job.countryOfOrigin || ''} / {job.countryOfConsignmentName || job.countryOfConsignment || ''}</ReportCell>
          </ReportRow>
          <ReportRow>
            <SheetLabel>Invoice No / Date</SheetLabel><ReportCell colSpan={3}>{invoiceText}</ReportCell>
          </ReportRow>
          <ReportRow>
            <SheetLabel>Import Licence / Registration No (Form 10 / 10A / 41 / MD-15)</SheetLabel><ReportCell><Fill /></ReportCell>
            <SheetLabel>Valid up to</SheetLabel><ReportCell><Fill className="tw:min-w-[90px]" /></ReportCell>
          </ReportRow>
          <ReportRow>
            <SheetLabel>Importer&apos;s Drug Licence No (Form 20B / 21B) / other</SheetLabel><ReportCell><Fill /></ReportCell>
            <SheetLabel>Valid up to</SheetLabel><ReportCell><Fill className="tw:min-w-[90px]" /></ReportCell>
          </ReportRow>
        </ReportBody>
      </ReportTable>
      <ReportColumnGrid
        columns={['Sr', 'Inv/Item', 'Name of the Product', 'CTH', 'Manufacturer', 'Batch No', 'Mfg Date', 'Expiry Date', 'Quantity', 'Value (Rs)']}
        rightAligned={['Quantity', 'Value (Rs)']}
        rows={rows.map((row, index) => [
          index + 1,
          itemCell(row, row.tag),
          itemCell(row, <>{row.description}{row.generic && row.generic !== row.description ? <div className="tw:text-[#334155]">{row.generic}</div> : null}</>),
          itemCell(row, row.cth),
          itemCell(row, row.manufacturer),
          row.batch,
          toDmy(row.mfg),
          toDmy(row.exp),
          { value: row.qty ? formatAmount(row.qty, 3) + ' ' + row.uqc : '', className: 'tw:whitespace-nowrap' },
          row.value ? formatAmount(row.value) : '',
        ])}
        emptyText="No items in this job"
        footer={[{ value: `TOTAL (${(items || []).length} items)`, colSpan: 9 }, formatAmount(total)]}
      />
      <div className="tw:mt-[10px] tw:break-inside-avoid">
        <div>We declare that the above particulars are true and correct, and that the goods are imported under the licence / registration stated above.</div>
        <ReportTable className="tw:mt-[28px]">
          <ReportBody>
            <ReportRow>
              <ReportCell look="bare" className="tw:w-1/2 tw:border-t tw:border-solid tw:border-black tw:pt-[4px]">
                Signature of the Importer / Authorised Signatory<br />Place: ............ &nbsp; Date: ............
              </ReportCell>
              <ReportCell look="bare" className="tw:w-[5%]" />
              <ReportCell look="bare" className="tw:w-[45%] tw:border-t tw:border-solid tw:border-black tw:pt-[4px]">
                Customs Broker {job.chaCode ? '(' + job.chaCode + ')' : ''}
              </ReportCell>
            </ReportRow>
          </ReportBody>
        </ReportTable>
        <ReportTable className="tw:mt-[12px]">
          <ReportBody>
            <ReportRow><ReportCell className="tw:h-[60px]"><b>For the Port Office (ADC) - remarks / NOC</b></ReportCell></ReportRow>
          </ReportBody>
        </ReportTable>
      </div>
      <ReportFootnote>Value = assessable value (estimate, as the Duty Sheet). Final values are as assessed by Customs (ICES).</ReportFootnote>
    </ReportPage>
  );
}

const CONFIG_KEY = 'stamp_duty_sheet_cfg_v2';
const DEFAULT_CONFIG = { rate: '0.10', basis: 'avduty', round: 'up10' };

const readSavedConfig = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    const config = saved && typeof saved === 'object' ? saved : {};
    return {
      rate: config.rate != null ? String(config.rate) : DEFAULT_CONFIG.rate,
      basis: config.basis || DEFAULT_CONFIG.basis,
      round: config.round || DEFAULT_CONFIG.round,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
};

const BASIS_OPTIONS = [
  { value: 'av', label: 'Assessable value' },
  { value: 'avduty', label: 'Assessable value + duty' },
];
const ROUNDING_OPTIONS = [
  { value: 'up10', label: '%, rounded up to the next Rs 10' },
  { value: 'exact', label: '%, rounded to the rupee' },
  { value: 'per1000', label: 'Per Rs 1,000 or part' },
];

const STAMP_RIGHT_COLUMNS = ['Invoice Value', 'Items', 'Assessable Value (Rs)', 'Duty (Rs)'];

export function StampDutySheetReport({ jobData, items }) {
  const job = jobData || {};
  const invoices = job.invoices || [];
  const [config, setConfig] = useState(readSavedConfig);
  const { rate, basis, round } = config;
  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify({ rate, basis, round }));
    } catch { /* storage blocked */ }
  }, [rate, basis, round]);
  const updateConfig = (key) => (value) => setConfig((current) => ({ ...current, [key]: value }));

  const lines = (items || []).map((item) => ({ sr: itemInvoiceSr(item), duty: computeItemDuty(item, invoices, job) }));
  const groups = (invoices.length ? invoices : [{}]).map((invoice, index) => {
    const sr = invoices.length ? invoiceSrOf(invoice, index) : '1';
    const own = lines.filter((line) => !invoices.length || line.sr === sr);
    return {
      invoice,
      sr,
      assessableValue: own.reduce((sum, line) => sum + (line.duty.av || 0), 0),
      duty: own.reduce((sum, line) => sum + (line.duty.total || 0), 0),
      itemCount: own.length,
    };
  });
  const assessableValue = groups.reduce((sum, group) => sum + group.assessableValue, 0);
  const duty = groups.reduce((sum, group) => sum + group.duty, 0);
  const value = basis === 'avduty' ? assessableValue + duty : assessableValue;
  const ratePercent = Math.max(0, parseNumber(rate));
  const exact = value * ratePercent / 100;
  // up10: up to the next Rs 10 (a tiny tolerance so 35,360.00 itself is not pushed to 35,370)
  const stamp = round === 'per1000'
    ? Math.ceil(value / 1000) * (ratePercent * 10)
    : round === 'up10' ? Math.ceil(exact / 10 - 1e-9) * 10 : Math.round(exact);
  const basisText = basis === 'avduty' ? 'Assessable value + duty' : 'Assessable value';
  const ruleText = round === 'per1000'
    ? `Rs ${formatAmount(ratePercent * 10)} per Rs 1,000 or part`
    : round === 'up10'
      ? `${formatAmount(ratePercent, 2)} % of the value (${formatAmount(exact)}), rounded up to the next Rs 10`
      : `${formatAmount(ratePercent, 2)} % of the value, rounded to the rupee`;
  const invoiceValueOf = (invoice) => invoice.value || invoice.invValue || invoice.invoiceValue;
  return (
    <ReportPage>
      <ReportJobHeader title="Stamp Duty Sheet" jobData={job} />
      <ReportNote className="tw:flex tw:flex-wrap tw:items-center tw:gap-[10px] tw:py-[6px] tw:text-[#78350f]">
        <span className="tw:inline-flex tw:items-center tw:gap-1">
          <b>Rate %</b>
          <Input aria-label="Stamp duty rate %" className="tw:h-6 tw:w-[64px] tw:text-[11px]" value={rate}
            onChange={(event) => updateConfig('rate')(event.target.value.replace(/[^\d.]/g, ''))} />
        </span>
        <span className="tw:inline-flex tw:items-center tw:gap-1">
          <b>On</b>
          <SelectBox options={BASIS_OPTIONS} value={basis} onValueChange={updateConfig('basis')} className="tw:w-auto tw:text-[11px]" />
        </span>
        <span className="tw:inline-flex tw:items-center tw:gap-1">
          <b>Worked out</b>
          <SelectBox options={ROUNDING_OPTIONS} value={round} onValueChange={updateConfig('round')} className="tw:w-auto tw:text-[11px]" />
        </span>
        <span className="tw:basis-full tw:text-[10px]">
          Office rule: (assessable value + total duty) x 0.10 %, rounded up to the next Rs 10. Duty here is the estimate; after assessment check it with the assessed B/E. This setting is kept in this browser.
        </span>
      </ReportNote>
      <ReportColumnGrid
        className="tw:mb-[8px]"
        columns={['Inv', 'Invoice No', 'Date', 'Currency', 'Invoice Value', 'Items', 'Assessable Value (Rs)', 'Duty (Rs)']}
        rightAligned={STAMP_RIGHT_COLUMNS}
        rows={groups.map((group) => [
          group.sr,
          group.invoice.invNo || group.invoice.invoiceNo || '',
          toDmy(group.invoice.invDate || group.invoice.invoiceDate),
          group.invoice.currency || job.currency || '',
          invoiceValueOf(group.invoice) ? formatAmount(invoiceValueOf(group.invoice)) : '',
          group.itemCount,
          formatAmount(group.assessableValue),
          formatAmount(group.duty),
        ])}
        footer={[{ value: 'TOTAL', colSpan: 6 }, formatAmount(assessableValue), formatAmount(duty)]}
      />
      <ReportTable className="tw:ml-auto tw:w-[60%]">
        <ReportBody>
          <ReportRow>
            <SheetLabel>Value for stamp duty</SheetLabel><ReportCell>{basisText}</ReportCell><ReportCell align="right">{formatAmount(value)}</ReportCell>
          </ReportRow>
          <ReportRow>
            <SheetLabel>Rate</SheetLabel><ReportCell colSpan={2}>{ruleText}</ReportCell>
          </ReportRow>
          <ReportRow tone="total">
            <SheetLabel>Stamp duty (Rs)</SheetLabel><ReportCell /><ReportCell align="right" className="tw:text-[11pt]">{formatAmount(stamp)}</ReportCell>
          </ReportRow>
        </ReportBody>
      </ReportTable>
      <ReportFootnote>Assessable value and duty are the estimate of the Duty Sheet; after assessment use the values of the assessed B/E.</ReportFootnote>
    </ReportPage>
  );
}
