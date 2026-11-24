// State and logic
// Split out of ExportInvoiceTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React, { useEffect, useState } from 'react';
import { getMaster } from '../../../../utils/masterCache'; // shared copy of small master lists, 09-Nov-2026
import { getParties } from '../../../../utils/partiesCache'; // shared copy of the party list, 09-Nov-2026
import { useExportContext } from '../../ExportContext';
import askConfirm from '../../../common/askConfirm'; // EagleView question window, 20-Nov-2026
import { perUnit, unitsOf, rateText, PER_100_CURRENCIES } from '../../../../utils/cbicExchange';

export default function useExportInvoiceTab(ctx) {
  const [currencies, setCurrencies] = useState([]);
  const [parties, setParties] = useState([]);
  const [countries, setCountries] = useState([]);

  useEffect(() => {
    getMaster('/api/masters/currencies')
      .then(data => { if(Array.isArray(data)) setCurrencies(data); })
      .catch(err => console.error('Failed to fetch currencies:', err));
      
    getParties()
      .then(data => { if(Array.isArray(data)) setParties(data); })
      .catch(err => console.error('Failed to fetch parties:', err));
    getMaster('/api/masters/countries').then(data => { if(Array.isArray(data)) setCountries(data); });
  }, []);
  const { exportData, setExportData, items, setItems, registerPendingEdits, remapItemRows } = useExportContext();
  // Items follow their invoice (29-Oct-2026): an item points at its invoice by position (Inv Sr). Deleting an
  // invoice moved the items of the next invoices onto the wrong invoice, and a new rate / value left item FOB stale.
  const itemFobFor = (it, inv) => {
    // 30-Oct-2026: rupees per ONE unit. The rate is held in CBIC notation, which for JPY / KRW is per 100 units.
    const ex = perUnit(inv && inv.currency, inv && (inv.exchRate || inv.exchangeRate), inv && inv.unitInRs);
    const tot = parseFloat(it.totalFc || it.total) || ((parseFloat(it.qty) || 0) * (parseFloat(it.rate ?? it.price) || 0) / (parseFloat(it.per) || 1));
    if (!ex || !tot) return it.itemFob;
    const v = parseFloat(inv.value || inv.invoiceValue) || 0, f = parseFloat(inv.invFobInr) || 0;
    const share = v > 0 && f > 0 ? Math.min(1, f / (v * ex)) : 1;
    return (tot * ex * share).toFixed(2);
  };
  const repriceItems = (invList) => {
    if (!setItems) return;
    setItems(prev => prev.map(it => { const inv = invList[(parseInt(it.invSr, 10) || 1) - 1]; if (!inv) return it; const f = itemFobFor(it, inv); return f === it.itemFob ? it : { ...it, itemFob: f }; }));
  };
  // remove invoices; their items are deleted or kept (then they go to invoice 1), later items move up one serial
  const removeInvoices = (ids, deleteItems) => {
    const gone = invoices.map((inv, i) => (ids.includes(inv.id) ? i + 1 : null)).filter(Boolean);
    const remaining = invoices.filter(inv => !ids.includes(inv.id));
    setInvoices(remaining);
    if (!setItems) return;
    const kept = (items || []).filter(it => !(deleteItems && gone.includes(parseInt(it.invSr, 10) || 1)));
    const mapped = kept.map(it => {
      const s = parseInt(it.invSr, 10) || 1;
      if (gone.includes(s)) return { ...it, invSr: 1 };
      return { ...it, invSr: s - gone.filter(g => g < s).length };
    });
    const c = {}; const next = mapped.map(it => { const k = parseInt(it.invSr, 10) || 1; c[k] = (c[k] || 0) + 1; return { ...it, itemSr: c[k] }; });
    setItems(next);
    // 17-Nov-2026: SW info / RoDTEP / statement rows of the job follow the items; rows of a deleted invoice go
    if (remapItemRows) remapItemRows(items, next, gone);
  };
  const itemsOfInvoice = (idx) => (items || []).filter(it => (parseInt(it.invSr, 10) || 1) === idx + 1).length;
  // delete with a question about the items of the invoice(s)
  const askDelete = (ids, label) => {
    const n = invoices.reduce((s, inv, i) => s + (ids.includes(inv.id) ? itemsOfInvoice(i) : 0), 0);
    if (!window.confirm(`Delete ${label}?`)) return false;
    const delItems = n > 0 ? window.confirm(`${n} item(s) belong to ${label}.\nOK = delete these items too\nCancel = keep them (they move to invoice 1)`) : false;
    removeInvoices(ids, delItems);
    return true;
  };
  const invoices = exportData.invoices || [];
  const setInvoices = (newInvoices) => {
    setExportData(prev => {
      const updatedInvoices = typeof newInvoices === 'function' ? newInvoices(prev.invoices || []) : newInvoices;
      
      // Auto-sync cross-tab Header values
      let totalFob = 0;
      let totalInvVal = 0;
      updatedInvoices.forEach(inv => {
         totalFob += parseFloat(inv.invFobInr) || 0;
         totalInvVal += parseFloat(inv.value) || 0;
      });

      return {
        ...prev,
        invoices: updatedInvoices,
        fobRs: totalFob > 0 ? totalFob.toFixed(2) : '',
        invoiceValue: totalInvVal > 0 ? totalInvVal.toFixed(2) : ''
      };
    });
  };
  const [thirdPartyDetails, setThirdPartyDetails] = useState('N');
  const [natureOfContract, setNatureOfContract] = useState('CIF');
  const [igstBasedOn, setIgstBasedOn] = useState('CIF');
  const [addFreightInsurance, setAddFreightInsurance] = useState('B');
  const [consigneeSame, setConsigneeSame] = useState('Y');
  const [showBuyerModal, setShowBuyerModal] = useState(false);

  const handleNatureOfContractChange = (val) => {
    setNatureOfContract(val);
    if (val === 'FOB') setAddFreightInsurance('N');
    else if (val === 'CI') setAddFreightInsurance('I');
    else if (val === 'CIF') setAddFreightInsurance('B');
    else if (val === 'CF') setAddFreightInsurance('F');
  };

  const [formData, setFormData] = useState({ no: '', date: '', value: '', buyer: '' });
  const [selectedId, setSelectedId] = useState(null);
  const [showOtherDetailsModal, setShowOtherDetailsModal] = useState(false);
  const [buyerDetails, setBuyerDetails] = useState({ name: '', address1: '', address2: '', address3: '', address4: '', city: '' });
  // every box that uses handleChange (payment nature / period, contract no, AEO, term place, all charges, third
  // party address, non-standard currency) could not be typed in: the function did nothing. 29-Oct-2026
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (!name) return;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? (checked ? 'Y' : 'N') : value }));
  };

  // rate (INR per unit) of a charge currency: the invoice currency uses the invoice rate, INR is 1, others the master
  const rateOf = (cur) => {
    const c = String(cur || '').trim().toUpperCase();
    // 30-Oct-2026: every rate here is rupees per ONE unit. The invoice's own rate is kept in CBIC notation
    // (per 100 for JPY / KRW), the Currency master holds a per-unit rate already.
    if (!c || c === String(formData.currency || '').toUpperCase()) return perUnit(formData.currency, formData.exchRate, formData.unitInRs);
    if (c === 'INR') return 1;
    const m = currencies.find(x => String(x.currencyCode || '').toUpperCase() === c);
    return m ? (parseFloat(m.exportRate) || 0) : 0;
  };

  // Charges and FOB. A rate (%) gives the amount in the invoice currency (it was worked out in rupees and shown next
  // to the foreign currency); FOB (INR) = invoice value - freight - insurance, each converted with its own currency's
  // rate. 12-Nov-2026: commission / discount / other deductions are not taken out of FOB (as iCAFFE: job 16518).
  useEffect(() => {
    const value = parseFloat(formData.value) || 0;
    const updates = {};
    const pct = (rateKey, amtKey, currKey) => {
      const rt = parseFloat(formData[rateKey]);
      if (isNaN(rt) || String(formData[rateKey]).trim() === '') return;
      const amt = (value * rt / 100).toFixed(2);
      if (amt !== String(formData[amtKey] || '')) updates[amtKey] = amt;
      if (!formData[currKey] && formData.currency) updates[currKey] = formData.currency;
    };
    if (['CIF', 'CF'].includes(natureOfContract)) pct('freightRate', 'freightAmount', 'freightCurr');
    if (['CIF', 'CI'].includes(natureOfContract)) pct('insuranceRate', 'insuranceAmount', 'insuranceCurr');
    pct('packingRate', 'packingAmount', 'packingCurr');
    pct('discountRate', 'discountAmount', 'discountCurr');
    pct('otherRate', 'otherAmount', 'otherCurr');
    pct('commissionRate', 'commissionAmount', 'commissionCurr');
    // charges the nature of contract does not have are cleared
    const clear = (keys) => keys.forEach(k => { if (formData[k]) updates[k] = ''; });
    if (!['CIF', 'CF'].includes(natureOfContract)) clear(['freightRate', 'freightAmount', 'freightCurr']);
    if (!['CIF', 'CI'].includes(natureOfContract)) clear(['insuranceRate', 'insuranceAmount', 'insuranceCurr']);
    const v = (k) => (updates[k] !== undefined ? parseFloat(updates[k]) : parseFloat(formData[k])) || 0;
    const inr = (amtKey, currKey) => v(amtKey) * rateOf(updates[currKey] !== undefined ? updates[currKey] : formData[currKey]);
    const ex = perUnit(formData.currency, formData.exchRate, formData.unitInRs);
    const fob = value * ex - inr('freightAmount', 'freightCurr') - inr('insuranceAmount', 'insuranceCurr');
    const fobTxt = value && ex ? fob.toFixed(2) : '';
    if (fobTxt !== String(formData.invFobInr || '')) updates.invFobInr = fobTxt;
    if (Object.keys(updates).length > 0) setFormData(prev => ({ ...prev, ...updates }));
  }, [formData.value, formData.exchRate, formData.unitInRs, formData.currency, formData.freightRate, formData.insuranceRate, formData.packingRate, formData.discountRate, formData.otherRate, formData.commissionRate,
      formData.freightAmount, formData.insuranceAmount, formData.commissionAmount, formData.discountAmount, formData.otherAmount,
      formData.freightCurr, formData.insuranceCurr, formData.commissionCurr, formData.discountCurr, formData.otherCurr, natureOfContract, currencies.length]);

  // ---- one invoice in the form: open, empty, check, build ----
  const EMPTY = { no: '', date: '', value: '', buyer: '', currency: '', exchRate: '', unitInRs: '' };
  // the Y/N and contract boxes belong to the invoice (they kept the last invoice's values and were not saved)
  const selectInvoice = (inv) => {
    invBase.current = null; // a freshly opened invoice has nothing unsaved
    setSelectedId(inv.id);
    setFormData({ ...inv, no: inv.no || inv.invoiceNo || '', date: inv.date || inv.invoiceDate || '', value: inv.value || inv.invoiceValue || '', exchRate: inv.exchRate || inv.exchangeRate || '', buyer: inv.buyer || inv.buyerName || '' });
    const noc = String(inv.contractType || inv.natureOfContract || 'CIF').toUpperCase();
    setNatureOfContract(noc);
    setAddFreightInsurance(inv.addFreight || ({ CIF: 'B', CI: 'I', CF: 'F', FOB: 'N' })[noc] || 'B');
    setIgstBasedOn(inv.igstBasedOn || 'CIF');
    setConsigneeSame(inv.consigneeSame || (inv.buyer && exportData.consigneeName && String(inv.buyer).trim().toUpperCase() !== String(exportData.consigneeName).trim().toUpperCase() ? 'N' : 'Y'));
    setThirdPartyDetails(inv.thirdParty === 'Y' || inv.tpName ? 'Y' : 'N');
    setBuyerDetails({ name: inv.buyer || inv.buyerName || '', address1: inv.buyerAddress1 || '', address2: inv.buyerAddress2 || '', address3: inv.buyerAddress3 || '', address4: inv.buyerAddress4 || '', city: inv.buyerCity || '' });
  };
  const resetForm = () => {
    invBase.current = null;
    setSelectedId(null); setFormData(EMPTY);
    setNatureOfContract('CIF'); setAddFreightInsurance('B'); setIgstBasedOn('CIF'); setConsigneeSame('Y'); setThirdPartyDetails('N');
    setBuyerDetails({ name: '', address1: '', address2: '', address3: '', address4: '', city: '' });
  };
  // 17-Nov-2026: changes in the invoice form that are not put in with Save / Modify (as on the Import screen). The form
  // as it was when the operator first touched it is kept; the form is "edited" when it differs from that.
  const invFormNow = () => ({ formData, natureOfContract, addFreightInsurance, igstBasedOn, consigneeSame, thirdPartyDetails, buyerDetails });
  const invRef = React.useRef(null); invRef.current = invFormNow();
  const invBase = React.useRef(null);
  const snapInv = (s) => { try { return JSON.stringify(s); } catch (e) { return ''; } };
  const markInvTouched = (e) => {
    if (invBase.current !== null) return;
    const t = e && e.target;
    if (t && t.closest && t.closest('[data-nodirty]')) return; // the invoice list is not the form
    invBase.current = { ...invRef.current };
  };
  const invoiceEdited = () => invBase.current !== null && snapInv(invRef.current) !== snapInv(invBase.current);
  const clearInvEdits = () => { invBase.current = null; };
  // a change made to the open invoice and its form together (Update Exchange Rate): not an unsaved change. A form with no
  // other changes is taken again once the screen has worked out FOB from the new rate.
  const keepInInvBase = (patch) => {
    if (!invBase.current) return;
    if (!invoiceEdited()) { setTimeout(() => { if (invBase.current) invBase.current = { ...invRef.current }; }, 80); return; }
    invBase.current = { ...invBase.current, formData: { ...invBase.current.formData, ...patch } };
  };
  React.useEffect(() => {
    if (typeof registerPendingEdits !== 'function') return undefined;
    const check = () => {
      if (!invoiceEdited()) return '';
      const f = invRef.current.formData || {};
      return selectedId != null
        ? 'Invoice ' + (f.no || '') + ' has changes that were not put in with MODIFY - they are not part of the SB yet.'
        : 'A new invoice' + (f.no ? ' (' + f.no + ')' : '') + ' is typed in the Invoice form but was not added with SAVE - it is not part of the SB yet.';
    };
    return registerPendingEdits('invoices', check);
  }); // no dependency list: the check must see the current selected invoice
  // open an invoice from the list: asks first when the form has changes (they were dropped silently)
  // 20-Nov-2026: asked in an EagleView window with named buttons, not the browser's OK / Cancel box
  const openInvoice = async (inv) => {
    if (inv.id === selectedId && invoiceEdited()) return; // the same invoice: the changes stay
    const other = 'invoice ' + (inv.no || inv.invoiceNo || '');
    if (invoiceEdited() && !(await askConfirm({ title: 'Changes not put in',
      message: selectedId != null ? 'Invoice ' + (formData.no || '') + ' has changes that were not put in with MODIFY.' : 'The new invoice in the form was not added with SAVE.',
      note: 'Drop the changes: ' + other + ' opens, and what was typed here is lost.\nStay here: press ' + (selectedId != null ? 'MODIFY' : 'SAVE') + ' first, then open ' + other + '.',
      okLabel: 'Drop the changes', cancelLabel: 'Stay here' }))) return;
    selectInvoice(inv);
  };
  // ICEGATE invoice rules (SB message format): errors stop the save, warnings are shown
  const checkInvoice = () => {
    const errors = [], warnings = [];
    const no = String(formData.no || '').trim();
    if (!no) errors.push('Invoice No is mandatory');
    else if (no.length > 17) errors.push('Invoice No can have at most 17 characters');
    else if (invoices.some(i => i.id !== selectedId && String(i.no || i.invoiceNo || '').trim().toUpperCase() === no.toUpperCase())) errors.push(`Invoice No ${no} is already in this job`);
    if (!formData.date) errors.push('Invoice Date is mandatory');
    else {
      const d = new Date(formData.date), today = new Date();
      if (!isNaN(d)) {
        if (d > today) errors.push('Invoice Date is in the future');
        else if ((today - d) / 864e5 > 366) errors.push('Invoice Date is more than 1 year old (ICEGATE allows up to 1 year)');
      }
    }
    if (!(parseFloat(formData.value) > 0)) errors.push('Invoice Value must be more than 0');
    if (!formData.currency) errors.push('Invoice currency is mandatory');
    if (!(parseFloat(formData.exchRate) > 0)) errors.push('Exchange rate is missing for ' + (formData.currency || 'the currency'));
    // 30-Oct-2026: CBIC Schedule II quotes these two per 100 units. Said plainly, because a rate read as per-1
    // made every rupee figure on the Shipping Bill 100 times too big.
    else if (PER_100_CURRENCIES.includes(String(formData.currency || '').trim().toUpperCase()))
      warnings.push(`${formData.currency} is in Schedule II of the CBIC notification - the rate is taken as ${rateText(formData.currency, formData.exchRate, formData.unitInRs)}, i.e. Rs ${perUnit(formData.currency, formData.exchRate, formData.unitInRs).toFixed(4)} for one ${formData.currency}`);
    if (['CIF', 'CF'].includes(natureOfContract) && !(parseFloat(formData.freightAmount) > 0)) errors.push(`Freight is mandatory for ${natureOfContract}`);
    if (['CIF', 'CI'].includes(natureOfContract) && !(parseFloat(formData.insuranceAmount) > 0) && !(parseFloat(formData.insuranceRate) > 0)) errors.push(`Insurance (amount or rate) is mandatory for ${natureOfContract}`);
    const pn = String(formData.pymtNature || '').slice(0, 2).toUpperCase();
    if (pn && !['DP', 'AP', 'LC', 'DA', 'NA'].includes(pn)) errors.push('Payment nature must be DP, AP, LC, DA or NA');
    // 12-Nov-2026: 180 days and more were refused ("0 - 179"); iCAFFE files SBs with 180. Days, up to 3 digits; the
    // realisation period under FEMA is checked as a warning by the ICEGATE check.
    if (String(formData.pymtPeriod || '').trim() && !/^\d{1,3}$/.test(String(formData.pymtPeriod).trim())) errors.push('Payment period must be in days (0 - 999)');
    if (parseFloat(formData.invFobInr) < 0) errors.push('Charges are more than the invoice value (FOB below 0)');
    if (consigneeSame === 'N' && !String(buyerDetails.name || formData.buyer || '').trim()) errors.push('Buyer name is needed when the buyer is not the consignee');
    // same rules as the ICEGATE pre-check (29-Oct-2026): buyer address 1, third party address 1 + country
    if (consigneeSame === 'N' && !String(buyerDetails.address1 || formData.buyerAddress1 || '').trim()) errors.push('Buyer Address 1 is mandatory (Buyer details)');
    if (consigneeSame === 'Y' && !String(exportData.consigneeAddress1 || '').trim()) warnings.push('Consignee Address 1 is empty on the SB Header (it goes as the buyer address)');
    if (thirdPartyDetails === 'Y' && !String(formData.tpName || '').trim()) errors.push('Third party name is needed (Third Party Details = Y)');
    if (thirdPartyDetails === 'Y' && !/^[A-Z]{2}$/.test(String(formData.tpCntr2 || '').toUpperCase())) errors.push('Third party country code (2 letters) is mandatory');
    if (thirdPartyDetails === 'Y' && !String(formData.tpAddress1 || '').trim()) errors.push('Third party Address 1 is mandatory');
    return { errors, warnings };
  };
  const buildInvoice = (base) => {
    const sameAsConsignee = consigneeSame === 'Y';
    const buyer = sameAsConsignee
      ? { buyer: exportData.consigneeName || '', buyerAddress1: exportData.consigneeAddress1 || '', buyerAddress2: exportData.consigneeAddress2 || '', buyerAddress3: exportData.consigneeAddress3 || '', buyerAddress4: exportData.consigneeAddress4 || '' }
      : { buyer: buyerDetails.name || formData.buyer || '', buyerAddress1: buyerDetails.address1 || '', buyerAddress2: buyerDetails.address2 || '', buyerAddress3: buyerDetails.address3 || '', buyerAddress4: buyerDetails.address4 || '', buyerCity: buyerDetails.city || '' };
    const tp = thirdPartyDetails === 'Y' ? {} : { tpName: '', tpAddress1: '', tpAddress2: '', tpCity: '', tpCntryDiv: '', tpCntr1: '', tpCntry: '', tpCntr2: '', tpPin: '' };
    return {
      ...base, ...formData, ...buyer, ...tp,
      contractType: natureOfContract, natureOfContract,
      addFreight: String(addFreightInsurance || '').toUpperCase().slice(0, 1), igstBasedOn, consigneeSame, thirdParty: thirdPartyDetails,
      invoiceNo: String(formData.no || '').trim(), no: String(formData.no || '').trim(), invoiceDate: formData.date, invoiceValue: formData.value,
      exchangeRate: formData.exchRate, buyerName: buyer.buyer,
      // 30-Oct-2026: the units the rate is quoted for travel with the invoice (100 for JPY / KRW, Schedule II of
      // the CBIC notification). Every rupee figure - and the Shipping Bill's own exchange row - divides by it.
      unitInRs: parseFloat(formData.unitInRs) || unitsOf(formData.currency),
    };
  };
  const handleConsigneeSameChange = (e) => {
    const val = e.target.value;
    setConsigneeSame(val);
    if (val === 'N') {
      setShowBuyerModal(true);
    }
  };
  return { markInvTouched, invoiceEdited, clearInvEdits, keepInInvBase, openInvoice, askDelete, repriceItems, items, selectInvoice, resetForm, checkInvoice, buildInvoice, rateOf, addFreightInsurance, buyerDetails, consigneeSame, countries, currencies, exportData, formData, handleChange, handleConsigneeSameChange, handleNatureOfContractChange, igstBasedOn, invoices, natureOfContract, parties, selectedId, setAddFreightInsurance, setBuyerDetails, setConsigneeSame, setCountries, setCurrencies, setExportData, setFormData, setIgstBasedOn, setInvoices, setNatureOfContract, setParties, setSelectedId, setShowBuyerModal, setShowOtherDetailsModal, setThirdPartyDetails, showBuyerModal, showOtherDetailsModal, thirdPartyDetails };
}

