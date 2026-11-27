// Which vouchers are GST invoices (AccSalesInvoices), so the outstanding / bill-wise screens can open the bill itself on
// the GST Invoice desk. voucherIds -> Map(voucherId -> { kind, invoiceNo, irn: true/false, fromIcaffe })
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

// keeps each IN (...) list well under SQLite's bound-variable limit
const IDS_PER_QUERY = 800;

async function salesInvoiceTableExists() {
  const tables = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'AccSalesInvoices'",
    { type: QueryTypes.SELECT },
  );
  return tables.length > 0;
}

const linkOf = (invoice) => ({
  kind: invoice.kind,
  invoiceNo: invoice.invoiceNo,
  irn: !!(invoice.irn && invoice.irnStatus !== 'Cancelled'),
  fromIcaffe: invoice.createdBy === 'iCAFFE',
});

async function invoiceLinks(voucherIds) {
  const ids = [...new Set((voucherIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  const links = new Map();
  if (!ids.length) return links;
  try {
    if (!(await salesInvoiceTableExists())) return links;
    for (let start = 0; start < ids.length; start += IDS_PER_QUERY) {
      const chunk = ids.slice(start, start + IDS_PER_QUERY);
      const invoices = await sequelize.query(
        `SELECT voucherId, kind, invoiceNo, irn, irnStatus, createdBy FROM AccSalesInvoices
        WHERE voucherId IN (${chunk.join(',')}) AND coalesce(status, '') <> 'Void'`,
        { type: QueryTypes.SELECT },
      );
      for (const invoice of invoices) links.set(Number(invoice.voucherId), linkOf(invoice));
    }
  } catch {
    /* no links - the screens still work */
  }
  return links;
}

export { invoiceLinks };
