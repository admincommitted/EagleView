import { useCallback, useEffect, useState } from 'react';
import { Mail, X } from 'lucide-react';
import { Button, HtmlPreview, Input, Textarea } from '@/components/ui';
import { toDisplayDate } from '@/lib/dates';
import { FormGrid, GridField, Panel, StatusMessage } from './layout';
import { shipmentApi } from './shipmentApi';

// the status mail to the customer: the server fills To / Subject and draws the status table
export default function StatusMail({ shipmentId, docketNo, onClose }) {
  const [mail, setMail] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const preview = await shipmentApi.statusMail(shipmentId);
      setMail((current) => ({ to: preview.to, cc: '', subject: preview.subject, message: '', ...(current || {}), html: preview.html, log: preview.log }));
    } catch (error) {
      setMessage({ tone: 'error', text: error.message });
    }
  }, [shipmentId]);
  useEffect(() => { load(); }, [load]);

  const setPart = (key) => (event) => setMail({ ...mail, [key]: event.target.value });

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const answer = await shipmentApi.sendStatusMail(shipmentId, { to: mail.to, cc: mail.cc, subject: mail.subject, message: mail.message });
      setMessage({ tone: 'success', text: 'Mail sent to ' + answer.to.join(', ') });
      load();
    } catch (error) {
      setMessage({ tone: 'error', text: error.message });
    }
    setBusy(false);
  };

  return (
    <Panel title={'Send Mail - status of ' + docketNo} actions={<Button size="sm" variant="ghost" onClick={onClose}><X className="tw:size-3" /> Close</Button>}>
      {!mail ? (
        <span className="tw:text-muted-foreground">{message ? message.text : 'Loading'}</span>
      ) : (
        <>
          <FormGrid columns={6}>
            <GridField label="To" required span={3}>
              <Input value={mail.to} required={!mail.to} onChange={setPart('to')} placeholder="from the party master e-mail; comma between two" />
            </GridField>
            <GridField label="CC" span={3}><Input value={mail.cc} onChange={setPart('cc')} /></GridField>
            <GridField label="Subject" span={6}><Input value={mail.subject} onChange={setPart('subject')} /></GridField>
            <GridField label="Message (on top of the status table)" span={6}>
              <Textarea className="tw:h-[50px]" value={mail.message} onChange={setPart('message')} />
            </GridField>
          </FormGrid>
          <HtmlPreview title="Status mail preview" html={mail.html} className="tw:h-[260px] tw:border tw:border-primary/25" />
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <Button variant="success" onClick={send} disabled={busy}><Mail /> {busy ? 'Sending' : 'Send Mail'}</Button>
            <StatusMessage message={message} />
          </div>
          {mail.log?.length > 0 && (
            <div className="tw:text-[11px] tw:text-muted-foreground">
              Sent before:
              {mail.log.map((entry, index) => (
                <div key={index}>{toDisplayDate(entry.eventDate)} {entry.eventTime} - {entry.remarks}{entry.createdBy ? ' (' + entry.createdBy + ')' : ''}</div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
