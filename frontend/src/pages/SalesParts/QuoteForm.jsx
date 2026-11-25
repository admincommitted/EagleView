// Sales > quotation: header (validity, carrier, transit, cargo), charge lines from GST Charges with basis, buy / sell,
// minimum, currency and rate of exchange, the margin, terms; Print / PDF / Mail, Mark sent, Revise, Won (docket), Lost.
// A draft is edited directly; a sent quotation is changed through Revise (R1, R2 …).
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, FileDown, Mail, Plus, Printer, RotateCcw, Save, Send, Trash2, Trophy, XCircle } from 'lucide-react';
import { Button, DateInput, Input, Modal, NumberInput, SelectBox, Textarea } from '@/components/ui';
import askConfirm from '@/components/common/askConfirm';
import { blobErrorMessage, downloadBlob } from '@/lib/download';
import { cn } from '@/lib/utils';
import { salesHubApi } from './salesApi';
import { dmy, inr, labelsOf } from './salesFormat';
import { DealBadge, FormField, FormSection, Muted, Notice } from './salesWidgets';
import { FORM_GRID, QUOTE_STATUS } from './salesStyles';
import { autoQty, newLine, newLineKey, pdfFileName, round2, workLine } from './quoteMath';
import { quoteHtml } from './quotePrint';
import QuoteChargesTable from './QuoteChargesTable';
import { LostDialog, MailDialog, WonDialog } from './QuoteDialogs';

const DEFAULT_MARGIN_WARN_PCT = 10;
const PRINT_DELAY_MS = 400;
const PICK = { clearable: true, clearLabel: '-', placeholder: '-' };

function mailDraft(quote, serviceLabel) {
  return {
    to: quote.email || '',
    cc: quote.spEmail || '',
    subject: `Quotation ${quote.quoteNo} - ${serviceLabel || ''} ${[quote.origin, quote.destination].filter(Boolean).join(' to ')}`,
    body: `Dear ${quote.contactPerson || 'Sir / Madam'},\n\nThank you for your enquiry. Please find our quotation ${quote.quoteNo} attached, valid until ${dmy(quote.validUntil)}.\n\nWe look forward to handling your shipment.\n\nRegards,\n${quote.salesPerson || ''}${quote.spMobile ? `\n${quote.spMobile}` : ''}`,
  };
}

async function pdfErrorText(error) {
  if (!error.response) return error.message;
  const text = await blobErrorMessage(error);
  return text === error.message ? 'PDF not made' : text;
}

function Revisions({ quote, openQuote }) {
  return (
    <span className="tw:flex tw:flex-wrap tw:items-center tw:gap-1 tw:sm:ml-auto">
      Revisions:
      {quote.revisions.map((revision) => {
        const label = revision.quoteNo.split('/').pop();
        return revision.id === quote.id
          ? <b key={revision.id} className="tw:ml-1.5">{label}</b>
          : <Button key={revision.id} variant="ghost" size="sm" onClick={() => openQuote(revision.id)}>{label}</Button>;
      })}
    </span>
  );
}

export default function QuoteForm({ id, meta, deal, onClose, onChanged, openQuote }) {
  const [quote, setQuote] = useState(null);
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dialog, setDialog] = useState(null);
  const serviceLabels = labelsOf(meta.services);
  const charges = deal.charges;
  const chargesByName = useMemo(() => new Map((charges || []).map((charge) => [String(charge.chargeName).toUpperCase(), charge])), [charges]);
  const isExport = /EXP/.test(String(quote?.serviceType || ''));
  const rateOf = useCallback((code) => {
    const currency = (deal.currencies || []).find((candidate) => candidate.code === code);
    if (!currency) return null;
    return isExport ? (currency.exportRate || currency.importRate) : (currency.importRate || currency.exportRate);
  }, [deal.currencies, isExport]);

  const load = useCallback(async () => {
    try {
      const saved = (await salesHubApi.quote(id)).data;
      setQuote(saved);
      setLines((saved.lines || []).map((line) => ({ ...line, key: newLineKey(), autoQty: false })));
      setDirty(false);
    } catch (error) {
      toast.error(error.message);
      onClose();
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  if (!quote) return <Modal open title="Quotation" onClose={onClose} width={600}><Muted className="tw:text-entry">Loading…</Muted></Modal>;

  const draft = quote.status === 'DRAFT';
  const editable = draft && !busy;
  const setHeader = (field, value) => { setQuote((current) => ({ ...current, [field]: value })); setDirty(true); };
  const changeLine = (key, patch) => { setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line))); setDirty(true); };
  const removeLine = (key) => { setLines((current) => current.filter((line) => line.key !== key)); setDirty(true); };
  const addLine = (section) => { setLines((current) => [...current, newLine(section, quote.serviceType, rateOf)]); setDirty(true); };

  const worked = lines.map((line) => ({ ...line, w: workLine(line, quote) }));
  const sell = round2(worked.reduce((sum, line) => sum + line.w.sellInr, 0));
  const buy = round2(worked.reduce((sum, line) => sum + line.w.buyInr, 0));
  const margin = round2(sell - buy);
  const marginPct = sell ? round2((100 * margin) / sell) : null;
  const marginWarnPct = deal.marginWarnPct || DEFAULT_MARGIN_WARN_PCT;
  const lowMargin = marginPct != null && marginPct < marginWarnPct;
  const statusLabels = labelsOf(deal.quoteStatus);
  const saveBody = () => ({ ...quote, lines: lines.map((line, index) => ({ ...line, qty: line.autoQty ? autoQty(line.basis, quote) : line.qty, sortOrder: index })) });
  const printHtml = () => quoteHtml(
    { ...quote, lines: worked.map((line) => ({ ...line, qty: line.w.qty, sellAmount: line.w.sell, sellInr: line.w.sellInr, roe: line.w.roe })) },
    deal,
    serviceLabels[quote.serviceType],
  );

  const run = async (action, doneMessage) => {
    setBusy(true);
    try {
      const result = await action();
      if (doneMessage) toast.success(doneMessage);
      onChanged?.();
      return result;
    } catch (error) {
      toast.error(error.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const save = () => run(async () => { await salesHubApi.updateQuote(id, saveBody()); await load(); return true; }, 'Quotation saved');
  const saveFirst = async () => (draft && dirty ? save() : true);

  const print = async () => {
    if (!(await saveFirst())) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('Allow pop-ups to print'); return; }
    printWindow.document.write(printHtml());
    printWindow.document.close();
    setTimeout(() => {
      try { printWindow.focus(); printWindow.print(); } catch { /* the window was closed */ }
    }, PRINT_DELAY_MS);
  };

  const downloadPdf = async () => {
    if (!(await saveFirst())) return;
    setBusy(true);
    try {
      downloadBlob(await salesHubApi.quotePdf(id, printHtml()), pdfFileName(quote.quoteNo));
    } catch (error) {
      toast.error(await pdfErrorText(error));
    } finally {
      setBusy(false);
    }
  };

  const openMail = async () => {
    if (!(await saveFirst())) return;
    setDialog({ kind: 'mail', mail: mailDraft(quote, serviceLabels[quote.serviceType]) });
  };
  const sendMail = () => run(async () => {
    await salesHubApi.mailQuote(id, { ...dialog.mail, html: printHtml() });
    setDialog(null);
    await load();
    return true;
  }, 'Quotation mailed and marked sent');
  const markSent = async () => {
    if (!(await saveFirst())) return;
    run(async () => { await salesHubApi.markQuoteSent(id); await load(); return true; }, 'Marked as sent');
  };
  const revise = () => run(async () => {
    const revision = await salesHubApi.reviseQuote(id);
    toast.success(`Revision ${revision.quoteNo} made`);
    openQuote(revision.id);
    return true;
  });

  const markWon = async (replace) => {
    setBusy(true);
    try {
      const result = await salesHubApi.quoteWon(id, dialog.docketNo, replace);
      toast.success(result.docketNo ? `Won - docket ${result.docketNo} now bills at these rates` : 'Marked as won');
      setDialog(null);
      await load();
      onChanged?.();
    } catch (error) {
      if (error.askReplace && await askConfirm({ title: 'Docket has a quotation', message: `${error.message}\n\nReplace it with ${quote.quoteNo}?`, okLabel: 'Replace', tone: 'warn' })) {
        await markWon(true);
        return;
      }
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const markLost = () => run(async () => {
    const { reason, lostTo, lostRate } = dialog.lost;
    await salesHubApi.quoteLost(id, { reason, lostTo, lostRate });
    setDialog(null);
    await load();
    return true;
  }, 'Marked as lost');

  const reopen = async () => {
    const docketNote = quote.docketNo ? ` Docket ${quote.docketNo} loses this quotation no.` : '';
    if (!await askConfirm({ title: 'Back to sent', message: `Put ${quote.quoteNo} back to "Sent"?${docketNote}`, okLabel: 'Back to sent', tone: 'warn' })) return;
    run(async () => { await salesHubApi.reopenQuote(id); await load(); return true; }, 'Back to sent');
  };

  const remove = async () => {
    if (!await askConfirm({ title: 'Delete draft', message: `Delete draft ${quote.quoteNo}?`, okLabel: 'Delete', tone: 'danger' })) return;
    run(async () => { await salesHubApi.deleteQuote(id); onClose(); return true; }, 'Draft deleted');
  };

  const closeForm = async () => {
    if (dirty && draft && !await askConfirm({ title: 'Changes not saved', message: 'Changes are not saved. Close anyway?', okLabel: 'Close anyway', tone: 'warn' })) return;
    onClose();
  };

  const text = (field, { upper, ...props } = {}) => (
    <Input value={quote[field] ?? ''} disabled={!editable} onChange={(event) => setHeader(field, upper ? event.target.value.toUpperCase() : event.target.value)} {...props} />
  );
  const number = (field) => <NumberInput value={quote[field]} disabled={!editable} onValueChange={(value) => setHeader(field, value)} />;
  const date = (field) => <DateInput value={quote[field] || ''} disabled={!editable} onValueChange={(value) => setHeader(field, value)} />;
  const salesPersons = (meta.persons || []).filter((person) => person.isActive !== 0 || person.id === quote.salesPersonId);
  const noLines = !lines.length;

  const footer = (
    <>
      {draft && <Button variant="destructive" disabled={busy} onClick={remove}><Trash2 /> Delete</Button>}
      {['SENT', 'LOST'].includes(quote.status) && <Button disabled={busy} onClick={revise}><Copy /> Revise</Button>}
      {['WON', 'LOST'].includes(quote.status) && <Button disabled={busy} onClick={reopen}><RotateCcw /> Back to sent</Button>}
      <span className="tw:flex-1" />
      <Button disabled={busy || noLines} onClick={print}><Printer /> Print</Button>
      <Button disabled={busy || noLines} onClick={downloadPdf}><FileDown /> PDF</Button>
      {['DRAFT', 'SENT'].includes(quote.status) && <Button disabled={busy || noLines} onClick={openMail}><Mail /> Mail</Button>}
      {draft && <Button disabled={busy || noLines} onClick={markSent} title="Sent some other way (WhatsApp, portal)"><Send /> Mark sent</Button>}
      {quote.status === 'SENT' && <Button variant="destructive" disabled={busy} onClick={() => setDialog({ kind: 'lost', lost: {} })}><XCircle /> Lost</Button>}
      {quote.status === 'SENT' && <Button variant="success" disabled={busy} onClick={() => setDialog({ kind: 'won', docketNo: '' })}><Trophy /> Won</Button>}
      {draft && <Button variant="default" disabled={busy || !dirty} onClick={save}><Save /> {busy ? 'Saving…' : 'Save'}</Button>}
    </>
  );

  const addButtons = draft && (deal.sections || []).map(([section, label]) => (
    <Button key={section} size="sm" onClick={() => addLine(section)}><Plus /> {label.replace(' charges', '')}</Button>
  ));

  return (
    <Modal open title={`Quotation ${quote.quoteNo}`} onClose={closeForm} width={1200} footer={footer}>
      <div className="tw:mb-2 tw:flex tw:flex-wrap tw:items-center tw:gap-2.5 tw:text-entry">
        <DealBadge status={quote.status} variants={QUOTE_STATUS} labels={statusLabels} />
        {quote.expired && <span className="tw:font-bold tw:text-destructive">Validity over</span>}
        <b>{quote.clientName}</b>
        <span className="tw:text-muted-foreground">{serviceLabels[quote.serviceType]} {[quote.origin, quote.destination].filter(Boolean).join(' > ')}</span>
        <span className="tw:text-muted-foreground">Enquiry {quote.enquiryNo}</span>
        {quote.docketNo && <span>Docket <b>{quote.docketNo}</b></span>}
        {quote.status === 'LOST' && (
          <span className="tw:text-destructive">{quote.rejectReason}{quote.lostTo ? ` (to ${quote.lostTo})` : ''}{quote.lostRate ? `, their rate ${quote.lostRate}` : ''}</span>
        )}
        {(quote.revisions || []).length > 1 && <Revisions quote={quote} openQuote={openQuote} />}
      </div>
      {!draft && quote.status !== 'SUPERSEDED' && (
        <Notice tone="warning" className="tw:mb-2 tw:py-1 tw:text-[11.5px]">
          This quotation is {String(statusLabels[quote.status] || quote.status).toLowerCase()} - it is not changed any more. Use Revise for new rates.
        </Notice>
      )}
      {quote.status === 'SUPERSEDED' && <Notice tone="neutral" className="tw:mb-2 tw:py-1 tw:text-[11.5px]">An older revision - kept for the record.</Notice>}

      <FormSection title="Quotation">
        <div className={FORM_GRID.narrow}>
          <FormField label="Date">{date('date')}</FormField>
          <FormField label="Valid until">{date('validUntil')}</FormField>
          <FormField label="Attention">{text('contactPerson')}</FormField>
          <FormField label="E-mail">{text('email')}</FormField>
          <FormField label="Sales person">
            <SelectBox {...PICK} value={quote.salesPersonId} disabled={!editable} onValueChange={(value) => setHeader('salesPersonId', value)} options={salesPersons.map((person) => ({ value: person.id, label: person.name }))} />
          </FormField>
          <FormField label="Incoterm"><SelectBox {...PICK} value={quote.incoterms} disabled={!editable} onValueChange={(value) => setHeader('incoterms', value)} options={meta.incoterms || []} /></FormField>
          <FormField label="Carrier / line">{text('carrier')}</FormField>
          <FormField label="Routing">{text('routing', { placeholder: 'e.g. via DXB' })}</FormField>
          <FormField label="Transit time">{text('transitTime', { placeholder: 'e.g. 3-4 days' })}</FormField>
          <FormField label="Frequency">{text('frequency', { placeholder: 'e.g. daily' })}</FormField>
          <FormField label="Commodity" span={2}>{text('commodity')}</FormField>
        </div>
        <div className={cn(FORM_GRID.narrow, 'tw:mt-2')}>
          <FormField label="Packages">{number('pkgs')}</FormField>
          <FormField label="Gross wt (kg)">{number('grossWt')}</FormField>
          <FormField label="Chargeable wt (kg)">{number('chargeableWt')}</FormField>
          <FormField label="CBM">{number('cbm')}</FormField>
          <FormField label="Containers">{text('containers', { upper: true, placeholder: '2x40HC' })}</FormField>
          <FormField label="Cargo value">{number('cargoValue')}</FormField>
          <FormField label="Value currency">
            <SelectBox {...PICK} value={quote.cargoCurrency} disabled={!editable} onValueChange={(value) => setHeader('cargoCurrency', value)} options={[...new Set(['INR', ...(meta.currencies || [])])]} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Charges" actions={addButtons}>
        <QuoteChargesTable
          lines={worked}
          deal={deal}
          meta={meta}
          editable={draft}
          chargesByName={chargesByName}
          onChange={changeLine}
          onRemove={removeLine}
          rateOf={rateOf}
        />
        <div className="tw:mt-2 tw:flex tw:flex-wrap tw:justify-end tw:gap-x-4.5 tw:gap-y-1 tw:text-[12.5px]">
          <span>Sell <b>Rs {inr(sell)}</b></span>
          <span>Buy Rs {inr(buy)}</span>
          <span className={lowMargin ? 'tw:text-destructive' : 'tw:text-success'}>
            Margin <b>Rs {inr(margin)}</b>{marginPct != null ? ` (${marginPct}%)` : ''}{lowMargin ? ` - below ${marginWarnPct}%` : ''}
          </span>
          <span className="tw:text-muted-foreground">GST extra as per charge</span>
        </div>
      </FormSection>

      <FormSection title="Terms and remarks">
        <div className="tw:grid tw:grid-cols-1 tw:gap-x-3 tw:gap-y-2 tw:md:grid-cols-3">
          <FormField label="Terms & conditions (one per line)" className="tw:md:col-span-2">
            <Textarea className="tw:min-h-[110px] tw:text-[11.5px]" disabled={!editable} value={quote.terms || ''} onChange={(event) => setHeader('terms', event.target.value)} />
          </FormField>
          <FormField label="Remarks on the quotation">
            <Textarea className="tw:min-h-[110px]" disabled={!editable} value={quote.remarks || ''} onChange={(event) => setHeader('remarks', event.target.value)} />
          </FormField>
        </div>
      </FormSection>

      {dialog?.kind === 'mail' && (
        <MailDialog quoteNo={quote.quoteNo} mail={dialog.mail} busy={busy} onChange={(mail) => setDialog({ ...dialog, mail })} onCancel={() => setDialog(null)} onSend={sendMail} />
      )}
      {dialog?.kind === 'won' && (
        <WonDialog quoteNo={quote.quoteNo} docketNo={dialog.docketNo} busy={busy} onChange={(docketNo) => setDialog({ ...dialog, docketNo })} onCancel={() => setDialog(null)} onMarkWon={() => markWon(false)} />
      )}
      {dialog?.kind === 'lost' && (
        <LostDialog quoteNo={quote.quoteNo} lost={dialog.lost} meta={meta} busy={busy} onChange={(lost) => setDialog({ ...dialog, lost })} onCancel={() => setDialog(null)} onMarkLost={markLost} />
      )}
    </Modal>
  );
}
