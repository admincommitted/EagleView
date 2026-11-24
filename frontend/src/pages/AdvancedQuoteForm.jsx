import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Send, X, Plus, Trash2, Calculator, Globe, Anchor } from 'lucide-react';
import toast from 'react-hot-toast';

// 30-Oct-2026: this form saved nothing and sent nothing - "Save & Email to Client" printed
// "Generating PDF and sending via SMTP" after a 2 second timer. The quote number was hardcoded to
// QT/26/099, the three charge lines were hardcoded, and USD was converted to INR at a hardcoded 84.
// A quote priced off a made-up exchange rate is a real commercial risk, so the rate now comes from
// the Currency master (or is typed per line) and is stored with the quote.
export default function AdvancedQuoteForm({ onClose, onSaved, lead, quote }) {
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState([]);
    const [rates, setRates] = useState([]);
    const [ratesNote, setRatesNote] = useState('');

    const [form, setForm] = useState({
        quoteNo: quote ? quote.quoteNo : '',
        date: quote ? quote.date : new Date().toISOString().split('T')[0],
        validUntil: quote ? (quote.validUntil || '') : (() => { const d = new Date(); d.setDate(d.getDate() + 15); return d.toISOString().slice(0, 10); })(),
        clientName: quote ? quote.clientName : (lead?.clientName || ''),
        contactPerson: quote ? (quote.contactPerson || '') : (lead?.contactPerson || ''),
        email: quote ? (quote.email || '') : (lead?.email || ''),
        origin: quote ? (quote.origin || '') : (lead?.origin || ''),
        destination: quote ? (quote.destination || '') : (lead?.destination || ''),
        mode: quote ? (quote.mode || '') : (lead?.serviceType || lead?.mode || ''),
        commodity: quote ? (quote.commodity || '') : (lead?.commodity || ''),
        remarks: quote ? (quote.remarks || '') : '',
    });

    const [chargeLines, setChargeLines] = useState(
        quote && quote.charges && quote.charges.length
            ? quote.charges.map(c => ({ id: c.id, head: c.head, buyRate: c.buyRate, sellRate: c.sellRate,
                currency: c.currency, roe: c.roe, qty: c.qty, basis: c.basis || '', remarks: c.remarks || '' }))
            // one empty line, not three invented ones
            : [{ id: 1, head: '', buyRate: '', sellRate: '', currency: 'INR', roe: 1, qty: 1, basis: 'Flat', remarks: '' }]
    );

    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

    useEffect(() => {
        (async () => {
            try {
                const [rr, nr] = await Promise.all([
                    fetch('/api/sales/rates', { headers: auth() }),
                    quote ? Promise.resolve(null) : fetch('/api/sales/quotes/next-no', { headers: auth() }),
                ]);
                const rj = await rr.json().catch(() => ({}));
                setRates(rj.data || []);
                setRatesNote(rj.note || '');
                if (nr) {
                    const nj = await nr.json().catch(() => ({}));
                    if (nj.quoteNo) setForm(f => ({ ...f, quoteNo: nj.quoteNo }));
                }
            } catch (err) { /* the server fills the number in if this failed */ }
        })();
    }, [quote]);

    const num = (x) => { const n = parseFloat(x); return Number.isFinite(n) ? n : 0; };
    // the rate on file for a currency; null means there is none, which the user has to resolve
    const rateOf = (code) => {
        if (String(code).toUpperCase() === 'INR') return 1;
        const r = rates.find(x => x.code === String(code).toUpperCase());
        return r && r.roe > 0 ? r.roe : null;
    };

    const setLine = (idx, patch) => {
        const next = [...chargeLines];
        next[idx] = { ...next[idx], ...patch };
        // changing the currency pulls its rate from the master instead of leaving a stale one
        if (patch.currency !== undefined) {
            const r = rateOf(patch.currency);
            next[idx].roe = r == null ? '' : r;
        }
        setChargeLines(next);
    };

    const handleAddLine = () => {
        setChargeLines([...chargeLines, { id: 'n' + Date.now(), head: '', buyRate: '', sellRate: '', currency: 'INR', roe: 1, qty: 1, basis: 'Flat', remarks: '' }]);
    };

    const totals = useMemo(() => {
        let buy = 0, sell = 0, missing = [];
        chargeLines.forEach(l => {
            const roe = num(l.roe) || (String(l.currency).toUpperCase() === 'INR' ? 1 : 0);
            if (!roe && String(l.head || '').trim()) missing.push(l.currency);
            buy += num(l.buyRate) * num(l.qty) * roe;
            sell += num(l.sellRate) * num(l.qty) * roe;
        });
        return { buy, sell, margin: sell - buy, pct: sell > 0 ? ((sell - buy) / sell) * 100 : 0, missing: [...new Set(missing)] };
    }, [chargeLines]);

    const body = () => ({
        ...form,
        leadId: quote ? quote.leadId : (lead ? lead.id : null),
        partyLedgerId: quote ? quote.partyLedgerId : (lead ? lead.partyLedgerId : null),
        validUntil: form.validUntil || null,
        charges: chargeLines.filter(l => String(l.head || '').trim()).map(l => ({
            head: l.head, buyRate: num(l.buyRate), sellRate: num(l.sellRate),
            currency: l.currency, roe: num(l.roe) || undefined, qty: num(l.qty) || 1,
            basis: l.basis, remarks: l.remarks,
        })),
    });

    const save = async (alsoEmail) => {
        setSaving(true); setErrors([]);
        try {
            const isEdit = !!(quote && quote.id);
            const r = await fetch('/api/sales/quotes' + (isEdit ? '/' + quote.id : ''), {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify(body()),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) {
                setErrors(j.errors || [j.error || ('HTTP ' + r.status)]);
                toast.error('Not saved - see the messages on the form');
                setSaving(false);
                return;
            }
            const saved = j.data;
            if (alsoEmail) {
                const to = (form.email || '').trim();
                if (!to) {
                    toast.error('Saved, but there is no email address to send it to');
                } else {
                    const lines = (saved.charges || []).map(c =>
                        c.head + '  ' + c.currency + ' ' + Number(c.sellRate).toLocaleString('en-IN') +
                        ' x ' + Number(c.qty) + (c.basis ? ' (' + c.basis + ')' : '')).join('\n');
                    const text = 'Dear ' + (form.contactPerson || 'Sir / Madam') + ',\n\n' +
                        'Our quotation ' + saved.quoteNo + ' dated ' + saved.date + ':\n\n' +
                        (form.origin || form.destination ? 'Routing: ' + (form.origin || '?') + ' to ' + (form.destination || '?') + '\n' : '') +
                        (form.mode ? 'Mode: ' + form.mode + '\n' : '') + (form.commodity ? 'Commodity: ' + form.commodity + '\n' : '') + '\n' +
                        lines + '\n\nTotal: INR ' + Number(saved.totalSellInr).toLocaleString('en-IN') +
                        (saved.validUntil ? '\nValid until ' + saved.validUntil : '') +
                        (form.remarks ? '\n\n' + form.remarks : '') + '\n';
                    try {
                        const mr = await fetch('/api/email/send', {
                            method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                            body: JSON.stringify({ to, subject: 'Quotation ' + saved.quoteNo, text }),
                        });
                        const mj = await mr.json().catch(() => ({}));
                        if (!mr.ok || mj.success === false) throw new Error(mj.error || ('HTTP ' + mr.status));
                        await fetch('/api/sales/quotes/' + saved.id + '/send', {
                            method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                            body: JSON.stringify({ to }),
                        });
                        toast.success('Quotation ' + saved.quoteNo + ' saved and emailed to ' + to);
                    } catch (e) {
                        // the quote is saved either way - say exactly what happened
                        toast.error('Saved as ' + saved.quoteNo + ', but the email did not go: ' + e.message + ' (check Settings > Email)');
                    }
                }
            } else {
                toast.success('Quotation ' + saved.quoteNo + ' saved');
            }
            if (onSaved) onSaved(saved); else onClose();
        } catch (err) {
            setErrors([err.message]);
            toast.error('Not saved: ' + err.message);
        }
        setSaving(false);
    };

    const inputStyle = { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' };
    const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' };

    // Calculations
    const totalBuyINR = chargeLines.reduce((acc, curr) => acc + (curr.buyRate * curr.qty * (curr.currency === 'USD' ? 84 : 1)), 0);
    const totalSellINR = chargeLines.reduce((acc, curr) => acc + (curr.sellRate * curr.qty * (curr.currency === 'USD' ? 84 : 1)), 0);
    const estMargin = totalSellINR - totalBuyINR;
    const marginPercent = totalSellINR > 0 ? ((estMargin / totalSellINR) * 100).toFixed(2) : 0;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: '#fff', width: '100%', maxWidth: '1100px', height: '90vh', borderRadius: '8px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                
                {/* Header */}
                <div style={{ padding: '16px 24px', background: '#1e3a8a', color: '#fff', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <FileText size={20} color="#60a5fa"/>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '18px' }}>Logistics CRM - Generate Quotation</h2>
                            <div style={{ fontSize: '11px', color: '#93c5fd' }}>
                                {quote ? 'Editing ' + quote.quoteNo + ' (' + quote.status + ')' : 'Multi-currency quote, converted at the rates on the Currency master'}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24}/></button>
                </div>

                {/* Form Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    
                    {/* Top Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '20px', marginBottom: '24px' }}>
                        <div><label style={labelStyle}>Quote No. (Auto)</label><input type="text" value={form.quoteNo} readOnly style={{...inputStyle, background: '#f1f5f9'}} /></div>
                        <div><label style={labelStyle}>Valid until</label><input type="date" value={form.validUntil} onChange={e=>setForm({...form, validUntil: e.target.value})} style={inputStyle} /></div>
                        <div><label style={labelStyle}>Date</label><input type="date" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} style={inputStyle} /></div>
                        <div>
                            <label style={labelStyle}>Client Name</label>
                            {/* 30-Oct-2026: "Change Client" did nothing, and the name box was already editable,
                                so the button was never needed. The contact and email sit beside it instead. */}
                            <input type="text" value={form.clientName} onChange={e=>setForm({...form, clientName: e.target.value})} style={inputStyle} />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <input type="text" value={form.contactPerson} onChange={e=>setForm({...form, contactPerson: e.target.value})} placeholder="Contact person" style={inputStyle} />
                                <input type="email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} placeholder="email for the quotation" style={inputStyle} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div><label style={labelStyle}>Routing Origin</label><input type="text" value={form.origin} onChange={e=>setForm({...form, origin: e.target.value})} style={inputStyle} /></div>
                        <div><label style={labelStyle}>Routing Destination</label><input type="text" value={form.destination} onChange={e=>setForm({...form, destination: e.target.value})} style={inputStyle} /></div>
                        {/* this box used to show "mode | commodity" joined together but wrote the whole string
                            back into mode alone, so the commodity was destroyed on the first keystroke */}
                        <div><label style={labelStyle}>Mode</label><input type="text" value={form.mode} onChange={e=>setForm({...form, mode: e.target.value})} placeholder="e.g. Sea FCL" style={inputStyle} /></div>
                        <div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>Commodity</label><input type="text" value={form.commodity} onChange={e=>setForm({...form, commodity: e.target.value})} placeholder="e.g. General cargo" style={inputStyle} /></div>
                    </div>

                    {/* Pricing Grid */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ margin: 0, color: '#1e3a8a', fontSize: '15px' }}>Commercials (Buy vs Sell Rates)</h4>
                        <button onClick={handleAddLine} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #2563eb', color: '#2563eb', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Plus size={14}/> Add Charge Head
                        </button>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', marginBottom: '24px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '10px', textAlign: 'left', background: '#f1f5f9', fontSize: '12px', borderBottom: '2px solid #cbd5e1' }}>Charge Head</th>
                                    <th style={{ padding: '10px', textAlign: 'left', background: '#f1f5f9', fontSize: '12px', borderBottom: '2px solid #cbd5e1', width: '80px' }}>Curr</th>
                                    <th style={{ padding: '10px', textAlign: 'right', background: '#f1f5f9', fontSize: '12px', borderBottom: '2px solid #cbd5e1', width: '90px' }}>Rate used</th>
                                    <th style={{ padding: '10px', textAlign: 'right', background: '#fee2e2', color: '#991b1b', fontSize: '12px', borderBottom: '2px solid #fca5a5' }}>Procured Rate (Buy)</th>
                                    <th style={{ padding: '10px', textAlign: 'right', background: '#dcfce7', color: '#166534', fontSize: '12px', borderBottom: '2px solid #86efac' }}>Quote Rate (Sell)</th>
                                    <th style={{ padding: '10px', textAlign: 'right', background: '#f1f5f9', fontSize: '12px', borderBottom: '2px solid #cbd5e1', width: '70px' }}>Qty</th>
                                    <th style={{ padding: '10px', textAlign: 'left', background: '#f1f5f9', fontSize: '12px', borderBottom: '2px solid #cbd5e1' }}>Basis</th>
                                    <th style={{ padding: '10px', textAlign: 'left', background: '#f1f5f9', fontSize: '12px', borderBottom: '2px solid #cbd5e1' }}>Remarks</th>
                                    <th style={{ padding: '10px', background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {chargeLines.map((line, idx) => (
                                    <tr key={line.id}>
                                        <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}><input type="text" value={line.head} onChange={(e)=>setLine(idx, { head: e.target.value })} placeholder="e.g. Ocean Freight" style={inputStyle}/></td>
                                        <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                                            <select value={line.currency} onChange={(e)=>setLine(idx, { currency: e.target.value })} style={inputStyle}>
                                                <option value="INR">INR</option>
                                                {rates.filter(r => r.code !== 'INR').map(r => <option key={r.code} value={r.code}>{r.code}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                                            <input type="number" value={line.roe} onChange={(e)=>setLine(idx, { roe: e.target.value })}
                                                readOnly={String(line.currency).toUpperCase() === 'INR'}
                                                style={{...inputStyle, textAlign: 'right',
                                                    background: String(line.currency).toUpperCase() === 'INR' ? '#f1f5f9' : (num(line.roe) ? '#fff' : '#fef2f2'),
                                                    borderColor: !num(line.roe) && String(line.currency).toUpperCase() !== 'INR' ? '#dc2626' : '#cbd5e1'}} />
                                            {!num(line.roe) && String(line.currency).toUpperCase() !== 'INR' && (
                                                <div style={{ fontSize: '10px', color: '#dc2626' }}>no rate on file - type one</div>
                                            )}
                                        </td>
                                        <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', background: '#fef2f2' }}><input type="number" value={line.buyRate} onChange={(e)=>setLine(idx, { buyRate: e.target.value })} style={{...inputStyle, textAlign: 'right', borderColor: '#fca5a5', background: '#fff'}}/></td>
                                        <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', background: '#f0fdf4' }}><input type="number" value={line.sellRate} onChange={(e)=>setLine(idx, { sellRate: e.target.value })} style={{...inputStyle, textAlign: 'right', borderColor: '#86efac', background: '#fff', fontWeight: 'bold'}}/></td>
                                        <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}><input type="number" value={line.qty} onChange={(e)=>setLine(idx, { qty: e.target.value })} style={{...inputStyle, textAlign: 'right'}}/></td>
                                        <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}><select value={line.basis} onChange={(e)=>setLine(idx, { basis: e.target.value })} style={inputStyle}><option>Per TEU</option><option>Per Cont</option><option>Per BL</option><option>Per Kg</option><option>Flat</option></select></td>
                                        <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}><input type="text" value={line.remarks} onChange={(e)=>setLine(idx, { remarks: e.target.value })} style={inputStyle}/></td>
                                        <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}><button onClick={()=>setChargeLines(chargeLines.filter(l=>l.id!==line.id))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16}/></button></td>
                                    </tr>
                                ))}
                                {!chargeLines.length && (
                                    <tr><td colSpan={9} style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>Add at least one charge line.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Margin Analytics & Remarks */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px' }}>
                            <h4 style={{ margin: '0 0 12px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}><Calculator size={16}/> Profitability Analysis (INR)</h4>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}><span>Total Buy Cost:</span> <span style={{ fontWeight: 'bold', color: '#dc2626' }}>₹ {totals.buy.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}><span>Total Sell Revenue:</span> <span style={{ fontWeight: 'bold', color: '#16a34a' }}>₹ {totals.sell.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                            <div style={{ borderTop: '1px dashed #cbd5e1', margin: '12px 0' }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Estimated Margin:</span>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '18px', fontWeight: '900', color: totals.margin < 0 ? '#dc2626' : '#0284c7' }}>₹ {totals.margin.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>({totals.pct.toFixed(2)}%)</div>
                                </div>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '10px', borderTop: '1px dashed #cbd5e1', paddingTop: '8px' }}>
                                Converted at the rate shown on each line. {ratesNote}
                            </div>
                            {totals.missing.length > 0 && (
                                <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '8px', fontWeight: 600 }}>
                                    No exchange rate for {totals.missing.join(', ')} - those lines are not in the totals. Type the rate, or add it in Accounting Masters.
                                </div>
                            )}
                            {totals.margin < 0 && (
                                <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '8px', fontWeight: 600 }}>
                                    This quote sells below cost.
                                </div>
                            )}
                        </div>

                        <div>
                            <label style={labelStyle}>Terms &amp; Conditions</label>
                            <textarea rows="6" value={form.remarks} onChange={e=>setForm({...form, remarks: e.target.value})} style={inputStyle}></textarea>
                        </div>
                    </div>

                </div>

                {errors.length > 0 && (
                    <div style={{ margin: '0 24px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '13px', marginBottom: '4px' }}>Nothing was saved. Fix these first:</div>
                        <ul style={{ margin: 0, paddingLeft: '20px', color: '#b91c1c', fontSize: '13px' }}>
                            {errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                    </div>
                )}

                {/* Footer */}
                <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 8px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>The email to the client lists the sell rates only - buy rates stay internal.</div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={onClose} style={{ padding: '10px 24px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={() => save(false)} disabled={saving} style={{ padding: '10px 24px', background: '#fff', border: '1px solid #1e3a8a', color: '#1e3a8a', borderRadius: '4px', fontWeight: 'bold', cursor: saving ? 'wait' : 'pointer' }}>
                            {saving ? 'Saving...' : 'Save only'}
                        </button>
                        <button onClick={() => save(true)} disabled={saving} style={{ padding: '10px 24px', background: saving ? '#64748b' : '#1e3a8a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Send size={16}/> {saving ? 'Working...' : 'Save & Email to Client'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
