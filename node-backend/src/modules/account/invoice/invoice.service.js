import { sequelize } from '../../../config/database.js';
import { AccountLedger, Invoice, InvoiceItem, Voucher, VoucherDetail, VoucherType } from '../../../models/index.js';

const DEFAULT_TAX_RATE = 18;
const NUMBER_PAD = 4;
const FINAL_STATUS = 'Final';
const OUTPUT_CGST_LEDGER = 'Output CGST';
const OUTPUT_SGST_LEDGER = 'Output SGST';

const padNumber = (count) => count.toString().padStart(NUMBER_PAD, '0');

/** CGST and SGST at half the rate each on every item; the totals of the invoice. */
function priceItems(items) {
  const totals = { subTotal: 0, cgstTotal: 0, sgstTotal: 0, igstTotal: 0, grandTotal: 0 };
  const pricedItems = items.map((item) => {
    const amount = parseFloat(item.amount || 0);
    const rate = parseFloat(item.taxRate || DEFAULT_TAX_RATE);
    const cgst = (amount * (rate / 2)) / 100;
    const sgst = (amount * (rate / 2)) / 100;
    const total = amount + cgst + sgst;
    totals.subTotal += amount;
    totals.cgstTotal += cgst;
    totals.sgstTotal += sgst;
    totals.grandTotal += total;
    return { ...item, amount, cgst, sgst, igst: 0, total };
  });
  return { pricedItems, totals };
}

async function createInvoiceRows({ date, jobType, jobId, partyId, status }, pricedItems, totals, transaction) {
  const count = (await Invoice.count()) + 1;
  const invoiceNumber = `INV/26-27/${padNumber(count)}`;
  const invoice = await Invoice.create(
    {
      invoiceNumber,
      date,
      jobType,
      jobId,
      partyId,
      ...totals,
      status,
    },
    { transaction },
  );
  for (const item of pricedItems) {
    await InvoiceItem.create(
      {
        invoiceId: invoice.id,
        chargeLedgerId: item.chargeLedgerId,
        amount: item.amount,
        taxRate: item.taxRate,
        cgst: item.cgst,
        sgst: item.sgst,
        igst: item.igst,
        total: item.total,
      },
      { transaction },
    );
  }
  return invoice;
}

// posts only to ledgers that exist in the accounts - an invoice never creates a ledger
async function outputTaxLedgers({ cgstTotal, sgstTotal }, transaction) {
  const cgstLedger = await AccountLedger.findOne({ where: { name: OUTPUT_CGST_LEDGER }, transaction });
  const sgstLedger = await AccountLedger.findOne({ where: { name: OUTPUT_SGST_LEDGER }, transaction });
  if ((cgstTotal > 0 && !cgstLedger) || (sgstTotal > 0 && !sgstLedger)) {
    throw new Error(
      'Ledger "Output CGST" / "Output SGST" is not in the accounts - create it in Accounts > Masters > Ledger Account',
    );
  }
  return { cgstLedger, sgstLedger };
}

/** A final invoice is booked at once as a Sales voucher: Dr party, Cr each charge, Cr output CGST / SGST. */
async function postSalesVoucher(invoice, { date, partyId }, pricedItems, totals, transaction) {
  const salesVoucherType = await VoucherType.findOne({ where: { name: 'Sales' } });
  if (!salesVoucherType) throw new Error('Sales Voucher Type not found');
  const voucherCount = (await Voucher.count({ where: { voucherTypeId: salesVoucherType.id } })) + 1;
  const voucher = await Voucher.create(
    {
      voucherTypeId: salesVoucherType.id,
      voucherNumber: `SALE/26-27/${padNumber(voucherCount)}`,
      date,
      narration: `Auto-generated for Invoice ${invoice.invoiceNumber}`,
      totalAmount: totals.grandTotal,
    },
    { transaction },
  );
  const addLine = (ledgerId, dc, amount) =>
    VoucherDetail.create({ voucherId: voucher.id, ledgerId, dc, amount }, { transaction });
  await addLine(partyId, 'Dr', totals.grandTotal);
  for (const item of pricedItems) await addLine(item.chargeLedgerId, 'Cr', item.amount);
  const { cgstLedger, sgstLedger } = await outputTaxLedgers(totals, transaction);
  if (totals.cgstTotal > 0) await addLine(cgstLedger.id, 'Cr', totals.cgstTotal);
  if (totals.sgstTotal > 0) await addLine(sgstLedger.id, 'Cr', totals.sgstTotal);
  await invoice.update({ autoVoucherId: voucher.id }, { transaction });
}

export async function createInvoice(body) {
  const transaction = await sequelize.transaction();
  try {
    const { pricedItems, totals } = priceItems(body.items);
    const invoice = await createInvoiceRows(body, pricedItems, totals, transaction);
    if (body.status === FINAL_STATUS) await postSalesVoucher(invoice, body, pricedItems, totals, transaction);
    await transaction.commit();
    return { success: true, data: invoice };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function listInvoices() {
  const invoices = await Invoice.findAll({
    include: [
      { model: AccountLedger, as: 'party', attributes: ['name'] },
      {
        model: InvoiceItem,
        as: 'items',
        include: [{ model: AccountLedger, as: 'chargeLedger', attributes: ['name'] }],
      },
    ],
    order: [['createdAt', 'DESC']],
  });
  return { success: true, data: invoices };
}
