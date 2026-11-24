// Screen section: General
// Split out of ChartOfAccounts.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { FileText, IndianRupee, Landmark, ShieldCheck, User } from 'lucide-react';
import React from 'react';

export default function GeneralSection({ ctx }) {
  const { activeTab, flatGroups, ledgerForm, ledgerFormTab, masterData, setLedgerForm, setLedgerFormTab } = ctx;
  return (
    <>
    {activeTab === 'ledgers' && (
                                    <>
                                        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '8px' }}>
                                            <button onClick={()=>setLedgerFormTab('general')} style={{ padding: '8px 16px', background: ledgerFormTab==='general' ? '#eff6ff' : 'transparent', color: ledgerFormTab==='general' ? '#1d4ed8' : '#475569', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={16}/> General</button>
                                            <button onClick={()=>setLedgerFormTab('mailing')} style={{ padding: '8px 16px', background: ledgerFormTab==='mailing' ? '#eff6ff' : 'transparent', color: ledgerFormTab==='mailing' ? '#1d4ed8' : '#475569', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><User size={16}/> Mailing & Contact</button>
                                            <button onClick={()=>setLedgerFormTab('tax')} style={{ padding: '8px 16px', background: ledgerFormTab==='tax' ? '#eff6ff' : 'transparent', color: ledgerFormTab==='tax' ? '#1d4ed8' : '#475569', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={16}/> Tax & Compliance</button>
                                            <button onClick={()=>setLedgerFormTab('bank')} style={{ padding: '8px 16px', background: ledgerFormTab==='bank' ? '#eff6ff' : 'transparent', color: ledgerFormTab==='bank' ? '#1d4ed8' : '#475569', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Landmark size={16}/> Bank & Credit</button>
                                        </div>

                                        {ledgerFormTab === 'general' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s' }}>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Ledger Name <span style={{color:'#ef4444'}}>*</span></label>
                                                    <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={ledgerForm.name} onChange={e => setLedgerForm({...ledgerForm, name: e.target.value})} placeholder="e.g. Reliance Industries" />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Under (Group) <span style={{color:'#ef4444'}}>*</span></label>
                                                    <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', background: '#f8fafc' }} value={ledgerForm.groupId} onChange={e => setLedgerForm({...ledgerForm, groupId: e.target.value})}>
                                                        <option value="">-- Select Parent Group --</option>
                                                        {flatGroups.map(g => <option key={g.id} value={g.id}>{'- '.repeat(g.level)}{g.name}</option>)}
                                                    </select>
                                                </div>
                                                <div style={{ display: 'flex', gap: '16px' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Opening Balance</label>
                                                        <div style={{ position: 'relative' }}>
                                                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><IndianRupee size={16}/></span>
                                                            <input type="number" style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={ledgerForm.openingBalance} onChange={e => setLedgerForm({...ledgerForm, openingBalance: e.target.value})} />
                                                        </div>
                                                    </div>
                                                    <div style={{ width: '100px' }}>
                                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Type</label>
                                                        <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', background: '#f8fafc' }} value={ledgerForm.balanceType} onChange={e => setLedgerForm({...ledgerForm, balanceType: e.target.value})}>
                                                            <option value="Dr">Dr</option><option value="Cr">Cr</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '24px', marginTop: '8px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                                                        <input type="checkbox" checked={ledgerForm.maintainBillByBill} onChange={e => setLedgerForm({...ledgerForm, maintainBillByBill: e.target.checked})} style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }} />
                                                        Maintain balances bill-by-bill
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                                                        <input type="checkbox" checked={ledgerForm.costCentresApplicable} onChange={e => setLedgerForm({...ledgerForm, costCentresApplicable: e.target.checked})} style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }} />
                                                        Cost Centres are applicable
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        {ledgerFormTab === 'mailing' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s' }}>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Address</label>
                                                    <textarea rows="3" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={ledgerForm.address} onChange={e => setLedgerForm({...ledgerForm, address: e.target.value})} placeholder="Full address..." />
                                                </div>
                                                <div style={{ display: 'flex', gap: '16px' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>State</label>
                                                        <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={ledgerForm.state} onChange={e => setLedgerForm({...ledgerForm, state: e.target.value})} />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>PIN Code</label>
                                                        <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={ledgerForm.pinCode} onChange={e => setLedgerForm({...ledgerForm, pinCode: e.target.value})} />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Country</label>
                                                        <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={ledgerForm.country} onChange={e => setLedgerForm({...ledgerForm, country: e.target.value})} />
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Contact Person</label>
                                                        <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={ledgerForm.contactPerson} onChange={e => setLedgerForm({...ledgerForm, contactPerson: e.target.value})} />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Email</label>
                                                        <input type="email" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={ledgerForm.email} onChange={e => setLedgerForm({...ledgerForm, email: e.target.value})} />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Phone</label>
                                                        <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={ledgerForm.phone} onChange={e => setLedgerForm({...ledgerForm, phone: e.target.value})} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {ledgerFormTab === 'tax' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s' }}>
                                                <div>
                                                    <h5 style={{ margin: '0 0 12px', color: '#0f172a', fontSize: '14px' }}>Core Tax Details</h5>
                                                    <div style={{ display: 'flex', gap: '16px' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>GSTIN Number</label>
                                                            <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', textTransform: 'uppercase' }} value={ledgerForm.gstin} onChange={e => setLedgerForm({...ledgerForm, gstin: e.target.value})} />
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>PAN Number</label>
                                                            <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', textTransform: 'uppercase' }} value={ledgerForm.pan} onChange={e => setLedgerForm({...ledgerForm, pan: e.target.value})} />
                                                        </div>
                                                    </div>
                                                </div>
                                                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }}/>
                                                <div>
                                                    <h5 style={{ margin: '0 0 12px', color: '#0f172a', fontSize: '14px' }}>GST Setup (For Goods/Services)</h5>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                        <input type="checkbox" checked={ledgerForm.isGstApplicable} onChange={e => setLedgerForm({...ledgerForm, isGstApplicable: e.target.checked})} />
                                                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#334155' }}>Is GST Applicable?</span>
                                                    </div>
                                                    {ledgerForm.isGstApplicable && (
                                                        <div style={{ display: 'flex', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                            <div style={{ flex: 1 }}>
                                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>HSN/SAC</label>
                                                                <input type="text" style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} value={ledgerForm.hsnSac} onChange={e => setLedgerForm({...ledgerForm, hsnSac: e.target.value})} />
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Taxability</label>
                                                                <select style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} value={ledgerForm.taxability} onChange={e => setLedgerForm({...ledgerForm, taxability: e.target.value})}>
                                                                    <option value="Taxable">Taxable</option><option value="Nil Rated">Nil Rated</option><option value="Exempt">Exempt</option>
                                                                </select>
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>GST Rate (%)</label>
                                                                <input type="number" style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} value={ledgerForm.gstRate} onChange={e => setLedgerForm({...ledgerForm, gstRate: e.target.value})} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }}/>
                                                <div>
                                                    <h5 style={{ margin: '0 0 12px', color: '#0f172a', fontSize: '14px' }}>TDS Compliance</h5>
                                                    <div style={{ display: 'flex', gap: '24px' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>
                                                                <input type="checkbox" checked={ledgerForm.isTdsApplicable} onChange={e => setLedgerForm({...ledgerForm, isTdsApplicable: e.target.checked})} />
                                                                Is TDS Applicable? (For Expenses)
                                                            </label>
                                                            {ledgerForm.isTdsApplicable && (
                                                                <select style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} value={ledgerForm.tdsNatureId} onChange={e => setLedgerForm({...ledgerForm, tdsNatureId: e.target.value})}>
                                                                    <option value="">-- Select TDS Nature --</option>
                                                                    {masterData.tdsNatures.map(t => <option key={t.id} value={t.id}>{t.name} ({t.section})</option>)}
                                                                </select>
                                                            )}
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>
                                                                <input type="checkbox" checked={ledgerForm.isTdsDeductible} onChange={e => setLedgerForm({...ledgerForm, isTdsDeductible: e.target.checked})} />
                                                                Is TDS Deductible? (For Parties)
                                                            </label>
                                                            {ledgerForm.isTdsDeductible && (
                                                                <select style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} value={ledgerForm.deducteeType} onChange={e => setLedgerForm({...ledgerForm, deducteeType: e.target.value})}>
                                                                    <option value="Company">Company</option><option value="Individual/HUF">Individual/HUF</option><option value="Partnership Firm">Partnership Firm</option>
                                                                </select>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {ledgerFormTab === 'bank' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s' }}>
                                                <div style={{ display: 'flex', gap: '16px' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Bank Name</label>
                                                        <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={ledgerForm.bankName} onChange={e => setLedgerForm({...ledgerForm, bankName: e.target.value})} />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Account Number</label>
                                                        <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={ledgerForm.bankAccount} onChange={e => setLedgerForm({...ledgerForm, bankAccount: e.target.value})} />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>IFSC Code</label>
                                                        <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', textTransform: 'uppercase' }} value={ledgerForm.bankIfsc} onChange={e => setLedgerForm({...ledgerForm, bankIfsc: e.target.value})} />
                                                    </div>
                                                </div>
                                                <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '8px 0' }}/>
                                                <div style={{ display: 'flex', gap: '16px' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Credit Limit (₹)</label>
                                                        <input type="number" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={ledgerForm.creditLimit} onChange={e => setLedgerForm({...ledgerForm, creditLimit: e.target.value})} />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Credit Days</label>
                                                        <input type="number" style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} value={ledgerForm.creditDays} onChange={e => setLedgerForm({...ledgerForm, creditDays: e.target.value})} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
    </>
  );
}
