import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlaneTakeoff, FileText, FileBadge, PackageSearch, Package, LayoutDashboard, BookmarkPlus, Navigation } from 'lucide-react';

export default function EFreightDashboard() {
  const navigate = useNavigate();

  const headerCardStyle = {
    background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
    padding: '8px 12px',
    borderRadius: '8px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    cursor: 'pointer',
    border: '1px solid #cbd5e1',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    minWidth: '130px'
  };

  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Header / Action Bar - Single Row */}
      <div style={{ background: 'white', padding: '12px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
        
        {/* Title Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ background: '#e0f2fe', padding: '8px', borderRadius: '8px', color: '#0284c7' }}>
            <Package size={22} />
          </div>
          <div>
            <h2 style={{ color: '#0f172a', margin: 0, fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              E-Freight Workspace
            </h2>
            <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Manage Electronic Waybills</div>
          </div>
        </div>

        {/* Action Cards (In same row) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
          
          <div 
            style={headerCardStyle}
            onClick={() => navigate('/e-freight')}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(59, 130, 246, 0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'; }}
          >
            <div style={{ color: '#3b82f6' }}><LayoutDashboard size={18} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#1e293b' }}>Dashboard</span>
              <span style={{ fontSize: '10px', color: '#64748b' }}>Overview</span>
            </div>
          </div>

          <div 
            style={headerCardStyle}
            onClick={() => navigate('/e-freight/create-awb')}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0284c7'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(2, 132, 199, 0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'; }}
          >
            <div style={{ color: '#0284c7' }}><PlaneTakeoff size={18} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#1e293b' }}>E-AWB</span>
              <span style={{ fontSize: '10px', color: '#64748b' }}>Air Waybill</span>
            </div>
          </div>

          <div 
            style={headerCardStyle}
            onClick={() => navigate('/freight/create-mawb')}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(139, 92, 246, 0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'; }}
          >
            <div style={{ color: '#8b5cf6' }}><FileBadge size={18} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#1e293b' }}>MAWB</span>
              <span style={{ fontSize: '10px', color: '#64748b' }}>Master AWB</span>
            </div>
          </div>

          <div 
            style={headerCardStyle}
            onClick={() => navigate('/freight/create-hawb')}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(16, 185, 129, 0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'; }}
          >
            <div style={{ color: '#10b981' }}><FileText size={18} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#1e293b' }}>HAWB</span>
              <span style={{ fontSize: '10px', color: '#64748b' }}>House AWB</span>
            </div>
          </div>

          <div 
            style={headerCardStyle}
            onClick={() => alert('Booking module coming soon!')}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(245, 158, 11, 0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'; }}
          >
            <div style={{ color: '#f59e0b' }}><BookmarkPlus size={18} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#1e293b' }}>Booking</span>
              <span style={{ fontSize: '10px', color: '#64748b' }}>Flight Booking</span>
            </div>
          </div>

          <div 
            style={headerCardStyle}
            onClick={() => navigate('/freight/track-shipments')}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(239, 68, 68, 0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'; }}
          >
            <div style={{ color: '#ef4444' }}><Navigation size={18} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#1e293b' }}>Track</span>
              <span style={{ fontSize: '10px', color: '#64748b' }}>Live Tracking</span>
            </div>
          </div>
          
        </div>
      </div>

      {/* Main Content Area (For future tables, lists, etc) */}
      <div style={{ padding: '24px', flex: 1 }}>
        <div style={{ background: 'white', border: '1px dashed #cbd5e1', borderRadius: '8px', height: '100%', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
          <div style={{ textAlign: 'center' }}>
            <PackageSearch size={48} style={{ margin: '0 auto 16px auto', color: '#cbd5e1' }} />
            <p>E-Freight Dashboard Content / Tables will appear here.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
