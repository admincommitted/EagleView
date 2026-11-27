// The IRP JSON (one invoice, or many for the bulk upload tool); after upload the IRN, Ack No / Date and the signed
// QR are recorded here and printed on the invoice.
import { irpCall } from '../irp-api/irpApi.service.js';
import { eInvoiceJson } from '../shared/eInvoiceJson.js';
import { badRequest, ensureInvoiceTables, invoiceNotFound, runSql, selectRows, todayIso } from '../shared/invoiceDb.js';
import { VOID, fromIcaffe } from '../shared/invoiceKinds.js';
import { ourGst } from '../shared/ourCompany.js';

const IRN = /^[0-9a-f]{64}$/;
const ACK_NO = /^\d{10,20}$/;
const MAX_CANCEL_REMARK = 100;
const CANCEL_CODES = ['1', '2', '3', '4'];
const DEFAULT_CANCEL_CODE = '2';
// IRP cancel reason codes 1 - 4
const CANCEL_REASONS = ['', 'Duplicate', 'Data entry mistake', 'Order cancelled', 'Others'];

const idList = (text) =>
  String(text || '')
    .split(',')
    .map(Number)
    .filter(Boolean);

/** The e-invoice JSON of the chosen invoices; those that cannot be e-invoices are listed with the reason. */
export async function eInvoiceJsonFor(idsText) {
  await ensureInvoiceTables();
  const ids = idList(idsText);
  if (!ids.length) throw badRequest('Choose the invoices');
  const our = await ourGst();
  const json = [];
  const skipped = [];
  for (const invoice of await selectRows(
    `SELECT * FROM AccSalesInvoices WHERE id IN (${ids.join(',')}) ORDER BY date, id`,
  )) {
    if (invoice.irn && invoice.irnStatus !== 'Cancelled') {
      skipped.push(invoice.invoiceNo + ': IRN already generated');
      continue;
    }
    try {
      json.push(await eInvoiceJson(invoice, our));
    } catch (error) {
      skipped.push(error.message);
    }
  }
  return { json, skipped };
}

/** Records the IRN, Ack No / Date and signed QR given by the IRP for an invoice uploaded by hand. */
export async function recordIrn(id, body, userName) {
  await ensureInvoiceTables();
  const irnDetails = body || {};
  const invoice = (await selectRows('SELECT id, status, createdBy FROM AccSalesInvoices WHERE id = ?', [id]))[0];
  if (!invoice) throw invoiceNotFound();
  if (invoice.status === VOID) throw badRequest('The invoice is void');
  if (fromIcaffe(invoice)) throw badRequest('This bill was loaded from iCAFFE - its e-invoice (IRN) is with iCAFFE');
  const irn = String(irnDetails.irn || '')
    .trim()
    .toLowerCase();
  if (!IRN.test(irn)) throw badRequest('IRN should be the 64-character code from the IRP');
  const ackNo = String(irnDetails.ackNo || '').trim();
  if (!ACK_NO.test(ackNo)) throw badRequest('Ack No should be the number from the IRP');
  await runSql(
    "UPDATE AccSalesInvoices SET irn = ?, ackNo = ?, ackDate = ?, signedQr = ?, irnStatus = 'Generated', irnCancelReason = NULL, modifiedBy = ?, updatedAt = ? WHERE id = ?",
    [
      irn,
      ackNo,
      irnDetails.ackDate || todayIso(),
      String(irnDetails.signedQr || '').trim() || null,
      userName || null,
      new Date().toISOString(),
      invoice.id,
    ],
  );
  return { ok: true };
}

async function cancelOnIrp(irn, code, reason) {
  const result = await irpCall('/eicore/v1.03/Invoice/Cancel', {
    body: { Irn: irn, CnlRsn: code, CnlRem: reason.slice(0, MAX_CANCEL_REMARK) },
  });
  if (!result.ok) throw badRequest('IRP did not cancel it: ' + result.error);
  return 'IRN cancelled on the IRP' + (result.data && result.data.CancelDate ? ' at ' + result.data.CancelDate : '');
}

/** Marks the IRN cancelled (and, with viaApi, cancels it on the IRP - allowed within 24 hours of generation). */
export async function cancelIrn(id, body, userName) {
  await ensureInvoiceTables();
  const request = body || {};
  const reason = String(request.reason || '').trim();
  if (!reason) throw badRequest('Give the reason');
  const invoice = (
    await selectRows('SELECT id, irn, ackDate, irnStatus, createdBy FROM AccSalesInvoices WHERE id = ?', [id])
  )[0];
  if (!invoice || !invoice.irn) throw badRequest('No IRN on this invoice');
  if (fromIcaffe(invoice))
    throw badRequest('This bill was loaded from iCAFFE - cancel its IRN in iCAFFE / on the IRP portal');
  if (invoice.irnStatus === 'Cancelled') throw badRequest('The IRN is already cancelled');
  const code = CANCEL_CODES.includes(String(request.code)) ? String(request.code) : DEFAULT_CANCEL_CODE;
  let note = 'Marked cancelled here - cancel it on the IRP too (allowed within 24 hours of generation)';
  if (request.viaApi) note = await cancelOnIrp(invoice.irn, code, reason);
  await runSql(
    "UPDATE AccSalesInvoices SET irnStatus = 'Cancelled', irnCancelReason = ?, modifiedBy = ?, updatedAt = ? WHERE id = ?",
    [CANCEL_REASONS[Number(code)] + ' - ' + reason, userName || null, new Date().toISOString(), invoice.id],
  );
  return { ok: true, note };
}
