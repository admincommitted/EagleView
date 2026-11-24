import React, { useState, useEffect, useCallback } from 'react';
import TonnageReport from '../components/FreightForwarding/TonnageReport';
import { BarChart2, Download, Filter, FileSpreadsheet, Anchor, TrendingUp, IndianRupee, Truck, Calendar, PieChart } from 'lucide-react';
import toast from 'react-hot-toast';

// 30-Oct-2026: four of the five reports on this screen were built from arrays under a comment that
// said "MOCK DATA FOR VARIOUS REPORTS" - invented jobs, invoices, vendor bills and collections -
// and Export Excel only printed a toast while Filters did nothing. Every report now comes from the
// vouchers and jobs in the database, the date range is a real filter, and Export writes the file.
const FY_START = () => { const d = new Date(); const y = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear(); return y + '-04-01'; };

export default function AdvancedReports() {
    // 30-Oct-2026: the Director Dashboard's "Investigate" button opens this page with
    // ?report=expenses&q=<job no>, so a loss-making job lands straight on its own expense lines.
    const initial = (() => {
        try {
            const p2 = new URLSearchParams(window.location.search);
            return { report: p2.get('report') || 'profitability', q: p2.get('q') || '' };
        } catch (e) { return { report: 'profitability', q: '' }; }
    })();
    const [activeReport, setActiveReport] = useState(initial.report);
    const [from, setFrom] = useState(FY_START);
    const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
    const [showFilters, setShowFilters] = useState(!!initial.q);
    const [clientFilter, setClientFilter] = useState(initial.q);
    const [minAmount, setMinAmount] = useState('');

    const [profitability, setProfitability] = useState([]);
    const [sales, setSales] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [collection, setCollection] = useState([]);
    const [meta, setMeta] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

    const load = useCallback(async () => {
        if (activeReport === 'tonnage') return;                     // that one is its own real report already
        setLoading(true); setError('');
        try {
            const q = 'from=' + from + '&to=' + to;
            if (activeReport === 'profitability') {
                const r = await fetch('/api/reports/mis?' + q, { headers: auth() });
                const j = await r.json().catch(() => ({}));
                if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
                setProfitability(j.jobs || []);
                setMeta({ ...j, kind: 'profitability' });
            } else if (activeReport === 'sales') {
                const r = await fetch('/api/vouchers/gst-returns?type=GSTR1&startDate=' + from + '&endDate=' + to, { headers: auth() });
                const j = await r.json().catch(() => ({}));
                if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
                setSales(j.data || []);
                setMeta({ totals: j.totals, withoutGstin: j.withoutGstin, kind: 'sales' });
            } else if (activeReport === 'expenses') {
                const r = await fetch('/api/reports/expenses?' + q, { headers: auth() });
                const j = await r.json().catch(() => ({}));
                if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
                setExpenses(j.data || []);
                setMeta({ ...j, kind: 'expenses' });
            } else if (activeReport === 'collection') {
                const r = await fetch('/api/reports/collection?' + q + '&asOn=' + to, { headers: auth() });
                const j = await r.json().catch(() => ({}));
                if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
                setCollection(j.data || []);
                setMeta({ ...j, kind: 'collection' });
            }
        } catch (err) {
            setError(err.message); setMeta({});
            if (activeReport === 'profitability') setProfitability([]);
            if (activeReport === 'sales') setSales([]);
            if (activeReport === 'expenses') setExpenses([]);
            if (activeReport === 'collection') setCollection([]);
        }
        setLoading(false);
    }, [activeReport, from, to]);

    useEffect(() => { load(); }, [load]);

    // the Filters box narrows whatever report is on screen
    const matches = (name, amount) => {
        if (clientFilter && !String(name || '').toLowerCase().includes(clientFilter.toLowerCase())) return false;
        if (minAmount && Math.abs(Number(amount) || 0) < Number(minAmount)) return false;
        return true;
    };
    const shownProfit = profitability.filter(r => matches(r.jobNo + ' ' + (r.lane || '') + ' ' + (r.mode || ''), r.revenue));
    const shownSales = sales.filter(r => matches(r.partyName + ' ' + r.voucherNumber, r.total));
    const shownExpenses = expenses.filter(r => matches(r.vendor + ' ' + r.head + ' ' + r.vr, r.amount));
    const shownCollection = collection.filter(r => matches(r.client, r.pending || r.billed));

    const handleExport = async () => {
        const XLSX = await import('xlsx');
        let rows = [], sheet = activeReport, file = activeReport;
        if (activeReport === 'profitability') {
            rows = shownProfit.map(r => ({ 'Job No': r.jobNo, Mode: r.mode || '', Lane: r.lane || '',
                'Revenue (INR)': r.revenue, 'Cost (INR)': r.cost, 'Profit (INR)': r.profit,
                'Margin %': r.revenue ? Math.round((r.profit / r.revenue) * 1000) / 10 : '' }));
            sheet = 'Job profitability';
        } else if (activeReport === 'sales') {
            rows = shownSales.map(r => ({ Date: r.date, 'Invoice No': r.voucherNumber, Client: r.partyName, GSTIN: r.gstin,
                'Taxable (INR)': r.taxable, CGST: r.cgst, SGST: r.sgst, IGST: r.igst, Cess: r.cess, 'Total (INR)': r.total,
                Narration: r.narration || '' }));
            sheet = 'Sales register';
        } else if (activeReport === 'expenses') {
            rows = shownExpenses.map(r => ({ Date: r.date, 'Voucher No': r.vr, Kind: r.voucherKind, Vendor: r.vendor,
                'Expense Head': r.head, Category: r.type, 'Job No': r.jobNo, 'Bill No': r.refNo, 'Amount (INR)': r.amount }));
            sheet = 'Expense register';
        } else if (activeReport === 'collection') {
            rows = shownCollection.map(r => ({ Client: r.client, 'Billed (INR)': r.billed, 'Collected (INR)': r.collected,
                'Pending (INR)': r.pending, 'Ageing bucket': r.bucket, 'Oldest overdue days': r.oldestOverdueDays ?? '',
                'Last follow-up': r.lastFollowUp, 'Next promise': r.nextPromise, Note: r.lastFollowUpNote }));
            sheet = 'Collection';
        } else {
            toast.error('Use the Export button inside the Tonnage report');
            return;
        }
        if (!rows.length) { toast.error('Nothing to export'); return; }
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheet.slice(0, 31));
        XLSX.writeFile(wb, file + '-' + from + '-to-' + to + '.xlsx');
    };

    const money = (n) => '₹ ' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

    const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
    const thStyle = { padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', borderBottom: '2px solid #e2e8f0', background: '#f8fafc' };
    const tdStyle = { padding: '12px 16px', fontSize: '13px', color: '#1e293b', borderBottom: '1px solid #f1f5f9' };
    const tabBtn = (id, icon, label) => (
        <button 
            onClick={() => setActiveReport(id)}
            style={{ 
                width: '100%', textAlign: 'left', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px',
                background: activeReport === id ? '#eff6ff' : 'transparent', border: 'none', 
                borderLeft: activeReport === id ? '3px solid #2563eb' : '3px solid transparent',
                color: activeReport === id ? '#1e3a8a' : '#475569', fontWeight: activeReport === id ? 'bold' : 'normal',
                cursor: 'pointer', borderRadius: '0 6px 6px 0', fontSize: '14px', marginBottom: '4px'
            }}>
            {icon} {label}
        </button>
    );

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#3b82f6', padding: '12px', borderRadius: '8px', color: '#fff' }}><BarChart2 size={24} /></div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 'bold' }}>Advanced Reports & Analytics</h2>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Tonnage, Profitability, Sales, and Collections</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {/* 30-Oct-2026: this dropdown used to set a variable nothing read. It moves the real dates now. */}
                    <select onChange={e => {
                        const v = e.target.value; const d = new Date(); const iso = (x) => x.toISOString().slice(0, 10);
                        if (v === 'today') { setFrom(iso(d)); setTo(iso(d)); }
                        else if (v === 'this_week') { const s2 = new Date(d); s2.setDate(d.getDate() - ((d.getDay() + 6) % 7)); setFrom(iso(s2)); setTo(iso(d)); }
                        else if (v === 'this_month') { setFrom(iso(new Date(d.getFullYear(), d.getMonth(), 1))); setTo(iso(d)); }
                        else if (v === 'this_quarter') { const q = Math.floor(d.getMonth() / 3) * 3; setFrom(iso(new Date(d.getFullYear(), q, 1))); setTo(iso(d)); }
                        else if (v === 'this_year') { setFrom(FY_START()); setTo(iso(d)); }
                    }} defaultValue="this_year" style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}>
                        <option value="today">Today</option>
                        <option value="this_week">This Week</option>
                        <option value="this_month">This Month</option>
                        <option value="this_quarter">This Quarter</option>
                        <option value="this_year">This Financial Year</option>
                        <option value="custom">Custom Range (use the dates)</option>
                    </select>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <button onClick={() => setShowFilters(v => !v)} style={{ padding: '8px 16px', background: showFilters ? '#0f172a' : '#f8fafc', color: showFilters ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><Filter size={16}/> Filters{clientFilter || minAmount ? ' (on)' : ''}</button>
                    <button onClick={handleExport} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><Download size={16}/> Export Excel</button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '24px' }}>
                
                {/* Sidebar Navigation */}
                <div style={{ ...cardStyle, padding: '16px 0' }}>
                    <div style={{ padding: '0 16px 12px', fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Operations</div>
                    {tabBtn('profitability', <TrendingUp size={18}/>, 'Shipment Profitability')}
                    {tabBtn('tonnage', <Anchor size={18}/>, 'Tonnage / Volume Report')}
                    
                    <div style={{ padding: '16px 16px 12px', fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Financials</div>
                    {tabBtn('sales', <FileSpreadsheet size={18}/>, 'Sales Register (Revenue)')}
                    {tabBtn('expenses', <PieChart size={18}/>, 'Expense Register')}
                    {tabBtn('collection', <IndianRupee size={18}/>, 'Collection & Outstanding')}
                </div>

                {/* Report Content */}
                <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, color: '#0f172a', textTransform: 'capitalize' }}>
                            {activeReport === 'profitability' && 'Shipment-wise Profitability (Job Costing)'}
                            {activeReport === 'tonnage' && 'Tonnage Report - Air Export'}
                            {activeReport === 'sales' && 'Sales Register (Invoice-wise)'}
                            {activeReport === 'expenses' && 'Expense & Purchase Register'}
                            {activeReport === 'collection' && 'Client-wise Collection & Outstanding'}
                        </h3>
                    </div>

                    {showFilters && activeReport !== 'tonnage' && (
                        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: 700, marginBottom: '4px' }}>Client / job / head contains</label>
                                <input type="text" value={clientFilter} onChange={e => setClientFilter(e.target.value)} placeholder="e.g. Maersk"
                                    style={{ padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', minWidth: '220px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: 700, marginBottom: '4px' }}>Minimum amount (&#8377;)</label>
                                <input type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="0"
                                    style={{ padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', width: '140px' }} />
                            </div>
                            <button onClick={() => { setClientFilter(''); setMinAmount(''); }}
                                style={{ padding: '7px 14px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>Clear</button>
                            <button onClick={load} style={{ padding: '7px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>Reload</button>
                        </div>
                    )}

                    {activeReport !== 'tonnage' && (loading || error || meta.note) && (
                        <div style={{ padding: '10px 20px', borderBottom: '1px solid #e2e8f0', fontSize: '12px',
                            background: error ? '#fef2f2' : '#f8fafc', color: error ? '#991b1b' : '#475569' }}>
                            {loading ? 'Loading...' : error ? error : meta.note}
                        </div>
                    )}

                    {activeReport === 'tonnage' ? <div style={{ padding: '12px' }}><TonnageReport embedded /></div> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                            
                            {/* PROFITABILITY REPORT */}
                            {activeReport === 'profitability' && (
                                <>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Job No.</th>
                                            <th style={thStyle}>Mode</th>
                                            <th style={thStyle}>Lane</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>Total Income (₹)</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>Total Expense (₹)</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>Net Profit (₹)</th>
                                            <th style={{...thStyle, textAlign: 'center'}}>Margin %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shownProfit.map((row) => {
                                            const m = row.revenue ? Math.round((row.profit / row.revenue) * 1000) / 10 : null;
                                            return (
                                                <tr key={row.jobNo}>
                                                    <td style={{...tdStyle, fontWeight: 'bold', color: '#2563eb'}}>{row.jobNo}</td>
                                                    <td style={tdStyle}>{row.mode || '\u2014'}</td>
                                                    <td style={tdStyle}>{row.lane || '\u2014'}</td>
                                                    <td style={{...tdStyle, textAlign: 'right', color: '#059669'}}>{money(row.revenue)}</td>
                                                    <td style={{...tdStyle, textAlign: 'right', color: '#dc2626'}}>{money(row.cost)}</td>
                                                    <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: row.profit < 0 ? '#dc2626' : '#0f172a'}}>{money(row.profit)}</td>
                                                    <td style={{...tdStyle, textAlign: 'center'}}>
                                                        {m == null ? <span style={{ color: '#94a3b8', fontSize: '11px' }}>no revenue booked</span> : (
                                                            <span style={{ background: m > 15 ? '#dcfce7' : m > 0 ? '#fef08a' : '#fee2e2', color: m > 15 ? '#166534' : m > 0 ? '#854d0e' : '#991b1b', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>{m}%</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {!shownProfit.length && !loading && (
                                            <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                                No job has both revenue and cost booked against its job number in this period. Put the job number on the sales and purchase vouchers to see it here.
                                            </td></tr>
                                        )}
                                        {meta.kind === 'profitability' && meta.unlinked && (meta.unlinked.salesWithoutJob || meta.unlinked.purchasesWithoutJob) ? (
                                            <tr><td colSpan={7} style={{ padding: '10px 16px', fontSize: '11px', color: '#b45309', background: '#fffbeb' }}>
                                                {meta.unlinked.salesWithoutJob} sales and {meta.unlinked.purchasesWithoutJob} purchase voucher(s) in this period carry no job number, so they are in none of the rows above.
                                            </td></tr>
                                        ) : null}
                                    </tbody>
                                </>
                            )}


                            {/* SALES REPORT */}
                            {activeReport === 'sales' && (
                                <>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Date</th>
                                            <th style={thStyle}>Invoice No.</th>
                                            <th style={thStyle}>Client</th>
                                            <th style={thStyle}>GSTIN</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>Taxable Value (₹)</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>GST Amt (₹)</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>Total Invoice (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shownSales.map((row) => {
                                            const gst = (row.cgst || 0) + (row.sgst || 0) + (row.igst || 0) + (row.cess || 0);
                                            return (
                                                <tr key={row.id}>
                                                    <td style={tdStyle}>{row.date ? row.date.split('-').reverse().join('-') : ''}</td>
                                                    <td style={{...tdStyle, fontWeight: 'bold', color: '#2563eb'}}>{row.voucherNumber}</td>
                                                    <td style={tdStyle}>{row.partyName || <span style={{ color: '#b45309' }}>no party ledger with a GSTIN on this voucher</span>}</td>
                                                    <td style={{...tdStyle, fontSize: '12px'}}>{row.gstin || '\u2014'}</td>
                                                    <td style={{...tdStyle, textAlign: 'right'}}>{money(row.taxable)}</td>
                                                    <td style={{...tdStyle, textAlign: 'right'}}>{gst ? money(gst) : <span style={{ color: '#94a3b8' }}>no tax line</span>}</td>
                                                    <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold'}}>{money(row.total)}</td>
                                                </tr>
                                            );
                                        })}
                                        {!shownSales.length && !loading && (
                                            <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>No sales voucher in this period.</td></tr>
                                        )}
                                        {meta.kind === 'sales' && meta.totals ? (
                                            <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                                                <td colSpan={4} style={{...tdStyle, textAlign: 'right'}}>Total</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>{money(meta.totals.taxable)}</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>{money(meta.totals.cgst + meta.totals.sgst + meta.totals.igst + meta.totals.cess)}</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>{money(meta.totals.total)}</td>
                                            </tr>
                                        ) : null}
                                    </tbody>
                                </>
                            )}

                            {/* EXPENSES REPORT */}
                            {activeReport === 'expenses' && (
                                <>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Date</th>
                                            <th style={thStyle}>Voucher No.</th>
                                            <th style={thStyle}>Vendor / Supplier</th>
                                            <th style={thStyle}>Expense Head</th>
                                            <th style={thStyle}>Category</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>Amount (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shownExpenses.map((row, i) => (
                                            <tr key={row.vr + '-' + row.head + '-' + i}>
                                                <td style={tdStyle}>{row.date ? row.date.split('-').reverse().join('-') : ''}</td>
                                                <td style={{...tdStyle, fontWeight: 'bold', color: '#dc2626'}}>
                                                    {row.vr}
                                                    {row.jobNo ? <div style={{ fontSize: '10px', color: '#94a3b8' }}>job {row.jobNo}</div> : null}
                                                </td>
                                                <td style={tdStyle}>{row.vendor || '\u2014'}</td>
                                                <td style={tdStyle}>{row.head}</td>
                                                <td style={tdStyle}><span style={{ padding: '2px 8px', background: /direct/i.test(row.type) ? '#f1f5f9' : /overhead/i.test(row.type) ? '#fff7ed' : '#fef9c3', color: /direct/i.test(row.type) ? '#475569' : /overhead/i.test(row.type) ? '#c2410c' : '#854d0e', borderRadius: '4px', fontSize: '11px' }}>{row.type}</span></td>
                                                <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold'}}>{money(row.amount)}</td>
                                            </tr>
                                        ))}
                                        {!shownExpenses.length && !loading && (
                                            <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>No purchase or payment voucher with an expense head in this period.</td></tr>
                                        )}
                                        {meta.kind === 'expenses' && meta.totals ? (
                                            <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                                                <td colSpan={5} style={{...tdStyle, textAlign: 'right'}}>
                                                    Total &nbsp;&nbsp;<span style={{ fontWeight: 400, fontSize: '11px', color: '#64748b' }}>
                                                        direct {money(meta.totals.direct)} &middot; overhead {money(meta.totals.overhead)}
                                                        {meta.totals.ungrouped ? ' \u00b7 ungrouped ' + money(meta.totals.ungrouped) : ''}
                                                    </span>
                                                </td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>{money(meta.totals.all)}</td>
                                            </tr>
                                        ) : null}
                                    </tbody>
                                </>
                            )}

                            {/* COLLECTION REPORT */}
                            {activeReport === 'collection' && (
                                <>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Client Name</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>Billed in period (₹)</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>Collected (₹)</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>Pending Due (₹)</th>
                                            <th style={thStyle}>Ageing Bucket</th>
                                            <th style={thStyle}>Last Follow-Up</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shownCollection.map((row) => {
                                            const cleared = /Cleared|Within/.test(row.bucket);
                                            const bad = /90|61/.test(row.bucket);
                                            return (
                                                <tr key={row.ledgerId}>
                                                    <td style={{...tdStyle, fontWeight: 'bold'}}>{row.client}</td>
                                                    <td style={{...tdStyle, textAlign: 'right'}}>{money(row.billed)}</td>
                                                    <td style={{...tdStyle, textAlign: 'right', color: '#10b981'}}>{money(row.collected)}</td>
                                                    <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: row.pending > 0 ? '#dc2626' : '#94a3b8'}}>{money(row.pending)}</td>
                                                    <td style={tdStyle}>
                                                        <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: cleared ? '#dcfce7' : bad ? '#fef2f2' : '#fef08a', color: cleared ? '#166534' : bad ? '#991b1b' : '#854d0e' }}>
                                                            {row.bucket}
                                                        </span>
                                                    </td>
                                                    <td style={{...tdStyle, color: '#64748b', fontSize: '12px'}}>
                                                        {row.lastFollowUp ? (
                                                            <>
                                                                {row.lastFollowUp.split('-').reverse().join('-')}
                                                                {row.nextPromise ? <div style={{ color: '#b45309' }}>promised {row.nextPromise.split('-').reverse().join('-')}</div> : null}
                                                                {row.lastFollowUpNote ? <div style={{ color: '#94a3b8', fontSize: '11px' }}>{row.lastFollowUpNote}</div> : null}
                                                            </>
                                                        ) : row.pending > 0 ? <span style={{ color: '#b45309' }}>never followed up</span> : '\u2014'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {!shownCollection.length && !loading && (
                                            <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>No customer billed, paid or outstanding in this period.</td></tr>
                                        )}
                                        {meta.kind === 'collection' && meta.totals ? (
                                            <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                                                <td style={{...tdStyle}}>Total</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>{money(meta.totals.billed)}</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>{money(meta.totals.collected)}</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>{money(meta.totals.pending)}</td>
                                                <td colSpan={2} style={{...tdStyle, fontWeight: 400, fontSize: '11px', color: '#b45309'}}>
                                                    {meta.totals.clientsWithNoFollowUp ? meta.totals.clientsWithNoFollowUp + ' customer(s) owe money with no follow-up logged' : ''}
                                                </td>
                                            </tr>
                                        ) : null}
                                    </tbody>
                                </>
                            )}

                        </table>
                    </div>
                    )}
                </div>

            </div>
        </div>
    );
}
