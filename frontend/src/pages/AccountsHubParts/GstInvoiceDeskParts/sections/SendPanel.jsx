import { useState } from 'react';
import { Mail, MessageCircle, X } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Input, Textarea } from '@/components/ui';
import { Box, fmtDate, inr } from '../../ui';
import { accountsApi } from '../../accountsApi';
import { TITLES } from '../gstMath';
import { invoiceHtml } from '../invoicePrint';
import { GridField, StatusText } from './formParts';

const amountText = (invoice) => (invoice.currency && invoice.currency !== 'INR' && invoice.totalFcy
  ? invoice.currency + ' ' + inr(invoice.totalFcy) + ' (INR ' + inr(invoice.total) + ')' : 'INR ' + inr(invoice.total));
const defaultMessage = (invoice) => `Dear Sir / Madam,\n\nPlease find attached our ${(invoice.kindLabel || 'invoice').toLowerCase()} ${invoice.invoiceNo} dated ${fmtDate(invoice.date)} for ${amountText(invoice)}${invoice.jobNo ? ', docket ' + invoice.jobNo : ''}${invoice.hawbNo ? ', HAWB ' + invoice.hawbNo : ''}.\n\nRegards,\nAccounts`;
const sentBefore = (log) => log.slice(-3).map((entry) => (entry.type === 'mail' ? 'mail ' : 'WhatsApp ') + entry.to + ' ' + fmtDate(entry.at)).join('; ');

// Send Mail / WhatsApp of an invoice, the PDF attached by the server; mode: 'mail' | 'whatsapp' | 'wa'
export default function SendPanel({ mode, inv: invoice, email, initialTo, onClose, onDone }) {
  const mail = mode === 'mail';
  const [to, setTo] = useState(mail ? email || '' : initialTo || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState((TITLES[invoice.kind] || 'Invoice') + ' ' + invoice.invoiceNo + ' - ' + invoice.partyName);
  const [body, setBody] = useState(() => defaultMessage(invoice));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const send = async () => {
    setBusy(true); setMsg(null);
    try {
      const { html } = await invoiceHtml(invoice.id);
      if (mail) {
        const result = await accountsApi.gstInvoiceMail(invoice.id, { to, cc, subject, body, html });
        setMsg({ ok: true, t: 'Mailed to ' + result.to + ' with the invoice PDF' });
      } else {
        const result = await accountsApi.gstInvoiceWhatsapp(invoice.id, { to, message: body, html });
        setMsg({ ok: true, t: 'Sent on WhatsApp' + (result.pdf ? ' with the invoice PDF' : '') + ' (' + result.via + ')' });
      }
      if (onDone) onDone();
    } catch (error) {
      setMsg({ bad: true, t: errorMessage(error) });
    }
    setBusy(false);
  };

  return (
    <Box title={(mail ? 'Send Mail - ' : 'Send WhatsApp - ') + invoice.invoiceNo + ' (PDF attached)'} right={<Button variant="ghost" onClick={onClose}><X /> Close</Button>}>
      <div className={mail ? 'tw:grid tw:grid-cols-1 tw:gap-2 tw:md:grid-cols-[1.2fr_1fr_2fr]' : 'tw:grid tw:grid-cols-1 tw:gap-2 tw:md:grid-cols-[1fr_3fr]'}>
        <GridField label={mail ? 'To' : 'Mobile No'} required>
          <Input data-allow-text required={!to} value={to} onChange={(event) => setTo(event.target.value)} placeholder={mail ? 'name@company.com; other@...' : '10 digits or with country code'} />
        </GridField>
        {mail && <GridField label="Cc"><Input data-allow-text value={cc} onChange={(event) => setCc(event.target.value)} /></GridField>}
        {mail && <GridField label="Subject"><Input data-allow-text value={subject} onChange={(event) => setSubject(event.target.value)} /></GridField>}
        <GridField label="Message" className={mail ? 'tw:md:col-span-3' : ''}><Textarea className="tw:h-[110px]" value={body} onChange={(event) => setBody(event.target.value)} /></GridField>
      </div>
      <div className="tw:mt-2 tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <Button variant="success" size="lg" onClick={send} disabled={busy || !to}>{mail ? <Mail /> : <MessageCircle />} {busy ? 'Sending' : 'Send'}</Button>
        <StatusText msg={msg} />
        {invoice.mailLog && invoice.mailLog.length > 0 && <span className="tw:ml-auto tw:text-[11px] tw:text-muted-foreground">Sent before: {sentBefore(invoice.mailLog)}</span>}
      </div>
    </Box>
  );
}
