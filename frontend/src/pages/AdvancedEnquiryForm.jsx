import React, { useState, useEffect } from 'react';
import { UserPlus, Save, X, MapPin, Package, FileText, IndianRupee, Clock, Anchor, Plane } from 'lucide-react';
import toast from 'react-hot-toast';

// 30-Oct-2026: this form saved nothing. Its Save button printed "Enquiry saved! Assigned to Pricing
// Dept for Buy Rates" after a 1.5 second timer and closed, and the enquiry number was hardcoded to
// ENQ/26/9021 for every enquiry. It posts to /api/sales/leads now and the number is a real series.
export default function AdvancedEnquiryForm({ onClose, onSaved }) {
    const [activeTab, setActiveTab] = useState('client');
    const [mode, setMode] = useState('Sea'); // Sea, Air, Land

    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState([]);
    const [parties, setParties] = useState([]);
    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

    const [form, setForm] = useState({
        enquiryNo: '',
        partyLedgerId: '',
        designation: '',
        readinessDate: '',
        date: new Date().toISOString().split('T')[0],
        clientName: '',
        contactPerson: '',
        email: '',
        phone: '',
        
        origin: '',
        destination: '',
        incoterms: 'FOB',
        commodity: '',
        
        containerType: '20GP',
        weight: '',
        volume: '',
        
        targetRate: '',
        competitor: '',
        remarks: ''
    });

    useEffect(() => {
        (async () => {
            try {
                const [nr, pr] = await Promise.all([
                    fetch('/api/sales/leads/next-no', { headers: auth() }),
                    fetch('/api/vouchers/ledgers-by-group?groups=Sundry Debtors', { headers: auth() }),
                ]);
                const nj = await nr.json().catch(() => ({}));
                const pj = await pr.json().catch(() => ({}));
                if (nj.enquiryNo) setForm(f => ({ ...f, enquiryNo: nj.enquiryNo }));
                setParties(pj.data || []);
            } catch (err) { /* the number is filled in by the server if this failed */ }
        })();
    }, []);

    const handleSave = async () => {
        setSaving(true); setErrors([]);
        try {
            const r = await fetch('/api/sales/leads', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ ...form, mode, partyLedgerId: form.partyLedgerId || null }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) {
                setErrors(j.errors || [j.error || ('HTTP ' + r.status)]);
                toast.error('Not saved - see the messages on the form');
                setSaving(false);
                return;
            }
            toast.success('Enquiry ' + j.data.enquiryNo + ' saved');
            if (onSaved) onSaved(j.data); else onClose();
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
            <div style={{ background: '#fff', width: '100%', maxWidth: '900px', height: '85vh', borderRadius: '8px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                
                {/* Header */}
                <div style={{ padding: '16px 24px', background: '#0f172a', color: '#fff', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <UserPlus size={20} color="#3b82f6"/>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '18px' }}>Logistics CRM - New Sales Enquiry</h2>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Capture Lead, Routing, and Target Pricing details</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24}/></button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0', borderBottom: '2px solid #0f172a', background: '#f8fafc', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => setActiveTab('client')} style={tabStyle(activeTab === 'client')}><UserPlus size={16}/> Client Details</button>
                        <button onClick={() => setActiveTab('routing')} style={tabStyle(activeTab === 'routing')}><MapPin size={16}/> Routing & Cargo</button>
                        <button onClick={() => setActiveTab('commercials')} style={tabStyle(activeTab === 'commercials')}><IndianRupee size={16}/> Commercials</button>
                    </div>
                    <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '4px', padding: '2px' }}>
                        {['Sea', 'Air', 'Land'].map(m => (
                            <button key={m} onClick={() => setMode(m)} style={{ padding: '4px 12px', border: 'none', background: mode===m ? '#fff' : 'transparent', color: mode===m ? '#0f172a' : '#64748b', fontWeight: 'bold', fontSize: '12px', borderRadius: '2px', cursor: 'pointer', boxShadow: mode===m ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}>
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Form Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    
                    {activeTab === 'client' && (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div><label style={labelStyle}>Enquiry Ref (Auto)</label><input type="text" value={form.enquiryNo} readOnly style={{...inputStyle, background: '#f1f5f9'}} /></div>
                                <div><label style={labelStyle}>Date of Enquiry</label><input type="date" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} style={inputStyle} /></div>
                            </div>
                            <h4 style={{ margin: '0 0 16px 0', color: '#0369a1', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>Prospect / Client Info</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Existing customer (optional - links the enquiry to their ledger)</label>
                                    <select value={form.partyLedgerId} onChange={e => {
                                        const id = e.target.value;
                                        const p = parties.find(x => String(x.id) === String(id));
                                        setForm({ ...form, partyLedgerId: id, clientName: p ? p.name : form.clientName, email: p && p.email ? p.email : form.email, phone: p && p.phone ? p.phone : form.phone });
                                    }} style={inputStyle}>
                                        <option value="">-- new prospect, not in the ledger --</option>
                                        {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Company Name</label><input type="text" value={form.clientName} onChange={e=>setForm({...form, clientName: e.target.value})} placeholder="e.g. Apex Global Exports" style={inputStyle} /></div>
                                <div><label style={labelStyle}>Contact Person</label><input type="text" value={form.contactPerson} onChange={e=>setForm({...form, contactPerson: e.target.value})} placeholder="Full Name" style={inputStyle} /></div>
                                <div><label style={labelStyle}>Designation</label><input type="text" value={form.designation} onChange={e=>setForm({...form, designation: e.target.value})} placeholder="e.g. Logistics Manager" style={inputStyle} /></div>
                                <div><label style={labelStyle}>Email ID</label><input type="email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} placeholder="email@domain.com" style={inputStyle} /></div>
                                <div><label style={labelStyle}>Phone / Mobile</label><input type="text" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} placeholder="+91..." style={inputStyle} /></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'routing' && (
                        <div>
                            <h4 style={{ margin: '0 0 16px 0', color: '#0369a1', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', display: 'flex', gap: '8px' }}>
                                {mode==='Sea' ? <Anchor size={18}/> : (mode==='Air' ? <Plane size={18}/> : <MapPin size={18}/>)} 
                                Route & Terms ({mode} Freight)
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div><label style={labelStyle}>{mode==='Air' ? 'Origin Airport' : 'Port of Loading (POL)'}</label><input type="text" value={form.origin} onChange={e=>setForm({...form, origin: e.target.value})} placeholder="e.g. Nhava Sheva (INNSA)" style={inputStyle} /></div>
                                <div><label style={labelStyle}>{mode==='Air' ? 'Dest Airport' : 'Port of Discharge (POD)'}</label><input type="text" value={form.destination} onChange={e=>setForm({...form, destination: e.target.value})} placeholder="e.g. Jebel Ali (AEJEA)" style={inputStyle} /></div>
                                <div>
                                    <label style={labelStyle}>Incoterms</label>
                                    <select value={form.incoterms} onChange={e=>setForm({...form, incoterms: e.target.value})} style={inputStyle}>
                                        <option>FOB</option><option>EXW</option><option>FCA</option><option>CFR</option><option>CIF</option><option>CPT</option><option>CIP</option><option>DAP</option><option>DPU</option><option>DDP</option>
                                    </select>
                                </div>
                                <div><label style={labelStyle}>Readiness Date</label><input type="date" value={form.readinessDate} onChange={e=>setForm({...form, readinessDate: e.target.value})} style={inputStyle} /></div>
                            </div>

                            <h4 style={{ margin: '0 0 16px 0', color: '#0369a1', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>Cargo Details</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                <div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>Commodity / Cargo Type</label><input type="text" value={form.commodity} onChange={e=>setForm({...form, commodity: e.target.value})} placeholder="e.g. Pharmaceuticals, General Cargo, Haz..." style={inputStyle} /></div>
                                {mode === 'Sea' && (
                                    <div>
                                        <label style={labelStyle}>Container Size/Type</label>
                                        <select value={form.containerType} onChange={e=>setForm({...form, containerType: e.target.value})} style={inputStyle}>
                                            <option value="20GP">20&apos; GP</option><option value="40GP">40&apos; GP</option><option value="40HQ">40&apos; HQ</option>
                                            <option value="20RF">20&apos; Reefer</option><option value="40RF">40&apos; Reefer</option><option value="LCL">LCL</option><option value="AIR">Air cargo</option>
                                        </select>
                                    </div>
                                )}
                                <div><label style={labelStyle}>Gross Wt. (Kgs)</label><input type="number" value={form.weight} onChange={e=>setForm({...form, weight: e.target.value})} placeholder="Total Weight" style={inputStyle} /></div>
                                <div><label style={labelStyle}>Volume ({mode==='Air' ? 'Vol. Wt.' : 'CBM'})</label><input type="number" value={form.volume} onChange={e=>setForm({...form, volume: e.target.value})} placeholder="Total Volume" style={inputStyle} /></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'commercials' && (
                        <div>
                            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', padding: '16px', marginBottom: '24px' }}>
                                <h4 style={{ margin: '0 0 8px 0', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={16}/> Target Pricing & Competitor Intel</h4>
                                <div style={{ fontSize: '12px', color: '#b45309', marginBottom: '16px' }}>Provide target rates to help the Pricing Desk negotiate better Buy Rates with shipping lines/airlines.</div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div><label style={{...labelStyle, color: '#92400e'}}>Client's Target Rate (FCY)</label><input type="text" value={form.targetRate} onChange={e=>setForm({...form, targetRate: e.target.value})} placeholder="e.g. USD 1200 / TEU" style={{...inputStyle, borderColor: '#fcd34d'}} /></div>
                                    <div><label style={{...labelStyle, color: '#92400e'}}>Current Competitor</label><input type="text" value={form.competitor} onChange={e=>setForm({...form, competitor: e.target.value})} placeholder="e.g. DSV or Kuehne+Nagel" style={{...inputStyle, borderColor: '#fcd34d'}} /></div>
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Sales Remarks / Special Instructions</label>
                                <textarea rows="4" value={form.remarks} onChange={e=>setForm({...form, remarks: e.target.value})} placeholder="Client requires 14 days free time at destination..." style={inputStyle}></textarea>
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
                    <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Save size={16}/> {saving ? 'Saving...' : 'Save Enquiry'}
                    </button>
                </div>

            </div>
        </div>
    );
}
