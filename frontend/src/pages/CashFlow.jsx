import React, { useState, useEffect, useCallback } from 'react';
import { Printer, Download, Mail, Activity, ChevronRight, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

// 30-Oct-2026: this screen used to print a Cash Flow Statement built from a hardcoded array
// (4,50,000 operating / -2,00,000 investing / 1,00,000 financing) after a fake 500 ms delay.
// Anyone could print it and hand it over. It now comes from /api/vouchers/cash-flow, which
// reads the actual cash and bank ledger movements, and the opening + net = closing check is
// printed with it so the statement can be verified instead of trusted.
export default function CashFlow() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [meta, setMeta] = useState(null);
    const [error, setError] = useState('');
    const today = new Date().toISOString().slice(0, 10);
    const [from, setFrom] = useState(() => {
        const d = new Date(); const y = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
        return y + '-04-01';                      // Indian financial year
    });
    const [to, setTo] = useState(today);

    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const r = await fetch('/api/vouchers/cash-flow?from=' + from + '&to=' + to, { headers: auth() });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            setData(j.data || []);
            setMeta(j);
        } catch (err) {
            setData([]); setMeta(null);
            setError(err.message);
        }
        setLoading(false);
    }, [from, to]);

    useEffect(() => { load(); }, [load]);

    const exportExcel = async () => {
        if (!data.length) { toast.error('Nothing to export'); return; }
        const XLSX = await import('xlsx');
        const rows = [];
        data.forEach(g => {
            rows.push({ Particulars: g.name, 'Amount (INR)': g.amount });
            (g.children || []).forEach(c => rows.push({ Particulars: '    ' + c.name, 'Amount (INR)': c.amount }));
        });
        rows.push({ Particulars: 'Net Cash Flow', 'Amount (INR)': meta ? meta.net : 0 });
        if (meta) {
            rows.push({ Particulars: 'Opening cash / bank', 'Amount (INR)': meta.opening });
            rows.push({ Particulars: 'Closing cash / bank', 'Amount (INR)': meta.closing });
        }
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 52 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Cash Flow');
        XLSX.writeFile(wb, 'cash-flow-' + from + '-to-' + to + '.xlsx');
    };

    const handlePrint = () => window.print();

    const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: '12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', background: '#dbeafe', color: '#0369a1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' };
    const actionBtnStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', fontWeight: '600', color: '#334155', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };

    const netCashFlow = meta ? meta.net : data.reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="report-container" style={{ padding: '16px', width: '100%', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
            <style>{`
                @media print { body * { visibility: hidden; } .printable-area, .printable-area * { visibility: visible; } .printable-area { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }
                .action-btn:hover { background: #f1f5f9 !important; border-color: #94a3b8 !important; }
                .table-row-hover:hover { background: #f1f5f9 !important; }
            `}</style>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#0ea5e9', padding: '8px', borderRadius: '6px', color: '#fff' }}>
                        <Activity size={20} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '700', letterSpacing: '-0.5px' }}>Cash Flow Statement</h2>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Inflows & Outflows</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...actionBtnStyle, cursor: 'text' }} />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>to</span>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...actionBtnStyle, cursor: 'text' }} />
                    <button className="action-btn" onClick={handlePrint} style={actionBtnStyle}><Printer size={14} /> Print</button>
                    <button className="action-btn" onClick={exportExcel} style={actionBtnStyle}><Download size={14} /> Export</button>
                </div>
            </div>

            <div style={{ border: '1px solid #94a3b8', borderRadius: '6px', background: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                <div className="printable-area" style={{ minHeight: '500px', background: '#f8fafc', padding: '16px' }}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: '#0ea5e9' }}>Loading Cash Flow...</div>
                    ) : error ? (
                        <div style={{ padding: '40px', textAlign: 'center', fontSize: '14px', color: '#b91c1c' }}>
                            Could not build the statement: {error}
                        </div>
                    ) : (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ padding: '16px 20px', borderBottom: '2px solid #0f172a' }}>
                                <h1 style={{ margin: 0, fontSize: '20px', color: '#0f172a', fontWeight: 'bold' }}>Cash Flow Statement</h1>
                                <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                                    For the period {from.split('-').reverse().join('-')} to {to.split('-').reverse().join('-')}
                                </div>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{...thStyle}}>Particulars</th>
                                        <th style={{...thStyle, width: '180px', textAlign: 'right', borderRight: 'none'}}>Amount (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map(group => (
                                        <React.Fragment key={group.id}>
                                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{ padding: '8px 12px', fontWeight: '700', color: '#0f172a', fontSize: '13px' }}>{group.name}</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px', color: group.amount < 0 ? '#dc2626' : '#16a34a' }}>
                                                    {group.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                                                </td>
                                            </tr>
                                            {group.children.map(item => (
                                                <tr key={item.id} className="table-row-hover" style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                    <td style={{ padding: '8px 12px', paddingLeft: '32px', fontSize: '13px', color: '#475569' }}>{item.name}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: item.amount < 0 ? '#ef4444' : '#22c55e' }}>
                                                        {item.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                            {!data.length && (
                                <div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                    No cash or bank movement in this period.{meta && meta.note ? ' ' + meta.note : ''}
                                </div>
                            )}
                            <div style={{ display: 'flex', background: '#dbeafe', borderTop: '2px solid #0369a1' }}>
                                <div style={{ flex: 1, padding: '12px 12px', fontWeight: '800', color: '#0369a1', fontSize: '14px', textAlign: 'right', textTransform: 'uppercase' }}>Net Cash Flow :</div>
                                <div style={{ width: '180px', padding: '12px 12px', textAlign: 'right', fontWeight: 'bold', color: netCashFlow < 0 ? '#dc2626' : '#0f172a', fontSize: '15px' }}>
                                    {netCashFlow.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                                </div>
                            </div>
                            {meta && (
                                <div style={{ borderTop: '1px solid #e2e8f0', padding: '12px 16px', background: '#f8fafc', fontSize: '12px', color: '#475569' }}>
                                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                                        <span>Opening cash &amp; bank: <b>{meta.opening.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>
                                        <span>Net movement: <b>{meta.net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>
                                        <span>Closing cash &amp; bank: <b>{meta.closing.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>
                                        <span style={{ color: meta.check && meta.check.balances ? '#047857' : '#b91c1c', fontWeight: 700 }}>
                                            {meta.check && meta.check.balances ? 'Opening + net = closing \u2713' : 'Opening + net does NOT equal closing - do not file this'}
                                        </span>
                                    </div>
                                    {meta.cashLedgers && meta.cashLedgers.length > 0 && (
                                        <div style={{ marginTop: '6px' }}>From {meta.cashLedgers.length} cash / bank ledger(s): {meta.cashLedgers.join(', ')}</div>
                                    )}
                                    {meta.unclassified ? (
                                        <div style={{ marginTop: '6px', color: '#b45309' }}>
                                            {meta.unclassified.toLocaleString('en-IN')} could not be attributed to an activity - those vouchers have no contra ledger.
                                        </div>
                                    ) : null}
                                    {!meta.cashLedgers?.length && <div style={{ marginTop: '6px' }}>{meta.note}</div>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
