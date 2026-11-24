// Helpers and constants
// Split out of JobHeaderTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';

export function RichPortSelect({ ports, jobData, setJobData }) {
    const [query, setQuery] = React.useState('');
    const [isOpen, setIsOpen] = React.useState(false);
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
    const wrapperRef = React.useRef(null);
  
    const filteredAll = (() => {
      if (!query) return ports;
      const q = query.toLowerCase();
      const matched = ports.filter(p => p.portCode?.toLowerCase()?.includes(q) || p.portName?.toLowerCase()?.includes(q));
      return matched.sort((a, b) => {
        const ac = a.portCode?.toLowerCase() || ''; const bc = b.portCode?.toLowerCase() || '';
        const an = a.portName?.toLowerCase() || ''; const bn = b.portName?.toLowerCase() || '';
        const score = (c, n) => c === q ? 0 : c.startsWith(q) ? 1 : n.startsWith(q) ? 2 : c.includes(q) ? 3 : 4;
        return score(ac, an) - score(bc, bn);
      });
    })();
    // 22-Nov-2026: only the first 60 matches are drawn - one letter matched thousands of rows and typing hung
    const filtered = filteredAll.length > 60 ? filteredAll.slice(0, 60) : filteredAll;
  
    React.useEffect(() => {
      function handleClickOutside(event) {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
  
    const displayValue = isOpen ? query : ((jobData.portCode || jobData.autoField_2) || '');
  
    const handleSelect = (opt) => {
      setJobData(prev => ({ ...prev, locationName: opt.portName, autoField_1: opt.portName, portCode: opt.portCode, autoField_2: opt.portCode }));
      setIsOpen(false);
    };
  
  return (
      <div ref={wrapperRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, gap: '4px' }}>
        <input 
          type="text" 
          className="input-field mandatory-field" 
          value={displayValue} 
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1)); }
            if (e.key === 'Enter' && highlightedIndex >= 0 && filtered[highlightedIndex]) { e.preventDefault(); handleSelect(filtered[highlightedIndex]); }
          }}
          placeholder="CODE" 
          style={{ width: '70px', color: '#0f172a', border: '1px solid #f87171' }} 
        />
        <input type="text" className="input-field" value={(jobData.locationName || jobData.autoField_1) || ''} readOnly style={{ flex: 1, color: '#0f172a', border: '1px solid #cbd5e1' }} placeholder="LOCATION NAME" />
        
        {isOpen && query.length > 0 && filtered.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, width: 'calc(100% - 74px)', background: 'white', border: '1px solid var(--border-color, #cbd5e1)', borderTop: 'none', zIndex: 50, maxHeight: '350px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            {filtered.map((opt, i) => (
              <div 
                key={i} onClick={() => handleSelect(opt)}
                style={{ padding: '6px 8px', borderBottom: '1px solid var(--bg-input, #f1f5f9)', cursor: 'pointer', background: i === highlightedIndex ? '#e0f2fe' : 'white' }}
                onMouseEnter={() => setHighlightedIndex(i)}
              >
                <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #ec4899)', fontSize: '11px' }}>{opt.portCode}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{opt.portName} ({opt.category})</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
}
