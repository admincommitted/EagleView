import { ReportBody, ReportCell, ReportFieldTable, ReportHeadCell, ReportNote, ReportRow, ReportSectionGrid, ReportTable, ReportTableHeader } from '../reportTable';
import { itemInvoiceSr, missingIgstNote, occasionalDutyLines } from './reportFormat';

const ITEM_COLUMNS = [
  ['Sr No', (item) => item.itemSrNo || item.itemNo],
  ['Inv Sr', itemInvoiceSr],
  ['Description', (item) => item.desc || item.productDescription],
  ['HS Code', (item) => item.ritc || item.hsCode],
  ['CTH', (item) => item.cth],
  ['CETH', (item) => item.ceth],
  ['Qty', (item) => item.qty || item.quantity],
  ['UQC', (item) => item.unit || item.uqc],
  ['Unit Price', (item) => item.price || item.unitPrice],
  ['Item Value (FC)', (item) => item.value || item.assessableValue],
  ['Product Code', (item) => item.productCode],
];

const DUTY_HEADERS = ['Duty Type', 'Notif No', 'Sr No', 'Rate', 'Flag', 'Amount', 'Unit'];
// item keys are <prefix>NotificationNo, <prefix>SrNo, <prefix>Rate, <prefix>Flag, <prefix>Amount, <prefix>Unit
const DUTY_TYPES = [['BCD', 'bcd'], ['CVD', 'cvd'], ['Adl CVD', 'adlCvd'], ['SWS', 'sws'], ['SAPTA', 'sapta'], ['Health Cess', 'healthCess']];
const DUTY_FIELDS = ['NotificationNo', 'SrNo', 'Rate', 'Flag', 'Amount', 'Unit'];

const text = (value) => value ?? '';
const ITEM_EXTRA_DATA = [
  ['igstData', 'IGST Data', (data) => `Notif No: ${text(data.notnNo)} | Sr No: ${text(data.srNo)} | Rate: ${text(data.rate)}% | Flag: ${text(data.flag)} | Amount: ${text(data.amount)}`],
  ['addData', 'Anti Dumping', (data) => `Notif No: ${text(data.notnNo)} | Rate: ${text(data.rate)} | Amount: ${text(data.amount)} | CTH: ${text(data.cth)}`],
  ['otherDutyData', 'Other Duty', (data) => `Code: ${text(data.dutyCode)} | Rate: ${text(data.rate)} | Amount: ${text(data.amount)}`],
  ['svbData', 'SVB Item', (data) => `Ref No: ${text(data.refNo)} | Date: ${text(data.date)} | Load Duty: ${text(data.loadDuty)} | Load Value: ${text(data.loadValue)}`],
  ['policyParaData', 'Policy Para', (data) => `Para No: ${text(data.paraNo)} | Year: ${text(data.year)}`],
  ['prevBeData', 'Previous BE', (data) => `BE No: ${text(data.beNo)} | Date: ${text(data.beDate)} | Qty: ${text(data.qty)} ${text(data.uqc)}`],
];

const DOC_COLUMNS = [
  ['Sr No', 'srNo'], ['Doc Code', 'docCode'], ['IRN', 'irn'], ['DRN', 'drn'], ['File Name', 'fileName'], ['File Type', 'fileType'], ['Doc For', 'docFor'],
  ['Issuer Code', 'issuerCode'], ['Issuer Name', 'issuerName'], ['Issue Date', 'issueDate'], ['Expiry Date', 'expiryDate'], ['Applicable', 'isApplicable'],
];

const CONTAINER_COLUMNS = [
  ['Sr No', (container) => container.srNo || container.containerSrNo],
  ['Container No', (container) => container.contNo || container.containerNo],
  ['Seal No', (container) => container.sealNo],
  ['LCL/FCL', (container) => container.lclFcl],
  ['Size', (container) => container.contSize || container.containerSize],
  ['Type', (container) => container.contType || container.containerType],
  ['Truck No', (container) => container.truckNo],
  ['IGM No', (container) => container.igmNumber],
];

const NOTE_CELL = 'tw:bg-[#f8fafc] tw:text-[#475569]';
const DUTY_CELL = 'tw:p-[4px]';
const EXTRA_CELL = 'tw:p-[4px] tw:bg-[#fffae6]';

function ItemDutyTable({ item }) {
  const schemes = Array.isArray(item.schemeCatData) ? item.schemeCatData : [];
  return (
    <ReportTable className="tw:text-[11px]">
      <ReportTableHeader className="tw:bg-[#f1f5f9] tw:text-[#334155]">
        <ReportRow>{DUTY_HEADERS.map((header) => <ReportHeadCell look="ruled" key={header} className={DUTY_CELL}>{header}</ReportHeadCell>)}</ReportRow>
      </ReportTableHeader>
      <ReportBody>
        {DUTY_TYPES.map(([label, prefix]) => (
          <ReportRow key={prefix}>
            <ReportCell look="ruled"className={`${DUTY_CELL} tw:font-bold`}>{label}</ReportCell>
            {DUTY_FIELDS.map((field) => <ReportCell look="ruled"key={field} className={DUTY_CELL}>{item[prefix + field]}</ReportCell>)}
          </ReportRow>
        ))}
        {ITEM_EXTRA_DATA.filter(([key]) => item[key]).map(([key, label, describe]) => (
          <ReportRow key={key}>
            <ReportCell look="ruled"colSpan={DUTY_HEADERS.length} className={EXTRA_CELL}><strong>{label}:</strong> {describe(item[key])}</ReportCell>
          </ReportRow>
        ))}
        {schemes.length > 0 && (
          <ReportRow>
            <ReportCell look="ruled"colSpan={DUTY_HEADERS.length} className={EXTRA_CELL}>
              <strong>Scheme Category:</strong>
              {schemes.map((scheme, index) => <span key={index}> [{scheme.schemeCode} | Lic: {scheme.licenseNo} | Date: {scheme.date}]</span>)}
            </ReportCell>
          </ReportRow>
        )}
      </ReportBody>
    </ReportTable>
  );
}

function ItemRows({ item }) {
  return (
    <>
      <ReportRow>{ITEM_COLUMNS.map(([header, valueOf]) => <ReportCell look="ruled"key={header}>{valueOf(item)}</ReportCell>)}</ReportRow>
      <ReportRow>
        <ReportCell look="ruled"colSpan={ITEM_COLUMNS.length} className={NOTE_CELL}>
          Rate Type Flag: {item.rateTypeFlag} | IGST Duty Flag: {item.igstDutyFlag} | SVB Flag: {item.svbFlag} | FOC: {item.foc} <br />
          SchemeCode: {item.schemeCodCategoryFlag} | Licence: {item.licenceFlag} | ReImport: {item.reImportFlag} | RSP Duty: {item.rspDutyFlag} | NCD: {item.ncdCustomDutyFlag} | AntiDumping: {item.antiDumpingDutyFlag} | OtherDuty: {item.otherDutyFlag}
        </ReportCell>
      </ReportRow>
      <ReportRow>
        <ReportCell look="ruled"colSpan={ITEM_COLUMNS.length} className="tw:p-0"><ItemDutyTable item={item} /></ReportCell>
      </ReportRow>
    </>
  );
}

function DocumentRows({ doc }) {
  return (
    <>
      <ReportRow>{DOC_COLUMNS.map(([header, key]) => <ReportCell look="ruled"key={header}>{doc[key]}</ReportCell>)}</ReportRow>
      <ReportRow>
        <ReportCell look="ruled"colSpan={DOC_COLUMNS.length} className={NOTE_CELL}>
          Issuer Address: {doc.issuerAddr1} {doc.issuerAddr2}, {doc.issuerCity} - {doc.issuerPin} <br />
          Bene Code: {doc.beneCode} | Bene Name: {doc.beneName} <br />
          Bene Address: {doc.beneAddr1} {doc.beneAddr2}, {doc.beneCity} - {doc.benePin} <br />
          Place of Issue: {doc.placeOfIssue} | Is Different ID: {doc.isDiffId}
        </ReportCell>
      </ReportRow>
    </>
  );
}

export default function Part3Section({ ctx }) {
  const { allItems, fmt, grandTotal, jobData } = ctx;
  const docs = ctx.esanchitDocs || [];
  const containers = Array.isArray(jobData?.containers) ? jobData.containers : [];
  const dutyTotals = [
    ['Total Assessable Value', ctx.totalAssessableValue],
    ['Total BCD', ctx.totalBCD],
    ['Total SWS', ctx.totalSWS],
    ['Total IGST', ctx.totalIGST],
    ['Total CVD', ctx.totalCVD],
    ['Total Adl CVD', ctx.totalAdlCVD],
    ['Total Health Cess', ctx.totalHealthCess],
    ['Total SAPTA', ctx.totalSAPTA],
    ...occasionalDutyLines(ctx).map(([label, amount]) => [`Total ${label}`, amount]),
  ].map(([label, amount]) => [label, fmt(amount)]);
  const igstNote = missingIgstNote(ctx.itemsWithoutIgst);

  return (
    <>
      <ReportSectionGrid title="6. Item Details" headers={ITEM_COLUMNS.map(([header]) => header)} isEmpty={!allItems.length}>
        {allItems.map((item, index) => <ItemRows key={index} item={item} />)}
      </ReportSectionGrid>

      <ReportSectionGrid title="7. Supporting Documents" headers={DOC_COLUMNS.map(([header]) => header)} isEmpty={!docs.length}>
        {docs.map((doc, index) => <DocumentRows key={index} doc={doc} />)}
      </ReportSectionGrid>

      <ReportSectionGrid title="8. Container Details" headers={CONTAINER_COLUMNS.map(([header]) => header)} isEmpty={!containers.length}>
        {containers.map((container, index) => (
          <ReportRow key={index}>{CONTAINER_COLUMNS.map(([header, valueOf]) => <ReportCell look="ruled"key={header}>{valueOf(container)}</ReportCell>)}</ReportRow>
        ))}
      </ReportSectionGrid>

      {igstNote && <ReportNote className="tw:mt-[8px]">{igstNote}</ReportNote>}
      <ReportFieldTable title="9. Duty Summary" fields={dutyTotals}>
        <ReportRow>
          <ReportCell look="ruled"className="tw:w-[35%] tw:bg-[#1e3a5f] tw:p-[8px] tw:text-[12px] tw:font-bold tw:text-white">GRAND TOTAL DUTY</ReportCell>
          <ReportCell look="ruled"className="tw:p-[8px] tw:text-[12px] tw:font-bold tw:text-[#1e3a5f]">{fmt(grandTotal)}</ReportCell>
        </ReportRow>
      </ReportFieldTable>
    </>
  );
}
