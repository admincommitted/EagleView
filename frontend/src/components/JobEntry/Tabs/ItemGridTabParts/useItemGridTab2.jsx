// State and logic, part 2 of 2
// Split out of ItemGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';
import { readJobWorkbook, mergeJobWorkbook, fillRatesFromTariff, recalcDuty } from '../jobExcel';
import { computeItemDuty } from './helpers';
import toast from 'react-hot-toast';
import askConfirm from '../../../common/askConfirm';

export default function useItemGridTab2(ctx) {
  const { checkedIds, deleteSelected, invoices, items, jobData, onSave, selectedItem, selectedRowId, setItems, setJobData, setSelectedRowId, setInvoices, esanchitDocs, setEsanchitDocs } = ctx;
  // Read File (Excel / CSV): same columns as the Template / Sample, items go to the right invoice, SW sheets are
  // attached to the right item, and existing items can be replaced or kept. 28-Oct-2026
  const handleReadFile = (e) => {
    const file = e.target.files[0];
    if (e.target) e.target.value = null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        // 29-Oct-2026: one workbook for the whole job (Invoices + Items + Containers + SW sheets + Supporting docs + SVB /
        // Licence / Anti-dumping), our template or the other ERP's ImportExcel - see jobExcel.jsx
        const startSr = {};
        items.forEach(it => { const k = String(it.invSrNo || '1'); startSr[k] = Math.max(startSr[k] || 0, parseInt(it.itemSrNo, 10) || 0); });
        // 13-Nov-2026: the job's items go along, so a file with only SW_Control / SW sheets / Licence / SVB adds to them
        const read = readJobWorkbook(evt.target.result, invoices, startSr, items);
        if (!read.items.length && !read.invoices.length && !read.containers.length && !read.jobDocs.length && !read.itemsOnJob) { toast.error('Nothing found in the file (sheets "Items" / "Invoices" - RITC / Description / Invoice No columns' + (read.warnings.length ? '; ' + read.warnings.slice(0, 3).join('; ') : '') + ')'); return; }
        // only SW / licence / SVB / doc rows for the job's items: put them on, save - no rate fill / duty recalculation
        if (!read.items.length && read.itemsOnJob) {
          const m0 = mergeJobWorkbook(read, { invoices, items, jobData, esanchitDocs });
          setItems(m0.items);
          if (read.jobDocs.length && setEsanchitDocs) setEsanchitDocs(m0.esanchitDocs);
          if (onSave) setTimeout(() => onSave({ items: m0.items, ...m0.jobDataPatch, ...(read.jobDocs.length ? { esanchitDocs: m0.esanchitDocs } : {}) }), 50);
          toast.success(m0.summary);
          if (m0.notes.length) toast(m0.notes.slice(0, 8).join('\n') + (m0.notes.length > 8 ? `\n...and ${m0.notes.length - 8} more` : ''), { duration: 9000 });
          return;
        }
        let replaceItems = false;
        if (read.items.length && items.length) replaceItems = await askConfirm({ title: 'The job already has items', message: `This job already has ${items.length} item(s) and the file has ${read.items.length}.`, okLabel: 'Replace with the file\'s items', cancelLabel: 'Add the file\'s items after them' });
        const m = mergeJobWorkbook(read, { invoices, items, jobData, esanchitDocs, replaceItems });
        const patch = { ...m.jobDataPatch };
        if (read.invoices.length) { patch.invoices = m.invoices; setInvoices(m.invoices); }
        if (read.jobDocs.length && setEsanchitDocs) setEsanchitDocs(m.esanchitDocs);
        // blank BCD / IGST rates from the Tariff master, then the duty amounts + totals strip (as Re-Calculate does)
        const fr = await fillRatesFromTariff(m.items);
        const rc = recalcDuty(fr.items, m.invoices, { ...jobData, ...patch });
        setItems(rc.items);
        setJobData(prev => ({ ...prev, ...patch, ...rc.totals }));
        // 18-Nov-2026: the e-Sanchit docs read from the file go with this save (they were saved only on the next SAVE)
        if (onSave) setTimeout(() => onSave({ items: rc.items, ...(read.invoices.length ? { invoices: m.invoices } : {}), ...(read.jobDocs.length ? { esanchitDocs: m.esanchitDocs } : {}), ...m.jobDataPatch, ...rc.totals }), 50);
        const notes = [...m.notes];
        if (fr.notFound.length) notes.push('RITC not in Tariff master (type the BCD / IGST rate): ' + fr.notFound.join(', '));
        if (rc.noRate) notes.push(`${rc.noRate} item(s): exchange rate missing for the invoice currency - use "Update Exchange Rate" then Re-Calculate`);
        toast.success(m.summary + (fr.filled ? ` - rates from Tariff master for ${fr.filled} item(s)` : '') + (rc.noRate ? '' : `, duty estimate ₹${rc.duty.toFixed(2)}`) + (notes.length ? ` - ${notes.length} note(s), see below` : ''));
        if (notes.length) toast(notes.slice(0, 8).join('\n') + (notes.length > 8 ? `\n...and ${notes.length - 8} more` : ''), { duration: 9000 });
      } catch (err) {
        console.error(err);
        toast.error("Failed to read the file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Re-Calculate: value = qty x price where missing, duty estimate per item on the assessable value in INR, and the
  // totals bar (item total, invoice total, mismatch, CIF in INR, total duty). The old one added foreign-currency
  // values as rupees. 28-Oct-2026
  const handleRecalculate = () => {
    let cif = 0, duty = 0, noRate = 0;
    const next = items.map(it => {
      const d = computeItemDuty(it, invoices, jobData);
      if (!d.rateFound) { noRate++; return it; }
      cif += d.av; duty += d.total;
      let ig = it.igstData; if (typeof ig === 'string') { try { ig = JSON.parse(ig); } catch (e) { ig = null; } }
      return { ...it, value: it.value || (d.itemValue ? d.itemValue.toFixed(2) : it.value), assessableValueInr: d.av.toFixed(2),
        bcdAmount: d.bcd.toFixed(2), swsAmount: d.sws.toFixed(2), healthCessAmount: d.health ? d.health.toFixed(2) : it.healthCessAmount,
        igstData: ig ? { ...ig, amount: d.igst.toFixed(2) } : ig, totalDuty: d.total.toFixed(2) };
    });
    setItems(next);
    const itemTotal = next.reduce((s, it) => s + ((parseFloat(it.qty || it.quantity) * parseFloat(it.price || it.unitPrice)) || parseFloat(it.value) || 0), 0);
    setJobData(prev => ({ ...prev, itemTotal: itemTotal.toFixed(2), cifTotalInr: cif.toFixed(2), invTotal: cif.toFixed(2), totalDuty: duty.toFixed(2) }));
    if (noRate) toast.error(`${noRate} item(s) skipped: exchange rate missing for their invoice currency`);
    else toast.success(`Recalculated: CIF ₹${cif.toFixed(2)}, duty ₹${duty.toFixed(2)} (estimate)`);
  };

  // 22-Nov-2026: Quick Quantity Entry (ex-bond) - the quantities typed in the window are written on their items in one
  // go: value = quantity x unit price and the duty estimate, as MODIFY and Re-Calculate do for one item, then one save.
  const applyQuickQty = (qtyById) => {
    let n = 0;
    const next = items.map(it => {
      if (!Object.prototype.hasOwnProperty.call(qtyById || {}, it.id)) return it;
      const q = String(qtyById[it.id]); if (q === String(it.qty || it.quantity || '')) return it;
      const px = parseFloat(String(it.price ?? it.unitPrice ?? '').replace(/,/g, ''));
      let up = { ...it, qty: q, quantity: q };
      if (px > 0) { const v = (parseFloat(q) * px).toFixed(2); up.value = v; up.assessableValue = v; }
      const d = computeItemDuty(up, invoices, jobData);
      if (d.rateFound) { let ig = up.igstData; if (typeof ig === 'string') { try { ig = JSON.parse(ig); } catch (e) { ig = null; } }
        up = { ...up, assessableValueInr: d.av.toFixed(2), bcdAmount: d.bcd.toFixed(2), swsAmount: d.sws.toFixed(2), healthCessAmount: d.health ? d.health.toFixed(2) : up.healthCessAmount, igstData: ig ? { ...ig, amount: d.igst.toFixed(2) } : ig, totalDuty: d.total.toFixed(2) }; }
      n++; return up;
    });
    if (!n) { toast('No quantity was changed'); return 0; }
    setItems(next); setSelectedRowId(null); // the item form shows the values it opened with
    if (onSave) setTimeout(() => onSave({ items: next, _notify: n + ' quantity(ies) changed' }), 50);
    return n;
  };

  // Customs Duty Calculator (one item): uses the rates typed on the screen right now and fills the amount boxes.
  const handleDutyCalculate = () => {
    if (!selectedRowId || !selectedItem) { toast('Please select an item to calculate duty.'); return; }
    const form = document.getElementById('item-form');
    const fd = form ? new FormData(form) : null;
    const live = { ...selectedItem };
    ['value', 'qty', 'price', 'invNo', 'bcdRate', 'bcdAmount', 'bcdUnit', 'bcdSpecAmount', 'bcdRateBasis', 'specQty', 'swsRate', 'healthCessRate', 'healthCessAmount'].forEach(k => { const v = fd?.get(k); if (v !== null && v !== undefined) live[k] = v; });
    const d = computeItemDuty(live, invoices, jobData);
    if (!d.rateFound) { toast.error(`Exchange rate for ${d.currency || 'the invoice currency'} is missing (Job Header / Invoice)`); return; }
    const setV = (n, v) => { const el = form && form.elements[n]; if (el) el.value = v; };
    setV('bcdAmount', d.bcd.toFixed(2)); setV('swsAmount', d.sws.toFixed(2)); if (d.health) setV('healthCessAmount', d.health.toFixed(2));
    let ig = selectedItem.igstData; if (typeof ig === 'string') { try { ig = JSON.parse(ig); } catch (e) { ig = null; } }
    setItems(items.map(it => it.id === selectedRowId ? { ...it, bcdAmount: d.bcd.toFixed(2), swsAmount: d.sws.toFixed(2), assessableValueInr: d.av.toFixed(2),
      igstData: ig ? { ...ig, amount: d.igst.toFixed(2) } : ig, totalDuty: d.total.toFixed(2) } : it));
    toast.success(`Ass. value ₹${d.av.toFixed(2)} | BCD ₹${d.bcd.toFixed(2)} + SWS ₹${d.sws.toFixed(2)}` + (d.health ? ` + Health ₹${d.health.toFixed(2)}` : '') +
      ` + IGST ₹${d.igst.toFixed(2)}` + (d.add || d.other ? ` + other ₹${(d.add + d.other).toFixed(2)}` : '') + ` = ₹${d.total.toFixed(2)} (estimate)`, { duration: 7000 });
  };

  const handleClear = (e) => {
    if(e) e.preventDefault();
    setSelectedRowId(null);
    // the form is uncontrolled: reset it too, otherwise typed values stay when no row was selected
    setTimeout(() => { const f = document.getElementById('item-form'); if (f) f.reset(); }, 0);
  };

  const handleSave = (e) => {
    if(e) e.preventDefault();
    const form = document.getElementById('item-form');
    if (!form) return;
    const fd = new FormData(form);
    const itemSrNo = fd.get('itemSrNo');
    if (!itemSrNo) {
      toast.error("Item Sr No is mandatory to save!");
      return;
    }

    const hsCode = fd.get('hsCode') || fd.get('ritc') || '';
    const desc = fd.get('desc') || fd.get('productDescription') || '';
    const qty = parseFloat(fd.get('qty') || fd.get('quantity') || 0);

    if (!hsCode) { toast.error('HS Code (RITC) is mandatory!'); return; }
    if (!desc) { toast.error('Item Description is mandatory!'); return; }
    if (!qty || qty <= 0) { toast.error('Quantity must be greater than 0!'); return; }

    const selInvNo = fd.get('invNo');
    const matchingInvIdx = invoices.findIndex(inv => inv.invNo === selInvNo);
    // 30-Oct-2026: an item with no invoice chosen was put under invoice 1 silently
    if (matchingInvIdx === -1) { toast.error(invoices.length ? 'Select the invoice (Inv No) this item belongs to' : 'Add the invoice first (3. Invoices), then the items'); return; }
    const invSrNo = String(matchingInvIdx + 1);
    // 17-Nov-2026: Save pressed while a grid row is selected and its invoice / Item Sr No are unchanged added a SECOND
    // copy of that item (without its e-Sanchit / SW / duty popups) - the invoice value then no longer matched the items
    // and the job could not be saved. That is a change of the selected item: it is saved as Modify.
    if (selectedRowId && selectedItem && items.some(it => it.id === selectedRowId)
        && String(selectedItem.invSrNo || '1') === invSrNo && String(parseInt(selectedItem.itemSrNo, 10) || '') === String(parseInt(itemSrNo, 10) || '')) {
      toast('Item ' + itemSrNo + ' is already in the grid - your changes are saved to it (Modify). For a new item press Clear first.', { icon: 'ℹ️', duration: 7000 });
      handleModify();
      return;
    }

    const newItem = {
      id: Date.now(),
      invNo: fd.get('invNo') || '',
      invSrNo: invSrNo || '',
      itemSrNo: fd.get('itemSrNo') || '',
      itemNo: fd.get('itemSrNo') || '',
      ritc: fd.get('ritc') || fd.get('hsCode') || '',
      hsCode: fd.get('ritc') || fd.get('hsCode') || '',
      cth: fd.get('cth') || '',
      ceth: fd.get('ceth') || '',
      productCode: fd.get('productCode') || '',
      // ICEGATE item particulars (29-Oct-2026)
      brandName: (fd.get('brandName') || '').toUpperCase(), model: (fd.get('model') || '').toUpperCase(), endUse: (fd.get('endUse') || '').toUpperCase(),
      genericDesc: (fd.get('genericDesc') || '').toUpperCase(), manufacturer: (fd.get('manufacturer') || '').toUpperCase(), countryOfOrigin: (fd.get('countryOfOrigin') || '').toUpperCase(),
      accessories: (fd.get('accessories') || '').toUpperCase(), sourceCountry: (fd.get('sourceCountry') || '').toUpperCase(), transitCountry: (fd.get('transitCountry') || '').toUpperCase(),
      rateTypeFlag: fd.get('rateTypeFlag') || '',
      desc: fd.get('desc') || '',
      productDescription: fd.get('desc') || '',
      qty: fd.get('qty') || '',
      quantity: fd.get('qty') || '',
      unit: fd.get('uqc') || fd.get('unit') || '',  // the box is named uqc; unit stayed empty -> blank UQC in the BE JSON (28-Oct-2026)
      uqc: fd.get('uqc') || fd.get('unit') || '',
      descOnlyInChecklist: fd.get('descOnlyInChecklist') || '',
      price: fd.get('price') || '',
      unitPrice: fd.get('price') || '',
      value: fd.get('value') || '',
      assessableValue: fd.get('value') || '',
      igstDutyFlag: fd.get('igstDutyFlag') || '',
      svbFlag: fd.get('svbFlag') || '',
      foc: fd.get('foc') || 'N',
      bcdNotificationNo: fd.get('bcdNotificationNo') || '',
      bcdSrNo: fd.get('bcdSrNo') || '',
      bcdRate: fd.get('bcdRate') || '',
      bcdFlag: fd.get('bcdFlag') || '',
      bcdAmount: fd.get('bcdAmount') || '',
      bcdUnit: fd.get('bcdUnit') || '',
      // 30-Oct-2026: the specific (per-unit) side of the BCD line and how to apply it
      bcdSpecAmount: fd.get('bcdSpecAmount') || '',
      bcdRateBasis: fd.get('bcdRateBasis') || '',
      specQty: fd.get('specQty') || '',
      cvdNotificationNo: fd.get('cvdNotificationNo') || '',
      cvdSrNo: fd.get('cvdSrNo') || '',
      cvdRate: fd.get('cvdRate') || '',
      cvdFlag: fd.get('cvdFlag') || '',
      cvdAmount: fd.get('cvdAmount') || '',
      cvdUnit: fd.get('cvdUnit') || '',
      adlCvdNotificationNo: fd.get('adlCvdNotificationNo') || '',
      adlCvdSrNo: fd.get('adlCvdSrNo') || '',
      adlCvdRate: fd.get('adlCvdRate') || '',
      adlCvdFlag: fd.get('adlCvdFlag') || '',
      adlCvdAmount: fd.get('adlCvdAmount') || '',
      adlCvdUnit: fd.get('adlCvdUnit') || '',
      swsNotificationNo: fd.get('swsNotificationNo') || '',
      swsSrNo: fd.get('swsSrNo') || '',
      swsRate: fd.get('swsRate') || '',
      swsFlag: fd.get('swsFlag') || '',
      swsAmount: fd.get('swsAmount') || '',
      swsUnit: fd.get('swsUnit') || '',
      saptaNotificationNo: fd.get('saptaNotificationNo') || '',
      saptaSrNo: fd.get('saptaSrNo') || '',
      saptaRate: fd.get('saptaRate') || '',
      saptaFlag: fd.get('saptaFlag') || '',
      saptaAmount: fd.get('saptaAmount') || '',
      saptaUnit: fd.get('saptaUnit') || '',
      healthCessNotificationNo: fd.get('healthCessNotificationNo') || '',
      healthCessSrNo: fd.get('healthCessSrNo') || '',
      healthCessRate: fd.get('healthCessRate') || '',
      healthCessFlag: fd.get('healthCessFlag') || '',
      healthCessAmount: fd.get('healthCessAmount') || '',
      healthCessUnit: fd.get('healthCessUnit') || '',
      schemeCodCategoryFlag: fd.get('schemeCodCategoryFlag') || '',
      licenceFlag: fd.get('licenceFlag') || '',
      reImportFlag: fd.get('reImportFlag') || '',
      rspDutyFlag: fd.get('rspDutyFlag') || '',
      ncdCustomDutyFlag: fd.get('ncdCustomDutyFlag') || '',
      antiDumpingDutyFlag: fd.get('antiDumpingDutyFlag') || '',
      otherDutyFlag: fd.get('otherDutyFlag') || '',
      swInfotypeFlag: fd.get('swInfotypeFlag') || '',
      swConstituentFlag: fd.get('swConstituentFlag') || '',
      swProductionFlag: fd.get('swProductionFlag') || '',
      swControlFlag: fd.get('swControlFlag') || '',
      swStatementFlag: fd.get('swStatementFlag') || '',
      supportingDocsFlag: fd.get('supportingDocsFlag') || '',
      customsCvdFlag: fd.get('customsCvdFlag') || '',
      policyParaFlag: fd.get('policyParaFlag') || '',
      exciseFlag: fd.get('exciseFlag') || '',
      printGenDescFlag: fd.get('printGenDescFlag') || '',
      previousBeFlag: fd.get('previousBeFlag') || '',
      // 30-Oct-2026: packingDetailsFlag / addToTemplateFlag / copyDetailsFlag are gone - their boxes did nothing;
      // the item template is saved with the "Add to Template" button instead (Masters > Item Template).
      antiDumpingData: null,
      otherDutyData: null,
      igstData: (ctx.takePendingIgst && ctx.takePendingIgst(fd.get('ritc') || fd.get('hsCode'), null)) || null, // 22-Nov-2026: IGST rate / notification the Tariff master gave for this RITC
      svbItemData: null,
      schemeCategoryData: null,
      policyParaData: null,
      previousBeData: null,
      cvdData: null,
      docsData: null,
      swInfoData: null,
      swConstData: null,
      swProdData: null,
      swCtrlData: null,
      swStmtData: null,
      reimportData: null,
      rspData: null,
      ncdData: null,
    };
    // 29-Oct-2026: "Add In Middle" - an Item Sr No that is already used in this invoice puts the item there and moves
    // the later items of that invoice down by one (same invoice only); the list stays in invoice / item order
    const sr = parseInt(newItem.itemSrNo, 10) || 0;
    const clash = items.some(it => String(it.invSrNo || '1') === String(invSrNo) && (parseInt(it.itemSrNo, 10) || 0) === sr);
    const shifted = clash ? items.map(it => (String(it.invSrNo || '1') === String(invSrNo) && (parseInt(it.itemSrNo, 10) || 0) >= sr) ? { ...it, itemSrNo: String((parseInt(it.itemSrNo, 10) || 0) + 1), itemNo: String((parseInt(it.itemSrNo, 10) || 0) + 1) } : it) : items;
    const newItems = [...shifted, newItem].sort((a, b) => (parseInt(a.invSrNo, 10) || 1) - (parseInt(b.invSrNo, 10) || 1) || (parseInt(a.itemSrNo, 10) || 0) - (parseInt(b.itemSrNo, 10) || 0));
    if (clash) toast(`Item placed at Sr No ${sr}; the later items of invoice ${invSrNo} moved down by one`, { icon: 'ℹ️' });
    setItems(newItems);
    if (onSave) setTimeout(() => onSave({ items: newItems, _notify: 'Item ' + (newItem.itemSrNo || '') + ' added' }), 50);
    setSelectedRowId(newItem.id);
  };

  // "Arrange Item Serial No" (30-Oct-2026: the button had no handler). Re-numbers the items of EACH invoice 1, 2, 3 ...
  // in their present order; ICEGATE keys an item by invoice sr + item sr, so gaps / repeats are refused there.
  const handleArrangeItemSerial = async (e) => {
    if (e) e.preventDefault();
    if (!items.length) { toast('No items to arrange'); return; }
    const next = []; const n = {};
    [...items].sort((a, b) => (parseInt(a.invSrNo, 10) || 1) - (parseInt(b.invSrNo, 10) || 1) || (parseInt(a.itemSrNo, 10) || 0) - (parseInt(b.itemSrNo, 10) || 0))
      .forEach(it => { const k = String(it.invSrNo || '1'); n[k] = (n[k] || 0) + 1; next.push({ ...it, itemSrNo: String(n[k]), itemNo: String(n[k]) }); });
    if (next.every((it, k) => String(it.itemSrNo) === String(items[k] && items[k].itemSrNo) && it.id === (items[k] || {}).id)) { toast('Item Sr Nos are already in order'); return; }
    if (!(await askConfirm({ title: 'Re-number the items?', message: 'The items of each invoice get Sr No 1, 2, 3 ... in their present order.', okLabel: 'Re-number', cancelLabel: 'Leave as they are' }))) return;
    setItems(next);
    if (onSave) setTimeout(() => onSave({ items: next }), 50);
    toast.success('Item Sr No re-arranged');
  };

  const handleModify = (e) => {
    if(e) e.preventDefault();
    // 30-Oct-2026: a selection that is not in the grid (rows re-created by a save) used to "modify" nothing and still report the job saved
    if (!selectedRowId || !items.some(it => it.id === selectedRowId)) {
      toast.error("Please select the item in the grid first (click its row), then Modify.");
      return;
    }
    const form = document.getElementById('item-form');
    const fd = new FormData(form);
    const newQty = parseFloat(fd.get('qty') || 0);
    
    // EX-BOND BALANCE VALIDATION
    if (selectedItem._whBalanceQty !== undefined) {
       const balance = parseFloat(selectedItem._whBalanceQty);
       if (newQty > balance) {
          toast(` You cannot clear more than the Warehouse Balance!\nMax Allowed: ${balance}\nEntered: ${newQty}`);
          return; // Block save
       }
    }

    // invoice Sr No comes from the chosen invoice (there is no invSrNo box: every modified item went to invoice 1). 28-Oct-2026
    const modInvNo = fd.get('invNo') || '';
    const modInvIdx = invoices.findIndex(inv => inv.invNo === modInvNo);
    // 29-Oct-2026: another item of the same invoice already has this Item Sr No (ICEGATE keys items by invoice sr + item sr)
    { const tgtInv = modInvIdx !== -1 ? String(modInvIdx + 1) : String(selectedItem.invSrNo || '1'); const tgtSr = String(parseInt(fd.get('itemSrNo'), 10) || '');
      if (tgtSr && items.some(it => it.id !== selectedRowId && String(it.invSrNo || '1') === tgtInv && String(parseInt(it.itemSrNo, 10) || '') === tgtSr)) { toast.error(`Item Sr No ${tgtSr} is already used in invoice ${tgtInv} - choose another Sr No`); return; } }
    const newItems = items.map(it => it.id === selectedRowId ? {
        ...it,
        invNo: modInvNo,
        invSrNo: modInvIdx !== -1 ? String(modInvIdx + 1) : String(it.invSrNo || '1'),
        itemSrNo: fd.get('itemSrNo') || '',
        itemNo: fd.get('itemSrNo') || '',
        ritc: fd.get('ritc') || fd.get('hsCode') || '',
        hsCode: fd.get('ritc') || fd.get('hsCode') || '',
        cth: fd.get('cth') || '',
        ceth: fd.get('ceth') || '',
        productCode: fd.get('productCode') || '',
        brandName: (fd.get('brandName') || '').toUpperCase(), model: (fd.get('model') || '').toUpperCase(), endUse: (fd.get('endUse') || '').toUpperCase(),
        genericDesc: (fd.get('genericDesc') || '').toUpperCase(), manufacturer: (fd.get('manufacturer') || '').toUpperCase(), countryOfOrigin: (fd.get('countryOfOrigin') || '').toUpperCase(),
        accessories: (fd.get('accessories') || '').toUpperCase(), sourceCountry: (fd.get('sourceCountry') || '').toUpperCase(), transitCountry: (fd.get('transitCountry') || '').toUpperCase(),
        rateTypeFlag: fd.get('rateTypeFlag') || '',
        desc: fd.get('desc') || '',
        productDescription: fd.get('desc') || '',
        qty: fd.get('qty') || '',
        quantity: fd.get('qty') || '',
        unit: fd.get('uqc') || fd.get('unit') || '',  // the box is named uqc; unit stayed empty -> blank UQC in the BE JSON (28-Oct-2026)
        uqc: fd.get('uqc') || fd.get('unit') || '',
        descOnlyInChecklist: fd.get('descOnlyInChecklist') || '',
        price: fd.get('price') || '',
        unitPrice: fd.get('price') || '',
        value: fd.get('value') || '',
        assessableValue: fd.get('value') || '',
        igstDutyFlag: fd.get('igstDutyFlag') || '',
        svbFlag: fd.get('svbFlag') || '',
        foc: fd.get('foc') || 'N',
        bcdNotificationNo: fd.get('bcdNotificationNo') || '',
        bcdSrNo: fd.get('bcdSrNo') || '',
        bcdRate: fd.get('bcdRate') || '',
        bcdFlag: fd.get('bcdFlag') || '',
        bcdAmount: fd.get('bcdAmount') || '',
        bcdUnit: fd.get('bcdUnit') || '',
        // 30-Oct-2026: the specific (per-unit) side of the BCD line and how to apply it
        bcdSpecAmount: fd.get('bcdSpecAmount') || '',
        bcdRateBasis: fd.get('bcdRateBasis') || '',
        specQty: fd.get('specQty') || '',
        cvdNotificationNo: fd.get('cvdNotificationNo') || '',
        cvdSrNo: fd.get('cvdSrNo') || '',
        cvdRate: fd.get('cvdRate') || '',
        cvdFlag: fd.get('cvdFlag') || '',
        cvdAmount: fd.get('cvdAmount') || '',
        cvdUnit: fd.get('cvdUnit') || '',
        adlCvdNotificationNo: fd.get('adlCvdNotificationNo') || '',
        adlCvdSrNo: fd.get('adlCvdSrNo') || '',
        adlCvdRate: fd.get('adlCvdRate') || '',
        adlCvdFlag: fd.get('adlCvdFlag') || '',
        adlCvdAmount: fd.get('adlCvdAmount') || '',
        adlCvdUnit: fd.get('adlCvdUnit') || '',
        swsNotificationNo: fd.get('swsNotificationNo') || '',
        swsSrNo: fd.get('swsSrNo') || '',
        swsRate: fd.get('swsRate') || '',
        swsFlag: fd.get('swsFlag') || '',
        swsAmount: fd.get('swsAmount') || '',
        swsUnit: fd.get('swsUnit') || '',
        saptaNotificationNo: fd.get('saptaNotificationNo') || '',
        saptaSrNo: fd.get('saptaSrNo') || '',
        saptaRate: fd.get('saptaRate') || '',
        saptaFlag: fd.get('saptaFlag') || '',
        saptaAmount: fd.get('saptaAmount') || '',
        saptaUnit: fd.get('saptaUnit') || '',
        healthCessNotificationNo: fd.get('healthCessNotificationNo') || '',
        healthCessSrNo: fd.get('healthCessSrNo') || '',
        healthCessRate: fd.get('healthCessRate') || '',
        healthCessFlag: fd.get('healthCessFlag') || '',
        healthCessAmount: fd.get('healthCessAmount') || '',
        healthCessUnit: fd.get('healthCessUnit') || '',
        schemeCodCategoryFlag: fd.get('schemeCodCategoryFlag') || '',
        licenceFlag: fd.get('licenceFlag') || '',
        reImportFlag: fd.get('reImportFlag') || '',
        rspDutyFlag: fd.get('rspDutyFlag') || '',
        ncdCustomDutyFlag: fd.get('ncdCustomDutyFlag') || '',
        antiDumpingDutyFlag: fd.get('antiDumpingDutyFlag') || '',
        otherDutyFlag: fd.get('otherDutyFlag') || '',
        swInfotypeFlag: fd.get('swInfotypeFlag') || '',
        swConstituentFlag: fd.get('swConstituentFlag') || '',
        swProductionFlag: fd.get('swProductionFlag') || '',
        swControlFlag: fd.get('swControlFlag') || '',
        swStatementFlag: fd.get('swStatementFlag') || '',
        supportingDocsFlag: fd.get('supportingDocsFlag') || '',
        customsCvdFlag: fd.get('customsCvdFlag') || '',
        policyParaFlag: fd.get('policyParaFlag') || '',
        exciseFlag: fd.get('exciseFlag') || '',
        printGenDescFlag: fd.get('printGenDescFlag') || '',
        previousBeFlag: fd.get('previousBeFlag') || '',
        antiDumpingData: selectedItem.addData || null,
        otherDutyData: selectedItem.otherDutyData || null,
        igstData: (ctx.takePendingIgst && ctx.takePendingIgst(fd.get('ritc') || fd.get('hsCode'), selectedRowId)) || selectedItem.igstData || null, // pending = Tariff master's IGST for an item that had none
        svbItemData: selectedItem.svbData || null,
        schemeCategoryData: selectedItem.schemeCatData || null,
        policyParaData: selectedItem.policyParaData || null,
        previousBeData: selectedItem.prevBeData || null,
        cvdData: selectedItem.cvdData || null,
        docsData: selectedItem.docsData || null,
        swInfoData: selectedItem.swInfoData || null,
        swConstData: selectedItem.swConstData || null,
        swProdData: selectedItem.swProdData || null,
        swCtrlData: selectedItem.swCtrlData || null,
        swStmtData: selectedItem.swStmtData || null,
        reimportData: selectedItem.reimportData || null,
        rspData: selectedItem.rspData || null,
        ncdData: selectedItem.ncdData || null,
      } : it);
      setItems(newItems);
      if (onSave) setTimeout(() => onSave({ items: newItems, _notify: 'Item ' + (fd.get('itemSrNo') || '') + ' modified' }), 50);
    };

  const handleDelete = async (e) => {
    if(e) e.preventDefault();
    if (!selectedRowId || !items.some(it => it.id === selectedRowId)) {
      toast.error("Please select the item in the grid first (click its row), then Delete.");
      return;
    }
    // 22-Nov-2026: the program's own window in place of the browser's OK / Cancel box
    if (await askConfirm({ title: 'Delete this item?', message: 'Item Sr No ' + (selectedItem?.itemSrNo || '') + (selectedItem?.desc ? ' - ' + String(selectedItem.desc).slice(0, 60) : ''), note: 'The item is removed from this job. This cannot be undone.', okLabel: 'Delete', cancelLabel: 'Keep it', tone: 'danger' })) {
      const newItems = items.filter(it => it.id !== selectedRowId);
      setItems(newItems);
      if (onSave) setTimeout(() => onSave({ items: newItems, _notify: 'Item deleted' }), 50);
      setSelectedRowId(null);
    }
  };

  const handleDeleteMultiple = async (e) => {
    if(e) e.preventDefault();
    if(checkedIds.length === 0) {
      toast.error("Please select items to delete using checkboxes!");
      return;
    }
    if (await askConfirm({ title: 'Delete ' + checkedIds.length + ' item(s)?', message: 'The ticked items are removed from this job.', note: 'This cannot be undone.', okLabel: 'Delete', cancelLabel: 'Keep them', tone: 'danger' })) {
      deleteSelected();
    }
  };
  return { applyQuickQty, handleArrangeItemSerial, handleClear, handleDelete, handleDeleteMultiple, handleDutyCalculate, handleModify, handleReadFile, handleRecalculate, handleSave };
}
