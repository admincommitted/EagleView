import React, { useState, useEffect } from 'react';
import { getParties } from '../utils/partiesCache'; // shared copy of the party list, 09-Nov-2026
import { Save, Plus, Trash2, Calendar, FileText, CheckCircle, Clock, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

// Searchable customer box (28-Oct-2026): type part of the name, code, IEC, GSTIN or city; arrow keys + Enter to pick.
function PartyPicker({ parties, value, onChange, style }) {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const [hi, setHi] = useState(0);
    const boxRef = React.useRef(null);
    const sel = parties.find(p => String(p.id) === String(value));
    useEffect(() => {
        const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);
    const key = (p) => [p.name, p.code, p.taxId, p.panNumber, p.city, ...(p.branches || []).map(b => `${b.regNo || ''} ${b.city || ''}`)].filter(Boolean).join(' ').toLowerCase();
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const hits = parties.filter(p => words.every(w => key(p).includes(w))).slice(0, 50);
    const pick = (p) => { onChange(String(p.id)); setQ(''); setOpen(false); };
    const onKey = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(h => Math.min(h + 1, hits.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
        else if (e.key === 'Enter' && open && hits[hi]) { e.preventDefault(); pick(hits[hi]); }
        else if (e.key === 'Escape') setOpen(false);
    };
    return (
        <div ref={boxRef} style={{ position: 'relative' }}>
            <input type="text" role="combobox" aria-expanded={open} aria-autocomplete="list" style={{ ...style, paddingRight: '28px' }}
                placeholder={sel ? sel.name : 'Search customer by name, IEC, GSTIN, city...'}
                value={open ? q : (sel ? sel.name : q)}
                onFocus={() => { setOpen(true); setQ(''); setHi(0); }}
                onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); }}
                onKeyDown={onKey} />
            {sel && !open && <button type="button" title="Clear customer" onClick={() => onChange('')} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '14px' }}>✕</button>}
            {open && (
                <div role="listbox" style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: '2px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', boxShadow: '0 8px 20px rgba(0,0,0,0.12)', maxHeight: '260px', overflowY: 'auto' }}>
                    {hits.map((p, k) => (
                        <div key={p.id} role="option" aria-selected={k === hi} onMouseDown={e => { e.preventDefault(); pick(p); }} onMouseEnter={() => setHi(k)}
                            style={{ padding: '6px 10px', cursor: 'pointer', background: k === hi ? '#eff6ff' : String(p.id) === String(value) ? '#f8fafc' : '#fff', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{p.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{[p.taxId && `IEC ${p.taxId}`, p.city, (p.branches || []).map(b => b.regNo).find(Boolean)].filter(Boolean).join(' · ') || '\u00a0'}</div>
                        </div>
                    ))}
                    {hits.length === 0 && <div style={{ padding: '8px 10px', fontSize: '12px', color: '#64748b' }}>No customer matches "{q}" - add it in Party Master</div>}
                    {hits.length === 50 && <div style={{ padding: '6px 10px', fontSize: '11px', color: '#94a3b8' }}>Showing first 50 - type more to narrow</div>}
                </div>
            )}
        </div>
    );
}

export default function ContractMaster() {
    const [loading, setLoading] = useState(false);
    // 28-Oct-2026: contracts are saved in the database (/api/contracts). Before, Save only showed a message, the
    // customer list was 3 sample names and the grids started with sample rows.
    const [contractId, setContractId] = useState(null);
    const [contracts, setContracts] = useState([]);
    const [parties, setParties] = useState([]);
    const [prefs, setPrefs] = useState({ splitInvoicing: false, consolidatedBilling: false, autoEmailInvoices: true, billingNotes: '' });
    const isAdmin = (() => { try { return String((JSON.parse(localStorage.getItem('user') || '{}') || {}).role || '').toLowerCase() === 'admin'; } catch (e) { return false; } })();
    
    // Header Data
    const [contractData, setContractData] = useState({
        contractNo: '(new)',
        customer: '',
        validFrom: '',
        validTo: '',
        currency: 'INR',
        status: 'Draft', // Draft, Pending Approval, Active, Expired
        salesRep: ''
    });

    const [activeTab, setActiveTab] = useState('freight'); // freight, local, transport, terms
    // 08-Nov-2026: charges come only from Accounts > GST Charges (name, SAC, GST %), so the bill gets the right head and tax
    const [gstList, setGstList] = useState([]);
    useEffect(() => { fetch('/api/contracts/gst-charges').then(r => r.json()).then(j => setGstList((j && j.data) || [])).catch(() => {}); }, []);
    const gstOf = (name) => gstList.find(g => String(g.name).toUpperCase() === String(name || '').trim().toUpperCase());

    // Freight Rates Grid
    const [freightRates, setFreightRates] = useState([
        { id: 1, origin: '', destination: '', serviceType: 'General', carrier: '', chargeName: '', min: '', normal: '', plus45: '', plus100: '', plus300: '', plus500: '', plus1000: '' }
    ]);

    // Local / Advanced Charges
    const [localCharges, setLocalCharges] = useState([
        { id: 1, printName: '', systemLedger: '', appliesTo: 'ALL', basis: 'Flat', rate: '', minAmt: '', maxAmt: '', currency: 'INR', mandatory: false, type: 'Taxable' }
    ]);

    // Transport & Cartage
    const [transportRates, setTransportRates] = useState([
        { id: 1, fromLoc: '', toLoc: '', vehicle: 'Tata Ace', amount: '', currency: 'INR', chargeName: '' }
    ]);

    const [terms, setTerms] = useState("1. Rates are subject to standard airline fuel & security surcharges.\n2. Payment terms: 30 days from invoice date.\n3. Quotation valid for general cargo only unless specified.");

    const addFreightRow = () => {
        setFreightRates([...freightRates, { id: Date.now(), origin: '', destination: '', serviceType: 'General', carrier: '', chargeName: '', min: '', normal: '', plus45: '', plus100: '', plus300: '', plus500: '', plus1000: '' }]);
    };

    const removeFreightRow = (id) => {
        if(freightRates.length > 1) setFreightRates(freightRates.filter(r => r.id !== id));
    };

    const updateFreight = (id, field, value) => {
        setFreightRates(freightRates.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const addChargeRow = () => {
        setLocalCharges([...localCharges, { id: Date.now(), printName: '', systemLedger: '', appliesTo: 'ALL', basis: 'Flat', rate: '', minAmt: '', maxAmt: '', currency: 'INR', mandatory: false, type: 'Taxable' }]);
    };

    const removeChargeRow = (id) => {
        setLocalCharges(localCharges.filter(r => r.id !== id));
    };

    const updateCharge = (id, field, value) => {
        setLocalCharges(localCharges.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const addTransportRow = () => {
        setTransportRates([...transportRates, { id: Date.now(), fromLoc: '', toLoc: '', vehicle: 'Tata Ace', amount: '', currency: 'INR', chargeName: '' }]);
    };

    const removeTransportRow = (id) => {
        setTransportRates(transportRates.filter(r => r.id !== id));
    };

    const updateTransport = (id, field, value) => {
        setTransportRates(transportRates.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const loadList = async () => {
        try {
            const res = await fetch('/api/contracts');
            const data = await res.json();
            if (res.ok && data.success) setContracts(data.data || []);
        } catch (e) { /* list stays empty */ }
    };
    useEffect(() => {
        loadList();
        getParties().then(d => setParties(Array.isArray(d) ? d : (d && d.data) || [])).catch(() => {});
    }, []);

    const blankForm = () => {
        setContractId(null);
        setContractData({ contractNo: '(new)', customer: '', validFrom: '', validTo: '', currency: 'INR', status: 'Draft', salesRep: '' });
        setFreightRates([{ id: Date.now(), origin: '', destination: '', serviceType: 'General', carrier: '', min: '', normal: '', plus45: '', plus100: '', plus300: '', plus500: '', plus1000: '' }]);
        setLocalCharges([{ id: Date.now() + 1, printName: '', systemLedger: '', appliesTo: 'ALL', basis: 'Flat', rate: '', minAmt: '', maxAmt: '', currency: 'INR', mandatory: false, type: 'Taxable' }]);
        setTransportRates([{ id: Date.now() + 2, fromLoc: '', toLoc: '', vehicle: 'Tata Ace', amount: '', currency: 'INR', chargeName: '' }]);
        setTerms("1. Rates are subject to standard airline fuel & security surcharges.\n2. Payment terms: 30 days from invoice date.\n3. Quotation valid for general cargo only unless specified.");
        setPrefs({ splitInvoicing: false, consolidatedBilling: false, autoEmailInvoices: true, billingNotes: '' });
    };
    const str = (v) => (v == null ? '' : String(Number.isFinite(Number(v)) && v !== '' ? Number(v) : v));
    const showContract = (c) => {
        setContractId(c.id);
        setContractData({ contractNo: c.contractNo, customer: String(c.partyId), validFrom: c.validFrom || '', validTo: c.validTo || '', currency: c.currency || 'INR', status: c.status, salesRep: c.salesRep || '' });
        const fr = (c.freightRates || []).map(r => ({ ...r, carrier: r.carrier || '', chargeName: r.chargeName || '', min: str(r.min), normal: str(r.normal), plus45: str(r.plus45), plus100: str(r.plus100), plus300: str(r.plus300), plus500: str(r.plus500), plus1000: str(r.plus1000) }));
        setFreightRates(fr.length ? fr : [{ id: Date.now(), origin: '', destination: '', serviceType: 'General', carrier: '', chargeName: '', min: '', normal: '', plus45: '', plus100: '', plus300: '', plus500: '', plus1000: '' }]);
        const ch = (c.charges || []).map(r => ({ ...r, systemLedger: r.systemLedger || '', appliesTo: r.appliesTo || 'ALL', rate: str(r.rate), minAmt: str(r.minAmt), maxAmt: str(r.maxAmt) }));
        setLocalCharges(ch.length ? ch : [{ id: Date.now() + 1, printName: '', systemLedger: '', appliesTo: 'ALL', basis: 'Flat', rate: '', minAmt: '', maxAmt: '', currency: 'INR', mandatory: false, type: 'Taxable' }]);
        const tr = (c.transportRates || []).map(r => ({ ...r, vehicle: r.vehicle || 'Tata Ace', amount: str(r.amount), chargeName: r.chargeName || '' }));
        setTransportRates(tr.length ? tr : [{ id: Date.now() + 2, fromLoc: '', toLoc: '', vehicle: 'Tata Ace', amount: '', currency: 'INR', chargeName: '' }]);
        setTerms(c.terms || '');
        setPrefs({ splitInvoicing: !!c.splitInvoicing, consolidatedBilling: !!c.consolidatedBilling, autoEmailInvoices: c.autoEmailInvoices !== false, billingNotes: c.billingNotes || '' });
    };
    // picking a customer brings up that customer's saved quotation (28-Oct-2026): the Active one still valid, else
    // the one sent for approval, else the latest draft; the others are listed under the customer box to switch
    const hasTypedRows = () => freightRates.some(r => r.origin || r.destination || r.normal || r.min)
        || localCharges.some(r => r.printName || r.rate) || transportRates.some(r => r.fromLoc || r.toLoc || r.amount);
    const handlePartyPick = async (id) => {
        if (!id) { setContractData(prev => ({ ...prev, customer: '' })); return; }
        let mine = [];
        try {
            const res = await fetch(`/api/contracts?partyId=${encodeURIComponent(id)}`);
            const data = await res.json();
            mine = res.ok && data.success ? (data.data || []) : [];
        } catch (e) { mine = []; }
        if (mine.length) setContracts(prev => [...mine, ...prev.filter(x => !mine.some(m => m.id === x.id))]);
        if (!mine.length) {
            // no saved quotation: a new one for this customer (an open contract of another customer is not changed)
            if (contractId) { blankForm(); }
            setContractData(prev => ({ ...prev, customer: id }));
            toast('No saved quotation for this customer - new one started', { icon: 'ℹ️' });
            return;
        }
        const rank = (c) => (c.status === 'Active' && !c.expired ? 0 : c.status === 'Pending Approval' ? 1 : c.status === 'Draft' ? 2 : 3);
        const best = [...mine].sort((a, b) => rank(a) - rank(b) || b.id - a.id)[0];
        if (String(best.id) === String(contractId)) return;
        if (!contractId && hasTypedRows() && !window.confirm(`${best.contractNo} is already saved for this customer. Open it? (rates typed on this screen will be cleared)`)) {
            setContractData(prev => ({ ...prev, customer: id }));
            return;
        }
        await openContract(best.id);
        toast.success(`Saved quotation ${best.contractNo} (${best.status}) loaded` + (mine.length > 1 ? ` - ${mine.length} saved for this customer` : ''));
    };

    const openContract = async (id) => {
        if (!id) return blankForm();
        try {
            const res = await fetch(`/api/contracts/${id}`);
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Could not open contract');
            showContract(data.data);
        } catch (e) { toast.error(e.message); }
    };

    // submit = true sends it for approval
    const handleSave = async (status = 'Draft') => {
        if(!contractData.customer || !contractData.validTo) {
            toast.error("Customer and Validity are mandatory.");
            return;
        }
        if (contractData.validFrom && contractData.validFrom > contractData.validTo) return toast.error('Valid From must be before Valid To');
        const body = { partyId: contractData.customer, validFrom: contractData.validFrom, validTo: contractData.validTo, currency: contractData.currency, salesRep: contractData.salesRep, terms, ...prefs, freightRates, charges: localCharges, transportRates, submit: status === 'Pending Approval' };
        setLoading(true);
        try {
            const res = await fetch(contractId ? `/api/contracts/${contractId}` : '/api/contracts', { method: contractId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Could not save contract.');
            showContract(data.data);
            toast.success(`Contract ${data.data.contractNo} saved as ${data.data.status}!`);
            loadList();
        } catch (e) { toast.error(e.message); } finally { setLoading(false); }
    };

    const setStatus = async (status) => {
        if (!contractId) return;
        try {
            const res = await fetch(`/api/contracts/${contractId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Could not change status');
            setContractData(prev => ({ ...prev, status: data.data.status }));
            toast.success(`Contract ${status === 'Active' ? 'approved' : status.toLowerCase()}`);
            loadList();
        } catch (e) { toast.error(e.message); }
    };

    const handleDelete = async () => {
        if (!contractId) return;
        if (!window.confirm(`Delete contract ${contractData.contractNo}?`)) return;
        try {
            const res = await fetch(`/api/contracts/${contractId}`, { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Delete failed');
            toast.success('Contract deleted');
            blankForm();
            loadList();
        } catch (e) { toast.error(e.message); }
    };

    const inputStyle = { padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', outline: 'none', width: '100%', fontFamily: 'inherit' };
    const gstPick = (value, onChange, placeholder) => {
        const g = gstOf(value); const bad = value && gstList.length && !g;
        return (
            <div>
                <input type="text" list="gst-charge-list" placeholder={placeholder || 'Pick GST charge'} style={{ ...inputStyle, fontWeight: 600, borderColor: bad ? '#ef4444' : '#cbd5e1', minWidth: '190px' }} value={value || ''}
                    onChange={e => onChange(e.target.value)} onBlur={e => { const m = gstOf(e.target.value); if (m && m.name !== e.target.value) onChange(m.name); }} />
                <div style={{ fontSize: '10px', color: bad ? '#ef4444' : '#64748b', marginTop: '2px' }}>{bad ? 'Not in Accounts GST Charges' : g ? `SAC ${g.sac || '-'} | GST ${g.exempt ? 'exempt' : (g.gstRate ?? 18) + '%'}` : ''}</div>
            </div>
        );
    };
    const thStyle = { padding: '8px 10px', textAlign: 'left', fontSize: '11px', color: '#1e293b', borderBottom: '1px solid #cbd5e1', background: '#f1f5f9', fontWeight: '700', whiteSpace: 'nowrap', textTransform: 'uppercase' };
    const tdStyle = { padding: '6px 8px', borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' };
    const tabStyle = (isActive) => ({
        padding: '12px 24px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', 
        borderBottom: isActive ? '3px solid #2563eb' : '3px solid transparent',
        color: isActive ? '#2563eb' : '#64748b', transition: 'all 0.2s', background: isActive ? '#eff6ff' : 'transparent', whiteSpace: 'nowrap'
    });

    return (
        <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
            
            {/* Top Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '22px', color: '#0f172a', fontWeight: '700', letterSpacing: '-0.5px' }}>Customer Contract & Quotation Master</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Advanced level contract management for automated job billing</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <select value={contractId || ''} onChange={e => openContract(e.target.value)} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', maxWidth: '280px' }} title="Saved contracts - pick one to open it">
                        <option value="">+ New contract</option>
                        {/* 08-Nov-2026: the saved contracts, under their own heading (or a line saying there are none yet) */}
                        <optgroup label={contracts.length ? 'Saved contracts (' + contracts.length + ')' : 'No contract saved yet'}>
                            {contracts.map(c => <option key={c.id} value={c.id}>{c.contractNo} - {c.partyName} ({c.status}{c.expired ? ', expired' : ''})</option>)}
                        </optgroup>
                    </select>
                    {contractId && <button onClick={handleDelete} style={{ padding: '8px 12px', background: '#fff', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}><Trash2 size={16}/> Delete</button>}
                    {contractId && isAdmin && contractData.status === 'Pending Approval' && <>
                        <button onClick={() => setStatus('Active')} style={{ padding: '8px 12px', background: '#16a34a', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={16}/> Approve</button>
                        <button onClick={() => setStatus('Rejected')} style={{ padding: '8px 12px', background: '#fff', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}><XCircle size={16}/> Reject</button>
                    </>}
                    <button disabled={loading} onClick={() => handleSave('Draft')} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <Save size={16}/> Save as Draft
                    </button>
                    <button disabled={loading} onClick={() => handleSave('Pending Approval')} style={{ padding: '8px 16px', background: '#2563eb', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)' }}>
                        <CheckCircle size={16}/> Submit for Approval
                    </button>
                </div>
            </div>

            {/* Header Form */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Customer / Party *</label>
                        <PartyPicker parties={parties} value={contractData.customer} onChange={handlePartyPick} style={inputStyle} />
                        {(() => { const pc = contracts.filter(c => String(c.partyId) === String(contractData.customer)); return pc.length > 0 && contractData.customer && (
                            <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', fontSize: '11px' }}>
                                <span style={{ color: '#64748b' }}>Saved:</span>
                                {pc.map(c => (
                                    <button key={c.id} type="button" onClick={() => openContract(c.id)} title={`Valid to ${c.validTo || '-'}`}
                                        style={{ padding: '1px 7px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', border: String(c.id) === String(contractId) ? '1px solid #2563eb' : '1px solid #cbd5e1',
                                            background: String(c.id) === String(contractId) ? '#eff6ff' : '#fff', color: c.status === 'Active' && !c.expired ? '#166534' : c.expired ? '#94a3b8' : '#475569', fontWeight: 600 }}>
                                        {c.contractNo} · {c.expired ? 'Expired' : c.status}
                                    </button>
                                ))}
                                <button type="button" onClick={() => { const id = contractData.customer; blankForm(); setContractData(prev => ({ ...prev, customer: id })); }} style={{ padding: '1px 7px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', border: '1px dashed #94a3b8', background: '#fff', color: '#2563eb' }}>+ New for this customer</button>
                            </div>
                        ); })()}
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Contract Reference No</label>
                        <input type="text" style={{...inputStyle, background: '#f8fafc', fontWeight: 'bold'}} value={contractData.contractNo} disabled />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Validity Period *</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input type="date" style={inputStyle} value={contractData.validFrom} onChange={e => setContractData({...contractData, validFrom: e.target.value})} />
                            <input type="date" style={inputStyle} value={contractData.validTo} onChange={e => setContractData({...contractData, validTo: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Status</label>
                        <div style={{ padding: '8px 12px', background: contractData.status === 'Draft' ? '#f1f5f9' : contractData.status === 'Active' ? '#dcfce7' : '#fef3c7', color: contractData.status === 'Draft' ? '#475569' : contractData.status === 'Active' ? '#166534' : '#92400e', borderRadius: '4px', fontSize: '13px', fontWeight: '700', border: '1px solid rgba(0,0,0,0.1)' }}>
                            {contractData.status === 'Pending Approval' && <Clock size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }}/>}
                            {contractData.status}
                        </div>
                    </div>
                </div>
            </div>

            {/* Detail Tabs */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', overflowX: 'auto' }}>
                    <div style={tabStyle(activeTab === 'freight')} onClick={() => setActiveTab('freight')}>✈️ Freight Rate Matrix</div>
                    <div style={tabStyle(activeTab === 'local')} onClick={() => setActiveTab('local')}>📑 Advanced Charge Rules</div>
                    <div style={tabStyle(activeTab === 'transport')} onClick={() => setActiveTab('transport')}>🚚 Transport & Cartage</div>
                    <div style={tabStyle(activeTab === 'terms')} onClick={() => setActiveTab('terms')}>📝 Terms & Conditions</div>
                </div>

                <div style={{ padding: '0', minHeight: '350px' }}>
                    
                    {/* TAB: FREIGHT RATES */}
                    {activeTab === 'freight' && (
                        <div>
                            <div style={{ padding: '12px 20px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: '13px', color: '#1e3a8a' }}>
                                Define origin-destination specific freight rates. Select Cargo/Service type (e.g. General, Valuable, Re-import) to set different rates for the same sector.
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Origin</th>
                                            <th style={thStyle}>Destination</th>
                                            <th style={thStyle}>Cargo / Service Type</th>
                                            <th style={thStyle}>Carrier</th>
                                            <th style={thStyle}>GST Charge <br/><span style={{fontSize:'9px', color:'#64748b', fontWeight:'normal'}}>(billed as)</span></th>
                                            <th style={{...thStyle, textAlign: 'right'}}>Min</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>Normal</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>+45 KG</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>+100 KG</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>+300 KG</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>+500 KG</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>+1000 KG</th>
                                            <th style={{...thStyle, width: '40px'}}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {freightRates.map((row) => (
                                            <tr key={row.id}>
                                                <td style={tdStyle}><input type="text" placeholder="e.g. DEL" style={inputStyle} value={row.origin} onChange={e => updateFreight(row.id, 'origin', e.target.value.toUpperCase())} /></td>
                                                <td style={tdStyle}><input type="text" placeholder="e.g. JFK" style={inputStyle} value={row.destination} onChange={e => updateFreight(row.id, 'destination', e.target.value.toUpperCase())} /></td>
                                                <td style={tdStyle}>
                                                    <select style={{...inputStyle, width: '140px'}} value={row.serviceType} onChange={e => updateFreight(row.id, 'serviceType', e.target.value)}>
                                                        <option value="General">General Cargo</option>
                                                        <option value="Valuable">Valuable (VAL)</option>
                                                        <option value="Perishable">Perishable (PER)</option>
                                                        <option value="DGR">Dangerous Goods</option>
                                                        <option value="Re-Import">Re-Import</option>
                                                        <option value="Re-Export">Re-Export</option>
                                                    </select>
                                                </td>
                                                <td style={tdStyle}><input type="text" placeholder="Any" style={inputStyle} value={row.carrier} onChange={e => updateFreight(row.id, 'carrier', e.target.value.toUpperCase())} /></td>
                                                <td style={tdStyle}>{gstPick(row.chargeName, v => updateFreight(row.id, 'chargeName', v), 'e.g. FREIGHT CHARGES - AIR EXPORTS')}</td>
                                                <td style={tdStyle}><input type="number" placeholder="0.00" style={{...inputStyle, textAlign: 'right', fontWeight: '600', color: '#2563eb'}} value={row.min} onChange={e => updateFreight(row.id, 'min', e.target.value)} /></td>
                                                <td style={tdStyle}><input type="number" placeholder="0.00" style={{...inputStyle, textAlign: 'right', fontWeight: '600', color: '#2563eb'}} value={row.normal} onChange={e => updateFreight(row.id, 'normal', e.target.value)} /></td>
                                                <td style={tdStyle}><input type="number" placeholder="0.00" style={{...inputStyle, textAlign: 'right', fontWeight: '600', color: '#2563eb'}} value={row.plus45} onChange={e => updateFreight(row.id, 'plus45', e.target.value)} /></td>
                                                <td style={tdStyle}><input type="number" placeholder="0.00" style={{...inputStyle, textAlign: 'right', fontWeight: '600', color: '#2563eb'}} value={row.plus100} onChange={e => updateFreight(row.id, 'plus100', e.target.value)} /></td>
                                                <td style={tdStyle}><input type="number" placeholder="0.00" style={{...inputStyle, textAlign: 'right', fontWeight: '600', color: '#2563eb'}} value={row.plus300} onChange={e => updateFreight(row.id, 'plus300', e.target.value)} /></td>
                                                <td style={tdStyle}><input type="number" placeholder="0.00" style={{...inputStyle, textAlign: 'right', fontWeight: '600', color: '#2563eb'}} value={row.plus500} onChange={e => updateFreight(row.id, 'plus500', e.target.value)} /></td>
                                                <td style={tdStyle}><input type="number" placeholder="0.00" style={{...inputStyle, textAlign: 'right', fontWeight: '600', color: '#2563eb'}} value={row.plus1000} onChange={e => updateFreight(row.id, 'plus1000', e.target.value)} /></td>
                                                <td style={{...tdStyle, textAlign: 'center'}}>
                                                    <button onClick={() => removeFreightRow(row.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ padding: '12px 20px' }}>
                                <button onClick={addFreightRow} style={{ padding: '6px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Plus size={14}/> Add Rate Line
                                </button>
                            </div>
                        </div>
                    )}

                    <datalist id="gst-charge-list">{gstList.map(g => <option key={g.id} value={g.name}>{(g.sac || '') + ' | ' + (g.exempt ? 'exempt' : (g.gstRate ?? 18) + '%')}</option>)}</datalist>
                    {/* TAB: LOCAL CHARGES - ADVANCED RULE ENGINE */}
                    {activeTab === 'local' && (
                        <div style={{ padding: '0' }}>
                            <div style={{ padding: '12px 20px', background: '#fef2f2', borderBottom: '1px solid #fecaca', fontSize: '13px', color: '#991b1b' }}>
                                Charges billed on every job of this customer. Pick each charge from Accounts &gt; GST Charges (its SAC and GST % come from there), choose the jobs it applies to, the basis and the rate. Reimbursement / At Actuals charges (duty, DO, stamp duty...) are billed at the actual cost booked on the docket, not at a rate.
                            </div>
                            <div style={{ overflowX: 'auto', padding: '20px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1200px' }}>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>GST Charge <br/><span style={{fontSize:'9px', color:'#64748b', fontWeight:'normal'}}>(Accounts &gt; GST Charges - prints on the invoice)</span></th>
                                            <th style={thStyle}>Applies To</th>
                                            <th style={thStyle}>Calculation Basis</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>Rate/Amount</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>Min Limit</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>Max Limit</th>
                                            <th style={thStyle}>Curr.</th>
                                            <th style={{...thStyle, textAlign: 'center'}}>Mandatory</th>
                                            <th style={thStyle}>Charge Type</th>
                                            <th style={{...thStyle, width: '40px'}}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {localCharges.map(charge => (
                                            <tr key={charge.id}>
                                                <td style={tdStyle}>{gstPick(charge.printName, v => updateCharge(charge.id, 'printName', v), 'e.g. AGENCY CHARGES')}</td>
                                                <td style={tdStyle}>
                                                    <select style={{ ...inputStyle, width: '120px' }} value={charge.appliesTo || 'ALL'} onChange={e => updateCharge(charge.id, 'appliesTo', e.target.value)}>
                                                        <option value="ALL">All jobs</option><option value="AE">Air Export</option><option value="AI">Air Import</option><option value="SE">Sea Export</option><option value="SI">Sea Import</option>
                                                    </select>
                                                </td>
                                                <td style={tdStyle}>
                                                    <select style={inputStyle} value={charge.basis} onChange={e => updateCharge(charge.id, 'basis', e.target.value)}>
                                                        <optgroup label="General / Air">
                                                            <option value="Flat">Flat / Fixed</option>
                                                            <option value="Per KG (ChW)">Per KG (Chargeable Wt)</option>
                                                            <option value="Per KG (GrW)">Per KG (Gross Wt)</option>
                                                            <option value="Per HAWB">Per HAWB / HBL</option>
                                                            <option value="Per Pkg">Per Package</option>
                                                        </optgroup>
                                                        <optgroup label="Sea Freight">
                                                            <option value="Per CBM (LCL)">Per CBM (LCL)</option>
                                                            <option value="FCL 20'">Per 20' Container (FCL)</option>
                                                            <option value="FCL 40'">Per 40' Container (FCL)</option>
                                                        </optgroup>
                                                        <optgroup label="Customs / Value">
                                                            <option value="% of Ass. Value">% of Assessable Value</option>
                                                            <option value="% of Duty">% of Total Duty</option>
                                                            <option value="Actuals">At Actuals</option>
                                                        </optgroup>
                                                    </select>
                                                </td>
                                                <td style={tdStyle}>
                                                    <input type="number" placeholder="0.00" style={{...inputStyle, textAlign: 'right', color: '#0f172a', fontWeight: '600'}} value={charge.rate} onChange={e => updateCharge(charge.id, 'rate', e.target.value)} />
                                                </td>
                                                <td style={tdStyle}>
                                                    <input type="number" placeholder="Min" style={{...inputStyle, textAlign: 'right'}} value={charge.minAmt} onChange={e => updateCharge(charge.id, 'minAmt', e.target.value)} disabled={charge.basis === 'Flat' || charge.basis === 'Actuals'} />
                                                </td>
                                                <td style={tdStyle}>
                                                    <input type="number" placeholder="Max" style={{...inputStyle, textAlign: 'right'}} value={charge.maxAmt} onChange={e => updateCharge(charge.id, 'maxAmt', e.target.value)} disabled={charge.basis === 'Flat' || charge.basis === 'Actuals'} />
                                                </td>
                                                <td style={tdStyle}>
                                                    <select style={inputStyle} value={charge.currency} onChange={e => updateCharge(charge.id, 'currency', e.target.value)}>
                                                        <option value="INR">INR</option>
                                                        <option value="USD">USD</option>
                                                        <option value="EUR">EUR</option>
                                                    </select>
                                                </td>
                                                <td style={{...tdStyle, textAlign: 'center'}}>
                                                    <input type="checkbox" checked={charge.mandatory} onChange={e => updateCharge(charge.id, 'mandatory', e.target.checked)} style={{ transform: 'scale(1.2)' }} />
                                                </td>
                                                <td style={tdStyle}>
                                                    <select style={{...inputStyle, background: charge.type === 'Reimbursement' ? '#f0fdf4' : '#fff', color: charge.type === 'Reimbursement' ? '#166534' : '#334155'}} value={charge.type} onChange={e => updateCharge(charge.id, 'type', e.target.value)}>
                                                        <option value="Taxable">Taxable (GST)</option>
                                                        <option value="Reimbursement">Reimbursement (Pure Agent) - billed at actual cost</option>
                                                    </select>
                                                </td>
                                                <td style={{...tdStyle, textAlign: 'center'}}>
                                                    <button onClick={() => removeChargeRow(charge.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div style={{ marginTop: '12px' }}>
                                    <button onClick={addChargeRow} style={{ padding: '6px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Plus size={14}/> Add Custom Charge Rule
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: TRANSPORT / CARTAGE */}
                    {activeTab === 'transport' && (
                        <div style={{ padding: '20px' }}>
                            <div style={{ padding: '12px 20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#166534' }}>
                                Map point-to-point transportation / cartage rates based on the vehicle type.
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: '900px' }}>
                                <thead>
                                    <tr>
                                        <th style={thStyle}>Pickup Location (From)</th>
                                        <th style={thStyle}>Drop Location (To)</th>
                                        <th style={thStyle}>Vehicle Type</th>
                                        <th style={thStyle}>GST Charge</th>
                                        <th style={{...thStyle, textAlign: 'right'}}>Fixed Amount</th>
                                        <th style={thStyle}>Currency</th>
                                        <th style={{...thStyle, width: '40px'}}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transportRates.map(route => (
                                        <tr key={route.id}>
                                            <td style={tdStyle}>
                                                <input type="text" placeholder="e.g. Mahipalpur" style={inputStyle} value={route.fromLoc} onChange={e => updateTransport(route.id, 'fromLoc', e.target.value)} />
                                            </td>
                                            <td style={tdStyle}>
                                                <input type="text" placeholder="e.g. Gurgaon" style={inputStyle} value={route.toLoc} onChange={e => updateTransport(route.id, 'toLoc', e.target.value)} />
                                            </td>
                                            <td style={tdStyle}>
                                                <select style={inputStyle} value={route.vehicle} onChange={e => updateTransport(route.id, 'vehicle', e.target.value)}>
                                                    <option value="Tata Ace">Tata Ace / Chota Hathi</option>
                                                    <option value="Tata 407">Tata 407</option>
                                                    <option value="Eicher 14ft">Eicher 14ft</option>
                                                    <option value="Eicher 17ft">Eicher 17ft</option>
                                                    <option value="22-Tyre Trailer">22-Tyre Trailer</option>
                                                    <option value="Per KG">Per KG (Loose Cargo)</option>
                                                </select>
                                            </td>
                                            <td style={tdStyle}>{gstPick(route.chargeName, v => updateTransport(route.id, 'chargeName', v), 'e.g. TRANSPORTATION CHARGES')}</td>
                                            <td style={tdStyle}>
                                                <input type="number" placeholder="0.00" style={{...inputStyle, textAlign: 'right', color: '#166534', fontWeight: '700'}} value={route.amount} onChange={e => updateTransport(route.id, 'amount', e.target.value)} />
                                            </td>
                                            <td style={tdStyle}>
                                                <select style={inputStyle} value={route.currency} onChange={e => updateTransport(route.id, 'currency', e.target.value)}>
                                                    <option value="INR">INR</option>
                                                    <option value="USD">USD</option>
                                                </select>
                                            </td>
                                            <td style={{...tdStyle, textAlign: 'center'}}>
                                                <button onClick={() => removeTransportRow(route.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ marginTop: '12px' }}>
                                <button onClick={addTransportRow} style={{ padding: '6px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Plus size={14}/> Add Transport Route
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB: TERMS */}
                    {activeTab === 'terms' && (
                        <div style={{ padding: '24px', display: 'flex', gap: '30px' }}>
                            <div style={{ flex: '1.5' }}>
                                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#1e293b' }}>Standard Terms & Conditions</h3>
                                <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748b' }}>These terms will be printed on the final quotation and job invoices.</p>
                                <textarea 
                                    style={{...inputStyle, height: '200px', resize: 'vertical', lineHeight: '1.5'}} 
                                    value={terms} 
                                    onChange={e => setTerms(e.target.value)}
                                ></textarea>
                            </div>

                            <div style={{ flex: '1', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#0f172a' }}>Billing & Automation Preferences</h3>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                                        <input type="checkbox" style={{ marginTop: '3px', transform: 'scale(1.2)', accentColor: '#2563eb' }} checked={!!prefs.splitInvoicing} onChange={e => setPrefs(p => ({ ...p, splitInvoicing: e.target.checked }))} />
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Require Split Invoicing</div>
                                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>System will automatically force separation of Freight bills and Local/Customs bills for this client to comply with TDS/Tax rules.</div>
                                        </div>
                                    </label>
                                    
                                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                                        <input type="checkbox" style={{ marginTop: '3px', transform: 'scale(1.2)', accentColor: '#2563eb' }} checked={!!prefs.consolidatedBilling} onChange={e => setPrefs(p => ({ ...p, consolidatedBilling: e.target.checked }))} />
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Fortnightly / Consolidated Billing</div>
                                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Block single job invoicing. Push all shipments to the Bulk Billing engine automatically.</div>
                                        </div>
                                    </label>
                                    
                                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                                        <input type="checkbox" style={{ marginTop: '3px', transform: 'scale(1.2)', accentColor: '#2563eb' }} checked={!!prefs.autoEmailInvoices} onChange={e => setPrefs(p => ({ ...p, autoEmailInvoices: e.target.checked }))} />
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Auto-Email Invoices</div>
                                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Automatically dispatch the finalized PDF invoice to the client's registered email.</div>
                                        </div>
                                    </label>

                                    <hr style={{ border: 'none', borderTop: '1px solid #cbd5e1', margin: '8px 0' }} />

                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>Special Billing Instructions (Internal)</label>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>Notes for the Accounts team (e.g. "Courier physical copy to HQ", "Deduct TDS before paying duty").</div>
                                        <textarea 
                                            placeholder="Enter any custom rules or special instructions here..."
                                            value={prefs.billingNotes} onChange={e => setPrefs(p => ({ ...p, billingNotes: e.target.value }))}
                                            style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none', width: '100%', fontFamily: 'inherit', height: '80px', resize: 'vertical' }}
                                        ></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
