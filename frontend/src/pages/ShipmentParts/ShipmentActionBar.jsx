import { Copy, FileText, Mail, Paperclip, Pencil, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui';
import { StatusMessage } from './layout';
import { formatInr } from './shipmentForm';

export default function ShipmentActionBar({ form }) {
  const { shipment, shipmentId, busy, message, invoices, setTab, save, duplicate, clear, remove, syncCustoms } = form;
  const opened = Boolean(shipmentId);

  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-md tw:border tw:border-primary/25 tw:bg-primary/10 tw:px-2.5 tw:py-2">
      <Button variant="success" onClick={save} disabled={busy || shipment.stage === 'Cancelled'}>
        <Save /> {busy ? 'Saving' : opened ? 'Save changes' : 'Save'}
      </Button>
      <Button variant="secondary" onClick={() => setTab('search')}><Pencil /> Modify</Button>
      <Button variant="secondary" onClick={duplicate} disabled={!opened}><Copy /> Duplicate</Button>
      <Button variant="secondary" onClick={() => setTab('cost')} disabled={!opened}><FileText /> Cost Sheet</Button>
      <Button variant="secondary" onClick={() => setTab('docs')} disabled={!opened} title="Attach the papers of this docket"><Paperclip /> Upload Docs</Button>
      <Button variant="secondary" onClick={() => setTab('status')} disabled={!opened} title="Status update and the status mail to the customer"><Mail /> Status / Mail</Button>
      <Button onClick={clear}><RotateCcw /> Clear</Button>
      {opened && <Button variant="destructive" onClick={remove} disabled={busy}><Trash2 /> Delete</Button>}
      {opened && shipment.ediJobNo && <Button variant="ghost" onClick={syncCustoms}><Upload /> Customs status</Button>}
      {invoices.length > 0 && (
        <span className="tw:text-[11px] tw:text-muted-foreground">
          Billed: {invoices.map((invoice) => invoice.invoiceNo + ' (' + formatInr(invoice.total) + ')').join(', ')}
        </span>
      )}
      <StatusMessage message={message} className="tw:ml-auto tw:text-entry" />
    </div>
  );
}
