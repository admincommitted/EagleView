import React, { useState, useEffect, useCallback } from 'react';
import { Printer, Download, Mail, FileText, ChevronRight, ChevronDown, Plus, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

// 30-Oct-2026: this screen printed invented allocations (Mumbai Office 3,00,000, Delhi 2,00,000 ...) from a
// hardcoded array after a fake 500 ms delay, and the Add Category / Add Centre buttons did nothing. It now
// reads /api/accounting-masters/cost-centre-report, which totals the voucher lines actually tagged to each
// centre, and both buttons create real rows.
export default function CostCentres() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState({});
    const [meta, setMeta] = useState(null);
    const [error, setError] = useState('');
    const today = new Date().toISOString().slice(0, 10);
    const [from, setFrom] = useState(() => {
        const d = new Date(); const y = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
        return y + '-04-01';
    });
    const [to, setTo] = useState(today);
    const [categories, setCategories] = useState([]);

    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [rr, mr] = await Promise.all([
                fetch('/api/accounting-masters/cost-centre-report?from=' + from + '&to=' + to, { headers: auth() }),
                fetch('/api/accounting-masters/all', { headers: auth() }),
            ]);
            const rj = await rr.json().catch(() => ({}));
            const mj = await mr.json().catch(() => ({}));
            if (!rr.ok || rj.success === false) throw new Error(rj.error || ('HTTP ' + rr.status));
            setData(rj.data || []);
            setMeta(rj);
            setCategories(((mj && mj.data) || {}).costCategories || []);
            // open every category that has something in it, so the figures are visible without clicking
            const open = {};
            (rj.data || []).forEach(c => { if (c.children && c.children.length) open[c.id] = true; });
            setExpanded(open);
        } catch (err) {
            setData([]); setMeta(null); setError(err.message);
        }
        setLoading(false);
    }, [from, to]);

    useEffect(() => { load(); }, [load]);

    const addCategory = async () => {
        const name = window.prompt('New cost category name (e.g. Branches, Departments, Projects)');
        if (!name || !name.trim()) return;
        try {
            const r = await fetch('/api/accounting-masters/categories', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ name: name.trim() }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            toast.success('Category "' + name.trim() + '" created');
            await load();
        } catch (err) { toast.error('Not created: ' + err.message); }
    };

    const addCentre = async () => {
        if (!categories.length) { toast.error('Create a cost category first - a centre has to sit under one'); return; }
        const name = window.prompt('New cost centre name (e.g. Delhi Office)');
        if (!name || !name.trim()) return;
        const list = categories.map((c, i) => (i + 1) + '. ' + c.name).join('\n');
        const pick = window.prompt('Which category does it belong to?\n' + list + '\n\nType the number:', '1');
        const idx = parseInt(pick, 10);
        if (!(idx >= 1 && idx <= categories.length)) { toast.error('No category picked - nothing created'); return; }
        try {
            const r = await fetch('/api/accounting-masters/centres', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ name: name.trim(), categoryId: categories[idx - 1].id }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            toast.success('Centre "' + name.trim() + '" created under ' + categories[idx - 1].name);
            await load();
        } catch (err) { toast.error('Not created: ' + err.message); }
    };

    const exportExcel = async () => {
        if (!data.length) { toast.error('Nothing to export'); return; }
        const XLSX = await import('xlsx');
        const rows = [];
        const walk = (nodes, depth) => (nodes || []).forEach(n => {
            rows.push({ 'Category / Centre': '    '.repeat(depth) + n.name + (n.type === 'category' ? ' (Category)' : ''), 'Allocated (INR)': n.amount });
            walk(n.children, depth + 1);
        });
        walk(data, 0);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 48 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Cost Centres');
        XLSX.writeFile(wb, 'cost-centres-' + from + '-to-' + to + '.xlsx');
    };

    const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

    // sub-centres can nest under a centre; show them indented instead of hiding them
    const flatten = (nodes, depth) => (nodes || []).flatMap(n => [{ ...n, depth }, ...flatten(n.children, depth + 1)]);

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
                    <div style={{ background: '#8b5cf6', padding: '8px', borderRadius: '6px', color: '#fff' }}>
                        <Settings size={20} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '700', letterSpacing: '-0.5px' }}>Cost Centres</h2>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Category & Centre Management</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...actionBtnStyle, cursor: 'text' }} />
                    <span style={{ fontSize: '12px', color: '#64748b', alignSelf: 'center' }}>to</span>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...actionBtnStyle, cursor: 'text' }} />
                    <button className="action-btn" onClick={addCategory} style={{...actionBtnStyle, background: '#8b5cf6', color: '#fff', borderColor: '#7c3aed'}}><Plus size={14} /> Add Category</button>
                    <button className="action-btn" onClick={addCentre} style={{...actionBtnStyle, background: '#10b981', color: '#fff', borderColor: '#059669'}}><Plus size={14} /> Add Centre</button>
                    <button className="action-btn" onClick={exportExcel} style={actionBtnStyle}><Download size={14} /> Export</button>
                    <button className="action-btn" onClick={handlePrint} style={actionBtnStyle}><Printer size={14} /> Print</button>
                </div>
            </div>

            <div style={{ border: '1px solid #94a3b8', borderRadius: '6px', background: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                <div className="printable-area" style={{ minHeight: '500px', background: '#f8fafc', padding: '16px' }}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: '#8b5cf6' }}>Loading Cost Centres...</div>
                    ) : error ? (
                        <div style={{ padding: '40px', textAlign: 'center', fontSize: '14px', color: '#b91c1c' }}>Could not load: {error}</div>
                    ) : (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ padding: '16px 20px', borderBottom: '2px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                    <h1 style={{ margin: 0, fontSize: '20px', color: '#0f172a', fontWeight: 'bold' }}>Cost Centre Breakup</h1>
                                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                                        {from.split('-').reverse().join('-')} to {to.split('-').reverse().join('-')}
                                    </div>
                                </div>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{...thStyle}}>Cost Category / Centre Name</th>
                                        <th style={{...thStyle, width: '200px', textAlign: 'right', borderRight: 'none'}}>Allocated Amount (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map(cat => (
                                        <React.Fragment key={cat.id}>
                                            <tr className="table-row-hover" style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                                <td style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggleExpand(cat.id)}>
                                                    <span style={{ marginRight: '6px', color: '#8b5cf6' }}>
                                                        {expanded[cat.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </span>
                                                    <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '13px' }}>{cat.name} (Category)</span>
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>
                                                    {cat.amount ? cat.amount.toLocaleString('en-IN', {minimumFractionDigits:2}) : '-'}
                                                </td>
                                            </tr>
                                            {expanded[cat.id] && flatten(cat.children, 0).map(cc => (
                                                <tr key={cc.id} className="table-row-hover" style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                    <td style={{ padding: '8px 12px', paddingLeft: (36 + cc.depth * 18) + 'px', fontSize: '13px', color: '#475569', fontWeight: '500' }}>
                                                        {cc.name}
                                                    </td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', fontWeight: '500', color: cc.amount < 0 ? '#dc2626' : '#475569' }}>
                                                        {cc.amount ? cc.amount.toLocaleString('en-IN', {minimumFractionDigits:2}) : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                    {!data.length && (
                                        <tr><td colSpan={2} style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                            {meta && meta.note ? meta.note : 'No cost categories or centres yet.'}
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                            {meta && data.length > 0 && (
                                <div style={{ borderTop: '1px solid #e2e8f0', padding: '10px 16px', background: '#f8fafc', fontSize: '12px', color: '#475569' }}>
                                    {meta.counts.categories} categor{meta.counts.categories === 1 ? 'y' : 'ies'}, {meta.counts.centres} centre(s),
                                    {' '}{meta.counts.taggedLines} tagged voucher line(s).
                                    {meta.counts.untaggedLines ? (
                                        <span style={{ color: '#b45309' }}> {meta.counts.untaggedLines} line(s) in this period carry no cost centre, so they are in none of these figures.</span>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
