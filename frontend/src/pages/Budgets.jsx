import React, { useState, useEffect, useCallback } from 'react';
import { Printer, Download, Plus, Target, PieChart, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

// 30-Oct-2026: this screen showed four invented budgets ("Marketing Budget 2023 - 5,00,000 / utilised
// 3,50,000") from a hardcoded array after a fake 500 ms delay, under a heading that said FY 2023-2024,
// and Create Budget did nothing. Budgets are real rows now, and utilisation is computed from the
// vouchers against each budget's own ledger / group / cost centre inside its own dates.
export default function Budgets() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [meta, setMeta] = useState(null);
    const [error, setError] = useState('');
    const [targets, setTargets] = useState({ groups: [], ledgers: [], costCentres: [] });
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const fyFrom = (() => { const d = new Date(); const y = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear(); return y + '-04-01'; })();
    const fyTo = (() => { const d = new Date(); const y = d.getMonth() < 3 ? d.getFullYear() : d.getFullYear() + 1; return y + '-03-31'; })();
    const [form, setForm] = useState({ name: '', basis: 'LEDGER', targetId: '', fromDate: fyFrom, toDate: fyTo, allocated: '', warnAtPct: 80, notes: '' });

    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [r, tr] = await Promise.all([
                fetch('/api/budgets', { headers: auth() }),
                fetch('/api/budgets/targets', { headers: auth() }),
            ]);
            const j = await r.json().catch(() => ({}));
            const tj = await tr.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            setData(j.data || []);
            setMeta(j);
            setTargets({ groups: tj.groups || [], ledgers: tj.ledgers || [], costCentres: tj.costCentres || [] });
        } catch (err) {
            setData([]); setMeta(null); setError(err.message);
        }
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const targetList = form.basis === 'GROUP' ? targets.groups : form.basis === 'COST_CENTRE' ? targets.costCentres : targets.ledgers;

    const save = async () => {
        setSaving(true);
        try {
            const r = await fetch('/api/budgets', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() }, body: JSON.stringify(form),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            toast.success('Budget created');
            setShowForm(false);
            setForm({ name: '', basis: 'LEDGER', targetId: '', fromDate: fyFrom, toDate: fyTo, allocated: '', warnAtPct: 80, notes: '' });
            await load();
        } catch (err) { toast.error('Not created: ' + err.message); }
        setSaving(false);
    };

    const remove = async (b) => {
        if (!window.confirm('Delete the budget "' + b.name + '"? The vouchers it measured are not touched.')) return;
        try {
            const r = await fetch('/api/budgets/' + b.id, { method: 'DELETE', headers: auth() });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            toast.success('Deleted');
            await load();
        } catch (err) { toast.error(err.message); }
    };

    const exportExcel = async () => {
        if (!data.length) { toast.error('Nothing to export'); return; }
        const XLSX = await import('xlsx');
        const rows = data.map(b => ({
            Budget: b.name, 'Set against': b.basis.replace('_', ' ') + ': ' + b.target,
            From: b.fromDate, To: b.toDate, 'Allocated (INR)': b.allocated, 'Utilised (INR)': b.utilized,
            'Variance (INR)': b.variance, 'Utilised %': b.utilisedPct ?? '', Status: b.state,
            'Voucher lines counted': b.voucherLines, Notes: b.notes,
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 28 }, { wch: 34 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Budgets');
        XLSX.writeFile(wb, 'budgets-' + new Date().toISOString().slice(0, 10) + '.xlsx');
    };

    const handlePrint = () => window.print();

    const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: '12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', background: '#dbeafe', color: '#0369a1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' };
    const actionBtnStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', fontWeight: '600', color: '#334155', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };

    return (
        <div className="report-container" style={{ padding: '16px', width: '100%', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
            <style>{`
                @media print { body * { visibility: hidden; } .printable-area, .printable-area * { visibility: visible; } .printable-area { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }
                .action-btn:hover { background: #f1f5f9 !important; border-color: #94a3b8 !important; }
                .table-row-hover:hover { background: #f1f5f9 !important; }
            `}</style>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#f59e0b', padding: '8px', borderRadius: '6px', color: '#fff' }}>
                        <Target size={20} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '700', letterSpacing: '-0.5px' }}>Budgets & Variance</h2>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Budget Allocation and Utilization</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="action-btn" onClick={() => setShowForm(v => !v)} style={{...actionBtnStyle, background: '#f59e0b', color: '#fff', borderColor: '#d97706'}}><Plus size={14} /> {showForm ? 'Cancel' : 'Create Budget'}</button>
                    <button className="action-btn" onClick={exportExcel} style={actionBtnStyle}><Download size={14} /> Export</button>
                    <button className="action-btn" onClick={handlePrint} style={actionBtnStyle}><Printer size={14} /> Print</button>
                </div>
            </div>

            {showForm && (
                <div className="no-print" style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e', marginBottom: '12px' }}>
                        New budget &mdash; it has to be set against something the ledger can total, so that &quot;utilised&quot; is a real number
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Budget name</label>
                            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Office overheads FY 26-27"
                                style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Set against</label>
                            <select value={form.basis} onChange={e => setForm({ ...form, basis: e.target.value, targetId: '' })}
                                style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}>
                                <option value="LEDGER">One ledger</option>
                                <option value="GROUP">A whole account group</option>
                                <option value="COST_CENTRE">A cost centre</option>
                            </select>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Which one</label>
                            <select value={form.targetId} onChange={e => setForm({ ...form, targetId: e.target.value })}
                                style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}>
                                <option value="">-- pick one --</option>
                                {targetList.map(t => <option key={t.id} value={t.id}>{t.name}{t.group ? '  (' + t.group + ')' : ''}{t.nature ? '  [' + t.nature + ']' : ''}</option>)}
                            </select>
                            {!targetList.length && <div style={{ fontSize: '11px', color: '#b45309', marginTop: '4px' }}>Nothing to pick yet - create it in Chart of Accounts / Cost Centres first.</div>}
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>From</label>
                            <input type="date" value={form.fromDate} onChange={e => setForm({ ...form, fromDate: e.target.value })}
                                style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>To</label>
                            <input type="date" value={form.toDate} onChange={e => setForm({ ...form, toDate: e.target.value })}
                                style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Allocated (&#8377;)</label>
                            <input type="number" value={form.allocated} onChange={e => setForm({ ...form, allocated: e.target.value })} placeholder="0.00"
                                style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Warn at (%)</label>
                            <input type="number" min="1" max="200" value={form.warnAtPct} onChange={e => setForm({ ...form, warnAtPct: e.target.value })}
                                style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }} />
                        </div>
                    </div>
                    <button onClick={save} disabled={saving} style={{ padding: '8px 18px', background: saving ? '#94a3b8' : '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 700, fontSize: '13px', cursor: saving ? 'wait' : 'pointer' }}>
                        {saving ? 'Saving...' : 'Create budget'}
                    </button>
                </div>
            )}

            <div style={{ border: '1px solid #94a3b8', borderRadius: '6px', background: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                <div className="printable-area" style={{ minHeight: '500px', background: '#f8fafc', padding: '16px' }}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: '#f59e0b' }}>Loading Budgets...</div>
                    ) : error ? (
                        <div style={{ padding: '40px', textAlign: 'center', fontSize: '14px', color: '#b91c1c' }}>Could not load: {error}</div>
                    ) : (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ padding: '16px 20px', borderBottom: '2px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                    <h1 style={{ margin: 0, fontSize: '20px', color: '#0f172a', fontWeight: 'bold' }}>Budget Analysis</h1>
                                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                                        {data.length ? data.length + ' budget(s)' : 'No budget created yet'}
                                        {meta && meta.totals ? ' \u00b7 allocated \u20b9 ' + meta.totals.allocated.toLocaleString('en-IN') + ' \u00b7 utilised \u20b9 ' + meta.totals.utilized.toLocaleString('en-IN') : ''}
                                        {meta && meta.totals && meta.totals.overBudget ? ' \u00b7 ' + meta.totals.overBudget + ' over budget' : ''}
                                    </div>
                                </div>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{...thStyle}}>Budget Name</th>
                                        <th style={{...thStyle, width: '220px'}}>Set against / period</th>
                                        <th style={{...thStyle, width: '150px', textAlign: 'right'}}>Allocated (₹)</th>
                                        <th style={{...thStyle, width: '150px', textAlign: 'right'}}>Utilized (₹)</th>
                                        <th style={{...thStyle, width: '150px', textAlign: 'right'}}>Variance (₹)</th>
                                        <th style={{...thStyle, width: '130px', textAlign: 'center'}}>Status</th>
                                        <th style={{...thStyle, width: '50px', textAlign: 'center', borderRight: 'none'}}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map(item => {
                                        const isOver = item.variance < 0;
                                        const near = item.state === 'Near the limit';
                                        return (
                                            <tr key={item.id} className="table-row-hover" style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{ padding: '8px 12px', fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>
                                                    {item.name}
                                                    {item.notes ? <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>{item.notes}</div> : null}
                                                </td>
                                                <td style={{ padding: '8px 12px', fontSize: '12px', color: '#475569' }}>
                                                    <div>{item.basis.replace('_', ' ').toLowerCase()}: <b>{item.target}</b></div>
                                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                        {item.fromDate.split('-').reverse().join('-')} to {item.toDate.split('-').reverse().join('-')}
                                                        {' \u00b7 '}{item.voucherLines} voucher line(s)
                                                    </div>
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#475569' }}>
                                                    {item.allocated.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#475569' }}>
                                                    {item.utilized.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', fontWeight: 'bold', color: isOver ? '#dc2626' : '#16a34a' }}>
                                                    {Math.abs(item.variance).toLocaleString('en-IN', {minimumFractionDigits: 2})} {isOver ? '(Over)' : ''}
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px' }}>
                                                    <div style={{ background: isOver ? '#fee2e2' : near ? '#fef3c7' : item.utilisedPct == null ? '#f1f5f9' : '#dcfce7',
                                                        color: isOver ? '#991b1b' : near ? '#92400e' : item.utilisedPct == null ? '#64748b' : '#166534',
                                                        padding: '2px 6px', borderRadius: '12px', fontWeight: 'bold' }}>
                                                        {item.utilisedPct == null ? 'no allocation' : item.utilisedPct + '%'}
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{item.state}</div>
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                    <button onClick={() => remove(item)} title="Delete this budget" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14}/></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {!data.length && (
                                        <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                            {meta && meta.note ? meta.note : 'No budget created yet.'}
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                            {meta && data.length > 0 && (
                                <div style={{ borderTop: '1px solid #e2e8f0', padding: '10px 16px', background: '#f8fafc', fontSize: '11px', color: '#64748b' }}>
                                    {meta.note}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
