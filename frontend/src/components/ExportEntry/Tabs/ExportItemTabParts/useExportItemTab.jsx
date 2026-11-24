// State and logic
// Split out of ExportItemTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React, { useEffect, useState } from 'react';
import { asList } from '../../../../utils/asList';
import { getMaster } from '../../../../utils/masterCache'; // shared copy of small master lists, 09-Nov-2026
import { useExportContext } from '../../ExportContext';
import askConfirm from '../../../common/askConfirm'; // EagleView question window, 20-Nov-2026
import { perUnit } from '../../../../utils/cbicExchange';
import { itemFobFromInvoice } from '../../../../utils/exportFob';
import { signPdf } from '../../../../utils/dscSigner';

export default function useExportItemTab(ctx) {
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



  const [validationErrors, setValidationErrors] = useState([]);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [uqcs, setUqcs] = useState([]);
  const [states, setStates] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [drawbacksMaster, setDrawbacksMaster] = useState([]);
    const [rodtepsMaster, setRodtepsMaster] = useState([]);
    const [rosctlsMaster, setRosctlsMaster] = useState([]);
    const [exportPoliciesMaster, setExportPoliciesMaster] = useState([]);
  const [esanchits, setEsanchits] = useState([]);

  useEffect(() => {
    getMaster('/api/masters/uqcs').then(data => { if(Array.isArray(data)) setUqcs(data); });
    getMaster('/api/masters/states').then(data => { if(Array.isArray(data)) setStates(data); });
    fetch('/api/masters/tariffheaders/all').then(res=>res.json()).then(data => { if(Array.isArray(data)) setTariffs(data); });
    fetch('/api/masters/drawbacks').then(res=>res.json()).then(data => { if(Array.isArray(data)) setDrawbacksMaster(data); });
      fetch('/api/masters/rodteps').then(res=>res.json()).then(data => { if(Array.isArray(data)) setRodtepsMaster(data); });
      fetch('/api/masters/rosctls').then(res=>res.json()).then(data => { if(Array.isArray(data)) setRosctlsMaster(data); });
      fetch('/api/masters/exportpolicies').then(res=>res.json()).then(data => { if(Array.isArray(data)) setExportPoliciesMaster(data); });
    fetch('/api/masters/esanchits').then(res=>res.json()).then(data => { if(Array.isArray(data)) setEsanchits(data); else if(data.success) setEsanchits(data.data); });
  }, []);
  const { items, setItems, exportData, setExportData, registerPendingEdits, remapItemRows } = useExportContext();
  // exchange rate of an invoice (1-based serial)
  // 30-Oct-2026: rupees per ONE unit - the invoice keeps the rate in CBIC notation (per 100 for JPY / KRW)
  const exchOf = (invSr) => { const inv = (exportData?.invoices || [])[(parseInt(invSr, 10) || 1) - 1] || {}; return perUnit(inv.currency, inv.exchRate || inv.exchangeRate, inv.unitInRs); };
  // item serial inside its invoice (each invoice counts from 1)
  const nextItemSr = (invSr, list = items, excludeId) => list.filter(i => String(parseInt(i.invSr, 10) || 1) === String(parseInt(invSr, 10) || 1) && i.id !== excludeId).length + 1;
  const [activeSchemeTab, setActiveSchemeTab] = useState('dbk');
  const [selectedRowId, setSelectedRowId] = useState(null); // 12-Nov-2026: was 1 - an empty job showed "Editing item 1"
  const gridContainerRef = React.useRef(null);

  // Drag and drop local state
  const [draggedRowIndex, setDraggedRowIndex] = useState(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState(null);

  React.useEffect(() => {
    if (gridContainerRef.current) {
      gridContainerRef.current.scrollTop = gridContainerRef.current.scrollHeight;
    }
  }, [items.length]);

  const handleDragStart = (e, index) => {
    setDraggedRowIndex(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', e.target);
    }
  };

  const handleDragEnd = () => {
    if (draggedRowIndex !== null && dragOverRowIndex !== null && draggedRowIndex !== dragOverRowIndex) {
      const newItems = [...items];
      const draggedItem = newItems[draggedRowIndex];
      newItems.splice(draggedRowIndex, 1);
      newItems.splice(dragOverRowIndex, 0, draggedItem);
      setItems(newItems);
    }
    setDraggedRowIndex(null);
    setDragOverRowIndex(null);
  };

  // grid edits: qty / price / unit keep both names in step and total / FOB follow (they kept the old values). 29-Oct-2026
  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const n = { ...it, [field]: value };
      if (field === 'price') n.rate = value;
      if (field === 'rate') n.price = value;
      if (field === 'uqc') { n.unit = value; if (!it.rateUnit || it.rateUnit === it.unit) n.rateUnit = value; }
      if (field === 'unit') n.uqc = value;
      if (['qty', 'price', 'rate'].includes(field)) {
        const q = parseFloat(n.qty) || 0, r = parseFloat(n.rate ?? n.price) || 0, per = parseFloat(n.per) || 1;
        const tot = q * r / per;
        n.totalFc = tot ? tot.toFixed(2) : ''; n.total = n.totalFc;
        // 12-Nov-2026: the item's share of the invoice FOB (freight / insurance of a CIF invoice taken out)
        const inv = (exportData?.invoices || [])[(parseInt(n.invSr, 10) || 1) - 1];
        const f = inv ? itemFobFromInvoice(n, inv) : null;
        const ex = exchOf(n.invSr);
        if (f) n.itemFob = f; else if (ex && tot) n.itemFob = (tot * ex).toFixed(2);
      }
      return n;
    }));
  };

  const [isSchemeModalOpen, setIsSchemeModalOpen] = useState(false);
  const [activeItemForScheme, setActiveItemForScheme] = useState(null);
  const [schemeFilter, setSchemeFilter] = useState('');
  
  const [schemesList, setSchemesList] = useState([]);

  useEffect(() => {
    getMaster('/api/masters/schemecodes')
      .then(data => {
        if (Array.isArray(data)) setSchemesList(data);
        else if (data.data) setSchemesList(data.data);
      })
      .catch(err => console.error("Error fetching schemes:", err));
  }, []);

  const handleSchemeSelect = (schemeCode, schemeDesc) => {
    if (activeItemForScheme === 'FORM') {
      handleFormChange('scheme', `${schemeCode} - ${schemeDesc}`);
    } else if (activeItemForScheme !== null) {
      updateItem(activeItemForScheme, 'scheme', `${schemeCode} - ${schemeDesc}`);
    }
    setIsSchemeModalOpen(false);
  };

  // RITC SEARCH MODAL STATE
  const [isRitcModalOpen, setIsRitcModalOpen] = useState(false);
  const [activeItemForRitc, setActiveItemForRitc] = useState(null);
  const [ritcFilter, setRitcFilter] = useState('');

  const ritcList = [
    { code: '81011000', desc: 'Powders', unit: 'KGS' },
    { code: '81019400', desc: 'Unwrought tungsten, including bars and rods obtained simply by sintering', unit: 'KGS' },
    { code: '81019600', desc: 'Wire', unit: 'KGS' },
    { code: '81019700', desc: 'Waste and scrap', unit: 'KGS' },
    { code: '81019910', desc: 'Tungsten filament', unit: 'KGS' },
    { code: '81019920', desc: 'Bars and rods, other than those obtained simply by sintering', unit: 'KGS' },
    { code: '81019990', desc: 'Other', unit: 'KGS' },
    { code: '81021000', desc: 'Powders (Molybdenum)', unit: 'KGS' },
    { code: '81029400', desc: 'Unwrought molybdenum, including bars and rods obtained simply by sintering', unit: 'KGS' },
    { code: '81029510', desc: 'Hollow bars', unit: 'KGS' },
    { code: '81029590', desc: 'Other', unit: 'KGS' }
  ];

  const handleRitcSelect = (ritcCode, ritcDesc, unit) => {
    if (activeItemForRitc === 'FORM') {
      handleFormChange('ritc', ritcCode);
      handleFormChange('desc', ritcDesc);
      handleFormChange('unit', unit);
      handleFormChange('rateUnit', unit);
    } else if (activeItemForRitc !== null) {
      updateItem(activeItemForRitc, 'ritc', ritcCode);
      updateItem(activeItemForRitc, 'desc', ritcDesc);
      updateItem(activeItemForRitc, 'uqc', unit);
    }
    setIsRitcModalOpen(false);
  };

  // SW STATEMENT MODAL STATE
  const [isSwStatementModalOpen, setIsSwStatementModalOpen] = useState(false);
  const [isSwInfoModalOpen, setIsSwInfoModalOpen] = useState(false);
  const [swStatements, setSwStatements] = useState([
    { id: 1, typeCode: 'DEC', statementCode: 'RD001', text: '', statementFor: 'I' }
  ]);

  // RE-EXPORT MODAL STATE
  const [isReExportModalOpen, setIsReExportModalOpen] = useState(false);
  const [reExports, setReExports] = useState([]);

  // MANF DETAILS MODAL STATE
  const [isManfModalOpen, setIsManfModalOpen] = useState(false);

  // E-SANCHIT MODAL STATE
  const [isESanchitModalOpen, setIsESanchitModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [tokenPin, setTokenPin] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [toastMsg, setToastMsg] = useState({ text: '', type: '' });
  const [swInfoRowCount, setSwInfoRowCount] = useState(1);

  
  
  const showToast = (text, type = 'error') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg({ text: '', type: '' }), 7000);
  };
  
  const [icegateProfiles, setIcegateProfiles] = useState([]);
  const [esanchitMasters, setEsanchitMasters] = useState([]);
  const [isIcegateDifferent, setIsIcegateDifferent] = useState(false);
  const [selectedIcegateProfile, setSelectedIcegateProfile] = useState('');
  

  // FORM STATE
  const [formData, setFormData] = useState({
    invSr: 1, itemSr: 1, scheme: '', ritc: '', desc: '', chkDesc: '', qty: '', unit: '', per: '1', rate: '', rateUnit: '', totalFc: '',
    pmvOption: 'Percentage', pmvPer: '', pmv: '', totalPmv: '', itemFob: '',
    endUse: '', igstPayStatus: 'Select', taxableValue: '', igstRate: '', igstAmt: '',
    rodtep: 'N', swInfo: 'N', swStatement: 'N', suppDocs: 'N', reExport: 'N', manfDetails: 'N',
    sourceState: '', stateCode: '', hawb: '', totalPkgs: '', swConst: 'N', swProd: 'N', swCtrl: 'N',
    accessory: 'N', cess: 'N', thirdParty: 'N', ar4: 'N', reward: 'N', addInTemplate: false, addInMiddle: '', copyLicence: ''
  });

  // AUTO-GENERATE SW INFO (reworked 29-Oct-2026)
  // Before: scheme 19 forced RODTEPY back on every edit (a manual RoDTEP N was lost) and the whole list was rebuilt,
  // so SW info rows typed in the SW Info window were wiped. Now: RoDTEP follows the item's RoDTEP switch (set to Y
  // once, when the scheme of the same item is changed to a 19 scheme), and rows of other types typed by the user are kept.
  // Rows as the production SB files have them for every item: ORC/STO (state code only), ORC/DOO (district code),
  // ORC/EPT NCPTI, DTY/GCESS 0 INR, CHR/SQC, and DTY/RDT RODTEPY / RODTEPN only for scheme 19 or a RoDTEP claim.
  const schemeRef = React.useRef({ row: undefined, scheme: undefined });
  useEffect(() => {
    const scheme = String(formData.scheme || '');
    const prev = schemeRef.current;
    schemeRef.current = { row: selectedRowId, scheme };
    if (prev.scheme !== undefined && prev.row === selectedRowId && prev.scheme !== scheme && /19/.test(scheme) && !/19/.test(prev.scheme) && formData.rodtep !== 'Y') {
      setFormData(p => ({ ...p, rodtep: 'Y' }));
    }
  }, [formData.scheme, selectedRowId]); // eslint-disable-line
  useEffect(() => {
    const qty = formData.qty || '';
    const uqc = formData.unit || '';
    const stateCode = String(formData.stateCode || exportData?.stateOriginCode || '').split('|')[0].trim();
    const districtCode = String(formData.districtCode || '').trim();
    const first = (v) => String(v || '').split('|')[0].trim();
    const old = asList(formData.swInfos);
    const key = (t, q) => `${String(t || '').toUpperCase()}/${String(q || '').toUpperCase()}`;
    const oldOf = (t, q) => old.find(r => key(r.swInfoField1 || r.type, r.swInfoField2 || r.qual) === key(t, q));

    const gen = [];
    if (stateCode) gen.push({ type: 'ORC', qual: 'STO', code: stateCode, msr: '', uqc: '' });
    if (districtCode) gen.push({ type: 'ORC', qual: 'DOO', code: districtCode, msr: '', uqc: '' });
    // export preference: keep a code the user changed ("NCPTI | ..." of older jobs cut to the code)
    const ept = oldOf('ORC', 'EPT');
    gen.push({ type: 'ORC', qual: 'EPT', code: first(ept && (ept.swInfoField3 || ept.code)) || 'NCPTI', msr: '', uqc: '' });
    const gc = oldOf('DTY', 'GCESS');
    gen.push({ type: 'DTY', qual: 'GCESS', code: (gc && (gc.swInfoField3 || gc.code)) || '', msr: (gc && (gc.swInfoField5 || gc.msr)) || (formData.cessAmount > 0 ? String(formData.cessAmount) : '0'), uqc: 'INR' });
    // 12-Nov-2026: SQC / RDT are in the unit of the tariff / RoDTEP schedule (iCAFFE: 11 NOS of 83071000 -> 139.7 KGS).
    // Item qty only when the item unit is the schedule's; otherwise the measurement keyed in SW info is kept.
    const sched = rodtepsMaster.find(r => String(r.tariffItem || '') === String(formData.ritc || '').replace(/\D/g, ''));
    const su = String((sched && sched.uqc) || '').toUpperCase();
    // the item's own row, else the row kept with the job (a job read from a file: 139.7 KGS is in its SW info rows)
    const jobRow = (t, q) => asList(exportData && exportData._infoTypes).find(x => String(x.infoType || '').toUpperCase() === t && String(x.infoQualifier || '').toUpperCase() === q
      && String(parseInt(x.invoiceSerialNumber, 10) || 1) === String(parseInt(formData.invSr, 10) || 1) && String(parseInt(x.itemSerialNumber, 10) || 0) === String(parseInt(formData.itemSr, 10) || 0));
    const keepMsr = (t, q) => { const o = oldOf(t, q); if (o && String(o.swInfoField6 || o.uqc || '').toUpperCase() === su) return o.swInfoField5 || o.msr || ''; const j = jobRow(t, q); return j && String(j.infouqc || '').toUpperCase() === su ? String(j.infoMeasure || '') : ''; };
    const same = !su || String(uqc).toUpperCase() === su;
    const sqcMsr = same ? qty : keepMsr('CHR', 'SQC'), rdtMsr = same ? qty : (keepMsr('DTY', 'RDT') || sqcMsr);
    gen.push({ type: 'CHR', qual: 'SQC', code: '', msr: sqcMsr, uqc: same ? uqc : su });
    if (/19/.test(String(formData.scheme || '')) || formData.rodtep === 'Y') gen.push({ type: 'DTY', qual: 'RDT', code: formData.rodtep === 'Y' ? 'RODTEPY' : 'RODTEPN', msr: rdtMsr, uqc: same ? uqc : su });

    // 19-Nov-2026: SB Header "MOOWR [Y/N]" = Yes -> DIR / MOOWR MOOWRY (ICES Exports message format 3.3 / 3.7); a code the user
    // changed (MOOWRN) is kept. With MOOWR No / blank a typed DIR / MOOWR row stays as the user left it.
    const moowr = /^Y/i.test(String(exportData?.autoField_31 || ''));
    if (moowr) { const mw = oldOf('DIR', 'MOOWR'); gen.push({ type: 'DIR', qual: 'MOOWR', code: (mw && (mw.swInfoField3 || mw.code)) || 'MOOWRY', msr: '', uqc: '' }); }

    const genKeys = new Set(['CHR/SQC', 'ORC/STO', 'ORC/DOO', 'DTY/RDT', 'ORC/EPT', 'DTY/GCESS', ...(moowr ? ['DIR/MOOWR'] : [])]);
    const manual = old.filter(r => !genKeys.has(key(r.swInfoField1 || r.type, r.swInfoField2 || r.qual)));
    const newSwInfos = [...gen.map((row, idx) => {
      const o = oldOf(row.type, row.qual);
      return { id: (o && o.id) || Date.now() + idx, type: row.type, qual: row.qual, code: row.code, msr: row.msr, uqc: row.uqc,
        swInfoField1: row.type, swInfoField2: row.qual, swInfoField3: row.code, swInfoField4: (o && o.swInfoField4) || '', swInfoField5: row.msr, swInfoField6: row.uqc };
    }), ...manual];

    const sig = (l) => JSON.stringify(l.map(r => [r.swInfoField1, r.swInfoField2, r.swInfoField3, r.swInfoField4, r.swInfoField5, r.swInfoField6]));
    if (sig(old) !== sig(newSwInfos)) setFormData(prev => ({ ...prev, swInfos: newSwInfos }));
  }, [formData.qty, formData.unit, formData.rodtep, formData.scheme, formData.cessAmount, formData.stateCode, formData.districtCode, formData.swInfos, exportData?.stateOriginCode, exportData?.autoField_31, formData.ritc, rodtepsMaster]); // eslint-disable-line


  
  // Auto-calculate PMV & IGST
  useEffect(() => {
    const qty = parseFloat(formData.qty) || 0;
    const rate = parseFloat(formData.rate) || 0;
    const per = parseFloat(formData.per) || 1;
    const totalFc = qty * rate / per;

    // Get exchange rate from selected invoice
    const invIndex = (parseInt(formData.invSr) || 1) - 1;
    const invoice = exportData?.invoices?.[invIndex] || {};
    const exchRate = perUnit(invoice.currency, invoice.exchRate || invoice.exchangeRate, invoice.unitInRs) || perUnit(invoice.currency || formData.currency, formData.exchRate, formData.unitInRs) || 1;

    // Item FOB (INR) always follows qty x rate (it kept an old value after qty / rate changed); for a CIF / CF / CI
    // invoice the item gets its share of the invoice FOB (freight and insurance taken out in the same proportion)
    const invVal = parseFloat(invoice.value || invoice.invoiceValue) || 0, invFob = parseFloat(invoice.invFobInr) || 0;
    const fobShare = invVal > 0 && invFob > 0 ? invFob / (invVal * exchRate) : 1;
    let fobInr = totalFc * exchRate * (fobShare > 0 && fobShare <= 1 ? fobShare : 1);

    let updates = {};
    let needsUpdate = false;

    if (totalFc > 0 && parseFloat(formData.totalFc) !== parseFloat(totalFc.toFixed(2))) {
       updates.totalFc = totalFc.toFixed(2);
       needsUpdate = true;
    }

    if (fobInr > 0 && parseFloat(formData.itemFob) !== parseFloat(fobInr.toFixed(2))) {
       updates.itemFob = fobInr.toFixed(2);
       needsUpdate = true;
    }

    // PMV Calculation (Always uses INR FOB)
    if (formData.pmvOption === 'Percentage') {
      const pmvPer = parseFloat(formData.pmvPer) || 0;
      if (pmvPer > 0 && fobInr > 0) {
        const calculatedPmvTotal = parseFloat(((fobInr * pmvPer) / 100).toFixed(2));
        if (parseFloat(formData.totalPmv) !== calculatedPmvTotal) {
          updates.totalPmv = calculatedPmvTotal;
          updates.pmv = parseFloat((calculatedPmvTotal / (qty || 1)).toFixed(2));
          needsUpdate = true;
        }
      }
    }

    // IGST Calculation
    // IGST only for "Export Against Payment (P)" (the check compared with 'LUT' while the box holds
    // "Export Under Bond (LUT)", so IGST was worked out for LUT and NA too)
    const payingIgst = /\(P\)|^P$/.test(String(formData.igstPayStatus || ''));
    if (!payingIgst && (parseFloat(formData.igstAmt) || 0) !== 0 && formData.igstPayStatus !== 'Select') { updates.igstAmt = ''; updates.taxableValue = ''; needsUpdate = true; }
    if (payingIgst) {
       const igstRate = parseFloat(formData.igstRate) || 0;
       const taxableValue = parseFloat(formData.taxableValue) || fobInr;
       if (igstRate > 0 && taxableValue > 0) {
         const calculatedIgst = parseFloat(((taxableValue * igstRate) / 100).toFixed(2));
         if (parseFloat(formData.igstAmt) !== calculatedIgst) {
           updates.igstAmt = calculatedIgst;
           if (parseFloat(formData.taxableValue) !== taxableValue) {
             updates.taxableValue = taxableValue;
           }
           needsUpdate = true;
         }
       }
    }

    if (needsUpdate) {
      setFormData(prev => ({ ...prev, ...updates }));
    }
  }, [formData.itemFob, formData.qty, formData.rate, formData.per, formData.unitInRs, formData.pmvOption, formData.pmvPer, formData.igstPayStatus, formData.igstRate, formData.taxableValue, formData.invSr, exportData?.invoices]);

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 17-Nov-2026: changes in the item form that are not put in with Save / Modify (as on the Import screen).
  // The form as it was when the operator first touched it is kept; the form is "edited" when it differs from that.
  // Values the screen works out by itself (FOB, IGST, SW info rows) change only after a touch, so they do not count alone.
  const formRef = React.useRef(formData); formRef.current = formData;
  const editBase = React.useRef(null);
  const snapForm = (f) => { try { return JSON.stringify(f, (k, v) => (typeof Blob !== 'undefined' && v instanceof Blob ? undefined : v)); } catch (e) { return ''; } };
  const markFormTouched = (e) => {
    if (editBase.current !== null) return;
    const t = e && e.target;
    if (t && t.closest && t.closest('[data-nodirty]')) return; // the item list and its buttons are not the form
    editBase.current = { ...formRef.current };
  };
  const formEdited = () => editBase.current !== null && snapForm(formRef.current) !== snapForm(editBase.current);
  const clearFormEdits = () => { editBase.current = null; };
  const keepInBase = (patch) => { if (editBase.current) editBase.current = { ...editBase.current, ...patch }; };
  // the open item / new item in the form has changes - asks before they are dropped. Resolves true = go ahead
  // 20-Nov-2026: asked in an EagleView window with named buttons, not the browser's OK / Cancel box (so it is async now)
  const leaveFormOk = async (what) => !formEdited() || askConfirm({ title: 'Changes not put in',
    message: selectedRowId != null ? 'Item ' + (formData.itemSr || '') + ' of invoice ' + (formData.invSr || 1) + ' has changes that were not put in with MODIFY.' : 'The new item in the form was not added with SAVE.',
    note: 'Drop the changes: ' + what + ' - what was typed here is lost.\nStay here: press ' + (selectedRowId != null ? 'MODIFY' : 'SAVE') + ' first.',
    okLabel: 'Drop the changes', cancelLabel: 'Stay here' });
  React.useEffect(() => {
    if (typeof registerPendingEdits !== 'function') return undefined;
    const check = () => {
      if (!formEdited()) return '';
      const f = formRef.current;
      return selectedRowId != null
        ? 'Item ' + (f.itemSr || '') + ' of invoice ' + (f.invSr || 1) + ' has changes that were not put in with MODIFY - they are not part of the SB yet.'
        : 'A new item is typed in the Items form but was not added with SAVE - it is not part of the SB yet.';
    };
    return registerPendingEdits('items', check);
  }); // no dependency list: the check must see the current selected item


  // Grid specific states
  const [docList, setDocList] = useState([]);
  const [currentDocForm, setCurrentDocForm] = useState({});

  React.useEffect(() => {
    if (isESanchitModalOpen) {
       // initialize from formData
       setDocList(asList(formData.eSanchitList));
       setCurrentDocForm(formData.eSanchitDetails || {});
    }
  }, [isESanchitModalOpen, formData]);

  React.useEffect(() => {
    fetch('/api/masters/esanchits')
      .then(res => res.json())
      .then(data => {
         if(Array.isArray(data)) setEsanchitMasters(data);
      })
      .catch(err => console.error("Error fetching esanchits:", err));
    fetch('/api/icegate-profiles')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setIcegateProfiles(data.data);
          const def = data.data.find(p => p.isDefault);
          if (def) setSelectedIcegateProfile(def.id);
          else if (data.data.length > 0) setSelectedIcegateProfile(data.data[0].id);
        }
      })
      .catch(err => console.error("Error fetching icegate profiles:", err));
  }, []);

  const handleSignAndUpload = async () => {
    const pendingDocs = docList.filter(d => !d.irn && d.file);
    if (pendingDocs.length === 0) {
      showToast('No pending files to upload in the grid!', 'error');
      return;
    }
    try {
      setIsUploading(true);
      let successCount = 0;
      const updatedList = [...docList];

      for (let i = 0; i < updatedList.length; i++) {
        const doc = updatedList[i];
        if (doc.irn || !doc.file) continue;

        // 1. Sign PDF
        // 16-Nov-2026: EagleView Signer on this PC first (it asks the PIN itself if none is typed), else the server signer
        const signedBlob = (await signPdf(doc.file, tokenPin, 'e-Sanchit document ' + (doc.docCode || ''))).blob;
        const signedFile = new File([signedBlob], 'signed_' + doc.file.name, { type: 'application/pdf' });
        
        // 2. Upload to e-Sanchit
        const esanchitFormData = new FormData();
        esanchitFormData.append('pdf', signedFile);
        esanchitFormData.append('documentCode', doc.docCode || '0010000');
        esanchitFormData.append('profileId', selectedIcegateProfile || 1);
        
        const uploadRes = await fetch('/api/icegate/upload-esanchit', { method: 'POST', body: esanchitFormData });
        const uploadData = await uploadRes.json();
        
        if (uploadData.success) {
          updatedList[i].irn = uploadData.irn;
          updatedList[i].drn = uploadData.drn;
          updatedList[i].signedName = signedFile.name;
          successCount++;
        } else {
          showToast('Upload failed for ' + doc.file.name + ': ' + uploadData.error, 'error');
        }
      }

      setDocList(updatedList);
      if (successCount > 0) {
        showToast('Success! Generated ' + successCount + ' IRNs.', 'success');
        setShowPinPrompt(false);
      }
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddFilesToGrid = (e) => {
    const files = Array.from(e.target.files);
    if (!currentDocForm.eSanField4) {
      showToast('Please enter a Document Code before selecting files.', 'error');
      return;
    }
    const newDocs = files.map(f => ({
      id: Date.now() + Math.random(),
      file: f,
      fileName: f.name,
      docCode: currentDocForm.eSanField4,
      docFor: currentDocForm.docFor || 'Item',
      irn: '',
      drn: ''
    }));
    setDocList([...docList, ...newDocs]);
    // clear file input
    e.target.value = null;
  };

  // (a second PMV effect here set Item FOB to qty x rate in the invoice currency and fought the INR calculation above;
  // removed 29-Oct-2026 - PMV % now works only on the INR FOB)
  const [ccrItem, setCcrItem] = useState(null); // RITC whose compliance requirements are shown


  // Auto-calculate Drawback Amount
  useEffect(() => {
    let dbkAmt = 0;
    let fob = parseFloat(formData.fobValueInr) || 0; // The item FOB
    
    // Fallback to basic fob calc if fobValueInr is missing
    if (!fob && formData.qty && formData.price) {
       fob = parseFloat(formData.qty) * parseFloat(formData.price) * (perUnit(exportData.currency, exportData.exchRate, exportData.unitInRs) || 1);
    }
    
    if (formData.drawbackSrNo && fob > 0) {
       const dbkMaster = drawbacksMaster.find(d => d.tariffItem === formData.drawbackSrNo);
       if (dbkMaster) {
          const rate = parseFloat(dbkMaster.drawbackRate) || 0;
          const cap = parseFloat(dbkMaster.drawbackCap) || 0;
          let calculatedDbk = (fob * rate) / 100;
          
          // Apply cap if it exists and is > 0. (Cap is per UQC? Usually per kg/pcs. But let's assume it's total max or per unit. Actually Indian Customs cap is per Unit. So Cap * Qty)
          if (cap > 0 && formData.qty) {
             const maxCap = cap * parseFloat(formData.qty);
             if (calculatedDbk > maxCap) {
                calculatedDbk = maxCap;
             }
          }
          
          dbkAmt = calculatedDbk;
       }
    }
    
    if (dbkAmt.toFixed(2) !== (formData.drawbackAmount || '')) {
       handleFormChange('drawbackAmount', dbkAmt > 0 ? dbkAmt.toFixed(2) : '');
    }
  }, [formData.drawbackSrNo, formData.qty, formData.price, formData.fobValueInr, drawbacksMaster]);

  // NEW EFFECT FOR POLICY AND RODTEP/ROSCTL
  useEffect(() => {
      const fob = parseFloat(formData.fobValueInr) || 0;
      
      // EXPORT POLICY CHECK
      if (formData.ritc && exportPoliciesMaster.length > 0) {
          const policy = exportPoliciesMaster.find(p => p.tariffItem === formData.ritc);
          if (policy && policy.dgftPolicy !== 'FREE') {
              // We could alert or set warning state.
          }
      }

      // RODTEP CALCULATION (Scheme 60)
      if (String(formData.scheme).includes('60') && formData.ritc && fob > 0) {
          const rodtep = rodtepsMaster.find(r => r.tariffItem === formData.ritc);
          if (rodtep) {
              const rate = parseFloat(rodtep.rate) || 0;
              const cap = parseFloat(rodtep.cap) || 0;
              let amt = (fob * rate) / 100;
              const qty = parseFloat(formData.qty) || 0;
              if (cap > 0 && (amt > cap * qty)) {
                  amt = cap * qty;
              }
              // Here we would set formData.rodtepAmount if the field existed in UI state.
          }
      }
  }, [formData.ritc, formData.scheme, formData.fobValueInr, exportPoliciesMaster, rodtepsMaster, rosctlsMaster]);
  return { markFormTouched, formEdited, clearFormEdits, keepInBase, leaveFormOk, remapItemRows, exchOf, nextItemSr, ccrItem, setCcrItem, setExportData, activeItemForRitc, activeItemForScheme, activeSchemeTab, currentDocForm, defaultIcegateId, docList, dragOverRowIndex, draggedRowIndex, drawbacksMaster, esanchitMasters, esanchits, exportData, exportPoliciesMaster, formData, gridContainerRef, handleAddFilesToGrid, handleDragEnd, handleDragStart, handleFormChange, handleRitcSelect, handleSchemeSelect, handleSignAndUpload, icegateProfiles, isESanchitModalOpen, isIcegateDifferent, isManfModalOpen, isReExportModalOpen, isRitcModalOpen, isSchemeModalOpen, isSwInfoModalOpen, isSwStatementModalOpen, isUploading, items, reExports, ritcFilter, ritcList, rodtepsMaster, rosctlsMaster, schemeFilter, schemesList, selectedIcegateProfile, selectedRowId, setActiveItemForRitc, setActiveItemForScheme, setActiveSchemeTab, setCurrentDocForm, setDefaultIcegateId, setDocList, setDragOverRowIndex, setDraggedRowIndex, setDrawbacksMaster, setEsanchitMasters, setEsanchits, setExportPoliciesMaster, setFormData, setIcegateProfiles, setIsESanchitModalOpen, setIsIcegateDifferent, setIsManfModalOpen, setIsReExportModalOpen, setIsRitcModalOpen, setIsSchemeModalOpen, setIsSwInfoModalOpen, setIsSwStatementModalOpen, setIsUploading, setItems, setReExports, setRitcFilter, setRodtepsMaster, setRosctlsMaster, setSchemeFilter, setSchemesList, setSelectedIcegateProfile, setSelectedRowId, setShowPinPrompt, setStates, setSwInfoRowCount, setSwStatements, setTariffs, setToastMsg, setTokenPin, setUploadFiles, setUqcs, setValidationErrors, setValidationSuccess, showPinPrompt, showToast, states, swInfoRowCount, swStatements, tariffs, toastMsg, tokenPin, updateItem, uploadFiles, uqcs, validationErrors, validationSuccess };
}
