// Helpers and constants
// Split out of EFreightAWBForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React, { useState } from 'react';
import axios from 'axios';

export const PartyAutosuggest = ({ type, onSelect, placeholder }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [show, setShow] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShow(false);
      setFocusedIndex(-1);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/masters/parties/search?q=${query}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const flattened = [];
        (res.data || []).forEach(party => {
          if (party.branches && party.branches.length > 0) {
            party.branches.forEach(branch => {
              flattened.push({ ...party, branches: [branch], uniqueKey: `${party.id}-${branch.id}` });
            });
          } else {
            flattened.push({ ...party, uniqueKey: `${party.id}-none` });
          }
        });
        setResults(flattened);
        setShow(true);
        setFocusedIndex(-1);
      } catch (err) {}
    }, 300);
    return () => clearTimeout(timer);
  }, [query, type]);

  const handleKeyDown = (e) => {
    if (!show || results.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < results.length) {
        setQuery('');
        setShow(false);
        onSelect(results[focusedIndex]);
      }
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input 
        style={{ width: '100%', padding: '6px 12px', border: '1px solid #0284c7', borderRadius: '4px', fontSize: '13px', outline: 'none' }} 
        placeholder={placeholder}
        value={query} 
        onChange={(e) => setQuery(e.target.value)} 
        onFocus={() => { if(results.length > 0) setShow(true); }}
        onBlur={() => setTimeout(() => setShow(false), 200)}
        onKeyDown={handleKeyDown}
      />
      {show && results.length > 0 && (
        <div ref={dropdownRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #0284c7', borderRadius: '4px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', marginTop: '4px' }}
             onMouseDown={(e) => e.preventDefault()}>
          {results.map((p, index) => (
            <div key={p.uniqueKey || p.id} 
                 style={{ 
                   padding: '8px 12px', 
                   borderBottom: '1px solid #e5e7eb', 
                   cursor: 'pointer',
                   backgroundColor: focusedIndex === index ? '#f0f9ff' : 'white'
                 }} 
                 onMouseEnter={() => setFocusedIndex(index)}
                 onClick={() => { setQuery(''); setShow(false); onSelect(p); }}>
              <div style={{ color: '#032145', fontSize: '13px', fontWeight: 'bold', marginBottom: '2px' }}>{p.name}</div>
              <div style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>
                {(() => {
                  const br = p.branches && p.branches.length > 0 ? p.branches[0] : {};
                  const addr = [br.address1, br.address2, br.city, br.state, br.country || p.countryCode].filter(Boolean).join(', ');
                  const pin = br.pinCode || p.zipPostcode || '';
                  const mob = br.mobile || br.phone || p.phoneNumber || '';
                  const email = br.email1 || p.email || '';
                  const gst = br.gstin || p.taxId || '';
                  let res = addr;
                  if (pin) res += ' - ' + pin;
                  if (mob) res += ' | MOB: ' + mob;
                  if (email) res += ' | EMAIL: ' + email;
                  if (gst) res += ' | GST: ' + gst;
                  return res;
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const renderPartyDetails = (party) => {
  if (!party) return null;
  const branch = party.branches && party.branches.length > 0 ? party.branches[0] : {};
  
  const addressStr = [branch.address1, branch.address2, branch.city, branch.state, branch.country || party.countryCode].filter(Boolean).join(', ');
  const pin = branch.pinCode || party.zipPostcode || '';
  const mobile = branch.mobile || branch.phone || party.phoneNumber || '';
  const email = branch.email1 || party.email || '';
  const gst = branch.gstin || party.taxId || '';

  return (
    <>
      <strong>{party.name}</strong><br/>
      <span style={{ color: '#0284c7', textTransform: 'uppercase' }}>
        {addressStr}{pin ? ' - ' + pin : ''}
      </span>
      {(mobile || gst || email) && (
        <div style={{ color: '#4b5563', fontSize: '11px', marginTop: '4px', textTransform: 'uppercase' }}>
          {mobile && <span style={{ marginRight: '12px' }}><strong>MOB:</strong> {mobile}</span>}
          {email && <span style={{ marginRight: '12px' }}><strong>EMAIL:</strong> {email}</span>}
          {gst && <span><strong>GST:</strong> {gst}</span>}
        </div>
      )}
    </>
  );
};

export const CustomDropdown = ({ options, value, onChange, placeholder, style }) => {
  const [query, setQuery] = React.useState(value || '');
  const [show, setShow] = React.useState(false);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);
  const dropdownRef = React.useRef(null);
  const filtered = options.filter(o => o.label.toLowerCase().includes((query||'').toLowerCase()));

  React.useEffect(() => {
    if (value !== query) {
      setQuery(value || '');
    }
  }, [value]);

  React.useEffect(() => {
    setFocusedIndex(-1);
  }, [query]);

  const handleKeyDown = (e) => {
    if (!show || filtered.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => {
        const next = prev < filtered.length - 1 ? prev + 1 : prev;
        scrollIntoView(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => {
        const next = prev > 0 ? prev - 1 : prev;
        scrollIntoView(next);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < filtered.length) {
        const selected = filtered[focusedIndex];
        setQuery(selected.value);
        onChange(selected.value);
        setShow(false);
      }
    } else if (e.key === 'Escape') {
      setShow(false);
    }
  };

  const scrollIntoView = (index) => {
    if (dropdownRef.current && dropdownRef.current.children[index]) {
      const child = dropdownRef.current.children[index];
      const parent = dropdownRef.current;
      if (child.offsetTop < parent.scrollTop) {
        parent.scrollTop = child.offsetTop;
      } else if (child.offsetTop + child.offsetHeight > parent.scrollTop + parent.offsetHeight) {
        parent.scrollTop = child.offsetTop + child.offsetHeight - parent.offsetHeight;
      }
    }
  };

  return (
    <div style={{ position: 'relative', width: style.width || '100%' }}>
      <input 
        value={query}
        onChange={(e) => {
            setQuery(e.target.value);
            setShow(true);
            // We removed onChange(e.target.value) here to prevent massive re-renders on every keystroke!
        }}
        onFocus={() => setShow(true)}
        onBlur={(e) => {
            onChange(e.target.value);
            setTimeout(() => setShow(false), 200);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{ ...style, width: '100%' }}
        autoComplete="off"
      />
      {show && filtered.length > 0 && (
        <div ref={dropdownRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #0284c7', zIndex: 1000, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', marginTop: '4px', borderRadius: '4px' }}>
          {filtered.map((opt, i) => (
            <div 
              key={i} 
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery(opt.value);
                onChange(opt.value);
                setShow(false);
              }}
              style={{ 
                padding: '8px 12px', 
                cursor: 'pointer', 
                borderBottom: '1px solid #f3f4f6', 
                fontSize: '12px', 
                fontWeight: 'normal', 
                color: '#1f2937',
                backgroundColor: focusedIndex === i ? '#f0f9ff' : 'white'
              }}
              onMouseEnter={() => setFocusedIndex(i)}
              onMouseLeave={() => setFocusedIndex(-1)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
