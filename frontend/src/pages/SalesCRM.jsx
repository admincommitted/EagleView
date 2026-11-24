import React, { useState, useEffect, useCallback } from 'react';
import { Users, FileText, Send, CheckCircle, Search, Plus, MapPin, Anchor, Briefcase, Mail, Phone, Calendar, User, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import AdvancedEnquiryForm from './AdvancedEnquiryForm';
import AdvancedQuoteForm from './AdvancedQuoteForm';

// 30-Oct-2026: this screen listed two invented leads with invented contact people and real-looking
// phone numbers, and two invented quotations. Sending a quote and converting one to a job only
// printed toasts, and Search Leads / Details / View PDF did nothing. It all reads /api/sales now.
const LEAD_COLOURS = { NEW: ['#dbeafe', '#1d4ed8'], QUOTED: ['#fef9c3', '#854d0e'], WON: ['#dcfce7', '#166534'], LOST: ['#fee2e2', '#991b1b'] };
const QUOTE_COLOURS = { DRAFT: ['#f1f5f9', '#475569'], SENT: ['#dbeafe', '#1d4ed8'], APPROVED: ['#fef08a', '#854d0e'], REJECTED: ['#fee2e2', '#991b1b'], CONVERTED: ['#dcfce7', '#166534'] };

export default function SalesCRM() {
    const [activeTab, setActiveTab] = useState('leads');
    const [leads, setLeads] = useState([]);
    const [quotes, setQuotes] = useState([]);
    const [counts, setCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [showQuoteForm, setShowQuoteForm] = useState(false);
    const [showEnquiryForm, setShowEnquiryForm] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);
    const [editQuote, setEditQuote] = useState(null);
    const [detailLead, setDetailLead] = useState(null);

    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const q = new URLSearchParams();
            if (search) q.set('q', search);
            if (statusFilter) q.set('status', statusFilter);
            const [lr, qr] = await Promise.all([
                fetch('/api/sales/leads?' + q.toString(), { headers: auth() }),
                fetch('/api/sales/quotes', { headers: auth() }),
            ]);
            const lj = await lr.json().catch(() => ({}));
            const qj = await qr.json().catch(() => ({}));
            if (!lr.ok || lj.success === false) throw new Error(lj.error || ('HTTP ' + lr.status));
            setLeads(lj.data || []);
            setQuotes(qj.data || []);
            setCounts({ leads: lj.counts || {}, quotes: qj.counts || {} });
        } catch (err) {
            setLeads([]); setQuotes([]); setError(err.message);
        }
        setLoading(false);
    }, [search, statusFilter]);
    useEffect(() => { load(); }, [load]);

    const handleCreateQuote = (lead) => {
        setSelectedLead(lead); setEditQuote(null); setShowQuoteForm(true);
    };
    const openQuote = (q) => {
        setEditQuote(q); setSelectedLead(null); setShowQuoteForm(true);
    };
    const afterQuote = async () => {
        setShowQuoteForm(false); setSelectedLead(null); setEditQuote(null);
        await load();
    };

    const setQuoteStatus = async (q, status, extra) => {
        try {
            const r = await fetch('/api/sales/quotes/' + q.id, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ status, ...(extra || {}) }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            toast.success('Marked ' + status.toLowerCase());
            await load();
        } catch (err) { toast.error(err.message); }
    };

    const handleReject = (q) => {
        const why = window.prompt('Why was quotation ' + q.quoteNo + ' rejected?');
        if (!why || !why.trim()) { toast.error('Not changed - a rejection needs a reason'); return; }
        setQuoteStatus(q, 'REJECTED', { rejectReason: why.trim() });
    };

    const handleConvertToJob = async (q) => {
        const jobNo = window.prompt('Which job number does quotation ' + q.quoteNo + ' become?\n(Create the job first in Import / Export Entry, then paste its job number here.)');
        if (!jobNo || !jobNo.trim()) { toast.error('Not converted - the job number links the quote to the job'); return; }
        try {
            const r = await fetch('/api/sales/quotes/' + q.id + '/convert', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ jobNo: jobNo.trim() }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            toast.success('Quotation ' + q.quoteNo + ' linked to job ' + jobNo.trim());
            await load();
        } catch (err) { toast.error('Not converted: ' + err.message); }
    };

    const handleSendQuote = async (q) => {
        const to = window.prompt('Email the quotation to:', q.email || '');
        if (!to || !to.trim()) return;
        try {
            const lines = (q.charges || []).map(c =>
                c.head + '  ' + c.currency + ' ' + Number(c.sellRate).toLocaleString('en-IN') +
                ' x ' + Number(c.qty) + (c.basis ? ' (' + c.basis + ')' : '')).join('\n');
            const body = 'Dear ' + (q.contactPerson || 'Sir / Madam') + ',\n\n' +
                'Our quotation ' + q.quoteNo + ' dated ' + q.date + ':\n\n' +
                (q.origin || q.destination ? 'Routing: ' + (q.origin || '?') + ' to ' + (q.destination || '?') + '\n' : '') +
                (q.mode ? 'Mode: ' + q.mode + '\n' : '') + (q.commodity ? 'Commodity: ' + q.commodity + '\n' : '') + '\n' +
                lines + '\n\nTotal: INR ' + Number(q.totalSellInr).toLocaleString('en-IN') +
                (q.validUntil ? '\nValid until ' + q.validUntil : '') +
                (q.remarks ? '\n\n' + q.remarks : '') + '\n';
            // the mail first, then the record of it - so nothing is marked sent that was not
            const mr = await fetch('/api/email/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ to: to.trim(), subject: 'Quotation ' + q.quoteNo, text: body }),
            });
            const mj = await mr.json().catch(() => ({}));
            if (!mr.ok || mj.success === false) throw new Error(mj.error || ('HTTP ' + mr.status));
            await fetch('/api/sales/quotes/' + q.id + '/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ to: to.trim() }),
            });
            toast.success('Quotation emailed to ' + to.trim());
            await load();
        } catch (err) {
            toast.error('Not sent: ' + err.message + ' (check Settings > Email)');
        }
    };

    const removeQuote = async (q) => {
        if (!window.confirm('Delete quotation ' + q.quoteNo + '?')) return;
        try {
            const r = await fetch('/api/sales/quotes/' + q.id, { method: 'DELETE', headers: auth() });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            toast.success('Deleted');
            await load();
        } catch (err) { toast.error(err.message); }
    };

    const markLost = async (lead) => {
        const why = window.prompt('Why was the enquiry from ' + lead.clientName + ' lost?');
        if (!why || !why.trim()) { toast.error('Not changed - a lost lead is only useful with the reason'); return; }
        try {
            const r = await fetch('/api/sales/leads/' + lead.id, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ status: 'LOST', lostReason: why.trim() }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            await load();
        } catch (err) { toast.error(err.message); }
    };

    const money = (n) => '₹ ' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

    const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
    const btnStyle = { padding: '8px 16px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' };
    const inputStyle = { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none', width: '100%' };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#8b5cf6', padding: '12px', borderRadius: '8px', color: '#fff' }}><Users size={24} /></div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 'bold' }}>Sales & CRM</h2>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Manage leads, quotations, and procurement buy-rates</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setShowSearch(v => !v)} style={{...btnStyle, background: showSearch ? '#0f172a' : '#f8fafc', color: showSearch ? '#fff' : '#0f172a', border: '1px solid #cbd5e1'}}><Search size={16}/> Search Leads{search || statusFilter ? ' (on)' : ''}</button>
                    <button onClick={() => setShowEnquiryForm(true)} style={{...btnStyle, background: '#2563eb', color: '#fff'}}><Plus size={16}/> New Lead / Enquiry</button>
                </div>
            </div>

            {showSearch && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Client / enquiry no / route / commodity</label>
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="e.g. Jebel Ali"
                            style={{ ...inputStyle, minWidth: '260px', width: 'auto' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Status</label>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                            <option value="">All</option>
                            <option value="NEW">New</option>
                            <option value="QUOTED">Quoted</option>
                            <option value="WON">Won</option>
                            <option value="LOST">Lost</option>
                        </select>
                    </div>
                    <button onClick={() => { setSearch(''); setStatusFilter(''); }} style={{...btnStyle, background: '#fff', color: '#334155', border: '1px solid #cbd5e1'}}>Clear</button>
                    <div style={{ fontSize: '12px', color: '#64748b', paddingBottom: '8px' }}>
                        {loading ? 'Searching...' : leads.length + ' lead(s)'}
                        {counts.leads ? ' \u00b7 new ' + (counts.leads.NEW || 0) + ', quoted ' + (counts.leads.QUOTED || 0) + ', won ' + (counts.leads.WON || 0) + ', lost ' + (counts.leads.LOST || 0) : ''}
                    </div>
                </div>
            )}

            {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>
            )}

            {showEnquiryForm && <AdvancedEnquiryForm onClose={() => setShowEnquiryForm(false)} onSaved={async () => { setShowEnquiryForm(false); await load(); }} />}

            {/* Dashboard Stats */}
            <div style={{ display: 'flex', gap: '2px', borderBottom: '2px solid #e2e8f0', marginBottom: '24px' }}>
                <button 
                    onClick={() => setActiveTab('leads')}
                    style={{ padding: '12px 24px', background: activeTab === 'leads' ? '#fff' : 'transparent', border: 'none', borderBottom: activeTab === 'leads' ? '2px solid #2563eb' : '2px solid transparent', color: activeTab === 'leads' ? '#2563eb' : '#64748b', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', marginBottom: '-2px' }}>
                    Pipeline &amp; Leads (Enquiries){counts.leads ? ' (' + leads.length + ')' : ''}
                </button>
                <button 
                    onClick={() => setActiveTab('quotes')}
                    style={{ padding: '12px 24px', background: activeTab === 'quotes' ? '#fff' : 'transparent', border: 'none', borderBottom: activeTab === 'quotes' ? '2px solid #8b5cf6' : '2px solid transparent', color: activeTab === 'quotes' ? '#8b5cf6' : '#64748b', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', marginBottom: '-2px' }}>
                    Quotations &amp; Conversions{quotes.length ? ' (' + quotes.length + ')' : ''}
                </button>
            </div>

            {/* Leads View */}
            {activeTab === 'leads' && !showQuoteForm && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
                    {loading && <div style={{ padding: '24px', fontSize: '13px', color: '#64748b' }}>Loading leads...</div>}
                    {!loading && !leads.length && (
                        <div style={{ ...cardStyle, padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                            {search || statusFilter ? 'No lead matches that search.' : 'No enquiry recorded yet. Use "New Lead / Enquiry" to add the first one.'}
                        </div>
                    )}
                    {leads.map(lead => {
                        const [bg, fg] = LEAD_COLOURS[lead.status] || LEAD_COLOURS.NEW;
                        const edge = lead.status === 'NEW' ? '#3b82f6' : lead.status === 'QUOTED' ? '#f59e0b' : lead.status === 'WON' ? '#10b981' : '#ef4444';
                        return (
                        <div key={lead.id} style={{...cardStyle, borderLeft: '4px solid ' + edge}}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#0f172a' }}>{lead.clientName}</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#64748b', flexWrap: 'wrap' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={12}/> {lead.enquiryNo}</span>
                                        {lead.contactPerson && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12}/> {lead.contactPerson}</span>}
                                        {lead.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12}/> {lead.phone}</span>}
                                        {lead.email && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={12}/> {lead.email}</span>}
                                    </div>
                                </div>
                                <span style={{ padding: '4px 8px', background: bg, color: fg, borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                                    {lead.status}
                                </span>
                            </div>

                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', fontWeight: '600' }}>
                                    <Anchor size={14} color="#8b5cf6"/> {lead.serviceType || lead.mode || 'Route'}
                                    <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '11px' }}>{lead.date ? ' \u00b7 ' + lead.date.split('-').reverse().join('-') : ''}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', fontSize: '13px', color: '#0f172a', fontWeight: 'bold' }}>
                                    <span>{lead.origin || '\u2014'}</span>
                                    <span style={{ color: '#cbd5e1' }}>&rarr;</span>
                                    <span>{lead.destination || '\u2014'}</span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                                    {[lead.commodity, lead.containerType, lead.incoterms,
                                      lead.weight ? Number(lead.weight) + ' t' : '', lead.volume ? Number(lead.volume) + ' cbm' : '',
                                      lead.targetRate ? 'target ' + lead.targetRate : ''].filter(Boolean).join(' \u00b7 ')}
                                </div>
                                {lead.quotes && lead.quotes.length > 0 && (
                                    <div style={{ fontSize: '11px', color: '#0369a1', marginTop: '6px' }}>
                                        {lead.quotes.map(q => q.quoteNo + ' (' + q.status.toLowerCase() + ', ' + money(q.value) + ')').join(' \u00b7 ')}
                                    </div>
                                )}
                                {lead.status === 'LOST' && lead.lostReason && (
                                    <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '6px' }}>Lost: {lead.lostReason}</div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {lead.status === 'NEW' ? (
                                    <button onClick={() => handleCreateQuote(lead)} style={{...btnStyle, background: '#2563eb', color: '#fff', flex: 1, justifyContent: 'center'}}>
                                        <FileText size={14}/> Prepare Quotation
                                    </button>
                                ) : (
                                    <button onClick={() => { setActiveTab('quotes'); }} style={{...btnStyle, background: '#f1f5f9', color: '#475569', flex: 1, justifyContent: 'center'}}>
                                        <CheckCircle size={14}/> {lead.quotes && lead.quotes.length ? 'See its quotation' : lead.status}
                                    </button>
                                )}
                                <button onClick={() => setDetailLead(detailLead === lead.id ? null : lead.id)} style={{...btnStyle, background: '#fff', color: '#64748b', border: '1px solid #cbd5e1'}}>
                                    {detailLead === lead.id ? 'Hide' : 'Details'}
                                </button>
                                {['NEW', 'QUOTED'].includes(lead.status) && (
                                    <button onClick={() => markLost(lead)} title="Mark this enquiry lost" style={{...btnStyle, background: '#fff', color: '#b91c1c', border: '1px solid #fecaca'}}>Lost</button>
                                )}
                            </div>

                            {detailLead === lead.id && (
                                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#475569', display: 'grid', gap: '4px' }}>
                                    {[['Enquiry no', lead.enquiryNo], ['Date', lead.date], ['Mode', lead.mode], ['Service', lead.serviceType],
                                      ['Incoterms', lead.incoterms], ['Commodity', lead.commodity], ['Container', lead.containerType],
                                      ['Weight', lead.weight ? Number(lead.weight) : ''], ['Volume', lead.volume ? Number(lead.volume) : ''],
                                      ['Target rate', lead.targetRate], ['Competitor', lead.competitor],
                                      ['Raised by', lead.createdByName], ['Remarks', lead.remarks]]
                                        .filter(([, v]) => v !== null && v !== undefined && v !== '')
                                        .map(([k, v]) => <div key={k}><b>{k}:</b> {String(v)}</div>)}
                                </div>
                            )}
                        </div>
                        );
                    })}
                </div>
            )}

            {/* Quote Form */}
            {showQuoteForm && <AdvancedQuoteForm lead={selectedLead} quote={editQuote} onClose={() => { setShowQuoteForm(false); setEditQuote(null); }} onSaved={afterQuote} />}

            {/* Quotes & Conversions View */}
            {activeTab === 'quotes' && !showQuoteForm && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Quote No.</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Client / routing</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: '#64748b' }}>Buy</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: '#64748b' }}>Sell</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>Margin</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>Status</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>Loading quotations...</td></tr>}
                            {!loading && !quotes.length && (
                                <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                    No quotation yet. Open a lead and use &quot;Prepare Quotation&quot;.
                                </td></tr>
                            )}
                            {quotes.map(q => {
                                const [bg, fg] = QUOTE_COLOURS[q.status] || QUOTE_COLOURS.DRAFT;
                                return (
                                <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
                                        {q.quoteNo}
                                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>
                                            {q.date ? q.date.split('-').reverse().join('-') : ''}
                                            {q.validUntil ? ' \u00b7 valid to ' + q.validUntil.split('-').reverse().join('-') : ''}
                                            {q.expired && q.status !== 'CONVERTED' ? ' \u00b7 EXPIRED' : ''}
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#334155' }}>
                                        {q.clientName}
                                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                            {[q.origin, q.destination].filter(Boolean).join(' \u2192 ')}{q.mode ? ' \u00b7 ' + q.mode : ''}
                                            {q.charges ? ' \u00b7 ' + q.charges.length + ' charge line(s)' : ''}
                                        </div>
                                        {q.jobNo && <div style={{ fontSize: '11px', color: '#166534' }}>job {q.jobNo}</div>}
                                        {!q.totalsMatchLines && <div style={{ fontSize: '11px', color: '#b91c1c' }}>stored total does not match the charge lines</div>}
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#b91c1c', textAlign: 'right' }}>{money(q.totalBuyInr)}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 'bold', color: '#0f172a', textAlign: 'right' }}>{money(q.totalSellInr)}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 'bold', textAlign: 'center', color: q.marginInr < 0 ? '#dc2626' : '#16a34a' }}>
                                        {money(q.marginInr)}
                                        <div style={{ fontSize: '11px', fontWeight: 400, color: '#94a3b8' }}>{q.marginPct == null ? '' : q.marginPct + '%'}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: bg, color: fg }}>
                                            {q.status}
                                        </span>
                                        {q.sentTo && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>to {q.sentTo}</div>}
                                        {q.status === 'REJECTED' && q.rejectReason && <div style={{ fontSize: '10px', color: '#b91c1c', marginTop: '2px' }}>{q.rejectReason}</div>}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                            <button onClick={() => openQuote(q)} style={{...btnStyle, background: 'transparent', color: '#2563eb', border: '1px solid #2563eb', padding: '5px 10px'}}>Open</button>
                                            {['DRAFT', 'SENT'].includes(q.status) && (
                                                <button onClick={() => handleSendQuote(q)} style={{...btnStyle, background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '5px 10px'}}><Send size={12}/> Email</button>
                                            )}
                                            {q.status === 'SENT' && (
                                                <>
                                                    <button onClick={() => setQuoteStatus(q, 'APPROVED')} style={{...btnStyle, background: '#fef08a', color: '#854d0e', padding: '5px 10px'}}>Approved</button>
                                                    <button onClick={() => handleReject(q)} style={{...btnStyle, background: '#fff', color: '#b91c1c', border: '1px solid #fecaca', padding: '5px 10px'}}>Rejected</button>
                                                </>
                                            )}
                                            {q.status === 'APPROVED' && (
                                                <button onClick={() => handleConvertToJob(q)} style={{...btnStyle, background: '#10b981', color: '#fff', padding: '5px 10px'}}>
                                                    <Briefcase size={12}/> Link to Job
                                                </button>
                                            )}
                                            {q.status !== 'CONVERTED' && (
                                                <button onClick={() => removeQuote(q)} title="Delete" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14}/></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div style={{ padding: '10px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '11px', color: '#64748b' }}>
                        Buy and sell are converted to rupees at the exchange rate stored on each charge line, taken from the Currency master when the quote was made.
                        &quot;Link to Job&quot; records the job number against the quote so the MIS report can compare what was quoted with what the job actually earned.
                    </div>
                </div>
            )}

        </div>
    );
}
