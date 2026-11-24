import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, Printer, Download, Mail, Filter, Search, FileText } from 'lucide-react';

export default function LedgerStatement() {
    const [ledgers, setLedgers] = useState([]);
    const [selectedLedgerId, setSelectedLedgerId] = useState(() => { try { return new URLSearchParams(window.location.search).get('ledgerId') || ''; } catch (e) { return ''; } }); // ?ledgerId= from Accounts search (04-Nov-2026)
    
    // Filters
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const [statement, setStatement] = useState(null);
    const [loading, setLoading] = useState(false);
    
    const [selectedRowId, setSelectedRowId] = useState(null);

    useEffect(() => {
        fetchLedgers();
    }, []);

    useEffect(() => {
        if(selectedLedgerId) fetchStatement();
    }, [selectedLedgerId, startDate, endDate]);

    const fetchLedgers = async () => {
        try {
            const res = await axios.get('/api/accounts/tree');
            const flatLedgers = [];
            const extractLedgers = (nodes) => {
                nodes.forEach(n => {
                    if (n.type === 'ledger') flatLedgers.push(n);
                    if (n.children) extractLedgers(n.children);
                });
            };
            extractLedgers(res.data.data || []);
            setLedgers(flatLedgers);
        } catch(e) {
            console.error('Error fetching ledgers', e);
        }
    };

    const fetchStatement = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/vouchers/ledger-statement/${selectedLedgerId}?startDate=${startDate}&endDate=${endDate}`);
            setStatement(res.data.data);
            setSelectedRowId(null);
        } catch(e) {
            console.error('Error fetching statement', e);
        }
        setLoading(false);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleEmail = () => {
        alert('Email module will open here to send this statement directly to the party.');
    };
    
    const handleExport = () => {
        alert('Exporting to Excel/PDF...');
    };

    const handleView = () => {
        if(!selectedRowId) return alert('Please select a transaction to view');
        alert('Opening Voucher View for ID: ' + selectedRowId);
    };

    // Compact styles
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
                    <div style={{ background: '#0ea5e9', padding: '8px', borderRadius: '6px', color: '#fff' }}>
                        <FileText size={20} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '700', letterSpacing: '-0.5px' }}>Ledger Statement</h2>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Advanced Accounting Report</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="action-btn primary" onClick={handleView} style={{...actionBtnStyle, background: '#0ea5e9', color: '#fff', borderColor: '#0ea5e9'}}>
                        <Eye size={14} /> View
                    </button>
                    <div style={{ width: '1px', background: '#cbd5e1', margin: '0 4px' }}></div>
                    <button className="action-btn" onClick={handlePrint} style={actionBtnStyle}>
                        <Printer size={14} /> Print
                    </button>
                    <button className="action-btn" onClick={handleEmail} style={actionBtnStyle}>
                        <Mail size={14} /> Email
                    </button>
                    <button className="action-btn" onClick={handleExport} style={actionBtnStyle}>
                        <Download size={14} /> Export
                    </button>
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
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Account Ledger:</span>
                        <select 
                            value={selectedLedgerId} 
                            onChange={e => setSelectedLedgerId(e.target.value)}
                            style={{...inputStyle, width: '300px', borderColor: '#eab308'}}
                        >
                            <option value="">-- Type or Select Ledger --</option>
                            {ledgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
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
                    {!selectedLedgerId ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                            <FileText size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#64748b' }}>No Ledger Selected</div>
                            <div style={{ fontSize: '13px' }}>Please select a ledger from the top bar to generate the statement.</div>
                        </div>
                    ) : loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: '#0ea5e9' }}>Loading Statement...</div>
                    ) : statement ? (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            
                            {/* Print Header (Visible only in print or clearly at top) */}
                            <div style={{ padding: '16px 20px', borderBottom: '2px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                    <h1 style={{ margin: 0, fontSize: '20px', color: '#0f172a', fontWeight: 'bold' }}>{statement.ledger.name}</h1>
                                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>Ledger Account Statement</div>
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
                                        <th style={{...thStyle, width: '110px'}}>Vch Type</th>
                                        <th style={{...thStyle, width: '110px'}}>Vch No.</th>
                                        <th style={{...thStyle, width: '140px', textAlign: 'right'}}>Debit (₹)</th>
                                        <th style={{...thStyle, width: '140px', textAlign: 'right'}}>Credit (₹)</th>
                                        <th style={{...thStyle, width: '140px', textAlign: 'right', borderRight: 'none'}}>Balance (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Opening Balance Row */}
                                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                                        <td colSpan="4" style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#334155'}}>Opening Balance</td>
                                        <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#1d4ed8'}}>
                                            {statement.openingBalanceType === 'Dr' ? statement.openingBalance.toLocaleString('en-IN', {minimumFractionDigits: 2}) : ''}
                                        </td>
                                        <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#b91c1c'}}>
                                            {statement.openingBalanceType === 'Cr' ? statement.openingBalance.toLocaleString('en-IN', {minimumFractionDigits: 2}) : ''}
                                        </td>
                                        <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', borderRight: 'none'}}>
                                            {statement.openingBalance.toLocaleString('en-IN', {minimumFractionDigits: 2})} {statement.openingBalanceType}
                                        </td>
                                    </tr>
                                    
                                    {/* Transactions */}
                                    {statement.transactions.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>No transactions in this period.</td>
                                        </tr>
                                    ) : statement.transactions.map((txn, idx) => (
                                        <tr 
                                            key={txn.id} 
                                            onClick={() => setSelectedRowId(txn.voucherId)}
                                            style={{ 
                                                background: selectedRowId === txn.voucherId ? '#e0f2fe' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'), 
                                                borderBottom: '1px solid #e2e8f0',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <td style={{...tdStyle, fontWeight: '500'}}>{txn.date.split('-').reverse().join('-')}</td>
                                            <td style={{...tdStyle, fontWeight: 'bold', color: '#0f172a'}}>
                                                {txn.voucherType}
                                                {txn.narration && <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal', marginTop: '4px', fontStyle: 'italic' }}>{txn.narration}</div>}
                                            </td>
                                            <td style={tdStyle}>{txn.voucherType}</td>
                                            <td style={{...tdStyle, fontWeight: '600'}}>{txn.voucherNumber}</td>
                                            <td style={{...tdStyle, textAlign: 'right', color: '#1d4ed8', background: txn.dc === 'Dr' && selectedRowId !== txn.voucherId ? '#eff6ff' : 'transparent', fontWeight: txn.dc === 'Dr' ? '600' : 'normal'}}>
                                                {txn.dc === 'Dr' ? txn.amount.toLocaleString('en-IN', {minimumFractionDigits: 2}) : ''}
                                            </td>
                                            <td style={{...tdStyle, textAlign: 'right', color: '#b91c1c', background: txn.dc === 'Cr' && selectedRowId !== txn.voucherId ? '#fef2f2' : 'transparent', fontWeight: txn.dc === 'Cr' ? '600' : 'normal'}}>
                                                {txn.dc === 'Cr' ? txn.amount.toLocaleString('en-IN', {minimumFractionDigits: 2}) : ''}
                                            </td>
                                            <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', borderRight: 'none', color: '#334155'}}>
                                                {txn.runningBalance.toLocaleString('en-IN', {minimumFractionDigits: 2})} {txn.runningBalanceType}
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Closing Balance Row */}
                                    <tr style={{ background: '#dbeafe', borderTop: '2px solid #0369a1' }}>
                                        <td colSpan="4" style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#0369a1', fontSize: '14px', padding: '12px 10px'}}>Closing Balance</td>
                                        <td colSpan="2" style={tdStyle}></td>
                                        <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#0369a1', borderRight: 'none', fontSize: '16px', padding: '12px 10px'}}>
                                            {statement.closingBalance.toLocaleString('en-IN', {minimumFractionDigits: 2})} {statement.closingBalanceType}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
