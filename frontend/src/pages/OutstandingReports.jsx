import React, { useState, useEffect } from 'react';
import { Download, Mail, Filter, Search, FileText, IndianRupee, PieChart, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function OutstandingReports() {
    const nav = useNavigate(); // 08-Nov-2026: open the GST invoice behind a bill
    const [reportType, setReportType] = useState('receivable'); // 'receivable' or 'payable'
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    
    // Future Ready: Ageing Buckets
    const [buckets, setBuckets] = useState({ notDue: 0, days30: 0, days60: 0, days90: 0, over90: 0 });

    useEffect(() => {
        fetchData(reportType);
    }, [reportType]);

    // 30-Oct-2026: this listed four invented parties ("ABC Logistics Ltd. / INV/2026/101 / Rs 45,000 / 8 days
    // overdue") that came from the code, not from the books - someone could have chased a customer over them.
    // It now reads the real ledgers under Sundry Debtors / Sundry Creditors.
    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };
    const today = new Date().toISOString().slice(0, 10);
    const [basis, setBasis] = useState('');
    const fetchData = async (type) => {
        setLoading(true);
        try {
            const r = await fetch(`/api/vouchers/outstanding?type=${type}&asOn=${today}`, { headers: auth() });
            const d = await r.json();
            if (!r.ok || d.success === false) throw new Error(d.error || ('HTTP ' + r.status));
            setData(Array.isArray(d.data) ? d.data : []);
            setBuckets(d.buckets || { notDue: 0, days30: 0, days60: 0, days90: 0, over90: 0 });
            setBasis(d.note || d.basis || '');
        } catch (e) {
            setData([]);
            setBuckets({ notDue: 0, days30: 0, days60: 0, days90: 0, over90: 0 });
            toast.error('Could not load outstanding: ' + e.message);
        }
        setLoading(false);
    };

    // the reminder used to say "sent via Email & SMS" without sending anything. It sends a real e-mail to the
    // party's ledger e-mail, and says plainly when the ledger has no e-mail on it.
    const handleSendReminder = async (row) => {
        const t = toast.loading('Sending reminder...');
        try {
            const lr = await fetch('/api/accounts/ledgers/' + row.ledgerId, { headers: auth() });
            const led = await lr.json().catch(() => ({}));
            const to = (led && (led.email || (led.data && led.data.email))) || '';
            if (!to) { toast.error(`No e-mail on the ledger "${row.party}" - add one in Masters > Ledgers`, { id: t }); return; }
            const money = (n) => '₹ ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const html = `<p>Dear ${row.party},</p><p>Our records show the following amount outstanding:</p>`
                + `<table border="1" cellpadding="6" cellspacing="0"><tr><th>Reference</th><th>Date</th><th>Due date</th><th>Amount</th><th>Pending</th></tr>`
                + `<tr><td>${row.refNo}</td><td>${row.date || '-'}</td><td>${row.dueDate || '-'}</td><td>${money(row.amount)}</td><td>${money(row.pending)}</td></tr></table>`
                + `<p>${row.overdueDays > 0 ? 'It is overdue by ' + row.overdueDays + ' day(s).' : ''} Please arrange payment.</p>`;
            const r = await fetch('/api/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ to, subject: `Payment reminder - ${row.refNo}`, html }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok || d.success === false) throw new Error(d.error || ('HTTP ' + r.status));
            toast.success('Reminder e-mailed to ' + to, { id: t });
        } catch (e) {
            toast.error('Could not send: ' + e.message, { id: t });
        }
    };

    // Export Excel: what is on the screen, as a real .xlsx
    const exportExcel = async () => {
        if (!data.length) { toast.error('Nothing to export'); return; }
        const XLSX = await import('xlsx');
        const rows = data.map(r => ({
            Party: r.party, Reference: r.refNo, Narration: r.narration || '', Date: r.date || '',
            'Due date': r.dueDate || '', Amount: r.amount, Pending: r.pending,
            'Overdue days': r.overdueDays > 0 ? r.overdueDays : 0,
            Bucket: r.overdueDays <= 0 ? 'Not due' : r.overdueDays <= 30 ? '1-30' : r.overdueDays <= 60 ? '31-60' : r.overdueDays <= 90 ? '61-90' : 'Over 90',
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), reportType === 'receivable' ? 'Receivable' : 'Payable');
        XLSX.writeFile(wb, `outstanding-${reportType}-${today}.xlsx`);
        toast.success(rows.length + ' row(s) exported');
    };

    const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
    const thStyle = { padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', borderBottom: '2px solid #e2e8f0', background: '#f8fafc' };
    const tdStyle = { padding: '12px 16px', fontSize: '13px', color: '#1e293b', borderBottom: '1px solid #f1f5f9' };

    const totalPending = data.reduce((acc, curr) => acc + curr.pending, 0);

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: reportType === 'receivable' ? '#10b981' : '#f59e0b', padding: '12px', borderRadius: '8px', color: '#fff' }}>
                        <IndianRupee size={24} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 'bold' }}>
                            {reportType === 'receivable' ? 'Accounts Receivable (A/R)' : 'Accounts Payable (A/P)'}
                        </h2>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Bill-by-Bill Outstanding & Ageing Analysis</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ background: '#f1f5f9', padding: '4px', borderRadius: '8px', display: 'flex' }}>
                        <button onClick={() => setReportType('receivable')} style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', background: reportType === 'receivable' ? '#10b981' : 'transparent', color: reportType === 'receivable' ? '#fff' : '#64748b' }}>
                            Receivables
                        </button>
                        <button onClick={() => setReportType('payable')} style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', background: reportType === 'payable' ? '#f59e0b' : 'transparent', color: reportType === 'payable' ? '#fff' : '#64748b' }}>
                            Payables
                        </button>
                    </div>
                    <button onClick={exportExcel} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                        <Download size={16}/> Export Excel
                    </button>
                </div>
            </div>

            {/* Ageing KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{...cardStyle, gridColumn: 'span 2', background: '#0f172a', color: '#fff', border: 'none'}}>
                    <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 'bold' }}>Total Outstanding</div>
                    <div style={{ fontSize: '32px', fontWeight: '900', marginTop: '8px' }}>₹ {totalPending.toLocaleString()}</div>
                    {basis ? <div style={{ fontSize: '10px', opacity: 0.85, marginTop: '4px' }} title="How the open items were worked out">{basis}</div> : null}
                    <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <PieChart size={14}/> Across {data.length} pending bills
                    </div>
                </div>
                <div style={{...cardStyle, borderTop: '4px solid #10b981'}}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>Not Due Yet</div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#166534', marginTop: '8px' }}>₹ {buckets.notDue.toLocaleString()}</div>
                </div>
                <div style={{...cardStyle, borderTop: '4px solid #facc15'}}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>0 - 30 Days</div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#ca8a04', marginTop: '8px' }}>₹ {buckets.days30.toLocaleString()}</div>
                </div>
                <div style={{...cardStyle, borderTop: '4px solid #f97316'}}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>31 - 60 Days</div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#c2410c', marginTop: '8px' }}>₹ {buckets.days60.toLocaleString()}</div>
                </div>
                <div style={{...cardStyle, borderTop: '4px solid #ef4444'}}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>&gt; 90 Days (Critical)</div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#b91c1c', marginTop: '8px' }}>₹ {buckets.over90.toLocaleString()}</div>
                </div>
            </div>

            {/* Data Table */}
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={18} color={reportType==='receivable'?'#10b981':'#f59e0b'}/> 
                        Bill-wise Outstanding Details
                    </h3>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '8px', color: '#94a3b8' }}/>
                        <input type="text" placeholder="Search Party or Inv No..." style={{ padding: '6px 10px 6px 30px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none', width: '250px' }} />
                    </div>
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Party Name</th>
                            <th style={thStyle}>Bill Ref No.</th>
                            <th style={thStyle}>Date & Due Date</th>
                            <th style={{...thStyle, textAlign: 'right'}}>Bill Amount (₹)</th>
                            <th style={{...thStyle, textAlign: 'right'}}>Pending (₹)</th>
                            <th style={{...thStyle, textAlign: 'center'}}>Ageing (Status)</th>
                            <th style={{...thStyle, textAlign: 'center'}}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading Advanced Outstanding Data...</td></tr>
                        ) : (
                            data.map(row => (
                                <tr key={row.id}>
                                    <td style={{...tdStyle, fontWeight: 'bold', color: '#0f172a'}}>{row.party}</td>
                                    <td style={tdStyle}>
                                        <div>{row.refNo}</div>
                                        {row.gst && row.voucherId && (
                                            <button onClick={() => nav('/accounts-hub?item=gst' + row.gst.kind + '&voucher=' + row.voucherId)} title={'Open GST invoice ' + row.gst.invoiceNo}
                                                style={{ marginTop: '4px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <FileText size={11}/> Invoice{row.gst.irn ? ' · IRN' : ''}
                                            </button>
                                        )}
                                    </td>
                                    <td style={tdStyle}>
                                        <div>{row.date}</div>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Due: {row.dueDate}</div>
                                    </td>
                                    <td style={{...tdStyle, textAlign: 'right'}}>{row.amount.toLocaleString()}</td>
                                    <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: reportType==='receivable'?'#059669':'#ea580c'}}>{row.pending.toLocaleString()}</td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>
                                        {row.overdueDays <= 0 ? (
                                            <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: '#dcfce7', color: '#166534', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12}/> Not Due</span>
                                        ) : (
                                            <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: row.overdueDays > 90 ? '#fee2e2' : '#fef08a', color: row.overdueDays > 90 ? '#991b1b' : '#854d0e', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <AlertTriangle size={12}/> Overdue by {row.overdueDays} days
                                            </span>
                                        )}
                                    </td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>
                                        {reportType === 'receivable' && row.overdueDays > 0 && (
                                            <button onClick={() => handleSendReminder(row)} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <Mail size={12}/> Send Reminder
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
}
