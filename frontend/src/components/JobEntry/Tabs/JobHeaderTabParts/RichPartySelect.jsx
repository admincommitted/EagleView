// Component RichPartySelect
// Split out of JobHeaderTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React, { useState } from 'react';

export function RichPartySelect({ parties, jobData, setJobData, type = 'IMPORTER', masters }) {
    const [query, setQuery] = React.useState('');
    const [isOpen, setIsOpen] = React.useState(false);
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
    const wrapperRef = React.useRef(null);
  
    // 22-Nov-2026: typing here hung the screen. One letter matched every party-branch (41,180 on the test data) and all
    // of them were drawn as list rows, on every key; each key also wrote the name into the job, which draws the whole
    // job screen again. Now: the option list is built once per party list, only the first 60 matches are drawn (a line
    // says how many more there are), and the typed name goes into the job a moment after typing stops or on leaving the box.
    const MAX_ROWS = 60;
    const options = React.useMemo(() => { const options = [];
    (parties || []).filter(p => type === 'SUBAGENT' ? p.isSubAgent : true).forEach(p => {
      if (p.branches && p.branches.length > 0) {
        p.branches.forEach(b => {
          options.push({ partyId: p.id, partyName: p.name, taxId: p.taxId, panNumber: p.panNumber, branchSrNo: b.branchSrNo, address1: b.address1, address2: b.address2, city: b.city, state: b.state, pinCode: b.pinCode, gstin: b.gstin || b.regNo || '', stateCode: b.ctxState || '', ctxType: b.ctxType || '', classType: p.classType || '', adCode: (p.adCodes && p.adCodes.length > 0) ? p.adCodes[0].adCode : '' });
        });
      } else {
        // 30-Oct-2026: a party without branches gives no branch sr no (the validator asks for it) instead of a silent 1
        options.push({ partyId: p.id, partyName: p.name, taxId: p.taxId, panNumber: p.panNumber, branchSrNo: '', address1: p.street, address2: '', city: p.city, state: p.stateProvince, pinCode: p.zipPostcode, gstin: '', stateCode: '', classType: p.classType || '', adCode: (p.adCodes && p.adCodes.length > 0) ? p.adCodes[0].adCode : '' });
      }
    });
    return options.map(o => ({ ...o, _n: String(o.partyName || '').toLowerCase(), _a: String(o.address1 || '').toLowerCase() })); }, [parties, type]);

    const allMatches = React.useMemo(() => {
      const q = String(query || '').toLowerCase();
      if (!q) return [];
      return options.filter(o => o._n.includes(q) || o._a.includes(q));
    }, [options, query]);
    const filtered = allMatches.length > MAX_ROWS ? allMatches.slice(0, MAX_ROWS) : allMatches;

    // the typed name is written to the job a moment after typing stops (and at once on leaving the box)
    const pendingName = React.useRef(null);
    const nameTimer = React.useRef(null);
    const writeName = (v) => {
      if (type === 'HIGH_SEA') setJobData(prev => ({ ...prev, autoField_40: v }));
      else if (type === 'SUBAGENT') setJobData(prev => ({ ...prev, subagentName: v }));
      else setJobData(prev => ({ ...prev, nameOfImporter: v, autoField_4: v }));
    };
    const flushName = () => { if (nameTimer.current) { clearTimeout(nameTimer.current); nameTimer.current = null; } if (pendingName.current !== null) { const v = pendingName.current; pendingName.current = null; writeName(v); } };
    const dropPendingName = () => { if (nameTimer.current) { clearTimeout(nameTimer.current); nameTimer.current = null; } pendingName.current = null; };
    React.useEffect(() => () => { if (nameTimer.current) clearTimeout(nameTimer.current); }, []);
  
    React.useEffect(() => {
      function handleClickOutside(event) {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
  
    const displayValue = isOpen ? query : (type === 'SUBAGENT' ? (jobData.subagentName || '') : type === 'HIGH_SEA' ? (jobData.autoField_40 || '') : ((jobData.nameOfImporter || jobData.autoField_4) || ''));
    
    const CTX = { GSTIN: 'G', GSTN: 'G', 'INCOME TAX PAN': 'P', PAN: 'P', AADHAR: 'A', AADHAAR: 'A', PASSPORT: 'I', 'TIN NO': 'T', TIN: 'T', VAT: 'V', CST: 'C', 'SALES TAX REGISTRATION NO': 'S', 'SALES TAX': 'S', 'GST GOVERNMENT': 'O', 'GST DIPLOMAT': 'D', 'NOT REGISTERED': 'N' };
    const ctxOfOpt = (o) => {
      const t = String(o.ctxType || '').trim().toUpperCase();
      const c = !t || t === 'SELECT' ? '' : (/^[VCSGPAITDON]$/.test(t) ? t : (CTX[t] || CTX[t.replace(/^[A-Z] - /, '')] || ''));
      return c || (o.gstin && o.gstin.length === 15 ? 'G' : (o.panNumber ? 'P' : ''));
    };
    const handleSelect = (opt) => {
        dropPendingName(); // the picked party sets the name itself
        
    const getStateInfo = (val) => {
        if (!val || !masters || !masters.states) return { name: val, taxCode: val };
        const term = val.toUpperCase().trim();
        const found = masters.states.find(s => (s.stateName || '').toUpperCase().trim() === term || (s.stateCode || '').toUpperCase().trim() === term);
        return {
            name: found ? found.stateName : val, // "ctx state me state ka naam aayega" -> DELHI
            taxCode: found && found.taxCode ? found.taxCode : val // state code -> 07
        };
    };

        const stateInfo = getStateInfo(opt.stateCode || opt.state || '');
        if (type === 'HIGH_SEA') {
            setJobData(prev => ({
                ...prev,
                autoField_40: opt.partyName,
                autoField_41: opt.taxId || opt.panNumber || '',
                autoField_42: opt.address1 || '',
                autoField_43: opt.address2 || '',
                autoField_44: opt.city || '',
                autoField_45: opt.pinCode || '',
                autoField_60: opt.branchSrNo || '',
            }));
        } else if (type === 'SUBAGENT') {
            setJobData(prev => ({
                ...prev,
                subagentName: opt.partyName, subagentPartyId: opt.partyId, subagentBranchSrNo: opt.branchSrNo, // 29-Oct-2026: was autoField_60 = the HSS seller's branch box
                subagentAddress: [opt.address1, opt.address2, opt.city, opt.state, opt.pinCode].filter(Boolean).join(', ')
            }));
        } else {
            setJobData(prev => ({
                ...prev,
                nameOfImporter: opt.partyName, autoField_4: opt.partyName, importerPartyId: opt.partyId, autoField_48: opt.branchSrNo, branchSrNo: opt.branchSrNo, // 17-Nov-2026: both keys (an old branchSrNo stayed)
                iecCode: opt.taxId || opt.panNumber || '', autoField_5: opt.taxId || opt.panNumber || '',
                address1: opt.address1 || '', autoField_6: opt.address1 || '',
                address2: opt.address2 || '', autoField_7: opt.address2 || '',
                city: opt.city || '', autoField_8: opt.city || '',
                state: opt.state || '', autoField_9: opt.state || '',
                pin: opt.pinCode || '', autoField_10: opt.pinCode || '',
                // autoField_40-45 / 60 are the High Sea Sale seller form: choosing the importer no longer overwrites it. 28-Oct-2026
                // 30-Oct-2026: CTX type is the ICEGATE code (G = GSTIN, P = PAN) or blank - "Select" was being filed as the type;
                // the registration no is the GSTIN (PAN only when the branch has no GSTIN); the importer type is not the party
                // master's class (Customer / Vendor...) - it stays as the operator set it
                autoField_13: opt.gstin || opt.panNumber || '',
                // 17-Nov-2026: the branch's own CTX type from the Party Master (Aadhar, passport ...) first - it was GSTIN or PAN only
                commercialTaxType: ctxOfOpt(opt), autoField_50: ctxOfOpt(opt),
                ctxStateName: stateInfo.name, autoField_11: stateInfo.name,
                stateCode: stateInfo.taxCode, autoField_12: stateInfo.taxCode,
                commercialTaxRegistrationNo: opt.gstin || opt.panNumber || '',
                aeoCode: opt.adCode, autoField_49: opt.adCode || ''
            }));
        }
        setIsOpen(false);
    };
  
  
  // IGM GRID state
  const [igmRows, setIgmRows] = useState([]);
  const [igmEditIdx, setIgmEditIdx] = useState(null);

  React.useEffect(() => {
    if (jobData._igmRows && Array.isArray(jobData._igmRows) && jobData._igmRows.length > 0) {
      setIgmRows(jobData._igmRows);
    } else if (jobData.igmNumber && igmRows.length === 0) {
      const autoRow = { id: Date.now(), igmNumber: jobData.igmNumber || '', igmDate: (jobData.igmDate || jobData.autoField_14) || '', mawbNo: (jobData.mawbNo || jobData.mawbblNo) || '', mawbDate: (jobData.mawbDate || jobData.autoField_15) || '', hawbNo: (jobData.hawbNo || jobData.hawbhblNo) || '', hawbDate: (jobData.hawbDate || jobData.autoField_16) || '', inwardDate: (jobData.inwardDate || jobData.autoField_17) || '', totalPkg: jobData.totalPkg || '', pkgCode: jobData.pkg || '', grossWt: jobData.grossWt || '', wtUnit: jobData.grossWtUnit || '', marks1: (jobData.marksAndNumbers1 || jobData.marks1) || '', lineNo: jobData.lineNo || '' };
      if (autoRow.igmNo || autoRow.mawbNo) setIgmRows([autoRow]);
    }
  }, [jobData.igmNumber, (jobData.mawbNo || jobData.mawbblNo), jobData._igmRows]);

  const handleAddIgmRow = () => {
    const row = { id: igmEditIdx !== null ? igmRows[igmEditIdx].id : Date.now(), igmNumber: jobData.igmNumber || '', igmDate: (jobData.igmDate || jobData.autoField_14) || '', mawbNo: (jobData.mawbNo || jobData.mawbblNo) || '', mawbDate: (jobData.mawbDate || jobData.autoField_15) || '', hawbNo: (jobData.hawbNo || jobData.hawbhblNo) || '', hawbDate: (jobData.hawbDate || jobData.autoField_16) || '', inwardDate: (jobData.inwardDate || jobData.autoField_17) || '', totalPkg: jobData.totalPkg || '', pkgCode: jobData.pkg || '', grossWt: jobData.grossWt || '', wtUnit: jobData.grossWtUnit || '', marks1: (jobData.marksAndNumbers1 || jobData.marks1) || '', lineNo: jobData.lineNo || '' };
    const updated = igmEditIdx !== null ? igmRows.map((r, i) => i === igmEditIdx ? row : r) : [...igmRows, row];
    setIgmRows(updated); setIgmEditIdx(null);
    setJobData(prev => ({ ...prev, _igmRows: updated }));
  };

  const handleClearIgmRow = () => {
    setJobData(prev => ({ ...prev, igmNumber: '', igmNo: '', autoField_14: '', mawbNo: '', autoField_15: '', hawbNo: '', autoField_16: '', autoField_17: '', totalPkg: '', pkg: '', grossWt: '', grossWtUnit: '', marksAndNumbers1: '', marks1: '', lineNo: '' }));
    setIgmEditIdx(null);
  };

  const handleEditIgmRow = (idx) => {
    const row = igmRows[idx];
    setJobData(prev => ({ ...prev, igmNumber: row.igmNumber || row.igmNo, igmDate: row.igmDate, autoField_14: row.igmDate, mawbNo: row.mawbNo, mawbDate: row.mawbDate, autoField_15: row.mawbDate, hawbNo: row.hawbNo, hawbDate: row.hawbDate, autoField_16: row.hawbDate, inwardDate: row.inwardDate, autoField_17: row.inwardDate, totalPkg: row.totalPkg, pkg: row.pkgCode, grossWt: row.grossWt, grossWtUnit: row.wtUnit, marksAndNumbers1: row.marks1, marks1: row.marks1, lineNo: row.lineNo }));
    setIgmEditIdx(idx);
  };

  const handleRemoveIgmRow = (idx) => {
    const updated = igmRows.filter((_, i) => i !== idx);
    setIgmRows(updated);
    setJobData(prev => ({ ...prev, _igmRows: updated }));
  };

    return (
      <div ref={wrapperRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
        <input 
          type="text" 
          className="input-field mandatory-field"
          value={displayValue} 
          onChange={(e) => { 
            const v = e.target.value;
            setQuery(v); 
            setIsOpen(true); 
            setHighlightedIndex(-1);
            pendingName.current = v;
            if (nameTimer.current) clearTimeout(nameTimer.current);
            nameTimer.current = setTimeout(flushName, 300);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={flushName}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1)); }
            if (e.key === 'Enter' && highlightedIndex >= 0 && filtered[highlightedIndex]) { e.preventDefault(); handleSelect(filtered[highlightedIndex]); }
          }}
          style={{ width: '100%', color: '#0f172a', border: '1px solid #f87171' }} 
        />
        {isOpen && query.length > 0 && filtered.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border-color, #cbd5e1)', borderTop: 'none', zIndex: 50, maxHeight: '350px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            {filtered.map((opt, i) => (
              <div 
                key={i} onClick={() => handleSelect(opt)}
                style={{ padding: '6px 8px', borderBottom: '1px solid var(--bg-input, #f1f5f9)', cursor: 'pointer', background: i === highlightedIndex ? '#fdf2f8' : 'white' }}
                onMouseEnter={() => setHighlightedIndex(i)}
              >
                <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #ec4899)', fontSize: '11px' }}>{opt.partyName}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{opt.address1}{opt.city ? `, ${opt.city}` : ''}</div>
              </div>
            ))}
            {allMatches.length > filtered.length && (
              <div style={{ padding: '4px 8px', fontSize: '10px', color: 'var(--text-muted, #64748b)', background: 'var(--bg-app, #f8fafc)', textTransform: 'none' }}>First {filtered.length} of {allMatches.length} shown - type more letters to narrow the list</div>
            )}
          </div>
        )}
      </div>
    );
}
