import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, MessageCircle, Printer, Receipt } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { downloadBlob } from '@/lib/download';
import { Button, Modal } from '@/components/ui';
import { inr } from '../../ui';
import { accountsApi } from '../../accountsApi';
import { pdfFileName } from '../gstMath';
import { invoiceHtml, invoiceOfVoucher, makeInvoicePdf, printInvoice } from '../invoicePrint';
import SendPanel from './SendPanel';

const PRINT_DELAY_MS = 800;

// the invoice behind a voucher (or an invoice id) with its contact; for the Mail / WhatsApp windows
function useInvoiceWithContact(voucherId) {
  const [invoice, setInvoice] = useState(null);
  const [contact, setContact] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const load = async () => {
      try {
        const head = await invoiceOfVoucher(voucherId);
        setInvoice(await accountsApi.gstInvoice(head.id));
        let found = {};
        try { found = await accountsApi.gstInvoiceContact(head.id); } catch { /* no contact on file */ }
        setContact(found);
      } catch (loadError) {
        setError(errorMessage(loadError));
      }
    };
    load();
  }, [voucherId]);
  return { invoice, contact, error };
}

// Mail / WhatsApp of the invoice behind a voucher (PDF attached), as a small window over the screen
export function InvoiceSend({ voucherId, mode, onClose }) {
  const { invoice, contact, error } = useInvoiceWithContact(voucherId);
  return (
    <Modal open onClose={onClose} width={820} title={mode === 'mail' ? 'Send Mail' : 'Send WhatsApp'}>
      {error ? <div className="tw:text-entry tw:text-destructive">{error}</div>
        : invoice && contact ? <SendPanel mode={mode} inv={invoice} email={contact.email || invoice.email || ''} initialTo={mode === 'whatsapp' ? contact.phone || '' : undefined} onClose={onClose} onDone={() => null} />
          : <div className="tw:text-entry tw:text-muted-foreground">Opening...</div>}
    </Modal>
  );
}

// the invoice as a PDF; when the server cannot make one, the saved invoice page is shown (Print works from there)
function useInvoicePdf(voucherId, invoiceId) {
  const [invoice, setInvoice] = useState(null);
  const [contact, setContact] = useState({});
  const [pdf, setPdf] = useState({ blob: null, url: '' });
  const [page, setPage] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    let madeUrl = '';
    const loadContact = async (id) => {
      try { const found = await accountsApi.gstInvoiceContact(id); if (alive) setContact(found || {}); } catch { /* no contact on file */ }
    };
    const load = async () => {
      try {
        const head = invoiceId ? { id: invoiceId } : await invoiceOfVoucher(voucherId);
        const { html, inv: full } = await invoiceHtml(head.id);
        if (!alive) return;
        setInvoice(full);
        loadContact(head.id);
        const made = await makeInvoicePdf(head.id, html);
        if (made.failed) { if (alive) { setPage(html); setPdfError(made.failed); } return; }
        madeUrl = URL.createObjectURL(made.blob);
        if (alive) setPdf({ blob: made.blob, url: madeUrl });
      } catch (loadError) {
        if (alive) setError(errorMessage(loadError));
      }
    };
    load();
    return () => { alive = false; if (madeUrl) URL.revokeObjectURL(madeUrl); };
  }, [voucherId, invoiceId]);
  return { invoice, contact, pdf, page, pdfError, error };
}

function ViewerTitle({ invoice }) {
  if (!invoice) return 'Invoice';
  const amount = invoice.currency && invoice.currency !== 'INR' && invoice.totalFcy ? invoice.currency + ' ' + inr(invoice.totalFcy) : 'INR ' + inr(invoice.total);
  return (
    <span className="tw:text-[13px] tw:font-bold">
      {invoice.invoiceNo + ' - ' + invoice.partyName + ' - ' + amount}
      {invoice.irn && invoice.irnStatus !== 'Cancelled' && <span className="tw:ml-1.5 tw:text-[10px] tw:text-success">IRN</span>}
    </span>
  );
}

// a bill opened from Outstanding / reports - the invoice as a PDF, with Print, Download, Mail and WhatsApp
export function InvoiceViewer({ voucherId, invoiceId, onClose }) {
  const navigate = useNavigate();
  const { invoice, contact, pdf, page, pdfError, error } = useInvoicePdf(voucherId, invoiceId);
  const { url } = pdf;
  const [mode, setMode] = useState(null);

  const download = () => { if (pdf.blob) downloadBlob(pdf.blob, pdfFileName(invoice.invoiceNo) + '.pdf'); };
  const print = () => {
    const tab = window.open(url, '_blank');
    if (tab) setTimeout(() => { try { tab.print(); } catch { /* the PDF viewer has its own Print */ } }, PRINT_DELAY_MS);
  };
  const openInGstInvoice = () => navigate('/accounts-hub?item=gst' + invoice.kind + '&inv=' + encodeURIComponent(invoice.invoiceNo));

  return (
    <Modal open onClose={onClose} width={1000} title={<ViewerTitle invoice={invoice} />} className="tw:h-[min(92vh,1100px)]" bodyClassName="tw:p-0 tw:gap-0 tw:overflow-hidden">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:border-b tw:border-border tw:px-3 tw:py-2">
        <Button variant="secondary" onClick={download} disabled={!url}><Receipt /> Download PDF</Button>
        <Button variant="secondary" onClick={print} disabled={!url}><Printer /> Print</Button>
        <Button variant="secondary" onClick={() => setMode('mail')} disabled={!invoice}><Mail /> E-mail</Button>
        <Button variant="secondary" onClick={() => setMode('whatsapp')} disabled={!invoice}><MessageCircle /> WhatsApp</Button>
        {invoice && <Button variant="ghost" onClick={openInGstInvoice}>Open in GST Invoice</Button>}
      </div>
      {mode && invoice && (
        <div className="tw:border-b tw:border-border tw:p-2">
          <SendPanel mode={mode} inv={invoice} email={contact.email || invoice.email || ''} initialTo={mode === 'whatsapp' ? contact.phone || '' : undefined} onClose={() => setMode(null)} onDone={() => setMode(null)} />
        </div>
      )}
      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:bg-page">
        {error ? <div className="tw:p-4 tw:text-entry tw:text-destructive">{error}</div>
          : url ? <iframe title="invoice" src={url} className="tw:h-full tw:w-full tw:flex-1 tw:border-0" />
            : page ? (
              <>
                <div title={pdfError} className="tw:bg-warning/10 tw:px-2.5 tw:py-1 tw:text-[11px] tw:text-warning">
                  PDF could not be made on this computer - the saved invoice is shown; Print works from here.
                  <Button variant="link" size="sm" className="tw:ml-2 tw:h-auto" onClick={() => printInvoice(invoice.id)}>Print</Button>
                </div>
                <iframe title="invoice" srcDoc={page} className="tw:w-full tw:flex-1 tw:border-0 tw:bg-white" />
              </>
            ) : <div className="tw:p-4 tw:text-entry tw:text-muted-foreground">Making the PDF...</div>}
      </div>
    </Modal>
  );
}
