import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Cache: fetchUrl → mapped data (shared across all instances)
export const dataCache = {};

const BADGE_COLORS = [
  { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  { bg: '#fef3c7', color: '#b45309', border: '#fcd34d' },
  { bg: '#fce7f3', color: '#be185d', border: '#f9a8d4' },
  { bg: '#ede9fe', color: '#6d28d9', border: '#c4b5fd' },
  { bg: '#cffafe', color: '#0e7490', border: '#67e8f9' },
  { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
];

export default function CustomAutocomplete({
  defaultValue,
  value,
  enforceSelection,
  onChange,
  onSelect,
  fetchUrl,
  staticData,
  mapData,
  placeholder,
  className,
  style,
  maxLength,
  name
}) {
  const [inputValue, setInputValue] = useState(value !== undefined ? (value || '') : (defaultValue || ''));
  const [options, setOptions]       = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef    = useRef(null);
  const cacheRef   = useRef(null);

  // Keep input in sync with controlled value
  useEffect(() => {
    if (value !== undefined) setInputValue(value || '');
  }, [value]);

  // Pre-fetch & cache data as soon as fetchUrl is known
  useEffect(() => {
    if (staticData) {
      cacheRef.current = staticData;
      return;
    }
    if (!fetchUrl) return;
    if (dataCache[fetchUrl]) {
      cacheRef.current = dataCache[fetchUrl];
      return;
    }
    fetch(fetchUrl)
      .then(r => r.json())
      .then(raw => {
        const arr = Array.isArray(raw) ? raw : (raw.data || []);
        const mapped = mapData(arr);
        dataCache[fetchUrl] = mapped;
        cacheRef.current = mapped;
        
        setInputValue(prevVal => {
            if (prevVal && prevVal.length > 0) {
                const val = prevVal.toUpperCase();
                const filtered = mapped.filter(o =>
                  (o.title    && o.title.toUpperCase().startsWith(val)) ||
                  (o.searchKey && o.searchKey.toUpperCase().startsWith(val)) ||
                  (o.title    && o.title.toUpperCase().includes(val)) ||
                  (o.subtitle && o.subtitle.toUpperCase().includes(val)) ||
                  (o.searchKey && o.searchKey.toUpperCase().includes(val))
                );
                filtered.sort((a, b) => {
                  const scoreA = a.title?.toUpperCase().startsWith(val) ? 0 : a.searchKey?.toUpperCase().startsWith(val) ? 1 : 2;
                  const scoreB = b.title?.toUpperCase().startsWith(val) ? 0 : b.searchKey?.toUpperCase().startsWith(val) ? 1 : 2;
                  return scoreA - scoreB;
                });
                setOptions(filtered.slice(0, 30));
                  const isFocused = wrapperRef.current && wrapperRef.current.querySelector('input') === document.activeElement;
                  if (isFocused) {
                      setShowDropdown(filtered.length > 0);
                  }
              }
            return prevVal;
        });
      })
      .catch(err => console.error('CustomAutocomplete prefetch error:', err));
  }, [fetchUrl, staticData]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      const outside =
        (!wrapperRef.current || !wrapperRef.current.contains(e.target)) &&
        (!listRef.current    || !listRef.current.contains(e.target));
      if (outside) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reposition dropdown
  useLayoutEffect(() => {
    const updatePosition = () => {
      if (showDropdown && listRef.current && wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        const el   = listRef.current;
        el.style.position = 'fixed';
        el.style.top      = (rect.bottom + 2) + 'px';
        el.style.left     = rect.left + 'px';
        el.style.width    = Math.max(rect.width, 360) + 'px'; // one line per choice needs the room (22-Nov-2026)
        el.style.zIndex   = '99';
      }
    };
    updatePosition();
    if (showDropdown) {
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [showDropdown, options]);

  // Scroll focused item into view
  useEffect(() => {
    if (showDropdown && listRef.current && focusedIndex >= 0) {
      const el = listRef.current.children[focusedIndex]; // no header row now (22-Nov-2026)
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, showDropdown]);

  const handleFocus = (e) => {
    const raw = e.target.value !== undefined ? String(e.target.value) : '';
    const val = raw.toUpperCase();
    const pool = staticData || cacheRef.current || [];
    if (val.length === 0) {
      if (pool.length > 0) {
        setOptions(pool.slice(0, 50));
        setShowDropdown(true);
        setFocusedIndex(-1);
      }
    } else {
      const filtered = pool.filter(o =>
        (o.title    && o.title.toUpperCase().startsWith(val)) ||
        (o.searchKey && o.searchKey.toUpperCase().startsWith(val)) ||
        (o.title    && o.title.toUpperCase().includes(val)) ||
        (o.subtitle && o.subtitle.toUpperCase().includes(val)) ||
        (o.searchKey && o.searchKey.toUpperCase().includes(val))
      );
      filtered.sort((a, b) => {
        const scoreA = a.title?.toUpperCase().startsWith(val) ? 0 : a.searchKey?.toUpperCase().startsWith(val) ? 1 : 2;
        const scoreB = b.title?.toUpperCase().startsWith(val) ? 0 : b.searchKey?.toUpperCase().startsWith(val) ? 1 : 2;
        return scoreA - scoreB;
      });
      if (filtered.length > 0) {
        setOptions(filtered.slice(0, 30));
        setShowDropdown(true);
        setFocusedIndex(-1);
      }
    }
  };

  const handleInputChange = (e) => {
    const raw = e.target.value !== undefined ? String(e.target.value) : '';
    const val = raw.toUpperCase();
    if (maxLength && val.length > maxLength) return;
    setInputValue(val);
    onChange && onChange({ target: { value: val, name } });

    if (val.length >= 0) {
      const pool = staticData || cacheRef.current || [];
      if (val.length === 0 && staticData) {
         setOptions(staticData.slice(0, 50));
         setShowDropdown(true);
         setFocusedIndex(-1);
         return;
      }
      if (val.length === 0) {
         setOptions([]);
         setShowDropdown(false);
         return;
      }
      const filtered = pool.filter(o =>
        (o.title    && o.title.toUpperCase().startsWith(val)) ||
        (o.searchKey && o.searchKey.toUpperCase().startsWith(val)) ||
        (o.title    && o.title.toUpperCase().includes(val)) ||
        (o.subtitle && o.subtitle.toUpperCase().includes(val)) ||
        (o.searchKey && o.searchKey.toUpperCase().includes(val))
      );
      filtered.sort((a, b) => {
        const scoreA = a.title?.toUpperCase().startsWith(val) ? 0 : a.searchKey?.toUpperCase().startsWith(val) ? 1 : 2;
        const scoreB = b.title?.toUpperCase().startsWith(val) ? 0 : b.searchKey?.toUpperCase().startsWith(val) ? 1 : 2;
        return scoreA - scoreB;
      });
      setOptions(filtered.slice(0, 30));
      setShowDropdown(filtered.length > 0);
      setFocusedIndex(-1);
    } else {
      setOptions([]);
      setShowDropdown(false);
    }
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || options.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0) {
        handleSelect(options[focusedIndex]);
      } else if (options.length > 0) {
        handleSelect(options[0]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleSelect = (opt) => {
    setInputValue(opt.title);
    onChange && onChange({ target: { value: opt.title, name } });
    onSelect  && onSelect(opt);
    setShowDropdown(false);
    setOptions([]);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (enforceSelection && inputValue && inputValue.length > 0) {
        const pool = staticData || cacheRef.current || [];
        const exactMatch = pool.find(o => o.title && o.title.toUpperCase() === inputValue.toUpperCase());
        if (!exactMatch) {
          if (options && options.length > 0) {
            handleSelect(options[0]);
          } else {
            setInputValue('');
            if (onChange) onChange({ target: { value: '', name } });
          }
        }
      }
      setShowDropdown(false);
    }, 150);
  };

  // 22-Nov-2026: plain list - one line per choice (code in bold, its name beside it), thin border, no "results"
  // band and no coloured chips. The same choices, keys and pick handling as before.
  const dropdown = showDropdown && options.length > 0 ? (
    <div
      ref={listRef}
      className="ca-list"
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: 300,
        zIndex: 99,
        backgroundColor: 'var(--bg-panel, #ffffff)',
        border: '1px solid var(--lg-box-line, #94a3b8)',
        borderRadius: '2px',
        boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
        maxHeight: '240px',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {options.map((opt, idx) => {
        const isActive = focusedIndex === idx;
        return (
          <div
            key={idx}
            title={opt.subtitle ? opt.title + ' - ' + opt.subtitle : opt.title}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
              padding: '3px 8px',
              cursor: 'pointer',
              fontSize: '12px',
              lineHeight: 1.45,
              whiteSpace: 'nowrap',
              color: isActive ? '#ffffff' : 'var(--text-main, #0f172a)',
              backgroundColor: isActive ? 'var(--theme-base, #0369a1)' : 'transparent',
            }}
            onMouseDown={() => handleSelect(opt)}
            onMouseEnter={() => setFocusedIndex(idx)}
            onMouseLeave={() => setFocusedIndex(-1)}
          >
            <span style={{ fontWeight: 700, flexShrink: 0 }}>{opt.title}</span>
            {opt.subtitle && (
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', color: isActive ? '#ffffff' : 'var(--text-muted, #475569)' }}>{opt.subtitle}</span>
            )}
            {opt.countryCode && (
              <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '11px', color: isActive ? '#ffffff' : 'var(--text-muted, #64748b)' }}>{opt.countryCode}</span>
            )}
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', flex: 1 }}>
      <input
        type="text"
        name={name}
        autoComplete="off"
        className={className}
        style={{ ...style, width: '100%' }}
        placeholder={placeholder}
        maxLength={maxLength}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onClick={handleFocus}
        onBlur={handleBlur}
      />
      {dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}
