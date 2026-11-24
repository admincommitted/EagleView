import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PODashboard from './PODashboard';
import AdvancedPO from './AdvancedPO';
import { ShoppingCart, FileText, Search, Filter } from 'lucide-react';
import { getUser } from '../utils/permissions';

// 16-Nov-2026: a PO keeps its branch by name - one entry per name, active branches only (JAIPUR showed twice)
const poBranches = (list) => { const seen = new Set(); return (list || []).filter(b => { const k = String(b.branchName || '').trim().toUpperCase(); if (!k || (b.status || 'Active') === 'Inactive' || seen.has(k)) return false; seen.add(k); return true; }); };

export default function PurchaseOrderMaster() {
  const [activeTab, setActiveTab] = useState('DASHBOARD');

  // Lifted search states for PODashboard
  const [searchTerm, setSearchTerm] = useState('');
  // 16-Nov-2026: a Director (PO approver) opens on the POs waiting for him and does not make POs
  const isDirector = String(getUser().role || '').toLowerCase() === 'director';
  const [statusFilter, setStatusFilter] = useState(isDirector ? 'Pending Approval' : 'All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/masters/company-branches', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data && res.data.success) {
          setBranches(poBranches(res.data.data));
        }
      } catch (err) {
        console.error('Failed to fetch branches');
      }
    };
    fetchBranches();
  }, []);

  const tabStyle = (isActive) => ({
    padding: '16px 24px',
    cursor: 'pointer',
    borderBottom: isActive ? '3px solid #2563eb' : '3px solid transparent',
    color: isActive ? '#2563eb' : '#64748b',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'none',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    fontSize: '14px',
    textTransform: 'uppercase',
    transition: 'all 0.2s'
  });

  return (
    <div style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <ShoppingCart size={28} color="#0f172a" />
        <h2 style={{ margin: 0, color: '#0f172a', fontSize: '24px', fontWeight: 'bold' }}>Purchase Management</h2>
      </div>

      {/* Tabs Header with Search & Filters on the Right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', marginBottom: '20px', background: 'white', padding: '0 20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex' }}>
          <button 
            style={tabStyle(activeTab === 'DASHBOARD')}
            onClick={() => setActiveTab('DASHBOARD')}
          >
            <FileText size={18} />
            PO Dashboard
          </button>
          {!isDirector && <button 
            style={tabStyle(activeTab === 'CREATE')}
            onClick={() => setActiveTab('CREATE')}
          >
            <ShoppingCart size={18} />
            Create New PO
          </button>}
        </div>

        {activeTab === 'DASHBOARD' && (
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', padding: '10px 0' }}>
            <div style={{ position: 'relative', width: '250px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input 
                type="text" 
                placeholder="SEARCH BY PO NUMBER OR VENDOR..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                style={{ width: '100%', padding: '9px 10px 9px 35px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px', color: '#0f172a' }}
              />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} color="#64748b" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>
                <option value="All">ALL STATUSES</option>
                <option value="Draft">DRAFT</option>
                <option value="Pending Approval">PENDING APPROVAL</option>
                <option value="Approved">APPROVED</option>
                <option value="Rejected">REJECTED</option>
                <option value="Hold">HOLD</option>
              </select>
            </div>

            <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={{ padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase' }}>
              <option value="All">ALL BRANCHES</option>
              {branches.map(b => (
                <option key={b.id} value={b.branchName}>{b.branchName}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'DASHBOARD' && (
          <PODashboard 
            externalSearchTerm={searchTerm} 
            externalStatusFilter={statusFilter} 
            externalBranchFilter={branchFilter} 
          />
        )}
        {activeTab === 'CREATE' && !isDirector && <AdvancedPO />}
      </div>
    </div>
  );
}
