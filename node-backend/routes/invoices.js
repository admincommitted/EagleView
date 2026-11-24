const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Voucher = require('../models/Voucher');
const VoucherDetail = require('../models/VoucherDetail');
const VoucherType = require('../models/VoucherType');
const AccountLedger = require('../models/AccountLedger');
const { sequelize } = require('../db');

// Create Invoice and Auto-Voucher
router.post('/', async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { date, jobType, jobId, partyId, items, status } = req.body;
        
        // Calculate Totals
        let subTotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0, grandTotal = 0;
        
        const processItems = items.map(i => {
            const amt = parseFloat(i.amount || 0);
            const rate = parseFloat(i.taxRate || 18);
            const cgst = amt * (rate / 2) / 100;
            const sgst = amt * (rate / 2) / 100;
            const total = amt + cgst + sgst;
            
            subTotal += amt;
            cgstTotal += cgst;
            sgstTotal += sgst;
            grandTotal += total;

            return { ...i, amount: amt, cgst, sgst, igst: 0, total };
        });

        const count = await Invoice.count() + 1;
        const invoiceNumber = `INV/26-27/${count.toString().padStart(4, '0')}`;

        const invoice = await Invoice.create({
            invoiceNumber, date, jobType, jobId, partyId,
            subTotal, cgstTotal, sgstTotal, igstTotal, grandTotal,
            status
        }, { transaction: t });

        for (let i of processItems) {
            await InvoiceItem.create({
                invoiceId: invoice.id,
                chargeLedgerId: i.chargeLedgerId,
                amount: i.amount, taxRate: i.taxRate,
                cgst: i.cgst, sgst: i.sgst, igst: i.igst, total: i.total
            }, { transaction: t });
        }

        // AUTO-VOUCHER LOGIC (Only if status is Final)
        if (status === 'Final') {
            const salesVoucherType = await VoucherType.findOne({ where: { name: 'Sales' } });
            if (!salesVoucherType) throw new Error('Sales Voucher Type not found');

            const vchCount = await Voucher.count({ where: { voucherTypeId: salesVoucherType.id } }) + 1;
            const vchNum = `SALE/26-27/${vchCount.toString().padStart(4, '0')}`;

            const voucher = await Voucher.create({
                voucherTypeId: salesVoucherType.id,
                voucherNumber: vchNum,
                date: date,
                narration: `Auto-generated for Invoice ${invoiceNumber}`,
                totalAmount: grandTotal
            }, { transaction: t });

            await VoucherDetail.create({ voucherId: voucher.id, ledgerId: partyId, dc: 'Dr', amount: grandTotal }, { transaction: t });

            for (let i of processItems) {
                await VoucherDetail.create({ voucherId: voucher.id, ledgerId: i.chargeLedgerId, dc: 'Cr', amount: i.amount }, { transaction: t });
            }

            // 05-Nov-2026 (iCAFFE rule): post only to ledgers that exist in the accounts - no ledger is created from an invoice
            const cgstLedger = await AccountLedger.findOne({ where: { name: 'Output CGST' }, transaction: t });
            const sgstLedger = await AccountLedger.findOne({ where: { name: 'Output SGST' }, transaction: t });
            if ((cgstTotal > 0 && !cgstLedger) || (sgstTotal > 0 && !sgstLedger)) throw new Error('Ledger "Output CGST" / "Output SGST" is not in the accounts - create it in Accounts > Masters > Ledger Account');

            if (cgstTotal > 0) await VoucherDetail.create({ voucherId: voucher.id, ledgerId: cgstLedger.id, dc: 'Cr', amount: cgstTotal }, { transaction: t });
            if (sgstTotal > 0) await VoucherDetail.create({ voucherId: voucher.id, ledgerId: sgstLedger.id, dc: 'Cr', amount: sgstTotal }, { transaction: t });

            await invoice.update({ autoVoucherId: voucher.id }, { transaction: t });
        }

        await t.commit();
        res.json({ success: true, data: invoice });
    } catch(err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const invoices = await Invoice.findAll({
            include: [
                { model: AccountLedger, as: 'party', attributes: ['name'] },
                { model: InvoiceItem, as: 'items', include: [{ model: AccountLedger, as: 'chargeLedger', attributes: ['name'] }] }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: invoices });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
