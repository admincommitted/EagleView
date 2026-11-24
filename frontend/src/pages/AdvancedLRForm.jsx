import React, { useState, useEffect, useMemo } from 'react';
import { Truck, Save, X, MapPin, User, Package, IndianRupee, FileText, Compass } from 'lucide-react';
import toast from 'react-hot-toast';

// 30-Oct-2026: this form saved nothing, and 21 of its 23 boxes were not even bound to state -
// anything typed into them vanished on the spot. The LR number was hardcoded to LR-2026-9901 and
// "Total Basic Freight" said "Auto Calculated..." but never calculated. It posts to /api/fleet/lr now.
export default function AdvancedLRForm({ onClose, onSaved }) {
    const [activeTab, setActiveTab] = useState('routing');
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState([]);
    const [masters, setMasters] = useState({ transporters: [], ledgers: [], paymentVoucherTypes: [] });
    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

    const [form, setForm] = useState({
        lrNo: '',
        jobNo: '',
        transporterId: '',
        billingLedgerId: '',
        packagingType: 'Cartons',
        advanceMode: 'Bank Transfer (IMPS)',
        remarks: '',
        date: new Date().toISOString().split('T')[0],
        consignor: '',
        consignee: '',
        billingParty: '',
        
        origin: '',
        destination: '',
        distance: '',
        
        vehicleNo: '',
        vehicleType: '32 FT Multi-Axle',
        driverName: '',
        driverPhone: '',
        dlNumber: '',
        
        ewayBill: '',
        invoiceValue: '',
        packages: '',
        actualWeight: '',
        chargedWeight: '',
        commodity: '',
        
        freightBasis: 'Per Ton',
        freightRate: '',
        advanceToDriver: '',
        paymentType: 'To Pay'
    });

    useEffect(() => {
        (async () => {
            try {
                const [nr, mr] = await Promise.all([
                    fetch('/api/fleet/lr/next-no', { headers: auth() }),
                    fetch('/api/fleet/masters', { headers: auth() }),
                ]);
                const nj = await nr.json().catch(() => ({}));
                const mj = await mr.json().catch(() => ({}));
                if (nj.lrNo) setForm(f => ({ ...f, lrNo: nj.lrNo }));
                setMasters({ transporters: mj.transporters || [], ledgers: mj.ledgers || [], paymentVoucherTypes: mj.paymentVoucherTypes || [] });
            } catch (err) { /* the server assigns the number if this failed */ }
        })();
    }, []);

    const num = (x) => { const n = parseFloat(x); return Number.isFinite(n) ? n : 0; };
    // the same arithmetic the server uses, so the box labelled "Auto Calculated" really is
    const freight = useMemo(() => {
        const rate = num(form.freightRate);
        if (!rate) return 0;
        if (form.freightBasis === 'Per Ton') return rate * (num(form.chargedWeight) || num(form.actualWeight));
        if (form.freightBasis === 'Per Km') return rate * num(form.distance);
        return rate;
    }, [form.freightBasis, form.freightRate, form.chargedWeight, form.actualWeight, form.distance]);

    const handleSave = async () => {
        setSaving(true); setErrors([]);
        try {
            const r = await fetch('/api/fleet/lr', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({
                    ...form, distanceKm: form.distance,
                    transporterId: form.transporterId || null, billingLedgerId: form.billingLedgerId || null,
                    remarks: [form.remarks, form.packagingType ? 'Packaging: ' + form.packagingType : '',
                              form.advanceMode ? 'Advance mode: ' + form.advanceMode : ''].filter(Boolean).join(' | '),
                }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) {
                setErrors(j.errors || [j.error || ('HTTP ' + r.status)]);
                toast.error('Not saved - see the messages on the form');
                setSaving(false);
                return;
            }
            toast.success('Lorry receipt ' + j.data.lrNo + ' saved');
            if (onSaved) onSaved(j.data); else if (onClose) onClose();
        } catch (err) {
            setErrors([err.message]);
            toast.error('Not saved: ' + err.message);
        }
        setSaving(false);
    };

    const inputStyle = { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' };
    const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' };
    const tabStyle = (isActive) => ({
        padding: '10px 20px', background: isActive ? '#0f172a' : '#f1f5f9', color: isActive ? '#fff' : '#64748b', 
        border: 'none', borderRadius: '4px 4px 0 0', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', 
        display: 'flex', alignItems: 'center', gap: '8px', borderBottom: isActive ? 'none' : '1px solid #cbd5e1'
    });

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: '#fff', width: '100%', maxWidth: '950px', height: '85vh', borderRadius: '8px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                
                {/* Header */}
                <div style={{ padding: '16px 24px', background: '#0f172a', color: '#fff', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Truck size={20} color="#f59e0b"/>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '18px' }}>Fleet & TMS - New Lorry Receipt (LR) & Trip Entry</h2>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Advanced Dispatch, Freight, and E-Way Bill Tracking</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24}/></button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0', borderBottom: '2px solid #0f172a', background: '#f8fafc' }}>
                    <button onClick={() => setActiveTab('routing')} style={tabStyle(activeTab === 'routing')}><Compass size={16}/> Route & Vehicle</button>
                    <button onClick={() => setActiveTab('parties')} style={tabStyle(activeTab === 'parties')}><User size={16}/> Parties & Docs</button>
                    <button onClick={() => setActiveTab('cargo')} style={tabStyle(activeTab === 'cargo')}><Package size={16}/> Cargo Details</button>
                    <button onClick={() => setActiveTab('commercials')} style={tabStyle(activeTab === 'commercials')}><IndianRupee size={16}/> Trip Commercials</button>
                </div>

                {/* Form Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    
                    {activeTab === 'routing' && (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div><label style={labelStyle}>LR Number (Auto)</label><input type="text" value={form.lrNo} readOnly style={{...inputStyle, background: '#f1f5f9'}} /></div>
                                <div><label style={labelStyle}>Dispatch Date</label><input type="date" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} style={inputStyle} /></div>
                            </div>

                            <h4 style={{ margin: '0 0 16px 0', color: '#0369a1', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>Routing</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div><label style={labelStyle}>From (Origin City/Hub)</label><input type="text" value={form.origin} onChange={e=>setForm({...form, origin: e.target.value})} placeholder="e.g. Mumbai (Bhiwandi)" style={inputStyle} /></div>
                                <div><label style={labelStyle}>To (Destination City)</label><input type="text" value={form.destination} onChange={e=>setForm({...form, destination: e.target.value})} placeholder="e.g. Delhi (Okhla)" style={inputStyle} /></div>
                                <div><label style={labelStyle}>Est. Distance (KM)</label><input type="number" value={form.distance} onChange={e=>setForm({...form, distance: e.target.value})} placeholder="KM" style={inputStyle} /></div>
                            </div>

                            <h4 style={{ margin: '0 0 16px 0', color: '#0369a1', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>Vehicle & Driver (Fleet Allocation)</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div><label style={labelStyle}>Vehicle Number (Reg No.)</label><input type="text" value={form.vehicleNo} onChange={e=>setForm({...form, vehicleNo: e.target.value})} placeholder="MH-04-XX-1234" style={inputStyle} /></div>
                                <div>
                                    <label style={labelStyle}>Vehicle Type</label>
                                    <select value={form.vehicleType} onChange={e=>setForm({...form, vehicleType: e.target.value})} style={inputStyle}>
                                        <option>32 FT Multi-Axle</option><option>20 FT Container</option><option>40 FT Trailer</option><option>Open Body Truck</option><option>LCV (Tata Ace)</option><option>Reefer</option>
                                    </select>
                                </div>
                                <div><label style={labelStyle}>Driver Name</label><input type="text" value={form.driverName} onChange={e=>setForm({...form, driverName: e.target.value})} placeholder="Name..." style={inputStyle} /></div>
                                <div><label style={labelStyle}>Driver Contact Number</label><input type="text" value={form.driverPhone} onChange={e=>setForm({...form, driverPhone: e.target.value})} placeholder="Mobile..." style={inputStyle} /></div>
                                <div><label style={labelStyle}>Driving License No.</label><input type="text" value={form.dlNumber} onChange={e=>setForm({...form, dlNumber: e.target.value})} placeholder="DL No..." style={inputStyle} /></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'parties' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div><label style={labelStyle}>Consignor (Sender)</label><textarea rows={3} value={form.consignor} onChange={e=>setForm({...form, consignor: e.target.value})} style={inputStyle} placeholder="Name, Address &amp; GSTIN..."></textarea></div>
                            <div><label style={labelStyle}>Consignee (Receiver)</label><textarea rows={3} value={form.consignee} onChange={e=>setForm({...form, consignee: e.target.value})} style={inputStyle} placeholder="Name, Address &amp; GSTIN..."></textarea></div>
                            <div>
                                <label style={labelStyle}>Transporter (from the Transporter master)</label>
                                <select value={form.transporterId} onChange={e => {
                                    const t2 = masters.transporters.find(x => String(x.id) === String(e.target.value));
                                    setForm({ ...form, transporterId: e.target.value, vehicleType: t2 && t2.vehicleType ? t2.vehicleType : form.vehicleType });
                                }} style={inputStyle}>
                                    <option value="">-- own vehicle / not from the master --</option>
                                    {masters.transporters.map(t2 => <option key={t2.id} value={t2.id}>{t2.name}{t2.gstin ? ' (' + t2.gstin + ')' : ''}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Job No. (links the trip to a job)</label>
                                <input type="text" value={form.jobNo} onChange={e=>setForm({...form, jobNo: e.target.value})} placeholder="Optional" style={inputStyle} />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={labelStyle}>Billing Party (Who will pay the freight?)</label>
                                <select value={form.paymentType} onChange={e=>setForm({...form, paymentType: e.target.value})} style={inputStyle}>
                                    <option value="Paid">Consignor (Paid)</option>
                                    <option value="To Pay">Consignee (To Pay)</option>
                                    <option value="TBB">Third Party (T.B.B.)</option>
                                </select>
                                <div style={{ marginTop: '12px' }}>
                                    <label style={labelStyle}>Bill it to this ledger (so the freight can be invoiced)</label>
                                    <select value={form.billingLedgerId} onChange={e=>setForm({...form, billingLedgerId: e.target.value})} style={inputStyle}>
                                        <option value="">-- not linked to a ledger --</option>
                                        {masters.ledgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'cargo' && (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div><label style={{...labelStyle, color: '#0284c7'}}>E-Way Bill Number (Crucial)</label><input type="text" value={form.ewayBill} onChange={e=>setForm({...form, ewayBill: e.target.value})} placeholder="12 Digit E-Way Bill" style={{...inputStyle, borderColor: '#bae6fd', background: '#f0f9ff'}} /></div>
                                <div><label style={labelStyle}>Declared Invoice Value (₹)</label><input type="number" value={form.invoiceValue} onChange={e=>setForm({...form, invoiceValue: e.target.value})} placeholder="Material Value for Transit Insurance" style={inputStyle} /></div>
                            </div>
                            
                            <h4 style={{ margin: '0 0 16px 0', color: '#0369a1', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>Measurement & Commodity</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                <div><label style={labelStyle}>Commodity / Cargo</label><input type="text" value={form.commodity} onChange={e=>setForm({...form, commodity: e.target.value})} placeholder="e.g. Auto Parts" style={inputStyle} /></div>
                                <div><label style={labelStyle}>No. of Packages</label><input type="number" value={form.packages} onChange={e=>setForm({...form, packages: e.target.value})} placeholder="Qty" style={inputStyle} /></div>
                                <div><label style={labelStyle}>Packaging Type</label><select value={form.packagingType} onChange={e=>setForm({...form, packagingType: e.target.value})} style={inputStyle}>
                                        <option>Cartons</option><option>Pallets</option><option>Drums</option><option>Bags</option><option>Loose</option>
                                    </select></div>
                                <div><label style={labelStyle}>Actual Weight (Kgs)</label><input type="number" value={form.actualWeight} onChange={e=>setForm({...form, actualWeight: e.target.value})} placeholder="Scale Wt." style={inputStyle} /></div>
                                <div><label style={labelStyle}>Charged Weight (Kgs)</label><input type="number" value={form.chargedWeight} onChange={e=>setForm({...form, chargedWeight: e.target.value})} placeholder="Volumetric or Higher Wt." style={{...inputStyle, fontWeight: 'bold'}} /></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'commercials' && (
                        <div>
                            <h4 style={{ margin: '0 0 16px 0', color: '#0369a1', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><IndianRupee size={18}/> Freight & Charges</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <label style={labelStyle}>Freight Basis</label>
                                    {/* 30-Oct-2026: the old list had "Per Kg" and "Per Package", which the freight arithmetic
                                        never handled. These four are the ones that are actually computed. */}
                                    <select value={form.freightBasis} onChange={e=>setForm({...form, freightBasis: e.target.value})} style={inputStyle}>
                                        <option value="Per Ton">Per Ton (rate x charged weight)</option>
                                        <option value="Per Km">Per Km (rate x distance)</option>
                                        <option value="Per Trip">Per Trip</option>
                                        <option value="Flat">Flat</option>
                                    </select>
                                </div>
                                <div><label style={labelStyle}>Freight Rate (₹)</label><input type="number" value={form.freightRate} onChange={e=>setForm({...form, freightRate: e.target.value})} placeholder="Rate as per basis" style={inputStyle} /></div>
                                <div><label style={labelStyle}>Total Basic Freight (₹)</label><input type="text" value={freight ? freight.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : ''} placeholder="fill the rate and its basis" readOnly style={{...inputStyle, background: '#f1f5f9', fontWeight: 'bold'}} />
                                    {form.freightBasis === 'Per Ton' && num(form.freightRate) > 0 && !num(form.chargedWeight) && !num(form.actualWeight) && (
                                        <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px' }}>A per-ton rate needs the weight (Cargo tab)</div>
                                    )}
                                    {form.freightBasis === 'Per Km' && num(form.freightRate) > 0 && !num(form.distance) && (
                                        <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px' }}>A per-km rate needs the distance (Routing tab)</div>
                                    )}
                                    {num(form.advanceToDriver) > freight && freight > 0 && (
                                        <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px' }}>The advance is more than the whole freight</div>
                                    )}</div>
                            </div>

                            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '16px' }}>
                                <h4 style={{ margin: '0 0 8px 0', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px' }}>Driver Advance (Trip Expense)</h4>
                                <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '16px' }}>Cash or Fastag recharge given to driver for Tolls & Diesel during this trip.</div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div><label style={{...labelStyle, color: '#b91c1c'}}>Advance Amount (₹)</label><input type="number" value={form.advanceToDriver} onChange={e=>setForm({...form, advanceToDriver: e.target.value})} placeholder="e.g. 15000" style={{...inputStyle, borderColor: '#fca5a5'}} /></div>
                                    <div><label style={{...labelStyle, color: '#b91c1c'}}>Advance Mode</label><select value={form.advanceMode} onChange={e=>setForm({...form, advanceMode: e.target.value})} style={{...inputStyle, borderColor: '#fca5a5'}}>
                                            <option>Cash</option><option>Bank Transfer (IMPS)</option><option>Fastag / Fuel Card</option>
                                        </select>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                                            Saving the LR does not post the advance to the ledger. Use &quot;Post advance&quot; on the trip board - it asks which ledgers to use.
                                        </div></div>
                                </div>
                            </div>
                        </div>
                    )}

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
                <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 8px 8px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button onClick={onClose} style={{ padding: '10px 24px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', background: saving ? '#94a3b8' : '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Save size={16}/> {saving ? 'Saving...' : 'Save Lorry Receipt'}
                    </button>
                </div>

            </div>
        </div>
    );
}
