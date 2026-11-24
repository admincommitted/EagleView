// Screen section: Manage your accounting masters and hierarchies.
// Split out of ChartOfAccounts.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Plus, Search } from 'lucide-react';
import React from 'react';

export default function ManageYourAccountingSection({ ctx }) {
  const { activeTab, handleCreateNew, searchQuery, setSearchQuery, showForm } = ctx;
  return (
    <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div>
                            <h3 style={{ margin: '0 0 4px', color: '#0f172a', fontSize: '24px', fontWeight: '700' }}>
                                {activeTab === 'groups' ? 'Account Groups' : activeTab === 'ledgers' ? 'Ledgers' : activeTab === 'vouchers' ? 'Voucher Types' : activeTab === 'categories' ? 'Cost Categories' : activeTab === 'centres' ? 'Cost Centres' : activeTab === 'tds' ? 'TDS Natures' : 'Currencies'}
                            </h3>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Manage your accounting masters and hierarchies.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            {!showForm && (
                                <div style={{ position: 'relative', width: '280px' }}>
                                    <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}/>
                                    <input type="text" placeholder={`Search ${activeTab}...`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '13px' }} onFocus={e=>e.target.style.borderColor='#3b82f6'} onBlur={e=>e.target.style.borderColor='#cbd5e1'} />
                                </div>
                            )}
                            {!showForm && (
                                <button onClick={handleCreateNew} style={{ padding: '10px 20px', background: 'linear-gradient(to bottom, #3b82f6, #2563eb)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}><Plus size={18}/> Create New</button>
                            )}
                        </div>
                    </div>
    </>
  );
}
