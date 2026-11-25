import { ReportCell, ReportFieldTable, ReportRow, ReportSectionGrid } from '../reportTable';

const HEADER_SECTIONS = [
  {
    title: '1. Job Header & General Details',
    fields: (job) => [
      ['Job No', job.jobNo],
      ['Job Date', job.jobDate],
      ['BE Type', job.boeType],
      ['Branch / Port Code', job.branchCode],
      ['Shipment Mode', job.shipmentMode],
      ['Port Code', job.portCode || job.autoField_2],
      ['CHA Code', job.chaCode || job.autoField_3],
      ['Kaccha BE', job.kachchaBE || job.kachaBe],
      ['Branch Sr No', job.branchSrNo || job.autoField_48],
      // the importer's Authorised Dealer (bank) code, filed as the BE header's authorizedEconomicDealerCode; the
      // invoice-level AEO code is the separate Authorised Economic Operator field
      ['AD Code (bank)', job.aeoCode || job.autoField_49],
      ['Commercial Tax Type', job.autoField_50 || job.commercialTaxType],
      ['Importer Type', job.importerType],
      ['Payment Method', job.paymentMethodCode || job.autoField_52],
    ],
  },
  {
    title: '2. Importer Details',
    fields: (job) => [
      ['Importer Name', job.nameOfImporter || job.autoField_4],
      ['IEC Code', job.iecCode || job.autoField_5],
      ['Address Line 1', job.address1 || job.autoField_6],
      ['Address Line 2', job.address2 || job.autoField_7],
      ['City', job.city || job.autoField_8],
      ['State', job.state || job.autoField_9],
      ['Pin Code', job.pin || job.autoField_10],
      ['State Code', job.autoField_12],
      ['Commercial Tax Reg No', job.autoField_13],
    ],
  },
  {
    title: '3. Shipment / Transport Details',
    fields: (job) => [
      ['MAWB / BL No', job.mawbNo || job.mawbblNo],
      ['MAWB Date', job.mawbDate || job.autoField_15],
      ['HAWB / HBL No', job.hawbNo || job.hawbhblNo],
      ['HAWB Date', job.hawbDate || job.autoField_16],
      ['IGM Number', job.igmNumber || job.igmNo],
      ['IGM Date', job.igmDate || job.autoField_14],
      ['Inward Date', job.inwardDate || job.autoField_17],
      ['Country of Origin', job.countryOfOrigin],
      ['Port of Origin', job.portOfOrigin || job.origin],
      ['Marks & Numbers', job.marksAndNumbers1 || job.marks1],
    ],
  },
  {
    title: '4. Bond & Certificate Details',
    fields: (job) => [
      ['Bond Type', job.bondType],
      ['Bond No', job.bondNo],
      ['Bond Date', job.bondDate],
      ['Bond Amount', job.bondAmount],
      ['Certificate Type', job.certificateType],
      ['Certificate No', job.certificateNo],
      ['Certificate Date', job.certificateDate],
      ['Certificate Amount', job.certificateAmount],
    ],
  },
];

const INVOICE_COLUMNS = [
  ['Sr No', (invoice) => invoice.invoiceSrNo],
  ['Invoice No', (invoice) => invoice.invNo || invoice.invoiceNo],
  ['Invoice Date', (invoice) => invoice.invDate],
  ['Value', (invoice) => invoice.value || invoice.invValue],
  ['Currency', (invoice) => invoice.currency],
  ['Terms', (invoice) => invoice.terms],
  ['Terms Place', (invoice) => invoice.termsPlace],
  ['Freight', (invoice) => invoice.freight],
  ['Insurance', (invoice) => invoice.insurance],
  ['Misc', (invoice) => invoice.misc || invoice.miscCharges],
  ['HSS Load', (invoice) => invoice.hss || invoice.hssLoadAmount],
];

const invoiceDetailFields = (invoice) => [
  ['SVB Reference Number', invoice.svbReferenceNumber],
  ['Whether Buyer/Seller Related', invoice.whetherBuyerAndSellerAreRelated],
  ['Nature of Transaction', invoice.natureOfTransaction],
  ['Valuation Method', invoice.valuationMethod],
  ['Third Party Flag', invoice.thirdPartyFlag],
  ...(invoice.thirdPartyFlag === 'Y' ? [
    ['Third Party Name', invoice.thirdPartyName],
    ['Third Party Addr1', invoice.thirdPartyAddress1],
    ['Third Party Addr2', invoice.thirdPartyAddress2],
    ['Third Party City', invoice.thirdPartyCity],
    ['Third Party SubDiv', invoice.thirdPartyCntrySubDvsn],
    ['Third Party Country', invoice.thirdPartyCountryName],
  ] : []),
  ['AEO Flag', invoice.aeoFlag],
  ...(invoice.aeoFlag === 'Y' ? [
    ['AEO Code', invoice.aeoCode],
    ['AEO Role', invoice.aeoRole],
    ['AEO Country', invoice.aeoCountry],
  ] : []),
  ['Additional Details Flag', invoice.additionalDetailsFlag],
  ...(invoice.additionalDetailsFlag === 'Y' ? [
    ['Revenue Percent', invoice.revenuePercent],
    ['Revenue Deposit On', invoice.revenueDepositOn],
    ['Additional Desc', invoice.additionalDescription],
    ['Buyer Seller Rel', invoice.buyerSellerRelationship],
    ['Hand Carriage', invoice.handCarriage],
  ] : []),
  ['Misc Charges Included', invoice.miscChargesIncluded],
  ['Misc Charges Not Included', invoice.miscChargesNotIncluded],
  ['SVB Ref No (Invoice)', invoice.svbRefNoInvoice],
  ['SVB Custom House Code 2', invoice.svbCustomHouseCode2],
  ['SVB Load Type', invoice.svbLoadType],
  ['Other Relevant Info', invoice.otherRelevantInform],
];

function InvoiceRows({ invoice }) {
  return (
    <>
      <ReportRow>
        {INVOICE_COLUMNS.map(([header, valueOf]) => <ReportCell look="ruled" key={header}>{valueOf(invoice)}</ReportCell>)}
      </ReportRow>
      <ReportRow>
        <ReportCell look="ruled" colSpan={INVOICE_COLUMNS.length} className="tw:p-0">
          <ReportFieldTable fields={invoiceDetailFields(invoice)} className="tw:mb-0" />
        </ReportCell>
      </ReportRow>
    </>
  );
}

export default function BillOfEntrySection({ ctx }) {
  const job = ctx.jobData || {};
  const invoices = job.invoices || [];
  return (
    <>
      <h2 className="tw:m-0 tw:mb-2 tw:text-center tw:uppercase">BILL OF ENTRY CHECKLIST</h2>
      <p className="tw:mb-8 tw:text-center tw:text-[12px]">Generated on: {new Date().toLocaleDateString('en-GB')} | Job No: {job.jobNo || 'NEW'}</p>

      {HEADER_SECTIONS.map((section) => <ReportFieldTable key={section.title} title={section.title} fields={section.fields(job)} />)}

      <ReportSectionGrid title="5. Invoice Details" headers={INVOICE_COLUMNS.map(([header]) => header)} isEmpty={!invoices.length}>
        {invoices.map((invoice, index) => <InvoiceRows key={index} invoice={invoice} />)}
      </ReportSectionGrid>
    </>
  );
}
