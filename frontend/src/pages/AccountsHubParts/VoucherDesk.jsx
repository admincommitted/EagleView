// Voucher screens laid out like iCAFFE - an entry tab and a Search tab.
// Receipt / Payment / Remittance: boxes on top (voucher, cash-bank book, account, amount + cheque), an entry strip
// (docket, TDS, bank charge, due bills) with Add, the "Accounts Information" grid, then narration and totals.
// Journal / Contra / Inter branch: header box, an Account - Amount - Dr/Cr strip with Add, the grid, Dr / Cr totals.
// Everything is saved through POST /vouchers (Dr = Cr, closed months refused).
import { FileText, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { Btn, Empty, Sheet } from './ui';
import { AttachDocs } from './extras';
import { PurchaseForm } from './PurchaseDeskParts/sections/PurchaseForm';
import { purchaseFromVoucher } from './PurchaseDeskParts/purchaseFromVoucher';
import { cashFromVoucher } from './VoucherDeskParts/cashFromVoucher';
import { useVoucherDesk } from './VoucherDeskParts/hooks/useVoucherDesk';
import { CashForm } from './VoucherDeskParts/sections/CashForm';
import { FindVoucher } from './VoucherDeskParts/sections/FindVoucher';
import { LinesForm } from './VoucherDeskParts/sections/LinesForm';
import { SearchTab } from './VoucherDeskParts/sections/SearchTab';
import { VoucherView } from './VoucherDeskParts/sections/VoucherView';

export { DIV_OPTS, DESKS, divFrom, nextVoucherNo } from './VoucherDeskParts/voucherConfig';
export { cashFromVoucher } from './VoucherDeskParts/cashFromVoucher';

// a saved voucher opens for Modify / Copy in its own form when its lines fit it, else in the Dr / Cr form
const formFor = (voucher, cfg) => {
  if (cfg.mode === 'cash' && ['Receipt', 'Payment'].includes(voucher.baseType) && cashFromVoucher(voucher, cfg)) return 'cash';
  if (cfg.mode === 'purchase' && ['Purchase', 'Debit Note'].includes(voucher.baseType) && purchaseFromVoucher(voucher)) return 'purchase';
  return 'lines';
};

function EditForm({ desk, cfg, edit, typeId, draftKey, onSaved, onBack }) {
  const { voucher, mode } = edit;
  const props = { typeId: mode === 'modify' ? voucher.voucherTypeId : typeId, initial: voucher, editId: mode === 'modify' ? voucher.id : null, onSaved, onClear: onBack };
  const form = formFor(voucher, cfg);
  if (form === 'cash') return <CashForm cfg={cfg} {...props} />;
  if (form === 'purchase') return <PurchaseForm desk={desk} draftKey={draftKey} {...props} />;
  return <LinesForm cfg={{ ...cfg, mode: 'lines', banksOnly: cfg.banksOnly && voucher.baseType === 'Contra' }} {...props} />;
}

function NewForm({ desk, cfg, typeId, draftKey, onSaved, onClear, actions }) {
  const props = { typeId, onSaved, onClear, actions };
  if (cfg.mode === 'purchase') return <PurchaseForm desk={desk} draftKey={draftKey} {...props} />;
  if (cfg.mode === 'cash') return <CashForm cfg={cfg} {...props} />;
  return <LinesForm cfg={cfg} {...props} />;
}

function EntryAttachments({ edit, draftKey, typeId }) {
  if (edit) return edit.mode === 'modify' ? <AttachDocs voucherId={edit.voucher.id} /> : <AttachDocs draftKey={draftKey} />;
  return typeId ? <AttachDocs draftKey={draftKey} /> : null;
}

export default function VoucherDesk({ desk }) {
  const voucherDesk = useVoucherDesk(desk);
  const { cfg, openId, tab, typeId, formKey, edit, draftKey, finder, setFinder } = voucherDesk;
  const onEntry = tab === 'entry';
  // iCAFFE's Modify / Delete / Print on the entry screen
  const finderActions = (
    <>
      <Btn kind="plain" onClick={() => setFinder('modify')}><Pencil size={13} /> Modify</Btn>
      <Btn kind="danger" onClick={() => setFinder('delete')}><Trash2 size={13} /> Delete</Btn>
      <Btn kind="plain" onClick={() => setFinder('print')}><Printer size={13} /> Print</Btn>
    </>
  );
  const backFromEdit = () => (edit.mode === 'modify' ? voucherDesk.openVoucher(edit.voucher.id) : voucherDesk.startNew());

  return (
    <Sheet tabs={[{ id: 'entry', label: cfg.title, icon: FileText }, { id: 'search', label: 'Search', icon: Search }]} tab={tab} onTab={voucherDesk.setTab}
      right={openId && onEntry ? <Btn small kind="save" onClick={voucherDesk.startNew}><Plus size={12} /> New {cfg.title}</Btn> : null}>
      {tab === 'search' && <SearchTab cfg={cfg} onOpen={voucherDesk.openVoucher} activeId={openId} onCopy={voucherDesk.copy} />}
      {onEntry && finder && !edit && <FindVoucher cfg={cfg} action={finder} onClose={() => setFinder(null)} onModify={voucherDesk.modifyFound} />}
      {onEntry && edit && (
        <EditForm key={formKey} desk={desk} cfg={cfg} edit={edit} typeId={typeId} draftKey={draftKey} onSaved={voucherDesk.saved} onBack={backFromEdit} />
      )}
      {onEntry && !edit && openId && (
        <VoucherView key={formKey} id={openId} onNew={voucherDesk.startNew} onSearch={() => voucherDesk.setTab('search')} onModify={voucherDesk.modify} onCopy={voucherDesk.copy} onDeleted={voucherDesk.startNew} />
      )}
      {onEntry && !edit && !openId && !typeId && <Empty title={'Voucher type "' + cfg.base + '" is missing'}>Add it in Masters, Groups, Voucher types, then come back.</Empty>}
      {onEntry && !edit && !openId && typeId && (
        <NewForm key={formKey} desk={desk} cfg={cfg} typeId={typeId} draftKey={draftKey} onSaved={voucherDesk.saved} onClear={voucherDesk.startNew} actions={finderActions} />
      )}
      {onEntry && !openId && <EntryAttachments edit={edit} draftKey={draftKey} typeId={typeId} />}
    </Sheet>
  );
}
