import { PostingTable } from '../../ui';
import InvoiceHeaderSection from './InvoiceHeaderSection';
import ChargeLineSection from './ChargeLineSection';
import ChargeGridSection from './ChargeGridSection';
import InvoiceTotalsSection from './InvoiceTotalsSection';
import InvoiceActionBar from './InvoiceActionBar';
import ExpensesSection from './ExpensesSection';
import BulkInvoicePopup from './BulkInvoicePopup';
import SendPanel from './SendPanel';
import { ProvisionalSheet } from './ProvisionalSheet';
import { CancelIrnPanel, IrnPanel } from './IrnPanels';

function ViewOnlyBanner({ loaded }) {
  return (
    <div className="tw:rounded-md tw:border tw:border-primary/30 tw:bg-primary/10 tw:px-3 tw:py-2 tw:text-entry tw:font-semibold tw:text-head">
      VIEW ONLY - bill loaded from iCAFFE. Print, mail and WhatsApp work; for a change issue a credit / debit note.{loaded && loaded.viewNote ? ' (' + loaded.viewNote + ')' : ''}
    </div>
  );
}

// the Invoice tab: header, charge line, charge grid, totals, actions and the panels they open
export default function InvoiceEntry({ desk }) {
  const { head, loaded, viewOnly, isVoid, panel, setPanel, expenses, posting, showPosting, provisionalJob, bulk } = desk;
  const closePanel = () => setPanel(null);
  const addDockets = async (dockets) => { if (await bulk.addBulkDockets(dockets)) closePanel(); };
  const irnCancelled = (note) => { desk.setMsg({ ok: true, t: note }); closePanel(); desk.reloadLoaded(); };

  return (
    <>
      {viewOnly && <ViewOnlyBanner loaded={loaded} />}
      <fieldset disabled={viewOnly} className="tw:m-0 tw:min-w-0 tw:border-0 tw:p-0">
        <InvoiceHeaderSection desk={desk} />
      </fieldset>
      {expenses && <ExpensesSection jobNo={head.jobNo} expenses={expenses} onBill={desk.billExpense} onClose={() => desk.setExpenses(null)} />}
      {panel === 'dockets' && head.bulk && <BulkInvoicePopup partyName={head.partyName} partyId={head.partyId} chosen={head.dockets} onOk={addDockets} onClose={closePanel} />}
      {panel === 'prov' && provisionalJob && (
        <ProvisionalSheet key={provisionalJob} jobNo={provisionalJob} partyName={head.partyName} onAdd={isVoid ? null : bulk.addFromSheet} onClose={closePanel} />
      )}
      {!viewOnly && <ChargeLineSection desk={desk} />}
      <ChargeGridSection desk={desk} />
      <InvoiceTotalsSection desk={desk} />
      <InvoiceActionBar desk={desk} />
      {loaded && (panel === 'mail' || panel === 'wa') && <SendPanel key={panel} mode={panel} inv={loaded} email={head.email} onClose={closePanel} onDone={desk.reloadLoaded} />}
      {loaded && panel === 'irn' && <IrnPanel inv={loaded} onClose={closePanel} onDone={desk.reloadLoaded} />}
      {loaded && panel === 'cancelirn' && <CancelIrnPanel inv={loaded} onClose={closePanel} onDone={irnCancelled} />}
      {showPosting && posting && <PostingTable title="Posting on Save (voucher in the books)" lines={posting.map((line) => ({ ...line, ledgerName: line.ledger }))} />}
    </>
  );
}
