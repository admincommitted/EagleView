import React, { useState, useEffect } from 'react';
import { FileUp, Send, CheckCircle, Search, AlertCircle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function JobExpenseRequest() {
    const [requestData, setRequestData] = useState({
        jobNo: '',
        vendor: '',
        expenseHead: '',
        amount: '',
        currency: 'INR',
        reimbursable: true,
        urgency: 'Normal',
        narration: '',
    });

    const [file, setFile] = useState(null);

    // 30-Oct-2026: the "recent requests" were two invented rows (REQ-1021 / Icegate / Rs 1,50,000) and Submit only
    // showed "submitted successfully for approval" without creating anything - the manager's approvals screen never
    // saw it. A request is a Pending purchase voucher now, which is exactly what Manager Expense Approvals lists.
    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };
    const [recentRequests, setRecentRequests] = useState([]);
    const [payees, setPayees] = useState([]);       // creditor ledgers
    const [heads, setHeads] = useState([]);         // expense ledgers
    const [vTypes, setVTypes] = useState([]);
    const [busy, setBusy] = useState(false);

    const loadAll = React.useCallback(async () => {
        try {
            const [lr, mr, vr] = await Promise.all([
                fetch('/api/accounts/tree', { headers: auth() }),
                fetch('/api/accounting-masters/all', { headers: auth() }),
                fetch('/api/vouchers/pending-approvals', { headers: auth() }),
            ]);
            const ld = await lr.json().catch(() => ({}));
            const flat = [];
            (function walk(ns, g) { (ns || []).forEach(n => {
                if (n.type === 'ledger') flat.push({ id: n.id, name: n.name, group: n.groupName || g || '' });
                if (n.children) walk(n.children, n.type === 'group' ? n.name : g);
            }); })(ld.data || [], '');
            setPayees(flat.filter(l => /creditor|payable/i.test(String(l.group || ''))));
            setHeads(flat.filter(l => /expense|purchase/i.test(String(l.group || ''))));
            const md = await mr.json().catch(() => ({}));
            setVTypes(((md.data || {}).voucherTypes) || []);
            const vd = await vr.json().catch(() => ({}));
            setRecentRequests((Array.isArray(vd.data) ? vd.data : []).slice(0, 10).map(v => ({
                id: v.voucherNumber, job: (String(v.narration || '').match(/Job\s+([^|]+)/) || [])[1] || '',
                head: (v.details || []).filter(d => d.dc === 'Dr').map(d => (d.ledger && d.ledger.name) || '').join(', '),
                vendor: (v.details || []).filter(d => d.dc === 'Cr').map(d => (d.ledger && d.ledger.name) || '').join(', '),
                amount: parseFloat(v.totalAmount) || 0, status: v.status === 'Pending' ? 'Pending Approval' : v.status, date: v.date,
            })));
        } catch (e) {
            setPayees([]); setHeads([]); setRecentRequests([]);
            toast.error('Could not load the masters: ' + e.message);
        }
    }, []);
    useEffect(() => { loadAll(); }, [loadAll]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!requestData.jobNo || !requestData.amount || !requestData.vendor) {
            toast.error("Job No, Vendor, and Amount are mandatory.");
            return;
        }
        if (!requestData.expenseHead) { toast.error('Pick the expense head (ledger)'); return; }
        const type = vTypes.find(t => String(t.baseType) === 'Purchase') || vTypes.find(t => String(t.baseType) === 'Journal');
        if (!type) { toast.error('No Purchase / Journal voucher type - add one in Masters > Voucher Types'); return; }
        const amount = parseFloat(requestData.amount) || 0;
        if (amount <= 0) { toast.error('Enter an amount more than 0'); return; }

        setBusy(true);
        const t = toast.loading('Submitting the request...');
        try {
            let voucherNumber = '';
            try {
                const nr = await fetch('/api/vouchers/next-number/' + type.id, { headers: auth() });
                const nd = await nr.json(); if (nd && nd.nextNumber) voucherNumber = nd.nextNumber;
            } catch (err) { /* fall back below */ }
            if (!voucherNumber) voucherNumber = 'REQ/' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '/' + Date.now().toString().slice(-4);
            const r = await fetch('/api/vouchers', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({
                    voucherTypeId: type.id, voucherNumber, date: new Date().toISOString().slice(0, 10), jobNo: requestData.jobNo || null,
                    narration: [`Expense request`, `Job ${requestData.jobNo}`, requestData.urgency && ('Urgency: ' + requestData.urgency), requestData.narration].filter(Boolean).join(' | '),
                    details: [
                        { ledgerId: requestData.expenseHead, dc: 'Dr', amount },
                        { ledgerId: requestData.vendor, dc: 'Cr', amount },
                    ],
                }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok || d.success === false) throw new Error(d.error || ('HTTP ' + r.status));
            toast.success('Request ' + voucherNumber + ' sent for approval', { id: t });
            setRequestData({ ...requestData, amount: '', narration: '' });
            setFile(null);
            loadAll();
        } catch (err) {
            toast.error('Could not submit: ' + err.message, { id: t });
        }
        setBusy(false);
    };

    const inputStyle = { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none', width: '100%', fontFamily: 'inherit' };
    const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' };
    const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: '12px', color: '#1e293b', borderBottom: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: '700' };
    const tdStyle = { padding: '12px 14px', borderBottom: '1px solid #e2e8f0', fontSize: '13px', color: '#334155' };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
            
            <div style={{ marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '22px', color: '#0f172a', fontWeight: '700' }}>Operations: Job Expense & Payment Request</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Request vendor payments or job expenses. Will be routed for approval automatically.</p>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                
                {/* Form Section */}
                <div style={{ flex: '1.5', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={18} color="#2563eb" />
                        <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>New Payment Requisition</h3>
                    </div>

                    <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div>
                                <label style={labelStyle}>Link to Job / Shipment No *</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
                                    <input 
                                        type="text" 
                                        placeholder="Search Job No. or AWB..." 
                                        style={{...inputStyle, paddingLeft: '32px', background: '#f0f9ff', border: '1px solid #bae6fd'}} 
                                        value={requestData.jobNo} 
                                        onChange={e => setRequestData({...requestData, jobNo: e.target.value})}
                                    />
                                </div>
                                <span style={{ fontSize: '10px', color: '#64748b' }}>Cost will be allocated to this job's P&L</span>
                            </div>
                            
                            <div>
                                <label style={labelStyle}>Vendor / Payee Name *</label>
                                <select style={inputStyle} value={requestData.vendor} onChange={e => setRequestData({...requestData, vendor: e.target.value})}>
                                    <option value="">{payees.length ? '-- Select Vendor --' : '-- No creditor ledgers yet --'}</option>
                                    {payees.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div>
                                <label style={labelStyle}>Expense Head</label>
                                <select style={inputStyle} value={requestData.expenseHead} onChange={e => setRequestData({...requestData, expenseHead: e.target.value})}>
                                    <option value="">{heads.length ? '-- Select Charge --' : '-- No expense ledgers yet --'}</option>
                                    {heads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Amount *</label>
                                <div style={{ display: 'flex' }}>
                                    <select 
                                        style={{...inputStyle, width: '80px', borderRadius: '4px 0 0 4px', borderRight: 'none', background: '#f8fafc'}}
                                        value={requestData.currency}
                                        onChange={e => setRequestData({...requestData, currency: e.target.value})}
                                    >
                                        <option value="INR">INR</option>
                                        <option value="USD">USD</option>
                                    </select>
                                    <input 
                                        type="number" 
                                        placeholder="0.00" 
                                        style={{...inputStyle, borderRadius: '0 4px 4px 0', fontWeight: 'bold'}} 
                                        value={requestData.amount} 
                                        onChange={e => setRequestData({...requestData, amount: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>Urgency</label>
                                <select style={inputStyle} value={requestData.urgency} onChange={e => setRequestData({...requestData, urgency: e.target.value})}>
                                    <option value="Normal">Normal</option>
                                    <option value="High">High (Immediate Payment)</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '6px', border: '1px dashed #4ade80', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <AlertCircle size={18} color="#16a34a" style={{ marginTop: '2px' }} />
                            <div>
                                <label style={{ fontSize: '13px', fontWeight: '600', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={requestData.reimbursable} 
                                        onChange={e => setRequestData({...requestData, reimbursable: e.target.checked})}
                                        style={{ transform: 'scale(1.2)' }}
                                    />
                                    Bill this to Customer (Reimbursable)
                                </label>
                                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#15803d' }}>
                                    If checked, system will warn Accounts to include this amount in the final Job Invoice to the client.
                                </p>
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>Upload Vendor Bill / Receipt</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <label style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <FileUp size={16} /> Choose File
                                    <input type="file" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0])} />
                                </label>
                                {file && <span style={{ fontSize: '12px', color: '#2563eb' }}>{file.name}</span>}
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={labelStyle}>Remarks / Narration</label>
                            <textarea 
                                rows="3" 
                                style={{...inputStyle, resize: 'vertical'}}
                                placeholder="Why is this payment needed?"
                                value={requestData.narration}
                                onChange={e => setRequestData({...requestData, narration: e.target.value})}
                            ></textarea>
                        </div>

                        <button type="submit" disabled={busy} style={{ width: '100%', padding: '12px', background: busy ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                            <Send size={18} /> Submit to Accounts for Approval
                        </button>
                    </form>
                </div>

                {/* Recent Status Section */}
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '8px 8px 0 0' }}>
                            <h3 style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>My Recent Requests</h3>
                        </div>
                        <div style={{ padding: '0', overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={thStyle}>Req No</th>
                                        <th style={thStyle}>Job No</th>
                                        <th style={{...thStyle, textAlign: 'right'}}>Amount</th>
                                        <th style={thStyle}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentRequests.map(req => (
                                        <tr key={req.id}>
                                            <td style={tdStyle}>{req.id}</td>
                                            <td style={{...tdStyle, color: '#2563eb', fontWeight: '500'}}>{req.job}</td>
                                            <td style={{...tdStyle, textAlign: 'right', fontWeight: '600'}}>₹{req.amount.toLocaleString('en-IN')}</td>
                                            <td style={tdStyle}>
                                                <span style={{ 
                                                    padding: '4px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                                                    background: req.status === 'Approved' ? '#dcfce7' : '#fef3c7',
                                                    color: req.status === 'Approved' ? '#166534' : '#92400e'
                                                }}>
                                                    {req.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ background: '#fff3cd', padding: '16px', borderRadius: '8px', border: '1px solid #ffe69c' }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#664d03', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertCircle size={16}/> Important Note</h4>
                        <p style={{ margin: 0, fontSize: '12px', color: '#664d03', lineHeight: '1.5' }}>
                            Only approved expenses will be processed for payment by accounts. Please upload valid vendor invoices for faster clearance. For High Urgency items, please inform the respective branch manager after submission.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}
