// Printable reports of Export > Get Report, in the paper look of Import > Report (title, job box, ruled tables). Each
// report reads the job on screen (header, invoices, items, scheme rows); nothing is fetched except masters passed in.
import { asList } from '../../../../../utils/asList';
import { rateText } from '../../../../../utils/cbicExchange';
import { claimsRodtep, num, itemFobInr, rodtepAmount, dbkAmount, CAP_NEEDS_QTY, rodtepRowOf, rodtepRateOf, rodtepQtyOf, filedTotalPmv } from '../../Schemes/schemeUtils';
import { cellSpecOf } from '../../../../JobEntry/Tabs/ReportTabParts/sections/reportFormat';
import {
  ReportBody, ReportCell, ReportFootnote, ReportHeadCell, ReportLabelCell, ReportPage, ReportRow, ReportTable, ReportTableHeader, ReportTitle,
} from '../../../../JobEntry/Tabs/ReportTabParts/reportTable';

const formatAmount = (value, decimals = 2) => num(value).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const toSlashDate = (value) => {
  const match = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
};
const invoiceSrOf = (item) => String(item.invSr || item.invSrNo || 1);
const itemSrOf = (item, index) => String(item.itemSr || item.itemSrNo || index + 1);
const itemTag = (item, index) => `${invoiceSrOf(item)}/${itemSrOf(item, index)}`;
const invoiceNoOf = (invoice) => invoice.no || invoice.invoiceNo || '';
const invoiceValueOf = (invoice) => invoice.value || invoice.invoiceValue;
const invoiceDateOf = (invoice) => toSlashDate(invoice.date || invoice.invoiceDate);
const contractTypeOf = (invoice) => invoice.contractType || invoice.natureOfContract || '';
const schemeCodeText = (item) => String(item.scheme || '').split(/[\s-]/)[0];
const containersOf = (job, containers) => (Array.isArray(job.Containers) && job.Containers.length ? job.Containers : (containers || []));
const itemsOfInvoice = (items, invoiceIndex) => (items || []).map((item, index) => ({ item, index })).filter(({ item }) => invoiceSrOf(item) === String(invoiceIndex + 1));
const right = (value, extra = {}) => ({ value, align: 'right', ...extra });
const BOLD = 'tw:font-bold';

export function EmptyRow({ colSpan, text }) {
  return (
    <ReportRow>
      <ReportCell colSpan={colSpan} align="center" className="tw:py-[10px] tw:text-[#64748b]">{text}</ReportCell>
    </ReportRow>
  );
}

function GridCells({ cells }) {
  return cells.map((cell, index) => {
    const spec = cellSpecOf(cell);
    return <ReportCell key={index} align={spec.align} colSpan={spec.colSpan} title={spec.title} className={spec.className}>{spec.value}</ReportCell>;
  });
}

// headings, rows of cells (value or { value, align, colSpan, title, className }), an empty line and total lines
function ExportGrid({ headings, rows, emptyText, totals = [], rowClassName, className }) {
  return (
    <ReportTable className={className}>
      <ReportTableHeader>
        <ReportRow>{headings.map((heading) => <ReportHeadCell key={heading} align="left">{heading}</ReportHeadCell>)}</ReportRow>
      </ReportTableHeader>
      <ReportBody>
        {rows.map((cells, index) => <ReportRow key={index} className={rowClassName}><GridCells cells={cells} /></ReportRow>)}
        {rows.length === 0 && <EmptyRow colSpan={headings.length} text={emptyText} />}
        {totals.map((cells, index) => <ReportRow key={index} className={BOLD}><GridCells cells={cells} /></ReportRow>)}
      </ReportBody>
    </ReportTable>
  );
}

// label / value pairs, two to a line
function FactTable({ rows, labelWidth = 'tw:w-[15%]', valueWidth = 'tw:w-[35%]', className }) {
  return (
    <ReportTable className={className}>
      <ReportBody>
        {rows.map(([leftLabel, leftValue, rightLabel, rightValue], index) => (
          <ReportRow key={index}>
            <ReportLabelCell className={labelWidth}>{leftLabel}</ReportLabelCell>
            <ReportCell className={valueWidth}>{leftValue}</ReportCell>
            <ReportLabelCell className={labelWidth}>{rightLabel}</ReportLabelCell>
            <ReportCell className={valueWidth}>{rightValue}</ReportCell>
          </ReportRow>
        ))}
      </ReportBody>
    </ReportTable>
  );
}

const BlockTitle = ({ children }) => <div className="tw:mt-[6px] tw:mb-[3px] tw:font-bold">{children}</div>;

export function ExportReportHeader({ title, d }) {
  const job = d || {};
  return (
    <div className="tw:mb-[8px]">
      <ReportTitle className="tw:mb-[6px] tw:uppercase">{title}</ReportTitle>
      <FactTable
        rows={[
          ['Job No', job.jobNo && job.jobNo !== 'DRAFT' ? job.jobNo : 'DRAFT', 'Job Date', toSlashDate(job.jobDate)],
          ['Exporter', job.shipperName || job.exporterName || '', 'IEC', job.shipperIec || job.ieCode || ''],
          ['S/B No', job.sbNo || job.sbNumber || '', 'S/B Date', toSlashDate(job.sbDate || job.autoField_26)],
          ['MAWB No', job.mawbNo || job.autoField_22 || '', 'HAWB No', job.hawbNo || job.autoField_24 || ''],
          ['Port of Loading', job.loadingPortCode || job.customsPortCode || job.customsPortName || '', 'Destination',
            [job.destPortName || job.destPortCode, job.destCountryName || job.destCountryCode].filter(Boolean).join(', ')],
        ]}
      />
    </div>
  );
}

function ReportSheet({ title, d, children }) {
  return (
    <ReportPage>
      <ExportReportHeader title={title} d={d} />
      {children}
    </ReportPage>
  );
}

const ITEM_GRID_HEADINGS = (currency) => ['Item', 'Scheme', 'RITC', 'Description', 'Qty', 'UQC', 'Rate', `Value (${currency || 'FC'})`];
const itemGridCells = (item, index) => [
  itemSrOf(item, index), schemeCodeText(item), item.ritc, item.desc || item.description,
  right(formatAmount(item.qty, 3)), item.unit || item.uqc, right(formatAmount(item.rate || item.price, 4)), right(formatAmount(item.totalFc || item.total)),
];

// Invoice-wise checklist: each invoice with its items
export function InvoiceWiseReport({ d, items }) {
  const invoices = d?.invoices || [];
  return (
    <ReportSheet title="Invoice Wise Checklist" d={d}>
      {invoices.length === 0 && <ReportTable><ReportBody><EmptyRow colSpan={1} text="No invoice in this job" /></ReportBody></ReportTable>}
      {invoices.map((invoice, invoiceIndex) => {
        const rows = itemsOfInvoice(items, invoiceIndex);
        const total = rows.reduce((sum, { item }) => sum + num(item.totalFc || item.total), 0);
        const totalFob = rows.reduce((sum, { item }) => sum + itemFobInr(item), 0);
        const difference = total - num(invoiceValueOf(invoice));
        return (
          <div key={invoiceIndex} className="tw:mb-[10px] tw:break-inside-avoid">
            <BlockTitle>
              Invoice {invoiceIndex + 1}: {invoiceNoOf(invoice)} dt {invoiceDateOf(invoice)} - {invoice.currency} {formatAmount(invoiceValueOf(invoice))} ({contractTypeOf(invoice)}) - FOB ₹ {formatAmount(invoice.invFobInr)}
            </BlockTitle>
            <ExportGrid
              headings={[...ITEM_GRID_HEADINGS(invoice.currency), 'FOB ₹']}
              rows={rows.map(({ item, index }) => [...itemGridCells(item, index), right(formatAmount(itemFobInr(item)))])}
              emptyText="No item in this invoice"
              totals={[[right('Items total', { colSpan: 7 }), right(formatAmount(total)), right(formatAmount(totalFob))]]}
            />
            {Math.abs(difference) > 0.01 && <ReportFootnote>⚠ Items total differs from the invoice value by {formatAmount(difference)}</ReportFootnote>}
          </div>
        );
      })}
    </ReportSheet>
  );
}

// RoDTEP wise checklist: claim per item with rate / cap from the RoDTEP master (estimate). A row whose cap is per unit
// and has no quantity says "qty?" and stays out of the total: a printed checklist must not carry a figure never worked out.
export function RodtepReport({ d, items, rodteps }) {
  const rows = (items || []).map((item, index) => {
    const rate = rodtepRateOf(rodtepRowOf(rodteps, item), item);
    const claimed = claimsRodtep(item);
    const quantity = rodtepQtyOf(item, d && d._infoTypes, rate && rate.uqc);
    const amount = claimed && rate ? rodtepAmount({ fob: itemFobInr(item), qty: quantity.qty, rate: rate.rate, cap: rate.cap, rsPerUqc: rate.rsPerUqc }) : 0;
    return { item, index, rate, claimed, quantity, amount };
  });
  const notWorkedOut = rows.filter((row) => row.claimed && row.rate && row.amount === null).length;
  const total = rows.reduce((sum, row) => sum + (row.amount === null ? 0 : row.amount), 0);
  return (
    <ReportSheet title="RoDTEP Wise Checklist" d={d}>
      <ExportGrid
        headings={['Inv/Item', 'RITC', 'Description', 'Qty', 'FOB ₹', 'Claim', 'Rate %', 'Cap ₹/unit', 'Est. RoDTEP ₹']}
        rows={rows.map(({ item, index, rate, claimed, quantity, amount }) => [
          itemTag(item, index), item.ritc, item.desc,
          right(`${quantity.qty ? formatAmount(quantity.qty, 3) : '-'} ${quantity.unit}`),
          right(formatAmount(itemFobInr(item))),
          claimed ? 'RODTEPY' : 'RODTEPN',
          right(rate ? formatAmount(rate.rate) + (rate.appendix === '4RE' ? ' (4RE)' : '') : 'n/a'),
          right(rate && num(rate.cap) ? formatAmount(rate.cap) : '-'),
          right(!claimed || !rate ? '-' : (amount === null ? 'qty?' : formatAmount(amount)), { title: amount === null ? CAP_NEEDS_QTY : '' }),
        ])}
        emptyText="No item"
        totals={[[
          right(`Total estimated RoDTEP (claimed items)${notWorkedOut > 0 ? ` - ${notWorkedOut} item(s) not worked out` : ''}`, { colSpan: 8 }),
          right(formatAmount(total)),
        ]]}
      />
      <ReportFootnote>Estimate = rate % of FOB ₹, limited to cap × qty (DTY / RDT quantity in the schedule unit), from the RoDTEP master: Appendix 4R, or 4RE for exports under AA / EOU / SEZ. The amount is worked out by Customs.</ReportFootnote>
    </ReportSheet>
  );
}

// a value typed on the Scheme tab is kept; otherwise it is worked out, and null means it could not be
const dbkValueOf = (row, item) => (String(row.dbkVal || '').trim() !== ''
  ? num(row.dbkVal)
  : dbkAmount({ fob: itemFobInr(item), qty: row.dbkQty, rateAdv: row.dbkRtAdv, rateSpe: row.dbkRtSpe, cap: row.dbkCap }));

// Drawback particulars: DBK rows of Scheme > Dbk
export function DrawbackReport({ d, items, dbkItems }) {
  const rows = (dbkItems || []).map((row) => {
    const item = (items || []).find((other, index) => invoiceSrOf(other) === String(row.invNo) && itemSrOf(other, index) === String(row.itemNo)) || {};
    return { row, item, value: dbkValueOf(row, item) };
  });
  const notWorkedOut = rows.filter((line) => line.value === null).length;
  return (
    <ReportSheet title="Drawback Particulars" d={d}>
      <ExportGrid
        headings={['Inv/Item', 'Description', 'DBK Sr No', 'DBK Qty', 'Unit', 'FOB ₹', 'Rate %', 'Cap ₹/unit', 'DBK ₹', 'Avail.']}
        rows={rows.map(({ row, item, value }) => [
          `${row.invNo}/${row.itemNo}`, item.desc || '', row.dbkNo, right(formatAmount(row.dbkQty, 3)), row.accUnit,
          right(formatAmount(itemFobInr(item))), right(row.dbkRtAdv ? formatAmount(row.dbkRtAdv) : '-'), right(num(row.dbkCap) ? formatAmount(row.dbkCap) : '-'),
          right(value === null ? 'qty?' : formatAmount(value), { title: value === null ? CAP_NEEDS_QTY : '' }), row.drawbackAvailable || 'Y',
        ])}
        emptyText="No drawback item (scheme 19) in this job"
        totals={[[
          right(`Total drawback${notWorkedOut > 0 ? ` - ${notWorkedOut} row(s) not worked out` : ''}`, { colSpan: 8 }),
          right(formatAmount(rows.reduce((sum, line) => sum + (line.value === null ? 0 : line.value), 0))),
          '',
        ]]}
      />
      <ReportFootnote>Drawback ₹ as worked out on the Scheme tab (estimate); Customs works out the amount from DBK Sr No and quantity.</ReportFootnote>
    </ReportSheet>
  );
}

const indigenousOrImported = (value) => (/^I/i.test(String(value || '')) && !/^IMP/i.test(String(value)) ? 'Indigenous' : 'Imported');

export function LicenceReport({ d, licenseItems }) {
  return (
    <ReportSheet title="Licence Particulars" d={d}>
      <ExportGrid
        headings={['Inv/Item', 'Sr', 'Reg No', 'Reg Date', 'Sr Part E', 'Sr Part C', 'Qty', 'Export Qty', 'UQC', 'Ind/Imp', 'Licence No / Date', 'Type']}
        rows={(licenseItems || []).map((row) => [
          `${row.invNo}/${row.itemNo}`, row.srNo || 1, row.regNo, toSlashDate(row.regDate), row.snE, row.snC,
          right(formatAmount(row.qty, 3)), right(formatAmount(row.expQty, 3)), row.uqc, indigenousOrImported(row.indImp),
          [row.licNo, toSlashDate(row.licDt)].filter(Boolean).join(' / '), row.licType,
        ])}
        emptyText="No licence row in this job"
      />
    </ReportSheet>
  );
}

export function Ar4Report({ d, items }) {
  const rows = (items || []).map((item, index) => ({ item, index })).filter(({ item }) => /^Y/i.test(String(item.ar4 || '')));
  return (
    <ReportSheet title="AR4 Particulars" d={d}>
      <ExportGrid
        headings={['Inv/Item', 'Description', 'AR4 No', 'AR4 Date', 'Commissionerate', 'Division', 'Range', 'Remarks']}
        rows={rows.map(({ item, index }) => [itemTag(item, index), item.desc, item.ar4No, toSlashDate(item.ar4Date), item.commissionerate, item.division, item.ar4Range, item.ar4Remarks])}
        emptyText="No item with AR4 = Y"
      />
    </ReportSheet>
  );
}

export function ReExportReport({ d, items }) {
  const rows = (items || []).flatMap((item, index) => asList(item.reExports).map((reExport) => ({ item, index, reExport })));
  return (
    <ReportSheet title="Re-Export Particulars" d={d}>
      <ExportGrid
        headings={['SB Inv/Item', 'BE Site', 'BE No', 'BE Date', 'BE Inv/Item', 'Description', 'Qty Utilised', 'BE Qty', 'Assessed ₹', 'Duty ₹']}
        rows={rows.map(({ item, index, reExport }) => [
          itemTag(item, index), reExport.reExpField2, reExport.reExpField3, toSlashDate(reExport.reExpField4), `${reExport.reExpField5}/${reExport.reExpField6}`,
          reExport.reExpField9, right(`${formatAmount(reExport.reExpField8, 3)} ${reExport.reExpField11 || ''}`),
          right(reExport.reExpField10 ? formatAmount(reExport.reExpField10, 3) : '-'), right(reExport.reExpField12 ? formatAmount(reExport.reExpField12) : '-'),
          right(reExport.reExpField13 ? formatAmount(reExport.reExpField13) : '-'),
        ])}
        emptyText="No re-export row in this job"
      />
    </ReportSheet>
  );
}

// "2.50% USD 120.00" from the rate / currency / amount fields of one invoice charge
const chargeText = (invoice, charge) => {
  const rate = invoice[charge + 'Rate'], currency = invoice[charge + 'Curr'], amount = invoice[charge + 'Amount'];
  if (![rate, currency, amount].some((value) => String(value || '').trim())) return '-';
  return `${rate ? formatAmount(rate) + '% ' : ''}${amount ? (currency || invoice.currency || '') + ' ' + formatAmount(amount) : ''}`;
};

export function InvoiceParticularsReport({ d }) {
  const invoices = d?.invoices || [];
  return (
    <ReportSheet title="Invoice Particulars" d={d}>
      <ExportGrid
        headings={['Sr', 'Invoice No / Date', 'Value', 'Rate', 'Terms', 'Freight', 'Insurance', 'Commission', 'Discount', 'Payment', 'Buyer', 'FOB ₹']}
        rows={invoices.map((invoice, index) => [
          index + 1,
          <>{invoiceNoOf(invoice)}<br />{invoiceDateOf(invoice)}</>,
          right(`${invoice.currency} ${formatAmount(invoiceValueOf(invoice))}`),
          right(`${formatAmount(invoice.exchRate || invoice.exchangeRate, 4)}${Number(invoice.unitInRs) > 1 ? '/' + Number(invoice.unitInRs) : ''}`,
            { title: rateText(invoice.currency, invoice.exchRate || invoice.exchangeRate, invoice.unitInRs) }),
          `${contractTypeOf(invoice)}${invoice.addFreight ? ` (${invoice.addFreight})` : ''}`,
          chargeText(invoice, 'freight'), chargeText(invoice, 'insurance'), chargeText(invoice, 'commission'), chargeText(invoice, 'discount'),
          [invoice.pymtNature, invoice.pymtPeriod ? invoice.pymtPeriod + ' days' : ''].filter(Boolean).join(' / '),
          invoice.buyer || invoice.buyerName || d?.consigneeName || '',
          right(formatAmount(invoice.invFobInr)),
        ])}
        emptyText="No invoice in this job"
        totals={[[right('Total FOB ₹', { colSpan: 11 }), right(formatAmount(invoices.reduce((sum, invoice) => sum + num(invoice.invFobInr), 0)))]]}
      />
    </ReportSheet>
  );
}

const weightText = (weight, unit) => (weight ? `${weight} ${unit || 'KGS'}` : '');

export function ShipmentReport({ d, containers }) {
  const job = d || {};
  const shipmentContainers = containersOf(job, containers);
  const facts = [
    ['Mode', job.shipmentMode, 'Nature of Cargo', job.natureOfCargo || job.autoField_13],
    ['Gross Wt', weightText(job.grossWeight || job.autoField_18, job.grWtUnit), 'Net Wt', weightText(job.netWeight || job.autoField_19, job.grWtUnit)],
    ['Total Packages', job.totalPackages || job.autoField_14, 'Loose Packets', job.loosePackets || job.autoField_17],
    ['Marks & Nos', [job.autoField_15, job.autoField_16].filter(Boolean).join(' '), 'Containers', shipmentContainers.length],
    ['Consignee', job.consigneeName, 'Country', job.consigneeCountry || job.consigneeCountryCode],
    ['Discharge Port', job.discPortName || job.discPortCode, 'Flight / Vessel', job.flightNo || job.vesselName || ''],
  ].map(([leftLabel, leftValue, rightLabel, rightValue]) => [leftLabel, leftValue || '', rightLabel, rightValue ?? '']);
  return (
    <ReportSheet title="Shipment & Container Details" d={d}>
      <FactTable rows={facts} className="tw:mb-[8px]" />
      <ExportGrid
        headings={['Sr', 'Container No', 'Size', 'Seal No', 'Seal Date', 'Seal Type', 'Pkgs Stuffed']}
        rows={shipmentContainers.map((container, index) => [
          index + 1, container.ContainerNumber || container.containerNo, container.ContainerSize || container.size,
          container.ExciseSealNo || container.sealNo || container.exciseSealNo, toSlashDate(container.SealDate || container.sealDate),
          container.SealTypeIndicator || container.sealType, right(container.NoOfPktsStuffed || container.stuffedPkgs || ''),
        ])}
        emptyText="No container (air / loose cargo)"
      />
    </ReportSheet>
  );
}

// singleWindow: the SW rows of the Shipping Bill as filed (checklistData singleWindowRows - from the CACHE01 the server
// builds, so the statements and info the builder adds itself, e.g. RoDTEP RD001, are in it)
export function SwInfoReport({ d, singleWindow }) {
  const infos = singleWindow?.infos || [];
  const statements = singleWindow?.statements || [];
  return (
    <ReportSheet title="Single Window Information & Statements" d={d}>
      <BlockTitle>SW Info</BlockTitle>
      <ExportGrid
        className="tw:mb-[8px]"
        headings={['Inv/Item', 'Type', 'Qualifier', 'Code', 'Text', 'Measure', 'UQC']}
        rows={infos.map((row) => [
          row.invItemNo, row.type || '', row.qualifier || '', row.code || '', row.text || '', right(row.measurement ?? ''), row.unit || '',
        ])}
        emptyText="No SW info row"
      />
      <BlockTitle>SW Statements</BlockTitle>
      <ExportGrid
        headings={['Inv/Item', 'For', 'Type', 'Code', 'Text']}
        rows={statements.map((row) => [
          row.invItemNo, row.statementFor || '', row.statementType || '', row.statementCode || '', row.statementText || '',
        ])}
        emptyText="No SW statement"
      />
    </ReportSheet>
  );
}

export function SupportingDocsReport({ d, items }) {
  const rows = [
    ...asList(d?.eSanchitList).map((doc) => ({ level: 'Whole SB', doc })),
    ...(items || []).flatMap((item, index) => asList(item.eSanchitList).map((doc) => ({ level: `Item ${itemTag(item, index)}`, doc }))),
  ];
  return (
    <ReportSheet title="Supporting Documents (e-Sanchit)" d={d}>
      <ExportGrid
        headings={['For', 'IRN', 'Doc Code', 'Ref No', 'Issued By', 'Beneficiary', 'Place', 'Issue Date', 'File']}
        rows={rows.map(({ level, doc }) => [
          level, doc.irn || doc.imageRefNo || '', doc.docCode || doc.documentCode || '', doc.refNo || doc.drn || '', doc.issuerName || doc.issuingParty || '',
          doc.beneficiaryName || doc.beneficiaryParty || '', doc.placeOfIssue || '', toSlashDate(doc.issueDate), doc.fileName || '',
        ])}
        emptyText="No supporting document in this job"
      />
    </ReportSheet>
  );
}

const igstFlag = (item) => {
  const status = String(item.igstPayStatus || '');
  if (/\(P\)/.test(status)) return 'P';
  if (/LUT/.test(status)) return 'LUT';
  return /NA/.test(status) ? 'NA' : '';
};

// Annexure to the S/B: all items invoice by invoice with value, FOB, PMV, drawback and RoDTEP, invoice sub-totals and
// a grand total - the continuation sheet when the items do not fit on the checklist.
export function AnnexureReport({ d, items, dbkItems }) {
  const invoices = (d?.invoices || []).length ? d.invoices : [{}];
  const dbkValuesOf = (item, index) => (dbkItems || [])
    .filter((row) => String(row.invNo || row.invSr) === invoiceSrOf(item) && String(row.itemNo || row.itemSr) === itemSrOf(item, index))
    .map((row) => dbkValueOf(row, item));
  const dbkOf = (item, index) => dbkValuesOf(item, index).reduce((sum, value) => sum + (value === null ? 0 : value), 0);
  // a row whose drawback could not be worked out (cap per unit, no quantity) must not read as 0
  const dbkPending = (item, index) => dbkValuesOf(item, index).some((value) => value === null);
  const groups = invoices.map((invoice, invoiceIndex) => {
    const rows = itemsOfInvoice(items, invoiceIndex);
    const totals = rows.reduce((sum, { item, index }) => ({
      fc: sum.fc + num(item.totalFc || item.total), fob: sum.fob + itemFobInr(item), pmv: sum.pmv + filedTotalPmv(item), dbk: sum.dbk + dbkOf(item, index),
    }), { fc: 0, fob: 0, pmv: 0, dbk: 0 });
    return { invoice, invoiceIndex, rows, totals };
  });
  const grandOf = (key) => groups.reduce((sum, group) => sum + group.totals[key], 0);
  const itemCount = groups.reduce((sum, group) => sum + group.rows.length, 0);

  const dbkCell = (item, index) => {
    if (dbkPending(item, index)) return right('qty?', { title: CAP_NEEDS_QTY });
    const value = dbkOf(item, index);
    return right(value ? formatAmount(value) : '-', { title: '' });
  };

  return (
    <ReportSheet title="Annexure to Shipping Bill - Invoice & Item Details" d={d}>
      {groups.map(({ invoice, invoiceIndex, rows, totals }) => (
        <div key={invoiceIndex} className="tw:mb-[10px]">
          <BlockTitle>
            Invoice {invoiceIndex + 1}: {invoiceNoOf(invoice) || '-'} dt {invoiceDateOf(invoice)} · {invoice.currency || ''} · {contractTypeOf(invoice)} · Buyer: {invoice.buyer || invoice.buyerName || d?.consigneeName || ''}
          </BlockTitle>
          <ExportGrid
            headings={[...ITEM_GRID_HEADINGS(invoice.currency), 'FOB ₹', 'PMV ₹', 'DBK ₹', 'RoDTEP', 'IGST', 'End Use']}
            rowClassName="tw:break-inside-avoid"
            rows={rows.map(({ item, index }) => [
              ...itemGridCells(item, index),
              right(formatAmount(itemFobInr(item))), right(filedTotalPmv(item) ? formatAmount(filedTotalPmv(item)) : '-'), dbkCell(item, index),
              claimsRodtep(item) ? 'Y' : 'N', igstFlag(item), String(item.endUse || '').split(/[\s|]/)[0],
            ])}
            emptyText="No item in this invoice"
            totals={[[
              right(`Invoice ${invoiceIndex + 1} total (${rows.length} item${rows.length === 1 ? '' : 's'})`, { colSpan: 7 }),
              right(formatAmount(totals.fc)), right(formatAmount(totals.fob)), right(formatAmount(totals.pmv)), right(formatAmount(totals.dbk)), { value: '', colSpan: 3 },
            ]]}
          />
        </div>
      ))}
      <ReportTable>
        <ReportBody>
          <ReportRow className={BOLD}>
            <ReportCell className="tw:bg-[#f8fafc]">Grand total: {invoices.length} invoice(s), {itemCount} item(s)</ReportCell>
            <ReportCell align="right">FOB ₹ {formatAmount(grandOf('fob'))}</ReportCell>
            <ReportCell align="right">PMV ₹ {formatAmount(grandOf('pmv'))}</ReportCell>
            <ReportCell align="right">Drawback ₹ {formatAmount(grandOf('dbk'))}</ReportCell>
          </ReportRow>
        </ReportBody>
      </ReportTable>
      <ReportFootnote>FOB / drawback are the screen estimates; Customs works out the final figures. Value in invoice currency is not totalled across invoices.</ReportFootnote>
    </ReportSheet>
  );
}

// Container annexure: container-wise stuffing and seal details with the S/B summary, for factory stuffed (self-sealed)
// cargo and the port. Data sheet only - check the annexure format your port asks for.
export function ContainerAnnexureReport({ d, containers }) {
  const job = d || {};
  const shipmentContainers = containersOf(job, containers);
  const stuffedTotal = shipmentContainers.reduce((sum, container) => sum + num(container.NoOfPktsStuffed || container.stuffedPkgs), 0);
  const totalPackages = job.totalPackages || job.autoField_14;
  const isFactoryStuffed = /^Y/i.test(String(job.factoryStuffed || ''));
  const facts = [
    ['Stuffing', isFactoryStuffed ? 'Factory stuffed (self-sealed)' : 'Dock / CFS stuffed', 'Invoice No(s)', (job.invoices || []).map(invoiceNoOf).filter(Boolean).join(', ')],
    ['Factory / stuffing address', job.factoryAddress || '', 'Total Packages', [totalPackages, job.packageUnit || job.autoField_16].filter(Boolean).join(' ')],
    ['Gross Wt', weightText(job.autoField_18 || job.grossWeight, job.grWtUnit), 'Net Wt', weightText(job.autoField_19 || job.netWeight, job.grWtUnit)],
    ['Marks & Nos', job.autoField_15 || '', 'Port of Discharge / Destination', [job.discPortCode || job.discPortName, job.destPortCode || job.destPortName].filter(Boolean).join(' / ')],
  ];
  const signatureCell = 'tw:w-1/2 tw:border-t tw:border-solid tw:border-black tw:pt-[30px] tw:text-center';
  return (
    <ReportSheet title="Container Annexure - Stuffing & Sealing Details" d={d}>
      <FactTable rows={facts} labelWidth="tw:w-[18%]" valueWidth="tw:w-[32%]" className="tw:mb-[8px]" />
      <ExportGrid
        headings={['Sr', 'Container No', 'Size / Type', 'Seal No (e-seal)', 'Seal Date', 'Seal Type', 'Seal Device ID', 'Pkgs Stuffed', 'VGM Kgs']}
        rowClassName="tw:break-inside-avoid"
        rows={shipmentContainers.map((container, index) => [
          index + 1, { value: container.ContainerNumber || container.containerNo, className: BOLD },
          [container.ContainerSize || container.size, container.ContainerType || container.type].filter(Boolean).join(' '),
          container.ExciseSealNo || container.exciseSealNo || container.sealNo, toSlashDate(container.SealDate || container.sealDate),
          container.SealTypeIndicator || container.sealType, container.SealDeviceID || container.deviceId,
          right(container.NoOfPktsStuffed || container.stuffedPkgs || ''), right(container.VGM || container.vgmWeight || ''),
        ])}
        emptyText="No container in this job (SB Header > Container Details)"
        totals={shipmentContainers.length ? [[right(`${shipmentContainers.length} container(s) - packages stuffed`, { colSpan: 7 }), right(stuffedTotal || ''), '']] : []}
      />
      {shipmentContainers.length > 0 && stuffedTotal > 0 && num(totalPackages) > 0 && stuffedTotal !== num(totalPackages) && (
        <ReportFootnote><b>Check:</b> packages stuffed ({stuffedTotal}) differ from the S/B total packages ({totalPackages}).</ReportFootnote>
      )}
      <ReportTable className="tw:mt-[28px]">
        <ReportBody>
          <ReportRow>
            <ReportCell look="bare" className={signatureCell}>Exporter / Authorised Signatory (name, date)</ReportCell>
            <ReportCell look="bare" className={signatureCell}>Customs Broker (name, licence no, date)</ReportCell>
          </ReportRow>
        </ReportBody>
      </ReportTable>
      <ReportFootnote>Data sheet built from the job. For factory stuffed cargo use the annexure format and declarations your port / CBIC circular prescribes.</ReportFootnote>
    </ReportSheet>
  );
}
