// State and logic
// Split out of InvoiceGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useGridFeatures } from '../../../../hooks/useGridFeatures';
import { useJobContext } from '../../JobContext';
import { initialInvoices } from './helpers';
import { downloadInvoiceSample, readJobWorkbook, mergeJobWorkbook, fillRatesFromTariff, recalcDuty } from '../jobExcel';
import { computeItemDuty, PER_100_CURRENCIES } from '../ItemGridTabParts/helpers';
import askConfirm, { askText } from '../../../common/askConfirm'; // EagleView windows in place of prompt() / confirm(), 20-Nov-2026

export default function useInvoiceGridTab(ctx) {
  const { onSave } = ctx;
  const fileInputRefInv = useRef(null);

  const { jobData, setJobData, masters, items, setItems, esanchitDocs, setEsanchitDocs, registerPendingEdits } = useJobContext();
  const {
    data: invoices,
    setData: setInvoices,
    selectedRowId,
    setSelectedRowId,
    checkedIds,
    toggleCheck,
    checkAll,
    applyBulkUpdate,
    duplicateRow,
    deleteSelected
  } = useGridFeatures({
    initialData: jobData.invoices && jobData.invoices.length > 0 ? jobData.invoices : initialInvoices,
    // 30-Oct-2026: no localStorage draft any more (stale ids after a save made Modify a no-op)
    // Paste from Excel (Ctrl+V on the grid): Invoice No | Date | Value | Currency | Terms | Freight | Insurance | Misc.
    // Only what is pasted is kept - no "0.00 / USD / FOB" fill-ins - and a number already on the job is refused.
    onPasteRowMapping: (cells) => {
      const no = String(cells[0] || '').trim(); if (!no) return null;
      const d = String(cells[1] || '').trim(); const m = d.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
      const o = { invNo: no, invDate: m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : d, value: String(cells[2] || '').replace(/,/g, ''),
        currency: String(cells[3] || '').toUpperCase(), terms: String(cells[4] || '').toUpperCase(), freightValue: String(cells[5] || '').replace(/,/g, ''),
        insuranceValue: String(cells[6] || '').replace(/,/g, ''), miscCharges: String(cells[7] || '').replace(/,/g, '') };
      Object.keys(o).forEach(k => { if (o[k] === '') delete o[k]; });
      return o;
    },
    onPasteRows: (rows, current) => {
      const key = (v) => String(v || '').replace(/\s+/g, '').toUpperCase();
      const have = new Set(current.map(iv => key(iv.invNo || iv.invoiceNo)));
      const out = [], dup = [];
      rows.forEach(r => { const k = key(r.invNo); if (have.has(k)) dup.push(r.invNo); else { have.add(k); out.push(r); } });
      if (dup.length) toast.error(`Not pasted (already on this job): ${dup.join(', ')}`);
      if (out.length) { toast.success(`${out.length} invoice(s) pasted - check them and Save the job`); if (autoRatesRef.current) setTimeout(() => autoRatesRef.current([...current, ...out]), 0); }
      return out;
    },
    onDuplicate: () => handleDuplicateInvoiceRef.current && handleDuplicateInvoiceRef.current()
  });
  const handleDuplicateInvoiceRef = React.useRef(null);
  const autoRatesRef = React.useRef(null); // exchange-rate rows for pasted currencies too (30-Oct-2026)

  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [activeTerm, setActiveTerm] = useState('');
  const [isMiscIncludedModalOpen, setIsMiscIncludedModalOpen] = useState(false);
  const [isMiscNotIncludedModalOpen, setIsMiscNotIncludedModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isSvbModalOpen, setIsSvbModalOpen] = useState(false);
  const [isOtherInfoModalOpen, setIsOtherInfoModalOpen] = useState(false);
  const [isConditionsModalOpen, setIsConditionsModalOpen] = useState(false);
  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
  const [isBrokerModalOpen, setIsBrokerModalOpen] = useState(false);
  const [showThirdPartyDetails, setShowThirdPartyDetails] = useState(false);
  const [showAeoDetails, setShowAeoDetails] = useState(false);
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [invoiceFormData, setInvoiceFormData] = useState({});

  const handleInvoiceFieldChange = (e) => {
    if (e?.target?.name) {
      setInvoiceFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    }
  };

  // Sync show/hide sections from invoiceFormData (when row is selected or flag typed)
  React.useEffect(() => {
    setShowThirdPartyDetails((invoiceFormData.thirdPartyFlag || '').toUpperCase() === 'Y');
    setShowAeoDetails((invoiceFormData.aeoFlag || '').toUpperCase() === 'Y');
    setShowAdditionalDetails((invoiceFormData.additionalDetailsFlag || '').toUpperCase() === 'Y');
  }, [invoiceFormData.thirdPartyFlag, invoiceFormData.aeoFlag, invoiceFormData.additionalDetailsFlag]);


  const [tempData, setTempData] = useState({});

  // seller / broker / other info / conditions popups write straight into the invoice form (tempData was never
  // cleared, so its values went into the next invoice you modified). 28-Oct-2026
  const handleTempChange = (e) => {
    setInvoiceFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleTermsChange = (e) => {
    const val = e.target.value.toUpperCase();
    // 30-Oct-2026: the freight / insurance boxes are on the form now (Freight, Insurance & Other Charges), so typing the
    // terms no longer throws a popup over the screen - only the term it applies to is remembered, and the popup stays
    // reachable from the "Open" button next to the Terms box.
    if (['FOB', 'CF', 'CI', 'CIF'].includes(val)) setActiveTerm(val);
    // 30-Oct-2026: CIF / CF already include the freight, CIF / CI the insurance - values typed under an earlier term
    // were kept and filed (ICES rejects CIF with freight); they are cleared here, after a confirm
    const f = { ...invoiceFormData, ...tempData };
    const has = (k) => String(f[k] ?? '').trim() !== '' && parseFloat(String(f[k]).replace(/,/g, '')) !== 0;
    const clear = {};
    if (['CIF', 'CF'].includes(val) && (has('freightValue') || has('freightRate'))) { clear.freightValue = ''; clear.freightRate = ''; }
    if (['CIF', 'CI'].includes(val) && (has('insuranceValue') || has('insuranceRate'))) { clear.insuranceValue = ''; clear.insuranceRate = ''; }
    if (Object.keys(clear).length) {
      askConfirm({ title: 'Clear freight / insurance?', message: `Terms ${val} already include ${Object.keys(clear).some(k => k.startsWith('freight')) ? 'freight' : ''}${Object.keys(clear).length === 4 ? ' and ' : ''}${Object.keys(clear).some(k => k.startsWith('insurance')) ? 'insurance' : ''}.`, note: 'ICES refuses these terms with a freight / insurance amount.', okLabel: 'Clear the boxes', cancelLabel: 'Keep them' }).then(go => { if (go) { setInvoiceFormData(prev => ({ ...prev, ...clear })); setTempData(prev => ({ ...prev, ...clear })); } });
    }
  };

  const handleMiscIncludedChange = (e) => {
    if (e.target.value.toUpperCase() === 'Y') {
      setIsMiscIncludedModalOpen(true);
    }
  };

  const handleMiscNotIncludedChange = (e) => {
    if (e.target.value.toUpperCase() === 'Y') {
      setIsMiscNotIncludedModalOpen(true);
    }
  };

  const handleSvbChange = (e) => {
    if (e.target.value.toUpperCase() === 'Y') {
      setIsSvbModalOpen(true);
    }
  };

  const handleOtherInfoChange = (e) => {
    if (e.target.value.toUpperCase() === 'Y') {
      setIsOtherInfoModalOpen(true);
    }
  };

  const handleConditionsChange = (e) => {
    if (e.target.value.toUpperCase() === 'Y') {
      setIsConditionsModalOpen(true);
    }
  };

  const handleSupplierSellerChange = (e) => {  // 'N' = supplier and seller differ -> seller details
    if (e.target.value.toUpperCase() === 'N') {
      setIsSellerModalOpen(true);
    }
  };

  const handleBrokerChange = (e) => {
    if (e.target.value.toUpperCase() === 'Y') {
      setIsBrokerModalOpen(true);
    }
  };

  const handleThirdPartyChange = (e) => {
    setShowThirdPartyDetails(e.target.value.toUpperCase() === 'Y');
  };

  const handleAeoChange = (e) => {
    setShowAeoDetails(e.target.value.toUpperCase() === 'Y');
  };

  const handleAdditionalDetailsChange = (e) => {
    setShowAdditionalDetails(e.target.value.toUpperCase() === 'Y');
  };

  
  const syncRef = React.useRef(invoices);
  
  // Sync DOWN from global to local (job load / save result: rows come back with new ids, selection follows the Sr No)
  React.useEffect(() => {
    if (jobData.invoices && jobData.invoices !== syncRef.current) {
      const prevIdx = invoices.findIndex(iv => iv.id === selectedRowId);
      setInvoices(jobData.invoices);
      syncRef.current = jobData.invoices;
      if (prevIdx !== -1) setSelectedRowId(jobData.invoices[prevIdx] ? jobData.invoices[prevIdx].id : null);
    }
  }, [jobData.invoices, setInvoices]); // eslint-disable-line

  // Sync UP from local to global
  React.useEffect(() => {
    if (invoices !== syncRef.current) {
      setJobData(prev => ({ ...prev, invoices: invoices }));
      syncRef.current = invoices;
    }
  }, [invoices, setJobData]);

  const selectedInvoice = invoices.find(inv => inv.id === selectedRowId) || null; // no silent fallback to Sr No 1
  React.useEffect(() => {
    if (selectedInvoice && Object.keys(selectedInvoice).length > 0) {
      setInvoiceFormData(selectedInvoice);
    } else {
      setInvoiceFormData({});
    }
    setTempData({});
  }, [selectedRowId, invoices.length]);


  // ---------------------------------------------------------------------------------------------------------
  // Invoices are matched by INVOICE NO. Items point to their invoice by position (Inv Sr No), so whenever the
  // invoice list changes (delete, duplicate, arrange) the items are moved / renumbered with it. 28-Oct-2026
  // ---------------------------------------------------------------------------------------------------------
  const norm = (v) => String(v ?? '').trim().toUpperCase();
  const invNoOf = (inv) => String(inv?.invNo || inv?.invoiceNo || '').trim();
  // duplicate check ignores case and spaces ("INV 1" = "inv1"); the server refuses a duplicate too (30-Oct-2026)
  const findByNo = (list, no, exceptId) => list.findIndex(iv => norm(invNoOf(iv)).replace(/\s+/g, '') === norm(no).replace(/\s+/g, '') && iv.id !== exceptId);
  const STRIP = ['invoiceSerialNumber', 'invoiceSrNo', 'items', 'importJobId', 'createdAt', 'updatedAt'];
  const clean = (o) => {
    const c = { ...o }; STRIP.forEach(k => delete c[k]);
    // 30-Oct-2026: the currency boxes show the invoice currency as their default but it was never saved - the row
    // then had an amount without a currency. Saved now (an amount without a currency is not a complete charge).
    const cur = norm(c.currency || c.invoiceCurrency);
    for (const [amt, k] of [['freightValue', 'freightCurrency'], ['insuranceValue', 'insuranceCurrency'], ['miscCharges', 'miscCurrency'], ['loadingAmount', 'loadingCurrency'], ['agencyCommAmount', 'agencyCommCurrency'], ['discountAmount', 'discountCurrency'], ['hssLoadAmount', 'hssCurrency']])
      if (parseFloat(c[amt]) > 0 && !norm(c[k]) && cur) c[k] = cur;
    return c;
  };

  // move items after the invoice list changed: old position -> invoice id -> new position
  const remapItems = (oldList, newList, { dropMissing = true } = {}) => {
    const all = items || [];
    if (!all.length) return all;
    const out = [];
    all.forEach(it => {
      const oldIdx = (parseInt(it.invSrNo || it.invoiceSrNo, 10) || 1) - 1;
      const inv = oldList[oldIdx];
      const newIdx = inv ? newList.findIndex(x => x.id === inv.id) : -1;
      if (newIdx === -1) { if (!dropMissing) out.push(it); return; }
      out.push({ ...it, invSrNo: String(newIdx + 1), invNo: invNoOf(newList[newIdx]) });
    });
    return out;
  };

  // currencies used on an invoice that have no exchange-rate row: take the import rate from the Currency master
  const PER100 = PER_100_CURRENCIES; // one list for the whole job: CBIC Schedule II (per 100 units)
  const ratesList = () => { let r = jobData._exchangeRates; if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = []; } } return Array.isArray(r) ? r : []; };
  // 29-Oct-2026: the rate's date is the CBIC notification's effective date held in the Currency master (a filed BE
  // carried 20261016 for notification 29/2026), not the day the job was keyed; today only when the master has none
  // 18-Nov-2026: the day in India - the master's date comes back as "2026-11-17T18:30:00.000Z" (18-Nov midnight IST) and
  // cutting it at 10 characters filed CBIC 31/2026 (effective 18-Nov) as 17-Nov; toISOString() for today was yesterday before 5:30 am
  const ymdLocal = (v) => { if (!v) return ''; const s = String(v).trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d = v instanceof Date ? v : new Date(s); if (isNaN(d)) return ''; const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  const masterRateDate = (m) => { const s = m && m.effectiveDate ? ymdLocal(m.effectiveDate) : ''; return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ymdLocal(new Date()); };
  // 18-Nov-2026: the CBIC rates IN FORCE ON THE JOB DATE (history of notifications, GET /api/masters/currencies/in-force)
  // - the Currency master holds today's rates only (and once held the next day's), a BE takes those of its own date.
  // No answer / no history: the Currency master as before.
  const [rateBook, setRateBook] = React.useState(null);
  // 20-Nov-2026: a BE that already has its BE date (entered after filing, or a BE filed earlier keyed in now) takes the
  // rates in force on that date - BE 5098978 of 16-11-2026 keyed in on 20-11 took 20-11's EUR 104.25 instead of 108.30.
  // 20-Nov-2026: with no BE date, the rates of today - the day the BE is filed (was the job date: iCAFFE 7675 of job date
  // 16-10 was filed on 16-11 with 16-11's rate). The label reads "on the BE date 16-11-2026" / "today (20-11-2026)".
  const rateDay = ymdLocal(jobData.beDate) || ymdLocal(new Date());
  const rateDayLabel = (ymdLocal(jobData.beDate) ? 'on the BE date ' : 'today (') + rateDay.split('-').reverse().join('-') + (ymdLocal(jobData.beDate) ? '' : ')');
  React.useEffect(() => {
    let live = true;
    fetch('/api/masters/currencies/in-force?date=' + encodeURIComponent(rateDay)).then(r => (r.ok ? r.json() : null))
      .then(d => { if (live && d && d.success && Array.isArray(d.rates) && d.rates.length) setRateBook({ day: rateDay, source: d.source, rates: d.rates }); })
      .catch(() => {});
    return () => { live = false; };
  }, [rateDay]);
  const masterFor = (c) => (rateBook && rateBook.day === rateDay && rateBook.rates.find(x => norm(x.currencyCode) === c)) || (masters.currencies || []).find(x => norm(x.currencyCode) === c);
  const curOf = (inv) => [inv.currency || inv.invoiceCurrency, inv.freightCurrency, inv.insuranceCurrency, inv.miscCurrency, inv.loadingCurrency, inv.agencyCommCurrency].map(norm).filter(c => c && c !== 'INR');
  const autoRates = (list) => {
    const have = new Set(ratesList().map(r => norm(r.currencyCode)));
    const add = [];
    [...new Set(list.flatMap(curOf))].forEach(c => {
      if (have.has(c)) return;
      const m = masterFor(c);
      const rate = m && parseFloat(m.importRate);
      if (rate) { const per = PER100.includes(c) ? 100 : 1; add.push({ currencyCode: c, rate: +(rate * per).toFixed(4), unitInRs: per, standardCurrency: 'Y', effectiveDate: masterRateDate(m), source: (m.notificationNo ? m.notificationNo + ', ' : '') + 'in force ' + rateDayLabel }); }
    });
    if (add.length) {
      setJobData(prev => ({ ...prev, _exchangeRates: [...ratesList(), ...add] }));
      toast(`Exchange rate in force ${rateDayLabel}: ${add.map(a => a.currencyCode + ' ' + a.rate + (a.unitInRs !== 1 ? '/' + a.unitInRs : '')).join(', ')} - check with "Update Exchange Rate"`, { duration: 6000 });
    }
    const missing = [...new Set(list.flatMap(curOf))].filter(c => !have.has(c) && !add.some(a => a.currencyCode === c));
    if (missing.length) toast.error(`No exchange rate for ${missing.join(', ')} - use "Update Exchange Rate"`);
    return [...ratesList(), ...add]; // the rows now on the job (the Excel import computes duty with them before the state settles)
  };

  autoRatesRef.current = autoRates;
  // Cumulative freight / insurance / misc (30-Oct-2026): the job-level amounts typed in the toolbar are split over the
  // invoices in proportion to their invoice value and written into each invoice's own boxes (visible, editable, and
  // the same figures the duty estimate and the ICEGATE file use). The old checkbox / box were saved and never used.
  const handleApplyCumulative = async () => {
    const amt = (k) => parseFloat(String(jobData[k] ?? '').replace(/,/g, '')) || 0;
    const cum = { freightValue: amt('cumulativeFreight'), insuranceValue: amt('cumulativeInsurance'), miscCharges: amt('cumulativeMiscCharge') };
    if (!Object.values(cum).some(v => v > 0)) { toast.error('Enter the cumulative freight / insurance / misc amount first'); return; }
    if (!invoices.length) { toast.error('No invoices on this job yet'); return; }
    const val = (iv) => parseFloat(iv.value || iv.invoiceValue || 0) || 0;
    const tot = invoices.reduce((s, iv) => s + val(iv), 0);
    if (!(tot > 0)) { toast.error('The invoices have no value yet - the split is by invoice value'); return; }
    const curs = [...new Set(invoices.map(iv => norm(iv.currency || iv.invoiceCurrency)).filter(Boolean))];
    if (curs.length !== 1) { toast.error('The invoices use different currencies (' + curs.join(', ') + ') - enter freight / insurance per invoice'); return; }
    const cur = curs[0];
    const applies = { freightValue: (iv) => !['CIF', 'CF', 'C&F', 'CFR'].includes(norm(iv.terms)), insuranceValue: (iv) => !['CIF', 'CI'].includes(norm(iv.terms)), miscCharges: () => true };
    const curKey = { freightValue: 'freightCurrency', insuranceValue: 'insuranceCurrency', miscCharges: 'miscCurrency' };
    const rateKey = { freightValue: 'freightRate', insuranceValue: 'insuranceRate', miscCharges: 'miscChargesRate' };
    const next = invoices.map(iv => ({ ...iv })); const notes = [];
    for (const k of Object.keys(cum)) {
      if (!(cum[k] > 0)) continue;
      const tgt = next.filter(iv => val(iv) > 0 && applies[k](iv)); const base = tgt.reduce((s, iv) => s + val(iv), 0);
      if (!tgt.length || !(base > 0)) { notes.push(k + ': no invoice takes it (terms)'); continue; }
      let left = Math.round(cum[k] * 100);
      tgt.forEach((iv, i) => { const sh = i === tgt.length - 1 ? left : Math.round(cum[k] * 100 * val(iv) / base); left -= sh; iv[k] = (sh / 100).toFixed(2); iv[curKey[k]] = cur; iv[rateKey[k]] = ''; });
      notes.push(k.replace('Value', '').replace('Charges', '') + ' ' + cum[k].toFixed(2) + ' ' + cur + ' over ' + tgt.length + ' invoice(s)');
    }
    if (!(await askConfirm({ title: 'Split the cumulative charges?', message: notes.join('\n'), note: 'The share of each invoice is worked out by invoice value and written into it.', okLabel: 'Split', cancelLabel: 'Do nothing' }))) return;
    commit(next);
    toast.success('Cumulative charges written into the invoices - check them, then save the job');
  };
  // extra: more fields for the same save (18-Nov-2026: Read Excel passes the e-Sanchit docs it has just read)
  const commit = (newInvoices, newItems, extra) => {
    setInvoices(newInvoices);
    if (newItems && setItems) setItems(newItems);
    if (onSave) setTimeout(() => onSave({ invoices: newInvoices, ...(newItems ? { items: newItems } : {}), ...(extra || {}), _notify: 'Invoice changes put in' }), 50);
  };

  const checkForm = (f) => {
    const no = invNoOf(f);
    if (!no) { toast.error('Invoice No is mandatory!'); return false; }
    if (no.length > 16) toast('Invoice No is ' + no.length + ' characters - ICEGATE allows 16', { icon: '⚠️' });
    if (!(parseFloat(String(f.value || f.invValue || '').replace(/,/g, '')) > 0)) { toast.error('Invoice Value must be more than 0'); return false; }
    if (!norm(f.currency || f.invoiceCurrency)) { toast.error('Currency is mandatory'); return false; }
    const t = norm(f.terms || f.termsOfInvoice);
    if (t && !['CIF', 'FOB', 'CF', 'CI'].includes(t)) { toast.error('Terms must be CIF, FOB, CF or CI'); return false; }
    return true;
  };

  const handleClear = (e) => {
    if(e) e.preventDefault();
    setSelectedRowId(null);
    setInvoiceFormData({}); // also empty the form (it stayed filled when no row was selected)
    setTempData({});
  };

  // Save = add a NEW invoice. If that Invoice No is already on the job, it offers to update that one instead
  // (the old code also kept the id of the row that was selected, so two rows shared one id).
  const handleSave = async (e) => {
    if(e) e.preventDefault();
    const f = { ...invoiceFormData, ...tempData };
    if (!checkForm(f)) return;
    const no = invNoOf(f);
    const dup = findByNo(invoices, no);
    if (dup !== -1) {
      if (!(await askConfirm({ title: 'Invoice already on this job', message: `Invoice ${no} is already on this job (Sr No ${dup + 1}).`, okLabel: 'Update that invoice', cancelLabel: 'Do nothing' }))) return;
      const newInvoices = invoices.map((iv, k) => k === dup ? { ...iv, ...clean(f), id: iv.id, invNo: no } : iv);
      commit(newInvoices, null, { _exchangeRates: autoRates(newInvoices) });
      setSelectedRowId(invoices[dup].id);
      toast.success('Invoice ' + no + ' updated');
      return;
    }
    const newInvoice = { ...clean(f), id: Date.now(), invNo: no };
    const newInvoices = [...invoices, newInvoice];
    // 20-Nov-2026: the rate rows go in the same save (the save sent the job as it was before them, so a rate taken
    // here reached the database only with the next save)
    commit(newInvoices, null, { _exchangeRates: autoRates(newInvoices) });
    setSelectedRowId(newInvoice.id);
    setTempData({});
    toast.success(`Invoice ${no} added as Sr No ${newInvoices.length}`);
  };

  // Modify = change the selected invoice. Its Invoice No may not be the same as another invoice; when it is
  // renamed, its items get the new Invoice No too.
  const handleModify = (e) => {
    if(e) e.preventDefault();
    if (!selectedRowId || !invoices.some(iv => iv.id === selectedRowId)) { toast.error('Please select the invoice in the grid first (click its row), then Modify.'); return; }
    const f = { ...invoiceFormData, ...tempData };
    if (!checkForm(f)) return;
    const no = invNoOf(f);
    if (findByNo(invoices, no, selectedRowId) !== -1) { toast.error(`Invoice No ${no} is already used by another invoice of this job`); return; }
    const idx = invoices.findIndex(iv => iv.id === selectedRowId);
    const oldNo = invNoOf(invoices[idx]);
    const newInvoices = invoices.map(inv => inv.id === selectedRowId ? { ...inv, ...clean(f), id: inv.id, invNo: no } : inv);
    let newItems = null;
    if (norm(oldNo) !== norm(no) && (items || []).length) newItems = items.map(it => String(it.invSrNo || '1') === String(idx + 1) ? { ...it, invNo: no } : it);
    commit(newInvoices, newItems, { _exchangeRates: autoRates(newInvoices) });
    handleClear(); // 23-Nov-2026: after Modify the form is emptied like the Clear button (row unselected, ready for the next invoice)
    toast.success('Invoice ' + no + ' saved');
  };

  const removeInvoices = async (ids) => {
    const gone = invoices.map((iv, k) => ids.includes(iv.id) ? k + 1 : null).filter(Boolean);
    const itemCount = (items || []).filter(it => gone.includes(parseInt(it.invSrNo || '1', 10))).length;
    const names = invoices.filter(iv => ids.includes(iv.id)).map(invNoOf).join(', ');
    if (!(await askConfirm({ title: 'Delete invoice?', message: `Invoice ${names}`, note: itemCount ? `Its ${itemCount} item(s) are deleted too, and the items of the invoices after it get their new Inv Sr No.` : '', okLabel: 'Delete', cancelLabel: 'Keep', tone: 'danger' }))) return false;
    const newInvoices = invoices.filter(iv => !ids.includes(iv.id));
    commit(newInvoices, remapItems(invoices, newInvoices));
    return true;
  };

  const handleDelete = async (e) => {
    if(e) e.preventDefault();
    if (!selectedRowId) { toast.error("Please select an invoice to delete!"); return; }
    if (await removeInvoices([selectedRowId])) { setSelectedRowId(null); setInvoiceFormData({}); }
  };

  const handleDeleteMultiple = async (e) => {
    if(e) e.preventDefault();
    if(checkedIds.length === 0) { toast.error("Please select invoices to delete using checkboxes!"); return; }
    if (await removeInvoices([...checkedIds])) { checkedIds.forEach(id => toggleCheck(id)); setSelectedRowId(null); setInvoiceFormData({}); }
  };

  // Duplicate: asks for the new Invoice No (must be unique), adds it at the end, items can be copied too.
  // 20-Nov-2026: asked in EagleView windows, not the browser's prompt / confirm boxes
  const handleDuplicateInvoice = async (e) => {
    if(e) e.preventDefault();
    const src = invoices.find(iv => iv.id === selectedRowId);
    if (!src) { toast.error("Please select an invoice to duplicate!"); return; }
    const no = await askText({ title: 'Duplicate invoice', message: `A copy of invoice ${invNoOf(src)} is added at the end of the list.`,
      label: 'New Invoice No', okLabel: 'Make the copy', check: (t) => (findByNo(invoices, t) !== -1 ? `Invoice No ${t} is already on this job` : '') });
    if (!no) return;
    if (findByNo(invoices, no) !== -1) { toast.error(`Invoice No ${no} is already on this job`); return; }
    const copy = { ...clean(JSON.parse(JSON.stringify(src))), id: Date.now(), invNo: no };
    const newInvoices = [...invoices, copy];
    const srcSr = String(invoices.indexOf(src) + 1);
    const srcItems = (items || []).filter(it => String(it.invSrNo || '1') === srcSr);
    let newItems = null;
    if (srcItems.length && await askConfirm({ title: 'Copy the items too?', message: `Invoice ${invNoOf(src)} has ${srcItems.length} item(s).`,
      note: `Copy the items: invoice ${no} gets the same ${srcItems.length} item(s).\nInvoice only: invoice ${no} is added with no items.`, okLabel: 'Copy the items', cancelLabel: 'Invoice only' })) {
      newItems = [...items, ...srcItems.map((it, k) => ({ ...JSON.parse(JSON.stringify(it)), id: Date.now() + k + 1, invSrNo: String(newInvoices.length), invNo: no, importInvoiceId: undefined }))];
    }
    commit(newInvoices, newItems);
    setSelectedRowId(copy.id);
    toast.success(`Invoice ${no} added as Sr No ${newInvoices.length}`);
  };
  handleDuplicateInvoiceRef.current = handleDuplicateInvoice; // Ctrl+D uses the same prompt (unique Invoice No) as the button

  // Arrange Sr No: puts the invoices in invoice-date order (then Invoice No) and moves the items with them.
  const handleArrangeSerial = async (e) => {
    if(e) e.preventDefault();
    if (invoices.length < 2) { toast('Only one invoice - nothing to arrange'); return; }
    const key = (iv) => { const d = String(iv.invDate || iv.invoiceDate || ''); const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(d); return (m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : d) + '|' + norm(invNoOf(iv)); };
    const sorted = [...invoices].sort((a, b) => key(a).localeCompare(key(b)));
    if (sorted.every((iv, k) => iv === invoices[k])) { toast('Invoices are already in date order'); return; }
    if (!(await askConfirm({ title: 'Re-number the invoices in invoice-date order?', message: sorted.map((iv, k) => `${k + 1}. ${invNoOf(iv)}  ${iv.invDate || ''}`).join('\n'), note: 'Their items move with them.', okLabel: 'Re-number', cancelLabel: 'Leave as they are' }))) return;
    commit(sorted, remapItems(invoices, sorted, { dropMissing: false }));
    toast.success('Invoice Sr No re-arranged');
  };

  // ---- Read Excel / Sample: same columns both ways; rows are matched on Invoice No (update) else added ----
  // columns + sample shared with the Job Query "Download Sample" menu (./invoiceExcel.jsx)
  const handleDownloadSample = () => downloadInvoiceSample();

  const handleReadExcel = (e) => {
    const file = e.target.files[0];
    if (e.target) e.target.value = null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        // 29-Oct-2026: the whole job workbook is read here too (Invoices + Items + Containers + SW sheets + Supporting
        // docs + SVB / Licence / Anti-dumping; our template or the other ERP's ImportExcel) - see ../jobExcel.jsx
        const startSr = {};
        (items || []).forEach(it => { const k = String(it.invSrNo || '1'); startSr[k] = Math.max(startSr[k] || 0, parseInt(it.itemSrNo, 10) || 0); });
        const read = readJobWorkbook(evt.target.result, invoices, startSr, items || []); // 13-Nov-2026: SW sheets alone add to the job's items
        if (!read.invoices.length && !read.items.length && !read.containers.length && !read.jobDocs.length && !read.itemsOnJob) { toast.error('No invoice rows found (sheet "Invoices", column "Invoice No")'); return; }
        let replaceItems = false;
        if (read.items.length && (items || []).length) replaceItems = await askConfirm({ title: 'The job already has items', message: `The file also has ${read.items.length} item(s) and this job already has ${items.length}.`, okLabel: 'Replace with the file\'s items', cancelLabel: 'Add the file\'s items after them' });
        const m = mergeJobWorkbook(read, { invoices, items: items || [], jobData, esanchitDocs, replaceItems });
        if (read.jobDocs.length && setEsanchitDocs) setEsanchitDocs(m.esanchitDocs);
        const rates = autoRates(m.invoices);
        const notes = [...m.notes];
        let newItems = read.items.length ? m.items : null;
        const patch = { ...m.jobDataPatch };
        if (newItems) {
          // blank BCD / IGST rates from the Tariff master, then the duty amounts + totals strip (as the Item tab's Re-Calculate)
          const fr = await fillRatesFromTariff(newItems);
          const rc = recalcDuty(fr.items, m.invoices, { ...jobData, ...patch, _exchangeRates: rates });
          newItems = rc.items; Object.assign(patch, rc.totals);
          if (fr.notFound.length) notes.push('RITC not in Tariff master (type the BCD / IGST rate): ' + fr.notFound.join(', '));
          if (rc.noRate) notes.push(`${rc.noRate} item(s): exchange rate missing for the invoice currency - use "Update Exchange Rate" then Re-Calculate`);
          else notes.push(`Duty estimate ₹${rc.duty.toFixed(2)} on CIF ₹${rc.cif.toFixed(2)}` + (fr.filled ? ` (rates from Tariff master for ${fr.filled} item(s))` : ''));
        }
        if (Object.keys(patch).length) setJobData(prev => ({ ...prev, ...patch }));
        commit(m.invoices, newItems || (read.itemsOnJob ? m.items : null), { ...patch, _exchangeRates: rates, ...(read.jobDocs.length ? { esanchitDocs: m.esanchitDocs } : {}) }); // SW rows for the job's items: no rate fill / recalculation (13-Nov-2026)
        toast.success(m.summary);
        if (notes.length) toast(notes.slice(0, 8).join('\n') + (notes.length > 8 ? `\n...and ${notes.length - 8} more` : ''), { duration: 9000 });
      } catch (err) {
        toast.error('Error reading Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Copy From Other Job: invoices whose Invoice No is not on this job yet; their items can come along.
  const handleCopyFromOtherJob = async () => {
    const jobNo = await askText({ title: 'Copy invoices from another job', label: 'Job No', placeholder: 'e.g. NDL/AI/200005 or 8564', okLabel: 'Find the job',
      note: 'Invoices whose Invoice No is already on this job are left out.' });
    if (!jobNo) return;
    try {
      const data = await (await fetch(`/api/import-jobs/by-jobno/${encodeURIComponent(jobNo)}`)).json();
      const src = (data.success && data.data && data.data.invoices) || [];
      if (!src.length) { toast.error("No invoices found in that job."); return; }
      if (jobData?.id && data.data.id === jobData.id) { toast.error('That is this same job'); return; }
      const fresh = src.filter(iv => findByNo(invoices, invNoOf(iv)) === -1);
      const skipped = src.length - fresh.length;
      if (!fresh.length) { toast.error('All invoices of that job are already on this job (same Invoice No)'); return; }
      const itemCount = fresh.reduce((s, iv) => s + ((iv.items || []).length), 0);
      const withItems = itemCount > 0 && await askConfirm({ title: 'Copy the items too?', message: `Copy ${fresh.length} invoice(s) from job ${jobNo}` + (skipped ? ` (${skipped} skipped - Invoice No already here)` : '') + '.',
        note: `Copy the items: their ${itemCount} item(s) come along.\nInvoices only: the invoices are copied with no items.`, okLabel: 'Copy the items', cancelLabel: 'Invoices only' });
      const stripIds = (o) => { const c = JSON.parse(JSON.stringify(o)); ['id', 'importJobId', 'importInvoiceId', 'createdAt', 'updatedAt', 'items'].forEach(x => delete c[x]); return c; };
      const added = fresh.map((iv, k) => ({ ...stripIds(iv), id: Date.now() + k }));
      const newInvoices = [...invoices, ...added];
      let newItems = null;
      if (withItems) {
        newItems = [...(items || [])];
        fresh.forEach((iv, k) => (iv.items || []).forEach((it, j) => newItems.push({ ...stripIds(it), id: Date.now() + 1000 + k * 1000 + j, invSrNo: String(invoices.length + k + 1), invNo: invNoOf(iv) })));
      }
      commit(newInvoices, newItems, { _exchangeRates: autoRates(newInvoices) });
      toast.success(`${added.length} invoice(s) copied` + (withItems ? ' with items' : '') + (skipped ? `, ${skipped} skipped` : ''));
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch job invoices.");
    }
  };

  // Update Exchange Rate: one rate per currency used on the invoices (the old one put one number on every
  // invoice, whatever its currency, and the BE JSON never used it). Saved as the job's exchange-rate rows.
  const handleUpdateExchangeRate = async () => {
    // 17-Nov-2026: the invoice being typed counts too (before it is added it was "All invoices are in INR")
    const curs = [...new Set(invoices.concat(invoiceFormData && (invoiceFormData.currency || invoiceFormData.invoiceCurrency) ? [invoiceFormData] : []).flatMap(curOf))];
    if (!curs.length) { toast('All invoices are in INR - no exchange rate needed'); return; }
    let rows = ratesList().filter(r => r && r.currencyCode);
    for (const c of curs) {
      const cur = rows.find(r => norm(r.currencyCode) === c);
      const m = masterFor(c);
      const per = cur ? (parseFloat(cur.unitInRs) || 1) : (PER100.includes(c) ? 100 : 1);
      const dflt = cur ? cur.rate : (m && m.importRate ? (parseFloat(m.importRate) * per).toFixed(4) : '');
      // 20-Nov-2026: an EagleView window (the browser's prompt box could not be shown in every browser)
      const ans = await askText({ title: 'Exchange rate - ' + c, message: `Customs exchange rate for ${c} (rupees per ${per} ${c})`,
        note: m && m.importRate ? `CBIC rate in force ${rateDayLabel}: ${m.importRate} per 1${m.notificationNo ? ' (' + m.notificationNo + ', effective ' + masterRateDate(m).split('-').reverse().join('-') + ')' : ''}` : 'No CBIC rate for ' + c + ' in the Currency master.',
        label: `Rupees per ${per} ${c}`, value: dflt, okLabel: 'Use this rate', check: (t) => (parseFloat(t) > 0 ? '' : 'Type a rate above 0') });
      if (ans === null) return; // cancelled
      const rate = parseFloat(ans);
      if (!(rate > 0)) { toast.error(`Rate for ${c} is not a number - stopped`); return; }
            // keep the row's own date when the user only re-typed the same rate; master's date when the rate is the master's; else today
      const sameAsMaster = m && Math.abs(rate - parseFloat(m.importRate) * per) < 1e-6;
      // a typed rate is dated the job's rate day (the BE date when there is one), not today (20-Nov-2026)
      const effectiveDate = sameAsMaster ? masterRateDate(m) : (cur && Math.abs(parseFloat(cur.rate) - rate) < 1e-6 && cur.effectiveDate ? ymdLocal(cur.effectiveDate) : rateDay);
      rows = rows.filter(r => norm(r.currencyCode) !== c).concat([{ currencyCode: c, rate, unitInRs: per, standardCurrency: 'Y', effectiveDate }]);
    }
    setJobData(prev => ({ ...prev, _exchangeRates: rows }));
    // 20-Nov-2026: the rows go in the save itself - onSave({}) saved the job as it was before the change
    if (onSave) setTimeout(() => onSave({ _exchangeRates: rows }), 50);
    toast.success('Exchange rates saved: ' + rows.map(r => `${r.currencyCode} ${r.rate}` + (r.unitInRs !== 1 ? `/${r.unitInRs}` : '')).join(', '));
  };

  // Re-Calculate Duty All Inv: per invoice (its items by Inv Sr No), on the assessable value in INR.
  const handleRecalculateDutyAllInv = () => {
    const all = items || [];
    if (!all.length) { toast.error('No items found to recalculate duty.'); return; }
    let noRate = 0;
    const newItems = all.map(it => {
      const d = computeItemDuty(it, invoices, jobData);
      if (!d.rateFound) { noRate++; return it; }
      let ig = it.igstData; if (typeof ig === 'string') { try { ig = JSON.parse(ig); } catch (e) { ig = null; } }
      return { ...it, assessableValueInr: d.av.toFixed(2), bcdAmount: d.bcd.toFixed(2), swsAmount: d.sws.toFixed(2), igstData: ig ? { ...ig, amount: d.igst.toFixed(2) } : ig, totalDuty: d.total.toFixed(2), _d: d };
    });
    const newInvoices = invoices.map((inv, k) => {
      const its = newItems.filter(it => String(it.invSrNo || '1') === String(k + 1) && it._d);
      const sum = (f) => its.reduce((s, it) => s + it._d[f], 0);
      return { ...inv, calculatedAssessableValue: sum('av').toFixed(2), calculatedBCD: sum('bcd').toFixed(2), calculatedSWS: sum('sws').toFixed(2),
        calculatedIGST: sum('igst').toFixed(2), calculatedTotalDuty: sum('total').toFixed(2) };
    });
    commit(newInvoices, newItems.map(({ _d, ...it }) => it));
    const tot = newInvoices.reduce((s, iv) => s + parseFloat(iv.calculatedTotalDuty || 0), 0);
    if (noRate) toast.error(`${noRate} item(s) skipped: exchange rate missing ("Update Exchange Rate")`);
    toast.success(`Duty (estimate) for ${invoices.length} invoice(s): ₹${tot.toFixed(2)}`);
  };

  return { masterFor, rateDayLabel, registerPendingEdits, activeTerm, applyBulkUpdate, handleApplyCumulative, checkAll, checkedIds, deleteSelected, duplicateRow, fileInputRefInv, handleAdditionalDetailsChange, handleAeoChange, handleArrangeSerial, handleBrokerChange, handleClear, handleConditionsChange, handleCopyFromOtherJob, handleDelete, handleDeleteMultiple, handleDownloadSample, handleDuplicateInvoice, handleInvoiceFieldChange, handleMiscIncludedChange, handleMiscNotIncludedChange, handleModify, handleOtherInfoChange, handleReadExcel, handleRecalculateDutyAllInv, handleSave, handleSupplierSellerChange, handleSvbChange, handleTempChange, handleTermsChange, handleThirdPartyChange, handleUpdateExchangeRate, invoiceFormData, invoices, isAddressModalOpen, isBrokerModalOpen, isConditionsModalOpen, isMiscIncludedModalOpen, isMiscNotIncludedModalOpen, isOtherInfoModalOpen, isSellerModalOpen, isSvbModalOpen, isTermsModalOpen, items, jobData, masters, selectedInvoice, selectedRowId, setActiveTerm, setInvoiceFormData, setInvoices, setIsAddressModalOpen, setIsBrokerModalOpen, setIsConditionsModalOpen, setIsMiscIncludedModalOpen, setIsMiscNotIncludedModalOpen, setIsOtherInfoModalOpen, setIsSellerModalOpen, setIsSvbModalOpen, setIsTermsModalOpen, setJobData, setSelectedRowId, setShowAdditionalDetails, setShowAeoDetails, setShowThirdPartyDetails, setTempData, showAdditionalDetails, showAeoDetails, showThirdPartyDetails, syncRef, tempData, toggleCheck };
}
