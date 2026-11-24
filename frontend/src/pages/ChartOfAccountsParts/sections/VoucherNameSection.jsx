// Screen section: Voucher Name
// Split out of ChartOfAccounts.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';
import { Save } from 'lucide-react';

export default function VoucherNameSection({ ctx }) {
  const { activeTab, categoryForm, centreForm, currencyForm, editMode, handleSave, masterData, setCategoryForm, setCentreForm, setCurrencyForm, setShowForm, setTdsForm, setVoucherForm, tdsForm, voucherForm } = ctx;
  return (
    <>
    {activeTab === 'vouchers' && (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Voucher Name <span style={{color:'#ef4444'}}>*</span></label>
                                            <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={voucherForm.name} onChange={e => setVoucherForm({...voucherForm, name: e.target.value})} placeholder="e.g. Custom Receipt" />
                                        </div>
                                        <div style={{ display: 'flex', gap: '16px' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Base Type</label>
                                                <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', background: '#f8fafc' }} value={voucherForm.baseType} onChange={e => setVoucherForm({...voucherForm, baseType: e.target.value})}>
                                                    {['Receipt', 'Payment', 'Contra', 'Journal', 'Sales', 'Purchase', 'Credit Note', 'Debit Note'].map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Method of Numbering</label>
                                                <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', background: '#f8fafc' }} value={voucherForm.numberingMethod} onChange={e => setVoucherForm({...voucherForm, numberingMethod: e.target.value})}>
                                                    <option value="Automatic">Automatic</option><option value="Manual">Manual</option><option value="None">None</option>
                                                </select>
                                            </div>
                                        </div>
                                        
                                        {voucherForm.numberingMethod === 'Automatic' && (
                                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <h5 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>Advanced Configuration (Prefix/Suffix)</h5>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: '12px' }}>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Prefix</label>
                                                        <input type="text" style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} value={voucherForm.prefix} onChange={e => setVoucherForm({...voucherForm, prefix: e.target.value})} placeholder="e.g. REC/" />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Start No.</label>
                                                        <input type="number" style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} value={voucherForm.startingNumber} onChange={e => setVoucherForm({...voucherForm, startingNumber: parseInt(e.target.value) || 1})} />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Suffix</label>
                                                        <input type="text" style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} value={voucherForm.suffix} onChange={e => setVoucherForm({...voucherForm, suffix: e.target.value})} placeholder="e.g. /26-27" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {activeTab === 'categories' && (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Category Name <span style={{color:'#ef4444'}}>*</span></label>
                                            <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={categoryForm.name} onChange={e => setCategoryForm({...categoryForm, name: e.target.value})} placeholder="e.g. Marketing Projects" />
                                        </div>
                                        <div style={{ display: 'flex', gap: '24px', marginTop: '8px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={categoryForm.allocateRevenue} onChange={e => setCategoryForm({...categoryForm, allocateRevenue: e.target.checked})} style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }} />
                                                Allocate Revenue Items
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={categoryForm.allocateNonRevenue} onChange={e => setCategoryForm({...categoryForm, allocateNonRevenue: e.target.checked})} style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }} />
                                                Allocate Non-Revenue Items
                                            </label>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'centres' && (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Cost Centre Name <span style={{color:'#ef4444'}}>*</span></label>
                                            <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={centreForm.name} onChange={e => setCentreForm({...centreForm, name: e.target.value})} placeholder="e.g. Website Overhaul" />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Category</label>
                                            <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', background: '#f8fafc' }} value={centreForm.categoryId} onChange={e => setCentreForm({...centreForm, categoryId: e.target.value})}>
                                                <option value="">-- Select Category --</option>
                                                {masterData.costCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Under (Parent Centre)</label>
                                            <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', background: '#f8fafc' }} value={centreForm.parentId} onChange={e => setCentreForm({...centreForm, parentId: e.target.value})}>
                                                <option value="">-- Primary --</option>
                                                {masterData.costCentresFlat.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'currencies' && (
                                    <>
                                        <div style={{ display: 'flex', gap: '16px' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Symbol <span style={{color:'#ef4444'}}>*</span></label>
                                                <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={currencyForm.symbol} onChange={e => setCurrencyForm({...currencyForm, symbol: e.target.value})} placeholder="e.g. $" />
                                            </div>
                                            <div style={{ flex: 2 }}>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Formal Name <span style={{color:'#ef4444'}}>*</span></label>
                                                <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={currencyForm.formalName} onChange={e => setCurrencyForm({...currencyForm, formalName: e.target.value})} placeholder="e.g. US Dollar" />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '16px' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Decimal Places</label>
                                                <input type="number" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={currencyForm.decimalPlaces} onChange={e => setCurrencyForm({...currencyForm, decimalPlaces: e.target.value})} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Standard Rate (₹)</label>
                                                <input type="number" step="0.01" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={currencyForm.standardRate} onChange={e => setCurrencyForm({...currencyForm, standardRate: e.target.value})} />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'tds' && (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Nature of Payment <span style={{color:'#ef4444'}}>*</span></label>
                                            <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={tdsForm.name} onChange={e => setTdsForm({...tdsForm, name: e.target.value})} placeholder="e.g. Payment to Contractors" />
                                        </div>
                                        <div style={{ display: 'flex', gap: '16px' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Section</label>
                                                <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={tdsForm.section} onChange={e => setTdsForm({...tdsForm, section: e.target.value})} placeholder="e.g. 194C" />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Rate (%)</label>
                                                <input type="number" step="0.1" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={tdsForm.rate} onChange={e => setTdsForm({...tdsForm, rate: e.target.value})} />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '16px' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Rate (without PAN)</label>
                                                <input type="number" step="0.1" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={tdsForm.rateWithoutPan} onChange={e => setTdsForm({...tdsForm, rateWithoutPan: e.target.value})} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Exemption Limit (₹)</label>
                                                <input type="number" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={tdsForm.exemptionLimit} onChange={e => setTdsForm({...tdsForm, exemptionLimit: e.target.value})} />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div style={{ display: 'flex', gap: '12px', marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
                                    <button style={{ flex: 1, padding: '12px', background: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#f8fafc'} onMouseOut={e=>e.currentTarget.style.background='white'} onClick={() => setShowForm(false)}>Cancel</button>
                                    <button style={{ flex: 2, padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#2563eb'} onMouseOut={e=>e.currentTarget.style.background='#3b82f6'} onClick={handleSave}><Save size={18}/> {editMode ? 'Update' : 'Save'} {activeTab === 'tds' ? 'TDS Nature' : activeTab.slice(0, -1).replace('ie', 'y').replace('currenc', 'currency')}</button>
                                </div>
    </>
  );
}
