const express = require('express');
const router = express.Router();
const AccountGroup = require('../models/AccountGroup');
const AccountLedger = require('../models/AccountLedger');
const { Op } = require('sequelize');

// Seed default Tally Groups (15 Primary, 13 Subgroups)
router.post('/seed', async (req, res) => {
    try {
        const count = await AccountGroup.count();
        if (count > 0) return res.json({ message: 'Groups already seeded.' });

        const groups = [
            // PRIMARY ASSETS
            { name: 'Fixed Assets', nature: 'Assets', isBuiltIn: true },
            { name: 'Investments', nature: 'Assets', isBuiltIn: true },
            { name: 'Current Assets', nature: 'Assets', isBuiltIn: true },
            { name: 'Miscellaneous Expenses (AS)', nature: 'Assets', isBuiltIn: true },
            // PRIMARY LIABILITIES
            { name: 'Capital Account', nature: 'Liabilities', isBuiltIn: true },
            { name: 'Loans (Liability)', nature: 'Liabilities', isBuiltIn: true },
            { name: 'Current Liabilities', nature: 'Liabilities', isBuiltIn: true },
            { name: 'Suspense A/c', nature: 'Liabilities', isBuiltIn: true },
            { name: 'Branch / Divisions', nature: 'Liabilities', isBuiltIn: true },
            // PRIMARY INCOME
            { name: 'Sales Accounts', nature: 'Income', isBuiltIn: true },
            { name: 'Direct Incomes', nature: 'Income', isBuiltIn: true },
            { name: 'Indirect Incomes', nature: 'Income', isBuiltIn: true },
            // PRIMARY EXPENSES
            { name: 'Purchase Accounts', nature: 'Expenses', isBuiltIn: true },
            { name: 'Direct Expenses', nature: 'Expenses', isBuiltIn: true },
            { name: 'Indirect Expenses', nature: 'Expenses', isBuiltIn: true }
        ];

        await AccountGroup.bulkCreate(groups);

        const currentAssets = await AccountGroup.findOne({ where: { name: 'Current Assets' } });
        const currentLiabilities = await AccountGroup.findOne({ where: { name: 'Current Liabilities' } });
        const capitalAccount = await AccountGroup.findOne({ where: { name: 'Capital Account' } });
        const loansLiability = await AccountGroup.findOne({ where: { name: 'Loans (Liability)' } });

        const subGroups = [];
        if (currentAssets) {
            subGroups.push(
                { name: 'Stock-in-Hand', parentId: currentAssets.id, nature: 'Assets', isBuiltIn: true },
                { name: 'Deposits (Asset)', parentId: currentAssets.id, nature: 'Assets', isBuiltIn: true },
                { name: 'Loans & Advances (Asset)', parentId: currentAssets.id, nature: 'Assets', isBuiltIn: true },
                { name: 'Sundry Debtors', parentId: currentAssets.id, nature: 'Assets', isBuiltIn: true },
                { name: 'Cash-in-Hand', parentId: currentAssets.id, nature: 'Assets', isBuiltIn: true },
                { name: 'Bank Accounts', parentId: currentAssets.id, nature: 'Assets', isBuiltIn: true }
            );
        }
        if (currentLiabilities) {
            subGroups.push(
                { name: 'Duties & Taxes', parentId: currentLiabilities.id, nature: 'Liabilities', isBuiltIn: true },
                { name: 'Provisions', parentId: currentLiabilities.id, nature: 'Liabilities', isBuiltIn: true },
                { name: 'Sundry Creditors', parentId: currentLiabilities.id, nature: 'Liabilities', isBuiltIn: true }
            );
        }
        if (capitalAccount) {
            subGroups.push({ name: 'Reserves & Surplus', parentId: capitalAccount.id, nature: 'Liabilities', isBuiltIn: true });
        }
        if (loansLiability) {
            subGroups.push(
                { name: 'Bank OD A/c', parentId: loansLiability.id, nature: 'Liabilities', isBuiltIn: true },
                { name: 'Secured Loans', parentId: loansLiability.id, nature: 'Liabilities', isBuiltIn: true },
                { name: 'Unsecured Loans', parentId: loansLiability.id, nature: 'Liabilities', isBuiltIn: true }
            );
        }

        await AccountGroup.bulkCreate(subGroups);
        res.json({ message: 'Tally Standard Groups seeded successfully!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET complete Tree of Groups and Ledgers
router.get('/tree', async (req, res) => {
    try {
        const groups = await AccountGroup.findAll();
        const ledgers = await AccountLedger.findAll();
        
        // Fetch sums from VoucherDetails to calculate live balances
        const { sequelize } = require('../db');
        const VoucherDetail = require('../models/VoucherDetail');
        
        const sums = await VoucherDetail.findAll({
            attributes: [
                'ledgerId',
                'dc',
                [sequelize.fn('SUM', sequelize.col('amount')), 'total']
            ],
            group: ['ledgerId', 'dc'],
            raw: true
        });

        const sumsMap = {};
        sums.forEach(s => {
            if (!sumsMap[s.ledgerId]) sumsMap[s.ledgerId] = { dr: 0, cr: 0 };
            if (s.dc === 'Dr') sumsMap[s.ledgerId].dr += parseFloat(s.total || 0);
            if (s.dc === 'Cr') sumsMap[s.ledgerId].cr += parseFloat(s.total || 0);
        });

        // Attach currentBalance to ledgers
        ledgers.forEach(l => {
            let op = parseFloat(l.openingBalance || 0);
            let drTotal = l.balanceType === 'Dr' ? op : 0;
            let crTotal = l.balanceType === 'Cr' ? op : 0;

            if (sumsMap[l.id]) {
                drTotal += sumsMap[l.id].dr;
                crTotal += sumsMap[l.id].cr;
            }

            let net = drTotal - crTotal;
            l.dataValues.currentBalance = Math.abs(net);
            l.dataValues.currentBalanceType = net >= 0 ? 'Dr' : 'Cr';
        });
        
        // Build Tree structure recursively
        const buildTree = (parentId = null) => {
            const currentLevelGroups = groups.filter(g => g.parentId === parentId).map(g => {
                return {
                    ...g.dataValues,
                    type: 'group',
                    children: [
                        ...buildTree(g.id),
                        ...ledgers.filter(l => l.groupId === g.id).map(l => ({ ...l.dataValues, type: 'ledger' }))
                    ]
                };
            });
            return currentLevelGroups;
        };

        const tree = buildTree(null);
        res.json({ success: true, data: tree });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Group
router.post('/groups', async (req, res) => {
    try {
        const group = await AccountGroup.create(req.body);
        res.json({ success: true, data: group });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Create Ledger
router.post('/ledgers', async (req, res) => {
    try {
        const ledger = await AccountLedger.create(req.body);
        res.json({ success: true, data: ledger });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;


// Update Group
router.put('/groups/:id', async (req, res) => {
    try {
        await AccountGroup.update(req.body, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch(err) { res.status(400).json({ error: err.message }); }
});

// Delete Group
router.delete('/groups/:id', async (req, res) => {
    try {
        await AccountGroup.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch(err) { res.status(400).json({ error: err.message }); }
});

// Update Ledger
router.put('/ledgers/:id', async (req, res) => {
    try {
        await AccountLedger.update(req.body, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch(err) { res.status(400).json({ error: err.message }); }
});

// Delete Ledger
router.delete('/ledgers/:id', async (req, res) => {
    try {
        await AccountLedger.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch(err) { res.status(400).json({ error: err.message }); }
});
