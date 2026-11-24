import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, Printer, Download, Mail, Filter, Search, FileText } from 'lucide-react';
import VoucherDrawer from './AccountsHubParts/VoucherDrawer';

export default function Daybook() {
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);

    const [selectedRowId, setSelectedRowId] = useState(null);
    const [drawerId, setDrawerId] = useState(null); // 09-Nov-2026: Voucher Details side panel

    useEffect(() => {
        fetchDaybook();
    }, [startDate, endDate]);

    const fetchDaybook = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/vouchers/daybook?startDate=${startDate}&endDate=${endDate}`);
            setVouchers(res.data.data || []);
            setSelectedRowId(null);
        } catch(e) {
            console.error('Error fetching daybook', e);
        }
        setLoading(false);
    };

    const handlePrint = () => window.print();
    const handleEmail = () => alert('Emailing Daybook to registered company ID...');
    const handleExport = () => alert('Exporting Daybook to Excel/PDF...');
    const handleView = () => {
        if(!selectedRowId) return alert('Please select a voucher to view');
        setDrawerId(selectedRowId);
    };

    const inputStyle = { padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', outline: 'none', fontWeight: 'bold', background: '#fff' };
    const thStyle = { padding: '8px 10px', textAlign: 'left', fontSize: '12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', background: '#dbeafe', color: '#0369a1', fontWeight: '700', textTransform: 'uppercase' };
    const tdStyle = { padding: '6px 10px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', fontSize: '12px', color: '#1e293b' };
    const actionBtnStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', fontWeight: '600', color: '#334155', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };

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
                .action-btn.primary:hover { background: #0284c7 !important; border-color: #0284c7 !important; }
            `}</style>

            {/* Top Header & Actions */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#f59e0b', padding: '8px', borderRadius: '6px', color: '#fff' }}>
                        <FileText size={20} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '700', letterSpacing: '-0.5px' }}>Daybook</h2>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Daily Transaction Register</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="action-btn primary" onClick={handleView} style={{...actionBtnStyle, background: '#f59e0b', color: '#fff', borderColor: '#f59e0b'}}>
                        <Eye size={14} /> View
                    </button>
                    <div style={{ width: '1px', background: '#cbd5e1', margin: '0 4px' }}></div>
                    <button className="action-btn" onClick={handlePrint} style={actionBtnStyle}><Printer size={14} /> Print</button>
                    <button className="action-btn" onClick={handleEmail} style={actionBtnStyle}><Mail size={14} /> Email</button>
                    <button className="action-btn" onClick={handleExport} style={actionBtnStyle}><Download size={14} /> Export</button>
                </div>
            </div>

            <div style={{ border: '1px solid #94a3b8', borderRadius: '6px', background: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                
                {/* Advanced Filters Band */}
                <div className="no-print" style={{ display: 'flex', gap: '24px', padding: '12px 16px', background: '#fef9c3', borderBottom: '1px solid #fde047', alignItems: 'center', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Filter size={14} color="#854d0e" />
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#854d0e', textTransform: 'uppercase' }}>Parameters :</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Period:</span>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
                        <span style={{ color: '#94a3b8' }}>-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
                    </div>
                </div>

                {/* Printable Grid Area */}
                <div className="printable-area" style={{ minHeight: '500px', background: '#f8fafc', padding: '16px' }}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: '#f59e0b' }}>Loading Daybook...</div>
                    ) : (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            
                            <div style={{ padding: '16px 20px', borderBottom: '2px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                    <h1 style={{ margin: 0, fontSize: '20px', color: '#0f172a', fontWeight: 'bold' }}>Daybook Register</h1>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>Period</div>
                                    <div style={{ fontSize: '12px', color: '#475569' }}>{startDate.split('-').reverse().join('-')} to {endDate.split('-').reverse().join('-')}</div>
                                </div>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{...thStyle, width: '90px'}}>Date</th>
                                        <th style={{...thStyle}}>Particulars</th>
                                        <th style={{...thStyle, width: '120px'}}>Vch Type</th>
                                        <th style={{...thStyle, width: '100px'}}>Vch No.</th>
                                        <th style={{...thStyle, width: '150px', textAlign: 'right'}}>Debit (₹)</th>
                                        <th style={{...thStyle, width: '150px', textAlign: 'right', borderRight: 'none'}}>Credit (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vouchers.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>No entries found for the selected period.</td>
                                        </tr>
                                    ) : vouchers.map((vch, idx) => {
                                        let drDetails = vch.details.filter(d => d.dc === 'Dr').map(d => d.ledger?.name).join(', ');
                                        let crDetails = vch.details.filter(d => d.dc === 'Cr').map(d => d.ledger?.name).join(', ');
                                        let primaryLedger = drDetails; 
                                        
                                        if(vch.voucherType.baseType === 'Receipt' || vch.voucherType.baseType === 'Sales') {
                                            primaryLedger = crDetails;
                                        }

                                        return (
                                            <tr 
                                                key={vch.id} 
                                                onClick={() => { setSelectedRowId(vch.id); setDrawerId(vch.id); }}
                                                title="Show this voucher's details"
                                                style={{ 
                                                    background: selectedRowId === vch.id ? '#e0f2fe' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'), 
                                                    borderBottom: '1px solid #e2e8f0', 
                                                    cursor: 'pointer' 
                                                }}
                                            >
                                                <td style={{...tdStyle, fontWeight: '500'}}>{vch.date.split('-').reverse().join('-')}</td>
                                                <td style={{...tdStyle, fontWeight: 'bold', color: '#0f172a'}}>
                                                    {primaryLedger}
                                                    {vch.narration && <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal', marginTop: '4px', fontStyle: 'italic' }}>{vch.narration}</div>}
                                                </td>
                                                <td style={tdStyle}>{vch.voucherType.name}</td>
                                                <td style={{...tdStyle, fontWeight: '600'}}>{vch.voucherNumber}</td>
                                                <td style={{...tdStyle, textAlign: 'right', color: '#1d4ed8', fontWeight: '600'}}>
                                                    {parseFloat(vch.totalAmount).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                                                </td>
                                                <td style={{...tdStyle, textAlign: 'right', color: '#b91c1c', fontWeight: '600', borderRight: 'none'}}>
                                                    {parseFloat(vch.totalAmount).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            {drawerId && <VoucherDrawer id={drawerId} ids={vouchers.map(v => v.id)} onMove={(id) => { setDrawerId(id); setSelectedRowId(id); }} onClose={() => setDrawerId(null)} />}
        </div>
    );
}
