import { cn } from '@/lib/utils';
import POItemsTable from './POItemsTable';
import { actionTime, localDateTime } from './purchaseFormat';

// Printed by html2canvas (see POItemsTable): plain colours only, and transform instead of the rotate property.
const BOX = 'tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1 tw:rounded-sm tw:border tw:border-input tw:bg-white tw:p-4 tw:text-xs';
const BOX_TITLE = 'tw:m-0 tw:mb-1.5 tw:border-b tw:border-input tw:pb-1 tw:text-sm tw:font-bold tw:text-black';
const PARAGRAPH = 'tw:m-0';

const TERMS = [
  'Materials must be delivered within the stipulated time frame as mentioned in the PO.',
  "All items must meet standard quality checks; defective items will be returned at the vendor's expense.",
  'Invoices must strictly reference this Purchase Order number.',
  'Payment will be processed within 30 days from the date of successful delivery and invoice submission.',
  'Subject to New Delhi jurisdiction only.',
];

function CompanyHead({ head, po, issuedOn }) {
  return (
    <div className="tw:mb-5 tw:flex tw:flex-col tw:gap-3 tw:border-b-2 tw:border-black tw:pb-5 tw:sm:flex-row tw:sm:justify-between">
      <div className="tw:min-w-0 tw:text-xs tw:text-muted-foreground tw:sm:w-[65%]">
        <h1 className="tw:m-0 tw:mb-1 tw:text-[22px] tw:font-bold tw:text-black">{head.name}</h1>
        <p className={PARAGRAPH}>{head.line1}</p>
        <p className={PARAGRAPH}>{head.line2}</p>
        <p className={PARAGRAPH}>GSTIN: {head.gstin} &nbsp;|&nbsp; PAN: {head.pan}</p>
        <p className={PARAGRAPH}>CIN: {head.cin}</p>
        <p className={cn(PARAGRAPH, 'tw:normal-case')}>Phone: {head.phone} &nbsp;|&nbsp; Email: {head.email}</p>
      </div>
      <div className="tw:text-sm tw:sm:w-[35%] tw:sm:text-right">
        <h2 className="tw:m-0 tw:mb-2.5 tw:text-[28px] tw:font-bold tw:text-primary tw:uppercase">Purchase Order</h2>
        <p className={cn(PARAGRAPH, 'tw:mb-1')}><b>PO Number:</b> {po.poNumber}</p>
        <p className={PARAGRAPH}><b>Date:</b> {issuedOn}</p>
      </div>
    </div>
  );
}

function Addresses({ po, head, shipAddress }) {
  const vendor = po.Vendor;
  return (
    <div className="tw:mb-8 tw:flex tw:flex-col tw:gap-4 tw:sm:flex-row">
      <div className={BOX}>
        <h4 className={BOX_TITLE}>VENDOR DETAILS (TO):</h4>
        <p className={cn(PARAGRAPH, 'tw:text-sm tw:font-bold')}>{vendor ? vendor.vendorName : 'N/A'}</p>
        {vendor?.address && <p className={PARAGRAPH}>{vendor.address}</p>}
        {vendor?.phone && <p className={PARAGRAPH}><b>Phone:</b> {vendor.phone}</p>}
        {vendor?.contactEmail && <p className={PARAGRAPH}><b>Email:</b> {vendor.contactEmail}</p>}
        {vendor?.gstNumber && <p className={PARAGRAPH}><b>GSTIN:</b> {vendor.gstNumber}</p>}
      </div>
      <div className={BOX}>
        <h4 className={BOX_TITLE}>SHIP TO / BRANCH:</h4>
        <p className={cn(PARAGRAPH, 'tw:text-sm tw:font-bold')}>{po.branch}</p>
        <p className={PARAGRAPH}>{head.name}</p>
        <p className={PARAGRAPH}>{shipAddress}</p>
        <p className={PARAGRAPH}>Please deliver all materials to the above branch address between 10 AM and 6 PM.</p>
      </div>
    </div>
  );
}

function ApprovalFooter({ po }) {
  const approved = po.status === 'Approved';
  return (
    <div className="tw:mt-10 tw:flex tw:flex-col tw:gap-6 tw:sm:flex-row tw:sm:items-end tw:sm:justify-between">
      <div className="tw:sm:w-[60%]">
        <h5 className="tw:m-0 tw:mb-1 tw:text-xs tw:font-bold">Internal Approval Details:</h5>
        <div className="tw:flex tw:flex-col tw:gap-1 tw:rounded-sm tw:border tw:border-dashed tw:border-input tw:bg-white tw:p-2.5 tw:text-[11px] tw:text-muted-foreground">
          <p className={PARAGRAPH}><b>Status:</b> {po.status}</p>
          <p className={PARAGRAPH}><b>Priority:</b> {po.priority}</p>
          <p className={PARAGRAPH}><b>Remarks:</b> {po.justification}</p>
          {po.directorRemarks && (
            <p className={PARAGRAPH}>
              <b>Approval Remarks:</b> <b className={approved ? 'tw:text-success' : 'tw:text-destructive'}>{po.directorRemarks}</b> (ON {localDateTime(actionTime(po))})
            </p>
          )}
        </div>
      </div>
      <div className="tw:text-center tw:sm:w-[30%]">
        {approved && (
          <div className="tw:mb-2.5 tw:inline-block tw:rounded-full tw:border-2 tw:border-success tw:p-2.5 tw:text-xl tw:font-black tw:tracking-[2px] tw:text-success tw:opacity-80 tw:[transform:rotate(-15deg)]">
            APPROVED
          </div>
        )}
        <div className={cn('tw:border-t tw:border-black tw:pt-1', !approved && 'tw:mt-[60px]')}><b>Authorized Signatory</b></div>
      </div>
    </div>
  );
}

/** The purchase order sheet that is shown and saved as PDF. */
export default function PurchaseOrderDocument({ po, head, shipAddress, issuedOn, sheetRef }) {
  return (
    <div ref={sheetRef} className="tw:bg-white tw:p-4 tw:font-[Arial,sans-serif] tw:text-sm tw:text-black tw:sm:p-10">
      <CompanyHead head={head} po={po} issuedOn={issuedOn} />
      <Addresses po={po} head={head} shipAddress={shipAddress} />
      <POItemsTable items={po.items || []} grandTotal={po.totalAmount} itemHeader="Item Description" showReceived className="tw:mb-8" />
      <div className="tw:mt-8 tw:rounded-sm tw:border tw:border-border tw:bg-white tw:p-4">
        <h5 className="tw:m-0 tw:mb-2.5 tw:text-xs tw:font-bold tw:uppercase">Terms &amp; Conditions:</h5>
        <ol className="tw:m-0 tw:pl-5 tw:text-[10px] tw:leading-normal tw:text-muted-foreground">
          {TERMS.map((term) => <li key={term}>{term}</li>)}
        </ol>
      </div>
      <ApprovalFooter po={po} />
    </div>
  );
}
