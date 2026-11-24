const express = require('express');
const router = express.Router();
const { sequelize } = require('../db');
const ExportJob = require('../models/ExportJob');
const ExportInvoice = require('../models/ExportInvoice');
const ExportItem = require('../models/ExportItem');
const ExportContainer = require('../models/ExportContainer');
const ExportDocument = require('../models/ExportDocument');
const ExportDrawback = require('../models/ExportDrawback');
const ExportLicense = require('../models/ExportLicense');
const { packExtra } = require('../utils/extraFields');
const { ensureFieldColumns } = require('../utils/dynamicColumns');
// PackingDetails / Containers are text columns holding JSON; the header screen expects arrays
const reviveJsonCols = (o) => { for (const k of ['PackingDetails', 'Containers', 'eSanchitList', '_statements', '_infoTypes', '_exchangeRates', 'etpDetails']) if (o && typeof o[k] === 'string' && /^\s*[\[{]/.test(o[k])) { try { o[k] = JSON.parse(o[k]); } catch (e) {} } return o; };
// 12-Nov-2026: lists of an item kept in their own columns came back as JSON text ('[]', '[{...}]'). The Items screen
// treats them as lists: opening an item crashed the whole app (swInfos), so did the Supporting Docs window and
// Duplicate Item (eSanchitList); the RoDTEP claim switch dropped the other SW info rows. They are lists again here.
const ITEM_LISTS = ['swInfos', 'swStatements', 'reExports', 'eSanchitList', 'supportDocs', 'cessRows', 'constRows', 'prodRows', 'ctrlRows'];
const reviveItemLists = (it) => { for (const k of ITEM_LISTS) { const v = it && it[k]; if (typeof v === 'string') { const s = v.trim(); if (!s || s === 'null') it[k] = []; else if (/^\[/.test(s)) { try { const a = JSON.parse(s); it[k] = Array.isArray(a) ? a : []; } catch (e) { it[k] = []; } } } } return it; };
// 18-Nov-2026 (export save check): three things came back from the database different from what the screen saved.
// 1. An object kept in a text column of the item (tempSwStmt - the SW statement row being typed) came back as JSON text:
//    the next statement added on a reopened item took the text apart letter by letter. Read back as an object again
//    (only an object, or a list of objects - what the save itself writes - so typed text stays text).
// 2. Yes / no ticks came back as '0' / '1': "Add in template" showed ticked on every saved item, the drawback flags
//    (value typed by hand, qty follows the item) as text. Read back as true / false.
// 3. ExportInvoices.invoiceDate is a DATETIME column holding 'YYYY-MM-DD' text: Sequelize made an Invalid Date of it
//    (sent as null) - the job list Inv Date was always blank and the screen got no invoiceDate. Read as stored.
const isStoredObject = (x) => { const plain = (o) => o !== null && typeof o === 'object' && !Array.isArray(o); return Array.isArray(x) ? x.length > 0 && x.every(plain) : plain(x); };
const reviveObjects = (o) => {
    for (const [k, v] of Object.entries(o || {})) {
        if (typeof v !== 'string' || k === 'additionalData') continue;
        const s = v.trim(); if (!((s[0] === '{' && s.endsWith('}')) || (s.startsWith('[{') && s.endsWith('}]')))) continue;
        try { const x = JSON.parse(s); if (isStoredObject(x)) o[k] = x; } catch (e) { /* plain text */ }
    }
    return o;
};
const BOOL_KEYS = { item: ['addInTemplate'], dbk: ['valManual', 'dbkQtyAuto'] };
const reviveBools = (o, keys) => { for (const k of keys) { const v = o && o[k]; if (v === undefined || v === null || v === '' || typeof v === 'boolean') continue; o[k] = v === 1 || /^(1|true|y|yes)$/i.test(String(v).trim()); } return o; };
async function rawInvoiceDates(jobIds) {
    const ids = [...new Set((jobIds || []).filter((x) => x !== null && x !== undefined).map(Number).filter((n) => Number.isFinite(n)))];
    const m = new Map(); if (!ids.length) return m;
    try {
        for (let i = 0; i < ids.length; i += 900) {
            const part = ids.slice(i, i + 900);
            const rows = await sequelize.query(`SELECT id, invoiceDate FROM ExportInvoices WHERE exportJobId IN (${part.map(() => '?').join(',')})`, { replacements: part, type: sequelize.QueryTypes.SELECT });
            for (const r of rows) m.set(String(r.id), r.invoiceDate === null || r.invoiceDate === undefined ? null : String(r.invoiceDate));
        }
    } catch (e) { /* no invoiceDate column: nothing to put back */ }
    return m;
}
const fixInvoiceDate = (inv, dates) => {
    if (!inv) return inv;
    if (dates && dates.has(String(inv.id))) inv.invoiceDate = dates.get(String(inv.id));
    else if (inv.invoiceDate instanceof Date && isNaN(inv.invoiceDate.getTime())) inv.invoiceDate = inv.date || null;
    return inv;
};
// the job as the screen reads it: invoice dates as stored, objects / ticks as saved (save response, GET /:id)
async function reviveJob(jobData) {
    const dates = await rawInvoiceDates([jobData.id]);
    (jobData.invoices || []).forEach((inv) => { fixInvoiceDate(inv, dates); reviveObjects(inv); (inv.items || []).forEach((it) => { reviveObjects(it); reviveBools(it, BOOL_KEYS.item); }); });
    (jobData.dbkItems || []).forEach((r) => reviveBools(r, BOOL_KEYS.dbk));
    return jobData;
}
const JobSequence = require('../models/JobSequence');
const CompanyBranch = require('../models/CompanyBranch');

// Older jobs kept extra UI fields as JSON in additionalData. Read it safely (fix 28-Oct-2026: the lines that parsed it had been removed).
const parseExtra = (v) => { if (!v) return {}; if (typeof v === 'object') return v; try { const o = JSON.parse(v); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };


// GET /api/export-jobs/next-sequence
router.get('/next-sequence', async (req, res) => {
    try {
        // the AIR / SEA EXPORT prefix of Settings > Sequence Config (before: NDL/AE/26/ fixed in code). 28-Oct-2026
        const p = await require('../utils/jobSequence').peek({ branchId: req.query.branchId, shipmentMode: req.query.shipmentMode || 'AIR', side: 'EXPORT', financialYearId: req.query.financialYearId || null });
        res.json({ success: true, nextJobNo: p.nextJobNo });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});
router.post('/', async (req, res) => {
    // 10-Nov-2026: impossible values are refused before anything is written (as the Import job), and a NEW job that
    // repeats the invoice (same IEC) / HAWB of another job - most often a duplicated job - is saved only after the
    // operator says so (_dupOk). _dupOk is removed here: every key of the body becomes a column below.
    {
        const b = req.body || {}; const dupOk = b._dupOk === true || b._dupOk === 'true'; delete b._dupOk;
        const check = require('../utils/exportJobValidate').validateExportSave(b);
        if (check.errors.length) return res.status(400).json({ success: false, error: `Not saved - ${check.errors.length} problem(s): ` + check.errors.slice(0, 3).join(' | ') + (check.errors.length > 3 ? ` | +${check.errors.length - 3} more` : ''), problems: check.errors });
        if (!b.id && !dupOk) {
            try {
                const D = require('../utils/jobDuplicates'); const m = await D.check('EXPORT', b);
                if (m.length) return res.status(409).json({ success: false, duplicate: true, matches: m, error: D.message(m) });
            } catch (e) { console.warn('[export-jobs] duplicate check:', e.message); }
        }
    }
    // every form field gets its own column (created before the transaction: SQLite cannot alter a table inside one)
    try {
        const p = req.body || {};
        const invs = Array.isArray(p.invoices) ? p.invoices : [];
        await ensureFieldColumns(ExportJob, p);
        await ensureFieldColumns(ExportInvoice, invs);
        await ensureFieldColumns(ExportItem, invs.flatMap(i => Array.isArray(i.items) ? i.items : []));
        await ensureFieldColumns(ExportContainer, Array.isArray(p.containers) ? p.containers : []);
        await ensureFieldColumns(ExportDocument, Array.isArray(p.docs) ? p.docs : []);
        await ensureFieldColumns(ExportDrawback, Array.isArray(p.dbkItems) ? p.dbkItems : []);
        await ensureFieldColumns(ExportLicense, Array.isArray(p.licenseItems) ? p.licenseItems : []);
    } catch (e) { console.warn('[export-jobs] column check:', e.message); }
    const t = await sequelize.transaction();
    try {
        const payload = req.body;
        let job = null;
        // who made the job (job list "Entered By"); kept in additionalData. 29-Oct-2026
        if (!payload.id && !payload.enteredBy && req.user) payload.enteredBy = req.user.username || req.user.name || '';

        // Auto-Generate Job No if DRAFT and missing
        if (!payload.jobNo || payload.jobNo === 'DRAFT') {
            payload.jobNo = await require('../utils/jobSequence').take({ branchCode: payload.branchCode, branchId: payload.branchId, shipmentMode: payload.shipmentMode, side: 'EXPORT', financialYearId: payload.financialYearId }, t);
        }
        // 14-Nov-2026: e-Sanchit PDFs attached / signed before the job had a number (uploads/esanchit_archive/draft ...) go to the job's folder
        try { require('../utils/esanchitArchive').relinkJob(payload, payload.jobNo, { jobLists: ['eSanchitList'], itemLists: ['eSanchitList'] }); } catch (e) { console.warn('[export-jobs] e-Sanchit PDFs:', e.message); }
        try { require('../utils/esanchitArchive').mergeAdded(payload, 'eSanchitList', 'save'); } catch (e) { /* archive not readable */ } // documents added from EagleView Signer (17-Nov-2026)
        try { require('../utils/esanchitArchive').applySigned(payload, { jobLists: ['eSanchitList'], itemLists: ['eSanchitList'] }); } catch (e) { /* archive not readable */ }

        

        // keep every form field: non-column fields go into additionalData (JSON)
        const existingJob = payload.id ? await ExportJob.findByPk(payload.id, { transaction: t }) : null;
        // the screen may hold an old status / LEO date (a status set from the Timeline or ICEGATE while the job was open):
        // a save never moves the job back to an earlier stage. 29-Oct-2026
        if (existingJob) {
            const { rank } = require('../utils/exportStage');
            if (existingJob.status && rank(existingJob.status) > rank(payload.status)) payload.status = existingJob.status;
            if (existingJob.leoDate && !payload.leoDate) payload.leoDate = existingJob.leoDate;
            // filing details written by ICEGATE / SB Track are never cleared by a save from an older screen
            for (const k of ['icegateStatus', 'icegateUniqueId', 'sbNo', 'sbDate']) if (existingJob[k] && !payload[k]) payload[k] = existingJob[k];
        }
        // 12-Nov-2026: job date. The screen keeps it in the ETP details and starts a new job / a job read from a file
        // with it blank; a blank date went into the DATE column as the text "Invalid date" (date filters, FY and
        // reports lost the job). Blank / unreadable: the saved date of the job, else the day it was made, else today (IST).
        {
            const okDate = (v) => { if (v === null || v === undefined || v === '') return null; const d = v instanceof Date ? v : new Date(String(v).trim()); return isNaN(d.getTime()) ? null : v; };
            const ist = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            if (!okDate(payload.jobDate)) payload.jobDate = (existingJob && okDate(existingJob.jobDate)) ? ist(existingJob.jobDate) : ist((existingJob && okDate(existingJob.createdAt)) ? existingJob.createdAt : Date.now());
        }
        const jobRow = packExtra(ExportJob, payload, 'additionalData', existingJob && existingJob.additionalData);
        if (existingJob) {
            job = existingJob;
            await job.update(jobRow, { transaction: t });
        } else {
            delete jobRow.id;
            job = await ExportJob.create(jobRow, { transaction: t });
        }

        // Handle Invoices and Items
        if (payload.invoices && Array.isArray(payload.invoices)) {
            // Delete items first to avoid SQLite foreign key constraint errors
            const existingInvoices = await ExportInvoice.findAll({ where: { exportJobId: job.id }, transaction: t });
            const existingInvoiceIds = existingInvoices.map(inv => inv.id);
            if (existingInvoiceIds.length > 0) {
                await ExportItem.destroy({ where: { exportInvoiceId: existingInvoiceIds }, transaction: t });
            }
            await ExportInvoice.destroy({ where: { exportJobId: job.id }, transaction: t });
            
            const invStandardKeys = ['id', 'exportJobId', 'invoiceNo', 'invoiceDate', 'currency', 'exchangeRate', 'invoiceValue', 'incoterm', 'freightAmount', 'insuranceAmount', 'discountAmount', 'items'];
            const itemStandardKeys = ['id', 'exportInvoiceId', 'itemNo', 'productDescription', 'hsCode', 'quantity', 'uqc', 'unitPrice', 'fobValue', 'drawbackSrNo'];

            for (let inv of payload.invoices) {
                inv.exportJobId = job.id; delete inv.id; // re-created on every save: new id from the DB
                
                // ── FIX: Normalize frontend short field names → DB column names
                // Frontend formData uses: no, date, value, exchRate
                // ExportInvoice model uses: invoiceNo, invoiceDate, invoiceValue, exchangeRate
                // 18-Nov-2026: the screen value always wins (the copy was filled only once, so an invoice no / date / value
                // changed later stayed old in the copy - the job list showed it, the SB builder read some of them)
                if (inv.no)           inv.invoiceNo    = inv.no;
                if (inv.date)         inv.invoiceDate  = inv.date;
                if (inv.value)        inv.invoiceValue = inv.value;
                if (inv.exchRate)     inv.exchangeRate = inv.exchRate;
                // Buyer name: frontend uses 'buyer', keep both for compatibility
                if (inv.buyer)        inv.buyerName    = inv.buyer;
                // Nature of contract: frontend uses 'contractType'
                if (inv.contractType) inv.natureOfContract = inv.contractType;
                // a file's names for other deductions / third-party subdivision follow the Invoices tab boxes
                if (inv.otherDeductionsRate != null || inv.otherDeductionsAmount != null) { inv.otherDeductionsRate = inv.otherRate ?? ''; inv.otherDeductionsCurr = inv.otherCurr ?? ''; inv.otherDeductionsAmount = inv.otherAmount ?? ''; }
                if (inv.tpState != null) inv.tpState = inv.tpCntryDiv ?? '';
                
                

                const newInv = await ExportInvoice.create(packExtra(ExportInvoice, inv, 'additionalData'), { transaction: t });
                
                if (inv.items && Array.isArray(inv.items)) {
                    for (let item of inv.items) {
                        item.exportInvoiceId = newInv.id; delete item.id; // re-created on every save: new id from the DB
                        
                        // ── FIX: Normalize ALL frontend field names → DB column names
                        // Frontend uses: desc, ritc, qty, rate, totalFc/itemFob, itemSr
                        // ExportItem model uses: productDescription, hsCode, quantity, unitPrice, fobValue, itemNo
                        // 18-Nov-2026: the Items tab value always wins. These copies were filled only at the first save, so a
                        // description / qty / RITC / rate changed later stayed old in them - and the SB builder read
                        // productDescription / quantity first: the SB went with the old description and qty. The checklist-only
                        // description (chkDesc) is never used for it.
                        item.productDescription = item.desc || item.description || item.productDescription || '';
                        item.hsCode = item.ritc || item.hsnCode || item.hsn_code || item.hsCode || '';
                        item.quantity = item.qty || item.quantity || 0;
                        item.unitPrice = item.rate || item.price || item.unitPrice || 0;
                        if (!item.fobValue) item.fobValue = item.itemFob || item.totalFc || item.total || item.fobValueInr || 0; // as before: rows mix FC / INR
                        item.uqc = item.unit || item.uqc || '';
                        item.itemNo = item.itemSr || item.itemNo || 1;
                        // names a file left on the item (sbFileReader) follow the screen too
                        if (item.description != null && item.desc) item.description = item.desc;
                        if (item.hsnCode != null && item.ritc) item.hsnCode = item.ritc;
                        if (item.schemeCode != null && item.scheme) item.schemeCode = String(item.scheme).trim().split(/[\s-]/)[0];
                        if (item.rewardItem != null && (item.rodtep || item.reward)) item.rewardItem = /^Y/i.test(String(item.rodtep || '')) || /^Y/i.test(String(item.reward || '')) ? 'Y' : 'N';
                        
                        // ── e-Sanchit documents of the item: only the file itself is left out. 12-Nov-2026: every other
                        // field was dropped too (issuing party and address, place, issue / expiry date, beneficiary,
                        // ICEGATE ID), so the Shipping Bill of a reopened job went with a blank issuing party.
                        reviveItemLists(item);
                        if (Array.isArray(item.eSanchitList)) {
                            item.eSanchitList = item.eSanchitList.filter(doc => doc && typeof doc === 'object').map(doc => {
                                const { file, fileData, base64, ...rest } = doc;
                                return { ...rest, fileName: doc.fileName || doc.signedName || (file && file.name) || '' };
                            });
                        }
                        
                        

                        await ExportItem.create(packExtra(ExportItem, item, 'additionalData'), { transaction: t });
                    }
                }
            }
        }

        // Handle Containers (For Sea)
        if (payload.containers && Array.isArray(payload.containers)) {
            await ExportContainer.destroy({ where: { exportJobId: job.id }, transaction: t });
            for (let cont of payload.containers) {
                cont.exportJobId = job.id; delete cont.id; // re-created on every save: new id from the DB
                await ExportContainer.create(packExtra(ExportContainer, cont, 'additionalData'), { transaction: t });
            }
        }

        // Handle Documents
        if (payload.docs && Array.isArray(payload.docs)) {
            await ExportDocument.destroy({ where: { exportJobId: job.id }, transaction: t });
            for (let doc of payload.docs) {
                doc.exportJobId = job.id; delete doc.id; // re-created on every save: new id from the DB
                // ── Normalize frontend field names → DB column names
                if (!doc.issuingPartyName)    doc.issuingPartyName    = doc.issuerName    || doc.issuerCode || '';
                if (!doc.issuingPartyAddress) doc.issuingPartyAddress = [doc.issuerAddr1, doc.issuerAddr2, doc.issuerCity, doc.issuerPin].filter(Boolean).join(', ');
                if (!doc.beneficiaryPartyName)    doc.beneficiaryPartyName    = doc.beneName    || doc.beneCode || '';
                if (!doc.beneficiaryPartyAddress) doc.beneficiaryPartyAddress = [doc.beneAddr1, doc.beneAddr2, doc.beneCity, doc.benePin].filter(Boolean).join(', ');
                if (!doc.icegateStatus) doc.icegateStatus = doc.irn ? 'UPLOADED' : 'PENDING';
                
                await ExportDocument.create(doc, { transaction: t });
            }
        }

        // Handle Dbk Items
        if (payload.dbkItems && Array.isArray(payload.dbkItems)) {
            await ExportDrawback.destroy({ where: { exportJobId: job.id }, transaction: t });
            for (let dbk of payload.dbkItems) {
                dbk.exportJobId = job.id; delete dbk.id; // re-created on every save: new id from the DB
                await ExportDrawback.create(dbk, { transaction: t });
            }
        }

        // Handle License Items
        if (payload.licenseItems && Array.isArray(payload.licenseItems)) {
            await ExportLicense.destroy({ where: { exportJobId: job.id }, transaction: t });
            for (let lic of payload.licenseItems) {
                lic.exportJobId = job.id; delete lic.id; // re-created on every save: new id from the DB
                await ExportLicense.create(lic, { transaction: t });
            }
        }

        await t.commit();
        
        // Fetch back full job
        const fullJob = await ExportJob.findByPk(job.id, {
            include: [
                { model: ExportInvoice, as: 'invoices', include: [{ model: ExportItem, as: 'items' }] },
                { model: ExportContainer, as: 'containers' },
                { model: ExportDocument, as: 'docs' },
                { model: ExportDrawback, as: 'dbkItems' },
                { model: ExportLicense, as: 'licenseItems' }
            ]
        });
        
        let jobData = fullJob.toJSON(); reviveJsonCols(jobData);
        if (jobData.additionalData) {
            
            jobData = { ...jobData, ...parseExtra(jobData.additionalData) }; reviveJsonCols(jobData);
            
        }

        if (jobData.invoices) {
            jobData.invoices = jobData.invoices.map(inv => {
                if (inv.additionalData) {
                    
                    inv = { ...inv, ...parseExtra(inv.additionalData) };
                    
                }
                if (inv.items) {
                    inv.items = inv.items.map(item => {
                        if (item.additionalData) {
                            
                            item = { ...item, ...parseExtra(item.additionalData) };
                            
                        }
                        // ── Restore frontend-compatible aliases so ExportItemTab loads correctly
                        if (!item.desc && item.productDescription) item.desc = item.productDescription;
                        if (!item.ritc && item.hsCode) item.ritc = item.hsCode;
                        if (!item.qty && item.quantity) item.qty = String(item.quantity);
                        if (!item.rate && item.unitPrice) item.rate = String(item.unitPrice);
                        if (!item.unit && item.uqc) item.unit = item.uqc;
                        if (!item.itemFob && item.fobValue) item.itemFob = String(item.fobValue);
                        reviveItemLists(item);
                        return item;
                    });
                }
                return inv;
            });
        }
        await reviveJob(jobData);

        res.json({ success: true, data: jobData });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
});

// A saved job as the screen loads it (form fields of additionalData merged in). Used by GET /:id and by
// /api/icegate/amend-sb (it loaded items from a link the job does not have, so it always failed). 29-Oct-2026
async function loadExportJob(id) {
    {
        const job = await ExportJob.findByPk(id, {
            include: [
                { model: ExportInvoice, as: 'invoices', include: [{ model: ExportItem, as: 'items' }] },
                { model: ExportContainer, as: 'containers' },
                { model: ExportDocument, as: 'docs' },
                { model: ExportDrawback, as: 'dbkItems' },
                { model: ExportLicense, as: 'licenseItems' }
            ]
        });
        if (!job) return null;
        
        let jobData = job.toJSON(); reviveJsonCols(jobData);
        if (jobData.additionalData) {
            
            jobData = { ...jobData, ...parseExtra(jobData.additionalData) }; reviveJsonCols(jobData);
            
        }

        if (jobData.invoices) {
            jobData.invoices = jobData.invoices.map(inv => {
                if (inv.additionalData) {
                    
                    inv = { ...inv, ...parseExtra(inv.additionalData) };
                    
                }
                if (inv.items) {
                    inv.items = inv.items.map(item => {
                        if (item.additionalData) {
                            
                            item = { ...item, ...parseExtra(item.additionalData) };
                            
                        }
                        // ── Restore frontend-compatible aliases so ExportItemTab loads correctly
                        if (!item.desc && item.productDescription) item.desc = item.productDescription;
                        if (!item.ritc && item.hsCode) item.ritc = item.hsCode;
                        if (!item.qty && item.quantity) item.qty = String(item.quantity);
                        if (!item.rate && item.unitPrice) item.rate = String(item.unitPrice);
                        if (!item.unit && item.uqc) item.unit = item.uqc;
                        if (!item.itemFob && item.fobValue) item.itemFob = String(item.fobValue);
                        reviveItemLists(item);
                        return item;
                    });
                }
                return inv;
            });
        }

        await reviveJob(jobData);
        // 16-Nov-2026: e-Sanchit PDFs signed in EagleView Signer show as signed
        try { require('../utils/esanchitArchive').mergeAdded(jobData, 'eSanchitList', 'read'); } catch (e) { /* archive not readable */ } // documents added from EagleView Signer (17-Nov-2026)
        try { require('../utils/esanchitArchive').applySigned(jobData, { jobLists: ['eSanchitList'], itemLists: ['eSanchitList'] }); } catch (e) { /* archive not readable */ }
        return jobData;
    }
}

// GET /api/export-jobs/:id
router.get('/:id', async (req, res) => {
    try {
        const jobData = await loadExportJob(req.params.id);
        if (!jobData) return res.status(404).json({ error: 'Job not found' });
        res.json({ success: true, data: jobData });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/export-jobs
router.get('/', async (req, res) => {
    try {
        // selected branch / financial year (jobs saved without one are listed everywhere); was the last 50 jobs of all branches. 29-Oct-2026
        const { Op } = require('sequelize');
        const where = {}; const and = [];
        if (req.query.branchId) and.push({ [Op.or]: [{ branchId: req.query.branchId }, { branchId: null }] });
        if (req.query.financialYearId) and.push({ [Op.or]: [{ financialYearId: req.query.financialYearId }, { financialYearId: null }] });
        if (and.length) where[Op.and] = and;
        const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
        let jobs;
        try { jobs = await ExportJob.findAll({ where, order: [['id', 'DESC']], limit, include: [{model: ExportInvoice, as: 'invoices'}, {model: ExportContainer, as: 'containers'}] }); }
        catch (e) { console.warn('[export-jobs] list with invoices failed, listing jobs only:', e.message); jobs = await ExportJob.findAll({ where, order: [['id', 'DESC']], limit }); }
        
        const ExportFinalDoc = require('../models/ExportFinalDoc');
        const sbNumbers = jobs.map(j => {
            
            
            const addData = parseExtra(j.additionalData);
            return j.sbNo || j.sbNumber || addData.sbNo || addData.sbNumber;
        }).filter(sb => sb);
        
        let finalDocs = [];
        if (sbNumbers.length > 0) {
            const { Op } = require('sequelize');
            try { finalDocs = await ExportFinalDoc.findAll({ where: { sbNo: { [Op.in]: sbNumbers } } }); }
            catch (e) { console.warn('[export-jobs] final docs:', e.message); finalDocs = []; }
        }

        const { stageOf } = require('../utils/exportStage');
        const invDates = await rawInvoiceDates(jobs.map(j => j.id));
        const processedJobs = jobs.map(j => {
            let data = j.toJSON();
            // fields kept in additionalData (exporter, consignee, SB No, entered by ...) - columns win
            const ext = parseExtra(data.additionalData);
            for (const [k, v] of Object.entries(ext)) if (data[k] === null || data[k] === undefined || data[k] === '') data[k] = v;
            delete data.additionalData;
            
            (data.invoices || []).forEach(inv => fixInvoiceDate(inv, invDates));
            if (data.invoices && data.invoices.length > 0) {
                let firstInvData = data.invoices[0];
                if (firstInvData.additionalData) {
                    firstInvData = { ...parseExtra(firstInvData.additionalData), ...firstInvData }; // was "...null": invoice no / date kept in additionalData never showed
                }
                data.invNo = firstInvData.invoiceNo || firstInvData.no;
                data.invDt = firstInvData.invoiceDate || firstInvData.date;
                data.invValue = data.invoices.reduce((sum, inv) => {
                    let invData = inv;
                    if (inv.additionalData) {
                        invData = { ...parseExtra(inv.additionalData), ...inv };
                    }
                    return sum + (parseFloat(invData.invoiceValue || invData.value) || 0);
                }, 0).toFixed(2);
            }
            if (data.containers && data.containers.length > 0) {
                data.containerNo = data.containers.map(c => c.containerNo).join(', ');
            }
            // MAWB / HAWB are typed in the SB Header boxes autoField_22 / autoField_24 (18-Nov-2026: search by MAWB / HAWB found nothing)
            if (!data.mawbNo) data.mawbNo = data.autoField_22 || data.AirWayBillNo || null;
            if (!data.hawbNo) data.hawbNo = data.autoField_24 || null;
            data.origin = data.customsPortName || data.customsPort;
            data.destination = data.destPortName || data.consigneeCountry || data.consigneeCountryCode;
            data.fobValue = data.fobRs || 0;
            data.invDt = data.invDt || data.invDate;
            data.dbkValue = data.dbkRs || 0;
            
            const currentSb = data.sbNo || data.sbNumber;
            if (currentSb) {
                data.hasFirstCopy = finalDocs.some(d => d.sbNo === currentSb && d.docType === 'FIRST_COPY');
                data.hasLeoCopy = finalDocs.some(d => d.sbNo === currentSb && d.docType === 'LEO_COPY');
                data.hasGatepass = finalDocs.some(d => d.sbNo === currentSb && d.docType === 'GATEPASS');
                data.finalDocs = finalDocs.filter(d => d.sbNo === currentSb).map(d => ({ docType: d.docType, fileUrl: d.fileUrl }));
            }
            // job stage (same rule as the Export dashboard): DRAFT / SUBMITTED / TD_DONE / XRAY_DONE / LEO / ... / CANCELLED
            data.stage = stageOf(data, { hasLeoCopy: !!data.hasLeoCopy, hasGatepass: !!data.hasGatepass });
            
            return data;
        });
        // 13-Nov-2026: the docket of each job from Shipment Registration (export divisions AE / SE), as on the Import
        // job list - UN-REGISTERED makes it there, a docket no opens it
        try {
            const nos = [...new Set(processedJobs.map(d => String(d.jobNo || '').trim().toUpperCase()).filter(Boolean))];
            const dk = new Map();
            for (let i = 0; i < nos.length; i += 900) {
                const part = nos.slice(i, i + 900);
                const rows = await sequelize.query(`SELECT id, docketNo, division, upper(trim(ediJobNo)) k FROM Shipments WHERE upper(trim(ediJobNo)) IN (${part.map(() => '?').join(',')})
                    AND coalesce(stage, '') <> 'Cancelled' AND upper(coalesce(division, '')) LIKE '%E' ORDER BY id`, { replacements: part, type: sequelize.QueryTypes.SELECT });
                for (const r of rows) { if (!dk.has(r.k)) dk.set(r.k, []); dk.get(r.k).push(r); }
            }
            for (const d of processedJobs) {
                const all = dk.get(String(d.jobNo || '').trim().toUpperCase()) || [];
                const m0 = String(d.shipmentMode || '').toUpperCase()[0] || '';
                const r = all.find(x => String(x.division || '').toUpperCase()[0] === m0) || all[0];
                if (r) { d.docketNo = r.docketNo; d.docketDivision = r.division; d.docketId = r.id; }
                else if (d.docketNo) { const m = /^[A-Z]{3}\/([A-Z]{2})\//.exec(String(d.docketNo).toUpperCase()); if (m) d.docketDivision = m[1]; }
            }
        } catch (e) { /* no Shipments table yet */ }
        // jobs of other branches / years, so an empty list can say where the jobs are (29-Oct-2026)
        let totalAll = processedJobs.length;
        if (and.length) { try { totalAll = await ExportJob.count(); } catch (e) { /* count is only a hint */ } }
        res.json({ success: true, data: processedJobs, totalAll, filtered: and.length > 0 });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/export-jobs/:id/logs - job history for the job list's Log column (as Import). 13-Nov-2026
router.get('/:id/logs', async (req, res) => {
    try {
        const job = await ExportJob.findByPk(req.params.id);
        if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
        const j = job.toJSON(); const ext = parseExtra(j.additionalData);
        const by = (k) => j[k] || ext[k] || '';
        const logs = [{ time: j.createdAt, action: 'JOB_CREATED', user: by('createdBy') || by('enteredBy'), details: 'Job ' + (j.jobNo || j.id) + ' created' }];
        if (j.updatedAt && String(j.updatedAt) !== String(j.createdAt)) logs.push({ time: j.updatedAt, action: 'JOB_UPDATED', user: by('updatedBy'), details: 'Last saved' });
        if (by('icegateStatus')) logs.push({ time: j.updatedAt, action: 'ICEGATE_' + by('icegateStatus'), user: '', details: by('icegateUniqueId') ? 'Unique ID ' + by('icegateUniqueId') : '' });
        if (by('sbNo') || by('sbNumber')) logs.push({ time: j.updatedAt, action: 'SB_NO', user: '', details: 'SB No ' + (by('sbNo') || by('sbNumber')) + (by('sbDate') ? ' dated ' + by('sbDate') : '') });
        try {
            const JobTimeline = require('../models/JobTimeline');
            for (const tl of await JobTimeline.findAll({ where: { module: 'EXPORT', jobId: String(j.id) }, order: [['createdAt', 'ASC']] }))
                logs.push({ time: tl.createdAt, action: tl.eventType || 'REMARK', user: tl.author || '', details: tl.message || '' });
        } catch (e) { /* timeline table not available */ }
        logs.sort((a, b) => new Date(b.time) - new Date(a.time));
        res.json(logs);
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// DELETE /api/export-jobs/:id
// POST /api/export-jobs/:id/sb-no { sbNo, sbDate } - SB No read from the ICEGATE acknowledgement (job list "SB Track"). 29-Oct-2026
router.post('/:id/sb-no', async (req, res) => {
    try {
        const job = await ExportJob.findByPk(req.params.id);
        if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
        const sbNo = String((req.body || {}).sbNo || '').trim();
        if (!/^\d{5,10}$/.test(sbNo)) return res.status(400).json({ success: false, error: 'SB No must be 5-10 digits' });
        const upd = { sbNo, sbDate: String((req.body || {}).sbDate || '').trim() || job.sbDate };
        const { rank } = require('../utils/exportStage');
        if (rank(job.status) < rank('SUBMITTED')) upd.status = 'SUBMITTED';
        await job.update(upd);
        res.json({ success: true, data: { id: job.id, sbNo: job.sbNo, sbDate: job.sbDate, status: job.status } });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        const job = await ExportJob.findByPk(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        // 12-Nov-2026: a job already sent to ICEGATE (SB No, ICEGATE id, LEO, or status past DRAFT) is not deleted on
        // one click - its SB stays with Customs. Only an admin can still delete it, with ?force=1 (the screen asks
        // for the job no first).
        {
            const x = parseExtra(job.additionalData);
            const filed = !!(job.sbNo || x.sbNumber || job.icegateUniqueId || job.leoDate) || require('../utils/exportStage').rank(job.status) >= 1;
            const isAdmin = String((req.user && req.user.role) || '').toLowerCase() === 'admin';
            if (filed && !(req.query.force === '1' && isAdmin)) {
                return res.status(409).json({ success: false, filed: true, canForce: isAdmin, error: `Job ${job.jobNo} is already filed (${[job.sbNo || x.sbNumber ? 'SB ' + (job.sbNo || x.sbNumber) : '', job.status && job.status !== 'DRAFT' ? job.status : '', job.leoDate ? 'LEO' : ''].filter(Boolean).join(', ') || 'sent to ICEGATE'}) - it cannot be deleted.` + (isAdmin ? '' : ' Ask an admin.') });
            }
        }
        // children first, all in one transaction (was: job deleted first, children outside any transaction)
        await sequelize.transaction(async (t) => {
            const existingInvoices = await ExportInvoice.findAll({ where: { exportJobId: job.id }, transaction: t });
            const existingInvoiceIds = existingInvoices.map(inv => inv.id);
            if (existingInvoiceIds.length > 0) await ExportItem.destroy({ where: { exportInvoiceId: existingInvoiceIds }, transaction: t });
            await ExportInvoice.destroy({ where: { exportJobId: job.id }, transaction: t });
            await ExportContainer.destroy({ where: { exportJobId: job.id }, transaction: t });
            await ExportDocument.destroy({ where: { exportJobId: job.id }, transaction: t });
            await ExportDrawback.destroy({ where: { exportJobId: job.id }, transaction: t });
            await ExportLicense.destroy({ where: { exportJobId: job.id }, transaction: t });
            await job.destroy({ transaction: t });
        });
        res.json({ success: true, message: 'Job deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.loadExportJob = loadExportJob;
module.exports = router;

