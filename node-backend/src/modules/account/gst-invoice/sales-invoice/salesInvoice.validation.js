import { z } from 'zod';
import { toNumber } from '../shared/invoiceDb.js';
import { KINDS } from '../shared/invoiceKinds.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const GSTIN = /^[0-9]{2}[A-Z0-9]{13}$/i;

const hasCharge = (line) => String(line.charge || '').trim();
const docketKey = (value) =>
  String(value || '')
    .toUpperCase()
    .trim();

function bulkInvoiceProblem(invoice) {
  const dockets = (Array.isArray(invoice.dockets) ? invoice.dockets : [])
    .map((docket) => docketKey(docket))
    .filter(Boolean);
  if (dockets.length < 1) return 'Bulk invoice: choose the dockets';
  const lineWithoutDocket = invoice.lines.find((line) => hasCharge(line) && !dockets.includes(docketKey(line.jobNo)));
  if (lineWithoutDocket)
    return 'Bulk invoice: every charge needs one of the chosen dockets (' + lineWithoutDocket.charge + ')';
  return null;
}

/** The first problem of an invoice the screen sent, in the order iCAFFE asks for them. */
function firstInvoiceProblem(invoice) {
  const kind = KINDS[invoice.kind];
  if (!kind) return 'Unknown invoice type';
  if (!invoice.date || !ISO_DATE.test(invoice.date)) return 'Date is required';
  if (!String(invoice.partyName || '').trim() && !invoice.ledgerId) return 'Party is required';
  if (!invoice.partyType) return 'Party Type is required';
  if (kind.gst && !invoice.pos) return 'Place of Supply is required';
  if (kind.againstBill && !invoice.withOut && !String(invoice.prevInvoiceNo || '').trim()) {
    return 'Previous Invoice No is required (or tick WithOut)';
  }
  if (kind.againstBill && !invoice.reason) return 'Reason To Issue is required';
  if (invoice.gstin && !GSTIN.test(String(invoice.gstin).trim()))
    return 'GST No should be 15 characters, starting with the state code';
  if (!(Array.isArray(invoice.lines) && invoice.lines.some(hasCharge))) return 'Add at least one charge';
  if (toNumber(invoice.bulk)) {
    const problem = bulkInvoiceProblem(invoice);
    if (problem) return problem;
  }
  const lineWithoutRate = invoice.lines.find(
    (line) => hasCharge(line) && !(toNumber(line.rate) * (toNumber(line.qty) || 1)),
  );
  if (lineWithoutRate) return 'Rate is missing for ' + lineWithoutRate.charge;
  return null;
}

/** A GST invoice body (create / modify). Its many other fields are read by the service. */
export const salesInvoiceSchema = z.any().superRefine((invoice, context) => {
  const problem = firstInvoiceProblem(invoice);
  if (problem) context.addIssue({ code: 'custom', message: problem });
});
