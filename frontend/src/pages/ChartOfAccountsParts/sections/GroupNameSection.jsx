// Screen section: Group Name
// Split out of ChartOfAccounts.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';

export default function GroupNameSection({ ctx }) {
  const { activeTab, flatGroups, groupForm, setGroupForm } = ctx;
  return (
    <>
    {activeTab === 'groups' && (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Group Name <span style={{color:'#ef4444'}}>*</span></label>
                                            <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} onFocus={e=>e.target.style.borderColor='#3b82f6'} onBlur={e=>e.target.style.borderColor='#cbd5e1'} value={groupForm.name} onChange={e => setGroupForm({...groupForm, name: e.target.value})} placeholder="e.g. Indirect Expenses" />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Under (Parent Group)</label>
                                            <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', background: '#f8fafc' }} value={groupForm.parentId} onChange={e => {
                                                const val = e.target.value;
                                                const parent = flatGroups.find(g => g.id === parseInt(val));
                                                setGroupForm({...groupForm, parentId: val, nature: parent ? parent.nature : 'Assets'});
                                            }}>
                                                <option value="">-- Primary (Root) --</option>
                                                {flatGroups.map(g => <option key={g.id} value={g.id}>{'- '.repeat(g.level)}{g.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Nature</label>
                                            <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', background: groupForm.parentId ? '#f1f5f9' : 'white' }} disabled={!!groupForm.parentId} value={groupForm.nature} onChange={e => setGroupForm({...groupForm, nature: e.target.value})}>
                                                <option value="Assets">Assets</option><option value="Liabilities">Liabilities</option>
                                                <option value="Income">Income</option><option value="Expenses">Expenses</option>
                                            </select>
                                        </div>
                                    </>
                                )}
    </>
  );
}
