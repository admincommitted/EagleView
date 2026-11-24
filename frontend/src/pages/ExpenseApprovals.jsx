import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, CornerUpLeft, Search, Filter, ShieldCheck, Clock, FileText, AlertCircle, FileDigit } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ExpenseApprovals() {
    const [pendingVouchers, setPendingVouchers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedVoucher, setSelectedVoucher] = useState(null);
    const [remarks, setRemarks] = useState('');

    // 30-Oct-2026: this screen used to list four invented vouchers (John Doe / Jane Smith ...) and its Approve /
    // Reject buttons only showed a toast and removed the row - nothing was ever saved, so a manager believed a
    // payment was approved when it was not. It reads and writes the real vouchers now.
    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };
    const load = React.useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/vouchers/pending-approvals', { headers: auth() });
            const d = await r.json();
            if (!r.ok || d.success === false) throw new Error(d.error || ('HTTP ' + r.status));
            setPendingVouchers((Array.isArray(d.data) ? d.data : []).map(v => ({
                id: v.id,
                date: v.date,
                voucherNumber: v.voucherNumber,
                type: (v.voucherType && (v.voucherType.name || v.voucherType.baseType)) || '',
                amount: parseFloat(v.totalAmount) || 0,
                narration: v.narration || '',
                requestedBy: v.createdByName || (v.createdBy ? 'User #' + v.createdBy : ''),
                ledgers: (v.details || []).map(x => (x.ledger && x.ledger.name) || '').filter(Boolean),
            })));
        } catch (e) {
            setPendingVouchers([]);
            toast.error('Could not load pending vouchers: ' + e.message);
        }
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const handleAction = async (voucherId, action) => {
        if (!remarks && (action === 'Reject' || action === 'Return')) {
            toast.error(`Remarks are mandatory for ${action.toLowerCase()}ing a voucher.`);
            return;
        }
        const status = action === 'Approve' ? 'Approved' : action === 'Reject' ? 'Rejected' : 'Returned';
        const t = toast.loading(`Processing ${action}...`);
        try {
            const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch (e) { return {}; } })();
            const r = await fetch('/api/vouchers/update-status/' + voucherId, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ status, rejectionReason: remarks, userId: user.id }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok || d.success === false) throw new Error(d.error || ('HTTP ' + r.status));
            toast.success(`Voucher ${status.toLowerCase()}`, { id: t });
            setSelectedVoucher(null);
            setRemarks('');
            load();
        } catch (e) {
            toast.error('Could not ' + action.toLowerCase() + ': ' + e.message, { id: t });
        }
    };

    const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
    const thStyle = { padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', borderBottom: '2px solid #e2e8f0', background: '#f8fafc' };
    const tdStyle = { padding: '12px 16px', fontSize: '13px', color: '#1e293b', borderBottom: '1px solid #f1f5f9' };

    const totalPendingAmount = pendingVouchers.reduce((acc, curr) => acc + curr.amount, 0);
    const oldestDays = pendingVouchers.reduce((n, v) => { const d = v.date ? Math.floor((Date.now() - new Date(v.date)) / 86400000) : 0; return d > n ? d : n; }, 0);

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#8b5cf6', padding: '12px', borderRadius: '8px', color: '#fff' }}>
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 'bold' }}>Manager Expense Approvals</h2>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Review, Approve, or Return pending vouchers & expenses.</div>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
                <div style={{...cardStyle, borderLeft: '4px solid #8b5cf6'}}>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={16}/> Pending Approvals</div>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', marginTop: '8px' }}>{pendingVouchers.length}</div>
                </div>
                <div style={{...cardStyle, borderLeft: '4px solid #f59e0b'}}>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><FileDigit size={16}/> Total Value Pending</div>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', marginTop: '8px' }}>₹ {totalPendingAmount.toLocaleString()}</div>
                </div>
                <div style={{...cardStyle, borderLeft: '4px solid #ef4444'}}>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertCircle size={16}/> Waiting Longest</div>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#b91c1c', marginTop: '8px' }}>{oldestDays <= 0 ? '-' : oldestDays + ' d'}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selectedVoucher ? '2fr 1fr' : '1fr', gap: '24px' }}>
                
                {/* List View */}
                <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>Approval Queue</h3>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '8px', color: '#94a3b8' }}/>
                            <input type="text" placeholder="Search Voucher / Dept..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} style={{ padding: '6px 10px 6px 30px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none' }} />
                        </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Date & Voucher</th>
                                <th style={thStyle}>Narration & Dept</th>
                                <th style={{...thStyle, textAlign: 'right'}}>Amount (₹)</th>
                                <th style={{...thStyle, textAlign: 'center'}}>Waiting</th>
                                <th style={{...thStyle, textAlign: 'center'}}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingVouchers.filter(v => !searchTerm || [v.voucherNumber, v.narration, v.requestedBy, v.type].some(x => String(x || '').toLowerCase().includes(searchTerm.toLowerCase()))).map(row => (
                                <tr key={row.id} style={{ background: selectedVoucher?.id === row.id ? '#f0f9ff' : 'transparent' }}>
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: 'bold', color: '#0369a1' }}>{row.voucherNumber}</div>
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>{row.date}</div>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: '500', color: '#1e293b' }}>{row.narration}</div>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{[row.requestedBy && ('By: ' + row.requestedBy), row.type, (row.ledgers || []).join(', ')].filter(Boolean).join(' | ')}</div>
                                    </td>
                                    <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#0f172a'}}>{row.amount.toLocaleString()}</td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>
                                        {(() => {
                                            const d = row.date ? Math.floor((Date.now() - new Date(row.date)) / 86400000) : 0;
                                            const hot = d >= 7;
                                            return <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', background: hot ? '#fee2e2' : '#e2e8f0', color: hot ? '#991b1b' : '#475569' }}>{d <= 0 ? 'TODAY' : d + ' DAY' + (d === 1 ? '' : 'S')}</span>;
                                        })()}
                                    </td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>
                                        <button onClick={() => setSelectedVoucher(row)} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', color: '#0f172a' }}>Review</button>
                                    </td>
                                </tr>
                            ))}
                            {pendingVouchers.length === 0 && (
                                <tr>
                                    <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                        <CheckCircle size={48} color="#10b981" style={{ marginBottom: '16px', opacity: 0.5 }}/>
                                        <div>All caught up! No pending approvals.</div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Detail / Action Panel */}
                {selectedVoucher && (
                    <div style={{ ...cardStyle, borderTop: '4px solid #8b5cf6', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>Review Voucher: {selectedVoucher.voucherNumber}</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            <div><div style={{ fontSize: '11px', color: '#64748b' }}>Type</div><div style={{ fontWeight: 'bold' }}>{selectedVoucher.type}</div></div>
                            <div><div style={{ fontSize: '11px', color: '#64748b' }}>Amount</div><div style={{ fontWeight: 'bold', color: '#ea580c', fontSize: '16px' }}>₹ {selectedVoucher.amount.toLocaleString()}</div></div>
                            <div><div style={{ fontSize: '11px', color: '#64748b' }}>Requested By</div><div style={{ fontWeight: '500' }}>{selectedVoucher.requestedBy}</div></div>
                            <div><div style={{ fontSize: '11px', color: '#64748b' }}>Ledgers</div><div style={{ fontWeight: '500' }}>{(selectedVoucher.ledgers || []).join(', ') || '-'}</div></div>
                            <div style={{ gridColumn: 'span 2' }}><div style={{ fontSize: '11px', color: '#64748b' }}>Narration</div><div style={{ background: '#f8fafc', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', marginTop: '4px', fontSize: '13px' }}>{selectedVoucher.narration}</div></div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Manager Remarks (Required for Reject/Return)</label>
                            <textarea rows="3" value={remarks} onChange={e=>setRemarks(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' }} placeholder="Add your comments here..."></textarea>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto' }}>
                            <button onClick={() => handleAction(selectedVoucher.id, 'Approve')} style={{ padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <CheckCircle size={18}/> Approve Voucher
                            </button>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <button onClick={() => handleAction(selectedVoucher.id, 'Return')} style={{ padding: '10px', background: '#fff', color: '#ea580c', border: '1px solid #ea580c', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <CornerUpLeft size={16}/> Return to Maker
                                </button>
                                <button onClick={() => handleAction(selectedVoucher.id, 'Reject')} style={{ padding: '10px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <XCircle size={16}/> Reject
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
