// Screen section: Database Field Selector
// Split out of DSRTemplateMaster.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Database, Search, X } from 'lucide-react';
import React from 'react';
import { DB_FIELDS } from '../DB_FIELDS';

export default function DatabaseFieldSelectorSection({ ctx }) {
  const { handleToggleField, isModalOpen, searchQuery, selectedFieldIds, setIsModalOpen, setSearchQuery } = ctx;
  return (
    <>
    {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '900px', height: '80vh', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Database size={24} color="#3b82f6" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Database Field Selector</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Select the fields you want to import into your DSR.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
               <div style={{ position: 'relative' }}>
                 <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                 <input 
                   type="text" 
                   placeholder="Search 350+ fields (e.g. 'jobNo', 'port', 'invoice')..." 
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                 />
               </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem', background: '#f8fafc' }}>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                 {DB_FIELDS.filter(f => f.title !== '[ CREATE NEW CUSTOM FIELD ]').filter(f => f.title.toLowerCase().includes(searchQuery.toLowerCase()) || f.subtitle.toLowerCase().includes(searchQuery.toLowerCase())).map(f => {
                    const isSelected = selectedFieldIds.includes(f.title);
                    return (
                      <label 
                        key={f.title} 
                        style={{ 
                          display: 'flex', 
                          gap: '12px', 
                          alignItems: 'center', 
                          padding: '10px 12px', 
                          background: isSelected ? '#eff6ff' : 'white', 
                          border: isSelected ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                      >
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => handleToggleField(f.title, f.title)} 
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 500, color: isSelected ? '#1d4ed8' : '#334155', wordBreak: 'break-all' }}>{f.title}</span>
                          <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>{f.subtitle}</span>
                        </div>
                      </label>
                    );
                 })}
               </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span style={{ fontSize: '13px', fontWeight: 600, color: '#3b82f6' }}>{selectedFieldIds.filter(id => !id.startsWith('custom_')).length} Database Fields Selected</span>
               <button onClick={() => setIsModalOpen(false)} className="btn btn-primary" style={{ padding: '8px 24px', fontWeight: 600 }}>
                 Done
               </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
