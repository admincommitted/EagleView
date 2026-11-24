import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Printer, Download, Mail, Filter, Search, Activity, Box, Receipt } from 'lucide-react';

export default function GSTReports() {
    const [activeTab, setActiveTab] = useState('GSTR1'); // GSTR1, GSTR2, GSTR3B
    
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today);

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);

    useEffect(() => {
        fetchData();
    }, [activeTab, startDate, endDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/vouchers/gst-returns?type=${activeTab}&startDate=${startDate}&endDate=${endDate}`);
            setData(res.data.data);
        } catch(e) {
            console.error('Error fetching GST data', e);
        }
        setLoading(false);
    };

    const inputStyle = { padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', outline: 'none', fontWeight: 'bold', background: '#fff' };
    const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: '11px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', background: '#dbeafe', color: '#0369a1', fontWeight: '800', textTransform: 'uppercase' };
    const tdStyle = { padding: '8px 12px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', fontSize: '12px', color: '#1e293b' };
    const actionBtnStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', fontWeight: '600', color: '#334155', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };
    const tabStyle = (isActive) => ({ padding: '10px 24px', cursor: 'pointer', borderBottom: isActive ? '3px solid #0ea5e9' : '3px solid transparent', color: isActive ? '#0ea5e9' : '#64748b', fontWeight: isActive ? 'bold' : '600', fontSize: '14px', background: isActive ? '#f0f9ff' : 'transparent', transition: 'all 0.2s' });

    return (
        <div className="report-container" style={{ padding: '16px', width: '100%', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
            
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .printable-area, .printable-area * { visibility: visible; }
                    .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
                    .no-print { display: none !important; }
                }
                .action-btn:hover { background: #f1f5f9 !important; border-color: #94a3b8 !important; }
            `}</style>

            {/* Top Header & Actions */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#ec4899', padding: '8px', borderRadius: '6px', color: '#fff' }}>
                        <Receipt size={20} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '700', letterSpacing: '-0.5px' }}>GST Returns Dashboard</h2>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>GSTR-1, GSTR-2, and GSTR-3B Reconciliation</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="action-btn" onClick={() => window.print()} style={actionBtnStyle}><Printer size={14} /> Print</button>
                    <button className="action-btn" onClick={() => alert('Exporting Return (JSON/Excel) for Portal Upload...')} style={{...actionBtnStyle, background: '#ec4899', color: '#fff', borderColor: '#ec4899'}}><Download size={14} /> Export for GST Portal</button>
                </div>
            </div>

            <div style={{ border: '1px solid #94a3b8', borderRadius: '6px', background: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                
                {/* Tabs */}
                <div className="no-print" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}>
                    <div style={tabStyle(activeTab === 'GSTR1')} onClick={() => setActiveTab('GSTR1')}>GSTR-1 (Outward Supplies)</div>
                    <div style={tabStyle(activeTab === 'GSTR2')} onClick={() => setActiveTab('GSTR2')}>GSTR-2 (Inward Supplies)</div>
                    <div style={tabStyle(activeTab === 'GSTR3B')} onClick={() => setActiveTab('GSTR3B')}>GSTR-3B (Summary & ITC)</div>
                </div>

                {/* Filters */}
                <div className="no-print" style={{ display: 'flex', gap: '24px', padding: '12px 16px', background: '#fef9c3', borderBottom: '1px solid #fde047', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Filter size={14} color="#854d0e" />
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#854d0e', textTransform: 'uppercase' }}>Filing Period :</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
                        <span style={{ color: '#94a3b8' }}>-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
                    </div>
                </div>

                <div className="printable-area" style={{ minHeight: '500px', background: '#f8fafc', padding: '16px' }}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: '#ec4899' }}>Compiling GST Data...</div>
                    ) : (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ padding: '16px 20px', borderBottom: '2px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                    <h1 style={{ margin: 0, fontSize: '20px', color: '#0f172a', fontWeight: 'bold' }}>{activeTab === 'GSTR1' ? 'GSTR-1 : Sales Register' : activeTab === 'GSTR2' ? 'GSTR-2 : Purchase Register' : 'GSTR-3B : Return Summary'}</h1>
                                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>GSTIN: 07AADCC1234E1Z5 (Demo)</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>Period</div>
                                    <div style={{ fontSize: '12px', color: '#475569' }}>{startDate.split('-').reverse().join('-')} to {endDate.split('-').reverse().join('-')}</div>
                                </div>
                            </div>

                            {(activeTab === 'GSTR1' || activeTab === 'GSTR2') && (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={{...thStyle, width: '90px'}}>Date</th>
                                            <th style={{...thStyle, width: '120px'}}>Vch No.</th>
                                            <th style={{...thStyle}}>Party / Particulars</th>
                                            <th style={{...thStyle, width: '130px'}}>GSTIN/UIN</th>
                                            <th style={{...thStyle, width: '120px', textAlign: 'right'}}>Taxable Value</th>
                                            <th style={{...thStyle, width: '100px', textAlign: 'right'}}>CGST</th>
                                            <th style={{...thStyle, width: '100px', textAlign: 'right'}}>SGST</th>
                                            <th style={{...thStyle, width: '100px', textAlign: 'right'}}>IGST</th>
                                            <th style={{...thStyle, width: '120px', textAlign: 'right', borderRight: 'none'}}>Total Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {!data || data.length === 0 ? (
                                            <tr><td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No records found for {activeTab}.</td></tr>
                                        ) : data.map((vch, idx) => {
                                            // 30-Oct-2026: the breakup used to be guessed here - every voucher was taken as 18% GST
                                            // (total x 0.82 / x 0.09 / x 0.09) and every party printed as "Unregistered". The server
                                            // reads the real CGST / SGST / IGST lines of the voucher and its party GSTIN; a voucher
                                            // with no tax line shows no tax instead of an invented one.
                                            const total = parseFloat(vch.total) || 0;
                                            const taxable = parseFloat(vch.taxable) || 0;
                                            const cgst = parseFloat(vch.cgst) || 0;
                                            const sgst = parseFloat(vch.sgst) || 0;
                                            const igst = parseFloat(vch.igst) || 0;
                                            const party = vch.partyName || '-';
                                            const noTax = !(cgst || sgst || igst);

                                            return (
                                                <tr key={vch.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                    <td style={tdStyle}>{String(vch.date || '').split('-').reverse().join('-')}</td>
                                                    <td style={{...tdStyle, fontWeight: 'bold'}}>{vch.voucherNumber}{noTax ? <span title="This voucher has no CGST / SGST / IGST line - nothing is assumed" style={{ marginLeft: 6, fontSize: 10, color: '#b45309' }}>no tax line</span> : null}</td>
                                                    <td style={{...tdStyle, color: '#0f172a', fontWeight: '600'}}>{party}</td>
                                                    <td style={{...tdStyle, color: vch.gstin ? '#0f172a' : '#64748b'}}>{vch.gstin || 'Unregistered'}</td>
                                                    <td style={{...tdStyle, textAlign: 'right', fontWeight: '500'}}>{taxable.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                                                    <td style={{...tdStyle, textAlign: 'right', color: '#1d4ed8'}}>{cgst.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                                                    <td style={{...tdStyle, textAlign: 'right', color: '#1d4ed8'}}>{sgst.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                                                    <td style={{...tdStyle, textAlign: 'right', color: '#1d4ed8'}}>{igst.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                                                    <td style={{...tdStyle, textAlign: 'right', borderRight: 'none', fontWeight: 'bold', color: '#0f172a'}}>{total.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}

                            {activeTab === 'GSTR3B' && data && (
                                <div style={{ padding: '24px', background: '#fff' }}>
                                    
                                    <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#0f172a', fontWeight: 'bold', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>3.1 Outward Supplies and Inward Supplies Liable to Reverse Charge</h3>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
                                        <thead>
                                            <tr>
                                                <th style={thStyle}>Nature of Supplies</th>
                                                <th style={{...thStyle, textAlign: 'right'}}>Total Taxable Value</th>
                                                <th style={{...thStyle, textAlign: 'right'}}>Integrated Tax (IGST)</th>
                                                <th style={{...thStyle, textAlign: 'right'}}>Central Tax (CGST)</th>
                                                <th style={{...thStyle, textAlign: 'right'}}>State Tax (SGST)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={tdStyle}>(a) Outward taxable supplies (other than zero rated, nil rated and exempted)</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>{data.outwardSupplies?.taxable.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>{data.outwardSupplies?.igst.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>{data.outwardSupplies?.cgst.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>{data.outwardSupplies?.sgst.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                            </tr>
                                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={tdStyle}>(b) Outward taxable supplies (zero rated)</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>0.00</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>0.00</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>0.00</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>0.00</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#0f172a', fontWeight: 'bold', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>4. Eligible ITC (Input Tax Credit)</h3>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={thStyle}>Details</th>
                                                <th style={{...thStyle, textAlign: 'right'}}>Integrated Tax (IGST)</th>
                                                <th style={{...thStyle, textAlign: 'right'}}>Central Tax (CGST)</th>
                                                <th style={{...thStyle, textAlign: 'right'}}>State Tax (SGST)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{...tdStyle, fontWeight: 'bold'}}>(A) ITC Available (whether in full or part)</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>{data.itcAvailable?.igst.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>{data.itcAvailable?.cgst.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>{data.itcAvailable?.sgst.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                            </tr>
                                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{...tdStyle, fontWeight: 'bold', color: '#10b981'}}>(C) Net ITC Available (A - B)</td>
                                                <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#10b981'}}>{data.itcAvailable?.igst.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                                <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#10b981'}}>{data.itcAvailable?.cgst.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                                <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#10b981'}}>{data.itcAvailable?.sgst.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
