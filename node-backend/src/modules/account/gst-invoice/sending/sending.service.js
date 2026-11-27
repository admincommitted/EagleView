import { sendMail } from '../../../../utils/integrations/mailer.js';
import * as whatsappApi from '../../../../utils/integrations/WhatsappService.js';
import * as whatsappWeb from '../../../../utils/integrations/WhatsappWebService.js';
import { htmlToPdf } from '../gstInvoice.service.js';
import { badRequest, ensureInvoiceTables, invoiceNotFound, runSql, selectRows } from '../shared/invoiceDb.js';

const MAIL_LOG_SIZE = 30;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const pdfFileName = (invoiceNo) => String(invoiceNo).replace(/[/\\]+/g, '-') + '.pdf';

async function invoiceOrNotFound(columns, id) {
  await ensureInvoiceTables();
  const invoice = (await selectRows(`SELECT ${columns} FROM AccSalesInvoices WHERE id = ?`, [id]))[0];
  if (!invoice) throw invoiceNotFound();
  return invoice;
}

/** Keeps the last 30 mails / WhatsApp messages sent for the invoice. */
async function addToSendLog(id, entry) {
  const row = (await selectRows('SELECT mailLog FROM AccSalesInvoices WHERE id = ?', [id]))[0];
  const log = row && row.mailLog ? JSON.parse(row.mailLog) : [];
  log.push({ ...entry, at: new Date().toISOString() });
  await runSql('UPDATE AccSalesInvoices SET mailLog = ? WHERE id = ?', [JSON.stringify(log.slice(-MAIL_LOG_SIZE)), id]);
}

/** The invoice as a PDF (the same HTML as Print): the Outstanding screen opens a bill as a PDF. */
export async function invoicePdf(id, body) {
  const invoice = await invoiceOrNotFound('id, invoiceNo', id);
  const print = body || {};
  if (!print.html) throw badRequest('Invoice print is missing');
  const pdf = await htmlToPdf(print.html);
  return { pdf, fileName: String(invoice.invoiceNo).replace(/[/\\"]+/g, '-') + '.pdf' };
}

/** The party's e-mail / mobile for Mail and WhatsApp: the invoice, then its ledger, then the party master. */
export async function invoiceContact(id) {
  await ensureInvoiceTables();
  const row =
    (
      await selectRows(
        'SELECT i.email ie, l.email le, l.phone lp, l.partyId FROM AccSalesInvoices i LEFT JOIN AccountLedgers l ON l.id = i.ledgerId WHERE i.id = ?',
        [id],
      )
    )[0] || {};
  let partyEmail = '';
  let partyPhone = '';
  if (row.partyId) {
    const branch =
      (
        await selectRows(
          'SELECT email1, phone, mobile FROM PartyBranches WHERE partyId = ? ORDER BY isDefault DESC, id LIMIT 1',
          [row.partyId],
        ).catch(() => [])
      )[0] || {};
    partyEmail = branch.email1 || '';
    partyPhone = branch.mobile || branch.phone || '';
  }
  return { email: row.ie || row.le || partyEmail || '', phone: row.lp || partyPhone || '' };
}

const mailHtml = (text) =>
  text ? String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>') : undefined;

/** Mails the printed invoice (the HTML the screen sends) as a PDF attachment. */
export async function mailInvoice(id, body, userName) {
  const invoice = await invoiceOrNotFound('id, invoiceNo, partyName, total, status', id);
  const mail = body || {};
  const recipients = String(mail.to || '')
    .split(/[;,\s]+/)
    .filter(Boolean);
  if (!recipients.length || recipients.some((address) => !EMAIL.test(address)))
    throw badRequest('Give a valid e-mail address (To)');
  if (!mail.html) throw badRequest('Invoice print is missing');
  const pdf = await htmlToPdf(mail.html);
  await sendMail({
    to: recipients.join(', '),
    cc: mail.cc || undefined,
    subject: mail.subject || 'Invoice ' + invoice.invoiceNo,
    text: mail.body || '',
    html: mailHtml(mail.body),
    attachments: [{ filename: pdfFileName(invoice.invoiceNo), content: pdf, contentType: 'application/pdf' }],
  });
  await addToSendLog(invoice.id, { type: 'mail', to: recipients.join(', '), by: userName });
  return { ok: true, to: recipients.join(', ') };
}

const isWhatsappWebConnected = () => {
  const state = (whatsappWeb.getState && whatsappWeb.getState()) || {};
  const status = state.status || state.state || '';
  return /connected/i.test(status) && !/dis/i.test(status);
};

/**
 * Sends on WhatsApp Web when it is connected, else through the WhatsApp API. With the invoice print (html) the PDF goes
 * as a document and the message as its caption.
 */
async function sendOnWhatsapp(invoice, message) {
  const webConnected = isWhatsappWebConnected();
  if (message.html) {
    const pdf = await htmlToPdf(message.html);
    const fileName = pdfFileName(invoice.invoiceNo);
    if (webConnected)
      return {
        via: 'WhatsApp Web',
        out: await whatsappWeb.sendDocument(message.to, pdf, fileName, message.message),
        pdfSent: true,
      };
    return {
      via: 'WhatsApp API',
      out: await whatsappApi.sendDocument(message.to, pdf, fileName, message.message),
      pdfSent: true,
    };
  }
  if (webConnected)
    return { via: 'WhatsApp Web', out: await whatsappWeb.sendMessage(message.to, message.message), pdfSent: false };
  return { via: 'WhatsApp API', out: await whatsappApi.sendWhatsapp(message.to, message.message), pdfSent: false };
}

export async function whatsappInvoice(id, body, userName) {
  const invoice = await invoiceOrNotFound('id, invoiceNo', id);
  const message = body || {};
  if (!String(message.to || '').trim()) throw badRequest('Give the mobile number');
  if (!String(message.message || '').trim()) throw badRequest('Message is empty');
  const { via, out, pdfSent } = await sendOnWhatsapp(invoice, message);
  await addToSendLog(invoice.id, {
    type: 'whatsapp',
    to: message.to,
    via,
    pdf: pdfSent,
    by: userName,
  });
  return {
    ok: true,
    via,
    pdf: pdfSent,
    out,
  };
}
