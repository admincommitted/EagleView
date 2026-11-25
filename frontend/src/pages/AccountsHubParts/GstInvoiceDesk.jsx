// GST Invoice - iCAFFE's Operation > GST Invoice, inside Accounts: one screen for the nine kinds (Service, Reimbursable,
// Other, Debit Note, Courier, Credit Note, Consultancy, CAN, OverSeas Agent). Save posts the invoice to the books at once
// (routes/accountsGstInvoice.js); the posting is shown before Save.
import { Box, Sheet } from './ui';
import useGstInvoiceDesk from './GstInvoiceDeskParts/hooks/useGstInvoiceDesk';
import InvoiceEntry from './GstInvoiceDeskParts/sections/InvoiceEntry';
import InvoiceSearch from './GstInvoiceDeskParts/sections/InvoiceSearch';

export { inWords } from './GstInvoiceDeskParts/gstMath';
export { invoiceHtml, openInvoicePdf, printInvoice, downloadEInvoice } from './GstInvoiceDeskParts/invoicePrint';
export { InvoiceSend, InvoiceViewer } from './GstInvoiceDeskParts/sections/InvoiceViewer';
export { ProvisionalSheet, ProvisionalSheetScreen } from './GstInvoiceDeskParts/sections/ProvisionalSheet';
export { EinvSettings } from './GstInvoiceDeskParts/sections/IrnPanels';

export default function GstInvoiceDesk({ kind: kindId }) {
  const desk = useGstInvoiceDesk(kindId);
  const { kind, metaError, tab, setTab } = desk;

  if (metaError) {
    return (
      <Box title={'GST Invoice - ' + kind.label}>
        <div className="tw:font-bold tw:text-destructive">Could not load the invoice set-up: {metaError}</div>
      </Box>
    );
  }
  const tabs = [{ id: 'entry', label: kind.label + (kind.label === 'OverSeas Agent' ? ' Invoice' : '') }, { id: 'search', label: 'Search' }];
  return (
    <Sheet tabs={tabs} tab={tab} onTab={setTab} right={<span className="tw:text-[11px] tw:text-muted-foreground">GST Invoice - posts to the books on Save</span>}>
      {tab === 'search' && <InvoiceSearch kindId={kindId} onOpen={desk.openSearchResult} />}
      {tab === 'entry' && <InvoiceEntry desk={desk} />}
    </Sheet>
  );
}
