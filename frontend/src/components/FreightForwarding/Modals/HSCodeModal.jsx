import React, { useState } from 'react';

/**
 * HSCodeModal — HS/Harmonised Code selector
 * Props:
 *   isOpen   {boolean}  — show/hide modal
 *   onClose  {function} — called when modal closes
 *   onSelect {function} — called with selected HS code string when user picks one
 */
const HSCodeModal = ({ isOpen, onClose, onSelect }) => {
  const [inputCode, setInputCode]   = useState('');
  const [codeList,  setCodeList]    = useState([]);
  const [error,     setError]       = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    const trimmed = inputCode.trim().replace(/\s+/g, '');
    if (!trimmed) { setError('Please enter an HS Code.'); return; }
    if (!/^\d{6,10}$/.test(trimmed)) { setError('HS Code must be 6-10 digits.'); return; }
    if (codeList.includes(trimmed))  { setError('This HS Code is already added.'); return; }
    setCodeList(prev => [...prev, trimmed]);
    setInputCode('');
    setError('');
  };

  const handleDelete = (code) => {
    setCodeList(prev => prev.filter(c => c !== code));
  };

  const handleSelect = (code) => {
    if (onSelect) onSelect(code);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: '#eef2f6', border: '1px solid #000000', borderRadius: '4px', width: '450px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ backgroundColor: 'var(--text-muted, #64748b)', padding: '6px 12px', borderBottom: '1px solid #94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>HS / Harmonised Code</span>
          <button onClick={onClose} style={{ background: 'white', border: '1px solid #000000', cursor: 'pointer', padding: '0 6px', fontSize: '12px' }}>✕</button>
        </div>

        <div style={{ padding: '8px' }}>
          {/* Input row */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', color: '#334155', whiteSpace: 'nowrap' }}>Enter HS Code</span>
            <input
              type="text"
              maxLength={10}
              placeholder="e.g. 84713000"
              value={inputCode}
              onChange={e => { setInputCode(e.target.value.replace(/\D/g, '')); setError(''); }}
              onKeyDown={handleKeyDown}
              style={{ flex: 1, padding: '4px 6px', border: '1px solid var(--primary-color-start, #0ea5e9)', fontSize: '12px', borderRadius: '2px' }}
              autoFocus
            />
            <button
              onClick={handleAdd}
              style={{ backgroundColor: 'var(--primary-color-end, var(--primary-color-start, #2563eb))', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}
            >+ Add</button>
          </div>
          {error && <div style={{ color: '#dc2626', fontSize: '11px', marginBottom: '4px', paddingLeft: '4px' }}>{error}</div>}

          {/* Table */}
          <div style={{ border: '1px solid #000000', backgroundColor: 'white', maxHeight: '200px', overflowY: 'auto' }}>
            <div style={{ backgroundColor: '#dbeafe', padding: '4px 8px', borderBottom: '1px solid #94a3b8', fontWeight: 'bold', fontSize: '12px', color: '#1e40af' }}>
              HS Codes Added
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '4px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0', fontWeight: '600', width: '60px' }}>Select</th>
                  <th style={{ padding: '4px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0', fontWeight: '600', width: '60px' }}>Delete</th>
                  <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: '600' }}>HS Code</th>
                </tr>
              </thead>
              <tbody>
                {codeList.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>No codes added yet. Enter a code above and click + Add.</td></tr>
                ) : (
                  codeList.map(code => (
                    <tr key={code} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '4px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                        <button
                          onClick={() => handleSelect(code)}
                          title="Use this HS Code"
                          style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '2px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                        >✓</button>
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                        <button
                          onClick={() => handleDelete(code)}
                          title="Remove"
                          style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                        >✕</button>
                      </td>
                      <td style={{ padding: '4px 8px', fontWeight: '600', letterSpacing: '1px' }}>{code}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
            Click ✓ to use a code in the selected rate line. HS codes are 6–10 digits (e.g. 84713000).
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '8px', borderTop: '1px solid #94a3b8', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--primary-bg-light, #e0f2fe)' }}>
          <button onClick={onClose} style={{ padding: '4px 16px', backgroundColor: '#f8fafc', border: '1px solid #000000', borderRadius: '2px', cursor: 'pointer', fontSize: '12px' }}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default HSCodeModal;


