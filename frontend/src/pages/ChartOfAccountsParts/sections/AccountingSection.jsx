// Screen section: Accounting
// Split out of ChartOfAccounts.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Coins, FileText, Folder, Layers, Receipt, Shield, Tags, Target } from 'lucide-react';
import React from 'react';

export default function AccountingSection({ ctx }) {
  const { activeTab, setActiveTab, setSearchQuery, setShowForm } = ctx;
  return (
    <>
    <div style={{ width: '260px', background: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 8px rgba(0,0,0,0.02)', zIndex: 10 }}>
                    <div style={{ padding: '24px 20px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '8px' }}><Layers size={20} color="#3b82f6" /></div>
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#0f172a' }}>Accounting</div>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Core Masters</div>
                        </div>
                    </div>
                    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {[
                            { id: 'groups', label: 'Account Groups', icon: Folder },
                            { id: 'ledgers', label: 'Ledgers', icon: FileText },
                            { id: 'vouchers', label: 'Voucher Types', icon: Receipt },
                            { id: 'categories', label: 'Cost Categories', icon: Tags },
                            { id: 'centres', label: 'Cost Centres', icon: Target },
                            { id: 'currencies', label: 'Currencies', icon: Coins },
                            { id: 'tds', label: 'TDS Natures', icon: Shield },
                        ].map(tab => (
                            <div 
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setShowForm(false); setSearchQuery(''); }}
                                style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: activeTab === tab.id ? '#eff6ff' : 'transparent', borderRadius: '8px', color: activeTab === tab.id ? '#1d4ed8' : '#475569', fontWeight: activeTab === tab.id ? '600' : '500', transition: 'all 0.2s ease' }}
                                onMouseOver={e => { if(activeTab !== tab.id) e.currentTarget.style.background = '#f1f5f9'; }}
                                onMouseOut={e => { if(activeTab !== tab.id) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <tab.icon size={18} color={activeTab === tab.id ? '#3b82f6' : '#64748b'} /> {tab.label}
                            </div>
                        ))}
                    </div>
                </div>
    </>
  );
}
