import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim()) {
      // backend route is /api/search/global-search → { parties, awbs } or an array of remark hits
      fetch('/api/search/global-search?q=' + encodeURIComponent(query))
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) { setResults(data); return; }
          const parties = (data && data.parties) || [];
          const awbs = (data && data.awbs) || [];
          setResults([
            ...awbs.map(a => ({ title: a.no, description: a.type, link: a.type === 'HAWB' ? '/freight/create-hawb' : '/freight/search-awb' })),
            ...parties.map(p => ({ title: p.name, description: 'Party' + (p.type ? ' • ' + p.type : ''), link: '/mdm' })),
          ]);
        })
        .catch(err => {
          console.error(err);
          setResults([]);
        });
    } else {
      setResults([]);
    }
  }, [query]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', paddingTop: '10vh' }}>
      <div style={{ background: '#fff', width: '600px', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
          <Search size={20} color="#64748b" style={{ marginRight: '12px' }} />
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Search jobs, items, parties... (Global)" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '16px', color: '#1e293b', background: 'transparent' }}
          />
          <X size={20} color="#94a3b8" style={{ cursor: 'pointer', marginLeft: '12px' }} onClick={() => setIsOpen(false)} />
        </div>
        
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          {results.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {results.map((res, i) => (
                <div 
                  key={i} 
                  onClick={() => {
                    setIsOpen(false);
                    if (res.link) {
                      navigate(res.link);
                    } else {
                      alert("Navigating to: " + (res.title || res.jobNo));
                    }
                  }}
                  style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>{res.title || res.jobNo}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{res.description || res.status}</div>
                </div>
              ))}
            </div>
          ) : query.trim() ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0' }}>No results found</div>
          ) : (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0' }}>Type something to search...</div>
          )}
        </div>
        
        <div style={{ padding: '8px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', fontSize: '11px', color: '#94a3b8', textAlign: 'right' }}>
          Press Esc to close
        </div>
      </div>
    </div>
  );
}
