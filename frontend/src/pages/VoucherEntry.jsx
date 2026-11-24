import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Plus, Save, Trash2, Calendar, FileText, Calculator, Paperclip, CheckCircle, RefreshCcw, X } from 'lucide-react';
import toast from 'react-hot-toast';

// 30-Oct-2026: this screen looked complete but posted nothing - Save only printed "Journal Voucher Posted
// Successfully!" after a 1.5 s timer, the ledger column was a free-text box, the cost-centre and forex boxes
// had nowhere to go, and "Attach Supporting Docs" did nothing. It now posts to /api/vouchers with real
// ledger ids, stores the cost centre / currency / rate / remarks per line, and uploads the attachments.
const blankLine = (id, dc) => ({ id, dc, ledgerId: '', amountINR: '', amountFCY: '', curr: 'INR', roe: 1, costCentreId: '', remarks: '' });

export default function VoucherEntry() {
    const [activeType, setActiveType] = useState('Journal');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [voucherNumber, setVoucherNumber] = useState('');
    const [numberIsAuto, setNumberIsAuto] = useState(true);
    const [narration, setNarration] = useState('');
    const [refNo, setRefNo] = useState('');
    const [jobNo, setJobNo] = useState('');
    const [branch, setBranch] = useState('');
    const [branches, setBranches] = useState([]);
    const [ledgers, setLedgers] = useState([]);
    const [centres, setCentres] = useState([]);
    const [currencies, setCurrencies] = useState([]);
    const [voucherTypes, setVoucherTypes] = useState([]);
    const [posting, setPosting] = useState(false);
    const [loadErr, setLoadErr] = useState('');
    const [enableForex, setEnableForex] = useState(false);
    const [enableCostCenter, setEnableCostCenter] = useState(false);
    const [lines, setLines] = useState([blankLine(1, 'Dr'), blankLine(2, 'Cr')]);
    const [nextId, setNextId] = useState(3);
    const [docs, setDocs] = useState([]);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef(null);
    // a voucher that has not been posted yet parks its attachments under this key
    const draftKey = useRef('vd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));

    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

    // the voucher type whose baseType matches the tab the user is on
    const currentType = useMemo(
        () => voucherTypes.find(t => String(t.baseType) === activeType) || null,
        [voucherTypes, activeType]
    );

    useEffect(() => {
        (async () => {
            try {
                const [lr, mr, br, cr] = await Promise.all([
                    fetch('/api/accounts/tree', { headers: auth() }),
                    fetch('/api/accounting-masters/all', { headers: auth() }),
                    fetch('/api/masters/company-branches', { headers: auth() }),
                    fetch('/api/accounting-masters/currencies', { headers: auth() }),
                ]);
                const lj = await lr.json().catch(() => ({}));
                const mj = await mr.json().catch(() => ({}));
                const bj = await br.json().catch(() => ({}));
                const cj = await cr.json().catch(() => ({}));

                // the ledger tree comes back as nested nodes; flatten to the ledgers only
                const flat = [];
                const walk = (nodes, groupName) => (nodes || []).forEach(n => {
                    if (n.type === 'ledger') flat.push({ id: n.id, name: n.name, group: n.groupName || groupName || '' });
                    if (n.children) walk(n.children, n.name || groupName);
                });
                walk(lj.data || lj.tree || lj, '');
                flat.sort((a, b) => String(a.name).localeCompare(String(b.name)));
                setLedgers(flat);

                const md = (mj && mj.data) || {};
                setVoucherTypes(md.voucherTypes || []);
                setCentres(md.costCentresFlat || []);
                const bl = (bj && (bj.data || bj.branches)) || [];
                setBranches(bl);
                const def = bl.find(x => x.isDefault) || bl[0];
                if (def) setBranch(def.branchCode || def.code || '');
                const cl = (cj && (cj.data || cj)) || [];
                setCurrencies(Array.isArray(cl) ? cl : []);
                if (!flat.length) setLoadErr('No ledgers exist yet. Open Accounts > Chart of Accounts and create your ledgers first - a voucher cannot be posted without them.');
            } catch (err) {
                setLoadErr('Could not load ledgers / masters: ' + err.message);
            }
        })();
    }, []);

    // the real next number for the chosen voucher type
    const loadNumber = useCallback(async () => {
        if (!currentType) { setVoucherNumber(''); return; }
        try {
            const r = await fetch('/api/vouchers/next-number/' + currentType.id, { headers: auth() });
            const j = await r.json().catch(() => ({}));
            setNumberIsAuto(j.isAuto !== false);
            setVoucherNumber(j.nextNumber || '');
        } catch (err) {
            setNumberIsAuto(false); setVoucherNumber('');
        }
    }, [currentType]);
    useEffect(() => { loadNumber(); }, [loadNumber]);

    const updateLine = (id, field, value) => {
        setLines(prev => prev.map(l => {
            if (l.id !== id) return l;
            const n = { ...l, [field]: value };
            // forex: INR amount follows FCY x rate, so the two can never disagree
            if (['amountFCY', 'roe', 'curr'].includes(field)) {
                if (n.curr && n.curr !== 'INR') {
                    const f = parseFloat(n.amountFCY), r = parseFloat(n.roe);
                    if (Number.isFinite(f) && Number.isFinite(r)) n.amountINR = (f * r).toFixed(2);
                } else if (field === 'curr') {
                    n.amountFCY = ''; n.roe = 1;
                }
            }
            return n;
        }));
    };

    const addLine = () => {
        const lastDc = lines[lines.length - 1]?.dc || 'Dr';
        setLines([...lines, blankLine(nextId, lastDc === 'Dr' ? 'Cr' : 'Dr')]);
        setNextId(nextId + 1);
    };
    const removeLine = (id) => {
        if (lines.length <= 2) { toast.error('A voucher needs at least two lines'); return; }
        setLines(lines.filter(l => l.id !== id));
    };

    const totals = useMemo(() => {
        const dr = lines.filter(l => l.dc === 'Dr').reduce((a, l) => a + (parseFloat(l.amountINR) || 0), 0);
        const cr = lines.filter(l => l.dc === 'Cr').reduce((a, l) => a + (parseFloat(l.amountINR) || 0), 0);
        return { dr, cr, diff: Math.abs(dr - cr) };
    }, [lines]);

    const handleAutoBalance = () => {
        if (totals.diff < 0.01) { toast.success('Already tallied'); return; }
        const missingDc = totals.dr > totals.cr ? 'Cr' : 'Dr';
        setLines([...lines, { ...blankLine(nextId, missingDc), amountINR: totals.diff.toFixed(2), remarks: 'Auto-balanced' }]);
        setNextId(nextId + 1);
        toast.success('Added a balancing line - pick its ledger');
    };

    const loadDocs = useCallback(async (vId) => {
        const q = vId ? 'voucherId=' + vId : 'draftKey=' + encodeURIComponent(draftKey.current);
        try {
            const r = await fetch('/api/vouchers/documents?' + q, { headers: auth() });
            const j = await r.json().catch(() => ({}));
            setDocs((j && j.data) || []);
        } catch (err) { /* the list is a convenience; the upload result already told the user */ }
    }, []);

    const handleAttach = async (e) => {
        const files = [...(e.target.files || [])];
        if (!files.length) return;
        setUploading(true);
        try {
            const fd = new FormData();
            files.forEach(f => fd.append('files', f));
            fd.append('draftKey', draftKey.current);
            const r = await fetch('/api/vouchers/documents', { method: 'POST', headers: auth(), body: fd });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            toast.success(files.length === 1 ? 'Attached' : files.length + ' files attached');
            await loadDocs(null);
        } catch (err) {
            toast.error('Attach failed: ' + err.message);
        }
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
    };

    const removeDoc = async (id) => {
        try {
            const r = await fetch('/api/vouchers/documents/' + id, { method: 'DELETE', headers: auth() });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            setDocs(docs.filter(d => d.id !== id));
        } catch (err) { toast.error('Could not remove: ' + err.message); }
    };

    const handleSave = async () => {
        if (!currentType) return toast.error('There is no "' + activeType + '" voucher type in Accounting Masters yet - create it first');
        if (totals.dr === 0) return toast.error('Total amount cannot be zero');
        if (totals.diff > 0.01) return toast.error('Debit and Credit totals must match. Difference: ' + totals.diff.toFixed(2));
        const noLedger = lines.filter(l => (parseFloat(l.amountINR) || 0) !== 0 && !l.ledgerId);
        if (noLedger.length) return toast.error(noLedger.length + ' line(s) have an amount but no ledger picked');
        if (!numberIsAuto && !voucherNumber.trim()) return toast.error('This voucher type is on manual numbering - type a voucher number');

        setPosting(true);
        try {
            const body = {
                voucherTypeId: currentType.id,
                voucherNumber: voucherNumber.trim(),
                date, narration: narration || null,
                branchCode: branch || null, refNo: refNo || null, jobNo: jobNo || null,
                details: lines
                    .filter(l => (parseFloat(l.amountINR) || 0) !== 0)
                    .map(l => ({
                        ledgerId: l.ledgerId, dc: l.dc, amount: parseFloat(l.amountINR) || 0,
                        costCentreId: enableCostCenter && l.costCentreId ? l.costCentreId : null,
                        currency: enableForex ? (l.curr || 'INR') : null,
                        roe: enableForex && l.curr !== 'INR' ? l.roe : null,
                        amountFcy: enableForex && l.curr !== 'INR' ? l.amountFCY : null,
                        remarks: l.remarks || null,
                    })),
            };
            const r = await fetch('/api/vouchers', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() }, body: JSON.stringify(body) });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            const newId = (j.data && j.data.id) || j.id || (j.voucher && j.voucher.id);
            if (newId && docs.length) {
                await fetch('/api/vouchers/documents/claim', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                    body: JSON.stringify({ draftKey: draftKey.current, voucherId: newId }),
                }).catch(() => { toast.error('Voucher posted, but the attachments did not link - re-attach them from the voucher list'); });
            }
            toast.success('Posted ' + (voucherNumber || '') );
            // fresh form for the next entry, with the next real number
            setLines([blankLine(1, 'Dr'), blankLine(2, 'Cr')]); setNextId(3);
            setNarration(''); setRefNo(''); setJobNo(''); setDocs([]);
            draftKey.current = 'vd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
            await loadNumber();
        } catch (err) {
            toast.error('Not posted: ' + err.message);
        }
        setPosting(false);
    };

    const btnTypes = ['Contra', 'Payment', 'Receipt', 'Journal', 'Sales', 'Purchase'];

    const inputStyle = { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' };
    const tdInputStyle = { padding: '6px', border: '1px solid transparent', borderRadius: '4px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box', background: 'transparent' };
    const thStyle = { padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', borderBottom: '2px solid #cbd5e1', background: '#f8fafc' };
    const tdStyle = { padding: '4px', borderBottom: '1px solid #f1f5f9', background: '#fff' };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI' }}>
            
            {/* Top Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={24} color="#0284c7" /> Voucher Entry (Advanced)
                    </h2>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Multi-currency, Cost Center Tagging, and Auto-Balancing</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                    {btnTypes.map(type => (
                        <button key={type} onClick={() => setActiveType(type)} style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', background: activeType === type ? '#0284c7' : 'transparent', color: activeType === type ? '#fff' : '#64748b', transition: 'all 0.2s' }}>
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            {loadErr && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px' }}>
                    {loadErr}
                </div>
            )}

            {/* Voucher Header Options */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '24px', display: 'flex', gap: '32px' }}>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Branch</label>
                        <select value={branch} onChange={e=>setBranch(e.target.value)} style={inputStyle}>
                            <option value="">-- none --</option>
                            {branches.map(b => <option key={b.id || b.branchCode} value={b.branchCode || b.code}>{(b.branchCode || b.code) + ' - ' + (b.branchName || b.name || '')}</option>)}
                        </select>
                    </div>
                    <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inputStyle} /></div>
                    <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Voucher No.{numberIsAuto ? '' : ' (manual)'}</label>
                        <input type="text" value={voucherNumber} onChange={e => setVoucherNumber(e.target.value)} readOnly={numberIsAuto}
                            placeholder={currentType ? '' : 'No ' + activeType + ' voucher type yet'}
                            style={numberIsAuto ? {...inputStyle, background: '#f8fafc', color: '#64748b'} : inputStyle} />
                    </div>
                    <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Reference / Bill No.</label><input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="Optional..." style={inputStyle} /></div>
                    <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Job No. (links this voucher to a job)</label><input type="text" value={jobNo} onChange={e => setJobNo(e.target.value)} placeholder="Optional..." style={inputStyle} /></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center', paddingLeft: '24px', borderLeft: '1px solid #e2e8f0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', color: '#0369a1', cursor: 'pointer' }}>
                        <input type="checkbox" checked={enableForex} onChange={e => setEnableForex(e.target.checked)} /> Multi-Currency (Forex)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', color: '#059669', cursor: 'pointer' }}>
                        <input type="checkbox" checked={enableCostCenter} onChange={e => setEnableCostCenter(e.target.checked)} /> Enable Cost Centers
                    </label>
                </div>
            </div>

            {/* Grid */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{...thStyle, width: '60px', textAlign: 'center'}}>Dr/Cr</th>
                            <th style={thStyle}>Particulars (Ledger Account)</th>
                            {enableForex && <th style={{...thStyle, width: '100px'}}>Curr.</th>}
                            {enableForex && <th style={{...thStyle, width: '120px', textAlign: 'right'}}>Amount (FCY)</th>}
                            {enableForex && <th style={{...thStyle, width: '100px', textAlign: 'right'}}>Rate (ROE)</th>}
                            <th style={{...thStyle, width: '150px', textAlign: 'right'}}>Debit (₹)</th>
                            <th style={{...thStyle, width: '150px', textAlign: 'right'}}>Credit (₹)</th>
                            {enableCostCenter && <th style={thStyle}>Cost Center</th>}
                            <th style={thStyle}>Line Narration</th>
                            <th style={{...thStyle, width: '50px'}}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((l) => (
                            <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={tdStyle}>
                                    <select value={l.dc} onChange={e => updateLine(l.id, 'dc', e.target.value)} style={{...tdInputStyle, fontWeight: 'bold', color: l.dc === 'Dr' ? '#0369a1' : '#dc2626', border: '1px solid #e2e8f0'}}>
                                        <option value="Dr">Dr</option><option value="Cr">Cr</option>
                                    </select>
                                </td>
                                <td style={tdStyle}>
                                    <select value={l.ledgerId} onChange={e => updateLine(l.id, 'ledgerId', e.target.value)} style={{...tdInputStyle, border: '1px solid #e2e8f0'}}>
                                        <option value="">-- pick a ledger --</option>
                                        {ledgers.map(g => <option key={g.id} value={g.id}>{g.name}{g.group ? '  (' + g.group + ')' : ''}</option>)}
                                    </select>
                                </td>
                                
                                {enableForex && (
                                    <>
                                        <td style={tdStyle}>
                                            <select value={l.curr} onChange={e => updateLine(l.id, 'curr', e.target.value)} style={{...tdInputStyle, border: '1px solid #e2e8f0'}}>
                                                <option value="INR">INR</option>
                                                {currencies.filter(c => (c.code || c.currencyCode) !== 'INR').map(c => {
                                                    const code = c.code || c.currencyCode;
                                                    return <option key={code} value={code}>{code}</option>;
                                                })}
                                            </select>
                                        </td>
                                        <td style={tdStyle}><input type="number" value={l.amountFCY} onChange={e => updateLine(l.id, 'amountFCY', e.target.value)} style={{...tdInputStyle, textAlign: 'right', border: '1px solid #e2e8f0'}} placeholder="0.00" disabled={l.curr==='INR'} /></td>
                                        <td style={tdStyle}><input type="number" value={l.roe} onChange={e => updateLine(l.id, 'roe', e.target.value)} style={{...tdInputStyle, textAlign: 'right', border: '1px solid #e2e8f0'}} disabled={l.curr==='INR'} /></td>
                                    </>
                                )}

                                <td style={tdStyle}>
                                    {l.dc === 'Dr' ? <input type="number" value={l.amountINR} onChange={e => updateLine(l.id, 'amountINR', e.target.value)} style={{...tdInputStyle, textAlign: 'right', fontWeight: 'bold', border: '1px solid #bae6fd', background: '#f0f9ff'}} placeholder="0.00" readOnly={enableForex && l.curr !== 'INR'} /> : null}
                                </td>
                                <td style={tdStyle}>
                                    {l.dc === 'Cr' ? <input type="number" value={l.amountINR} onChange={e => updateLine(l.id, 'amountINR', e.target.value)} style={{...tdInputStyle, textAlign: 'right', fontWeight: 'bold', border: '1px solid #fecaca', background: '#fef2f2'}} placeholder="0.00" readOnly={enableForex && l.curr !== 'INR'} /> : null}
                                </td>
                                
                                {enableCostCenter && (
                                    <td style={tdStyle}>
                                        <select value={l.costCentreId} onChange={e => updateLine(l.id, 'costCentreId', e.target.value)} style={{...tdInputStyle, border: '1px solid #e2e8f0'}}>
                                            <option value="">-- none --</option>
                                            {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </td>
                                )}
                                
                                <td style={tdStyle}><input type="text" value={l.remarks} onChange={e => updateLine(l.id, 'remarks', e.target.value)} placeholder="Remarks..." style={{...tdInputStyle, border: '1px solid #e2e8f0'}} /></td>
                                <td style={{...tdStyle, textAlign: 'center'}}>
                                    <button onClick={() => removeLine(l.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={enableForex ? 5 : 2} style={{ padding: '12px', background: '#f8fafc' }}>
                                <button onClick={addLine} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                    <Plus size={14}/> Add Ledger Line
                                </button>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: '#0369a1', background: '#f0f9ff', borderTop: '2px solid #bae6fd' }}>₹ {totals.dr.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: '#dc2626', background: '#fef2f2', borderTop: '2px solid #fecaca' }}>₹ {totals.cr.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td colSpan={enableCostCenter ? 3 : 2} style={{ background: '#f8fafc', padding: '12px', textAlign: 'right' }}>
                                {totals.diff > 0 && (
                                    <button onClick={handleAutoBalance} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', float: 'right' }}>
                                        <Calculator size={14}/> Auto-Balance (Diff: ₹{totals.diff.toFixed(2)})
                                    </button>
                                )}
                                {totals.diff === 0 && totals.dr > 0 && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534', fontWeight: 'bold', fontSize: '13px', justifyContent: 'flex-end' }}><CheckCircle size={16}/> Tallied</span>
                                )}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Footer Form */}
            <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Common Narration</label>
                    <textarea rows={3} value={narration} onChange={e=>setNarration(e.target.value)} placeholder="Type narration here..." style={inputStyle}></textarea>
                </div>
                <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'flex-end' }}>
                    <input ref={fileRef} type="file" multiple onChange={handleAttach} style={{ display: 'none' }}
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.tif,.tiff,.doc,.docx,.xls,.xlsx,.csv,.txt" />
                    <button onClick={() => fileRef.current && fileRef.current.click()} disabled={uploading}
                        style={{ padding: '10px 16px', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '6px', fontWeight: 'bold', color: '#64748b', cursor: uploading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <Paperclip size={16}/> {uploading ? 'Uploading...' : docs.length ? 'Attach more (' + docs.length + ')' : 'Attach Supporting Docs'}
                    </button>
                    {docs.length > 0 && (
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', maxHeight: '110px', overflowY: 'auto' }}>
                            {docs.map(d => (
                                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '2px 0' }}>
                                    <a href={d.filePath} target="_blank" rel="noreferrer" style={{ flex: 1, color: '#0369a1', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.originalName}</a>
                                    <span style={{ color: '#94a3b8' }}>{Math.round((d.size || 0) / 1024)} KB</span>
                                    <button onClick={() => removeDoc(d.id)} title="Remove" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}><X size={14}/></button>
                                </div>
                            ))}
                        </div>
                    )}
                    <button onClick={handleSave} disabled={posting} style={{ padding: '12px 24px', background: posting ? '#94a3b8' : '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '15px', cursor: posting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <Save size={18}/> {posting ? 'Posting...' : 'Post Voucher'}
                    </button>
                </div>
            </div>

        </div>
    );
}
