// Duty figures use computeItemDuty, the same estimate as 4. Items and the E-Annex checklist.
import { computeItemDuty } from '../../ItemGridTabParts/helpers';
import { cn } from '@/lib/utils';
import {
  exRateOf, formatAmount, invoiceNoOf, invoiceSrOf, itemCthOf, itemDescriptionOf, itemInvoiceSr, itemNoOf, itemPriceOf, itemQtyOf,
  itemTagOf, itemUqcOf, parseJsonList, parseJsonObject, parseNumber, toDmy,
} from './reportFormat';
import {
  ReportBand, ReportBody, ReportCell, ReportColumnGrid, ReportFootnote, ReportLabelCell, ReportNote, ReportPage, ReportRow,
  ReportTable, ReportTitle,
} from '../reportTable';

const jobNoText = (job) => (job.jobNo && job.jobNo !== 'DRAFT' ? job.jobNo : 'DRAFT');
const invoiceDateOf = (invoice) => invoice.invDate || invoice.invoiceDate;
const invoiceValueOf = (invoice) => invoice.value || invoice.invValue;
const invoiceTermsOf = (invoice) => invoice.terms || invoice.termsOfInvoice || '';
const countryOfOriginOf = (item, jobData) => item.countryOfOrigin || item.coo || jobData?.countryOfOrigin || '';
const otherDutyOf = (duty) => duty.health + duty.add + duty.other;

// items grouped by the invoice they belong to; a job without invoices is one group of all items
const groupItemsByInvoice = (invoices, items) => (invoices.length
  ? invoices.map((invoice, index) => ({
    invoice,
    sr: invoiceSrOf(invoice, index),
    items: (items || []).filter((item) => itemInvoiceSr(item) === invoiceSrOf(invoice, index)),
  }))
  : [{ invoice: {}, sr: '1', items: items || [] }]);

export function ReportJobHeader({ title, jobData }) {
  const job = jobData || {};
  const rows = [
    ['Job No', jobNoText(job), 'Job Date', toDmy(job.jobDate)],
    ['Importer', job.nameOfImporter || job.autoField_4 || '', 'IEC', job.iecCode || job.autoField_5 || ''],
    ['B/E No', job.beNo || '', 'B/E Date', toDmy(job.beDate)],
    ['MAWB / BL', job.mawbNo || job.mawbblNo || '', 'HAWB / HBL', job.hawbNo || job.hawbhblNo || ''],
    ['IGM No', job.igmNumber || job.igmNo || '', 'Port', job.branchCode || job.portCode || ''],
  ];
  return (
    <div className="tw:mb-[8px]">
      <ReportTitle className="tw:mb-[6px] tw:uppercase">{title}</ReportTitle>
      <ReportTable>
        <ReportBody>
          {rows.map(([leftLabel, leftValue, rightLabel, rightValue]) => (
            <ReportRow key={leftLabel}>
              <ReportLabelCell className="tw:w-[14%]">{leftLabel}</ReportLabelCell>
              <ReportCell className="tw:w-[36%]">{leftValue}</ReportCell>
              <ReportLabelCell className="tw:w-[14%]">{rightLabel}</ReportLabelCell>
              <ReportCell className="tw:w-[36%]">{rightValue}</ReportCell>
            </ReportRow>
          ))}
        </ReportBody>
      </ReportTable>
    </div>
  );
}

const DUTY_SHEET_COLUMNS = ['Inv/Item', 'Description', 'CTH', 'Qty', 'Ass. Value', 'BCD %', 'BCD', 'SWS', 'IGST %', 'IGST', 'Other', 'Total Duty'];

export function DutySheetReport({ jobData, items }) {
  const invoices = jobData?.invoices || [];
  const lines = (items || []).map((item) => ({ item, duty: computeItemDuty(item, invoices, jobData || {}) }));
  const totalOf = (key) => lines.reduce((sum, line) => sum + (line.duty[key] || 0), 0);
  const missingRate = lines.some((line) => !line.duty.rateFound);
  const rows = lines.map(({ item, duty }, index) => [
    itemTagOf(item, index),
    String(itemDescriptionOf(item)).slice(0, 120),
    itemCthOf(item),
    `${formatAmount(itemQtyOf(item), 3)} ${itemUqcOf(item)}`,
    formatAmount(duty.av),
    item.bcdRate ?? '',
    formatAmount(duty.bcd),
    formatAmount(duty.sws),
    parseJsonObject(item.igstData).rate ?? '',
    formatAmount(duty.igst),
    formatAmount(otherDutyOf(duty)),
    { value: formatAmount(duty.total), className: 'tw:font-bold' },
  ]);
  return (
    <ReportPage>
      <ReportJobHeader title="Item-wise Duty Sheet (Estimate)" jobData={jobData} />
      {missingRate && <ReportNote>Exchange rate missing for some invoices - assessable value may be wrong.</ReportNote>}
      <ReportColumnGrid
        columns={DUTY_SHEET_COLUMNS}
        rightAligned={DUTY_SHEET_COLUMNS.filter((column) => !['Description', 'CTH', 'Inv/Item'].includes(column))}
        rows={rows}
        emptyText="No items in this job"
        footer={[
          { value: `TOTAL (${lines.length} items)`, colSpan: 4 },
          formatAmount(totalOf('av')), '',
          formatAmount(totalOf('bcd')),
          formatAmount(totalOf('sws')), '',
          formatAmount(totalOf('igst')),
          formatAmount(totalOf('health') + totalOf('add') + totalOf('other')),
          formatAmount(totalOf('total')),
        ]}
      />
      <ReportFootnote>Estimate only. Final duty is as assessed by Customs (ICES).</ReportFootnote>
    </ReportPage>
  );
}

const itemAmountOf = (item) => parseNumber(itemQtyOf(item)) * parseNumber(itemPriceOf(item)) || parseNumber(item.value);

export function AnnexureReport({ jobData, items }) {
  const invoices = jobData?.invoices || [];
  const groups = groupItemsByInvoice(invoices, items);
  const orphans = (items || []).filter((item) => invoices.length && !invoices.some((invoice, index) => invoiceSrOf(invoice, index) === itemInvoiceSr(item)));
  if (orphans.length) groups.push({ invoice: { invNo: '(no matching invoice)' }, sr: '-', items: orphans });
  return (
    <ReportPage>
      <ReportJobHeader title="Invoice & Item Annexure" jobData={jobData} />
      {groups.map((group, groupIndex) => {
        const { invoice } = group;
        const total = group.items.reduce((sum, item) => sum + itemAmountOf(item), 0);
        return (
          <div key={groupIndex} className="tw:mb-[10px] tw:break-inside-avoid-page">
            <ReportBand>
              Invoice {group.sr}: {invoiceNoOf(invoice)} {invoiceDateOf(invoice) ? `Dt. ${toDmy(invoiceDateOf(invoice))}` : ''} &nbsp; | &nbsp; {invoice.currency || ''} {invoiceValueOf(invoice) ? formatAmount(invoiceValueOf(invoice)) : ''} &nbsp; {invoiceTermsOf(invoice)}
            </ReportBand>
            <ReportColumnGrid
              columns={['Item', 'Description', 'CTH', 'Qty', 'UQC', 'Unit Price', 'Amount', 'Country of Origin']}
              rightAligned={['Qty', 'Unit Price', 'Amount']}
              rows={group.items.map((item, index) => [
                itemNoOf(item, index),
                itemDescriptionOf(item),
                itemCthOf(item),
                formatAmount(itemQtyOf(item), 3),
                itemUqcOf(item),
                formatAmount(itemPriceOf(item), 4),
                formatAmount(itemAmountOf(item)),
                countryOfOriginOf(item, jobData),
              ])}
              emptyText="No items"
              footer={[{ value: `Invoice total (${group.items.length} items)`, colSpan: 6 }, formatAmount(total), '']}
            />
          </div>
        );
      })}
    </ReportPage>
  );
}

export function SupportingDocsReport({ jobData, docs }) {
  return (
    <ReportPage>
      <ReportJobHeader title="Supporting Documents (e-Sanchit)" jobData={jobData} />
      <ReportColumnGrid
        columns={['#', 'Doc Code', 'IRN', 'DRN', 'Document / File', 'Issued By', 'Issue Date', 'Expiry']}
        rows={(docs || []).map((doc, index) => [
          index + 1, doc.docCode || doc.documentTypeCode || '', doc.irn || '', doc.drn || '',
          doc.fileName || doc.docName || '', doc.issuerName || '', toDmy(doc.issueDate), toDmy(doc.expiryDate),
        ])}
        emptyText="No supporting documents uploaded for this job"
      />
    </ReportPage>
  );
}

const INVOICE_WISE_COLUMNS = ['Item', 'Description', 'CTH', 'Qty / UQC', 'Ass. Value', 'BCD', 'SWS', 'IGST', 'Total Duty'];

export function InvoiceWiseChecklistReport({ jobData, items }) {
  const invoices = jobData?.invoices || [];
  const groups = groupItemsByInvoice(invoices, items).map((group) => {
    const lines = group.items.map((item, index) => ({ item, index, duty: computeItemDuty(item, invoices, jobData || {}) }));
    return {
      ...group,
      lines,
      assessableValue: lines.reduce((sum, line) => sum + line.duty.av, 0),
      duty: lines.reduce((sum, line) => sum + line.duty.total, 0),
    };
  });
  const grandAssessableValue = groups.reduce((sum, group) => sum + group.assessableValue, 0);
  const grandDuty = groups.reduce((sum, group) => sum + group.duty, 0);
  return (
    <ReportPage>
      <ReportJobHeader title="Invoice-wise Checklist" jobData={jobData} />
      {groups.map((group, groupIndex) => {
        const { invoice } = group;
        const facts = [
          ['Supplier', invoice.supplierName || jobData?.supplierName || ''],
          ['Currency', invoice.currency || ''],
          ['Inv. Value', invoiceValueOf(invoice) ? formatAmount(invoiceValueOf(invoice)) : ''],
          ['Terms', invoiceTermsOf(invoice)],
          ['Freight', invoice.freight ? formatAmount(invoice.freight) : ''],
          ['Insurance', invoice.insurance ? formatAmount(invoice.insurance) : ''],
          ['Misc', invoice.miscCharges ? formatAmount(invoice.miscCharges) : ''],
        ];
        return (
          <div key={groupIndex} className="tw:mb-[12px]">
            <ReportBand>Invoice {group.sr}: {invoiceNoOf(invoice)} {invoiceDateOf(invoice) ? `Dt. ${toDmy(invoiceDateOf(invoice))}` : ''}</ReportBand>
            <ReportTable className="tw:mb-[4px] tw:text-[8.5pt]">
              <ReportBody>
                <ReportRow>
                  {facts.map(([label, value]) => <ReportCell key={label}><b>{label}:</b> {value || '-'}</ReportCell>)}
                </ReportRow>
              </ReportBody>
            </ReportTable>
            <ReportColumnGrid
              columns={INVOICE_WISE_COLUMNS}
              rightAligned={['Ass. Value', 'BCD', 'SWS', 'IGST', 'Total Duty']}
              rows={group.lines.map(({ item, index, duty }) => [
                itemNoOf(item, index),
                String(itemDescriptionOf(item)).slice(0, 100),
                itemCthOf(item),
                `${formatAmount(itemQtyOf(item), 3)} ${itemUqcOf(item)}`,
                formatAmount(duty.av), formatAmount(duty.bcd), formatAmount(duty.sws), formatAmount(duty.igst), formatAmount(duty.total),
              ])}
              footer={['', `Invoice total (${group.lines.length} items)`, '', '', formatAmount(group.assessableValue), '', '', '', formatAmount(group.duty)]}
              emptyText="No items in this invoice"
            />
          </div>
        );
      })}
      <div className="tw:border-t-2 tw:border-solid tw:border-black tw:pt-[4px] tw:text-right tw:font-bold">
        Grand total - Ass. Value: {formatAmount(grandAssessableValue)} &nbsp;&nbsp; Duty (estimate): {formatAmount(grandDuty)}
      </div>
    </ReportPage>
  );
}

const joinNotification = (...parts) => parts.filter(Boolean).join(' / ') || '-';

export function ClassificationReport({ jobData, items }) {
  return (
    <ReportPage>
      <ReportJobHeader title="Classification Details" jobData={jobData} />
      <ReportColumnGrid
        columns={['Inv/Item', 'Description', 'CTH (RITC)', 'BCD Notn / Sr', 'BCD %', 'IGST Notn / Sr', 'IGST %', 'Country of Origin']}
        rightAligned={['BCD %', 'IGST %']}
        rows={(items || []).map((item, index) => {
          const igst = parseJsonObject(item.igstData);
          return [
            itemTagOf(item, index),
            itemDescriptionOf(item),
            itemCthOf(item),
            joinNotification(item.bcdNotificationNo || item.bcdNotification, item.bcdSrNo || item.bcdNotificationSrNo),
            item.bcdRate ?? '',
            joinNotification(igst.notnNo, igst.srNo),
            igst.rate ?? '',
            countryOfOriginOf(item, jobData),
          ];
        })}
        emptyText="No items in this job"
      />
    </ReportPage>
  );
}

const exemptionRowsOf = (item, index) => {
  const tag = itemTagOf(item, index);
  const cth = itemCthOf(item);
  const description = String(itemDescriptionOf(item)).slice(0, 80);
  const rows = [];
  const bcdNotification = item.bcdNotificationNo || item.bcdNotification;
  if (bcdNotification) rows.push([tag, cth, description, 'BCD', bcdNotification, item.bcdSrNo || item.bcdNotificationSrNo || '', item.bcdRate ?? '']);
  const igst = parseJsonObject(item.igstData);
  if (igst.notnNo) rows.push([tag, cth, description, 'IGST', igst.notnNo, igst.srNo || '', igst.rate ?? '']);
  const antiDumping = parseJsonObject(item.addData);
  const antiDumpingNotification = antiDumping.notnNo || antiDumping.notificationNo;
  if (antiDumpingNotification) rows.push([tag, cth, description, 'ADD', antiDumpingNotification, antiDumping.srNo || antiDumping.notificationSrNo || '', antiDumping.rate ?? '']);
  const otherDuty = parseJsonObject(item.otherDutyData);
  Object.entries(otherDuty)
    .filter(([key, value]) => /_notificationNo$|_notnNo$/.test(key) && value)
    .forEach(([key, value]) => rows.push([tag, cth, description, key.split('_')[0].toUpperCase(), value, otherDuty[key.replace(/No$/, 'SrNo')] || '', '']));
  return rows;
};

export function ExemptionReport({ jobData, items }) {
  return (
    <ReportPage>
      <ReportJobHeader title="Duty Exemption / Notification Details" jobData={jobData} />
      <ReportColumnGrid
        columns={['Inv/Item', 'CTH', 'Description', 'Duty', 'Notification', 'Sr No', 'Rate %']}
        rightAligned={['Rate %']}
        rows={(items || []).flatMap(exemptionRowsOf)}
        emptyText="No exemption notification claimed on any item"
      />
    </ReportPage>
  );
}

const INVOICE_PARTICULARS_COLUMNS = ['Sr', 'Invoice No', 'Date', 'Supplier', 'Terms', 'Currency', 'Ex. Rate', 'Invoice Value', 'Freight', 'Insurance', 'Misc'];

export function InvoiceParticularsReport({ jobData }) {
  const invoices = jobData?.invoices || [];
  const rateText = (invoice) => {
    const rate = exRateOf(invoice.currency, jobData, invoice);
    return rate ? formatAmount(rate, 4) : '';
  };
  return (
    <ReportPage>
      <ReportJobHeader title="Invoice Particulars" jobData={jobData} />
      <ReportColumnGrid
        columns={INVOICE_PARTICULARS_COLUMNS}
        rightAligned={['Ex. Rate', 'Invoice Value', 'Freight', 'Insurance', 'Misc']}
        rows={invoices.map((invoice, index) => [
          invoiceSrOf(invoice, index), invoiceNoOf(invoice), toDmy(invoiceDateOf(invoice)), invoice.supplierName || jobData?.supplierName || '',
          invoiceTermsOf(invoice), invoice.currency || '', rateText(invoice), formatAmount(invoiceValueOf(invoice)),
          formatAmount(invoice.freight), formatAmount(invoice.insurance), formatAmount(invoice.miscCharges),
        ])}
        emptyText="No invoices in this job"
      />
    </ReportPage>
  );
}

export function IgmDetailsReport({ jobData }) {
  const job = jobData || {};
  const igmRows = parseJsonList(job._igmRows);
  const fields = [
    ['IGM No', job.igmNumber || job.igmNo || ''], ['IGM Date', toDmy(job.igmDate)], ['Inward Date', toDmy(job.inwardDate)],
    ['Port / Gateway', job.portCode || job.branchCode || ''], ['Flight / Voyage', job.flightVoyage || ''],
    ['MAWB / MBL No', job.mawbNo || ''], ['MAWB Date', toDmy(job.mawbDate)], ['HAWB / HBL No', job.hawbNo || ''], ['HAWB Date', toDmy(job.hawbDate)],
    ['Packages', [job.totalPkg || job.pkg, job.pkgType].filter(Boolean).join(' ')],
    ['Gross Weight', [job.grossWt, job.grossWtUnit].filter(Boolean).join(' ')], ['Chargeable Wt', job.chargableWeight || ''],
    ['Marks & Nos', job.marksAndNumbers1 || ''],
  ];
  return (
    <ReportPage>
      <ReportJobHeader title="IGM Details" jobData={jobData} />
      <ReportTable className="tw:mb-[8px]">
        <ReportBody>
          {fields.map(([label, value]) => (
            <ReportRow key={label}>
              <ReportLabelCell className="tw:w-[28%]">{label}</ReportLabelCell>
              <ReportCell>{value || '-'}</ReportCell>
            </ReportRow>
          ))}
        </ReportBody>
      </ReportTable>
      {igmRows.length > 0 && (
        <ReportColumnGrid
          columns={['#', 'IGM No', 'IGM Date', 'Inward Date', 'Gateway', 'MAWB', 'HAWB', 'Pkgs', 'Gross Wt']}
          rightAligned={['Pkgs', 'Gross Wt']}
          rows={igmRows.map((igm, index) => [
            index + 1, igm.igmNo || igm.igmNumber || '', toDmy(igm.igmDate), toDmy(igm.inwardDate), igm.gatewayPort || igm.portCode || '',
            igm.mawbNo || '', igm.hawbNo || '', igm.pkg || igm.totalPkg || '', igm.grossWt || '',
          ])}
          emptyText=""
        />
      )}
    </ReportPage>
  );
}

export function ContainerReport({ jobData }) {
  return (
    <ReportPage>
      <ReportJobHeader title="Container Details" jobData={jobData} />
      <ReportColumnGrid
        columns={['#', 'Container No', 'Size', 'Type', 'LCL / FCL', 'Seal No', 'IGM No', 'IGM Date']}
        rows={parseJsonList(jobData?.containers).map((container, index) => [
          container.srNo || index + 1, container.contNo || '', container.contSize || '', container.contType || '',
          container.lclFcl || '', container.sealNo || '', container.igmNo || '', toDmy(container.igmDate),
        ])}
        emptyText="No containers in this job (air shipment or not entered)"
      />
    </ReportPage>
  );
}

export function BondReport({ jobData }) {
  const job = jobData || {};
  let bonds = parseJsonList(job._bondRows).filter((bond) => bond && (bond.bondNo || bond.bondCode));
  if (!bonds.length && (job.bondNo || job.autoField_24)) {
    bonds = [{ bondNo: job.bondNo || job.autoField_24, bondCode: job.autoField_26, bondPort: job.autoField_27, bondType: job.bondType, bondAmt: job.bondAmount }];
  }
  return (
    <ReportPage>
      <ReportJobHeader title="Bond Details" jobData={jobData} />
      <div className="tw:mb-[6px]"><b>B/E Type:</b> {job.boeType || 'HOME'} {job.warehouseCode ? <>&nbsp; <b>Warehouse:</b> {job.warehouseCode}</> : null}</div>
      <ReportColumnGrid
        columns={['#', 'Bond No', 'Bond Code', 'Bond Type', 'Port', 'Amount']}
        rightAligned={['Amount']}
        rows={bonds.map((bond, index) => [
          index + 1, bond.bondNo || '', bond.bondCode || bond.bond || '', bond.bondType || '', bond.bondPort || '',
          bond.bondAmt || bond.bondAmount ? formatAmount(bond.bondAmt || bond.bondAmount) : '',
        ])}
        emptyText="No bond in this job (bond is needed only for Warehouse B/E)"
      />
    </ReportPage>
  );
}

const CHA_COLUMNS = ['Item No', 'Item Details', 'Unit Price', 'Qty', 'UQC', 'Assess Value', 'CTH', 'CETH', 'BCD Rate', 'BCD (Rs)', 'SWS Rate', 'SWS (Rs)', 'IGST Rate', 'IGST (Rs)', 'Other Duty (Rs)', 'Total Duty (Rs)'];
const CHA_LEFT_COLUMNS = ['Item No', 'Item Details', 'UQC', 'CTH', 'CETH'];

function SummaryLabel({ className, ...props }) {
  return <ReportCell look="bare" className={cn('tw:py-[2px] tw:pr-[8px] tw:font-bold tw:whitespace-nowrap', className)} {...props} />;
}

function SummaryValue({ className, ...props }) {
  return <ReportCell look="bare" className={cn('tw:py-[2px] tw:pr-[18px]', className)} {...props} />;
}

const percentText = (value) => (String(value ?? '').trim() === '' ? '' : `${formatAmount(value)} %`);
const sumOf = (lines, pick) => lines.reduce((sum, line) => sum + pick(line.duty), 0);

function ChaLicenceRows({ items }) {
  const licences = items.flatMap((item) => parseJsonList(item.licenceData)
    .filter((licence) => licence && licence.licenceNo)
    .map((licence) => ({ ...licence, item: item.itemSrNo || item.itemNo })));
  if (!licences.length) {
    return ['Licence No. & Dt.', 'Debited Value', 'Debited Quantity'].map((label) => (
      <ReportRow key={label}><SummaryLabel>{label}</SummaryLabel><SummaryValue>-</SummaryValue></ReportRow>
    ));
  }
  return licences.map((licence, index) => (
    <ReportRow key={index}>
      <SummaryLabel>Licence No. &amp; Dt.</SummaryLabel>
      <SummaryValue>{licence.licenceNo}{licence.licenceDate ? ` - ${toDmy(licence.licenceDate)}` : ''}{licence.licenceCode ? ` (${licence.licenceCode})` : ''} &nbsp; [Item {licence.item}]</SummaryValue>
      <SummaryLabel>Debited Value</SummaryLabel>
      <SummaryValue>{licence.debitValue ? formatAmount(licence.debitValue) : ''}</SummaryValue>
      <SummaryLabel>Debited Quantity</SummaryLabel>
      <SummaryValue>{licence.debitQty ? `${formatAmount(licence.debitQty, 3)} ${licence.debitUqc || ''}` : ''}</SummaryValue>
    </ReportRow>
  ));
}

function ChaInvoiceBlock({ group, job, invoices }) {
  const { invoice } = group;
  const rate = exRateOf(invoice.currency, job, invoice);
  const lines = group.items.map((item, index) => ({ item, index, duty: computeItemDuty(item, invoices, job), igst: parseJsonObject(item.igstData) }));
  const headingClass = 'tw:text-[9pt] tw:font-bold';
  return (
    <div className="tw:mb-[12px]">
      <ReportColumnGrid
        className="tw:text-[8pt]"
        headClassName="tw:align-bottom"
        columns={CHA_COLUMNS}
        rightAligned={CHA_COLUMNS.filter((column) => !CHA_LEFT_COLUMNS.includes(column))}
        headTop={(
          <ReportRow>
            <ReportCell colSpan={11} className={headingClass}>
              Invoice No. &amp; Date : {invoiceNoOf(invoice)}{invoiceDateOf(invoice) ? ` - ${toDmy(invoiceDateOf(invoice))}` : ''} &nbsp; ({invoice.currency || ''} {invoiceValueOf(invoice) ? formatAmount(invoiceValueOf(invoice)) : ''} {invoiceTermsOf(invoice)})
            </ReportCell>
            <ReportCell colSpan={5} align="right" className={headingClass}>Exchange Rate : {rate ? formatAmount(rate, 4) : 'not entered'}</ReportCell>
          </ReportRow>
        )}
        rows={lines.map(({ item, index, duty, igst }) => [
          itemNoOf(item, index),
          { value: itemDescriptionOf(item), className: 'tw:min-w-[140px]' },
          formatAmount(itemPriceOf(item), 6),
          formatAmount(itemQtyOf(item), 3),
          itemUqcOf(item),
          formatAmount(duty.av),
          itemCthOf(item),
          item.ceth || item.cethCode || itemCthOf(item),
          percentText(item.bcdRate), formatAmount(duty.bcd),
          percentText(String(item.swsRate ?? '').trim() === '' ? 10 : item.swsRate), formatAmount(duty.sws),
          percentText(igst.rate), formatAmount(duty.igst),
          formatAmount(otherDutyOf(duty)),
          { value: formatAmount(duty.total), className: 'tw:font-bold' },
        ])}
        emptyText="No items in this invoice"
        footer={[
          { value: `Invoice total (${lines.length} items)`, colSpan: 5 },
          formatAmount(sumOf(lines, (duty) => duty.av)),
          { value: '', colSpan: 3 },
          formatAmount(sumOf(lines, (duty) => duty.bcd)), '',
          formatAmount(sumOf(lines, (duty) => duty.sws)), '',
          formatAmount(sumOf(lines, (duty) => duty.igst)),
          formatAmount(sumOf(lines, otherDutyOf)),
          formatAmount(sumOf(lines, (duty) => duty.total)),
        ]}
      />
      <ReportTable className="tw:mt-[6px] tw:w-auto tw:text-[8.5pt]">
        <ReportBody><ChaLicenceRows items={group.items} /></ReportBody>
      </ReportTable>
    </div>
  );
}

// CHA Checklist: job totals, then per invoice the items with assessable value and each duty
export function ChaChecklistReport({ jobData, items }) {
  const job = jobData || {};
  const invoices = job.invoices || [];
  const groups = groupItemsByInvoice(invoices, items);
  const allDuties = groups.flatMap((group) => group.items.map((item) => computeItemDuty(item, invoices, job)));
  const totalAssessableValue = allDuties.reduce((sum, duty) => sum + duty.av, 0);
  const totalDuty = allDuties.reduce((sum, duty) => sum + duty.total, 0);
  const containerCount = parseJsonList(job.containers).length;
  return (
    <ReportPage>
      <ReportTitle className="tw:mb-[8px] tw:border-b-[1.5px] tw:border-solid tw:border-black tw:pb-[4px]">CHA Checklist</ReportTitle>
      <ReportTable className="tw:mb-[8px] tw:w-auto">
        <ReportBody>
          <ReportRow>
            <SummaryLabel>Job No.</SummaryLabel><SummaryValue>{jobNoText(job)}</SummaryValue>
            <SummaryLabel>Total Value</SummaryLabel><SummaryValue>{formatAmount(totalAssessableValue)}</SummaryValue>
            <SummaryLabel>Total Duty</SummaryLabel><SummaryValue>{formatAmount(totalDuty)}</SummaryValue>
          </ReportRow>
          <ReportRow>
            <SummaryLabel>Importer</SummaryLabel><SummaryValue colSpan={3}>{job.nameOfImporter || job.autoField_4 || ''}</SummaryValue>
            <SummaryLabel>IEC</SummaryLabel><SummaryValue>{job.iecCode || job.autoField_5 || ''}</SummaryValue>
          </ReportRow>
          <ReportRow>
            <SummaryLabel>MAWB / HAWB No</SummaryLabel><SummaryValue colSpan={3}>({job.mawbNo || 'NOMAWB'} / {job.hawbNo || '-'})</SummaryValue>
            <SummaryLabel>B/E No.</SummaryLabel><SummaryValue>{job.beNo ? `${job.beNo} Dt. ${toDmy(job.beDate)}` : ''}</SummaryValue>
          </ReportRow>
          <ReportRow>
            <SummaryLabel>No. of Pkgs</SummaryLabel><SummaryValue>{job.totalPkg || job.pkg || ''}</SummaryValue>
            <SummaryLabel>Gross Wt.</SummaryLabel><SummaryValue>{job.grossWt ? `${formatAmount(job.grossWt, 3)} ${job.grossWtUnit || ''}` : ''}</SummaryValue>
            <SummaryLabel>No. of Containers</SummaryLabel><SummaryValue>{containerCount || ''}</SummaryValue>
          </ReportRow>
        </ReportBody>
      </ReportTable>
      {groups.map((group, groupIndex) => <ChaInvoiceBlock key={groupIndex} group={group} job={job} invoices={invoices} />)}
      <ReportFootnote className="tw:mt-0 tw:text-[7.5pt]">Duty is our estimate from the rates entered in the job; final duty is as assessed by Customs (ICES).</ReportFootnote>
    </ReportPage>
  );
}
