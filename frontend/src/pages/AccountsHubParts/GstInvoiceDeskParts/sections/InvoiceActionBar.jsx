import { Ban, FileJson, FileMinus, Mail, MessageCircle, Pencil, Printer, Receipt, RotateCcw, Save, Send, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { ActionBar, inr } from '../../ui';
import { printInvoice } from '../invoicePrint';
import { StatusText } from './formParts';

export default function InvoiceActionBar({ desk }) {
  const { loaded, viewOnly, isVoid, irnLive, kind, kindId, editId, lines, posting, showPosting, setShowPosting, togglePanel, actions, msg } = desk;
  const editable = loaded && !viewOnly;
  const irnText = loaded && loaded.irn ? 'IRN ' + (loaded.irnStatus === 'Cancelled' ? 'cancelled' : 'details') : 'E-Invoice JSON';
  return (
    <ActionBar>
      <Button variant="success" size="lg" onClick={actions.save} disabled={viewOnly || actions.busy || isVoid || !lines.length || irnLive}
        title={irnLive ? 'IRN generated - issue a credit / debit note instead' : ''}>
        <Save /> {actions.busy ? 'Saving' : editId ? 'Save changes' : 'Save'}
      </Button>
      <Button variant="secondary" size="lg" onClick={() => desk.setTab('search')}><Pencil /> Modify</Button>
      <Button size="lg" onClick={desk.clear}><RotateCcw /> Clear</Button>
      <Button variant="secondary" size="lg" onClick={() => loaded && printInvoice(loaded.id)} disabled={!loaded} title={loaded ? '' : 'Save or open an invoice first'}><Printer /> Print</Button>
      {editable && !isVoid && !irnLive && <Button variant="destructive" size="lg" onClick={actions.voidInvoice}><Ban /> Void</Button>}
      {editable && !irnLive && <Button variant="destructive" size="lg" onClick={actions.deleteInvoice}><Trash2 /> Delete</Button>}
      {editable && !isVoid && kindId !== 'reimbursable' && !loaded.irn && <Button variant="default" size="lg" onClick={actions.postToGstn} disabled={actions.busy}><Send /> Post To GSTN</Button>}
      {irnLive && !viewOnly && <Button variant="destructive" size="lg" onClick={() => togglePanel('cancelirn')}><XCircle /> Cancel IRN</Button>}
      {loaded && !isVoid && !kind.againstBill && <Button variant="ghost" size="lg" onClick={() => desk.startNote('gstcreditnote')}><FileMinus /> Credit Note</Button>}
      {loaded && !isVoid && !kind.againstBill && <Button variant="ghost" size="lg" onClick={() => desk.startNote('gstdebitnote')}><Receipt /> Debit Note</Button>}
      {loaded && !isVoid && <Button variant="secondary" size="lg" onClick={() => togglePanel('mail')}><Mail /> Send Mail</Button>}
      {loaded && !isVoid && <Button variant="secondary" size="lg" onClick={() => togglePanel('wa')}><MessageCircle /> WhatsApp</Button>}
      {loaded && !isVoid && kindId !== 'reimbursable' && <Button variant="secondary" size="lg" onClick={() => togglePanel('irn')}><FileJson /> {irnText}</Button>}
      {posting && <Button variant="ghost" size="lg" onClick={() => setShowPosting((shown) => !shown)}>{showPosting ? 'Hide' : 'Show'} posting</Button>}
      {loaded && loaded.notes && loaded.notes.length > 0 && (
        <span className="tw:text-[11px] tw:text-muted-foreground">Notes on it: {loaded.notes.map((note) => note.invoiceNo + ' (' + inr(note.total) + ')').join(', ')}</span>
      )}
      <StatusText msg={msg} className="tw:ml-auto" />
    </ActionBar>
  );
}
