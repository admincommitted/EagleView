// Screen section: SEARCH PARTY
// Split out of PartyMasterForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';
import { Search } from 'lucide-react';

export default function SearchPartySection({ ctx }) {
  const { dirList = [], dirBusy, importDir, filteredParties, matchedCount, searchTerm, selectedParty, setSearchTerm, setSelectedParty, setTypeFilter, typeFilter } = ctx;
  const typeOf = (p) => [p.isShipper && 'EXPORTER / IMPORTER', p.isConsignee && 'CONSIGNEE / SUPPLIER', p.isSubAgent && 'SUB AGENT', p.isOverseasAgent && 'OVERSEAS AGENT', p.isShipline && 'SHIPLINE', p.isBank && 'BANK BRO'].filter(Boolean).join(', ');
  return (
    <>
    {/* Left Sidebar for Search & Select (High Density) */}
      <div className="glass-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRight: '1px solid var(--border-color, #e2e8f0)', boxShadow: '1px 0 4px rgba(0,0,0,0.02)', zIndex: 10 }}>
        <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Search size={16} color="#3b82f6" /> SEARCH PARTY
          </h3>
        </div>
        <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="SEARCH NAME, IEC, GST, CITY..." 
            style={{ marginBottom: '8px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select className="input-field" value={typeFilter || ''} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">ALL TYPES</option>
            <option value="EXPORTER">EXPORTER / IMPORTER</option>
            <option value="CONSIGNEE">CONSIGNEE / SUPPLIER</option>
            <option value="SUBAGENT">SUB AGENT</option>
            <option value="OVERSEAS_AGENT">OVERSEAS AGENT</option>
            <option value="SHIPLINE">SHIPLINE</option>
            <option value="BANK">BANK BRO</option>
          </select>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {matchedCount > filteredParties.length ? `Showing ${filteredParties.length} of ${matchedCount.toLocaleString('en-IN')} - type to narrow` : `${matchedCount.toLocaleString('en-IN')} parties`}
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filteredParties.map((p) => {
              const isSelected = selectedParty?.id === p.id;
              return (
                <li 
                  key={p.id} 
                  onClick={() => setSelectedParty(p)}
                  style={{ 
                    padding: '0.5rem 0.75rem', 
                    borderBottom: '1px solid var(--border-color, #cbd5e1)', 
                    fontSize: '11px', 
                    cursor: 'pointer', 
                    background: isSelected ? 'rgba(37,99,235,0.08)' : 'transparent', 
                    fontWeight: isSelected ? 600 : 500,
                    color: isSelected ? 'var(--primary-color)' : 'var(--text-main)',
                    borderLeft: isSelected ? '3px solid var(--primary-color)' : '3px solid transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start'
                  }}
                >
                  {p.name}
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 400 }}>{typeOf(p) || p.type}</div>
                </li>
              );
            })}
          </ul>
          {/* 08-Nov-2026: more parties of the master that are not in the list loaded on open - shown as ordinary rows, click opens */}
          {dirList.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, opacity: dirBusy ? 0.6 : 1 }}>
              {dirList.map((r) => (
                <li key={'d' + r.id} onClick={() => importDir(r)}
                  style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color, #cbd5e1)', fontSize: '11px', cursor: dirBusy ? 'wait' : 'pointer', fontWeight: 500, color: 'var(--text-main)', borderLeft: '3px solid transparent' }}>
                  {r.name}
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 400 }}>
                    {r.partyType === 'CONSIGNEE' ? 'CONSIGNEE / SUPPLIER' : String(r.partyType || '').replace('_', ' ')}{r.city || r.countryCode ? ' - ' + [r.city, r.countryCode].filter(Boolean).join(', ') : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right Content: Party Details */}
    </>
  );
}
