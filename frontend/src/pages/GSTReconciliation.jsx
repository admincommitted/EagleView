import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, AlertOctagon, Info, FileText, Search, Download, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

// 30-Oct-2026: this screen never looked at the file. "Select JSON File & Start Match" ran a 2.5 second
// timer and then showed four invented rows (Delhivery, Maersk, CONCOR, a rent bill) with "145 matched",
// and the Filter / Export / Hold Payment / View buttons did nothing. Claiming ITC off that is a tax risk.
// It now uploads the real GSTR-2B JSON to /api/vouchers/gstr2b-match, which matches it against the
// Purchase vouchers in the books, and every button works.
export default function GSTReconciliation() {
    const [fileUploaded, setFileUploaded] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [summary, setSummary] = useState({ matched: 0, mismatched: 0, missingInBooks: 0, missingOnPortal: 0 });
    const [records, setRecords] = useState([]);
    const [meta, setMeta] = useState(null);
    const [error, setError] = useState('');
    const [exceptionsOnly, setExceptionsOnly] = useState(false);
    const [search, setSearch] = useState('');
    const [tolerance, setTolerance] = useState('1');
    const fileRef = useRef(null);

    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

    const runMatch = async (file) => {
        setAnalyzing(true); setError('');
        try {
            const fd = new FormData();
            fd.append('file', file);
            const r = await fetch('/api/vouchers/gstr2b-match?tolerance=' + encodeURIComponent(tolerance || '1'), {
                method: 'POST', headers: auth(), body: fd,
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            setRecords(j.records || []);
            setSummary(j.summary || {});
            setMeta(j);
            setFileUploaded(true);
            toast.success('Matched ' + (j.summary ? j.summary.matched : 0) + ' of ' + (j.summary ? j.summary.portalDocuments : 0) + ' portal documents');
        } catch (err) {
            setError(err.message);
            setFileUploaded(false);
            toast.error('Could not reconcile');
        }
        setAnalyzing(false);
        if (fileRef.current) fileRef.current.value = '';
    };

    const onPick = (e) => {
        const f = (e.target.files || [])[0];
        if (!f) return;
        if (!/\.json$/i.test(f.name)) { toast.error('That is not a .json file. Download the GSTR-2B JSON from the GST portal, not the Excel.'); return; }
        runMatch(f);
    };

    const shown = records.filter(r => {
        if (exceptionsOnly && r.status === 'Matched') return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return [r.vendor, r.invoice, r.gstin, r.id].some(v => String(v || '').toLowerCase().includes(q));
    });

    const exportExcel = async () => {
        if (!shown.length) { toast.error('Nothing to export'); return; }
        const XLSX = await import('xlsx');
        const rows = shown.map(r => ({
            Status: r.status, 'Match basis': r.matchedOn || '', Supplier: r.vendor, GSTIN: r.gstin,
            'Document type': r.docKind, 'Invoice / note no': r.invoice, 'Portal date': r.date, 'Books date': r.bookDate,
            'Voucher no': r.voucherId ? r.id : '', 'Portal value': r.portalAmt, 'Books value': r.bookAmt, Difference: r.diff,
            Taxable: r.taxable, IGST: r.igst, CGST: r.cgst, SGST: r.sgst, Cess: r.cess,
            'ITC available on portal': r.itcAvailable ? 'Yes' : 'No',
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 28 }, { wch: 17 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 10 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, 'GSTR-2B reconciliation');
        XLSX.writeFile(wb, 'gstr2b-reco-' + (meta && meta.period ? meta.period : new Date().toISOString().slice(0, 10)) + '.xlsx');
    };

    const openVoucher = (rec) => {
        if (!rec.voucherId) { toast.error('This document is not in the books, so there is no voucher to open'); return; }
        window.open('/vouchers?id=' + rec.voucherId, '_blank');
    };

    const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
    const thStyle = { padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' };
    const tdStyle = { padding: '12px', fontSize: '13px', color: '#1e293b', borderBottom: '1px solid #f1f5f9' };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#ec4899', padding: '12px', borderRadius: '8px', color: '#fff' }}><CheckCircle size={24} /></div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 'bold' }}>GSTR-2B Auto-Reconciliation</h2>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Match portal JSON with Purchase Register to secure Input Tax Credit (ITC)</div>
                    </div>
                </div>
            </div>

            {!fileUploaded ? (
                <div style={{...cardStyle, textAlign: 'center', padding: '60px 20px', border: '2px dashed #cbd5e1' }}>
                    <UploadCloud size={48} color="#94a3b8" style={{ margin: '0 auto 16px auto' }}/>
                    <h3 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>Upload GSTR-2B JSON</h3>
                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px auto' }}>Download the JSON file from the GST Portal for the current month and upload it here. System will auto-match with your Vendor Bills.</p>
                    <input ref={fileRef} type="file" accept=".json,application/json" onChange={onPick} style={{ display: 'none' }} />
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                        <label style={{ fontSize: '12px', color: '#64748b' }}>Match tolerance (&#8377;)</label>
                        <input type="number" min="0" step="1" value={tolerance} onChange={e => setTolerance(e.target.value)}
                            style={{ width: '80px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} />
                    </div>
                    <button onClick={() => fileRef.current && fileRef.current.click()} disabled={analyzing} style={{ padding: '12px 24px', background: '#ec4899', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '15px', cursor: analyzing ? 'wait' : 'pointer' }}>
                        {analyzing ? 'Reading the file and matching...' : 'Select JSON File & Start Match'}
                    </button>
                    {error && (
                        <div style={{ marginTop: '20px', maxWidth: '640px', marginLeft: 'auto', marginRight: 'auto', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '6px', padding: '12px 16px', fontSize: '13px', textAlign: 'left' }}>
                            {error}
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
                        <div style={{...cardStyle, borderLeft: '4px solid #10b981'}}>
                            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Perfect Match</div>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: '#166534' }}>{summary.matched}</div>
                            <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>Invoices claimable for ITC</div>
                        </div>
                        <div style={{...cardStyle, borderLeft: '4px solid #f59e0b'}}>
                            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Mismatched Amounts</div>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: '#92400e' }}>{summary.mismatched}</div>
                            <div style={{ fontSize: '11px', color: '#d97706', marginTop: '4px' }}>Values differ between Portal & Books</div>
                        </div>
                        <div style={{...cardStyle, borderLeft: '4px solid #ef4444'}}>
                            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Missing on Portal</div>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: '#991b1b' }}>{summary.missingOnPortal || 0}</div>
                            <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>In your books, not in GSTR-2B - vendor has not filed</div>
                        </div>
                        <div style={{...cardStyle, borderLeft: '4px solid #8b5cf6'}}>
                            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Missing in Books</div>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: '#4c1d95' }}>{summary.missingInBooks || 0}</div>
                            <div style={{ fontSize: '11px', color: '#8b5cf6', marginTop: '4px' }}>On the portal, no purchase voucher entered</div>
                        </div>
                    </div>

                    {/* Reconciliation Table */}
                    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Reconciliation Details</h3>
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                    {meta ? ('Return period ' + (meta.period || '-') + ' \u00b7 ' + meta.summary.portalDocuments + ' portal document(s) vs ' + meta.summary.purchaseVouchers + ' purchase voucher(s) \u00b7 showing ' + shown.length) : ''}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search supplier / invoice / GSTIN"
                                    style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', minWidth: '220px' }} />
                                <button onClick={() => setExceptionsOnly(v => !v)}
                                    style={{ background: exceptionsOnly ? '#0f172a' : '#f8fafc', color: exceptionsOnly ? '#fff' : '#334155', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                    <Filter size={14}/> {exceptionsOnly ? 'Showing exceptions only' : 'Show Exceptions Only'}
                                </button>
                                <button onClick={exportExcel} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><Download size={14}/> Export Excel</button>
                            </div>
                        </div>
                        
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Vendor Name</th>
                                    <th style={thStyle}>Invoice No.</th>
                                    <th style={{...thStyle, textAlign: 'right'}}>Amount as per Portal</th>
                                    <th style={{...thStyle, textAlign: 'right'}}>Amount in ERP Books</th>
                                    <th style={{...thStyle, textAlign: 'right'}}>Difference</th>
                                    <th style={{...thStyle, textAlign: 'center'}}>Match Status</th>
                                    <th style={{...thStyle, textAlign: 'center'}}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map((rec, idx) => (
                                    <tr key={idx} style={{ background: rec.status === 'Matched' ? '#fff' : '#fef2f2' }}>
                                        <td style={{...tdStyle, fontWeight: 'bold', color: '#0f172a'}}>{rec.vendor}</td>
                                        <td style={tdStyle}>
                                            {rec.invoice}
                                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                                                {rec.docKind}{rec.date ? ' \u00b7 ' + rec.date.split('-').reverse().join('-') : ''}
                                                {rec.matchedOn ? ' \u00b7 matched on ' + rec.matchedOn : ''}
                                                {rec.docKind !== 'Books only' && !rec.itcAvailable ? ' \u00b7 ITC NOT available on portal' : ''}
                                            </div>
                                        </td>
                                        <td style={{...tdStyle, textAlign: 'right', color: '#2563eb'}}>₹ {rec.portalAmt.toLocaleString()}</td>
                                        <td style={{...tdStyle, textAlign: 'right', color: '#059669'}}>₹ {rec.bookAmt.toLocaleString()}</td>
                                        <td style={{...tdStyle, textAlign: 'right', color: '#dc2626', fontWeight: 'bold'}}>{rec.diff ? `₹ ${rec.diff.toLocaleString()}` : '-'}</td>
                                        <td style={{...tdStyle, textAlign: 'center'}}>
                                            {rec.status === 'Matched' && <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>Matched</span>}
                                            {rec.status === 'Mismatched' && <span style={{ background: '#fef08a', color: '#854d0e', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>Mismatched</span>}
                                            {rec.status.includes('Missing') && <span style={{ background: '#fef2f2', color: '#991b1b', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>{rec.status}</span>}
                                        </td>
                                        <td style={{...tdStyle, textAlign: 'center'}}>
                                            <button onClick={() => openVoucher(rec)} disabled={!rec.voucherId}
                                                title={rec.voucherId ? 'Open voucher ' + rec.id : 'Not in the books - nothing to open'}
                                                style={{ background: 'none', border: '1px solid #cbd5e1', color: rec.voucherId ? '#0369a1' : '#cbd5e1', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: rec.voucherId ? 'pointer' : 'not-allowed' }}>
                                                {rec.voucherId ? 'View voucher' : 'Not in books'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {!shown.length && (
                                    <tr><td colSpan={7} style={{ padding: '28px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                        {records.length ? 'Nothing matches the filter.' : 'No documents in this return.'}
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                        {meta && (
                            <div style={{ borderTop: '1px solid #e2e8f0', padding: '12px 20px', background: '#f8fafc', fontSize: '12px', color: '#475569' }}>
                                <div><b>ITC safe to claim: &#8377; {(meta.summary.itcSafe || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b> &nbsp;
                                    (matched documents with ITC available on the portal, out of &#8377; {(meta.summary.portalTaxTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} total tax on the portal)</div>
                                <div style={{ marginTop: '6px' }}>{meta.note}</div>
                                {meta.portalGstin && <div style={{ marginTop: '4px' }}>File belongs to GSTIN {meta.portalGstin}</div>}
                            </div>
                        )}
                    </div>
                    <div style={{ marginTop: '16px', textAlign: 'right' }}>
                        <button onClick={() => { setFileUploaded(false); setRecords([]); setMeta(null); setSearch(''); setExceptionsOnly(false); }}
                            style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' }}>
                            Match another month
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
