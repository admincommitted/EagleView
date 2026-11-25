import { salesCrmApi } from '../SalesParts/salesApi';

const chargeLine = (charge) =>
  `${charge.head}  ${charge.currency} ${Number(charge.sellRate).toLocaleString('en-IN')} x ${Number(charge.qty)}${charge.basis ? ` (${charge.basis})` : ''}`;

// The client sees the sell rates only - buy rates stay internal.
export function quotationEmailText(quote) {
  const routing = quote.origin || quote.destination ? `Routing: ${quote.origin || '?'} to ${quote.destination || '?'}\n` : '';
  return `Dear ${quote.contactPerson || 'Sir / Madam'},\n\n`
    + `Our quotation ${quote.quoteNo} dated ${quote.date}:\n\n`
    + routing
    + (quote.mode ? `Mode: ${quote.mode}\n` : '')
    + (quote.commodity ? `Commodity: ${quote.commodity}\n` : '')
    + '\n'
    + (quote.charges || []).map(chargeLine).join('\n')
    + `\n\nTotal: INR ${Number(quote.totalSellInr).toLocaleString('en-IN')}`
    + (quote.validUntil ? `\nValid until ${quote.validUntil}` : '')
    + (quote.remarks ? `\n\n${quote.remarks}` : '')
    + '\n';
}

// The mail first, then the record of it, so nothing is marked sent that was not.
export async function emailQuotation(quoteId, quoteNo, to, text) {
  await salesCrmApi.sendEmail({ to, subject: `Quotation ${quoteNo}`, text });
  try {
    await salesCrmApi.markQuoteSent(quoteId, to);
  } catch {
    // the mail has gone; only the "sent" mark failed
  }
}
