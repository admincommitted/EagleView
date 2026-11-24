import React, { useState, useEffect, useRef } from 'react';

export default function RichAutocomplete({ 
  options, 
  value, 
  onChange, 
  onSelect, 
  renderOption, 
  placeholder,
  searchFilter,
  inputStyle = {}
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  // keyboard use (29-Oct-2026): the list closed only on a mouse click outside, so moving on with Tab left it open over
  // the next boxes; the box looked empty while it had the focus. Now: Tab / Esc / leaving the box closes the list, the
  // value stays visible (selected, so typing replaces it), arrows + Enter pick, Tab keeps an option picked with arrows.
  const [typing, setTyping] = useState(false);
  const [arrowed, setArrowed] = useState(false);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // keep the highlighted option in view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[highlightedIndex];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  // typed text filters the list; before typing all options are shown (up to 50)
  const filtered = typing && query.length > 0 ? options.filter(opt => searchFilter(opt, query)).slice(0, 50) : options.slice(0, 50);

  const displayValue = isOpen && typing ? query : (value || '');

  const close = () => { setIsOpen(false); setTyping(false); setArrowed(false); setHighlightedIndex(-1); };
  const handleSelect = (opt) => {
    setQuery('');
    close();
    onSelect(opt);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: 1, display: 'flex' }}>
      <input 
        type="text" 
        className="input-field" 
        value={displayValue} 
        onChange={(e) => { 
          setQuery(e.target.value); 
          setTyping(true);
          setIsOpen(true);
          setArrowed(false);
          setHighlightedIndex(e.target.value ? 0 : -1);
          onChange && onChange(e.target.value);
        }}
        onFocus={(e) => { setIsOpen(true); setQuery(''); setTyping(false); setArrowed(false); setHighlightedIndex(-1); const t = e.target; setTimeout(() => { try { t.select(); } catch (err) { /* ignore */ } }, 0); }}
        onBlur={() => setTimeout(() => { if (wrapperRef.current && !wrapperRef.current.contains(document.activeElement)) close(); }, 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); if (!isOpen) setIsOpen(true); setArrowed(true); setHighlightedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setArrowed(true); setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1)); }
          else if (e.key === 'Enter') {
            if (isOpen && highlightedIndex >= 0 && filtered[highlightedIndex]) { e.preventDefault(); handleSelect(filtered[highlightedIndex]); }
          }
          else if (e.key === 'Escape') { if (isOpen) { e.preventDefault(); close(); } }
          else if (e.key === 'Tab') {
            // an option chosen with the arrow keys is taken when moving on; typed text is otherwise kept as typed
            if (isOpen && arrowed && highlightedIndex >= 0 && filtered[highlightedIndex]) handleSelect(filtered[highlightedIndex]);
            else close();
          }
        }}
        placeholder={placeholder} 
        style={{ flex: 1, ...inputStyle }} 
      />
      
      {isOpen && filtered.length > 0 && (
        <div ref={listRef} style={{ position: 'absolute', top: '100%', left: 0, width: '100%', minWidth: '180px', background: 'var(--bg-panel, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', borderTop: 'none', zIndex: 50, maxHeight: '250px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          {filtered.map((opt, i) => (
            <div 
              key={i} 
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(opt)}
              style={{ padding: '6px 8px', borderBottom: '1px solid var(--bg-input, #f1f5f9)', cursor: 'pointer', background: i === highlightedIndex ? 'var(--primary-bg-light, #e0f2fe)' : 'transparent' }}
              onMouseEnter={() => setHighlightedIndex(i)}
            >
              {renderOption(opt)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
