import { Activity, Receipt, ShieldCheck, Tags, X } from 'lucide-react';
import React from 'react';
import useChartOfAccounts from './ChartOfAccountsParts/useChartOfAccounts';
import AccountingSection from './ChartOfAccountsParts/sections/AccountingSection';
import ManageYourAccountingSection from './ChartOfAccountsParts/sections/ManageYourAccountingSection';
import GroupNameSection from './ChartOfAccountsParts/sections/GroupNameSection';
import GeneralSection from './ChartOfAccountsParts/sections/GeneralSection';
import VoucherNameSection from './ChartOfAccountsParts/sections/VoucherNameSection';

// ChartOfAccounts: state/logic in ./ChartOfAccountsParts/use*.jsx, screen sections in ./ChartOfAccountsParts/sections/.
export default function ChartOfAccounts() {
  const ctx = {};
  Object.assign(ctx, useChartOfAccounts(ctx));
  const { activeTab, editMode, filteredCentres, filteredTreeData, masterData, renderAccountTree, renderActionButtons, renderCentreTree, searchQuery, setShowForm, showForm } = ctx;
  return <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .tree-row .action-buttons { opacity: 0; transition: opacity 0.2s; }
                .tree-row:hover .action-buttons { opacity: 1; }
                .card-actions { opacity: 0; transition: opacity 0.2s; }
                .hover-card:hover .card-actions { opacity: 1; }
                .table-row .action-buttons { opacity: 0; transition: opacity 0.2s; }
                .table-row:hover .action-buttons { opacity: 1; }
            `}</style>
            
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <AccountingSection ctx={ctx} />

                <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
                    <ManageYourAccountingSection ctx={ctx} />

                    {showForm ? (
                        <div style={{ background: 'white', padding: '32px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', maxWidth: activeTab === 'ledgers' ? '800px' : '640px', animation: 'fadeIn 0.3s ease-in-out' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                                <h4 style={{ margin: 0, fontSize: '18px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Activity size={20} color="#3b82f6"/> {editMode ? 'Edit' : 'Create'} {activeTab === 'tds' ? 'TDS Nature' : activeTab.slice(0, -1).replace('ie', 'y').replace('currenc', 'currency')}
                                </h4>
                                <div style={{ cursor: 'pointer', color: '#94a3b8', padding: '4px', background: '#f8fafc', borderRadius: '50%' }} onClick={() => setShowForm(false)}><X size={20} /></div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <GroupNameSection ctx={ctx} />

                                <GeneralSection ctx={ctx} />

                                <VoucherNameSection ctx={ctx} />
                            </div>
                        </div>
                    ) : (
                        <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                            {(activeTab === 'groups' || activeTab === 'ledgers') && (
                                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', minHeight: '400px' }}>
                                    {filteredTreeData.map(node => renderAccountTree(node))}
                                    {filteredTreeData.length === 0 && <div style={{ padding: '20px', color: '#94a3b8', textAlign: 'center' }}>No results found</div>}
                                </div>
                            )}

                            {activeTab === 'vouchers' && (
                                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                <th style={{ padding: '16px 20px', textAlign: 'left', color: '#475569', fontWeight: '600', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Voucher Name</th>
                                                <th style={{ padding: '16px 20px', textAlign: 'left', color: '#475569', fontWeight: '600', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Origin</th>
                                                <th style={{ padding: '16px 20px', textAlign: 'left', color: '#475569', fontWeight: '600', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base Type</th>
                                                <th style={{ padding: '16px 20px', textAlign: 'left', color: '#475569', fontWeight: '600', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Numbering</th>
                                                <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {masterData.voucherTypes.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase())).map((v, i) => (
                                                <tr className="table-row" key={v.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#f8fafc'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                                                    <td style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Receipt size={16} color="#64748b"/></div>
                                                        <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>{v.name}</span>
                                                    </td>
                                                    <td style={{ padding: '16px 20px' }}>
                                                        {v.isBuiltIn ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: '#e0e7ff', color: '#4338ca', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}><ShieldCheck size={12}/> SYSTEM</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>CUSTOM</span>}
                                                    </td>
                                                    <td style={{ padding: '16px 20px', color: '#475569', fontSize: '14px' }}>{v.baseType}</td>
                                                    <td style={{ padding: '16px 20px', color: '#475569', fontSize: '14px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <span style={{ background: v.numberingMethod === 'Automatic' ? '#dcfce7' : '#f1f5f9', color: v.numberingMethod === 'Automatic' ? '#166534' : '#475569', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', alignSelf: 'flex-start' }}>{v.numberingMethod}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 20px' }}>{renderActionButtons('voucher', v)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {activeTab === 'categories' && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                                    {masterData.costCategories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(c => (
                                        <div className="hover-card" key={c.id} style={{ padding: '20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                                <div style={{ display: 'flex', gap: '12px' }}>
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Tags size={20} color="#ef4444"/></div>
                                                    <div>
                                                        <h4 style={{ margin: '0 0 4px', color: '#0f172a', fontSize: '16px', fontWeight: '700' }}>{c.name}</h4>
                                                        {c.isBuiltIn && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', background: '#e0e7ff', color: '#4338ca', padding: '2px 6px', borderRadius: '12px', fontWeight: 'bold' }}><ShieldCheck size={12}/> SYSTEM</span>}
                                                    </div>
                                                </div>
                                                <div className="card-actions">{renderActionButtons('category', c)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'centres' && (
                                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', minHeight: '400px' }}>
                                    {renderCentreTree(filteredCentres)}
                                </div>
                            )}

                            {activeTab === 'currencies' && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                                    {masterData.currencies.filter(c => c.formalName.toLowerCase().includes(searchQuery.toLowerCase())).map(c => (
                                        <div className="hover-card" key={c.id} style={{ padding: '20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', position: 'relative' }}>
                                            <div className="card-actions" style={{ position: 'absolute', top: '16px', right: '16px' }}>{renderActionButtons('currency', c)}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>{c.symbol}</div>
                                                <div><h4 style={{ margin: '0 0 4px', color: '#0f172a', fontSize: '18px', fontWeight: '700' }}>{c.formalName}</h4></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'tds' && (
                                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                <th style={{ padding: '16px 20px', textAlign: 'left', color: '#475569', fontWeight: '600', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nature of Payment</th>
                                                <th style={{ padding: '16px 20px', textAlign: 'left', color: '#475569', fontWeight: '600', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Section</th>
                                                <th style={{ padding: '16px 20px', textAlign: 'right', color: '#475569', fontWeight: '600', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rate</th>
                                                <th style={{ padding: '16px 20px', textAlign: 'right', color: '#475569', fontWeight: '600', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exemption Limit</th>
                                                <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {masterData.tdsNatures.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())).map((t) => (
                                                <tr className="table-row" key={t.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#f8fafc'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                                                    <td style={{ padding: '16px 20px', fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>{t.name}</td>
                                                    <td style={{ padding: '16px 20px' }}><span style={{ background: '#e0e7ff', color: '#4338ca', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>Sec {t.section}</span></td>
                                                    <td style={{ padding: '16px 20px', textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>{t.rate}%</td>
                                                    <td style={{ padding: '16px 20px', textAlign: 'right', color: '#475569' }}>₹ {t.exemptionLimit}</td>
                                                    <td style={{ padding: '16px 20px' }}>{renderActionButtons('tds', t)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>
        </div>;
}
