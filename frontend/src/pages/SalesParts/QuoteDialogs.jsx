import { Mail, Trophy, XCircle } from 'lucide-react';
import { Button, Input, Modal, SelectBox, Textarea } from '@/components/ui';
import { FormField, Muted } from './salesWidgets';
import { FORM_GRID } from './salesStyles';
import { lostReasons } from './salesFormat';
import { pdfFileName } from './quoteMath';

function dialogFooter(onCancel, action) {
  return <><Button onClick={onCancel}>Cancel</Button>{action}</>;
}

export function MailDialog({ quoteNo, mail, busy, onChange, onCancel, onSend }) {
  const field = (name) => ({ value: mail[name], onChange: (event) => onChange({ ...mail, [name]: event.target.value }) });
  const send = <Button variant="default" disabled={busy} onClick={onSend}><Mail /> {busy ? 'Sending…' : 'Send with PDF'}</Button>;
  return (
    <Modal open title={`Mail ${quoteNo}`} onClose={onCancel} width={620} footer={dialogFooter(onCancel, send)}>
      <div className="tw:grid tw:gap-2">
        <FormField label="To" required><Input data-allow-text="" {...field('to')} /></FormField>
        <FormField label="Cc"><Input data-allow-text="" {...field('cc')} /></FormField>
        <FormField label="Subject"><Input data-allow-text="" {...field('subject')} /></FormField>
        <FormField label="Message"><Textarea className="tw:min-h-[140px]" {...field('body')} /></FormField>
        <Muted>Goes from the e-mail account in Settings &gt; Email, with {pdfFileName(quoteNo)} attached. The quotation is then marked sent.</Muted>
      </div>
    </Modal>
  );
}

export function WonDialog({ quoteNo, docketNo, busy, onChange, onCancel, onMarkWon }) {
  const markWon = <Button variant="success" disabled={busy} onClick={onMarkWon}><Trophy /> Mark won</Button>;
  return (
    <Modal open title={`Won - ${quoteNo}`} onClose={onCancel} width={480} footer={dialogFooter(onCancel, markWon)}>
      <FormField
        label="Docket no (if already registered)"
        note="Freight > Shipment Registration. The docket gets this quotation no., and its Provisional Sheet then offers these charges at the quoted rates. Can be left blank."
      >
        <Input data-allow-text="" value={docketNo} onChange={(event) => onChange(event.target.value.toUpperCase())} placeholder="e.g. DEL/AI/1001/26" />
      </FormField>
    </Modal>
  );
}

export function LostDialog({ quoteNo, lost, meta, busy, onChange, onCancel, onMarkLost }) {
  const markLost = <Button variant="destructive" disabled={busy || !lost.reason} onClick={onMarkLost}><XCircle /> Mark lost</Button>;
  return (
    <Modal open title={`Lost - ${quoteNo}`} onClose={onCancel} width={480} footer={dialogFooter(onCancel, markLost)}>
      <div className={FORM_GRID.wide}>
        <FormField label="Reason" required>
          <SelectBox clearable clearLabel="- pick -" placeholder="- pick -" value={lost.reason} onValueChange={(reason) => onChange({ ...lost, reason })} options={lostReasons(meta)} />
        </FormField>
        <FormField label="Lost to (competitor)"><Input value={lost.lostTo || ''} onChange={(event) => onChange({ ...lost, lostTo: event.target.value })} /></FormField>
        <FormField label="Their rate (if known)">
          <Input data-allow-text="" value={lost.lostRate || ''} onChange={(event) => onChange({ ...lost, lostRate: event.target.value })} placeholder="e.g. USD 2.20/kg" />
        </FormField>
      </div>
    </Modal>
  );
}
