// State and logic, part 1 of 2
// Split out of ItemGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import askConfirm, { askText } from '../../../common/askConfirm'; // EagleView windows in place of prompt() / confirm(), 20-Nov-2026
import { useGridFeatures } from '../../../../hooks/useGridFeatures';
import { useJobContext } from '../../JobContext';
import { normDoc } from '../../EsanchitDocsPanel';
import { initialItems, refreshItemDutyBoxes } from './helpers';
import { downloadItemWorkbook, readControlRowsFor } from '../jobExcel';

export default function useItemGridTab1(ctx) {
  const fileInputRef = useRef(null);
  const [defaultIcegateId, setDefaultIcegateId] = React.useState('');
  React.useEffect(() => {
    fetch('/api/icegate-profiles')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data && json.data.length > 0) {
           const def = json.data.find(p => p.isDefault) || json.data[0];
           setDefaultIcegateId(def.loginId);
        }
      }).catch(e => console.log(e));
  }, []);

  const { jobData, setJobData, items: globalItems, setItems: setGlobalItems, masters, esanchitDocs, setEsanchitDocs, registerPendingEdits } = useJobContext();
  const [invoices, setInvoices] = useState([]);
  const [showRitcModal, setShowRitcModal] = useState(false);
  const [ritcSearch, setRitcSearch] = useState('');
  const [showCthModal, setShowCthModal] = useState(false);
  const [cthSearch, setCthSearch] = useState('');
  const [showCethModal, setShowCethModal] = useState(false);
  const [cethSearch, setCethSearch] = useState('');
  const [showIgstModal, setShowIgstModal] = useState(false);
  const [showSvbModal, setShowSvbModal] = useState(false);
  const [showSchemeCategoryModal, setShowSchemeCategoryModal] = useState(false);
  const [showSchemeSearchModal, setShowSchemeSearchModal] = useState(false);
  const [schemeSearch, setSchemeSearch] = useState('');
  // Popup data comes back from the database as text after a reload: read it as a list / object. 28-Oct-2026
  const asArr = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } return Array.isArray(v) ? v : []; };
  const asObj = (v, dflt) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } return v && typeof v === 'object' && !Array.isArray(v) ? { ...dflt, ...v } : { ...dflt }; };
  // 30-Oct-2026: an item read from an ICEGATE / other-ERP file carries the popup values as FLAT ICEGATE keys
  // (svbReferenceNumber, previousBeNo ...). They were filed (the builder reads them) but no popup showed them, so the
  // operator could neither see nor clear them. The popup now opens with those values when its own object is empty.
  const flatOf = (it, map) => { const o = {}; Object.entries(map).forEach(([k, src]) => { const v = it && it[src]; if (v !== undefined && v !== null && String(v).trim() !== '') o[k] = String(v); }); return o; };
  // saving a popup blanks the flat keys of the same thing, so the builder files the popup (and a cleared popup clears the file)
  const blank = (...ks) => Object.fromEntries(ks.map(k => [k, '']));
  const FLAT_BLANK = { cvd: blank('cvdNotificationNo', 'cvdSrNo'), svb: blank('svbReferenceNumber', 'svbReferenceDate', 'svbLoadAssessableValue', 'svbLoadOnDuty', 'whetherLoadProvisionalOnAssessableValue', 'whetherLoadProvisionalOnDuty', 'customHouseCodeWhichHasImposedLoad'),
    add: blank('antiDumpingDutyNotification', 'antiDumpingDutySerialNumber', 'cthSerialNumber', 'supplierSerialNumber', 'quantityAsPerAntiDumpingNotn'), pp: blank('policyParaNo', 'policyYear'), ncd: blank('ncdNotn', 'ncdNotnSrNo'),
    pb: blank('previousBeNo', 'previousBeDate', 'prevUnitPriceInvoiced', 'prevCurrencyCode', 'prevCustomSite') };
  const popup = (it, own, dflt, map) => { const v = asObj(own, {}); return Object.keys(v).some(k => String(v[k] ?? '').trim() !== '') ? { ...dflt, ...v } : { ...dflt, ...flatOf(it, map) }; };
  // After a popup is saved, its flag box on the item form shows Y (or blank when the popup is emptied). 28-Oct-2026
  const setFormFlag = (name, on) => { const el = document.querySelector('#item-form [name="' + name + '"]'); if (el) el.value = on ? 'Y' : ''; return on ? 'Y' : ''; };
  const hasAny = (o) => !!o && Object.entries(o).some(([k, v]) => !['flag', 'type', 'id'].includes(k) && String(v ?? '').trim() !== '');
  const [showSwInfoModal, setShowSwInfoModal] = useState(false);
  const [tempSwConstData, setTempSwConstData] = useState([]);
  const [swConstForm, setSwConstForm] = useState({ srNo: '', name: '', code: '', percent: '', yield: '', active: '' });
  
  const openSwConstModal = () => {
    if (!selectedRowId) { toast("Select an item first"); return; }
    setTempSwConstData(asArr(selectedItem.swConstData));
    setSwConstForm({ srNo: '', name: '', code: '', percent: '', yield: '', active: '' });
    setShowSwConstModal(true);
  };
  
  const addSwConstRow = () => {
    if (!swConstForm.name) { toast.error('Enter the constituent name'); return; }
    setTempSwConstData([...tempSwConstData, { ...swConstForm, id: Date.now() }]);
    setSwConstForm({ srNo: '', name: '', code: '', percent: '', yield: '', active: '' });
  };
  
  const removeSwConstRow = (id) => {
    setTempSwConstData(tempSwConstData.filter(r => r.id !== id));
  };
  
  const saveSwConstModal = () => {
    const f = setFormFlag('swConstituentFlag', tempSwConstData.length > 0);
    setItems(items.map(it => it.id === selectedRowId ? { ...it, swConstData: tempSwConstData, swConstituentFlag: f } : it));
    setShowSwConstModal(false);
  };

  const [tempSwInfoData, setTempSwInfoData] = useState([]);
  const [swInfoForm, setSwInfoForm] = useState({ agency: 'ALL', type: 'Select', qualifier: 'Select', code: 'Select', text: '', qty: '', uqc: '' });
  
  const openSwInfoModal = () => {
    if (!selectedRowId) { toast("Select an item first"); return; }
    setTempSwInfoData(asArr(selectedItem.swInfoData));
    setSwInfoForm({ agency: 'ALL', type: 'Select', qualifier: 'Select', code: 'Select', text: '', qty: '', uqc: '' });
    setShowSwInfoModal(true);
  };
  
  // 30-Oct-2026: a row could be added with the placeholder "Select" still in the qualifier / code boxes. The builder
  // blanked them when filing, so the screen showed a row that went out empty (ICES then asks for the SW information).
  // The placeholders are cleared here and the row is refused until the mandatory parts are chosen.
  const addSwInfoRow = () => {
    const clean = (v) => { const t = String(v || '').trim(); return /^select$/i.test(t) ? '' : t; };
    const row = { ...swInfoForm, agency: clean(swInfoForm.agency) || 'ALL', type: clean(swInfoForm.type), qualifier: clean(swInfoForm.qualifier), code: clean(swInfoForm.code) };
    if (!row.type) { toast.error('Choose the Information Type first'); return; }
    if (!row.qualifier) { toast.error('Choose the Qualifier for ' + row.type); return; }
    // ORC (origin / FTA) and DTY rows carry a code; CHR / SQC carry the measure and its UQC
    if (['ORC', 'DTY'].includes(row.type.toUpperCase()) && !row.code) { toast.error(row.type + ' needs the Information Code'); return; }
    if (['CHR', 'SQC'].includes(row.type.toUpperCase()) && !String(row.qty || '').trim()) { toast.error(row.type + ' needs the quantity (measure)'); return; }
    if (!row.code && !String(row.text || '').trim() && !String(row.qty || '').trim()) { toast.error('Enter the Information Code, text or quantity'); return; }
    setTempSwInfoData([...tempSwInfoData, { ...row, id: Date.now() }]);
    setSwInfoForm({ agency: 'ALL', type: 'Select', qualifier: 'Select', code: 'Select', text: '', qty: '', uqc: '' });
  };
  
  const removeSwInfoRow = (id) => {
    setTempSwInfoData(tempSwInfoData.filter(r => r.id !== id));
  };
  
  const saveSwInfoModal = () => {
    const f = setFormFlag('swInfotypeFlag', tempSwInfoData.length > 0);
    setItems(items.map(it => it.id === selectedRowId ? { ...it, swInfoData: tempSwInfoData, swInfotypeFlag: f } : it));
    setShowSwInfoModal(false);
  };

  const applySwInfoToAll = () => {
    if (!selectedItem.invSrNo) {
      toast.error("Item doesn't have an Invoice No.");
      return;
    }
    setItems(items.map(it => String(it.invSrNo) === String(selectedItem.invSrNo) ? { ...it, swInfoData: tempSwInfoData } : it));
    toast.success("Applied to all items in Invoice!");
    setShowSwInfoModal(false);
  };

  const [swInfoType, setSwInfoType] = useState('Select');
  const [showSwConstModal, setShowSwConstModal] = useState(false);
  const [showReimportModal, setShowReimportModal] = useState(false);
  const [showSwProductionModal, setShowSwProductionModal] = useState(false);
  const [tempSwProdData, setTempSwProdData] = useState([]);
  const [swProdForm, setSwProdForm] = useState({ batch: '', qty: '', uqc: '', mnfDate: '', expDate: '', bestBefore: '' });
  
  const openSwProductionModal = () => {
    if (!selectedRowId) { toast("Select an item first"); return; }
    setTempSwProdData(asArr(selectedItem.swProdData));
    setSwProdForm({ batch: '', qty: '', uqc: '', mnfDate: '', expDate: '', bestBefore: '' });
    setShowSwProductionModal(true);
  };
  
  const addSwProdRow = () => {
    if(!swProdForm.batch) return;
    setTempSwProdData([...tempSwProdData, { ...swProdForm, id: Date.now() }]);
    setSwProdForm({ batch: '', qty: '', uqc: '', mnfDate: '', expDate: '', bestBefore: '' });
  };
  
  const removeSwProdRow = (id) => {
    setTempSwProdData(tempSwProdData.filter(r => r.id !== id));
  };
  
  const saveSwProductionModal = () => {
    const f = setFormFlag('swProductionFlag', tempSwProdData.length > 0);
    setItems(items.map(it => it.id === selectedRowId ? { ...it, swProdData: tempSwProdData, swProductionFlag: f } : it));
    setShowSwProductionModal(false);
  };

  const [showRspModal, setShowRspModal] = useState(false);
  const [showSwControlModal, setShowSwControlModal] = useState(false);
  const [tempSwCtrlData, setTempSwCtrlData] = useState([]);
  const [swCtrlForm, setSwCtrlForm] = useState({ typeCode: 'Select', location: '', startDate: '', endDate: '', resultCode: '', resultText: '' });
  
  const openSwControlModal = () => {
    if (!selectedRowId) { toast("Select an item first"); return; }
    setTempSwCtrlData(asArr(selectedItem.swCtrlData));
    setSwCtrlForm({ typeCode: 'Select', location: '', startDate: '', endDate: '', resultCode: '', resultText: '' });
    setShowSwControlModal(true);
  };
  
  const addSwCtrlRow = () => {
    const code = String(swCtrlForm.typeCode || '').trim();
    if (!code || code === 'Select') { toast.error('Enter the control type code (e.g. SEC65)'); return; }
    if (code.length > 17 || /\s/.test(code)) { toast.error('Control type must be the ICEGATE code (max 17 characters, no spaces)'); return; }
    setTempSwCtrlData([...tempSwCtrlData, { ...swCtrlForm, id: Date.now() }]);
    setSwCtrlForm({ typeCode: 'Select', location: '', startDate: '', endDate: '', resultCode: '', resultText: '' });
  };
  
  const removeSwCtrlRow = (id) => {
    setTempSwCtrlData(tempSwCtrlData.filter(r => r.id !== id));
  };
  // 13-Nov-2026: control rows of this item from an Excel file (sheet SW_Control of the Job Excel / iCAFFE ImportExcel)
  const importSwCtrlExcel = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const invs = (jobData?.invoices && jobData.invoices.length) ? jobData.invoices : invoices;
        const r = readControlRowsFor(evt.target.result, invs, selectedItem || {});
        if (!r.total) { toast.error('No sheet "SW_Control" (or SW_CONTROL) with Control Type rows in this file'); return; }
        const same = (a, b) => ['typeCode', 'location', 'startDate', 'endDate', 'resultCode', 'resultText', 'slNo'].every(k => String(a[k] ?? '').trim().toUpperCase() === String(b[k] ?? '').trim().toUpperCase());
        const add = r.rows.filter(x => !tempSwCtrlData.some(h => same(h, x)));
        if (!add.length) { toast.error(r.rows.length ? 'These control rows are already in the list' : `No row of the file is for item ${selectedItem?.invSrNo || 1}/${selectedItem?.itemSrNo || ''} (${r.other} row(s) for other items)`); return; }
        setTempSwCtrlData([...tempSwCtrlData, ...add]);
        toast.success(`${add.length} control row(s) added - check them and click OK` + (r.other ? ` (${r.other} row(s) of other items left out)` : '') + (r.rows.length > add.length ? ` (${r.rows.length - add.length} already there)` : ''));
      } catch (e) { toast.error('Could not read the file: ' + e.message); }
    };
    reader.readAsArrayBuffer(file);
  };
  
  // 22-Nov-2026: the control rows of this item on every item of the job (an ex-bond has the same SEC65 row on all its
  // items). What belongs to the item is kept per item: a Result Text equal to this item's CTH becomes the other item's
  // CTH, a Sr No equal to this item's Item Sr No (or empty) becomes the other item's Item Sr No.
  const applySwControlToAll = async () => {
    if (!tempSwCtrlData.length) { toast.error('Add a control row first (ADD), then Apply to All Items'); return; }
    const others = items.filter(it => it.id !== selectedRowId);
    const had = others.filter(it => asArr(it.swCtrlData).some(r => !tempSwCtrlData.some(t => String(t.typeCode || '').toUpperCase() === String(r.typeCode || '').toUpperCase()))).length;
    if (!(await askConfirm({ title: 'Apply to all items?', message: `These ${tempSwCtrlData.length} control row(s) will be put on all ${items.length} item(s) of this job.`, note: 'Each item keeps its own CTH in Result Text and its own Item Sr No in Sr No.' + (had ? ` ${had} item(s) have other control rows now - they are replaced.` : ''), okLabel: 'Apply to all items', cancelLabel: 'Cancel' }))) return;
    const up = (v) => String(v ?? '').trim().toUpperCase();
    const myCth = up(selectedItem.cth || selectedItem.ritc), mySr = up(selectedItem.itemSrNo || selectedItem.itemNo);
    const f = setFormFlag('swControlFlag', true);
    setItems(items.map((it, n) => it.id === selectedRowId ? { ...it, swCtrlData: tempSwCtrlData, swControlFlag: f } : {
      ...it, swControlFlag: f,
      swCtrlData: tempSwCtrlData.map((r, k) => ({ ...r, id: Date.now() + n * 100 + k,
        resultText: myCth && up(r.resultText) === myCth ? String(it.cth || it.ritc || '').trim() : r.resultText,
        slNo: (!up(r.slNo) || up(r.slNo) === mySr) ? String(it.itemSrNo || it.itemNo || '').trim() : r.slNo })) }));
    toast.success(`Control row(s) applied to all ${items.length} items - press MODIFY on this item, then Save in Job Header`);
    setShowSwControlModal(false);
  };
  const saveSwControlModal = () => {
    const f = setFormFlag('swControlFlag', tempSwCtrlData.length > 0);
    setItems(items.map(it => it.id === selectedRowId ? { ...it, swCtrlData: tempSwCtrlData, swControlFlag: f } : it));
    setShowSwControlModal(false);
  };

  const [showNcdModal, setShowNcdModal] = useState(false);
  const [showSwStatementModal, setShowSwStatementModal] = useState(false);
  const [tempSwStmtData, setTempSwStmtData] = useState([]);
  const [swStmtForm, setSwStmtForm] = useState({ typeCode: 'Select', stmtCode: 'Select', stmtText: '', stmtFor: 'Select' });
  
  // 09-Nov-2026: BE and invoice level statements live once on the job (jobData._statements, e.g. the ones loaded from
  // iCAFFE or an imported BE). The popup now shows them with the item's own rows (as the Supporting Docs popup does),
  // and on OK a BE / Invoice row goes back to the job, an Item row stays on the item - so a BE statement is sent once.
  const stmtOpenIdx = useRef(new Set()); // job rows the open popup is showing
  const lvlOf = (r) => { const inv = String(r.invoiceSerialNumber ?? r.invoiceSrNo ?? r.invSrNo ?? '0'), itm = String(r.itemSerialNumber ?? r.itemSrNo ?? '0');
    return itm !== '0' ? 'Item' : inv === '0' ? 'BE' : 'Invoice'; };
  const jobStmtRowsOf = (it) => asArr(jobData && jobData._statements).map((r, i) => ({ r, i })).filter(({ r }) => {
    const l = lvlOf(r); return l === 'BE' || (l === 'Invoice' && String(r.invoiceSerialNumber ?? r.invoiceSrNo ?? r.invSrNo) === String(it.invSrNo || ''));
  });
  const openSwStatementModal = () => {
    if (!selectedRowId) { toast("Select an item first"); return; }
    const shared = jobStmtRowsOf(selectedItem);
    stmtOpenIdx.current = new Set(shared.map(x => x.i));
    setTempSwStmtData([...asArr(selectedItem.swStmtData), ...shared.map(({ r, i }) => ({ typeCode: r.statementType || '', stmtCode: r.statementCode || '', stmtText: r.statementText || '', stmtFor: lvlOf(r), id: 'job-' + i }))]);
    setSwStmtForm({ typeCode: 'Select', stmtCode: 'Select', stmtText: '', stmtFor: 'Select' });
    setShowSwStatementModal(true);
  };
  
  const addSwStmtRow = () => {
    if (!swStmtForm.typeCode || swStmtForm.typeCode === 'Select') { toast.error('Select the statement type (DEC / UTG / REM)'); return; }
    if (!swStmtForm.stmtCode || swStmtForm.stmtCode === 'Select') { toast.error('Enter the statement code'); return; }
    if (swStmtForm.typeCode === 'REM' && !String(swStmtForm.stmtText || '').trim()) { toast.error('REM statement needs the text'); return; }
    setTempSwStmtData([...tempSwStmtData, { ...swStmtForm, id: Date.now() }]);
    setSwStmtForm({ typeCode: 'Select', stmtCode: 'Select', stmtText: '', stmtFor: 'Select' });
  };
  
  const removeSwStmtRow = (id) => {
    setTempSwStmtData(tempSwStmtData.filter(r => r.id !== id));
  };
  
  const saveSwStatementModal = () => {
    const isJobLvl = (r) => /^(BE|INVOICE)$/i.test(String(r.stmtFor || ''));
    const own = tempSwStmtData.filter(r => !isJobLvl(r));
    const toJob = tempSwStmtData.filter(isJobLvl).map(r => ({ invoiceSrNo: /^BE$/i.test(r.stmtFor) ? '0' : String(selectedItem.invSrNo || '1'), itemSrNo: '0',
      statementType: r.typeCode, statementCode: r.stmtCode, statementText: r.stmtText || '', stmtFor: /^BE$/i.test(r.stmtFor) ? 'M' : 'N' }));
    const shown = stmtOpenIdx.current;
    if (toJob.length || shown.size) {
      const keep = asArr(jobData && jobData._statements).filter((r, i) => !shown.has(i));
      const seen = new Set(); const all = [...keep, ...toJob].filter(r => { const k = [lvlOf(r), r.invoiceSrNo ?? r.invoiceSerialNumber, r.itemSrNo ?? r.itemSerialNumber, r.statementType, r.statementCode, r.statementText].join('|'); if (seen.has(k)) return false; seen.add(k); return true; });
      setJobData(prev => ({ ...prev, _statements: all }));
    }
    const f = setFormFlag('swStatementFlag', tempSwStmtData.length > 0);
    setItems(items.map(it => it.id === selectedRowId ? { ...it, swStmtData: own, swStatementFlag: f } : it));
    setShowSwStatementModal(false);
  };

  const applySwStatementToAll = () => {
    if (!selectedItem.invSrNo) {
      toast.error("Item doesn't have an Invoice No.");
      return;
    }
    setItems(items.map(it => String(it.invSrNo) === String(selectedItem.invSrNo) ? { ...it, swStmtData: tempSwStmtData } : it));
    toast.success("Applied to all items in Invoice!");
    setShowSwStatementModal(false);
  };

  const [showAntiDumpingModal, setShowAntiDumpingModal] = useState(false);
  const [showSupportingDocsModal, setShowSupportingDocsModal] = useState(false);
  const [showOtherDutyModal, setShowOtherDutyModal] = useState(false);
  const [showCustomsCvdModal, setShowCustomsCvdModal] = useState(false);
  const [showPolicyParaModal, setShowPolicyParaModal] = useState(false);
  const [showPreviousBeModal, setShowPreviousBeModal] = useState(false);
  const [addInMiddle, setAddInMiddle] = useState('N');

  const [tempSchemeCatData, setTempSchemeCatData] = useState([]);
  const [schemeCatForm, setSchemeCatForm] = useState({ ritc: '', schemeCode: '', licenseNo: '', date: '' });
  
  const openSchemeCategoryModal = () => {
    if (!selectedRowId) { toast("Select an item first"); return; }
    setTempSchemeCatData(asArr(selectedItem.schemeCatData));
    setSchemeCatForm({ ritc: '', schemeCode: '', licenseNo: '', date: '' });
    setShowSchemeCategoryModal(true);
  };
  
  const addSchemeCatRow = () => {
    if(!schemeCatForm.schemeCode) return;
    setTempSchemeCatData([...tempSchemeCatData, { ...schemeCatForm, id: Date.now() }]);
    setSchemeCatForm({ ritc: '', schemeCode: '', licenseNo: '', date: '' });
  };
  
  const removeSchemeCatRow = (id) => {
    setTempSchemeCatData(tempSchemeCatData.filter(r => r.id !== id));
  };
  
  const saveSchemeCategoryModal = () => {
    const f = setFormFlag('schemeCodCategoryFlag', tempSchemeCatData.length > 0);
    setItems(items.map(it => it.id === selectedRowId ? { ...it, schemeCatData: tempSchemeCatData, schemeCodCategoryFlag: f } : it));
    setShowSchemeCategoryModal(false);
  };


  const [tempIgstData, setTempIgstData] = useState({ notnNo: '', srNo: '', rate: '', flag: 'A', amount: '' });
  
  // Duty notification rows of the item (sbedutyModel in the BE JSON): AIDC (C/A), IGST (G/I), Compensation cess (G/P)...
  // The grid in the popup used to show 3 fixed sample rows and saved nothing. Now the rows are the item's own (item.dutyRows),
  // first filled from an imported BE / the IGST line, and editable. 28-Oct-2026
  const EMPTY_DUTY = { dutyType: 'C', addlDutyFlag: 'A', igstFlag: '', notificationNo: '', notificationSrNo: '', exmpNotificationNo: '', exmpNotificationSrNo: '' };
  const [tempDutyRows, setTempDutyRows] = useState([]);
  const [dutyForm, setDutyForm] = useState(EMPTY_DUTY);
  const [dutyEditIdx, setDutyEditIdx] = useState(null);
  const parseList = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } return Array.isArray(v) ? v : null; };

  const openIgstModal = () => {
    if (!selectedRowId) { toast("Select an item first"); return; }
    const ig = (typeof selectedItem.igstData === 'string' ? (() => { try { return JSON.parse(selectedItem.igstData); } catch (e) { return null; } })() : selectedItem.igstData);
    setTempIgstData(ig || { notnNo: '', srNo: '', rate: '', flag: 'A', amount: '' });
    let rows = parseList(selectedItem.dutyRows);
    if (!rows) {
      const inv = String(selectedItem.invSrNo || selectedItem.invoiceSrNo || 1), itm = String(selectedItem.itemSrNo || '');
      const all = parseList(jobData?._duties) || parseList(jobData?._sbedutyModel) || [];
      rows = all.filter(d => String(d.invoiceSerialNumber || d.invoiceSrNo || '1') === inv && String(d.itemSerialNumber || d.itemSrNo || '1') === itm)
        .map(d => ({ dutyType: d.dutyType || '', addlDutyFlag: d.addlDutyFlag || '', igstFlag: d.customsNotnExemptingIgstFlag || '', notificationNo: d.notificationNo || '',
          notificationSrNo: d.notificationSrNo || '', exmpNotificationNo: d.exmpNotificationNo || '', exmpNotificationSrNo: d.exmpNotificationSrNo || '' }));
      if (ig && ig.notnNo && !rows.some(r => r.dutyType === 'G' && r.addlDutyFlag === 'I'))
        rows.push({ ...EMPTY_DUTY, dutyType: 'G', addlDutyFlag: 'I', notificationNo: ig.notnNo, notificationSrNo: ig.srNo || '' });
    }
    setTempDutyRows(rows.map((r, i) => ({ ...EMPTY_DUTY, ...r, _k: Date.now() + i })));
    setDutyForm(EMPTY_DUTY); setDutyEditIdx(null);
    setShowIgstModal(true);
  };

  const addDutyRow = () => {
    const f = { ...dutyForm, notificationNo: String(dutyForm.notificationNo || '').trim(), notificationSrNo: String(dutyForm.notificationSrNo || '').trim() };
    if (!f.notificationNo) { toast.error('Enter the notification no.'); return; }
    if (!f.dutyType || !f.addlDutyFlag) { toast.error('Select Duty Type and Add Duty Type'); return; }
    setTempDutyRows(prev => dutyEditIdx !== null ? prev.map((r, i) => i === dutyEditIdx ? { ...r, ...f } : r) : [...prev, { ...f, _k: Date.now() }]);
    setDutyForm(EMPTY_DUTY); setDutyEditIdx(null);
  };
  const editDutyRow = (i) => { setDutyForm({ ...EMPTY_DUTY, ...tempDutyRows[i] }); setDutyEditIdx(i); };
  const removeDutyRow = (i) => { setTempDutyRows(prev => prev.filter((_, k) => k !== i)); if (dutyEditIdx === i) { setDutyForm(EMPTY_DUTY); setDutyEditIdx(null); } };
  const clearDutyForm = () => { setDutyForm(EMPTY_DUTY); setDutyEditIdx(null); };

  const saveIgstModal = () => {
    let rows = tempDutyRows.map(({ _k, ...r }) => r);
    // IGST line typed above but no G/I row in the grid -> add it, so the BE JSON carries the IGST notification
    if (tempIgstData && String(tempIgstData.notnNo || '').trim() && !rows.some(r => r.dutyType === 'G' && r.addlDutyFlag === 'I'))
      rows = [...rows, { ...EMPTY_DUTY, dutyType: 'G', addlDutyFlag: 'I', notificationNo: String(tempIgstData.notnNo).trim(), notificationSrNo: String(tempIgstData.srNo || '').trim() }];
    const f = setFormFlag('igstDutyFlag', rows.length > 0 || hasAny(tempIgstData));
    setItems(items.map(it => it.id === selectedRowId ? { ...it, igstData: tempIgstData, dutyRows: rows, igstDutyFlag: f } : it));
    setShowIgstModal(false);
  };


  const [tempCvdData, setTempCvdData] = useState({ notnNo: '', srNo: '', rate: '', flag: 'A', amount: '' });
  
  const openCustomsCvdModal = () => {
    if (!selectedRowId) { toast("Select an item first"); return; }
    setTempCvdData(popup(selectedItem, selectedItem.cvdData, { notnNo: '', srNo: '', rate: '', flag: 'A', amount: '' }, { notnNo: 'cvdNotificationNo', srNo: 'cvdSrNo' }));
    setShowCustomsCvdModal(true);
  };
  
  const saveCustomsCvdModal = () => {
    const f = setFormFlag('customsCvdFlag', hasAny(tempCvdData));
    setItems(items.map(it => it.id === selectedRowId ? { ...it, ...FLAT_BLANK.cvd, cvdData: tempCvdData, customsCvdFlag: f } : it));
    setShowCustomsCvdModal(false);
  };


  const [tempSvbData, setTempSvbData] = useState({ refNo: '', date: '', loadDuty: '', loadValue: '', flag: 'A' });
  
  const openSvbModal = () => {
    if (!selectedRowId) { toast("Select an item first"); return; }
    setTempSvbData(popup(selectedItem, selectedItem.svbData && Object.keys(asObj(selectedItem.svbData, {})).length ? selectedItem.svbData : selectedItem.svbItemData, { refNo: '', date: '', loadDuty: '', loadValue: '', flag: 'A' },
      { refNo: 'svbReferenceNumber', date: 'svbReferenceDate', loadValue: 'svbLoadAssessableValue', loadDuty: 'svbLoadOnDuty', valueStatus: 'whetherLoadProvisionalOnAssessableValue', dutyStatus: 'whetherLoadProvisionalOnDuty', customHouse: 'customHouseCodeWhichHasImposedLoad', loadType: 'svbFlag' }));
    setShowSvbModal(true);
  };
  
  const saveSvbModal = () => {
    const f = setFormFlag('svbFlag', hasAny(tempSvbData));
    setItems(items.map(it => it.id === selectedRowId ? { ...it, ...FLAT_BLANK.svb, svbData: tempSvbData, svbItemData: tempSvbData, svbFlag: f } : it));
    setShowSvbModal(false);
  };


  const [tempAddData, setTempAddData] = useState({ notnNo: '', srNo: '', rate: '', amount: '', flag: 'A', cth: '', qty: '' });
  
  const openAntiDumpingModal = () => {
    if (!selectedRowId) { toast("Select an item first"); return; }
    setTempAddData(popup(selectedItem, selectedItem.addData && Object.keys(asObj(selectedItem.addData, {})).length ? selectedItem.addData : selectedItem.antiDumpingData, { notnNo: '', srNo: '', rate: '', amount: '', flag: 'A', cth: '', qty: '' },
      { notnNo: 'antiDumpingDutyNotification', srNo: 'antiDumpingDutySerialNumber', cth: 'cthSerialNumber', supSlNo: 'supplierSerialNumber', qty: 'quantityAsPerAntiDumpingNotn' }));
    setShowAntiDumpingModal(true);
  };
  
  const saveAntiDumpingModal = () => {
    const f = setFormFlag('antiDumpingDutyFlag', hasAny(tempAddData));
    setItems(items.map(it => it.id === selectedRowId ? { ...it, ...FLAT_BLANK.add, addData: tempAddData, antiDumpingData: tempAddData, antiDumpingDutyFlag: f } : it));
    setShowAntiDumpingModal(false);
  };


  const [tempDocsData, setTempDocsData] = useState([]);
  // Item e-Sanchit popup = the shared EsanchitDocsPanel (same as tab 5) in item mode, 29-Oct-2026. Rows are in the
  // panel's shape (irn, drn, docCode, fileName, issuer*, bene*, placeOfIssue, issueDate, docFor HEADER | INVOICE | ITEM,
  // invSrNo, itemSrNo). Item rows live on the item (docsData); invoice and BE rows live once on the job (esanchitDocs,
  // the rows tab 5 shows), so a BE document entered from any item is sent once. The popup shows the item's own rows
  // plus the job rows of its invoice and of the BE. Older item rows (refNo, issueLocation, date...) are read by normDoc.
  const docsOpenIds = useRef(new Set()); // job rows the open popup is showing
  const jobDocs = () => (Array.isArray(esanchitDocs) ? esanchitDocs : []).map((d, i) => normDoc(d, i));
  const jobRowsOfItem = (it) => jobDocs().filter(t => t.docFor === 'HEADER' || (t.docFor === 'INVOICE' && String(t.invSrNo || '') === String(it.invSrNo || '')));
  const openSupportingDocsModal = () => {
    if (!selectedRowId) { toast("Select an item first"); return; }
    const own = asArr(selectedItem.docsData).map((r, i) => normDoc(r, i)).map(r => ({ ...r, docFor: 'ITEM', invSrNo: String(selectedItem.invSrNo || ''), itemSrNo: String(selectedItem.itemSrNo || '') }));
    const shared = jobRowsOfItem(selectedItem);
    docsOpenIds.current = new Set(shared.map(t => t.id));
    setTempDocsData([...own, ...shared]);
    setShowSupportingDocsModal(true);
  };
  const saveSupportingDocsModal = () => {
    const rows = tempDocsData.map((d, i) => normDoc(d, i));
    // item rows -> this item; invoice / BE rows -> the job (replacing the job rows this popup showed)
    const own = rows.filter(r => r.docFor === 'ITEM').map(r => ({ ...r, invSrNo: String(selectedItem.invSrNo || ''), itemSrNo: String(selectedItem.itemSrNo || '') }));
    const toJob = rows.filter(r => r.docFor !== 'ITEM').map(r => ({ ...r, invSrNo: r.docFor === 'HEADER' ? '' : String(selectedItem.invSrNo || ''), itemSrNo: '' }));
    const shown = docsOpenIds.current;
    const keep = (Array.isArray(esanchitDocs) ? esanchitDocs : []).filter(t => !shown.has(t.id));
    if (toJob.length || shown.size) setEsanchitDocs([...keep, ...toJob].map((r, i) => ({ ...r, srNo: i + 1 })));
    const f = setFormFlag('supportingDocsFlag', own.length > 0);
    setItems(items.map(it => it.id === selectedRowId ? { ...it, docsData: own, supportingDocsFlag: f } : it));
    const noIrn = rows.filter(r => !r.irn).length;
    if (noIrn) toast(`${noIrn} document(s) have no IRN yet - attach the PDF and click Upload before filing`, { icon: '⚠️', duration: 6000 });
    setShowSupportingDocsModal(false);
  };
  // kept for older callers of the ctx (the popup itself no longer uses them)
  const docsForm = null, docsEditId = null, setDocsForm = () => {}, addDocsRow = () => {}, editDocsRow = () => {}, copyDocsRow = () => {}, removeDocsRow = () => {};


  const [tempOtherDutyData, setTempOtherDutyData] = useState({ dutyCode: '', amount: '', rate: '', flag: 'A' });
  
  const openOtherDutyModal = () => {
    if (!selectedRowId) { toast("Select an item first"); return; }
    setTempOtherDutyData(asObj(selectedItem.otherDutyData, { dutyCode: '', amount: '', rate: '', flag: 'A' }));
    setShowOtherDutyModal(true);
  };
  
  const saveOtherDutyModal = () => {
    const f = setFormFlag('otherDutyFlag', hasAny(tempOtherDutyData));
    setItems(items.map(it => it.id === selectedRowId ? { ...it, otherDutyData: tempOtherDutyData, otherDutyFlag: f } : it));
    setShowOtherDutyModal(false);
  };


  const [tempPolicyParaData, setTempPolicyParaData] = useState({ paraNo: '', year: '' });
  
  const openPolicyParaModal = () => {
    if (!selectedRowId) { toast("Select an item first"); return; }
    setTempPolicyParaData(popup(selectedItem, selectedItem.policyParaData, { paraNo: '', year: '' }, { paraNo: 'policyParaNo', year: 'policyYear' }));
    setShowPolicyParaModal(true);
  };
  
  const savePolicyParaModal = () => {
    const f = setFormFlag('policyParaFlag', hasAny(tempPolicyParaData));
    setItems(items.map(it => it.id === selectedRowId ? { ...it, ...FLAT_BLANK.pp, policyParaData: tempPolicyParaData, policyParaFlag: f } : it));
    setShowPolicyParaModal(false);
  };


  const [tempPrevBeData, setTempPrevBeData] = useState({ beNo: '', beDate: '', qty: '', uqc: '', unitPrice: '', currency: '', customHouse: '' });
  const [tempReimportData, setTempReimportData] = useState({ type: '', prevBeNo: '', prevBeDate: '' });
  const [tempRspData, setTempRspData] = useState({ rspRate: '', rspAmount: '' });
  // 30-Oct-2026: an item can carry more than one retail sale price (different MRP slabs of the same goods), each with
  // its own quantity and notification. The popup kept a single set of boxes, so only one RSP line could ever be filed.
  const [tempRspRows, setTempRspRows] = useState([]);
  const [rspEditIdx, setRspEditIdx] = useState(null);
  const [tempNcdData, setTempNcdData] = useState({ ncdRate: '', ncdAmount: '', ncdNotificationNo: '' });

  // Re-import / RSP / NCD: typing Y in the flag box opened the popup with the previous item's values. 28-Oct-2026
  const openReimportModal = () => { if (!selectedRowId) { toast("Select an item first"); return; } setTempReimportData(asObj(selectedItem.reimportData, { type: '', prevBeNo: '', prevBeDate: '' })); setShowReimportModal(true); };
  const saveReimportModal = () => { const f = setFormFlag('reImportFlag', hasAny(tempReimportData)); setItems(items.map(it => it.id === selectedRowId ? { ...it, reimportData: tempReimportData, reImportFlag: f } : it)); setShowReimportModal(false); };
  // the item keeps a list of RSP rows; a job saved earlier carries one object, which is read as a one-row list
  const rspRowsOf = (it) => {
    let r = it && it.rspData; if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = null; } }
    if (Array.isArray(r)) return r.map((x, i) => ({ id: x.id || Date.now() + i, ...x }));
    return r && (r.rspValue || r.rspNotificationNo || r.rspRate || r.rspAmount) ? [{ id: Date.now(), ...r }] : [];
  };
  const openRspModal = () => {
    if (!selectedRowId) { toast("Select an item first"); return; }
    const rows = rspRowsOf(selectedItem);
    setTempRspRows(rows); setRspEditIdx(null);
    setTempRspData({ rspDutyFlag: String(selectedItem.rspDutyFlag || (rows[0] && rows[0].rspDutyFlag) || '').toUpperCase(), rspValue: '', rspQty: '', rspNotificationNo: '', rspSrNo: '', rspRate: '', rspAmount: '' });
    setShowRspModal(true);
  };
  // Add / Update a slab: the retail price and the quantity sold at it are what ICES wants per RSP line
  const addRspRow = () => {
    const v = String(tempRspData.rspValue || '').trim();
    if (!(parseFloat(v) > 0)) { toast.error('Enter the retail sale price (RSP) of this slab'); return; }
    const q = String(tempRspData.rspQty || '').trim();
    if (q && !(parseFloat(q) > 0)) { toast.error('Quantity must be more than 0'); return; }
    const row = { id: rspEditIdx !== null ? tempRspRows[rspEditIdx].id : Date.now(), rspValue: v, rspQty: q,
      rspNotificationNo: String(tempRspData.rspNotificationNo || '').trim().toUpperCase(), rspSrNo: String(tempRspData.rspSrNo || '').trim(),
      rspRate: String(tempRspData.rspRate || '').trim(), rspAmount: String(tempRspData.rspAmount || '').trim() };
    const next = rspEditIdx !== null ? tempRspRows.map((x, i) => i === rspEditIdx ? row : x) : [...tempRspRows, row];
    // the slabs together cannot be more than the item quantity
    const itemQty = parseFloat(selectedItem?.qty || selectedItem?.quantity || 0) || 0;
    const sum = next.reduce((a, x) => a + (parseFloat(x.rspQty) || 0), 0);
    if (itemQty > 0 && sum > itemQty + 0.001) { toast.error('The slabs add up to ' + sum + ', more than the item quantity ' + itemQty); return; }
    setTempRspRows(next); setRspEditIdx(null);
    setTempRspData(prev => ({ rspDutyFlag: prev.rspDutyFlag, rspValue: '', rspQty: '', rspNotificationNo: '', rspSrNo: '', rspRate: '', rspAmount: '' }));
  };
  const editRspRow = (i) => { setTempRspData(prev => ({ ...prev, ...tempRspRows[i] })); setRspEditIdx(i); };
  const removeRspRow = (i) => { setTempRspRows(tempRspRows.filter((_, k) => k !== i)); if (rspEditIdx === i) setRspEditIdx(null); };
  const saveRspModal = () => {
    const fl = String(tempRspData.rspDutyFlag || '').trim().toUpperCase();
    const el = document.querySelector('#item-form [name="rspDutyFlag"]'); if (el && fl) el.value = fl;
    const rows = tempRspRows.map(r => ({ ...r, rspDutyFlag: fl || r.rspDutyFlag || '' }));
    setItems(items.map(it => it.id === selectedRowId ? { ...it, rspData: rows, ...(fl ? { rspDutyFlag: fl } : {}) } : it));
    setShowRspModal(false);
  };
  const openNcdModal = () => { if (!selectedRowId) { toast("Select an item first"); return; } setTempNcdData(popup(selectedItem, selectedItem.ncdData, { ncdRate: '', ncdAmount: '', ncdNotificationNo: '' }, { ncdNotificationNo: 'ncdNotn', ncdSrNo: 'ncdNotnSrNo' })); setShowNcdModal(true); };
  const saveNcdModal = () => { const f = setFormFlag('ncdCustomDutyFlag', hasAny(tempNcdData)); setItems(items.map(it => it.id === selectedRowId ? { ...it, ...FLAT_BLANK.ncd, ncdData: tempNcdData, ncdCustomDutyFlag: f } : it)); setShowNcdModal(false); };

  // Licence (BE licenseModel): licence no, date, code, port, item sr no in the licence, debit value / quantity. 28-Oct-2026
  const EMPTY_LIC = { licenceNo: '', licenceDate: '', licenceCode: '', regnPort: '', itemSrNoLicence: '', debitValue: '', debitQty: '', debitUqc: '' };
  const [showLicenceModal, setShowLicenceModal] = useState(false);
  const [tempLicenceData, setTempLicenceData] = useState([]);
  const [licenceForm, setLicenceForm] = useState(EMPTY_LIC);
  const [licenceEditId, setLicenceEditId] = useState(null);
  const openLicenceModal = () => {
    if (!selectedRowId) { toast("Select an item first"); return; }
    let rows = asArr(selectedItem.licenceData);
    // licences typed in Scheme Code Category before are offered here too
    if (!rows.length) rows = asArr(selectedItem.schemeCatData).filter(r => r.licenseNo).map((r, i) => ({ ...EMPTY_LIC, id: Date.now() + i, licenceNo: r.licenseNo, licenceDate: r.date || '', licenceCode: String(r.schemeCode || '').slice(0, 2) }));
    setTempLicenceData(rows); setLicenceForm({ ...EMPTY_LIC, debitUqc: selectedItem.uqc || selectedItem.unit || '' }); setLicenceEditId(null);
    setShowLicenceModal(true);
  };
  const addLicenceRow = () => {
    if (!String(licenceForm.licenceNo || '').trim()) { toast.error('Enter the Licence / Regn No'); return; }
    if (licenceEditId !== null) setTempLicenceData(tempLicenceData.map(r => r.id === licenceEditId ? { ...licenceForm, id: licenceEditId } : r));
    else setTempLicenceData([...tempLicenceData, { ...licenceForm, id: Date.now() }]);
    setLicenceForm({ ...EMPTY_LIC, debitUqc: licenceForm.debitUqc }); setLicenceEditId(null);
  };
  const editLicenceRow = (row) => { setLicenceForm({ ...EMPTY_LIC, ...row }); setLicenceEditId(row.id); };
  const removeLicenceRow = (id) => setTempLicenceData(tempLicenceData.filter(r => r.id !== id));
  const saveLicenceModal = () => { const f = setFormFlag('licenceFlag', tempLicenceData.length > 0); setItems(items.map(it => it.id === selectedRowId ? { ...it, licenceData: tempLicenceData, licenceFlag: f } : it)); setShowLicenceModal(false); };
  
  const openPreviousBeModal = () => {
    if (!selectedRowId) { toast("Select an item first"); return; }
    setTempPrevBeData(popup(selectedItem, selectedItem.prevBeData && Object.keys(asObj(selectedItem.prevBeData, {})).length ? selectedItem.prevBeData : selectedItem.previousBeData, { beNo: '', beDate: '', qty: '', uqc: '', unitPrice: '', currency: '', customHouse: '' },
      { beNo: 'previousBeNo', beDate: 'previousBeDate', unitPrice: 'prevUnitPriceInvoiced', currency: 'prevCurrencyCode', customHouse: 'prevCustomSite' }));
    setShowPreviousBeModal(true);
  };
  
  const savePreviousBeModal = () => {
    const f = setFormFlag('previousBeFlag', hasAny(tempPrevBeData));
    setItems(items.map(it => it.id === selectedRowId ? { ...it, ...FLAT_BLANK.pb, prevBeData: tempPrevBeData, previousBeData: tempPrevBeData, previousBeFlag: f } : it));
    setShowPreviousBeModal(false);
  };


  
  // (30-Oct-2026: the port "Search" popup and its open / save handlers are gone - nothing opened it and it saved nothing)

  
  // (30-Oct-2026: the invoice localStorage draft that was restored here is gone - the job is the source)
  const {
    data: items,
    setData: setItems,
    selectedRowId,
    setSelectedRowId,
    checkedIds,
    toggleCheck,
    checkAll,
    deleteSelected,
    duplicateRow,
    rowExists
  } = useGridFeatures({
    initialData: globalItems && globalItems.length > 0 ? globalItems : initialItems,
    onDuplicate: (id) => copyItemRowRef.current && copyItemRowRef.current(id) // Ctrl+D = Copy Item (next Item Sr No), never a same-Sr clone
  });
  const copyItemRowRef = useRef(null);

  const syncRef = useRef(items);
  
  // Sync DOWN from global to local (job load, save result, Excel / AI import). A save re-creates the rows with new
  // database ids, so the selection is carried over by invoice sr + item sr; when that item is gone, nothing is selected.
  React.useEffect(() => {
    if (globalItems !== syncRef.current) {
      const prev = items.find(it => it.id === selectedRowId);
      setItems(globalItems);
      syncRef.current = globalItems;
      if (prev) {
        const same = (globalItems || []).find(it => String(it.invSrNo || '1') === String(prev.invSrNo || '1') && String(parseInt(it.itemSrNo, 10) || '') === String(parseInt(prev.itemSrNo, 10) || ''));
        setSelectedRowId(same ? same.id : null);
      }
    }
  }, [globalItems, setItems]); // eslint-disable-line

  // Sync UP from local to global (e.g. User edits)
  React.useEffect(() => {
    if (items !== syncRef.current) {
      setGlobalItems(items);
      syncRef.current = items;
    }
  }, [items, setGlobalItems]);

  // no silent fallback to row 1: an unknown selection shows an empty (new) item form
  const selectedItem = items.find(item => item.id === selectedRowId) || {};

  // IRNs elsewhere on the job (other items' own rows, job rows of other invoices) - refused in the popup
  const docsOtherIrns = React.useMemo(() => {
    if (!showSupportingDocsModal) return [];
    const shown = docsOpenIds.current;
    const others = items.filter(it => it.id !== selectedRowId).flatMap(it => asArr(it.docsData).map(r => r && r.irn).filter(Boolean));
    const job = jobDocs().filter(t => !shown.has(t.id)).map(t => t.irn).filter(Boolean);
    return [...others, ...job];
  }, [showSupportingDocsModal, items, esanchitDocs, selectedRowId]); // eslint-disable-line


  
  
  const displayDuties = React.useMemo(() => {
    let duties = [];
    if (selectedItem) {
        const allDuties = jobData?._sbedutyModel || jobData?._sbedutymodel || jobData?._duties || [];
        duties = allDuties.filter(d => 
            String(d.invoiceSerialNumber || d.invoiceSrNo) === String(selectedItem.invSrNo) &&
            String(d.itemSerialNumber || d.itemSrNo) === String(selectedItem.itemSrNo)
        );
    }
    if (duties.length === 0) {
        return ['BCD', 'CVD', 'Adl. CVD', 'SWS', 'SAPTA', 'Health Cess'].map(name => ({
            _dutyName: name,
            notificationNo: '', notificationSrNo: '', dutyType: '', addlDutyFlag: (name === 'SWS' ? 'A' : ''), rate: (name === 'SWS' ? '10' : ''), amount: '', unit: ''
        }));
    }
    return duties.map(d => ({
        _dutyName: d.dutyType === 'C' ? 'CUS' : (d.dutyType === 'G' ? 'GST' : d.dutyType),
        notificationNo: d.notificationNo || '',
        notificationSrNo: d.notificationSrNo || '',
        dutyType: d.dutyType || '',
        addlDutyFlag: d.addlDutyFlag || '',
        rate: '',
        amount: '',
        unit: ''
    }));
  }, [selectedItem, jobData]);

  
  // The job's invoices (the item screen used a separate copy kept in the browser, often empty -> wrong invoice Sr No). 28-Oct-2026
  const jobInvoices = (jobData?.invoices && jobData.invoices.length) ? jobData.invoices : invoices;
  const setFormValue = (name, value) => { const el = document.querySelector('#item-form [name="' + name + '"]'); if (el) el.value = value; };
  const nextItemSr = (list, invSrNo) => String(Math.max(0, ...list.filter(it => String(it.invSrNo || '1') === String(invSrNo || '1')).map(it => parseInt(it.itemSrNo, 10) || 0)) + 1);

  // RITC / CTH / CETH lookup on the Tariff master ((i) buttons on the Item's Details row), 29-Oct-2026
  const [tariffSearch, setTariffSearch] = useState({ open: false, field: 'ritc', q: '', rows: [], loading: false, searched: false });
  const [autoDesc, setAutoDesc] = useState(false); // switch next to Item Description: on = the picked RITC's tariff text replaces the description
  const openTariffSearch = (field) => {
    const f = document.getElementById('item-form');
    const cur = String((f && f.elements[field] && f.elements[field].value) || '').trim();
    setTariffSearch({ open: true, field, q: cur, rows: [], loading: false, searched: false });
    if (cur) setTimeout(() => runTariffSearch(cur), 0);
  };
  const runTariffSearch = async (qArg) => {
    const q = String(typeof qArg === 'string' ? qArg : tariffSearch.q).trim();
    if (!q) { toast.error('Type a code or a description first'); return; }
    setTariffSearch(t => ({ ...t, q, loading: true }));
    try {
      const res = await fetch('/api/masters/tariffheaders/all?q=' + encodeURIComponent(q) + '&limit=80');
      const data = await res.json();
      const rows = (Array.isArray(data) ? data : []).map(h => { const c = (h.components || []).find(x => /BCD|BASIC/i.test(String(x.dutyCategory || ''))); return { id: h.id, hsnCode: h.hsnCode, description: h.description, uqc: h.uqc, bcd: c && c.rate != null && c.rate !== '' ? Number(c.rate) : null }; });
      setTariffSearch(t => ({ ...t, q, rows, loading: false, searched: true }));
    } catch (e) { setTariffSearch(t => ({ ...t, loading: false, searched: true, rows: [] })); toast.error('Tariff master not reachable: ' + e.message); }
  };
  const pickTariff = (r) => {
    const field = tariffSearch.field; const code = String(r.hsnCode || '').replace(/\D/g, '');
    const f = document.getElementById('item-form'); const cur = (n) => (f && f.elements[n] ? f.elements[n].value : '') || '';
    const upd = { [field]: code };
    setFormValue(field, code);
    if (field === 'ritc') {
      upd.hsCode = code;
      if (!cur('cth')) { upd.cth = code; setFormValue('cth', code); }
      // 18-Nov-2026: CETH as iCAFFE files it - NOEXCISE, except goods still under central excise (chapters 22 / 24 / 27).
      // Copying the RITC made DEL-AI-1002 go with CETH 98049000, refused by ICES (error 317 Invalid CETH).
      if (!cur('ceth')) { const ce = /^(22|24|27)/.test(code) ? code : 'NOEXCISE'; upd.ceth = ce; setFormValue('ceth', ce); }
      if (r.description && (autoDesc || !cur('desc'))) { upd.desc = r.description; upd.productDescription = r.description; setFormValue('desc', r.description); }
      if (r.uqc && !cur('uqc')) { upd.uqc = r.uqc; upd.unit = r.uqc; setFormValue('uqc', r.uqc); }
    }
    // only the boxes change: SAVE makes the new item / MODIFY writes the selected one from the form
    void upd;
    setTariffSearch(t => ({ ...t, open: false }));
    toast.success(field.toUpperCase() + ' ' + code + (r.description ? ' - ' + String(r.description).slice(0, 50) : ''));
    if (field === 'ritc') setTimeout(() => autoTariff(code), 50);
  };
  const deepCopy = (o) => JSON.parse(JSON.stringify(o));

  // 22-Nov-2026: the Tariff master is asked as soon as an 8-digit RITC is typed (leaving the RITC box) or picked in the
  // lookup - before, only the "Fetch Item" button did it. Only BLANK boxes are filled (description, BCD rate, UQC, CTH);
  // a typed value is never changed. The IGST rate + notification is kept aside and put on the item by SAVE / MODIFY of
  // the same RITC, so nothing is written to the job until the operator presses the button. A sibling line of the
  // heading (RITC not in the master) fills nothing.
  const autoTariffSeen = useRef(''); const pendingTariff = useRef(null);

  // 22-Nov-2026: "Last used" - what this importer's earlier jobs used for the same product (same description, a
  // description that starts the same, or the same model no; other clients when the importer never had it). Asked when
  // the description / model box is left while the RITC is still blank, or with the "Last Used" button. The operator
  // picks a line; only BLANK boxes are filled and nothing reaches the job before SAVE / MODIFY.
  const [itemHistory, setItemHistory] = useState(null); // { options, desc, model }
  // 22-Nov-2026: BCD exemption / concession notifications for the RITC just filled from the Tariff master - what the
  // office's own jobs file under (how often) and single-serial rows of the Notification master. The tariff rate alone
  // was offered (8542 39 00: 7.5 %), although nearly every job files it at 0 % under 024/2005 Sl 24.
  const [bcdExemptions, setBcdExemptions] = useState(null); // { ritc, tariffBcd, itemsFiled, options, also }
  const askBcdExemptions = async (ritc, tariffBcd) => {
    try {
      const f = document.getElementById('item-form'); if (!f) return;
      const cur = (n) => String((f.elements[n] ? f.elements[n].value : '') || '').trim();
      if (cur('bcdNotificationNo')) { setBcdExemptions(null); return; } // a notification is already typed
      const origin = String(cur('countryOfOrigin') || jobData?.countryOfOrigin || jobData?.autoField_20 || '').trim().toUpperCase();
      const j = await (await fetch('/api/tariff/exemptions/' + ritc + (/^[A-Z]{2}$/.test(origin) ? '?origin=' + origin : ''))).json();
      if (!j || !j.success) { setBcdExemptions(null); return; }
      const tb = tariffBcd === null || tariffBcd === undefined || tariffBcd === '' ? null : Number(tariffBcd);
      // filed before, or a master row that is lower than the tariff rate
      const options = (j.data || []).filter(g => g.used > 0 || (g.rate !== null && (tb === null || g.rate < tb)));
      if (!options.length) { setBcdExemptions(null); return; }
      setBcdExemptions({ ritc, tariffBcd: tb, itemsFiled: j.itemsFiled || 0, options, also: j.also || [] });
    } catch (e) { /* extra information only */ }
  };
  const applyBcdExemption = (g) => {
    const f = document.getElementById('item-form'); if (!f || !g) return;
    const cur = (n) => String((f.elements[n] ? f.elements[n].value : '') || '').trim();
    if (!bcdExemptions || cur('ritc').replace(/\D/g, '') !== bcdExemptions.ritc) { toast.error('The RITC box was changed - these notifications were for ' + (bcdExemptions ? bcdExemptions.ritc : 'another RITC')); setBcdExemptions(null); return; }
    setFormValue('bcdNotificationNo', g.notifNo); setFormValue('bcdSrNo', g.serialNo || '');
    if (g.rate !== null && g.rate !== undefined) setFormValue('bcdRate', String(g.rate));
    const rowId = selectedRowId && selectedItem.id ? selectedRowId : null;
    let live = rowId ? selectedItem : {}; const p = pendingTariff.current; if (p && p.ritc === bcdExemptions.ritc && String(p.rowId || '') === String(rowId || '')) live = { ...live, igstData: p.igstData };
    try { refreshItemDutyBoxes(live, (jobData?.invoices && jobData.invoices.length) ? jobData.invoices : invoices, jobData || {}); } catch (e) { /* estimate only */ }
    setBcdExemptions(null);
    toast.success(`BCD ${g.rate === null || g.rate === undefined ? '(type the rate)' : g.rate + '%'} under ${g.notifNo}${g.serialNo ? ' Sl ' + g.serialNo : ''} - check that the goods meet the notification${g.conditionNo ? ' (condition ' + g.conditionNo + ')' : ''}, then ${rowId ? 'MODIFY' : 'SAVE'}`, { duration: 8000 });
    if (Array.isArray(g.countries) && g.countries.length) toast(`${g.notifNo} is a country notification (${g.countries.slice(0, 8).join(', ')}${g.countries.length > 8 ? ' ...' : ''}) - it needs a valid certificate of origin.`, { icon: '🌐', duration: 10000 });
  };
  const histSeen = useRef('');
  useEffect(() => { setItemHistory(null); setBcdExemptions(null); histSeen.current = ''; }, [selectedRowId, jobData?.id]);
  const askItemHistory = async (byButton) => {
    const f = document.getElementById('item-form'); if (!f) return;
    const cur = (n) => String((f.elements[n] ? f.elements[n].value : '') || '').trim();
    const desc = cur('desc'), model = cur('model');
    if (!byButton && cur('ritc')) return; // the heading is already there
    if (!desc && !model) { if (byButton) toast('Type the item description (or model no) first'); return; }
    const mark = String(selectedRowId || 'new') + '|' + desc.toUpperCase() + '|' + model.toUpperCase();
    if (!byButton && histSeen.current === mark) return; histSeen.current = mark;
    try {
      const q = new URLSearchParams({ iec: String(jobData?.iecCode || jobData?.autoField_5 || '').trim(), desc, model, ...(jobData?.id ? { excludeJobId: String(jobData.id) } : {}) });
      const j = await (await fetch('/api/import-jobs/item-history?' + q)).json();
      const options = (j && j.success && Array.isArray(j.options)) ? j.options : [];
      if (!options.length) { setItemHistory(null); if (byButton) toast('No earlier entry of this description / model was found'); return; }
      setItemHistory({ options, desc, model });
    } catch (e) { histSeen.current = ''; if (byButton) toast.error('Could not read the earlier entries'); }
  };
  const applyItemHistory = async (g) => {
    const f = document.getElementById('item-form'); if (!f || !g || !g.fields) return;
    const F = g.fields; const cur = (n) => String((f.elements[n] ? f.elements[n].value : '') || '').trim();
    const has = (v) => v !== null && v !== undefined && String(v).trim() !== '';
    const filled = [];
    const put = (name, v, label) => { if (f.elements[name] && !cur(name) && has(v)) { setFormValue(name, String(v)); if (label) filled.push(label + ' ' + v); return true; } return false; };
    const typedRitc = cur('ritc').replace(/\D/g, '');
    if (typedRitc && typedRitc !== F.ritc) { toast.error(`The RITC box has ${typedRitc}; this earlier entry used ${F.ritc}. Clear the RITC box first if you want the earlier one.`, { duration: 7000 }); return; }
    put('ritc', F.ritc, 'RITC'); put('cth', F.cth || F.ritc); put('ceth', F.ceth); put('uqc', F.uqc, 'UQC');
    put('bcdNotificationNo', F.bcdNotificationNo); put('bcdSrNo', F.bcdSrNo); if (put('bcdRate', F.bcdRate)) filled.push('BCD ' + F.bcdRate + '%'); put('bcdFlag', F.bcdFlag);
    put('swsNotificationNo', F.swsNotificationNo); put('swsSrNo', F.swsSrNo); put('swsRate', F.swsRate); put('swsFlag', F.swsFlag);
    put('healthCessNotificationNo', F.healthCessNotificationNo); put('healthCessSrNo', F.healthCessSrNo); put('healthCessRate', F.healthCessRate);
    for (const [n, l] of [['brandName', 'brand'], ['model', 'model'], ['endUse', 'end use'], ['countryOfOrigin', 'origin'], ['genericDesc', ''], ['manufacturer', '']]) put(n, F[n], l);
    const rowId = selectedRowId && selectedItem.id ? selectedRowId : null;
    let ig = rowId ? selectedItem.igstData : null; if (typeof ig === 'string') { try { ig = JSON.parse(ig); } catch (e) { ig = null; } }
    let live = rowId ? selectedItem : {};
    if (!(ig && has(ig.rate)) && F.igstData && has(F.igstData.rate)) {
      const nig = { notnNo: '', srNo: '', flag: 'A', amount: '', ...(ig || {}), ...F.igstData };
      pendingTariff.current = { ritc: F.ritc, rowId, igstData: nig }; live = { ...live, igstData: nig };
      filled.push('IGST ' + nig.rate + '%' + (nig.srNo ? ' (' + nig.notnNo + ' Sl ' + nig.srNo + ')' : ''));
    }
    try { refreshItemDutyBoxes(live, (jobData?.invoices && jobData.invoices.length) ? jobData.invoices : invoices, jobData || {}); } catch (e) { /* estimate only */ }
    setItemHistory(null);
    if (filled.length) toast.success('From job ' + (g.lastJobNo || '') + ': ' + filled.join(', ') + ' - check, then ' + (rowId ? 'MODIFY' : 'SAVE'), { duration: 7000 });
    else toast('Nothing new: the boxes already have values');
    // a rate used months ago may have changed: say so when today's Tariff master differs
    try {
      const data = await (await fetch('/api/tariff/' + F.ritc)).json(); const t = data && data.success ? data.data : null;
      if (!t || t.exact === false) { if (t) toast(`RITC ${F.ritc} of the earlier entry is not in today's Tariff master - check the heading.`, { icon: '⚠️', duration: 9000 }); return; }
      const diff = []; const num = (v) => (has(v) ? parseFloat(v) : null);
      if (num(t.bcdRate) !== null && num(cur('bcdRate')) !== null && num(t.bcdRate) !== num(cur('bcdRate'))) diff.push(`BCD ${cur('bcdRate')}% here, ${t.bcdRate}% in the Tariff master`);
      const igNow = pendingTariff.current && pendingTariff.current.ritc === F.ritc ? pendingTariff.current.igstData : ig;
      if (num(t.igstRate) !== null && igNow && num(igNow.rate) !== null && num(t.igstRate) !== num(igNow.rate) && !t.igstRateVaries) diff.push(`IGST ${igNow.rate}% here, ${t.igstRate}% in the Tariff master`);
      if (diff.length) toast('The earlier entry differs from the Tariff master: ' + diff.join('; ') + '. A notification / exemption may explain it - check.', { icon: '⚠️', duration: 12000 });
      if (Array.isArray(t.pgaAgencies) && t.pgaAgencies.length) toast(`${F.ritc} is cleared by other agencies too: ${t.pgaAgencies.join(', ')}.`, { icon: '🏛️', duration: 8000 });
    } catch (e) { /* the comparison is extra */ }
  };
  const takePendingIgst = (ritc, rowId) => { const p = pendingTariff.current; if (!p || p.ritc !== String(ritc || '').replace(/\D/g, '') || String(p.rowId || '') !== String(rowId || '')) return null; pendingTariff.current = null; return p.igstData; };
  const autoTariff = async (raw) => {
    const ritc = String(raw || '').replace(/\D/g, ''); if (ritc.length !== 8) return;
    const rowId = selectedRowId && selectedItem.id ? selectedRowId : null;
    // a saved item is touched only when its RITC was changed in the box (walking through the box with Tab fills nothing)
    if (rowId && String(selectedItem.ritc || selectedItem.hsCode || '').replace(/\D/g, '') === ritc) return;
    // 22-Nov-2026: a code the master does not have is asked once; a code it has is asked again only while a box is
    // still blank (the mark used to stay after Clear / SAVE, so the next new item with the same RITC got nothing)
    if (autoTariffSeen.current === ritc) return;
    const f = document.getElementById('item-form'); if (!f) return;
    const cur = (n) => String((f.elements[n] ? f.elements[n].value : '') || '').trim();
    let ig = rowId ? selectedItem.igstData : null; if (typeof ig === 'string') { try { ig = JSON.parse(ig); } catch (e) { ig = null; } }
    const pend = pendingTariff.current; const pendHere = !!(pend && pend.ritc === ritc && String(pend.rowId || '') === String(rowId || ''));
    const needIgst = !(ig && String(ig.rate || '').trim()) && !pendHere;
    if (cur('bcdRate') && cur('desc') && cur('uqc') && !needIgst) return; // nothing blank to fill
    try {
      const data = await (await fetch('/api/tariff/' + ritc)).json();
      if (!data || !data.success) { autoTariffSeen.current = ritc; return; } // not in the master: the operator types the rates (Fetch Item says why)
      const t = data.data || {};
      if (cur('ritc').replace(/\D/g, '') !== ritc) return; // the box was changed while the master was asked
      if (t.exact === false) { autoTariffSeen.current = ritc; toast(`RITC ${ritc} is not in the Tariff master - rates were not filled. Check the rate in the tariff.`, { icon: '⚠️', duration: 7000 }); return; }
      const filled = [];
      if (!cur('desc') && t.description) { setFormValue('desc', t.description); filled.push('description'); }
      if (!cur('bcdRate') && t.bcdRate != null) { setFormValue('bcdRate', String(t.bcdRate)); filled.push('BCD ' + t.bcdRate + '%'); }
      if (!cur('uqc') && t.uqc) { setFormValue('uqc', t.uqc); filled.push('UQC ' + t.uqc); }
      if (!cur('cth')) setFormValue('cth', ritc);
      let live = rowId ? selectedItem : {};
      if (needIgst && t.igstRate != null) {
        const nig = { notnNo: '', srNo: '', flag: 'A', amount: '', ...(ig || {}), rate: String(t.igstRate) };
        if (!nig.notnNo && t.igstNotnNo) nig.notnNo = t.igstNotnNo;
        if (!nig.srNo && t.igstSrNo) nig.srNo = t.igstSrNo;
        pendingTariff.current = { ritc, rowId, igstData: nig }; live = { ...live, igstData: nig };
        filled.push('IGST ' + t.igstRate + '%' + (t.igstSrNo ? ' (' + t.igstNotnNo + ' Sl ' + t.igstSrNo + ')' : ''));
      }
      if (!filled.length) return;
      try { refreshItemDutyBoxes(live, (jobData?.invoices && jobData.invoices.length) ? jobData.invoices : invoices, jobData || {}); } catch (e) { /* estimate only */ }
      toast.success('From the Tariff master: ' + filled.join(', ') + ' - check, then ' + (rowId ? 'MODIFY' : 'SAVE'), { duration: 6000 });
      askBcdExemptions(ritc, t.bcdRate);
      if (t.igstRateVaries && Array.isArray(t.igstOptions)) {
        const list = t.igstOptions.slice(0, 6).map(o => o.notnNo + ' Sl ' + o.srNo + ' = ' + o.rate + '%').join(', ');
        toast(`IGST for ${ritc} depends on the goods description / value - ${t.igstOptions.length} serials apply: ${list}${t.igstOptions.length > 6 ? ', ...' : ''}. ${t.igstRate}% (Sl ${t.igstSrNo}) was used - check it.`, { icon: '⚠️', duration: 12000 });
      }
      if (Array.isArray(t.pgaAgencies) && t.pgaAgencies.length) toast(`${ritc} is cleared by other agencies too: ${t.pgaAgencies.join(', ')}. Fill the SWIFT / PGA details and their documents (e-Sanchit).`, { icon: '🏛️', duration: 10000 });
    } catch (e) { /* server not reachable: Fetch Item still works */ }
  };

  // Fetch Item: fills BLANK boxes from the Tariff master (it used to overwrite the description with the tariff text
  // and the screen did not show the values until the item was opened again). 28-Oct-2026
  const handleFetchItem = async () => {
    if (!selectedRowId || !selectedItem) { toast.error("Please select an item first"); return; }
    const f = document.getElementById('item-form');
    const ritc = String((f && f.elements.ritc && f.elements.ritc.value) || selectedItem.ritc || selectedItem.hsCode || '').replace(/\D/g, '');
    if (!ritc) { toast.error("RITC is required to fetch item details"); return; }
    try {
      const res = await fetch('/api/tariff/' + ritc);
      const data = await res.json();
      if (!data || !data.success) { toast.error(data?.message || "RITC not found in Tariff master"); return; }
      const t = data.data || {};
      const cur = (n) => (f && f.elements[n] ? f.elements[n].value : selectedItem[n]) || '';
      const filled = [];
      const upd = {};
      // 30-Oct-2026: the master may answer with a sibling line of the same 6-digit heading (exact:false) - its rates
      // are NOT the item's rates, so only the description / UQC are offered and the operator is told which line it is
      const exact = t.exact !== false;
      if (!exact) toast(`RITC ${ritc} is not in the Tariff master - nearest line ${t.matchedCode || t.ritc} shown; BCD / IGST were NOT filled from it. Check the rate in the tariff.`, { icon: '⚠️', duration: 9000 });
      if (!cur('desc') && t.description) { upd.desc = t.description; upd.productDescription = t.description; setFormValue('desc', t.description); filled.push('description' + (exact ? '' : ' (nearest line)')); }
      if (exact && !cur('bcdRate') && t.bcdRate != null) { upd.bcdRate = String(t.bcdRate); setFormValue('bcdRate', String(t.bcdRate)); filled.push('BCD ' + t.bcdRate + '%'); }
      if (!cur('uqc') && t.uqc) { upd.uqc = t.uqc; upd.unit = t.uqc; setFormValue('uqc', t.uqc); filled.push('UQC'); }
      if (!cur('cth')) { upd.cth = ritc; setFormValue('cth', ritc); }
      let ig = selectedItem.igstData; if (typeof ig === 'string') { try { ig = JSON.parse(ig); } catch (e) { ig = null; } }
      // 04-Nov-2026: the IGST notification / serial come with the rate (iCAFFE 009/2025); a blank notification or serial
      // box is filled, a typed one is kept
      if (exact && t.igstRate != null && !(ig && ig.rate)) {
        upd.igstData = { notnNo: '', srNo: '', flag: 'A', amount: '', ...(ig || {}), rate: String(t.igstRate) };
        if (!upd.igstData.notnNo && t.igstNotnNo) upd.igstData.notnNo = t.igstNotnNo;
        if (!upd.igstData.srNo && t.igstSrNo) upd.igstData.srNo = t.igstSrNo;
        filled.push('IGST ' + t.igstRate + '%' + (t.igstSrNo ? ' (' + t.igstNotnNo + ' Sl ' + t.igstSrNo + ')' : ''));
      }
      // one CTH, several IGST serials with different rates: the rate depends on the description / value - say so
      if (exact && t.igstRateVaries && Array.isArray(t.igstOptions)) {
        const list = t.igstOptions.slice(0, 6).map(o => o.notnNo + ' Sl ' + o.srNo + ' = ' + o.rate + '%').join(', ');
        toast(`IGST for ${ritc} depends on the goods description / value - ${t.igstOptions.length} serials apply: ${list}${t.igstOptions.length > 6 ? ', ...' : ''}. ${t.igstRate}% (Sl ${t.igstSrNo}) was used - check it.`, { icon: '⚠️', duration: 12000 });
      }
      // 04-Nov-2026: agencies (FSSAI, PQIS, AQCS, CDSCO ...) that clear this CTH - from iCAFFE's Agencywise CTH master
      if (exact && Array.isArray(t.pgaAgencies) && t.pgaAgencies.length) {
        toast(`${ritc} is cleared by other agencies too: ${t.pgaAgencies.join(', ')}. Fill the SWIFT / PGA details and their documents (e-Sanchit).`, { icon: '🏛️', duration: 10000 });
      }
      // 04-Nov-2026: concession / FTA notifications for this CTH and the job's country of origin (iCAFFE masters)
      const origin = String(jobData?.countryOfOrigin || jobData?.autoField_20 || '').trim().toUpperCase();
      if (exact && origin) {
        fetch('/api/tariff/fta/' + ritc + '?origin=' + encodeURIComponent(origin)).then(r => r.json()).then(fd => {
          const list = (fd && Array.isArray(fd.data)) ? fd.data : [];
          if (!list.length) return;
          const txt = list.slice(0, 5).map(o => `${o.notifNo}${o.scheme && o.scheme !== 'CUSTOM' ? ' [' + o.scheme + ']' : ''} Sl ${o.serialNo} = ${o.dutyRate == null ? 'see notn' : o.dutyRate + '%'}${o.conditionNo ? ' (cond ' + o.conditionNo + ')' : ''}`).join(', ');
          toast(`Origin ${origin}: ${list.length} concession / FTA / safeguard row(s) for ${ritc} - ${txt}${list.length > 5 ? ', ...' : ''}. Needs a valid certificate of origin.`, { icon: '🌐', duration: 12000 });
        }).catch(() => {});
      }
      if (exact) askBcdExemptions(ritc, t.bcdRate);
      setItems(items.map(it => it.id === selectedRowId ? { ...it, ...upd } : it));
      toast.success(filled.length ? 'Filled from Tariff: ' + filled.join(', ') : 'Nothing new: the boxes already have values');
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch tariff");
    }
  };

  // Copy: a full copy (popups included) with the next free Item Sr No of the same invoice, placed after the original.
  const copyItemRow = (id) => {
    const src = items.find(it => it.id === id);
    if (!src) return;
    const copy = { ...deepCopy(src), id: Date.now(), itemSrNo: nextItemSr(items, src.invSrNo) };
    copy.itemNo = copy.itemSrNo;
    const idx = items.findIndex(it => it.id === id);
    const next = [...items]; next.splice(idx + 1, 0, copy);
    setItems(next); setSelectedRowId(copy.id);
    toast.success('Copied as Item Sr No ' + copy.itemSrNo);
  };
  copyItemRowRef.current = copyItemRow;
  // 30-Oct-2026: "Add to Template" / "Copy Details" were Y/N boxes that saved a letter and did nothing. The item
  // template master already exists (Masters > Item Template, table ItemTemplates), so the item is really saved there
  // and can be brought back into any job.
  const TPL_SKIP = new Set(['id', 'importInvoiceId', 'importJobId', 'createdAt', 'updatedAt', 'invSrNo', 'invNo', 'itemSrNo', 'itemNo', '_whBalanceQty', '_whOriginalQty']);
  const authHdr = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };
  const saveItemTemplate = async () => {
    if (!selectedRowId || !selectedItem || !selectedItem.id) { toast('Select the item to save as a template.'); return; }
    const name = await askText({ title: 'Save as item template', message: 'Item ' + (selectedItem.itemSrNo || '') + ' is kept in Masters > Item Template and can be added to any job.',
      label: 'Template name (RITC / description helps)', value: String(selectedItem.desc || selectedItem.ritc || '').slice(0, 40), okLabel: 'Save template' }) || '';
    if (!name) return;
    const payload = {}; Object.keys(selectedItem).forEach(k => { if (!TPL_SKIP.has(k) && selectedItem[k] !== undefined && selectedItem[k] !== null && selectedItem[k] !== '') payload[k] = selectedItem[k]; });
    try {
      const r = await fetch('/api/masters/itemtemplates', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHdr() },
        body: JSON.stringify({ templateName: name, jobType: 'BE', jsonPayload: JSON.stringify(payload) }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      toast.success('Saved as item template "' + name + '"');
    } catch (e) { toast.error('Could not save the template: ' + e.message); }
  };
  // brings a saved template into the grid as a new item of the chosen invoice
  const useItemTemplate = async () => {
    const target = String((selectedItem && selectedItem.invSrNo) || '1');
    try {
      const r = await fetch('/api/masters/itemtemplates', { headers: authHdr() });
      const list = await r.json();
      const rows = (Array.isArray(list) ? list : (list && list.data) || []).filter(t => !t.jobType || t.jobType === 'BE');
      if (!rows.length) { toast('No item template saved yet - open an item and press "Add to Template".'); return; }
      // 20-Nov-2026: picked from a list in an EagleView window (was a numbered list in the browser's prompt box)
      const pickName = await askText({ title: 'Use item template', message: 'The template is added as a new item of invoice ' + target + '.',
        label: 'Item template (' + rows.length + ')', choices: rows.map((t, i) => ({ value: String(i + 1), label: (i + 1) + '. ' + t.templateName })), okLabel: 'Add the item' }) || '';
      if (!pickName) return;
      const t = /^\d+$/.test(pickName) ? rows[parseInt(pickName, 10) - 1] : rows.find(x => String(x.templateName).toLowerCase() === pickName.toLowerCase());
      if (!t) { toast.error('No template with that number / name'); return; }
      let data = {}; try { data = JSON.parse(t.jsonPayload || '{}'); } catch (e) { data = {}; }
      const sr = nextItemSr(items, target);
      const row = { ...data, id: Date.now(), invSrNo: target, invNo: (jobInvoices[parseInt(target, 10) - 1] || {}).invNo || '', itemSrNo: sr, itemNo: sr };
      setItems([...items, row]); setSelectedRowId(row.id);
      toast.success('Item template "' + t.templateName + '" added as item ' + sr + ' of invoice ' + target + ' - check it and Save');
    } catch (e) { toast.error('Could not read the templates: ' + e.message); }
  };

  const handleCopyItem = () => {
    if (!selectedRowId || !selectedItem || !selectedItem.id) { toast("Please select an item to copy."); return; }
    copyItemRow(selectedItem.id);
  };

  const handleDownloadSample = () => downloadItemWorkbook(true);
  const handleDownloadTemplate = () => downloadItemWorkbook(false);

  // Copy From Other Job: the job comes back with invoices[].items (there is no itemsModel), so nothing was ever copied.
  const handleCopyFromOtherJob = async () => {
    const jobNo = await askText({ title: 'Copy items from another job', label: 'Job No', placeholder: 'e.g. NDL/AI/200005 or 8564', okLabel: 'Find the job' }) || '';
    if (!jobNo) return;
    toast.loading("Fetching items from job...", { id: "copy-job" });
    try {
      const s1 = await (await fetch(`/api/import-jobs/search?q=${encodeURIComponent(jobNo)}`)).json();
      const job = (s1.data || []).find(j => String(j.jobNo || '').toUpperCase() === jobNo.toUpperCase());
      if (!job) { toast.error('Job ' + jobNo + ' not found', { id: "copy-job" }); return; }
      if (jobData?.id && String(job.id) === String(jobData.id)) { toast.error('That is this same job', { id: "copy-job" }); return; }
      const s2 = await (await fetch(`/api/import-jobs/${job.id}`)).json();
      const src = [];
      (s2.data?.invoices || []).forEach((iv, k) => (iv.items || []).forEach(it => src.push({ ...it, invSrNo: String(it.invSrNo || k + 1) })));
      if (!src.length) { toast.error("No items found in that job.", { id: "copy-job" }); return; }
      const target = selectedItem?.invSrNo || (jobInvoices.length ? '1' : '1');
      if (!(await askConfirm({ title: 'Copy items', message: `Copy ${src.length} item(s) from job ${jobNo} into invoice ${target} of this job?`, okLabel: `Copy ${src.length} item(s)`, cancelLabel: 'Do not copy' }))) { toast.dismiss("copy-job"); return; }
      let list = [...items];
      const strip = ['id', 'importInvoiceId', 'importJobId', 'jobId', 'createdAt', 'updatedAt', 'extendedData', 'additionalData'];
      src.forEach((it, i) => {
        const c = deepCopy(it); strip.forEach(k => delete c[k]);
        c.id = Date.now() + i; c.invSrNo = String(target); c.invNo = (jobInvoices[parseInt(target, 10) - 1] || {}).invNo || '';
        c.itemSrNo = nextItemSr(list, target); c.itemNo = c.itemSrNo;
        list.push(c);
      });
      setItems(list);
      toast.success(`${src.length} item(s) copied`, { id: "copy-job" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch job items.", { id: "copy-job" });
    }
  };

  // Upload PDF (AI): new items got no invoice / item Sr No, no description or price in the boxes the screen uses.
  const handleAiPdf = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const partyId = jobData?.importerId || jobData?._importerId;
    if (partyId) formData.append('partyId', partyId);
    formData.append('formType', 'import');
    toast.loading("AI is reading the PDF...", { id: "ai-parse" });
    try {
      const res = await fetch('/api/import-file/extract-pdf-items', { method: 'POST', body: formData });
      const data = await res.json();
      if (!(data.success && data.items && data.items.length)) { toast.error(data.error || "AI couldn't find items in this PDF.", { id: "ai-parse" }); return; }
      const target = selectedItem?.invSrNo || '1';
      let list = [...items];
      data.items.forEach((it, i) => {
        const qty = it.quantity ?? '', price = it.unitPrice ?? '', ritc = String(it.hsCode || '').replace(/\D/g, '');
        const sr = nextItemSr(list, target);
        list.push({ id: Date.now() + i, invSrNo: String(target), invNo: (jobInvoices[parseInt(target, 10) - 1] || {}).invNo || '', itemSrNo: sr, itemNo: sr,
          desc: it.description || '', productDescription: it.description || '', ritc, hsCode: ritc, cth: ritc, ceth: 'NOEXCISE',
          qty: String(qty), quantity: String(qty), unit: String(it.unit || '').toUpperCase(), uqc: String(it.unit || '').toUpperCase(),
          price: String(price), unitPrice: String(price), value: String((parseFloat(qty) * parseFloat(price)) > 0 ? +(parseFloat(qty) * parseFloat(price)).toFixed(2) : (it.assessableValue || it.lineTotal || '')), swsRate: '10', swsFlag: 'A', foc: 'N' });
      });
      setItems(list);
      toast.success(`AI extracted ${data.items.length} items into invoice ${target} - please check them`, { id: "ai-parse" });
    } catch (err) {
      toast.error("AI Extractor failed: " + err.message, { id: "ai-parse" });
    }
  };

  return { registerPendingEdits, saveItemTemplate, addRspRow, editRspRow, removeRspRow, tempRspRows, rspEditIdx, useItemTemplate, tariffSearch, setTariffSearch, openTariffSearch, runTariffSearch, pickTariff, autoDesc, setAutoDesc, setFormValue, docsOtherIrns, copyItemRow, handleAiPdf, nextItemSr, openReimportModal, saveReimportModal, openRspModal, saveRspModal, openNcdModal, saveNcdModal, showLicenceModal, setShowLicenceModal, tempLicenceData, licenceForm, setLicenceForm,
    autoTariff, takePendingIgst, itemHistory, setItemHistory, askItemHistory, applyItemHistory, bcdExemptions, setBcdExemptions, applyBcdExemption,
    licenceEditId, openLicenceModal, addLicenceRow, editLicenceRow, removeLicenceRow, saveLicenceModal, docsEditId, editDocsRow, copyDocsRow, addDutyRow, editDutyRow, removeDutyRow, clearDutyForm, tempDutyRows, dutyForm, setDutyForm, dutyEditIdx, addDocsRow, addInMiddle, addSchemeCatRow, addSwConstRow, addSwCtrlRow, addSwInfoRow, addSwProdRow, addSwStmtRow, applySwInfoToAll, applySwStatementToAll, cethSearch, checkAll, checkedIds, cthSearch, defaultIcegateId, deleteSelected, displayDuties, docsForm, duplicateRow, esanchitDocs, setEsanchitDocs, fileInputRef, globalItems, handleCopyFromOtherJob, handleCopyItem, handleDownloadSample, handleDownloadTemplate, handleFetchItem, invoices: jobInvoices, items, jobData, masters, openAntiDumpingModal, openCustomsCvdModal, openIgstModal, openOtherDutyModal, openPolicyParaModal, openPreviousBeModal, openSchemeCategoryModal, openSupportingDocsModal, openSvbModal, openSwConstModal, openSwControlModal, openSwInfoModal, openSwProductionModal, openSwStatementModal, removeDocsRow, removeSchemeCatRow, removeSwConstRow, removeSwCtrlRow, importSwCtrlExcel, removeSwInfoRow, removeSwProdRow, removeSwStmtRow, ritcSearch, rowExists, saveAntiDumpingModal, saveCustomsCvdModal, saveIgstModal, saveOtherDutyModal, savePolicyParaModal, savePreviousBeModal, saveSchemeCategoryModal, saveSupportingDocsModal, saveSvbModal, saveSwConstModal, saveSwControlModal, applySwControlToAll, saveSwInfoModal, saveSwProductionModal, saveSwStatementModal, schemeCatForm, schemeSearch, selectedItem, selectedRowId, setAddInMiddle, setCethSearch, setCthSearch, setDefaultIcegateId, setDocsForm, setGlobalItems, setInvoices, setItems, setJobData, setRitcSearch, setSchemeCatForm, setSchemeSearch, setSelectedRowId, setShowAntiDumpingModal, setShowCethModal, setShowCthModal, setShowCustomsCvdModal, setShowIgstModal, setShowNcdModal, setShowOtherDutyModal, setShowPolicyParaModal, setShowPreviousBeModal, setShowReimportModal, setShowRitcModal, setShowRspModal, setShowSchemeCategoryModal, setShowSchemeSearchModal, setShowSupportingDocsModal, setShowSvbModal, setShowSwConstModal, setShowSwControlModal, setShowSwInfoModal, setShowSwProductionModal, setShowSwStatementModal, setSwConstForm, setSwCtrlForm, setSwInfoForm, setSwInfoType, setSwProdForm, setSwStmtForm, setTempAddData, setTempCvdData, setTempDocsData, setTempIgstData, setTempNcdData, setTempOtherDutyData, setTempPolicyParaData, setTempPrevBeData, setTempReimportData, setTempRspData, setTempSchemeCatData, setTempSvbData, setTempSwConstData, setTempSwCtrlData, setTempSwInfoData, setTempSwProdData, setTempSwStmtData, showAntiDumpingModal, showCethModal, showCthModal, showCustomsCvdModal, showIgstModal, showNcdModal, showOtherDutyModal, showPolicyParaModal, showPreviousBeModal, showReimportModal, showRitcModal, showRspModal, showSchemeCategoryModal, showSchemeSearchModal, showSupportingDocsModal, showSvbModal, showSwConstModal, showSwControlModal, showSwInfoModal, showSwProductionModal, showSwStatementModal, swConstForm, swCtrlForm, swInfoForm, swInfoType, swProdForm, swStmtForm, syncRef, tempAddData, tempCvdData, tempDocsData, tempIgstData, tempNcdData, tempOtherDutyData, tempPolicyParaData, tempPrevBeData, tempReimportData, tempRspData, tempSchemeCatData, tempSvbData, tempSwConstData, tempSwCtrlData, tempSwInfoData, tempSwProdData, tempSwStmtData, toggleCheck };
}
