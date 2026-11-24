// State and logic
// Split out of JobHeaderTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React, { useState } from 'react';
import { getMaster } from '../../../../utils/masterCache'; // shared copy of small master lists, 09-Nov-2026
import { getParties } from '../../../../utils/partiesCache';
import toast from 'react-hot-toast';
import { useJobContext } from '../../JobContext';
import askConfirm from '../../../common/askConfirm'; // 22-Nov-2026: EagleView question window in place of the browser's OK / Cancel box

const HEADER_ALIAS = {
  chaCode: 'autoField_3', nameOfImporter: 'autoField_4', iecCode: 'autoField_5', address1: 'autoField_6', address2: 'autoField_7',
  city: 'autoField_8', state: 'autoField_9', pin: 'autoField_10', branchSrNo: 'autoField_48', aeoCode: 'autoField_49',
  igmDate: 'autoField_14', mawbDate: 'autoField_15', hawbDate: 'autoField_16', inwardDate: 'autoField_17',
  // 30-Oct-2026: shadow copies that other code / the builder fall back to - they follow the box, so a cleared box
  // cannot file the old value (CTX type / GSTIN, state, MAWB / HAWB / IGM numbers, port)
  autoField_50: 'commercialTaxType', autoField_13: 'commercialTaxRegistrationNo', autoField_11: 'ctxStateName', autoField_12: 'stateCode',
  mawbNo: 'mawbblNo', hawbNo: 'hawbhblNo', igmNumber: 'igmNo', portCode: 'autoField_2'
};

// grid rows saved with the job come back as a list (or as JSON text from older saves)
const asRows = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };

export default function useJobHeaderTab(ctx) {
  const { onSave } = ctx || {};
  const { jobData, setJobData, masters } = useJobContext();
  // 30-Oct-2026: handleIecNameChange / handleLocationChange / handleImporterSelect were removed - the importer and
  // port boxes are RichPartySelect / RichPortSelect, whose onSelect fills the same keys (and the CTX / state ones too).
  const handleChange = (e) => {
    const { name, value } = e.target;
    setJobData(prev => {
      const next = { ...prev, [name]: value };
      // Named boxes and the autoField_* keys the ICEGATE JSON builder reads must stay the same value.
      // Before this, typing in e.g. IEC Code changed only "iecCode" and the JSON kept the old autoField_5. 28-Oct-2026
      if (HEADER_ALIAS[name]) next[HEADER_ALIAS[name]] = value;
      // (the old "autoField_14 -> autoField_17" copy is gone: the inward date is not the IGM date and no box is named autoField_14)
if (name === 'autoField_11') {
          if (masters && Array.isArray(masters.states)) {
             const term = value.toUpperCase().trim();
             const found = masters.states.find(s => (s.stateName || '').toUpperCase().trim() === term || (s.stateCode || '').toUpperCase().trim() === term);
             if (found && found.taxCode) {
                 next.autoField_12 = found.taxCode;
             } else {
                 next.autoField_12 = value;
             }
          } else {
             next.autoField_12 = value;
          }
          next.stateCode = next.autoField_12;
        }
      return next;
    });
  };
  const [subAgent, setSubAgentState] = useState('N');
  const setSubAgent = (v) => { setSubAgentState(v); setJobData(prev => ({ ...prev, subAgentFlag: v })); };

  const [parties, setParties] = useState([]);
  const [ports, setPorts] = useState([]);

    // 17-Nov-2026: was one find() on id OR IEC OR name - the first party with the same IEC won. IIHIE0153E is the
    // common IEC of individuals (about 200 parties), so the Branch Sr. No. list showed another party's branches and the
    // importer's own branch could not be picked. Now: the party id, then the exact name, then the IEC only when one
    // party has it.
    // 22-Nov-2026: these three look-ups walked the whole party list on every key typed in any header box (about 10 ms of
    // each key); they are worked out again only when the party list or the boxes they read change
    const importerParty = React.useMemo(() => {
      const pid = jobData.importerPartyId;
      if (pid !== undefined && pid !== null && pid !== '') { const byId = parties.find(p => String(p.id) === String(pid)); if (byId) return byId; }
      const nm = String(jobData.nameOfImporter || jobData.autoField_4 || '').trim().toUpperCase();
      if (nm) { const byName = parties.find(p => String(p.name || '').trim().toUpperCase() === nm); if (byName) return byName; }
      const iec = String(jobData.iecCode || jobData.autoField_5 || '').trim().toUpperCase();
      if (!iec) return undefined;
      const byIec = parties.filter(p => String(p.taxId || '').trim().toUpperCase() === iec);
      return byIec.length === 1 ? byIec[0] : undefined;
    }, [parties, jobData.importerPartyId, jobData.nameOfImporter, jobData.autoField_4, jobData.iecCode, jobData.autoField_5]);
    const importerBranches = importerParty?.branches || [];
    
    const subagentParty = React.useMemo(() => parties.find(p => p.id === jobData.subagentPartyId || p.name === jobData.subagentName), [parties, jobData.subagentPartyId, jobData.subagentName]);
    const subagentBranches = subagentParty?.branches || [];

    // The AD code (the importer's Authorised Dealer / bank code, filed as the BE's authorizedEconomicDealerCode).
    // 30-Oct-2026: it took the party's FIRST AD code whatever port the BE was for, and only when a branch had been
    // chosen - yet an AD code belongs to a bank and a port, not to a branch. An importer banking at two ports got
    // the wrong code filed. The AD code of the BE's own port is used now; where that cannot be told apart (several
    // codes, none for this port) the box is left for the operator rather than filled with a guess.
    const adCodeFor = (port) => {
       const list = (importerParty && Array.isArray(importerParty.adCodes) ? importerParty.adCodes : []).filter(a => a && String(a.adCode || '').trim());
       if (!list.length) return '';
       const p = String(port || '').trim().toUpperCase();
       const atPort = p ? list.filter(a => String(a.loadingPort || '').trim().toUpperCase() === p) : [];
       if (atPort.length === 1) return String(atPort[0].adCode).trim();
       if (atPort.length > 1) return '';                        // more than one at this port: the operator picks
       return list.length === 1 ? String(list[0].adCode).trim() : '';
    };
    React.useEffect(() => {
       if (!(jobData.iecCode || jobData.autoField_5)) return;
       if (String(jobData.aeoCode || jobData.autoField_49 || '').trim()) return;
       const ad = adCodeFor(jobData.portCode || jobData.autoField_2 || jobData.customHouseCode);
       if (ad) setJobData(prev => ({ ...prev, aeoCode: ad, autoField_49: ad }));
    }, [(jobData.iecCode || jobData.autoField_5), (jobData.aeoCode || jobData.autoField_49), (jobData.portCode || jobData.autoField_2 || jobData.customHouseCode), importerParty, setJobData]); // eslint-disable-line


    const getStateInfo = (val) => {
        if (!val || !masters || !masters.states) return { name: val, taxCode: val };
        const term = val.toUpperCase().trim();
        const found = masters.states.find(s => (s.stateName || '').toUpperCase().trim() === term || (s.stateCode || '').toUpperCase().trim() === term);
        return {
            name: found ? found.stateName : val,
            taxCode: found && found.taxCode ? found.taxCode : val
        };
    };

    const CTX = { GSTIN: 'G', GSTN: 'G', 'INCOME TAX PAN': 'P', PAN: 'P', AADHAR: 'A', AADHAAR: 'A', PASSPORT: 'I', 'TIN NO': 'T', TIN: 'T', VAT: 'V', CST: 'C', 'SALES TAX REGISTRATION NO': 'S', 'SALES TAX': 'S', 'GST GOVERNMENT': 'O', 'GST DIPLOMAT': 'D', 'NOT REGISTERED': 'N' };
    const ctxOf = (v) => { const t = String(v || '').trim().toUpperCase(); if (!t || t === 'SELECT') return ''; if (/^[VCSGPAITDON]$/.test(t)) return t; return CTX[t] || CTX[t.replace(/^[A-Z] - /, '')] || ''; };
    const handleImporterBranchChange = (e) => {
        const branchSrNo = e.target.value;
        const branch = importerBranches.find(b => String(b.branchSrNo) === String(branchSrNo));
        if (branch) {
            setJobData(prev => ({
                ...prev,
                branchSrNo: branchSrNo, autoField_48: branchSrNo,
                autoField_6: branch.address1 || '',
                autoField_7: branch.address2 || '',
                autoField_8: branch.city || '',
                autoField_9: branch.state || '',
                autoField_10: branch.pinCode || '',
                autoField_13: branch.gstin || branch.regNo || prev.autoField_13,
                // ICEGATE code (30-Oct-2026); 17-Nov-2026: the branch's own CTX type (Aadhar, passport ...) is used too
                autoField_50: ctxOf(branch.ctxType) || ((branch.gstin || '').length === 15 ? 'G' : prev.autoField_50),
                autoField_11: getStateInfo(branch.ctxState || branch.state).name,
                autoField_12: getStateInfo(branch.ctxState || branch.state).taxCode,
                state: branch.state || '', city: branch.city || '', address1: branch.address1 || '', address2: branch.address2 || '', pin: branch.pinCode || ''
            }));
        } else {
            handleChange(e);
        }
    };

    const handleSubagentBranchChange = (e) => {
        const branchSrNo = e.target.value;
        const branch = subagentBranches.find(b => String(b.branchSrNo) === String(branchSrNo));
        if (branch) {
            setJobData(prev => ({
                ...prev,
                subagentBranchSrNo: branchSrNo, // 29-Oct-2026: autoField_42-45 / 60 are the HSS seller boxes - the sub-agent branch overwrote them
                subagentAddress: [branch.address1, branch.address2, branch.city, branch.state, branch.pinCode].filter(Boolean).join(', ')
            }));
        } else {
            handleChange(e);
        }
    };


  const [chaList, setChaList] = React.useState([]); // CHA Master (Settings) for the CHA Details picker
  // Masters > Bond and Masters > Warehouse for the Bond Code / Warehouse search popups
  const [bondMaster, setBondMaster] = React.useState([]);
  const [warehouseList, setWarehouseList] = React.useState([]);
  React.useEffect(() => {
    const rows = (d) => (Array.isArray(d) ? d : (d && Array.isArray(d.data) ? d.data : []));
    fetch('/api/masters/bonds').then(r => r.json()).then(d => setBondMaster(rows(d).filter(b => b.isActive !== false).map(b => ({ code: b.bondCode, name: b.description, src: 'Bond master' })))).catch(() => {});
    fetch('/api/masters/warehouses').then(r => r.json()).then(d => setWarehouseList(rows(d))).catch(() => {});
  }, []);
  React.useEffect(() => {
    getParties().then(d => setParties(d)).catch(e=>console.error(e)); // same copy as JobContext, 09-Nov-2026
    
    getMaster('/api/masters/ports').then(d => {
      if(Array.isArray(d)) setPorts(d);
      else if (d && d.success && Array.isArray(d.data)) setPorts(d.data);
    }).catch(e=>console.error(e));

    fetch('/api/masters/cha-master').then(r=>r.json()).then(data => {
      const chaData = Array.isArray(data) ? data : (data.success ? data.data : []);
      setChaList(chaData || []);
      const defaultCha = chaData.find(c => c.isDefault);
      if (defaultCha) {
        setJobData(prev => {
          if (!prev.autoField_3) {
            return { ...prev, chaCode: `${defaultCha.chaName} - ${defaultCha.chaCode}`, autoField_3: `${defaultCha.chaName} - ${defaultCha.chaCode}` };
          }
          return prev;
        });
      }
    }).catch(e=>console.error(e));
  }, []);

  
  
  
  
  const handlePortSelect = (e) => {
    const val = e.target.value;
    const selectedPort = ports.find(p => p.portName === val || p.portCode === val);
    if(selectedPort) {
       setJobData(prev => ({
         ...prev,
         gatewayPortName: selectedPort.portName,
         gatewayPortCode: selectedPort.portCode
       }));
    } else {
       setJobData(prev => ({ ...prev, gatewayPortName: val }));
    }
  };

  
  const [bond, setBond] = useState('N');
  const [certificate, setCertificate] = useState('N');
  
  const [highSeaSale, setHighSeaSale] = useState('N');
  const [section48, setSection48] = useState('N');
  const [firstCheck, setFirstCheck] = useState('N');
  const [priorBE, setPriorBE] = useState('N');
  const [provAssess, setProvAssess] = useState('N');
  const [addtlDetails, setAddtlDetails] = useState('N');

  // Y/N flags always follow the job on screen (a loaded or cleared job). Before, a job without the flag kept
  // the previous job's "Y". 28-Oct-2026
  React.useEffect(() => { setBond(jobData.bond || 'N'); }, [jobData.bond]);
  React.useEffect(() => { setCertificate(jobData.certificate || 'N'); }, [jobData.certificate]);
  React.useEffect(() => { setHighSeaSale(jobData.highSeaSaleFlag || 'N'); }, [jobData.highSeaSaleFlag]);
  React.useEffect(() => { setSection48(jobData.section48Requested || 'N'); }, [jobData.section48Requested]);
  React.useEffect(() => { setFirstCheck(jobData.firstCheckRequested || 'N'); }, [jobData.firstCheckRequested]);
  React.useEffect(() => { setPriorBE(jobData.whetherPriorBE || 'N'); }, [jobData.whetherPriorBE]);
  React.useEffect(() => { setProvAssess(jobData.provAssess || 'N'); }, [jobData.provAssess]);
  React.useEffect(() => { setAddtlDetails(jobData.addtlDetails || 'N'); }, [jobData.addtlDetails]);
  // SubAgent [Y/N] is saved with the job (it was screen-only, so a saved sub-agent was hidden after reload)
  React.useEffect(() => { setSubAgent(jobData.subAgentFlag || (jobData.subagentName ? 'Y' : 'N')); }, [jobData.subAgentFlag, jobData.subagentName]);

  const updateJobFlag = (key, val, setter) => {
    setter(val);
    setJobData(prev => ({ ...prev, [key]: val }));
  };

  const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);
  const EMPTY_CONT = { srNo: '', igmNumber: '', igmDate: '', contNo: '', sealNo: '', lclFcl: '', contSize: '', contType: '', truckNo: '' };
  const [containerForm, setContainerForm] = useState(EMPTY_CONT);
  
  const handleContainerChange = (e) => {
    const { name, value } = e.target;
    setContainerForm(prev => ({ ...prev, [name]: ['contNo', 'sealNo', 'truckNo', 'contType'].includes(name) ? value.toUpperCase() : value }));
  };
  
  const addContainer = () => {
    if(!containerForm.contNo) {
      toast.error("Container No is required");
      return;
    }
    const currentContainers = Array.isArray(jobData.containers) ? jobData.containers : [];
    if (currentContainers.some(c => String(c.contNo || '').toUpperCase() === containerForm.contNo.toUpperCase())) { toast.error('Container ' + containerForm.contNo + ' is already added'); return; }
    const newCont = { ...containerForm, id: Date.now(), srNo: containerForm.srNo || String(currentContainers.length + 1) };
    setJobData(prev => ({ ...prev, containers: [...(Array.isArray(prev.containers) ? prev.containers : []), newCont] }));
    setContainerForm(EMPTY_CONT);
  };
  
  const removeContainer = (id) => {
    setJobData(prev => ({ ...prev, containers: (Array.isArray(prev.containers) ? prev.containers : []).filter(c => c.id !== id) }));
  };

  const [isBondModalOpen, setIsBondModalOpen] = useState(false);
  const [isBondCodeSearchOpen, setIsBondCodeSearchOpen] = useState(false);
  const [isBondPortSearchOpen, setIsBondPortSearchOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isCertTypeSearchOpen, setIsCertTypeSearchOpen] = useState(false);
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [isWarehouseSearchOpen, setIsWarehouseSearchOpen] = useState(false);
  const [isHighSeaSaleModalOpen, setIsHighSeaSaleModalOpen] = useState(false);
  const [isSection48ModalOpen, setIsSection48ModalOpen] = useState(false);
    const [bondRows, setBondRows] = useState([]);
  const [bondEditIdx, setBondEditIdx] = useState(null);

  React.useEffect(() => { setBondRows(asRows(jobData._bondRows)); setBondEditIdx(null); }, [jobData._bondRows]);

  const handleBondAdd = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!String(jobData.autoField_24 || '').trim()) { toast.error('Enter the Bond No'); return; }
    if (bondEditIdx === null && bondRows.some(r => String(r.bondNo) === String(jobData.autoField_24).trim())) { toast.error('Bond ' + jobData.autoField_24 + ' is already added'); return; }
    const newRow = {
      id: bondEditIdx !== null ? bondRows[bondEditIdx].id : Date.now(),
      bondNo: String(jobData.autoField_24 || '').trim(),
      bondAmt: jobData.autoField_25 || '',
      bondCode: String(jobData.autoField_26 || '').toUpperCase(),
      bondPort: String(jobData.autoField_27 || '').toUpperCase(),
    };
    const updated = bondEditIdx !== null ? bondRows.map((r, i) => i === bondEditIdx ? newRow : r) : [...bondRows, newRow];
    setBondRows(updated);
    setBondEditIdx(null);
    setJobData(prev => ({ ...prev, _bondRows: updated, autoField_24: '', autoField_25: '', autoField_26: '', autoField_27: '' }));
  };

  const handleBondEdit = (e, idx) => {
    e.preventDefault();
    const row = bondRows[idx];
    setJobData(prev => ({ ...prev, autoField_24: row.bondNo, autoField_25: row.bondAmt, autoField_26: row.bondCode, autoField_27: row.bondPort }));
    setBondEditIdx(idx);
  };

  const handleBondRemove = (e, idx) => {
    e.preventDefault();
    const updated = bondRows.filter((_, i) => i !== idx);
    setBondRows(updated);
    setJobData(prev => ({ ...prev, _bondRows: updated }));
  };

  // Certificate grid (BE CERT table can have several rows; the popup's Add button was not connected). 28-Oct-2026
  const [certRows, setCertRows] = useState([]);
  const [certEditIdx, setCertEditIdx] = useState(null);
  React.useEffect(() => { setCertRows(asRows(jobData._certRows)); setCertEditIdx(null); }, [jobData._certRows]);
  const CERT_FORM_BLANK = { autoField_30: '', autoField_31: '', autoField_32: '', autoField_33: '', autoField_34: '', autoField_35: '' };
  const handleCertAdd = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const no = String(jobData.autoField_30 || '').trim();
    if (!no) { toast.error('Enter the Cert. No'); return; }
    if (!String(jobData.autoField_32 || '').trim()) { toast.error('Enter the Cert. Type'); return; }
    if (certRows.some((r, i) => i !== certEditIdx && String(r.certNo).toUpperCase() === no.toUpperCase())) { toast.error('Certificate ' + no + ' is already added'); return; }
    // 20-Nov-2026: the date is kept as DD/MM/YYYY. "07072025" typed without separators went into the BE file as
    // 0707-20-25 (eight digits are read as YYYYMMDD there); a date that is not a real date is refused.
    const certDate = (() => {
      const t = String(jobData.autoField_31 || '').trim(); if (!t) return '';
      const real = ([y, mo, d]) => { const dt = new Date(+y, +mo - 1, +d); return +y >= 1900 && dt.getFullYear() === +y && dt.getMonth() === +mo - 1 && dt.getDate() === +d; };
      const tries = []; let m; // [YYYY, MM, DD]
      if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t))) tries.push([m[1], m[2], m[3]]);
      if (/^\d{8}$/.test(t)) tries.push([t.slice(4), t.slice(2, 4), t.slice(0, 2)], [t.slice(0, 4), t.slice(4, 6), t.slice(6)]); // DDMMYYYY, then YYYYMMDD
      if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t))) tries.push([m[3], m[2].padStart(2, '0'), m[1].padStart(2, '0')]);
      const hit = tries.find(real);
      return hit ? `${hit[2]}/${hit[1]}/${hit[0]}` : null;
    })();
    if (certDate === null) { toast.error('Cert. Date: type a real date as DD/MM/YYYY'); return; }
    const row = { id: certEditIdx !== null ? certRows[certEditIdx].id : Date.now(), certNo: no, certDate, certType: String(jobData.autoField_32 || '').trim().toUpperCase(),
      commissionerate: jobData.autoField_33 || '', division: jobData.autoField_34 || '', range: jobData.autoField_35 || '' };
    const updated = certEditIdx !== null ? certRows.map((r, i) => i === certEditIdx ? row : r) : [...certRows, row];
    setCertRows(updated); setCertEditIdx(null);
    setJobData(prev => ({ ...prev, ...CERT_FORM_BLANK, _certRows: updated, certificate: 'Y' }));
  };
  const handleCertEdit = (idx) => {
    const r = certRows[idx];
    setJobData(prev => ({ ...prev, autoField_30: r.certNo || '', autoField_31: r.certDate || '', autoField_32: r.certType || '', autoField_33: r.commissionerate || '', autoField_34: r.division || '', autoField_35: r.range || '' }));
    setCertEditIdx(idx);
  };
  const handleCertRemove = async (idx) => {
    if (!(await askConfirm({ title: 'Remove this certificate?', message: 'The certificate row is taken off this job.', okLabel: 'Remove', cancelLabel: 'Keep', tone: 'danger' }))) return;
    const updated = certRows.filter((_, i) => i !== idx);
    setCertRows(updated); setCertEditIdx(null);
    setJobData(prev => ({ ...prev, _certRows: updated }));
  };

  const [hssRows, setHssRows] = useState([]);
  const [hssEditIdx, setHssEditIdx] = useState(null);

  // Sync hssRows from jobData when a job is loaded / cleared
  React.useEffect(() => { setHssRows(asRows(jobData._hssRows)); setHssEditIdx(null); }, [jobData._hssRows]);

  // High-sea seller's own branches (the branch list used to come from the sub-agent party)
  const hssParty = React.useMemo(() => parties.find(p => p.name === jobData.autoField_40 || p.partyName === jobData.autoField_40), [parties, jobData.autoField_40]);
  const hssBranches = hssParty?.branches || [];
  const handleHssBranchChange = (e) => {
    const sr = e.target.value;
    const b = hssBranches.find(x => String(x.branchSrNo) === String(sr));
    setJobData(prev => ({ ...prev, autoField_60: sr, ...(b ? { autoField_42: b.address1 || '', autoField_43: b.address2 || '', autoField_44: b.city || '', autoField_45: b.pinCode || '' } : {}) }));
  };

  // 30-Oct-2026: a high sea sale can pass through more than one seller. Each seller is a row with its own
  // "preceding level": 0 = the first seller (the one who bought from abroad), 1 = who bought from level 0, and so on.
  // Before this every row went out as level 0, which ICES reads as several first sellers.
  const hssLevel = (v) => { const m = String(v ?? '').match(/\d+/); return m ? parseInt(m[0], 10) : 0; };
  // the level the next seller should get, from the rows already in the grid
  const nextLevelAfter = (rows) => { const used = new Set((rows || []).map(r => hssLevel(r.precedingLevel))); let n = 0; while (used.has(n)) n += 1; return 'Level- ' + n; };
  const handleHssAdd = () => {
    if (!String(jobData.autoField_40 || '').trim() || !String(jobData.autoField_41 || '').trim()) { toast.error('Enter the seller Importer Name and IEC Code'); return; }
    { // one seller per level, and the chain starts at 0
      const lvl = hssLevel(jobData.autoField_61);
      const clash = hssRows.findIndex((r, i) => i !== hssEditIdx && hssLevel(r.precedingLevel) === lvl);
      if (clash !== -1) { toast.error('Level ' + lvl + ' is already used by ' + (hssRows[clash].importerName || 'another seller') + ' - give this seller the next level'); return; }
      const others = hssRows.filter((r, i) => i !== hssEditIdx).map(r => hssLevel(r.precedingLevel));
      if (lvl > 0 && !others.includes(lvl - 1)) { toast.error('Level ' + lvl + ' needs level ' + (lvl - 1) + ' first - the sale chain starts at Level- 0'); return; }
    }
    const newRow = {
      id: hssEditIdx !== null ? hssRows[hssEditIdx].id : Date.now(),
      importerName: jobData.autoField_40 || '',
      iecNo: jobData.autoField_41 || '',
      branchSrNo: jobData.autoField_60 || '',
      address1: jobData.autoField_42 || '',
      address2: jobData.autoField_43 || '',
      city: jobData.autoField_44 || '',
      pin: jobData.autoField_45 || '',
      precedingLevel: jobData.autoField_61 || 'Level- 0',  // level of this seller in the chain (0 = first)
    };
    const updated = hssEditIdx !== null
      ? hssRows.map((r, i) => i === hssEditIdx ? newRow : r)
      : [...hssRows, newRow];
    setHssRows(updated);
    setHssEditIdx(null);
    // Clear form fields after add
    setJobData(prev => ({ ...prev, autoField_40: '', autoField_41: '', autoField_42: '', autoField_43: '', autoField_44: '', autoField_45: '', autoField_60: '', autoField_61: nextLevelAfter(updated), _hssRows: updated }));
  };

  const handleHssEdit = (idx) => {
    const row = hssRows[idx];
    setJobData(prev => ({ ...prev,
      autoField_40: row.importerName || '',
      autoField_41: row.iecNo || '',
      autoField_60: row.branchSrNo || '',
      autoField_42: row.address1 || '',
      autoField_43: row.address2 || '',
      autoField_44: row.city || '',
      autoField_45: row.pin || '',
      autoField_61: row.precedingLevel || 'Level- 0',
    }));
    setHssEditIdx(idx);
  };

  const handleHssRemove = (idx) => {
    const updated = hssRows.filter((_, i) => i !== idx);
    setHssRows(updated);
    setJobData(prev => ({ ...prev, _hssRows: updated }));
  };

  const [isFirstCheckModalOpen, setIsFirstCheckModalOpen] = useState(false);
  const [isProvAssessModalOpen, setIsProvAssessModalOpen] = useState(false);
  const [containerData, setContainerData] = useState([]);

  // IGM GRID state
  const [igmRows, setIgmRows] = useState([]);
  const [igmEditIdx, setIgmEditIdx] = useState(null);

  // grid = the job's _igmRows (also after load / clear). The old "auto row" made a row out of the first letter
  // typed in IGM No for a new job. A job read from a file gets its rows from the parser. 28-Oct-2026
  React.useEffect(() => { setIgmRows(asRows(jobData._igmRows)); setIgmEditIdx(null); }, [jobData._igmRows]);

  // the IGM form as one grid row
  const igmFormRow = (d) => ({ igmNumber: String(d.igmNumber || d.igmNo || '').trim(), igmDate: (d.igmDate || d.autoField_14) || '', mawbNo: String((d.mawbNo || d.mawbblNo) || '').trim().toUpperCase(), mawbDate: (d.mawbDate || d.autoField_15) || '',
    hawbNo: String((d.hawbNo || d.hawbhblNo) || '').trim().toUpperCase(), hawbDate: (d.hawbDate || d.autoField_16) || '', inwardDate: (d.inwardDate || d.autoField_17) || '', totalPkg: d.totalPkg || '', pkgCode: String(d.pkg || '').toUpperCase(),
    grossWt: d.grossWt || '', wtUnit: String(d.grossWtUnit || '').toUpperCase(), marks1: (d.marksAndNumbers1 || d.marks1) || '', lineNo: d.lineNo || '' });
  const igmKey = (r) => [r.igmNumber || r.igmNo, r.mawbNo, r.hawbNo].map(x => String(x || '').trim().toUpperCase()).join('|');
  const igmFormFilled = (r) => !!(r.igmNumber || r.mawbNo || r.hawbNo);
  // 30-Oct-2026: the form is "pending" when it is not in the grid OR when the grid row with the same IGM / MAWB / HAWB
  // differs in any box (a date / packages / weight edited after Add was silently never saved)
  const igmDiffers = (row, r) => Object.keys(r).some(k => String(row[k] ?? '').trim().toUpperCase() !== String(r[k] ?? '').trim().toUpperCase());
  const igmPending = () => { const r = igmFormRow(jobData); if (!igmFormFilled(r)) return false; const same = igmRows.find(x => igmKey(x) === igmKey(r)); return !same || igmDiffers(same, r); };

  const handleAddIgmRow = () => {
    const f = igmFormRow(jobData);
    if (!igmFormFilled(f)) { toast.error('Enter IGM No or MAWB/HAWB No before Add'); return; }
    const sameIdx = igmRows.findIndex((x, i) => i !== igmEditIdx && igmKey(x) === igmKey(f));
    if (sameIdx !== -1 && igmEditIdx !== null) { toast.error('This IGM / MAWB / HAWB is already in the grid'); return; }
    // a row with the same IGM / MAWB / HAWB is updated in place (never a second row for the same IGM)
    const at = igmEditIdx !== null ? igmEditIdx : sameIdx;
    if (at !== -1 && at !== null && igmEditIdx === null) toast('IGM row ' + (at + 1) + ' updated with the form values', { icon: 'ℹ️' });
    // Update keeps the row's other keys (e.g. marks2 / marks3 read from a file)
    const row = at !== -1 && at !== null ? { ...igmRows[at], ...f, igmNo: f.igmNumber } : { id: Date.now(), ...f };
    const updated = at !== -1 && at !== null ? igmRows.map((r, i) => i === at ? row : r) : [...igmRows, row];
    setIgmRows(updated); setIgmEditIdx(null);
    setJobData(prev => ({ ...prev, _igmRows: updated }));
    return updated;
  };

  // clears every key the IGM boxes read (before, the dates / MAWB kept their old value through the second key)
  const IGM_FORM_BLANK = { igmNumber: '', igmNo: '', igmDate: '', autoField_14: '', mawbNo: '', mawbblNo: '', mawbDate: '', autoField_15: '', hawbNo: '', hawbhblNo: '', hawbDate: '', autoField_16: '',
    inwardDate: '', autoField_17: '', totalPkg: '', pkg: '', grossWt: '', grossWtUnit: '', marksAndNumbers1: '', marks1: '', lineNo: '' };
  const handleClearIgmRow = () => {
    setJobData(prev => ({ ...prev, ...IGM_FORM_BLANK }));
    setIgmEditIdx(null);
  };

  const handleEditIgmRow = (idx) => {
    const row = igmRows[idx];
    setJobData(prev => ({ ...prev, ...IGM_FORM_BLANK, igmNumber: row.igmNumber || row.igmNo || '', igmDate: row.igmDate || '', autoField_14: row.igmDate || '', mawbNo: row.mawbNo || '', mawbDate: row.mawbDate || '', autoField_15: row.mawbDate || '',
      hawbNo: row.hawbNo || '', hawbDate: row.hawbDate || '', autoField_16: row.hawbDate || '', inwardDate: row.inwardDate || '', autoField_17: row.inwardDate || '', totalPkg: row.totalPkg || '', pkg: row.pkgCode || '',
      grossWt: row.grossWt || '', grossWtUnit: row.wtUnit || '', marksAndNumbers1: row.marks1 || '', marks1: row.marks1 || '', lineNo: row.lineNo || '' }));
    setIgmEditIdx(idx);
  };

  const handleRemoveIgmRow = async (idx) => {
    if (!(await askConfirm({ title: 'Remove this IGM row?', message: 'The IGM / MAWB / HAWB row is taken off this job.', okLabel: 'Remove', cancelLabel: 'Keep', tone: 'danger' }))) return;
    const updated = igmRows.filter((_, i) => i !== idx);
    setIgmRows(updated); setIgmEditIdx(null);
    setJobData(prev => ({ ...prev, _igmRows: updated }));
  };

  // ---- bottom buttons ----
  // Save: saves the job (new job -> new Job No; a loaded job is updated). Modify: only for a job that is already saved.
  // Both first offer to add IGM details typed in the form but not added to the grid (they were silently not sent). 28-Oct-2026
  const handleHeaderSave = async (mode) => {
    if (mode === 'modify' && !jobData.id) { toast.error('This job is not saved yet - use Save. To change a saved job, open it from 1. Job Query.'); return; }
    let overrides = {};
    if (igmPending() && await askConfirm({ title: 'IGM details not added', message: 'IGM / MAWB / HAWB details in the form are not added to the IGM grid.', okLabel: 'Add them and save', cancelLabel: 'Save without them' })) {
      const rows = handleAddIgmRow();
      if (rows) overrides = { _igmRows: rows };
    }
    await onSave(overrides);
  };

  // Clear: empties the Job Header form only. Invoices, items, e-Sanchit docs and the job identity are kept.
  // Before, it deleted every key; a later Save then kept the old values in the database (missing keys are not updated). 28-Oct-2026
  const KEEP_ON_CLEAR = new Set(['id', 'jobNo', 'jobDate', 'status', 'beNo', 'beDate', 'invoices', 'items', 'esanchitDocs', 'finalDocs', 'branchId', 'financialYearId', 'shipmentMode', 'boeType',
    'inBondJobId', 'createdAt', 'updatedAt', 'icegateStatus', 'icegateUniqueId', 'isAmended', 'cumulativeFreight', 'cumulativeFreightFlag', 'cumulativeInsurance', 'cumulativeMiscCharge']);
  const handleClearForm = async () => {
    if (!(await askConfirm({ title: 'Clear the Job Header form?', message: 'Every box of the Job Header is emptied.', note: 'Invoices and items are not touched.', okLabel: 'Clear', cancelLabel: 'Keep', tone: 'danger' }))) return;
    setJobData(prev => {
      const next = {};
      for (const [k, v] of Object.entries(prev)) {
        if (KEEP_ON_CLEAR.has(k) || /^icegate/i.test(k) || (k.startsWith('_') && !['_igmRows', '_bondRows', '_hssRows', '_certRows'].includes(k))) next[k] = v;
        else if (Array.isArray(v)) next[k] = [];
        else if (v && typeof v === 'object') next[k] = v;
        else next[k] = '';
      }
      const def = chaList.find(c => c.isDefault);
      if (def) { next.chaCode = `${def.chaName} - ${def.chaCode}`; next.autoField_3 = next.chaCode; }
      return next;
    });
    setIgmEditIdx(null); setBondEditIdx(null); setHssEditIdx(null); setCertEditIdx(null); setContainerForm(EMPTY_CONT);
  };
  return { certRows, certEditIdx, handleCertAdd, handleCertEdit, handleCertRemove, bondMaster, warehouseList, chaList, handleHeaderSave, handleClearForm, hssBranches, handleHssBranchChange, addContainer, addtlDetails, bond, bondEditIdx, bondRows, certificate, containerData, containerForm, firstCheck, getStateInfo, handleAddIgmRow, handleBondAdd, handleBondEdit, handleBondRemove, handleChange, handleClearIgmRow, handleContainerChange, handleEditIgmRow, handleHssAdd, handleHssEdit, handleHssRemove, handleImporterBranchChange, handlePortSelect, handleRemoveIgmRow, handleSubagentBranchChange, highSeaSale, hssEditIdx, hssRows, igmEditIdx, igmRows, importerBranches, importerParty, isBondCodeSearchOpen, isBondModalOpen, isBondPortSearchOpen, isCertModalOpen, isCertTypeSearchOpen, isContainerModalOpen, isFirstCheckModalOpen, isHighSeaSaleModalOpen, isProvAssessModalOpen, isSection48ModalOpen, isWarehouseModalOpen, isWarehouseSearchOpen, jobData, masters, parties, ports, priorBE, provAssess, removeContainer, section48, setAddtlDetails, setBond, setBondEditIdx, setBondRows, setCertificate, setContainerData, setContainerForm, setFirstCheck, setHighSeaSale, setHssEditIdx, setHssRows, setIgmEditIdx, setIgmRows, setIsBondCodeSearchOpen, setIsBondModalOpen, setIsBondPortSearchOpen, setIsCertModalOpen, setIsCertTypeSearchOpen, setIsContainerModalOpen, setIsFirstCheckModalOpen, setIsHighSeaSaleModalOpen, setIsProvAssessModalOpen, setIsSection48ModalOpen, setIsWarehouseModalOpen, setIsWarehouseSearchOpen, setJobData, setParties, setPorts, setPriorBE, setProvAssess, setSection48, setSubAgent, subAgent, subagentBranches, subagentParty, updateJobFlag };
}
