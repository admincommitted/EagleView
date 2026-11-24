// 08-Nov-2026: which vouchers are GST invoices (AccSalesInvoices) - so the outstanding / bill-wise screens can open the bill
// itself on the GST Invoice desk. voucherIds -> Map(voucherId -> { kind, invoiceNo, irn: true/false, fromIcaffe })
const { sequelize } = require('../db');
const { QueryTypes } = require('sequelize');

async function invoiceLinks(voucherIds) {
  const ids = [...new Set((voucherIds || []).map(Number).filter(n => Number.isInteger(n) && n > 0))];
  const out = new Map(); if (!ids.length) return out;
  try {
    const has = await sequelize.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'AccSalesInvoices'", { type: QueryTypes.SELECT });
    if (!has.length) return out;
    for (let i = 0; i < ids.length; i += 800) {
      const part = ids.slice(i, i + 800);
      const rows = await sequelize.query(`SELECT voucherId, kind, invoiceNo, irn, irnStatus, createdBy FROM AccSalesInvoices
        WHERE voucherId IN (${part.join(',')}) AND coalesce(status, '') <> 'Void'`, { type: QueryTypes.SELECT });
      for (const r of rows) out.set(Number(r.voucherId), { kind: r.kind, invoiceNo: r.invoiceNo, irn: !!(r.irn && r.irnStatus !== 'Cancelled'), fromIcaffe: r.createdBy === 'iCAFFE' });
    }
  } catch (e) { /* no links - the screens still work */ }
  return out;
}
module.exports = { invoiceLinks };
