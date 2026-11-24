import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Map, IndianRupee, FileText, CheckCircle, Clock, Save, Plus, AlertCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import AdvancedLRForm from './AdvancedLRForm';

// 30-Oct-2026: this screen listed two invented trips with invented vehicle numbers and drivers
// ("LR-2026-901 / HR 38 X 4455 / Raju Singh"), the "2 Vehicles In Transit" badge was a hardcoded
// string, "Update Status" did nothing, and "Save Trip & Post Advance Voucher" only pushed a row into
// local state - no LR was stored and no voucher was ever posted. It all reads /api/fleet now.
const LABELS = { PENDING_DISPATCH: 'Pending dispatch', IN_TRANSIT: 'In transit', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' };
const COLOURS = { PENDING_DISPATCH: ['#e0f2fe', '#0369a1'], IN_TRANSIT: ['#fef08a', '#854d0e'], DELIVERED: ['#dcfce7', '#166534'], CANCELLED: ['#fee2e2', '#991b1b'] };

export default function FleetManagement() {
    const [trips, setTrips] = useState([]);
    const [counts, setCounts] = useState({});
    const [totals, setTotals] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showNewTrip, setShowNewTrip] = useState(false);
    const [masters, setMasters] = useState({ ledgers: [], paymentVoucherTypes: [] });
    const [advanceFor, setAdvanceFor] = useState(null);
    const [advForm, setAdvForm] = useState({ voucherTypeId: '', debitLedgerId: '', creditLedgerId: '' });
    const [posting, setPosting] = useState(false);

    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const q = new URLSearchParams();
            if (search) q.set('q', search);
            if (statusFilter) q.set('status', statusFilter);
            const [r, mr] = await Promise.all([
                fetch('/api/fleet/lr?' + q.toString(), { headers: auth() }),
                fetch('/api/fleet/masters', { headers: auth() }),
            ]);
            const j = await r.json().catch(() => ({}));
            const mj = await mr.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            setTrips(j.data || []);
            setCounts(j.counts || {});
            setTotals(j.totals || null);
            setMasters({ ledgers: mj.ledgers || [], paymentVoucherTypes: mj.paymentVoucherTypes || [] });
            if (mj.paymentVoucherTypes && mj.paymentVoucherTypes.length && !advForm.voucherTypeId) {
                setAdvForm(f => ({ ...f, voucherTypeId: mj.paymentVoucherTypes[0].id }));
            }
        } catch (err) {
            setTrips([]); setTotals(null); setError(err.message);
        }
        setLoading(false);
    }, [search, statusFilter, advForm.voucherTypeId]);
    useEffect(() => { load(); }, [load]);

    const setStatus = async (trip, status) => {
        try {
            const r = await fetch('/api/fleet/lr/' + trip.id, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ status, ...(status === 'DELIVERED' ? { podReceived: true } : {}) }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            toast.success(trip.lrNo + ' → ' + (LABELS[status] || status));
            await load();
        } catch (err) { toast.error(err.message); }
    };

    const postAdvance = async () => {
        if (!advanceFor) return;
        setPosting(true);
        try {
            const r = await fetch('/api/fleet/lr/' + advanceFor.id + '/post-advance', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify(advForm),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            toast.success(j.note || 'Advance posted');
            setAdvanceFor(null);
            await load();
        } catch (err) { toast.error('Not posted: ' + err.message); }
        setPosting(false);
    };

    const removeTrip = async (trip) => {
        if (!window.confirm('Delete lorry receipt ' + trip.lrNo + '?')) return;
        try {
            const r = await fetch('/api/fleet/lr/' + trip.id, { method: 'DELETE', headers: auth() });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            toast.success('Deleted');
            await load();
        } catch (err) { toast.error(err.message); }
    };

    const money = (n) => '₹ ' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

    const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
    const inputStyle = { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none', width: '100%' };
    const thStyle = { padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' };
    const tdStyle = { padding: '12px', fontSize: '13px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', fontWeight: '500' };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#f97316', padding: '12px', borderRadius: '8px', color: '#fff' }}><Truck size={24} /></div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 'bold' }}>Fleet & Transport Management (TMS)</h2>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Trip sheets, Lorry Receipts, Driver Advances & Vehicle Profitability</div>
                    </div>
                </div>
                <button onClick={() => setShowNewTrip(!showNewTrip)} style={{ padding: '10px 24px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    {showNewTrip ? "Close Form" : "New Trip / Lorry Receipt"}
                </button>
            </div>

            {/* 30-Oct-2026: the old page passed form / setForm into AdvancedLRForm, which ignored both
                (its signature only took onClose), and then had its own Save button beside it that pushed
                a row into local state. The form saves itself now and tells us when it is done. */}
            {showNewTrip && (
                <AdvancedLRForm onClose={() => setShowNewTrip(false)} onSaved={async () => { setShowNewTrip(false); await load(); }} />
            )}

            {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>
            )}

            {advanceFor && (
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>
                        Post the driver advance of {money(advanceFor.advanceToDriver)} on {advanceFor.lrNo}
                    </div>
                    <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '12px' }}>
                        This writes a real payment voucher, so the ledgers are picked rather than guessed.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Voucher type</label>
                            <select value={advForm.voucherTypeId} onChange={e => setAdvForm({ ...advForm, voucherTypeId: e.target.value })} style={inputStyle}>
                                <option value="">-- pick --</option>
                                {masters.paymentVoucherTypes.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                            {!masters.paymentVoucherTypes.length && <div style={{ fontSize: '11px', color: '#b45309', marginTop: '4px' }}>No Payment voucher type exists - create one in Accounting Masters.</div>}
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Debit (driver / transporter advance)</label>
                            <select value={advForm.debitLedgerId} onChange={e => setAdvForm({ ...advForm, debitLedgerId: e.target.value })} style={inputStyle}>
                                <option value="">-- pick --</option>
                                {masters.ledgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Credit (bank / cash)</label>
                            <select value={advForm.creditLedgerId} onChange={e => setAdvForm({ ...advForm, creditLedgerId: e.target.value })} style={inputStyle}>
                                <option value="">-- pick --</option>
                                {masters.ledgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={postAdvance} disabled={posting} style={{ padding: '8px 18px', background: posting ? '#94a3b8' : '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 700, fontSize: '13px', cursor: posting ? 'wait' : 'pointer' }}>
                            {posting ? 'Posting...' : 'Post the voucher'}
                        </button>
                        <button onClick={() => setAdvanceFor(null)} style={{ padding: '8px 18px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                </div>
            )}

            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '20px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ margin: 0, color: '#0f172a' }}>Dispatch Board</h3>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                            {totals ? 'Freight ' + money(totals.freight) + ' \u00b7 advances ' + money(totals.advance) : ''}
                            {totals && totals.advancesNotPosted ? ' \u00b7 ' + totals.advancesNotPosted + ' advance(s) not yet posted to the ledger' : ''}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="LR / vehicle / driver / route"
                            style={{ ...inputStyle, width: '220px' }} />
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                            <option value="">All statuses</option>
                            {Object.keys(LABELS).map(k => <option key={k} value={k}>{LABELS[k]}{counts[k] ? ' (' + counts[k] + ')' : ''}</option>)}
                        </select>
                        <span style={{ padding: '4px 12px', background: '#eff6ff', color: '#1e3a8a', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            {counts.IN_TRANSIT || 0} in transit
                        </span>
                    </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>LR No.</th>
                            <th style={thStyle}>Vehicle & Driver</th>
                            <th style={thStyle}>Route</th>
                            <th style={{...thStyle, textAlign: 'right'}}>Total Freight</th>
                            <th style={{...thStyle, textAlign: 'right'}}>Advance Paid</th>
                            <th style={{...thStyle, textAlign: 'center'}}>Trip Status</th>
                            <th style={{...thStyle, textAlign: 'center'}}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>Loading trips...</td></tr>}
                        {!loading && !trips.length && (
                            <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                {search || statusFilter ? 'No trip matches that.' : 'No lorry receipt yet. Use "New Trip / Lorry Receipt" to raise the first one.'}
                            </td></tr>
                        )}
                        {trips.map(trip => {
                            const [bg, fg] = COLOURS[trip.status] || COLOURS.PENDING_DISPATCH;
                            return (
                            <tr key={trip.id}>
                                <td style={{...tdStyle, color: '#2563eb', fontWeight: 'bold'}}>
                                    {trip.lrNo}
                                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>
                                        {trip.date ? trip.date.split('-').reverse().join('-') : ''}
                                        {trip.jobNo ? ' \u00b7 job ' + trip.jobNo : ''}
                                        {trip.ewayBill ? ' \u00b7 e-way ' + trip.ewayBill : ''}
                                    </div>
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{trip.vehicleNo || <span style={{ color: '#b45309' }}>no vehicle yet</span>}</div>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                        {trip.driverName ? 'Driver: ' + trip.driverName : 'Driver not assigned'}
                                        {trip.driverPhone ? ' \u00b7 ' + trip.driverPhone : ''}
                                    </div>
                                </td>
                                <td style={tdStyle}>
                                    {[trip.origin, trip.destination].filter(Boolean).join(' \u2192 ') || '\u2014'}
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                        {[trip.distanceKm ? Number(trip.distanceKm) + ' km' : '', trip.commodity,
                                          trip.chargedWeight ? Number(trip.chargedWeight) + ' t' : '',
                                          trip.freightBasis && trip.freightRate ? trip.freightBasis + ' @ ' + Number(trip.freightRate) : ''].filter(Boolean).join(' \u00b7 ')}
                                    </div>
                                </td>
                                <td style={{...tdStyle, textAlign: 'right'}}>{money(trip.freightAmount)}</td>
                                <td style={{...tdStyle, textAlign: 'right', color: '#dc2626'}}>
                                    {money(trip.advanceToDriver)}
                                    <div style={{ fontSize: '11px', color: trip.advancePosted ? '#166534' : '#b45309', fontWeight: 600 }}>
                                        {trip.advanceToDriver > 0 ? (trip.advancePosted ? 'posted to ledger' : 'not posted') : ''}
                                    </div>
                                    {trip.balance ? <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>balance {money(trip.balance)}</div> : null}
                                </td>
                                <td style={{...tdStyle, textAlign: 'center'}}>
                                    <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: bg, color: fg }}>
                                        {LABELS[trip.status] || trip.status}
                                    </span>
                                    {trip.podReceived && <div style={{ fontSize: '10px', color: '#166534', marginTop: '2px' }}>POD received</div>}
                                </td>
                                <td style={{...tdStyle, textAlign: 'center'}}>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                        {trip.status === 'PENDING_DISPATCH' && (
                                            <button onClick={() => setStatus(trip, 'IN_TRANSIT')} style={{ background: '#fef08a', border: 'none', color: '#854d0e', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Dispatch</button>
                                        )}
                                        {trip.status === 'IN_TRANSIT' && (
                                            <button onClick={() => setStatus(trip, 'DELIVERED')} style={{ background: '#dcfce7', border: 'none', color: '#166534', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Delivered</button>
                                        )}
                                        {trip.advanceToDriver > 0 && !trip.advancePosted && (
                                            <button onClick={() => setAdvanceFor(trip)} style={{ background: '#fff', border: '1px solid #f59e0b', color: '#b45309', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Post advance</button>
                                        )}
                                        {!['DELIVERED', 'CANCELLED'].includes(trip.status) && (
                                            <button onClick={() => setStatus(trip, 'CANCELLED')} style={{ background: 'none', border: '1px solid #fecaca', color: '#b91c1c', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                                        )}
                                        {!trip.advancePosted && trip.status !== 'DELIVERED' && (
                                            <button onClick={() => removeTrip(trip)} title="Delete" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14}/></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div style={{ padding: '10px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '11px', color: '#64748b' }}>
                    Freight is computed from the rate and its basis (per ton x weight, per km x distance, or flat).
                    An advance shows as posted only when a payment voucher was actually written for it.
                </div>
            </div>

        </div>
    );
}
