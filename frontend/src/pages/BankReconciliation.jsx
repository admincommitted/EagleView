import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Save, Filter, FileText, Printer, Download, CheckCircle } from 'lucide-react';

export default function BankReconciliation() {
    const [ledgers, setLedgers] = useState([]);
    const [selectedLedgerId, setSelectedLedgerId] = useState('');
    const [brsData, setBrsData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dirtyRows, setDirtyRows] = useState({});

    useEffect(() => {
        fetchLedgers();
    }, []);

    useEffect(() => {
        if(selectedLedgerId) fetchBRS();
    }, [selectedLedgerId]);

    const fetchLedgers = async () => {
        try {
            const res = await axios.get('/api/accounts/tree');
            const flatLedgers = [];
            const extractLedgers = (nodes) => {
                nodes.forEach(n => {
                    // Usually BRS is done for Bank ledgers, but we'll list all for now
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

    const fetchBRS = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/vouchers/brs/${selectedLedgerId}`);
            setBrsData(res.data.data);
            setDirtyRows({});
        } catch(e) {
            console.error('Error fetching BRS', e);
        }
        setLoading(false);
    };

    const handleDateChange = (id, val) => {
        const newData = { ...brsData };
        const txn = newData.transactions.find(t => t.id === id);
        if(txn) {
            txn.clearanceDate = val;
            setBrsData(newData);
            setDirtyRows(prev => ({ ...prev, [id]: val }));
        }
    };

    const handleSave = async () => {
        const updates = Object.keys(dirtyRows).map(id => ({
            id: parseInt(id),
            clearanceDate: dirtyRows[id] || null
        }));
        
        if(updates.length === 0) return alert('No changes to save.');

        setSaving(true);
        try {
            await axios.post('/api/vouchers/brs/reconcile', { updates });
            alert('Reconciliation updated successfully!');
            fetchBRS();
        } catch (e) {
            alert('Error updating reconciliation');
        }
        setSaving(false);
    };

    // Calculate Summary
    const summary = useMemo(() => {
        if (!brsData) return null;
        
        // Let's get live currentBalance of this ledger using the same API logic if we had it, 
        // but since we only fetched /brs, we will sum it here.
        // Balance as per Company Books: Opening + All Dr - All Cr
        let opDr = brsData.ledger.balanceType === 'Dr' ? parseFloat(brsData.ledger.openingBalance || 0) : 0;
        let opCr = brsData.ledger.balanceType === 'Cr' ? parseFloat(brsData.ledger.openingBalance || 0) : 0;

        let totalDr = opDr;
        let totalCr = opCr;

        let unreconciledDr = 0;
        let unreconciledCr = 0;

        brsData.transactions.forEach(t => {
            if (t.dc === 'Dr') {
                totalDr += t.amount;
                if (!t.clearanceDate) unreconciledDr += t.amount;
            } else {
                totalCr += t.amount;
                if (!t.clearanceDate) unreconciledCr += t.amount;
            }
        });

        let companyBal = totalDr - totalCr;
        let companyBalType = companyBal >= 0 ? 'Dr' : 'Cr';
        companyBal = Math.abs(companyBal);

        // Balance as per Bank = Company Balance + Unreconciled Cr (issued but not cleared) - Unreconciled Dr (deposited but not cleared)
        // Note: standard BRS math:
        // Cash book Dr balance (favorable) 
        // + Cheques issued but not presented (Unreconciled Cr)
        // - Cheques deposited but not cleared (Unreconciled Dr)
        // = Bank Passbook Cr balance.
        
        // Let's use absolute net values for simplicity
        let bankNet = (totalDr - totalCr) + unreconciledCr - unreconciledDr;
        let bankBalType = bankNet >= 0 ? 'Dr' : 'Cr';
        let bankBal = Math.abs(bankNet);

        return {
            companyBal, companyBalType,
            unreconciledDr, unreconciledCr,
            bankBal, bankBalType
        };
    }, [brsData]);

    const inputStyle = { padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', outline: 'none', fontWeight: 'bold', background: '#fff' };
    const thStyle = { padding: '8px 10px', textAlign: 'left', fontSize: '12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', background: '#dbeafe', color: '#0369a1', fontWeight: '700', textTransform: 'uppercase' };
    const tdStyle = { padding: '6px 10px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', fontSize: '12px', color: '#1e293b' };
    const actionBtnStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', fontWeight: '600', color: '#334155', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };

    return (
        <div className="report-container" style={{ padding: '16px', width: '100%', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
            
            {/* Top Header & Actions */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#8b5cf6', padding: '8px', borderRadius: '6px', color: '#fff' }}>
                        <CheckCircle size={20} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '700', letterSpacing: '-0.5px' }}>Bank Reconciliation</h2>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Reconcile Company Books with Bank Statement</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="action-btn" onClick={() => window.print()} style={actionBtnStyle}><Printer size={14} /> Print</button>
                    <button className="action-btn primary" onClick={handleSave} disabled={saving || Object.keys(dirtyRows).length === 0} style={{...actionBtnStyle, background: Object.keys(dirtyRows).length > 0 ? '#8b5cf6' : '#e2e8f0', color: Object.keys(dirtyRows).length > 0 ? '#fff' : '#94a3b8', borderColor: Object.keys(dirtyRows).length > 0 ? '#8b5cf6' : '#cbd5e1'}}>
                        <Save size={14} /> {saving ? 'Saving...' : 'Update BRS'}
                    </button>
                </div>
            </div>

            <div style={{ border: '1px solid #94a3b8', borderRadius: '6px', background: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                
                {/* Advanced Filters Band */}
                <div className="no-print" style={{ display: 'flex', gap: '24px', padding: '12px 16px', background: '#fef9c3', borderBottom: '1px solid #fde047', alignItems: 'center', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Filter size={14} color="#854d0e" />
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#854d0e', textTransform: 'uppercase' }}>Select Bank :</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select 
                            value={selectedLedgerId} 
                            onChange={e => setSelectedLedgerId(e.target.value)}
                            style={{...inputStyle, width: '300px', borderColor: '#eab308'}}
                        >
                            <option value="">-- Select Bank Ledger --</option>
                            {ledgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="printable-area" style={{ minHeight: '500px', background: '#f8fafc', padding: '16px' }}>
                    {!selectedLedgerId ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                            <CheckCircle size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#64748b' }}>No Bank Selected</div>
                            <div style={{ fontSize: '13px' }}>Please select a bank ledger to start reconciliation.</div>
                        </div>
                    ) : loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: '#8b5cf6' }}>Loading BRS Data...</div>
                    ) : brsData ? (
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                            
                            {/* Left: Transactions Grid */}
                            <div style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={{...thStyle, width: '90px'}}>Date</th>
                                            <th style={{...thStyle}}>Particulars</th>
                                            <th style={{...thStyle, width: '110px'}}>Vch Type</th>
                                            <th style={{...thStyle, width: '100px'}}>Vch No.</th>
                                            <th style={{...thStyle, width: '120px', textAlign: 'right'}}>Debit (₹)</th>
                                            <th style={{...thStyle, width: '120px', textAlign: 'right'}}>Credit (₹)</th>
                                            <th style={{...thStyle, width: '140px', textAlign: 'center', borderRight: 'none', background: '#fef3c7', color: '#b45309'}}>Bank Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {brsData.transactions.length === 0 ? (
                                            <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No transactions to reconcile.</td></tr>
                                        ) : brsData.transactions.map((txn, idx) => (
                                            <tr key={txn.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={tdStyle}>{txn.date.split('-').reverse().join('-')}</td>
                                                <td style={{...tdStyle, fontWeight: 'bold', color: '#0f172a'}}>
                                                    {txn.voucherType}
                                                    {txn.narration && <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal', marginTop: '2px' }}>{txn.narration}</div>}
                                                </td>
                                                <td style={tdStyle}>{txn.voucherType}</td>
                                                <td style={tdStyle}>{txn.voucherNumber}</td>
                                                <td style={{...tdStyle, textAlign: 'right', color: '#1d4ed8'}}>{txn.dc === 'Dr' ? txn.amount.toLocaleString('en-IN', {minimumFractionDigits: 2}) : ''}</td>
                                                <td style={{...tdStyle, textAlign: 'right', color: '#b91c1c'}}>{txn.dc === 'Cr' ? txn.amount.toLocaleString('en-IN', {minimumFractionDigits: 2}) : ''}</td>
                                                <td style={{...tdStyle, borderRight: 'none', background: txn.clearanceDate ? '#dcfce7' : '#fef9c3', padding: '4px'}}>
                                                    <input 
                                                        type="date" 
                                                        value={txn.clearanceDate || ''} 
                                                        onChange={e => handleDateChange(txn.id, e.target.value)}
                                                        style={{...inputStyle, width: '100%', borderColor: txn.clearanceDate ? '#86efac' : '#fde047', background: 'transparent'}}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Right: BRS Summary Box */}
                            {summary && (
                                <div style={{ width: '320px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '16px', position: 'sticky', top: '16px' }}>
                                    <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#0f172a', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>Reconciliation Summary</h3>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                        <div style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Balance as per Company Books</div>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>{summary.companyBal.toLocaleString('en-IN', {minimumFractionDigits: 2})} {summary.companyBalType}</div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#b91c1c' }}>
                                        <div style={{ fontSize: '12px' }}>Amounts not reflected in Bank (Dr)</div>
                                        <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{summary.unreconciledDr.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', color: '#1d4ed8' }}>
                                        <div style={{ fontSize: '12px' }}>Amounts not reflected in Bank (Cr)</div>
                                        <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{summary.unreconciledCr.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
                                    </div>

                                    <div style={{ borderTop: '2px solid #0f172a', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                                        <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 'bold' }}>Balance as per Bank</div>
                                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}>{summary.bankBal.toLocaleString('en-IN', {minimumFractionDigits: 2})} {summary.bankBalType}</div>
                                    </div>
                                </div>
                            )}

                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
