const express = require('express');
const router = express.Router();
const ImportJob = require('../models/ImportJob');
const ImportInvoice = require('../models/ImportInvoice');
const ImportItem = require('../models/ImportItem');
const ImportContainer = require('../models/ImportContainer');
const JobSequence = require('../models/JobSequence');
const { packExtra, unpackExtra } = require('../utils/extraFields');
const { ensureFieldColumns } = require('../utils/dynamicColumns');
const Party = require('../models/Party');
// child rows in the order they were saved (SQLite returned containers / items of a joined read in any order, so a
// re-opened job could show container 2 before 1). 29-Oct-2026
const CHILD_ORDER = [[{ model: ImportInvoice, as: 'invoices' }, 'id', 'ASC'], [{ model: ImportInvoice, as: 'invoices' }, { model: ImportItem, as: 'items' }, 'id', 'ASC'], [{ model: ImportContainer, as: 'containers' }, 'id', 'ASC']];

// We leave unpackExtendedData as a pass-through in case of old records
const { validateImportSave } = require('../utils/importJobValidate');
const unpackExtendedData = (obj) => {
    if (!obj) return obj;
    let data = typeof obj.toJSON === 'function' ? obj.toJSON() : obj;
    if (data.extendedData) {
        data = unpackExtra(data, 'extendedData');
    }
    
      if (data._bondRows && typeof data._bondRows === 'string') {
          try { data._bondRows = JSON.parse(data._bondRows); } catch(e){}
      }
      if (data._hssRows && typeof data._hssRows === 'string') {
          try { data._hssRows = JSON.parse(data._hssRows); } catch(e){}
      }
      // fields saved without a column of their own (see utils/extraFields.js)
      if (Array.isArray(data.invoices)) data.invoices = data.invoices.map(inv => {
          const i2 = unpackExtra(inv, 'extendedData');
          if (Array.isArray(i2.items)) i2.items = i2.items.map(it => unpackExtra(it, 'extendedData'));
          return i2;
      });
      if (Array.isArray(data.containers)) data.containers = data.containers.map(c => unpackExtra(c, 'extendedData'));
      // 16-Nov-2026: e-Sanchit PDFs signed in EagleView Signer show as signed
      try { require('../utils/esanchitArchive').mergeAdded(data, 'esanchitDocs', 'read'); } catch (e) { /* archive not readable */ } // documents added from EagleView Signer (17-Nov-2026)
      try { require('../utils/esanchitArchive').applySigned(data, { jobLists: ['esanchitDocs'], itemLists: ['docsData'] }); } catch (e) { /* archive not readable */ }
      return data;
};

const FILED = new Set(['Filed', 'Accepted', 'Amended']);
const saveImportJob = async (req, res) => {
    // 30-Oct-2026: impossible values are refused before anything is written (dates that are not dates, negative
    // quantities, items under an invoice that does not exist, CIF with freight...). Harmless ones are normalised in
    // place (commas in numbers, dd-mm-yyyy dates, lower-case codes). A draft may still be incomplete.
    const check = validateImportSave(req.body || {});
    if (check.errors.length) {
        return res.status(400).json({ success: false, error: `Not saved - ${check.errors.length} problem(s): ` + check.errors.slice(0, 3).join(' | ') + (check.errors.length > 3 ? ` | +${check.errors.length - 3} more` : ''), problems: check.errors, warnings: check.warnings });
    }
    // 10-Nov-2026: a NEW job from the screen that repeats the invoice (same IEC) / HAWB of another job - most often a
    // duplicated job - is saved only after the operator says so (_dupOk).
    // 16-Nov-2026: also a job read from a file (Import from File saves it straight away): the same .be uploaded twice made
    // two drafts, and a file of a job already loaded from iCAFFE made a second job of it - the window now asks first.
    {
        const b = req.body || {}; const dupOk = b._dupOk === true || b._dupOk === 'true'; delete b._dupOk;
        if (!b.id && !dupOk) {
            try {
                const D = require('../utils/jobDuplicates'); const m = await D.check('IMPORT', b);
                if (m.length) return res.status(409).json({ success: false, duplicate: true, matches: m, error: D.message(m) });
            } catch (e) { console.warn('[import-jobs] duplicate check:', e.message); }
        }
    }
    // known form fields get their own column (created before the transaction: SQLite cannot alter a table inside one);
    // 30-Oct-2026: only the fields of utils/formFieldColumns.js - any other key stays in extendedData (JSON), so a typo
    // in an Excel header or a stray key can no longer add a permanent column to the table
    try {
        const p = req.body || {};
        const invs = Array.isArray(p.invoices) ? p.invoices : [];
        const known = require('../utils/formFieldColumns');
        const onlyKnown = (name, obj) => { const set = new Set(known[name] || []); return Object.fromEntries(Object.entries(obj || {}).filter(([k]) => set.has(k))); };
        await ensureFieldColumns(ImportJob, onlyKnown('ImportJob', p));
        await ensureFieldColumns(ImportInvoice, invs.map(i => onlyKnown('ImportInvoice', i)));
        // items / containers: no column list - their extra fields live in extendedData
    } catch (e) { console.warn('[import-jobs] column check:', e.message); }
    const t = await sequelize.transaction();
    try {
        const payload = req.body;
        let job = null;

        // a BE file read from other software carries the warehouse BE No itself, so the in-bond job may not be in our system. 28-Oct-2026
        // an Ex-Bond needs its warehouse BE: a linked WH job of ours, or the WH BE No + Date typed in (WH BE filed
        // elsewhere). 28-Oct-2026
        if (payload.boeType === 'EX_BOND' && !payload.inBondJobId && !req.allowNoInBond && !(String(payload.warehouseBENo || '').trim() && String(payload.warehouseBEDate || '').trim())) {
            throw new Error('Ex-Bond job: link the Warehouse BE (Select WH BE) or enter the WH BE No and Date.');
        }
        // 30-Oct-2026: the warehouse balance is checked here for every save path (screen Modify was the only check;
        // Save, Excel import and copy-from-job went past it): an ex-bond item may not clear more than what the WH BE
        // still holds after the ex-bonds already filed against it
        if (payload.boeType === 'EX_BOND' && payload.inBondJobId) {
            // 22-Nov-2026: one light query (routes/warehouse-be.js lightBalances) instead of loading the WH job and all its
            // ex-bond jobs with every item - this ran on every save of an ex-bond and was most of the save time
            const lb = await require('./warehouse-be').lightBalances(payload.inBondJobId, payload.id);
            const whJob = lb;
            if (whJob) {
                const bal = lb; const whQty = lb.whQty;
                const over = [];
                (Array.isArray(payload.invoices) ? payload.invoices : []).forEach((inv, k) => (Array.isArray(inv.items) ? inv.items : []).forEach(it => {
                    const key = `${it.invSrNo || k + 1}/${it.itemSrNo || it.itemNo}`; if (!(key in whQty)) return;
                    const balance = Math.max(0, +(whQty[key] - ((bal.byKey[key] || {}).cleared || 0)).toFixed(6)); const q = parseFloat(it.quantity || it.qty) || 0;
                    if (q > balance + 1e-6) over.push(`item ${key}: ${q} > balance ${balance}`);
                }));
                if (over.length) throw Object.assign(new Error('Ex-Bond quantity is more than the warehouse balance (' + over.join('; ') + '). Reduce the quantity or check the ex-bonds already filed against WH BE ' + (whJob.jobNo || whJob.id) + '.'), { status: 400 });
            }
        }

        if (!payload.jobNo || payload.jobNo === 'DRAFT') {
            // branch from branchId (the screen does not send branchCode), counter from Settings > Sequence Config. 28-Oct-2026
            payload.jobNo = await require('../utils/jobSequence').take({ branchCode: payload.branchCode, branchId: payload.branchId, shipmentMode: payload.shipmentMode, side: 'IMPORT', financialYearId: payload.financialYearId }, t);
        }
        // 14-Nov-2026: e-Sanchit PDFs attached before the job had a number (uploads/esanchit_archive/draft ...) go to the job's folder
        try { require('../utils/esanchitArchive').relinkJob(payload, payload.jobNo, { jobLists: ['esanchitDocs'], itemLists: ['docsData'] }); } catch (e) { console.warn('[import-jobs] e-Sanchit PDFs:', e.message); }
        // 16-Nov-2026: a screen opened before a PDF was signed in EagleView Signer saves the signed copy, not the old one
        try { require('../utils/esanchitArchive').mergeAdded(payload, 'esanchitDocs', 'save'); } catch (e) { /* archive not readable */ } // documents added from EagleView Signer (17-Nov-2026)
        try { require('../utils/esanchitArchive').applySigned(payload, { jobLists: ['esanchitDocs'], itemLists: ['docsData'] }); } catch (e) { /* archive not readable */ }

        
        if (payload._bondRows) {
            payload._bondRows = typeof payload._bondRows === 'string' ? payload._bondRows : JSON.stringify(payload._bondRows);
        }
        if (payload._hssRows) {
            payload._hssRows = typeof payload._hssRows === 'string' ? payload._hssRows : JSON.stringify(payload._hssRows);
        }

        // keep every form field: non-column fields go into extendedData (JSON)
        const existingJob = payload.id ? await ImportJob.findByPk(payload.id, { transaction: t }) : null;
        // 14-Nov-2026: an amended job (BE amendment copy) is locked once its amendment was sent to ICEGATE / accepted / voided -
        // a later amendment of the same BE is copied from it, so changes made after sending were never reported
        if (existingJob) {
            let ext = existingJob.extendedData; if (typeof ext === 'string') { try { ext = JSON.parse(ext); } catch (e) { ext = {}; } }
            const amId = ext && ext._amendmentId;
            if (amId) {
                const [am] = await sequelize.query('SELECT amendNo, status, submittedAt FROM BeAmendments WHERE id = ?', { replacements: [amId], type: require('sequelize').QueryTypes.SELECT, transaction: t }).catch(() => []);
                if (am && ['Submitted', 'Accepted', 'Void'].includes(am.status)) {
                    const why = am.status === 'Void' ? `amendment ${am.amendNo} is void` : am.status === 'Accepted' ? `amendment ${am.amendNo} was accepted by ICEGATE - make a new amendment for more changes`
                        : `amendment ${am.amendNo} was sent to ICEGATE${am.submittedAt ? ' on ' + new Date(am.submittedAt).toLocaleDateString('en-GB') : ''} - if ICEGATE rejects it, mark it Rejected in the amendment window to change it again`;
                    throw Object.assign(new Error(`Amended job ${existingJob.jobNo} is locked: ${why}.`), { status: 409 });
                }
            }
        }
        // 30-Oct-2026: a BE that went to ICEGATE is locked - the next auto-save was overwriting the filed data. The screen
        // sends _amendMode after "Unlock for amendment" (recorded on the job and in the timeline); the filed copy stays.
        if (existingJob && FILED.has(String(existingJob.icegateStatus || '')) && !existingJob.amendUnlockedAt && !payload._amendMode) {
            throw Object.assign(new Error(`This BE was ${existingJob.icegateStatus} on ICEGATE (${existingJob.icegateUniqueId || ''}) and is locked. Use "Unlock for amendment" on the Job Header to change it.`), { status: 409 });
        }
        if (existingJob && payload._amendMode && !existingJob.amendUnlockedAt) {
            payload.amendUnlockedAt = new Date(); payload.amendUnlockedBy = (req.user && req.user.username) || '';
            try { await require('../models/JobTimeline').create({ module: 'IMPORT', jobId: String(existingJob.id), eventType: 'UNLOCK', message: `Unlocked for amendment after ${existingJob.icegateStatus} (${existingJob.icegateUniqueId || ''})${payload._amendReason ? ': ' + payload._amendReason : ''}`, author: payload.amendUnlockedBy }, { transaction: t }); } catch (e) { /* timeline optional */ }
        }
        delete payload._amendMode; delete payload._amendReason;
        // the filed copy and its stamps are written by the filing route only
        for (const k of ['filedJson', 'filedAt', 'filedFileName', 'filedSigner', 'icegateJobNo']) delete payload[k];
        // 30-Oct-2026: two operators on one job - the screen sends the updatedAt it loaded (_loadedAt); when the row
        // changed since, the save is refused instead of silently overwriting the other person's work
        if (existingJob && payload._loadedAt) {
            const mine = new Date(payload._loadedAt).getTime(), db = new Date(existingJob.updatedAt).getTime();
            if (isFinite(mine) && isFinite(db) && Math.abs(db - mine) > 1500 && db > mine) {
                throw Object.assign(new Error(`Job ${existingJob.jobNo} was saved by ${existingJob.updatedBy || 'another user'} at ${new Date(existingJob.updatedAt).toLocaleString('en-GB')} after you opened it. Re-open the job (1. Job Query) and make your changes again.`), { status: 409, stale: true });
            }
        }
        delete payload._loadedAt;
        // who saved it (the token's login); createdBy only on a new job
        const who = (req.user && (req.user.username || req.user.email)) || '';
        payload.updatedBy = who; if (!existingJob) payload.createdBy = who; else delete payload.createdBy;
        const jobRow = packExtra(ImportJob, payload, 'extendedData', existingJob && existingJob.extendedData);
        if (existingJob) {
            job = existingJob;
            await job.update(jobRow, { transaction: t });
        } else {
            delete jobRow.id;
            job = await ImportJob.create(jobRow, { transaction: t });
        }

        if (payload.invoices && Array.isArray(payload.invoices)) {
            const existingInvoices = await ImportInvoice.findAll({ where: { importJobId: job.id }, transaction: t });
            const existingInvoiceIds = existingInvoices.map(inv => inv.id);
            if (existingInvoiceIds.length > 0) {
                if (ImportItem) await ImportItem.destroy({ where: { importInvoiceId: existingInvoiceIds }, transaction: t });
            }
            await ImportInvoice.destroy({ where: { importJobId: job.id }, transaction: t });

            for (let inv of payload.invoices) {
                inv.importJobId = job.id; delete inv.id; // child rows are re-created on every save: let the DB give a new id (old/duplicated ids clashed)
                const newInv = await ImportInvoice.create(packExtra(ImportInvoice, inv, 'extendedData'), { transaction: t });
                if (inv.items && Array.isArray(inv.items)) {
                    // 22-Nov-2026: the items of an invoice go in with one INSERT per 50 rows (bulkCreate) instead of one
                    // statement per item - a 207-item job took 8-12 s to save on the live disk, on EVERY item Modify
                    const itemRows = [];
                    for (let item of inv.items) {
                        item.importInvoiceId = newInv.id; delete item.id; // child rows are re-created on every save: let the DB give a new id (old/duplicated ids clashed)
                        item.itemNo = item.itemNo || item.itemSrNo;
                        item.productDescription = item.productDescription || item.desc;
                        item.hsCode = item.hsCode || item.ritc;
                        item.quantity = item.quantity || item.qty;
                        item.uqc = item.uqc || item.unit;
                        item.unitPrice = item.unitPrice || item.price;
                        item.assessableValue = item.assessableValue || item.value;
                        itemRows.push(packExtra(ImportItem, item, 'extendedData'));
                    }
                    for (let k = 0; k < itemRows.length; k += 50) await ImportItem.bulkCreate(itemRows.slice(k, k + 50), { transaction: t });
                }
            }
        }

        if (payload.containers && Array.isArray(payload.containers)) {
            await ImportContainer.destroy({ where: { importJobId: job.id }, transaction: t });
            for (let cont of payload.containers) {
                cont.importJobId = job.id; delete cont.id; // child rows are re-created on every save: let the DB give a new id (old/duplicated ids clashed)
                await ImportContainer.create(packExtra(ImportContainer, cont, 'extendedData'), { transaction: t });
            }
        }

        await t.commit();

        let fullJob = await ImportJob.findByPk(job.id, {
            include: [
                { model: ImportInvoice, as: 'invoices', include: [{ model: ImportItem, as: 'items' }] },
                { model: ImportContainer, as: 'containers' }
            ],
            order: CHILD_ORDER
        });

        if (fullJob) fullJob = unpackExtendedData(fullJob);

        res.json({ success: true, data: fullJob, message: req.importMessage || undefined });
    } catch (err) {
        await t.rollback();
        res.status(err.status || 500).json({ success: false, error: err.message, locked: (err.status === 409 && !err.stale) || undefined, stale: err.stale || undefined });
    }
};
router.post('/', saveImportJob);

// 22-Nov-2026: item Modify on a saved job sent the whole job (1.5 MB on a 200-item job) and the server deleted and
// re-created every invoice and item for it. This route writes ONLY the items that changed, in place. The screen uses it
// when nothing but a few existing items changed (same items, same Item Sr Nos, header / invoices / documents untouched);
// anything else - and every case this route is not sure about (it answers fallback: true) - goes through the full save.
// Same rules as the full save: item checks of utils/importJobValidate.js, items not worth more than their invoice,
// ex-bond quantity within the warehouse balance, filed-BE lock, "saved by someone else" check.
router.post('/:id/items-patch', async (req, res) => {
    const fb = (why) => res.json({ success: false, fallback: true, error: why });
    try {
        const { sequelize } = require('../db'); const { QueryTypes } = require('sequelize');
        const b = req.body || {}; const patches = Array.isArray(b.items) ? b.items : [];
        if (!patches.length || patches.length > 40) return fb('nothing to patch / too many items');
        const job = await ImportJob.findByPk(req.params.id);
        if (!job) return fb('job not found');
        let ext = job.extendedData; if (typeof ext === 'string') { try { ext = JSON.parse(ext); } catch (e) { ext = {}; } }
        if (ext && ext._amendmentId) return fb('amended job');
        if (FILED.has(String(job.icegateStatus || '')) && !job.amendUnlockedAt) return fb('filed job');
        if (b._loadedAt) {
            const mine = new Date(b._loadedAt).getTime(), db = new Date(job.updatedAt).getTime();
            if (isFinite(mine) && isFinite(db) && Math.abs(db - mine) > 1500 && db > mine)
                return res.status(409).json({ success: false, stale: true, error: `Job ${job.jobNo} was saved by ${job.updatedBy || 'another user'} at ${new Date(job.updatedAt).toLocaleString('en-GB')} after you opened it. Re-open the job (1. Job Query) and make your changes again.` });
        }
        const invRows = await ImportInvoice.findAll({ where: { importJobId: job.id }, order: [['id', 'ASC']] });
        if (!invRows.length) return fb('no invoices');
        const invs = invRows.map(r => unpackExtra(r, 'extendedData'));
        const cols = new Set((await sequelize.query('PRAGMA table_info(ImportItems)', { type: QueryTypes.SELECT })).map(c => c.name));
        const pick = (name) => { const j = `CASE WHEN json_valid(it.extendedData) THEN json_extract(it.extendedData, '$.${name}') END`; return (cols.has(name) ? `COALESCE(it.${name}, ${j})` : j) + ` AS ${name}`; };
        const light = await sequelize.query(`SELECT it.id, it.importInvoiceId AS iid, ${['invSrNo', 'itemSrNo', 'itemNo', 'value'].map(pick).join(', ')} FROM ImportItems it WHERE it.importInvoiceId IN (${invRows.map(() => '?').join(',')}) ORDER BY it.id`, { replacements: invRows.map(r => r.id), type: QueryTypes.SELECT });
        const pos = new Map(invRows.map((r, k) => [r.id, k + 1]));
        const keyOf = (invPos, sr) => `${invPos}/${String(sr === null || sr === undefined ? '' : sr).trim()}`;
        const byKey = new Map(); const dup = new Set();
        for (const r of light) { const k = keyOf(pos.get(r.iid), r.itemSrNo || r.itemNo); if (byKey.has(k)) dup.add(k); byKey.set(k, r); }
        // each patched item must be exactly one saved row, under the invoice its Inv Sr No says, with the same Item Sr No
        const work = []; const seen = new Set();
        for (const it of patches) {
            if (!it || typeof it !== 'object') return fb('bad item');
            const invPos = parseInt(it.invSrNo || '1', 10); const k = keyOf(invPos, it.itemSrNo || it.itemNo);
            if (!(invPos >= 1 && invPos <= invRows.length) || dup.has(k) || seen.has(k) || !byKey.has(k)) return fb('item ' + k + ' not found once');
            seen.add(k); work.push({ it, invPos, row: byKey.get(k), key: k });
        }
        // item checks of the full save (values are normalised in place the same way); the invoice carries only the patched items
        const mini = { boeType: job.boeType, icaffeRowId: job.icaffeRowId, invoices: invs.map((iv, k) => ({ invNo: iv.invNo || iv.invoiceNo, invoiceNo: iv.invoiceNo, currency: iv.currency || iv.invoiceCurrency, items: work.filter(w => w.invPos === k + 1).map(w => w.it) })) };
        const check = validateImportSave(mini);
        if (check.errors.length) return res.status(400).json({ success: false, error: `Not saved - ${check.errors.length} problem(s): ` + check.errors.slice(0, 3).join(' | '), problems: check.errors });
        // items worth more than their invoice (the full save's rule), with the other items as they are saved
        const num = (v) => { const x = parseFloat(String(v === null || v === undefined ? '' : v).replace(/,/g, '')); return isFinite(x) ? x : 0; };
        const problems = [];
        invs.forEach((iv, k) => {
            const mine = work.filter(w => w.invPos === k + 1); if (!mine.length) return;
            const ids = new Set(mine.map(w => w.row.id)); let sum = mine.reduce((s, w) => s + Math.max(0, num(w.it.value)), 0);
            for (const r of light) if (r.iid === invRows[k].id && !ids.has(r.id)) sum += Math.max(0, num(r.value));
            const invVal = num(iv.value !== undefined && iv.value !== null && iv.value !== '' ? iv.value : iv.invoiceValue);
            if (invVal > 0 && sum > invVal && Math.abs(invVal - sum) > Math.max(1, invVal * 0.005)) problems.push(`Invoice ${k + 1}: Items ${sum.toFixed(2)} are worth more than the invoice value ${invVal} - correct the invoice value or the item values`);
        });
        if (problems.length) return res.status(400).json({ success: false, error: 'Not saved - ' + problems.join(' | '), problems });
        if (['EX_BOND', 'X'].includes(String(job.boeType || '')) && job.inBondJobId) {
            const lb = await require('./warehouse-be').lightBalances(job.inBondJobId, job.id);
            if (lb) {
                const over = [];
                for (const w of work) { if (!(w.key in lb.whQty)) continue; const balance = Math.max(0, +(lb.whQty[w.key] - ((lb.byKey[w.key] || {}).cleared || 0)).toFixed(6)); const q = parseFloat(w.it.quantity || w.it.qty) || 0; if (q > balance + 1e-6) over.push(`item ${w.key}: ${q} > balance ${balance}`); }
                if (over.length) return res.status(400).json({ success: false, error: 'Ex-Bond quantity is more than the warehouse balance (' + over.join('; ') + '). Reduce the quantity or check the ex-bonds already filed against WH BE ' + (lb.jobNo || lb.id) + '.' });
            }
        }
        const who = (req.user && (req.user.username || req.user.email)) || '';
        const t = await sequelize.transaction();
        try {
            const skip = new Set(['id', 'createdAt', 'updatedAt', 'importInvoiceId']);
            for (const w of work) {
                const item = { ...w.it }; delete item.id; item.importInvoiceId = w.row.iid;
                // the same shadows the full save writes
                item.itemNo = item.itemNo || item.itemSrNo; item.productDescription = item.productDescription || item.desc; item.hsCode = item.hsCode || item.ritc;
                item.quantity = item.quantity || item.qty; item.uqc = item.uqc || item.unit; item.unitPrice = item.unitPrice || item.price; item.assessableValue = item.assessableValue || item.value;
                const packed = packExtra(ImportItem, item, 'extendedData');
                // a column the item does not carry is emptied, as on a row the full save would have created afresh
                for (const [a, def] of Object.entries(ImportItem.rawAttributes)) if (!skip.has(a) && !(a in packed)) packed[a] = (def.defaultValue !== undefined && typeof def.defaultValue !== 'function' && typeof def.defaultValue !== 'object') ? def.defaultValue : null;
                delete packed.id;
                const [n] = await ImportItem.update(packed, { where: { id: w.row.id }, transaction: t });
                if (n !== 1) throw new Error('item row ' + w.key + ' was not written');
            }
            const jobPatch = packExtra(ImportJob, { ...(b.itemTotal !== undefined ? { itemTotal: b.itemTotal } : {}), updatedBy: who }, 'extendedData', job.extendedData);
            job.changed('updatedBy', true);
            await job.update(jobPatch, { transaction: t });
            await t.commit();
        } catch (e) { await t.rollback(); throw e; }
        res.json({ success: true, patched: work.length, data: { id: job.id, jobNo: job.jobNo, updatedAt: job.updatedAt, updatedBy: job.updatedBy } });
    } catch (err) {
        res.status(err.status || 500).json({ success: false, error: err.message });
    }
});

// The CACHI01 JSON exactly as it was sent to ICEGATE (30-Oct-2026) - for the amendment diff and the records
router.get('/:id/filed-json', async (req, res) => {
    try {
        const job = await ImportJob.findByPk(req.params.id, { attributes: ['id', 'jobNo', 'icegateStatus', 'icegateUniqueId', 'filedJson', 'filedAt', 'filedFileName', 'filedSigner'] });
        if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
        let json = null; try { json = job.filedJson ? JSON.parse(job.filedJson) : null; } catch (e) { json = job.filedJson; }
        res.json({ success: true, data: { jobNo: job.jobNo, icegateStatus: job.icegateStatus, icegateUniqueId: job.icegateUniqueId, filedAt: job.filedAt, fileName: job.filedFileName, signer: job.filedSigner, json } });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/import-jobs/import-json-direct { jsonText, format } - "Read Flat File / Read JSON / Read XML" of the job list.
// Parses the file and saves it as a new job (this route was missing, so every file import failed). 28-Oct-2026
router.post('/import-json-direct', async (req, res) => {
    try {
        const { parseJsonToBE, parseFlatFileToBE } = require('../utils/ErpFileParser');
        const text = String((req.body && req.body.jsonText) || '');
        if (!text.trim()) return res.status(400).json({ success: false, error: 'File is empty' });
        let result;
        if (req.body.format === 'flat') result = parseFlatFileToBE(text);
        else {
            let obj;
            try { obj = JSON.parse(text); } catch (e) { obj = null; }
            result = obj ? parseJsonToBE(obj) : parseFlatFileToBE(text);
        }
        const jd = result.jobData || {};
        if (!Object.keys(jd).length && !(result.invoices || []).length) return res.status(400).json({ success: false, error: 'No BE data found in this file (format: ' + (result.detectedFormat || 'unknown') + ')' });
        const items = result.items || [];
        const invoices = (result.invoices || []).map((inv, idx) => ({ ...inv, items: items.filter(it => (Number(it.invoiceSrNo) || 1) === idx + 1) }));
        // 30-Oct-2026: no invented "INV-1" - items without an invoice in the file are refused by the save validator with a clear message
        if (!invoices.length && items.length) invoices.push({ invoiceNo: '', invNo: '', items });
        // dates from ICEGATE files are YYYYMMDD: keep them as YYYY-MM-DD like the screen does (the job list showed "Invalid Date")
        for (const k of ['jobDate', 'beDate', 'warehouseBEDate', 'igmDate', 'mawbDate', 'hawbDate', 'inwardDate']) {
            const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(jd[k] || '').trim()); if (m) jd[k] = `${m[1]}-${m[2]}-${m[3]}`;
        }
        const payload = { ...jd, jobNo: 'DRAFT', invoices, _dupOk: req.body._dupOk === true };
        if (result.duties && result.duties.length) payload._duties = result.duties;
        if (result.exchangeRates && result.exchangeRates.length) payload._exchangeRates = result.exchangeRates;
        if (result.infoTypes && result.infoTypes.length) payload._infoTypes = result.infoTypes;
        if (result.statements && result.statements.length) payload._statements = result.statements;
        if (!payload.shipmentMode) payload.shipmentMode = /^A/i.test(String(jd.autoField_52 || '')) ? 'AIR' : /^L/i.test(String(jd.autoField_52 || '')) ? 'LAND' : 'SEA';
        if (!payload.boeType) payload.boeType = ({ W: 'WAREHOUSE', X: 'EX_BOND' })[String(jd.autoField_51 || '').toUpperCase()] || 'HOME_CONSUMPTION';
        if (payload.boeType === 'EX_BOND' && !payload.inBondJobId) {
            const wb = String(jd.warehouseBENo || '').trim();
            const inBond = wb ? await ImportJob.findOne({ where: { beNo: wb } }).catch(() => null) : null;
            if (inBond) payload.inBondJobId = inBond.id; else req.allowNoInBond = true;
        }
        req.body = payload;
        req.importMessage = `Imported (${result.detectedFormat || 'file'}): ${invoices.length} invoice(s), ${items.length} item(s)`;
        return saveImportJob(req, res);
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
});

// GET /api/import-jobs - job list (1. Job Query).
// 09-Nov-2026: with the iCAFFE BE jobs loaded (4,000+ jobs, 77,000 items) the list took long: every job came with all
// its columns and the whole extendedData (exchange / info / statement / duty rows...) - 4 MB for 500 jobs - and the
// search / date filter worked only on those 500 in the browser, so an older job could not be found at all.
// Now: only the fields the list and the DSR grid show, read with plain SQL, and the filters run here on all jobs:
//   ?from=yyyy-mm-dd&to=yyyy-mm-dd (job date), mode=AIR|SEA|LAND, beType=H|W|X, q=text, field=JOB_NO|BE_NO|IMPORTER|
//   SUB_AGENT|INVOICE|MAWB_MBL|HAWB_HBL|ALL, status=..., limit (default 100, max 5000). Newest first.
const LIST_KEYS = ['id', 'jobNo', 'jobDate', 'docketNo', 'nameOfImporter', 'autoField_4', 'autoField_2', 'autoField_5', 'autoField_20', 'autoField_22', 'iecCode', 'subagentName',
    'portCode', 'portOfOrigin', 'countryOfOrigin', 'beNo', 'beDate', 'boeType', 'beType', 'shipmentMode', 'status', 'icegateStatus', 'icegateUniqueId', 'isLocked', 'lockedBy', 'isVoid',
    'mawbNo', 'hawbNo', 'igmNumber', 'igmNo', 'invNo', 'invDt', 'supplierName', 'assessableValue', 'dutyValue', 'totalAssessableValue', 'totalDuty',
    'doDate', 'clearanceDate', 'latestRemark', 'assignedTo', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'branchCode', 'icegateJobNo'];
let listColsCache = null;
const tableCols = async (t) => new Set((await sequelize.query(`PRAGMA table_info(${t})`, { type: sequelize.QueryTypes.SELECT })).map(c => c.name));
router.get('/', async (req, res) => {
    try {
        const Q = req.query || {};
        const lim = Math.min(5000, Math.max(1, parseInt(Q.limit, 10) || 100)); // 100 latest by default (user, 09-Nov-2026)
        if (!listColsCache || Date.now() - listColsCache.at > 600000) listColsCache = { at: Date.now(), job: await tableCols('ImportJobs'), inv: await tableCols('ImportInvoices'), cont: await tableCols('ImportContainers') };
        const C = listColsCache;
        const qc = (c) => '"' + c + '"';
        const has = (c) => C.job.has(c);
        const w = [], p = [];
        // 10-Nov-2026: amended jobs (copies made by the BE amendment register, job no AMD/...) are not BE jobs - they are
        // opened from the BE job's amendment list or Customs > BE Amendments
        if (Q.amended !== '1') w.push("coalesce(j.jobNo, '') NOT LIKE 'AMD/%'");
        // job date (yyyy-mm-dd or yyyymmdd in the table), else the day it was made
        const day = `replace(substr(coalesce(nullif(trim(j.jobDate), ''), j.createdAt), 1, 10), '-', '')`;
        const d8 = (v) => { const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(v || '')); return m ? m[1] + m[2] + m[3] : null; };
        if (d8(Q.from)) { w.push(`${day} >= ?`); p.push(d8(Q.from)); }
        if (d8(Q.to)) { w.push(`${day} <= ?`); p.push(d8(Q.to)); }
        const mode = String(Q.mode || '').toUpperCase();
        if (['AIR', 'SEA', 'LAND'].includes(mode) && has('shipmentMode')) {
            if (mode === 'SEA') w.push(`upper(coalesce(j.shipmentMode, '')) NOT LIKE 'A%' AND upper(coalesce(j.shipmentMode, '')) NOT LIKE 'L%' AND coalesce(j.shipmentMode, '') <> ''`);
            else w.push(`upper(j.shipmentMode) LIKE '${mode[0]}%'`);
        }
        const bt = String(Q.beType || '').toUpperCase();
        if (['H', 'W', 'X'].includes(bt) && has('boeType')) {
            const isW = `(upper(coalesce(j.boeType, '')) LIKE 'W%' OR upper(coalesce(j.boeType, '')) = 'IN_BOND')`, isX = `(upper(coalesce(j.boeType, '')) LIKE 'EX%' OR upper(coalesce(j.boeType, '')) = 'X')`;
            w.push(bt === 'W' ? isW : bt === 'X' ? isX : `NOT ${isW} AND NOT ${isX} AND coalesce(j.boeType, '') <> ''`);
        }
        if (Q.status && Q.status !== 'All' && has('status')) { w.push('j.status = ?'); p.push(String(Q.status)); }
        const term = String(Q.q || '').trim();
        if (term) {
            const like = '%' + term.replace(/[%_\\]/g, (m) => '\\' + m) + '%';
            const colLike = (cs) => cs.filter(has).map(c => `j.${qc(c)} LIKE ? ESCAPE '\\'`);
            const ext = has('extendedData') ? [`j.extendedData LIKE ? ESCAPE '\\'`] : []; // fields kept in the JSON (importer, docket no ...)
            const invLike = `j.id IN (SELECT importJobId FROM ImportInvoices WHERE ${['invNo', 'invoiceNo', 'actualInvoiceNumber', 'supplierName'].filter(c => C.inv.has(c)).map(c => qc(c) + ` LIKE ? ESCAPE '\\'`).join(' OR ') || '0'})`;
            const nInv = ['invNo', 'invoiceNo', 'actualInvoiceNumber', 'supplierName'].filter(c => C.inv.has(c)).length;
            const F = {
                JOB_NO: colLike(['jobNo']), BE_NO: colLike(['beNo']), IMPORTER: colLike(['nameOfImporter', 'autoField_4']).concat(ext), SUB_AGENT: colLike(['subagentName']).concat(ext),
                MAWB_MBL: colLike(['mawbNo', 'mawbblNo']), HAWB_HBL: colLike(['hawbNo', 'hawbhblNo']),
            };
            let parts, n;
            const field = String(Q.field || 'ALL').toUpperCase();
            if (field === 'INVOICE') { parts = [invLike]; n = nInv; }
            else if (F[field]) { parts = F[field]; n = parts.length; }
            else { parts = colLike(['jobNo', 'beNo', 'nameOfImporter', 'autoField_4', 'mawbNo', 'hawbNo', 'igmNumber', 'iecCode', 'autoField_5', 'subagentName']).concat(ext, [invLike]); n = parts.length - 1 + nInv; }
            // 18-Nov-2026: the job no ICEGATE mails / replies name (stored at the first filing) finds the job too
            const icgNo = /^\d{1,7}$/.test(term) && has('icegateJobNo') && (field === 'JOB_NO' || !F[field] && field !== 'INVOICE');
            if (icgNo) parts = parts.concat(['j."icegateJobNo" = ?']);
            if (parts.length) { w.push('(' + parts.join(' OR ') + ')'); for (let i = 0; i < n; i++) p.push(like); if (icgNo) p.push(parseInt(term, 10)); }
        }
        const pick = LIST_KEYS.filter(has);
        const jobs = await sequelize.query(`SELECT ${pick.map(c => 'j.' + qc(c)).join(', ')}${has('extendedData') ? ', j.extendedData' : ''} FROM ImportJobs j ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY j.id DESC LIMIT ?`,
            { replacements: [...p, lim], type: sequelize.QueryTypes.SELECT });
        const ids = jobs.map(j => j.id);
        const byJob = (rows) => { const m = new Map(); for (const r of rows) { const k = String(r.importJobId); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
        const chunks = (a, n = 900) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
        const invCols = ['importJobId', 'invNo', 'invoiceNo', 'invDate', 'invoiceDate', 'currency', 'invoiceCurrency', 'value', 'invValue', 'invoiceValue', 'supplierName', 'extendedData'].filter(c => C.inv.has(c));
        const contCols = ['importJobId', 'containerNo', 'extendedData'].filter(c => C.cont.has(c));
        let invRows = [], contRows = [];
        for (const part of chunks(ids)) {
            const ph = part.map(() => '?').join(',');
            invRows = invRows.concat(await sequelize.query(`SELECT ${invCols.map(qc).join(', ')} FROM ImportInvoices WHERE importJobId IN (${ph}) ORDER BY id`, { replacements: part, type: sequelize.QueryTypes.SELECT }));
            if (C.cont.size) contRows = contRows.concat(await sequelize.query(`SELECT ${contCols.map(qc).join(', ')} FROM ImportContainers WHERE importJobId IN (${ph}) ORDER BY id`, { replacements: part, type: sequelize.QueryTypes.SELECT }));
        }
        const invBy = byJob(invRows.map(r => unpackExtra(r, 'extendedData'))), contBy = byJob(contRows.map(r => unpackExtra(r, 'extendedData')));
        const beNumbers = jobs.map(j => j.beNo).filter(Boolean);
        let finalDocs = [];
        if (beNumbers.length) {
            const ImportFinalDoc = require('../models/ImportFinalDoc');
            const { Op } = require('sequelize');
            for (const part of chunks(beNumbers)) finalDocs = finalDocs.concat(await ImportFinalDoc.findAll({ where: { beNo: { [Op.in]: part } }, attributes: ['beNo', 'docType', 'fileUrl'], raw: true }));
        }
        const n2 = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return isNaN(x) ? 0 : x; };
        const keep = new Set(LIST_KEYS);
        const data = jobs.map(j0 => {
            const full = unpackExtra(j0, 'extendedData'); // columns win over the JSON
            const data = {}; for (const k of keep) if (full[k] !== undefined && full[k] !== null) data[k] = full[k];
            const invs = invBy.get(String(j0.id)) || [];
            const first = invs[0] || {};
            const totals = {};
            invs.forEach(i => { const c = i.currency || i.invoiceCurrency || ''; totals[c] = (totals[c] || 0) + n2(i.value || i.invValue || i.invoiceValue); });
            data.supplier = data.supplierName || first.supplierName || '';
            data.invNo = invs.map(i => i.invNo || i.invoiceNo).filter(Boolean).join(', ') || data.invNo || '';
            data.invDt = first.invDate || first.invoiceDate || data.invDt || '';
            data.invValue = Object.entries(totals).filter(([, v]) => v).map(([c, v]) => v.toFixed(2) + (c ? ' ' + c : '')).join(' + ');
            data.containerNo = (contBy.get(String(j0.id)) || []).map(c => c.contNo || c.containerNo).filter(Boolean).join(', ');
            data.importer = data.autoField_4 || data.nameOfImporter || '';
            data.importerName = data.importer;
            data.igmNo = data.igmNo || data.igmNumber || '';
            data.origin = data.portOfOrigin || data.autoField_22 || data.countryOfOrigin || data.autoField_20 || '';
            data.destination = data.portCode || data.autoField_2 || '';
            if (data.assessableValue == null && data.totalAssessableValue != null) data.assessableValue = data.totalAssessableValue;
            if (data.dutyValue == null && data.totalDuty != null) data.dutyValue = data.totalDuty;
            data.invoiceCount = invs.length;
            if (data.beNo) {
                const fd = finalDocs.filter(d => d.beNo === data.beNo);
                data.hasFirstCopy = fd.some(d => d.docType === 'FIRST_COPY'); data.hasOocCopy = fd.some(d => d.docType === 'OOC_COPY'); data.hasGatepass = fd.some(d => d.docType === 'GATEPASS');
                data.finalDocs = fd.map(d => ({ docType: d.docType, fileUrl: d.fileUrl }));
            }
            return data;
        });
        // 10-Nov-2026: the docket of each job from Shipment Registration (made in EagleView with "Register Shipment", or
        // loaded from iCAFFE) - the job itself has a docket no only when it came from iCAFFE
        try {
            const nos = [...new Set(data.map(d => String(d.jobNo || '').trim().toUpperCase()).filter(Boolean))];
            const dk = new Map();
            for (const part of chunks(nos)) {
                const rows = await sequelize.query(`SELECT id, docketNo, division, upper(trim(ediJobNo)) k FROM Shipments WHERE upper(trim(ediJobNo)) IN (${part.map(() => '?').join(',')})
                    AND coalesce(stage, '') <> 'Cancelled' AND upper(coalesce(division, '')) LIKE '%I' ORDER BY id`, { replacements: part, type: sequelize.QueryTypes.SELECT });
                for (const r of rows) { if (!dk.has(r.k)) dk.set(r.k, []); dk.get(r.k).push(r); }
            }
            for (const d of data) {
                // the same job no can be on an Air and a Sea docket: the one of the job's mode first
                const all = dk.get(String(d.jobNo || '').trim().toUpperCase()) || [];
                const m0 = String(d.shipmentMode || '').toUpperCase()[0] || '';
                const r = all.find(x => String(x.division || '').toUpperCase()[0] === m0) || all[0];
                if (r) { d.docketNo = r.docketNo; d.docketDivision = r.division; d.docketId = r.id; }
                else if (d.docketNo) { const m = /^[A-Z]{3}\/([A-Z]{2})\//.exec(String(d.docketNo).toUpperCase()); if (m) d.docketDivision = m[1]; }
            }
        } catch (e) { /* no Shipments table yet */ }
        const total = (await sequelize.query(`SELECT count(*) n FROM ImportJobs j ${w.length ? 'WHERE ' + w.join(' AND ') : ''}`, { replacements: p, type: sequelize.QueryTypes.SELECT }))[0].n;
        res.json({ success: true, data, total, limit: lim });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/:id', async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const job = await ImportJob.findByPk(req.params.id, { transaction: t });
        if (!job) { await t.rollback(); return res.status(404).json({ success: false, error: 'Job not found' }); } // was returning with the transaction still open (locks SQLite)
        // 30-Oct-2026: a BE that reached ICEGATE is a customs record - it cannot be deleted from here
        if (FILED.has(String(job.icegateStatus || ''))) { await t.rollback(); return res.status(403).json({ success: false, error: `Job ${job.jobNo} was ${job.icegateStatus} on ICEGATE (${job.icegateUniqueId || ''}) and cannot be deleted.` }); }
        await ImportContainer.destroy({ where: { importJobId: job.id }, transaction: t });
        
        const existingInvoices = await ImportInvoice.findAll({ where: { importJobId: job.id }, transaction: t });
        const existingInvoiceIds = existingInvoices.map(inv => inv.id);
        if (existingInvoiceIds.length > 0) {
            if (ImportItem) await ImportItem.destroy({ where: { importInvoiceId: existingInvoiceIds }, transaction: t });
            await ImportInvoice.destroy({ where: { importJobId: job.id }, transaction: t });
        }
        await job.destroy({ transaction: t });
        await t.commit();
        res.json({ success: true, message: 'Job deleted successfully' });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/import-jobs/:id/logs - Log column of the job list (job created/updated + timeline remarks). 28-Oct-2026
router.get('/:id/logs', async (req, res) => {
    try {
        const job = await ImportJob.findByPk(req.params.id, { attributes: ['id', 'jobNo', 'createdAt', 'updatedAt', 'icegateStatus', 'icegateUniqueId', 'createdBy', 'updatedBy'] });
        if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
        const logs = [{ time: job.createdAt, action: 'JOB_CREATED', user: job.createdBy || '', details: 'Job ' + (job.jobNo || job.id) + ' created' }];
        if (job.updatedAt && String(job.updatedAt) !== String(job.createdAt)) logs.push({ time: job.updatedAt, action: 'JOB_UPDATED', user: job.updatedBy || '', details: 'Last saved' });
        if (job.icegateStatus) logs.push({ time: job.updatedAt, action: 'ICEGATE_' + job.icegateStatus, user: '', details: job.icegateUniqueId ? 'Unique ID ' + job.icegateUniqueId : '' });
        try {
            const JobTimeline = require('../models/JobTimeline');
            for (const tl of await JobTimeline.findAll({ where: { module: 'IMPORT', jobId: String(job.id) }, order: [['createdAt', 'ASC']] }))
                logs.push({ time: tl.createdAt, action: tl.eventType || 'REMARK', user: tl.author || '', details: tl.message || '' });
        } catch (e) { /* timeline table not available */ }
        logs.sort((a, b) => new Date(b.time) - new Date(a.time));
        res.json(logs);
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// PUT /api/import-jobs/:id/dsr { field, value } - inline edit in the DSR grid of the job list. 28-Oct-2026
router.put('/:id/dsr', async (req, res) => {
    try {
        const { field, value } = req.body || {};
        if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(String(field || '')) || ['id', 'jobNo', 'createdAt', 'updatedAt', 'extendedData'].includes(field))
            return res.status(400).json({ success: false, message: 'This field cannot be edited here' });
        const job = await ImportJob.findByPk(req.params.id);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
        // 30-Oct-2026: only a known form field or an existing column can be edited here (no new columns from the grid)
        if (!ImportJob.rawAttributes[field] && !(require('../utils/formFieldColumns').ImportJob || []).includes(field)) return res.status(400).json({ success: false, message: `"${field}" is not a job field` });
        if (/Date$/.test(field) && String(value || '').trim() && require('../utils/importJobValidate').ymd(value) === null) return res.status(400).json({ success: false, message: `"${value}" is not a date` });
        await ensureFieldColumns(ImportJob, { [field]: value });
        await job.update({ [field]: value === undefined ? null : value, updatedBy: (req.user && (req.user.username || req.user.email)) || job.updatedBy });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/search', async (req, res) => {
    try {
        const q = req.query.q || '';
        const { Op } = require('sequelize');
        // ImportJob has no importerName/igmNo columns: match importer via Party name, IGM via igmNumber
        const Party = require('../models/Party');
        const parties = q ? await Party.findAll({ where: { name: { [Op.like]: `%${q}%` } }, attributes: ['id'], limit: 200 }) : [];
        const or = [
            { jobNo: { [Op.like]: `%${q}%` } },
            { mawbNo: { [Op.like]: `%${q}%` } },
            { hawbNo: { [Op.like]: `%${q}%` } },
            { igmNumber: { [Op.like]: `%${q}%` } },
            { iecCode: { [Op.like]: `%${q}%` } }
        ];
        if (parties.length) or.push({ importerPartyId: { [Op.in]: parties.map(p => String(p.id)) } });
        const jobs = await ImportJob.findAll({
            where: { [Op.or]: or, jobNo: { [Op.notLike]: 'AMD/%' } }, // 10-Nov-2026: not the amended copies
            include: [
                { model: ImportInvoice, as: 'invoices', include: [{ model: ImportItem, as: 'items' }] },
                { model: ImportContainer, as: 'containers' }
            ],
            limit: 20,
            order: [['id', 'DESC'], ...CHILD_ORDER]
        });
        const processedJobs = jobs.map(job => unpackExtendedData(job));
        res.json({ success: true, data: processedJobs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/import-jobs/sample/:kind (json | xml | flat) - sample BE files for "Read XML" / "Read Flat File" of the job
// list, made with dummy data by the same builder that makes the ICEGATE JSON, so a sample read back gives a complete job.
// 28-Oct-2026 (the old example in the import window was a made-up "BE|...|" pipe format the reader never accepted).
function sampleBeJob() {
  const jobData = { jobNo: 'SAMPLE/0001/26', jobDate: new Date().toISOString().slice(0, 10), autoField_1: 'INDEL4', portCode: 'INDEL4', autoField_2: 'INDEL4', locationName: 'ACC NEW DELHI',
    autoField_3: 'CHA0000000001', autoField_4: 'SAMPLE IMPORTER PVT LTD', autoField_5: '0500000000', autoField_48: '1', autoField_6: 'PLOT 1, SAMPLE ROAD', autoField_7: 'INDUSTRIAL AREA',
    autoField_8: 'NEW DELHI', autoField_9: 'DELHI', autoField_10: '110001', autoField_11: 'DELHI', autoField_12: '07', autoField_13: '07AAAAA0000A1Z5', autoField_50: 'GSTIN',
    autoField_20: 'CN', autoField_21: 'CN', autoField_22: 'CNSHA', importerType: 'Private', paymentMethodCode: 'T', kachchaBE: 'N', greenChannel: 'N',
    _igmRows: [{ igmNumber: '1234567', igmDate: '2026-10-20', inwardDate: '2026-10-21', mawbNo: '12345678901', mawbDate: '2026-10-18', hawbNo: 'HAWB001', hawbDate: '2026-10-18', totalPkg: '10', pkgCode: 'CTN', grossWt: '250.5', wtUnit: 'KGS', marks1: 'AS ADDRESSED' }],
    _exchangeRates: [{ currencyCode: 'USD', rate: 88.5, unitInRs: 1 }] };
  const invoices = [{ invNo: 'SAMPLE-INV-001', invDate: '2026-10-15', currency: 'USD', value: '1500', terms: 'FOB', freightValue: '100', freightCurrency: 'USD', insuranceRate: '1.125',
    supplierName: 'SAMPLE SUPPLIER CO LTD', supplierAddress1: 'NO 1 SAMPLE STREET', supplierCountry: 'CN', natureOfTransaction: 'S', paymentTerms: 'OTH', valuationMethod: 'RULE4 TRANSACTION VALUE' }];
  const items = [
    { invSrNo: '1', itemSrNo: '1', ritc: '85171300', cth: '85171300', ceth: 'NOEXCISE', desc: 'MOBILE PHONE MODEL X', genericDesc: 'MOBILE PHONE', qty: '10', uqc: 'NOS', unit: 'NOS', price: '100', value: '1000',
      countryOfOrigin: 'CN', manufacturer: 'SAMPLE MANUFACTURER', brandName: 'BRAND', model: 'X-1', endUse: 'GNX200', bcdRate: '20', swsRate: '10', igstData: { notnNo: '009/2025', srNo: 'II506', rate: '18' } },
    { invSrNo: '1', itemSrNo: '2', ritc: '85176290', cth: '85176290', ceth: 'NOEXCISE', desc: 'WIFI ROUTER', genericDesc: 'ROUTER', qty: '5', uqc: 'NOS', unit: 'NOS', price: '100', value: '500',
      countryOfOrigin: 'CN', manufacturer: 'SAMPLE MANUFACTURER', brandName: 'BRAND', model: 'R-1', endUse: 'GNX200', bcdRate: '20', swsRate: '10', igstData: { notnNo: '009/2025', srNo: 'II506', rate: '18' } }];
  return { jobData: { ...jobData, invoices }, items, invoices };
}
const xmlEsc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function toXml(name, v, ind = '') {
  if (Array.isArray(v)) return v.map(x => toXml(name, x, ind)).join('');
  if (v && typeof v === 'object') return `${ind}<${name}>\n${Object.entries(v).map(([k, x]) => toXml(k, x, ind + '  ')).join('')}${ind}</${name}>\n`;
  return `${ind}<${name}>${xmlEsc(v)}</${name}>\n`;
}
// ICES 1.5 BE flat file - the real layout (utils/beFlatFile.js, 29-Oct-2026); the old one was a guess
const toFlat = (cj) => require('../utils/beFlatFile').writeBeFlat(cj);
router.get('/sample/:kind', async (req, res) => {
  try {
    const { buildBE_CACHI01 } = require('../utils/IcegateJsonBuilder');
    const s = sampleBeJob();
    const cj = await buildBE_CACHI01(s.jobData, s.items, s.invoices, { beType: 'H', transportMode: 'A' });
    const kind = String(req.params.kind || '').toLowerCase();
    if (kind === 'json') { res.attachment('Sample_BE_CACHI01.json'); return res.type('application/json').send(JSON.stringify(cj, null, 2)); }
    if (kind === 'xml') { res.attachment('Sample_BE_CACHI01.xml'); return res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n' + toXml('CACHI01', cj)); }
    if (kind === 'flat') { res.attachment('SAMPLE01.be'); return res.type('text/plain').send(toFlat(cj)); }
    res.status(400).json({ success: false, error: 'Sample kind must be json, xml or flat' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// 16-Nov-2026: importer PINs known for this IEC + branch (Party master branches, other BE jobs) - the Job Header shows
// them under an empty PIN box (537 jobs loaded from iCAFFE came without a PIN). GET ?iec=&branchSrNo=&address1=&jobId=
router.get('/pin-suggest', async (req, res) => {
    try {
        const q = (sql, p) => sequelize.query(sql, { replacements: p, type: sequelize.QueryTypes.SELECT });
        const list = await require('../utils/pinSuggest').suggest(q, { iec: req.query.iec, branchSrNo: req.query.branchSrNo, address1: req.query.address1, jobId: req.query.jobId, state: req.query.state });
        res.json({ success: true, data: list.slice(0, 6) });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Re-export (Export > Items > Re-Export window, "Get data"): items of our own import job with this BE No. 29-Oct-2026
// The BE No is kept in a column on some installs and in extendedData on others, so both are searched.
router.get('/by-be', async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const beNo = String(req.query.beNo || '').replace(/\D/g, '');
        if (!beNo || beNo.length > 10) return res.status(400).json({ success: false, error: 'BE No must be numeric' });
        const inc = [{ model: ImportInvoice, as: 'invoices', include: [{ model: ImportItem, as: 'items' }] }];
        let rows = [];
        try { rows = await ImportJob.findAll({ where: { beNo }, include: inc, limit: 5 }); } catch (e) { rows = []; }
        if (!rows.length) rows = await ImportJob.findAll({ where: { extendedData: { [Op.like]: `%${beNo}%` } }, include: inc, limit: 20, order: [['id', 'DESC']] }).catch(() => []);
        const ymd = (v) => { const s = String(v || '').trim(); let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`; m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
        const num = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(x) ? x : 0; };
        const want = ymd(req.query.beDate);
        const jobs = rows.map(unpackExtendedData).filter(j => !/^AMD\//.test(String(j.jobNo || ''))).filter(j => String(j.beNo || j.beNumber || '').replace(/\D/g, '') === beNo)
            .filter(j => !want || !ymd(j.beDate) || ymd(j.beDate) === want)
            .map(j => ({
                jobId: j.id, jobNo: j.jobNo, beNo, beDate: ymd(j.beDate), beSite: String(j.portCode || j.customHouseCode || '').toUpperCase().slice(0, 6),
                dutyPaidDate: ymd(j.dutyPaidDate || j.challanDate || j.dutyPaymentDate),
                items: (j.invoices || []).flatMap((inv, k) => (inv.items || []).map((it, n) => ({
                    invSr: num(it.invSrNo) || k + 1, itemSr: num(it.itemSrNo || it.srNo) || n + 1,
                    desc: String(it.desc || it.description || '').slice(0, 120), qty: num(it.qty), uqc: String(it.uqc || it.unit || '').toUpperCase().slice(0, 3),
                    // 30-Oct-2026: assessableValueInr is the INR assessable value; "assessableValue" on a screen item is the invoice-currency item total
                    assessableValue: num(it.assessableValueInr || it.assessValue || it.assValue),
                    dutyPaid: num(it.totalDuty || it.dutyAmount) || ['bcdAmount', 'swsAmount', 'igstAmount', 'healthCessAmount', 'cvdAmount', 'adlCvdAmount', 'saptaAmount'].reduce((a, f) => a + num(it[f]), 0),
                }))),
            }));
        res.json({ success: true, data: jobs });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// 22-Nov-2026: "what did we use last time" for an item being entered. Looks in the saved import items for the same
// product - first of this importer (IEC): same model no, then same description, then a description that starts the same
// (the text before the first bracket, often the part number); when the importer never had it, the same model /
// description of other clients. Rows are grouped by the classification used (RITC + CTH + BCD + IGST), newest first,
// so a product filed under two headings shows both with how often and when. Read only.
router.get('/item-history', async (req, res) => {
    try {
        const { sequelize } = require('../db'); const { QueryTypes } = require('sequelize');
        const up = (v) => String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim().toUpperCase();
        const iec = up(req.query.iec); let model = up(req.query.model); const desc = up(req.query.desc); const exclude = parseInt(req.query.excludeJobId, 10) || 0;
        if (model.length < 3 || /^(NA|N\.A\.?|N\/A|NIL|NONE|NO MODEL|NOT APPLICABLE|-+|\.+)$/.test(model)) model = '';
        const d = desc.length >= 4 ? desc : '';
        if (!model && !d) return res.json({ success: true, options: [] });
        const itemCols = new Set((await sequelize.query('PRAGMA table_info(ImportItems)', { type: QueryTypes.SELECT })).map(c => c.name));
        const jobCols = new Set((await sequelize.query('PRAGMA table_info(ImportJobs)', { type: QueryTypes.SELECT })).map(c => c.name));
        const jx = (a, n) => `CASE WHEN json_valid(${a}.extendedData) THEN json_extract(${a}.extendedData, '$.${n}') END`;
        const col = (a, cols, n) => (cols.has(n) ? `COALESCE(NULLIF(TRIM(${a}.${n}), ''), ${jx(a, n)})` : jx(a, n));
        const I = (n) => col('it', itemCols, n), J = (n) => col('j', jobCols, n);
        const DESC = `UPPER(TRIM(COALESCE(${I('desc')}, ${I('productDescription')}, '')))`, MODEL = `UPPER(TRIM(COALESCE(${I('model')}, '')))`;
        const IEC = `UPPER(TRIM(COALESCE(${J('iecCode')}, ${J('autoField_5')}, '')))`;
        const FIELDS = ['ritc', 'hsCode', 'cth', 'ceth', 'uqc', 'unit', 'bcdRate', 'bcdNotificationNo', 'bcdSrNo', 'bcdFlag', 'swsRate', 'swsNotificationNo', 'swsSrNo', 'swsFlag',
            'healthCessRate', 'healthCessNotificationNo', 'healthCessSrNo', 'brandName', 'model', 'endUse', 'countryOfOrigin', 'genericDesc', 'manufacturer', 'price', 'unitPrice', 'currency', 'igstData', 'desc', 'productDescription'];
        const SELECT = `SELECT it.id, j.id AS jobId, j.jobNo, ${J('jobDate')} AS jobDate, ${J('beNo')} AS jobBeNo, COALESCE(${J('nameOfImporter')}, ${J('autoField_4')}) AS importer, ${FIELDS.map(n => I(n) + ' AS ' + n).join(', ')}
            FROM ImportItems it JOIN ImportInvoices inv ON inv.id = it.importInvoiceId JOIN ImportJobs j ON j.id = inv.importJobId`;
        const run = (where, rep) => sequelize.query(`${SELECT} WHERE ${where}${exclude ? ' AND j.id <> ' + exclude : ''} ORDER BY it.id DESC LIMIT 400`, { replacements: rep, type: QueryTypes.SELECT });
        const digits = (r) => String(r.ritc || r.hsCode || '').replace(/\D/g, '');
        const tag = (rows, scope, by) => rows.map(r => ({ ...r, _scope: scope, _by: by }));
        // a "model" that sits on many different headings is the model of the finished product the parts are for (every
        // part of one phone carries the phone's model) - it does not identify the item, so such a match is not offered
        const modelOk = (rows) => new Set(rows.map(digits).filter(x => x.length >= 4)).size <= 3;
        const head = d ? d.split('(')[0].trim() : '';
        const like = head.length >= 6 && head.length < d.length ? head.replace(/[\\%_]/g, '\\$&') + '%' : '';
        let rows = [];
        if (iec) {
            if (d) rows = tag(await run(`${IEC} = ? AND ${DESC} = ?`, [iec, d]), 'importer', 'description');
            if (!rows.length && like) rows = tag(await run(`${IEC} = ? AND ${DESC} LIKE ? ESCAPE '\\'`, [iec, like]), 'importer', 'similar'); // starts the same: the text before the first bracket
            if (!rows.length && model) { const m = await run(`${IEC} = ? AND ${MODEL} = ?`, [iec, model]); if (modelOk(m)) rows = tag(m, 'importer', 'model'); }
        }
        if (!rows.length && d) rows = tag(await run(`${DESC} = ?` + (iec ? ` AND ${IEC} <> ?` : ''), iec ? [d, iec] : [d]), 'others', 'description');
        if (!rows.length && model) { const m = await run(`${MODEL} = ?` + (iec ? ` AND ${IEC} <> ?` : ''), iec ? [model, iec] : [model]); if (modelOk(m)) rows = tag(m, 'others', 'model'); }
        const groups = new Map();
        for (const r of rows) {
            const ritc = digits(r); if (ritc.length < 4) continue;
            let ig = r.igstData; if (typeof ig === 'string') { try { ig = JSON.parse(ig); } catch (e) { ig = null; } } if (!ig || typeof ig !== 'object') ig = null;
            const key = ritc; // one line per heading used; the newest entry gives the values
            let g = groups.get(key);
            if (!g) { // the newest row of the group gives the values
                g = { scope: r._scope, matchedBy: r._by, count: 0, jobs: new Set(), lastJobNo: r.jobNo, lastJobId: r.jobId, lastJobDate: r.jobDate, lastBeNo: r.jobBeNo, importer: r._scope === 'others' ? r.importer : undefined,
                    description: r.desc || r.productDescription || '',
                    fields: { ritc, cth: r.cth || '', ceth: r.ceth || '', uqc: r.uqc || r.unit || '', bcdRate: r.bcdRate, bcdNotificationNo: r.bcdNotificationNo || '', bcdSrNo: r.bcdSrNo || '', bcdFlag: r.bcdFlag || '',
                        swsRate: r.swsRate, swsNotificationNo: r.swsNotificationNo || '', swsSrNo: r.swsSrNo || '', swsFlag: r.swsFlag || '', healthCessRate: r.healthCessRate, healthCessNotificationNo: r.healthCessNotificationNo || '', healthCessSrNo: r.healthCessSrNo || '',
                        igstData: ig ? { notnNo: ig.notnNo || '', srNo: ig.srNo || '', rate: ig.rate === undefined || ig.rate === null ? '' : String(ig.rate), flag: ig.flag || 'A', amount: '' } : null,
                        // the product's own particulars: only from this importer's earlier entry
                        ...(r._scope === 'importer' ? { brandName: r.brandName || '', model: r.model || '', endUse: r.endUse || '', countryOfOrigin: r.countryOfOrigin || '', genericDesc: r.genericDesc || '', manufacturer: r.manufacturer || '' } : {}) },
                    lastPrice: r.price || r.unitPrice || '', lastCurrency: r.currency || '' };
                groups.set(key, g);
            }
            else { // an older entry of the same heading fills what the newest one did not carry (rates were not always kept)
                const F = g.fields; const blank = (v) => v === null || v === undefined || String(v).trim() === '';
                for (const k of ['bcdRate', 'bcdNotificationNo', 'bcdSrNo', 'swsRate', 'ceth', 'cth', 'uqc']) if (blank(F[k]) && !blank(r[k])) F[k] = r[k];
                if ((!F.igstData || blank(F.igstData.rate)) && ig && !blank(ig.rate)) F.igstData = { notnNo: ig.notnNo || '', srNo: ig.srNo || '', rate: String(ig.rate), flag: ig.flag || 'A', amount: '' };
            }
            g.count++; g.jobs.add(r.jobId);
        }
        const options = [...groups.values()].slice(0, 5).map(g => ({ ...g, jobs: g.jobs.size }));
        res.json({ success: true, options });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/:id', async (req, res) => {
    try {
        const job = await ImportJob.findByPk(req.params.id, {
            include: [
                { model: ImportInvoice, as: 'invoices', include: [{ model: ImportItem, as: 'items' }] },
                { model: ImportContainer, as: 'containers' }
            ],
            order: CHILD_ORDER
        });
        if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
        const data = unpackExtendedData(job);
        data.hasFiledJson = !!data.filedJson; delete data.filedJson; // the filed copy has its own route (/:id/filed-json)
        res.json({ success: true, data }); 
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/by-jobno/:jobNo', async (req, res) => {
    try {
        const job = await ImportJob.findOne({
            where: { jobNo: req.params.jobNo },
            include: [{ model: ImportInvoice, as: 'invoices', include: [{ model: ImportItem, as: 'items' }] }],
            order: CHILD_ORDER.slice(0, 2)
        });
        if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
        res.json({ success: true, data: unpackExtendedData(job) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const { sequelize } = require('../db');
module.exports = router;
