import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { usePermissions, canOpen } from '../utils/permissions';
import AccountsMegaMenu from './AccountsMegaMenu';

// 30-Oct-2026: a menu entry is hidden when the user has no View right for its module (Master > User Management)
const Item = (props) => (canOpen(props.to) ? <NavLink {...props} /> : null);
import { LayoutDashboard, FileText, Database, Settings, FileSearch, Truck, Briefcase, TrendingUp, Users, User, Navigation, CheckCircle, Grid, ShoppingCart, Package } from 'lucide-react';

export default function Navbar() {
  usePermissions(); // re-render when rights change
  const [showMaster, setShowMaster] = useState(false);
  const masterRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (masterRef.current && !masterRef.current.contains(event.target)) {
        setShowMaster(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="navbar">
      <Item to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <LayoutDashboard size={18} /><span>Dashboard</span>
      </Item>
      <Item to="/sales" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <TrendingUp size={18} /><span>Sales</span>
      </Item>
        {/* Other Modules Dropdown */}
        <div className="dropdown">
          <div className="nav-item" style={{ cursor: 'pointer' }}>
            <Grid size={18} /><span>Other Modules</span>
          </div>
          <div className="dropdown-menu" style={{ minWidth: '200px', padding: '0.5rem' }}>
            <div style={{ padding: '0.5rem 0.75rem 0.2rem', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admin</div>
              <Item to="/admin-dashboard" className="dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.4rem 0.75rem', color: '#0284c7', fontWeight: 'bold' }}><LayoutDashboard size={16} /> Admin Dashboard</Item>
            <Item to="/vendor-master" className="dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.4rem 0.75rem' }}><Users size={16} /> Vendor Master</Item>
            <Item to="/purchase-management" className="dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.4rem 0.75rem' }}><ShoppingCart size={16} /> Purchase Management</Item>
            <Item to="/asset-management" className="dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.4rem 0.75rem' }}><Package size={16} /> Asset & Stock (GRN)</Item>
            <div style={{ padding: '0.5rem 0.75rem 0.2rem', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transport</div>
            <Item to="/fleet-management" className="dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.4rem 0.75rem' }}><Truck size={16} /> Fleet / TMS Management</Item>
            <Item to="/field-tracking" className="dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.4rem 0.75rem' }}><Navigation size={16} /> Live Field Boy Tracking</Item>
          </div>
        </div>

      {/* Customs Clearance Dropdown */}
      <div className="dropdown">
        <div className="nav-item" style={{ cursor: 'pointer' }}>
          <FileText size={18} /><span>Customs</span>
        </div>
        <div className="dropdown-menu" style={{ minWidth: '220px', padding: '0.5rem' }}>
          <div style={{ padding: '0.2rem 0.75rem', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Job Entry</div>
          <Item to="/job-entry" className="dropdown-item" style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>Import</Item>
          <Item to="/export-entry" className="dropdown-item" style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>Export</Item>
          <Item to="/submit-sb-job" className="dropdown-item" style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>Submit SB Job</Item>
          <Item to="/be-amendments" className="dropdown-item" style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>BE Amendments</Item>
          <hr style={{ margin: '0.25rem 0', borderColor: 'var(--primary-bg-light, #e0f2fe)' }} />
          <div style={{ padding: '0.2rem 0.75rem', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Operations</div>
          <Item to="/freight/job-expense" className="dropdown-item" style={{ padding: '0.5rem 0.75rem', fontWeight: 'bold', color: '#dc2626' }}>💸 Request Job Payment</Item>
        </div>
      </div>

      {/* Freight Forwarding Dropdown */}
      <div className="dropdown">
        <div className="nav-item" style={{ cursor: 'pointer' }}>
          <Truck size={18} /><span>Freight</span>
        </div>
        <div className="dropdown-menu" style={{ minWidth: '220px', padding: '0.5rem' }}>
          <div style={{ padding: '0.5rem 0.75rem 0.2rem', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shipment Registration</div>
          <Item to="/freight/shipment/ai" className="dropdown-item" style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Import Air</Item>
          <Item to="/freight/shipment/si" className="dropdown-item" style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Import Sea</Item>
          <Item to="/freight/shipment/ae" className="dropdown-item" style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Export Air</Item>
          <Item to="/freight/shipment/se" className="dropdown-item" style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Export Sea</Item>
          {/* 22-Nov-2026: the four Dashboards links are taken off this menu (user's wish); the screens are still reached from the Dashboard tab inside the freight screens */}
          <hr style={{ margin: '0.25rem 0', borderColor: 'var(--primary-bg-light, #e0f2fe)' }} />
          <div style={{ padding: '0.2rem 0.75rem', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Create AWB</div>
          <Item to="/freight/create-awb" className="dropdown-item" style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>✈️ e-AWB (Air Waybill)</Item>
          <Item to="/freight/create-mawb" className="dropdown-item" style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>📋 MAWB (Master AWB)</Item>
            <Item to="/freight/create-hawb" className="dropdown-item" style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>🏠 HAWB (House AWB)</Item>
          {/* 22-Nov-2026: Tools & Operations (Request Job Payment, Search AWB, Track Shipments, e-CSD) also taken off this menu (user's wish); the screens remain */}
        </div>
      </div>

      {/* Accounts: one wide panel with search, quick-create and every accounts screen (04-Nov-2026) */}
      <AccountsMegaMenu />

      {/* Master Directory Dropdown */}
      <div className="dropdown" ref={masterRef} onMouseEnter={() => setShowMaster(true)} onMouseLeave={() => setShowMaster(false)}>
        <div className="nav-item" style={{ cursor: 'pointer' }} onClick={() => setShowMaster(!showMaster)}>
          <Database size={18} /><span>Masters</span>
        </div>

        <div className="dropdown-menu" style={{ minWidth: '600px', padding: '1rem', display: showMaster ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start', maxHeight: 'calc(100vh - 110px)', overflowY: 'auto' }} onClick={() => setShowMaster(false)}>

          {/* 28-Oct-2026: two independent columns (left: Core + Logistics, right: Customs + System), so a short group
              no longer leaves a big empty gap next to a long one (the old 2x2 grid made both rows as tall as the longest group) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
          {/* Core Masters */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ padding: '0.4rem 0.75rem', fontWeight: 800, color: 'var(--primary-text, #1e3a8a)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
              Core Masters
            </div>
            <div style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <Item to="/master/party" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Unified Party Master</Item>
              <Item to="/master/contract-master" className="dropdown-item" style={{ padding: '0.4rem 0.75rem', fontWeight: 'bold', color: '#10b981' }}>Contract & Quotation Master</Item>
              <Item to="/master/users" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>User Management</Item>
              <Item to="/master/country" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Country Master</Item>
              <Item to="/master/port" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Unified Port & CHA Master</Item>
              <Item to="/master/currency" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Currency & Exchange Rates</Item>
            </div>
          </div>

          {/* Logistics & Operations */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ padding: '0.4rem 0.75rem', fontWeight: 800, color: 'var(--primary-text, #1e3a8a)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
              Logistics & Operations
            </div>
            <div style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <Item to="/master/transporter" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Transporter Master</Item>
              <Item to="/master/vessel" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Vessel / Flight Master</Item>
              {/* 08-Nov-2026: iCAFFE Party Directory hidden - all its parties are in the Party Master (the IcaffeParties table is kept) */}
              <Item to="/master/shipping-line" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Shipping Line Master (Sea)</Item>
              <Item to="/master/airline" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Airline Master</Item>
              <Item to="/master/airway-bill-stock" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>AirWayBill Stock</Item>
              <Item to="/master/awbcharges" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Airway Bill Charges Master</Item>
              <Item to="/master/sph-master" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>SPH Codes Master</Item>
              <Item to="/master/status-master" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Status Master</Item>
              <Item to="/master/penalty-rules" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Penalty & Demurrage Rules</Item>
              <Item to="/master/iata-agent" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>IATA Agent Master</Item>
              <Item to="/master/warehouse" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Warehouse Master</Item>
            </div>
          </div>

          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
          {/* Customs & Compliance */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ padding: '0.4rem 0.75rem', fontWeight: 800, color: 'var(--primary-text, #1e3a8a)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
              Customs & Compliance
            </div>
            <div style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <Item to="/master/uqc" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>UQC (Unit of Measurement)</Item>
              <Item to="/master/hsn-ritc" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Unified HSN / Tariff Master</Item>
              <Item to="/master/bond" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>BE Bond Code Master (Import)</Item>
              <Item to="/master/license" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Importer License Master (Import)</Item>
              <Item to="/master/rsp" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>RSP & Abatement Master (Import)</Item>
              <Item to="/master/duty-lists" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Customs Duty Lists (ADD / CVD / Cess / Tariff Value)</Item>
              <Item to="/master/duty" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Exemption Notifications (Import)</Item>
              <Item to="/master/drawback" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Drawback Schedule (Export)</Item>
              <Item to="/master/rodtep" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>RoDTEP Schedule (Export)</Item>
              <Item to="/master/rosctl" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>RoSCTL Schedule (Export)</Item>
              <Item to="/master/export-policy" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Export Tariff & Policy</Item>
              <Item to="/master/schemecodes" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>Export Scheme Codes</Item>
              <Item to="/master/tact-compliance" className="dropdown-item" style={{ padding: '0.4rem 0.75rem', fontWeight: 'bold', color: '#10b981' }}>IATA TACT & Compliance</Item>
            </div>
          </div>

          {/* System Configurations */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ padding: '0.4rem 0.75rem', fontWeight: 800, color: 'var(--primary-text, #1e3a8a)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
              System Configurations
            </div>
            <div style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <Item to="/master/dsr-template" className="dropdown-item" style={{ padding: '0.4rem 0.75rem', fontWeight: 'bold', color: '#10b981' }}>DSR Template Settings</Item>
              <Item to="/master/item-template" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>JSON Item Templates</Item>
              <Item to="/master/icegate" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>ICEGATE Credentials</Item>
              <Item to="/master/esanchit" className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }}>e-Sanchit Document Codes</Item>
              
            </div>
          </div>

          </div>

        </div>
      </div>

      <Item to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <FileSearch size={18} /><span>Reports</span>
      </Item>

      <Item to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Settings size={18} /><span>Settings</span>
      </Item>
    </nav>
  );
}


