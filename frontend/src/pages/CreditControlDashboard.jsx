import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Filter, PhoneCall, Mail, FileText, AlertTriangle, Calendar, MessageSquare, Upload, CheckCircle, RefreshCcw, Send } from 'lucide-react';
import toast from 'react-hot-toast';

// 30-Oct-2026: every number on this screen used to be invented - four hardcoded customers
// ("Apex Global Logistics 12,50,000", "TechCorp 34,00,000"), hardcoded KPI cards, a hardcoded
// pending-invoice table, two made-up "Communication History" entries, an invented reconciliation
// result and three read-only switches. It now reads /api/credit-control, the follow-ups are
// stored, the switches are saved, and the client-ledger upload really matches the file.
export default function CreditControlDashboard() {
    const [selectedId, setSelectedId] = useState(null);
    const [activeTab, setActiveTab] = useState('invoices');
    const [clients, setClients] = useState([]);
    const [kpis, setKpis] = useState(null);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [asOn, setAsOn] = useState(new Date().toISOString().slice(0, 10));

    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [followUpNote, setFollowUpNote] = useState('');
    const [promiseDate, setPromiseDate] = useState('');
    const [promiseAmount, setPromiseAmount] = useState('');
    const [channel, setChannel] = useState('CALL');
    const [savingNote, setSavingNote] = useState(false);
    const [policy, setPolicy] = useState(null);
    const [reco, setReco] = useState(null);
    const [recoBusy, setRecoBusy] = useState(false);
    const fileRef = useRef(null);

    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const r = await fetch('/api/credit-control/ageing?type=receivable&asOn=' + asOn, { headers: auth() });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            setClients(j.clients || []);
            setKpis(j.kpis || null);
            setMeta(j);
        } catch (err) {
            setClients([]); setKpis(null); setError(err.message);
        }
        setLoading(false);
    }, [asOn]);
    useEffect(() => { load(); }, [load]);

    const loadDetail = useCallback(async (id) => {
        if (!id) { setDetail(null); return; }
        setDetailLoading(true);
        try {
            const r = await fetch('/api/credit-control/party/' + id + '?asOn=' + asOn, { headers: auth() });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            setDetail(j);
            setPolicy(j.policy || { autoSendLedger: false, autoSendDays: '1,15', overdueReminders: false, reminderAfterDays: 10, autoHoldDelivery: false });
            setReco(null);
        } catch (err) {
            setDetail(null); toast.error('Could not load the customer: ' + err.message);
        }
        setDetailLoading(false);
    }, [asOn]);
    useEffect(() => { loadDetail(selectedId); }, [selectedId, loadDetail]);

    const selectedClient = clients.find(c => c.ledgerId === selectedId) || null;

    const handleLogFollowup = async () => {
        if (!selectedId) return toast.error('Pick a customer first');
        if (!followUpNote.trim()) return toast.error('Write what was said - a follow-up with no note is no record');
        setSavingNote(true);
        try {
            const r = await fetch('/api/credit-control/followups', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ ledgerId: selectedId, note: followUpNote.trim(), channel, promiseDate: promiseDate || null, promiseAmount: promiseAmount || null }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            toast.success('Follow-up logged');
            setFollowUpNote(''); setPromiseDate(''); setPromiseAmount('');
            await loadDetail(selectedId);
            await load();                                   // the Expected-this-week KPI depends on promises
        } catch (err) { toast.error('Not saved: ' + err.message); }
        setSavingNote(false);
    };

    const markPromise = async (id, met) => {
        try {
            const r = await fetch('/api/credit-control/followups/' + id, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ promiseMet: met }),
            });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            await loadDetail(selectedId); await load();
        } catch (err) { toast.error(err.message); }
    };

    const savePolicy = async (patch) => {
        if (!selectedId) return;
        const next = { ...policy, ...patch };
        setPolicy(next);
        try {
            const r = await fetch('/api/credit-control/policy/' + selectedId, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth() }, body: JSON.stringify(next),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            setPolicy(j.data);
            toast.success('Saved');
        } catch (err) {
            toast.error('Not saved: ' + err.message);
            await loadDetail(selectedId);
        }
    };

    const handleSendStatement = async () => {
        if (!detail || !detail.party) return;
        const to = detail.party.email;
        if (!to) return toast.error('No email address on this ledger - add one in Chart of Accounts first');
        if (!detail.bills || !detail.bills.length) return toast.error('Nothing outstanding - no statement to send');
        const lines = detail.bills.map(b =>
            (b.date || '') + '  ' + (b.refNo || '') + (b.billNo ? ' (' + b.billNo + ')' : '') +
            '  ' + b.pending.toLocaleString('en-IN') + (b.overdueDays > 0 ? '  ' + b.overdueDays + ' days overdue' : '  within terms')).join('\n');
        const body = 'Dear ' + (detail.party.contactPerson || 'Sir / Madam') + ',\n\n' +
            'Statement of account as on ' + asOn + ':\n\n' + lines +
            '\n\nTotal outstanding: ' + detail.total.toLocaleString('en-IN') +
            '\n\nBasis: ' + (detail.basis || '') + '\n';
        try {
            const r = await fetch('/api/email/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ to, subject: 'Statement of account as on ' + asOn, text: body }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            toast.success('Statement emailed to ' + to);
            // the mail itself is part of the collection history
            await fetch('/api/credit-control/followups', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ ledgerId: selectedId, channel: 'EMAIL', note: 'Statement of account as on ' + asOn + ' emailed to ' + to }),
            }).catch(() => {});
            await loadDetail(selectedId);
        } catch (err) {
            toast.error('Not sent: ' + err.message + ' (check Settings > Email)');
        }
    };

    // the client's own ledger: the browser reads the Excel / CSV, the server matches it
    const onLedgerFile = async (e) => {
        const f = (e.target.files || [])[0];
        if (fileRef.current) fileRef.current.value = '';
        if (!f) return;
        if (!selectedId) return toast.error('Pick a customer first');
        if (/\.pdf$/i.test(f.name)) {
            return toast.error('A PDF statement cannot be matched reliably. Ask the customer for the ledger as Excel or CSV.');
        }
        if (!/\.(xlsx|xls|csv|txt)$/i.test(f.name)) {
            return toast.error('Use an Excel (.xlsx / .xls) or CSV file');
        }
        setRecoBusy(true);
        try {
            const XLSX = await import('xlsx');
            const buf = await f.arrayBuffer();
            const wb = XLSX.read(buf, { type: 'array' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            if (!raw.length) throw new Error('That sheet has no rows');
            // find the reference and amount columns by their headings, whatever they are called
            const keys = Object.keys(raw[0]);
            const find = (words) => keys.find(k => words.some(w => String(k).toLowerCase().includes(w)));
            const refKey = find(['invoice', 'bill', 'ref', 'doc', 'particular', 'narration']);
            const crKey = find(['credit', 'cr']);
            const drKey = find(['debit', 'dr']);
            const amtKey = find(['amount', 'balance', 'value']);
            const dateKey = find(['date']);
            if (!refKey && !amtKey && !crKey && !drKey) {
                throw new Error('Could not find a reference or amount column. Headings seen: ' + keys.slice(0, 8).join(', '));
            }
            const rows = raw.map(r => ({
                ref: refKey ? r[refKey] : '', date: dateKey ? r[dateKey] : '',
                credit: crKey ? r[crKey] : '', debit: drKey ? r[drKey] : '',
                amount: amtKey ? r[amtKey] : '',
            }));
            const rr = await fetch('/api/credit-control/ledger-match', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ ledgerId: selectedId, rows, asOn }),
            });
            const j = await rr.json().catch(() => ({}));
            if (!rr.ok || j.success === false) throw new Error(j.error || ('HTTP ' + rr.status));
            setReco({ ...j, fileName: f.name, at: new Date().toLocaleString('en-GB') });
            toast.success(j.counts.matched + ' matched, ' + j.counts.variances + ' variance(s)');
        } catch (err) {
            toast.error('Could not read that file: ' + err.message);
        }
        setRecoBusy(false);
    };

    const formatCurrency = (amount) => '₹' + amount.toLocaleString('en-IN');

    // UI Styles
    const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };
    const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' };
    const tdStyle = { padding: '12px', fontSize: '13px', color: '#334155', borderBottom: '1px solid #f1f5f9' };
    const inputStyle = { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none', width: '100%', fontFamily: 'inherit' };
    
    const AgeingBar = ({ buckets, total }) => {
        if (!buckets || !total) return null;
        const getPct = (val) => (val / total) * 100 + '%';
        // money still inside the customer's credit days is shown separately from overdue money -
        // the old bar lumped them together, which made a healthy account look late
        return (
            <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', marginTop: '8px', background: '#f1f5f9' }}>
                {buckets.notDue > 0 && <div style={{ width: getPct(buckets.notDue), background: '#3b82f6' }} title={`Within terms: ${formatCurrency(buckets.notDue)}`}></div>}
                {buckets.b15 > 0 && <div style={{ width: getPct(buckets.b15), background: '#10b981' }} title={`1-15 days overdue: ${formatCurrency(buckets.b15)}`}></div>}
                {buckets.b30 > 0 && <div style={{ width: getPct(buckets.b30), background: '#f59e0b' }} title={`16-30 days overdue: ${formatCurrency(buckets.b30)}`}></div>}
                {buckets.b60 > 0 && <div style={{ width: getPct(buckets.b60), background: '#f97316' }} title={`31-60 days overdue: ${formatCurrency(buckets.b60)}`}></div>}
                {buckets.b90 > 0 && <div style={{ width: getPct(buckets.b90), background: '#ef4444' }} title={`60+ days overdue: ${formatCurrency(buckets.b90)}`}></div>}
            </div>
        );
    };

    const shownClients = clients.filter(c => !search ||
        [c.name, c.gstin, c.email, c.contactPerson].some(v => String(v || '').toLowerCase().includes(search.toLowerCase())));
    const money = (n) => '\u20b9 ' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

    return (
        <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: '700', letterSpacing: '-0.5px' }}>Credit Control & Ageing Dashboard</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Advanced Accounts Receivable CRM & Ledger Reconciliation</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="date" value={asOn} onChange={e => setAsOn(e.target.value)} title="Ageing as on"
                        style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} />
                    {/* 30-Oct-2026: this said "Sync ERP Data". There is no outside ERP - these figures ARE the
                        ledger in this system - so it refreshes them instead of pretending to import. */}
                    <button onClick={load} disabled={loading} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '4px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', cursor: loading ? 'wait' : 'pointer' }}>
                        <RefreshCcw size={16}/> {loading ? 'Reading the ledger...' : 'Refresh from ledger'}
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '20px' }}>
                <div style={{ ...cardStyle, borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Total Outstanding</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>{kpis ? money(kpis.totalOutstanding) : '-'}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{kpis ? money(kpis.notDue) + ' still within terms' : ''}</div>
                </div>
                <div style={{ ...cardStyle, borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Overdue (31-60 Days)</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b', marginTop: '4px' }}>{kpis ? money(kpis.overdue31to60) : '-'}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{kpis ? money(kpis.overdue1to30) + ' at 1-30 days' : ''}</div>
                </div>
                <div style={{ ...cardStyle, borderLeft: '4px solid #ef4444' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Critical (60+ Days)</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444', marginTop: '4px' }}>{kpis ? money(kpis.critical60plus) : '-'}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{kpis && kpis.partiesOverLimit ? kpis.partiesOverLimit + ' part(y/ies) over credit limit' : ''}</div>
                </div>
                <div style={{ ...cardStyle, borderLeft: '4px solid #10b981', background: '#f0fdf4' }}>
                    <div style={{ fontSize: '12px', color: '#166534', fontWeight: '600', textTransform: 'uppercase' }}>Expected This Week</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#15803d', marginTop: '4px' }}>{kpis ? money(kpis.expectedThisWeek) : '-'}</div>
                    <div style={{ fontSize: '11px', color: '#166534', marginTop: '4px' }}>
                        {kpis ? (kpis.promisesCounted ? 'From ' + kpis.promisesCounted + ' logged Promise-to-Pay date(s)' : 'No Promise-to-Pay logged - this is not a forecast') : ''}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                
                {/* Left Panel: Client List */}
                <div style={{ flex: '1', ...cardStyle, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Client..." style={{ ...inputStyle, paddingLeft: '32px' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b' }}><div style={{ width:'8px',height:'8px',background:'#3b82f6',borderRadius:'50%'}}></div> within terms</span>
                            <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b' }}><div style={{ width:'8px',height:'8px',background:'#10b981',borderRadius:'50%'}}></div> 1-15d</span>
                            <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b' }}><div style={{ width:'8px',height:'8px',background:'#f59e0b',borderRadius:'50%'}}></div> 16-30d</span>
                            <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b' }}><div style={{ width:'8px',height:'8px',background:'#f97316',borderRadius:'50%'}}></div> 31-60d</span>
                            <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b' }}><div style={{ width:'8px',height:'8px',background:'#ef4444',borderRadius:'50%'}}></div> 60d+</span>
                        </div>
                    </div>
                    
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        {loading && <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>Reading the ledger...</div>}
                        {!loading && error && <div style={{ padding: '24px', fontSize: '13px', color: '#b91c1c' }}>{error}</div>}
                        {!loading && !error && !clients.length && (
                            <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                Nothing outstanding from any customer as on {asOn.split('-').reverse().join('-')}.
                                {meta && meta.note ? ' ' + meta.note : ''}
                            </div>
                        )}
                        {shownClients.map(client => (
                            <div 
                                key={client.id} 
                                onClick={() => setSelectedId(client.ledgerId)}
                                style={{ 
                                    padding: '16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                                    background: selectedId === client.ledgerId ? '#eff6ff' : '#fff',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{client.name}</div>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: client.risk === 'High' ? '#ef4444' : '#0f172a' }}>{formatCurrency(client.totalOut)}</div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                        {client.creditLimit ? 'Limit: ' + formatCurrency(client.creditLimit) + (client.utilisationPct != null ? ' (' + client.utilisationPct + '% used)' : '') : 'No credit limit set'}
                                        {client.billCount ? ' \u00b7 ' + client.billCount + ' bill(s)' : ''}
                                    </div>
                                    {client.overLimit && <AlertTriangle size={12} color="#ef4444" title="Exceeds credit limit" />}
                                </div>
                                <AgeingBar buckets={client.buckets} total={client.totalOut} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel: Client Details & Operations */}
                <div style={{ flex: '2.5', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {selectedClient && detail ? (
                        <>
                            {/* Client Header Info */}
                            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>{selectedClient.name}{detailLoading ? ' ...' : ''}</h3>
                                    <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '13px', color: '#64748b', flexWrap: 'wrap' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><PhoneCall size={14}/> {(detail && detail.party.phone) || 'no phone on the ledger'}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={14}/> {(detail && detail.party.email) || 'no email on the ledger'}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: selectedClient.risk === 'High' ? '#ef4444' : selectedClient.risk === 'Medium' ? '#d97706' : '#10b981' }}>
                                            <AlertTriangle size={14}/> Risk: {selectedClient.risk} &mdash; {selectedClient.riskWhy}
                                        </span>
                                        <span>Credit {selectedClient.creditDays || 0} days</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={handleSendStatement} style={{ padding: '8px 16px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '4px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                                        <FileText size={16}/> Email Ledger
                                    </button>
                                </div>
                            </div>

                            {/* Detailed Tabs */}
                            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                    <div onClick={() => setActiveTab('invoices')} style={{ padding: '14px 24px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', borderBottom: activeTab === 'invoices' ? '2px solid #2563eb' : '2px solid transparent', color: activeTab === 'invoices' ? '#2563eb' : '#64748b', background: activeTab === 'invoices' ? '#fff' : 'transparent' }}>
                                        🧾 Pending Invoices
                                    </div>
                                    <div onClick={() => setActiveTab('followups')} style={{ padding: '14px 24px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', borderBottom: activeTab === 'followups' ? '2px solid #2563eb' : '2px solid transparent', color: activeTab === 'followups' ? '#2563eb' : '#64748b', background: activeTab === 'followups' ? '#fff' : 'transparent' }}>
                                        📞 CRM & Follow-ups
                                    </div>
                                    <div onClick={() => setActiveTab('reco')} style={{ padding: '14px 24px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', borderBottom: activeTab === 'reco' ? '2px solid #2563eb' : '2px solid transparent', color: activeTab === 'reco' ? '#2563eb' : '#64748b', background: activeTab === 'reco' ? '#fff' : 'transparent' }}>
                                        ⚖️ Ledger Auto-Reco
                                    </div>
                                    <div onClick={() => setActiveTab('settings')} style={{ padding: '14px 24px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', borderBottom: activeTab === 'settings' ? '2px solid #2563eb' : '2px solid transparent', color: activeTab === 'settings' ? '#2563eb' : '#64748b', background: activeTab === 'settings' ? '#fff' : 'transparent' }}>
                                        ⚙️ Auto-Mail Rules
                                    </div>
                                </div>

                                <div style={{ padding: '20px', minHeight: '400px' }}>
                                    
                                    {/* TAB: INVOICES */}
                                    {activeTab === 'invoices' && (
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr>
                                                    <th style={thStyle}>Date</th>
                                                    <th style={thStyle}>Voucher No</th>
                                                    <th style={thStyle}>Bill / Job Ref</th>
                                                    <th style={thStyle}>Due Date</th>
                                                    <th style={{...thStyle, textAlign: 'right'}}>Pending (\u20b9)</th>
                                                    <th style={{...thStyle, textAlign: 'center'}}>Ageing</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detail.bills.map(b => {
                                                    const od = b.overdueDays;
                                                    const tag = od > 60 ? { bg: '#fee2e2', fg: '#991b1b' }
                                                        : od > 30 ? { bg: '#ffedd5', fg: '#9a3412' }
                                                        : od > 0 ? { bg: '#fef3c7', fg: '#92400e' }
                                                        : { bg: '#dcfce7', fg: '#166534' };
                                                    return (
                                                        <tr key={b.id}>
                                                            <td style={tdStyle}>{b.date ? b.date.split('-').reverse().join('-') : '\u2014'}</td>
                                                            <td style={{...tdStyle, color: '#2563eb', fontWeight: '500'}}>{b.refNo}</td>
                                                            <td style={tdStyle}>{[b.billNo, b.jobNo].filter(Boolean).join(' / ') || '\u2014'}</td>
                                                            <td style={tdStyle}>{b.dueDate ? b.dueDate.split('-').reverse().join('-') : '\u2014'}</td>
                                                            <td style={{...tdStyle, textAlign: 'right', fontWeight: '600'}}>{b.pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                            <td style={{...tdStyle, textAlign: 'center'}}>
                                                                <span style={{ background: tag.bg, color: tag.fg, padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
                                                                    {od > 0 ? od + ' days overdue' : 'Within terms'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {!detail.bills.length && (
                                                    <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>Nothing outstanding from this customer.</td></tr>
                                                )}
                                            </tbody>
                                            <tfoot>
                                                <tr>
                                                    <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>Total</td>
                                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{detail.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                    <td style={tdStyle}></td>
                                                </tr>
                                                <tr><td colSpan={6} style={{ padding: '10px 12px', fontSize: '11px', color: '#64748b' }}>{detail.basis}</td></tr>
                                            </tfoot>
                                        </table>
                                    )}

                                    {/* TAB: FOLLOW UPS */}
                                    {activeTab === 'followups' && (
                                        <div style={{ display: 'flex', gap: '24px' }}>
                                            <div style={{ flex: '1' }}>
                                                <h4 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>Log New Follow-up</h4>
                                                <div style={{ display: 'grid', gap: '16px' }}>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: '600' }}>How did you reach them?</label>
                                                        <select value={channel} onChange={e => setChannel(e.target.value)} style={inputStyle}>
                                                            <option value="CALL">Phone call</option>
                                                            <option value="EMAIL">Email</option>
                                                            <option value="WHATSAPP">WhatsApp</option>
                                                            <option value="VISIT">Visit</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: '600' }}>Communication Notes</label>
                                                        <textarea rows="4" style={{...inputStyle, resize: 'vertical'}} placeholder="E.g. Spoke to Accounts Manager. They said cheque will be signed by Friday." value={followUpNote} onChange={e => setFollowUpNote(e.target.value)}></textarea>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: '600' }}>Promise to Pay (PTP) Date</label>
                                                            <input type="date" style={inputStyle} value={promiseDate} onChange={e => setPromiseDate(e.target.value)}/>
                                                        </div>
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: '600' }}>Amount promised (\u20b9)</label>
                                                            <input type="number" style={inputStyle} value={promiseAmount} onChange={e => setPromiseAmount(e.target.value)} placeholder="blank = whole outstanding"/>
                                                        </div>
                                                    </div>
                                                    <button onClick={handleLogFollowup} disabled={savingNote} style={{ padding: '10px', background: savingNote ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: savingNote ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                                        <MessageSquare size={16}/> {savingNote ? 'Saving...' : 'Save Follow-up Log'}
                                                    </button>
                                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                        A Promise-to-Pay date feeds the &quot;Expected This Week&quot; figure at the top. Without one, that figure stays zero.
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ flex: '1.5', borderLeft: '1px solid #e2e8f0', paddingLeft: '24px' }}>
                                                <h4 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>Communication History</h4>
                                                {!detail.followUps.length && (
                                                    <div style={{ fontSize: '13px', color: '#64748b' }}>Nothing logged for this customer yet.</div>
                                                )}
                                                <div style={{ borderLeft: detail.followUps.length ? '2px solid #cbd5e1' : 'none', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                    {detail.followUps.map(f => {
                                                        const Icon = f.channel === 'EMAIL' ? Mail : f.channel === 'VISIT' ? Calendar : f.channel === 'SYSTEM' ? Send : PhoneCall;
                                                        const colour = f.channel === 'SYSTEM' ? '#94a3b8' : '#2563eb';
                                                        return (
                                                            <div key={f.id} style={{ position: 'relative' }}>
                                                                <div style={{ position: 'absolute', left: '-25px', top: '0', background: '#fff', border: '2px solid ' + colour, borderRadius: '50%', padding: '4px', color: colour }}><Icon size={12}/></div>
                                                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                                                                    {new Date(f.createdAt).toLocaleString('en-GB')} &middot; {f.channel}
                                                                    {f.createdByName ? ' \u00b7 ' + f.createdByName : ''}
                                                                </div>
                                                                <div style={{ fontSize: '13px', color: '#334155', marginTop: '4px', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>
                                                                    {f.note}
                                                                </div>
                                                                {f.promiseDate && (
                                                                    <div style={{ fontSize: '11px', fontWeight: '700', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px',
                                                                        color: f.promiseMet === true ? '#16a34a' : f.promiseMet === false ? '#dc2626' : '#b45309' }}>
                                                                        <Calendar size={12}/> Promised {f.promiseDate.split('-').reverse().join('-')}
                                                                        {f.promiseAmount ? ' for \u20b9 ' + Number(f.promiseAmount).toLocaleString('en-IN') : ''}
                                                                        {f.promiseMet === true ? ' \u00b7 kept' : f.promiseMet === false ? ' \u00b7 broken' : ''}
                                                                        {f.promiseMet == null && (
                                                                            <>
                                                                                <button onClick={() => markPromise(f.id, true)} style={{ background: 'none', border: '1px solid #16a34a', color: '#16a34a', borderRadius: '4px', fontSize: '10px', padding: '1px 6px', cursor: 'pointer' }}>kept</button>
                                                                                <button onClick={() => markPromise(f.id, false)} style={{ background: 'none', border: '1px solid #dc2626', color: '#dc2626', borderRadius: '4px', fontSize: '10px', padding: '1px 6px', cursor: 'pointer' }}>broken</button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB: RECO */}
                                    {activeTab === 'reco' && (
                                        <div>
                                            {/* 30-Oct-2026: this box claimed "Our AI engine will read their statement" and showed an
                                                invented result. No AI is needed or used: the browser reads the Excel / CSV and the
                                                server matches it against our own open items by reference, then by amount. */}
                                            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" onChange={onLedgerFile} style={{ display: 'none' }} />
                                            <div style={{ padding: '16px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '24px' }}>
                                                <Upload size={24} color="#64748b"/>
                                                <div style={{ fontSize: '14px', color: '#334155', fontWeight: '600' }}>Upload {selectedClient.name}&apos;s ledger (Excel or CSV)</div>
                                                <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', maxWidth: '520px' }}>
                                                    Their statement is matched against our open items: on the invoice / bill reference first,
                                                    then on the amount. A PDF cannot be matched reliably - ask them for Excel or CSV.
                                                </div>
                                                <button onClick={() => fileRef.current && fileRef.current.click()} disabled={recoBusy}
                                                    style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '4px', fontWeight: '600', cursor: recoBusy ? 'wait' : 'pointer', marginTop: '8px', fontSize: '12px' }}>
                                                    {recoBusy ? 'Reading and matching...' : 'Choose File'}
                                                </button>
                                            </div>

                                            {!reco && (
                                                <div style={{ fontSize: '13px', color: '#64748b' }}>No reconciliation run yet for this customer.</div>
                                            )}

                                            {reco && (
                                                <>
                                                    <h4 style={{ margin: '0 0 8px 0', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                                                        Reconciliation Results &mdash; {reco.fileName} ({reco.at})
                                                    </h4>
                                                    <div style={{ fontSize: '12px', color: '#475569', marginBottom: '16px' }}>
                                                        {reco.counts.rowsRead} row(s) read &middot; our books {reco.totals.ourBooks.toLocaleString('en-IN')} &middot;
                                                        their ledger {reco.totals.theirLedger.toLocaleString('en-IN')} &middot;
                                                        net variance {reco.totals.varianceValue.toLocaleString('en-IN')}
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#16a34a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={14}/> Matched ({reco.counts.matched})</div>
                                                            <div style={{ border: '1px solid #bbf7d0', borderRadius: '6px', overflow: 'hidden', maxHeight: '260px', overflowY: 'auto' }}>
                                                                {reco.matched.map((m, i) => (
                                                                    <div key={i} style={{ padding: '8px 12px', background: '#f0fdf4', fontSize: '12px', color: '#166534', borderBottom: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span>{m.ref}{m.billNo ? ' (' + m.billNo + ')' : ''} <span style={{ color: '#4ade80' }}>on {m.matchedOn}</span></span>
                                                                        <span>&#8377; {m.ours.toLocaleString('en-IN')}</span>
                                                                    </div>
                                                                ))}
                                                                {!reco.matched.length && <div style={{ padding: '10px 12px', fontSize: '12px', color: '#64748b' }}>Nothing matched.</div>}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <AlertTriangle size={14}/> Variances &amp; unmatched ({reco.counts.variances + reco.counts.oursOnly + reco.counts.theirsOnly})
                                                            </div>
                                                            <div style={{ border: '1px solid #fecaca', borderRadius: '6px', overflow: 'hidden', maxHeight: '260px', overflowY: 'auto' }}>
                                                                {reco.variances.map((v, i) => (
                                                                    <div key={'v' + i} style={{ padding: '8px 12px', background: '#fef2f2', fontSize: '12px', color: '#991b1b', borderBottom: '1px solid #fecaca' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}><span>{v.ref}</span> <span>Our book: &#8377; {v.ours.toLocaleString('en-IN')}</span></div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', color: '#dc2626' }}>
                                                                            <span>In their ledger</span> <span>&#8377; {v.theirs.toLocaleString('en-IN')} ({v.diff > 0 ? 'short by' : 'over by'} &#8377; {Math.abs(v.diff).toLocaleString('en-IN')})</span>
                                                                        </div>
                                                                        <div style={{ marginTop: '4px', color: '#7f1d1d', fontSize: '11px' }}>{v.hint}</div>
                                                                    </div>
                                                                ))}
                                                                {reco.oursOnly.map((o, i) => (
                                                                    <div key={'o' + i} style={{ padding: '8px 12px', background: '#fffbeb', fontSize: '12px', color: '#92400e', borderBottom: '1px solid #fde68a' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}><span>{o.ref}</span> <span>&#8377; {o.ours.toLocaleString('en-IN')}</span></div>
                                                                        <div style={{ marginTop: '2px', fontSize: '11px' }}>In our books only - not in their ledger</div>
                                                                    </div>
                                                                ))}
                                                                {reco.theirsOnly.map((t, i) => (
                                                                    <div key={'t' + i} style={{ padding: '8px 12px', background: '#eff6ff', fontSize: '12px', color: '#1e40af', borderBottom: '1px solid #bfdbfe' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}><span>{t.ref || '(no reference, line ' + t.line + ')'}</span> <span>&#8377; {t.amount.toLocaleString('en-IN')}</span></div>
                                                                        <div style={{ marginTop: '2px', fontSize: '11px' }}>In their ledger only - we have not booked it</div>
                                                                    </div>
                                                                ))}
                                                                {!reco.variances.length && !reco.oursOnly.length && !reco.theirsOnly.length && (
                                                                    <div style={{ padding: '10px 12px', fontSize: '12px', color: '#166534' }}>Everything agreed.</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div style={{ marginTop: '12px', fontSize: '11px', color: '#64748b' }}>{reco.note}</div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* TAB: SETTINGS */}
                                    {activeTab === 'settings' && policy && (
                                        <div style={{ maxWidth: '680px' }}>
                                            <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>Automation Rules for {selectedClient.name}</h4>
                                            {/* 30-Oct-2026: these three switches were hardcoded and read-only. They are saved per
                                                customer now. Nothing here sends mail by itself - these are the flags the reminder
                                                job and the delivery-release check read. */}
                                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
                                                Saved against this customer. The reminder job and the D/O release check read these flags.
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px' }}>
                                                <div>
                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>Auto-send statement of account</div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                                        On these days of the month:
                                                        <input type="text" value={policy.autoSendDays || ''} onChange={e => setPolicy({ ...policy, autoSendDays: e.target.value })}
                                                            onBlur={e => savePolicy({ autoSendDays: e.target.value })}
                                                            style={{ width: '90px', marginLeft: '8px', padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} />
                                                        <span style={{ marginLeft: '8px' }}>(e.g. 1,15)</span>
                                                    </div>
                                                    {!(detail && detail.party.email) && (
                                                        <div style={{ fontSize: '11px', color: '#b45309', marginTop: '4px' }}>This ledger has no email address, so nothing can be sent.</div>
                                                    )}
                                                </div>
                                                <input type="checkbox" checked={!!policy.autoSendLedger} onChange={e => savePolicy({ autoSendLedger: e.target.checked })} style={{ transform: 'scale(1.5)', accentColor: '#2563eb' }} />
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px' }}>
                                                <div>
                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>Overdue reminders</div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                                        Remind when a bill crosses
                                                        <input type="number" min="0" max="365" value={policy.reminderAfterDays ?? 10} onChange={e => setPolicy({ ...policy, reminderAfterDays: e.target.value })}
                                                            onBlur={e => savePolicy({ reminderAfterDays: e.target.value })}
                                                            style={{ width: '64px', margin: '0 8px', padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} />
                                                        days overdue (this customer&apos;s credit terms are {selectedClient.creditDays || 0} days).
                                                    </div>
                                                </div>
                                                <input type="checkbox" checked={!!policy.overdueReminders} onChange={e => savePolicy({ overdueReminders: e.target.checked })} style={{ transform: 'scale(1.5)', accentColor: '#2563eb' }} />
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                                <div>
                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>Hold D/O or Bill of Lading over the limit</div>
                                                    <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>
                                                        Block release of the Delivery Order while outstanding is over the credit limit
                                                        {selectedClient.creditLimit ? ' (\u20b9 ' + selectedClient.creditLimit.toLocaleString('en-IN') + ')' : ' - no limit is set on this ledger, so this flag has nothing to compare against'}.
                                                    </div>
                                                </div>
                                                <input type="checkbox" checked={!!policy.autoHoldDelivery} onChange={e => savePolicy({ autoHoldDelivery: e.target.checked })} style={{ transform: 'scale(1.5)', accentColor: '#2563eb' }} />
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ ...cardStyle, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexDirection: 'column', gap: '12px' }}>
                            <AlertTriangle size={48} opacity={0.5} />
                            <div style={{ fontSize: '16px', fontWeight: '600' }}>Select a client from the left to view credit details</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
