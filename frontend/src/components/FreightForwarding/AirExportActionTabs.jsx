import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';

export default function AirExportActionTabs({ activeTab }) {
  const [showMegaMenu, setShowMegaMenu] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMegaMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getStyle = (tabId) => ({
    background: activeTab === tabId ? '#3b82f6' : 'white',
    color: activeTab === tabId ? 'white' : 'var(--text-main, #334155)',
    padding: '0 16px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px 6px 0 0',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
    border: '1px solid',
    borderColor: activeTab === tabId ? '#3b82f6' : 'var(--primary-bg-light, #e0f2fe)',
    borderBottom: activeTab === tabId ? '1px solid #3b82f6' : '1px solid transparent',
    marginRight: '4px',
    marginBottom: '-1px', // Pull down to cover the bottom border of the parent
    transition: 'all 0.2s ease'
  });

  return (
    <div ref={menuRef} style={{ display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid var(--border-color, #e2e8f0)', marginBottom: '0px', position: 'relative' }}>
      <div style={{ display: 'flex' }}>
        
        {/* Hamburger Icon */}
        <div 
          onClick={() => setShowMegaMenu(!showMegaMenu)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '36px', background: 'white', color: 'var(--text-main, #334155)', border: '1px solid var(--border-color, #e2e8f0)', borderBottom: '1px solid transparent', borderRadius: '6px 6px 0 0', cursor: 'pointer', marginRight: '4px', marginBottom: '-1px', transition: 'all 0.2s ease' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-bg-light, #e0f2fe)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-app, var(--bg-app, #f8fafc))'}
        >
          <Menu size={20} />
        </div>

        {/* Action Tabs */}
        <div style={getStyle('dashboard')} onClick={() => navigate('/freight/air-export')}>DASHBOARD</div>
        <div style={getStyle('create')} onClick={() => navigate('/freight/create-awb')}>CREATE AWB</div>
        <div style={getStyle('search')} onClick={() => navigate('/freight/search-awb')}>SEARCH</div>
        <div style={getStyle('track')} onClick={() => navigate('/freight/track-shipments')}>TRACK SHIPMENTS</div>
      </div>

      {/* Mega Menu */}
      {showMegaMenu && (
        <div style={{ position: 'absolute', top: '100%', left: '0', marginTop: '2px', background: 'white', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', display: 'flex', width: '800px', padding: '24px', gap: '32px', zIndex: 1000, borderRadius: '8px' }}>
          
          <div style={{ flex: 1 }}>
            <h4 style={{ color: '#3b82f6', margin: '0 0 12px 0', borderBottom: '2px solid #3b82f6', paddingBottom: '6px', fontSize: '14px', textTransform: 'uppercase' }}>Create</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', color: 'var(--text-main, #334155)', lineHeight: '2.5' }}>
              <li onClick={() => { setShowMegaMenu(false); navigate('/freight/create-awb'); }} style={{ cursor: 'pointer' }} onMouseEnter={(e)=>e.target.style.color='#3b82f6'} onMouseLeave={(e)=>e.target.style.color='var(--text-main, #334155)'}>Air Waybill</li>
              <li onClick={() => { setShowMegaMenu(false); navigate('/freight/create-hawb'); }} style={{ cursor: 'pointer' }} onMouseEnter={(e)=>e.target.style.color='#3b82f6'} onMouseLeave={(e)=>e.target.style.color='var(--text-main, #334155)'}>House Waybill</li>
              <li onClick={() => { setShowMegaMenu(false); navigate('/freight/create-mawb'); }} style={{ cursor: 'pointer' }} onMouseEnter={(e)=>e.target.style.color='#3b82f6'} onMouseLeave={(e)=>e.target.style.color='var(--text-main, #334155)'}>Master Air Waybill</li>
              <li style={{ cursor: 'pointer' }} onMouseEnter={(e)=>e.target.style.color='#3b82f6'} onMouseLeave={(e)=>e.target.style.color='var(--text-main, #334155)'} onClick={() => { setShowMegaMenu(false); navigate('/freight/ecsd'); }}>e-CSD</li>
            </ul>
          </div>
          
          <div style={{ flex: 1 }}>
            <h4 style={{ color: '#3b82f6', margin: '0 0 12px 0', borderBottom: '2px solid #3b82f6', paddingBottom: '6px', fontSize: '14px', textTransform: 'uppercase' }}>Manage</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', color: 'var(--text-main, #334155)', lineHeight: '2.5' }}>
              <li onClick={() => { setShowMegaMenu(false); navigate('/freight/track-shipments'); }} style={{ cursor: 'pointer' }} onMouseEnter={(e)=>e.target.style.color='#3b82f6'} onMouseLeave={(e)=>e.target.style.color='var(--text-main, #334155)'}>Track Shipments</li>
              <li style={{ cursor: 'pointer' }} onMouseEnter={(e)=>e.target.style.color='#3b82f6'} onMouseLeave={(e)=>e.target.style.color='var(--text-main, #334155)'}>Print</li>
              <li style={{ cursor: 'pointer' }} onMouseEnter={(e)=>e.target.style.color='#3b82f6'} onMouseLeave={(e)=>e.target.style.color='var(--text-main, #334155)'}>Search</li>
              <li style={{ cursor: 'pointer' }} onMouseEnter={(e)=>e.target.style.color='#3b82f6'} onMouseLeave={(e)=>e.target.style.color='var(--text-main, #334155)'}>Stock</li>
            </ul>
          </div>

          <div style={{ flex: 1 }}>
            <h4 style={{ color: '#3b82f6', margin: '0 0 12px 0', borderBottom: '2px solid #3b82f6', paddingBottom: '6px', fontSize: '14px', textTransform: 'uppercase' }}>Data</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', color: 'var(--text-main, #334155)', lineHeight: '2.5' }}>
              <li style={{ cursor: 'pointer' }} onMouseEnter={(e)=>e.target.style.color='#3b82f6'} onMouseLeave={(e)=>e.target.style.color='var(--text-main, #334155)'} onClick={() => { setShowMegaMenu(false); navigate('/reports/export-data'); }}>Export Data</li>
            </ul>
          </div>
          
          <div style={{ flex: 1 }}>
            <h4 style={{ color: '#3b82f6', margin: '0 0 12px 0', borderBottom: '2px solid #3b82f6', paddingBottom: '6px', fontSize: '14px', textTransform: 'uppercase' }}>Report</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', color: 'var(--text-main, #334155)', lineHeight: '2.5' }}>
              <li style={{ cursor: 'pointer' }} onMouseEnter={(e)=>e.target.style.color='#3b82f6'} onMouseLeave={(e)=>e.target.style.color='var(--text-main, #334155)'} onClick={() => { setShowMegaMenu(false); navigate('/reports/forwarder-transactions'); }}>Forwarder Transactions Report</li>
              <li style={{ cursor: 'pointer' }} onMouseEnter={(e)=>e.target.style.color='#3b82f6'} onMouseLeave={(e)=>e.target.style.color='var(--text-main, #334155)'} onClick={() => { setShowMegaMenu(false); navigate('/freight/tonnage-report'); }}>Tonnage Report</li>
              <li style={{ cursor: 'pointer' }} onMouseEnter={(e)=>e.target.style.color='#3b82f6'} onMouseLeave={(e)=>e.target.style.color='var(--text-main, #334155)'} onClick={() => { setShowMegaMenu(false); navigate('/freight/csr-statement'); }}>CSR Statement (CASS)</li>
            </ul>
          </div>
          
        </div>
      )}
    </div>
  );
}
