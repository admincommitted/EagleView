// Helpers and constants
// Split out of ExportHeaderTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React, { useEffect, useState } from 'react';
import { partyMerc, partyClass } from './useExportHeaderTab';

export function RichPortSelect({ ports, exportData, setExportData }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = React.useRef(null);

  const filteredAll = (() => {
    if (!query) return ports;
    const q = query.toLowerCase();
    const matched = ports.filter(p =>
      p.portCode?.toLowerCase()?.includes(q) ||
      p.portName?.toLowerCase()?.includes(q)
    );
    return matched.sort((a, b) => {
      const ac = a.portCode?.toLowerCase() || '';
      const bc = b.portCode?.toLowerCase() || '';
      const an = a.portName?.toLowerCase() || '';
      const bn = b.portName?.toLowerCase() || '';
      const score = (c, n) =>
        c === q         ? 0 :
        c.startsWith(q) ? 1 :
        n.startsWith(q) ? 2 :
        c.includes(q)   ? 3 : 4;
      return score(ac, an) - score(bc, bn);
    });
  })();
  // 22-Nov-2026: only the first 60 matches are drawn - one letter matched thousands of rows and typing hung
  const filtered = filteredAll.length > 60 ? filteredAll.slice(0, 60) : filteredAll;

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayValue = isOpen ? query : (exportData.customsPortCode || '');

  const handleSelect = (opt) => {
    setExportData({ 
       ...exportData, 
       customsPortCode: opt.portCode, 
       customsPortName: opt.portName 
    });
    setIsOpen(false);
  };

return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input 
        type="text" 
        className={"input-field " + (!displayValue ? "mandatory-missing" : "")} 
        value={displayValue} 
        onChange={(e) => { 
          setQuery(e.target.value); setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1)); }
          if (e.key === 'Enter' && highlightedIndex >= 0 && filtered[highlightedIndex]) { e.preventDefault(); handleSelect(filtered[highlightedIndex]); }
        }}
        placeholder="PORT CODE" 
        style={{ width: '60px', textAlign: 'center', background: 'var(--bg-input)' }} 
      />
      <input type="text" className="input-field" value={exportData.customsPortName || ''} readOnly style={{ flex: 1, background: 'var(--bg-input)',  }} placeholder="PORT NAME" />
      
      {isOpen && query.length > 0 && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, width: 'calc(100% - 74px)', background: 'white', border: '1px solid var(--primary-border)', borderTop: 'none', zIndex: 50, maxHeight: '350px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          {filtered.map((opt, i) => (
            <div 
              key={i} 
              onClick={() => handleSelect(opt)}
              style={{ padding: '6px 8px', borderBottom: '1px solid var(--bg-input, #f1f5f9)', cursor: 'pointer', background: i === highlightedIndex ? '#e0f2fe' : 'white' }}
              onMouseEnter={() => setHighlightedIndex(i)}
            >
              <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{opt.portCode}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{opt.portName} ({opt.category})</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RichPartySelect({ parties, type, exportData, setExportData }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = React.useRef(null);

  // Flatten parties into branches
  const options = [];
  parties.filter(p => type === 'SHIPPER' ? p.isShipper : type === 'SUBAGENT' ? p.isSubAgent : p.isConsignee).forEach(p => {
    if (p.branches && p.branches.length > 0) {
      p.branches.forEach(b => {
        options.push({
          partyId: p.id,
          partyName: p.name,
          taxId: p.taxId,
          panNumber: p.panNumber,
          mercManuf: p.mercManuf,
          branchSrNo: b.branchSrNo,
          address1: b.address1,
          address2: b.address2,
          city: b.city,
          state: b.state,
          pinCode: b.pinCode,
          country: p.countryCode,
          gstin: b.gstin || b.regNo || p.panNumber
        });
      });
    } else {
      options.push({
        partyId: p.id,
        partyName: p.name,
        taxId: p.taxId,
        panNumber: p.panNumber,
        mercManuf: p.mercManuf,
        branchSrNo: '',
        address1: p.street,
        address2: '',
        city: p.city,
        state: p.stateProvince,
        pinCode: p.zipPostcode,
        country: p.countryCode,
        gstin: p.panNumber
      });
    }
  });

  const filteredAllParties = !query ? [] : options.filter(o => 
    o.partyName?.toLowerCase()?.includes(query?.toLowerCase()) || 
    (o.address1 && o.address1?.toLowerCase()?.includes(query?.toLowerCase()))
  );
  // 22-Nov-2026: only the first 60 matches are drawn (typing one letter drew every party-branch and hung)
  const filtered = filteredAllParties.length > 60 ? filteredAllParties.slice(0, 60) : filteredAllParties;

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentValue = type === 'SHIPPER' ? exportData.shipperName : type === 'SUBAGENT' ? exportData.subAgentName : exportData.consigneeName;
  const displayValue = isOpen ? query : (currentValue || '');

  
  const handleSelect = (opt) => {
    if (type === 'SHIPPER') {
      const party = parties.find(p => p.id === opt.partyId);
      const adCodes = party ? (party.adCodes || []) : [];
      const singleAdCode = adCodes.length === 1 ? adCodes[0].adCode : (exportData.adCode || '');
      // a branch without GSTIN falls back to the PAN: then the GSTN type is PAN (it stayed "GSTIN" and ICEGATE
      // rejects a PAN sent as GSTIN). 29-Oct-2026
      const regNo = String(opt.gstin || '').trim().toUpperCase();
      const regType = /^[0-9]{2}[A-Z0-9]{13}$/.test(regNo) ? 'GSTIN' : /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(regNo) ? 'PAN' : (exportData.shipperGstinType || 'GSTIN');

      setExportData({ 
         ...exportData, 
         shipperId: opt.partyId, 
         shipperName: opt.partyName, 
         shipperIec: opt.taxId || '', 
         shipperGstin: regNo, shipperGstinType: regType,
         // from the party master (Manufacturer / Merchant / courier C, D); Class too (was not taken). 29-Oct-2026
         mercManuf: partyMerc(opt.mercManuf) || 'M',
         shipperClass: partyClass(party && party.classType) || exportData.shipperClass || 'P',
         shipperBranchSrNo: opt.branchSrNo,
         shipperAddress1: opt.address1 || '', 
         shipperAddress2: opt.address2 || '', 
         shipperCity: opt.city || '', 
         shipperState: opt.state || '', 
         shipperPin: opt.pinCode || '',
         adCode: singleAdCode,
         panNo: opt.panNumber || '', autoField_12: opt.panNumber || exportData.autoField_12 || '',
         // state of origin of the goods = exporter's state when not chosen yet
         ...(exportData.stateOriginCode ? {} : (() => { const g = /^[0-9]{2}/.exec(regNo); return g && regType === 'GSTIN' ? { stateOriginCode: g[0] } : {}; })()),
         drawbackAcNo: party?.drawbackAccounts?.[0]?.accountNo || '',
         ifscCd: party?.drawbackAccounts?.[0]?.ifscCode || '',
         forexCode: party?.drawbackAccounts?.[0]?.bankName || ''
      });
    } else if (type === 'SUBAGENT') {
      setExportData({ 
         ...exportData, 
         subAgentId: opt.partyId, 
         subAgentName: opt.partyName, 
         subAgentAddress1: [opt.address1, opt.address2, opt.city, opt.state, opt.pinCode, opt.country].filter(Boolean).join(', ')
      });
    } else {
      setExportData({ 
         ...exportData, 
         consigneeId: opt.partyId, 
         consigneeName: opt.partyName, 
         consigneeAddress1: opt.address1 || '', 
         consigneeAddress2: opt.address2 || '', 
         consigneeAddress3: opt.address3 || '',
         consigneeCity: opt.city || '', 
         consigneeCountry: opt.country || '', 
         consigneeCountryCode: opt.country || ''
      });
    }
    setIsOpen(false);
  };
return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: 1 }}>
      <input 
        type="text" 
        className={"input-field " + ((!displayValue && type !== 'SUBAGENT') ? "mandatory-missing" : "")} 
        value={displayValue} 
        onChange={(e) => {
          const val = e.target.value;
          setQuery(val);
          setIsOpen(true);
          if (type === 'SHIPPER') setExportData(prev => ({ ...prev, shipperName: val, shipperId: null }));
          else if (type === 'SUBAGENT') setExportData(prev => ({ ...prev, subAgentName: val, subAgentId: null }));
          else setExportData(prev => ({ ...prev, consigneeName: val, consigneeId: null }));
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1)); }
          if (e.key === 'Enter' && highlightedIndex >= 0 && filtered[highlightedIndex]) { e.preventDefault(); handleSelect(filtered[highlightedIndex]); }
        }}
        placeholder={`Search ${type}...`} 
        style={{ width: '100%', border: '1px solid var(--primary-border)' }} 
      />
      
      {isOpen && query.length > 0 && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--primary-border)', borderTop: 'none', zIndex: 50, maxHeight: '350px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          {filtered.map((opt, i) => (
            <div 
              key={i} 
              onClick={() => handleSelect(opt)}
              style={{ padding: '6px 8px', borderBottom: '1px solid var(--bg-input, #f1f5f9)', cursor: 'pointer', background: i === highlightedIndex ? '#e0f2fe' : 'white' }}
              onMouseEnter={() => setHighlightedIndex(i)}
            >
              <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{opt.partyName}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{opt.address1}{opt.city ? `, ${opt.city}` : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
