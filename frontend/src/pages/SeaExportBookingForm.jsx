import React, { useState } from 'react';
import { Ship, Save, X, Plus, Trash2, Calendar, MapPin, Users, Package, IndianRupee, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SeaExportBookingForm({ onClose }) {
    const [activeTab, setActiveTab] = useState('general');

    const [form, setForm] = useState({
        jobNo: '',
        bookingNo: 'BKG-' + new Date().getFullYear() + '-',
        mblNo: '',
        hblNo: '',
        vessel: '',
        voyage: '',
        pol: '', // Port of Loading
        pod: '', // Port of Discharge
        finalDest: '',
        etd: '',
        eta: '',
        
        shipper: '',
        consignee: '',
        notifyParty: '',
        cha: '', // Customs House Agent
        
        freightTerms: 'Prepaid',
        blType: 'Original',
        movementType: 'CY/CY',
    });

    const [containers, setContainers] = useState([
        { id: 1, containerNo: '', sealNo: '', sizeType: '20GP', weight: '', volume: '', pkgs: '' }
    ]);

    const handleAddContainer = () => {
        setContainers([...containers, { id: Date.now(), containerNo: '', sealNo: '', sizeType: '20GP', weight: '', volume: '', pkgs: '' }]);
    };
    // 30-Oct-2026: the container rows were unbound inputs and the bin icon did nothing, so the whole
    // grid was decorative. Both work now.
    const removeContainer = (id) => setContainers(containers.length > 1 ? containers.filter(c => c.id !== id) : containers);
    const updateContainer = (id, field, value) => setContainers(containers.map(c => (c.id === id ? { ...c, [field]: value } : c)));
    const [saving, setSaving] = useState(false);
    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

    // 30-Oct-2026: Save only printed "Booking saved successfully! SI / MBL draft is ready for
    // generation." after a 1.5 s timer - nothing was stored and no draft existed. The booking is now
    // recorded against its export job through /api/freight/events, with the container list in the detail.
    const saveBooking = async () => {
        const jobNo = String(form.jobNo || '').trim();
        if (!jobNo) { toast.error('Which export job is this booking for? Create the job in Export Entry first, then put its job number here.'); return; }
        if (!String(form.bookingNo || '').trim()) { toast.error('Give the booking a number'); return; }
        const filled = containers.filter(c => c.containerNo || c.weight || c.volume || c.pkgs);
        setSaving(true);
        try {
            const detail = [
                form.vessel ? 'Vessel ' + form.vessel + (form.voyage ? ' voy ' + form.voyage : '') : '',
                form.pol || form.pod ? (form.pol || '?') + ' to ' + (form.pod || '?') : '',
                form.etd ? 'ETD ' + form.etd : '', form.eta ? 'ETA ' + form.eta : '',
                form.freightTerms ? 'Freight ' + form.freightTerms : '',
                form.movementType ? 'Movement ' + form.movementType : '',
                filled.length ? 'Containers: ' + filled.map(c => [c.containerNo, c.sizeType, c.sealNo && 'seal ' + c.sealNo,
                    c.weight && c.weight + ' kg', c.volume && c.volume + ' cbm', c.pkgs && c.pkgs + ' pkgs'].filter(Boolean).join(' / ')).join(' | ') : 'No container line filled',
            ].filter(Boolean).join(' \u00b7 ');
            const r = await fetch('/api/freight/events', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ jobNo, jobKind: 'EXPORT', eventType: 'BOOKING', refNo: form.bookingNo, detail }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            toast.success('Booking ' + form.bookingNo + ' recorded on ' + jobNo + (filled.length ? ' with ' + filled.length + ' container line(s)' : ''));
            if (onClose) onClose();
        } catch (err) {
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
        <div style={{ position: 'fixed', top: '70px', left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: '#fff', width: '100%', maxWidth: '1100px', height: '90vh', borderRadius: '8px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                
                {/* Header */}
                <div style={{ padding: '16px 24px', background: '#0f172a', color: '#fff', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Ship size={20} color="#38bdf8"/>
                        <h2 style={{ margin: 0, fontSize: '18px' }}>Ocean Export - Advanced Booking & Job Entry</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24}/></button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0', borderBottom: '2px solid #0f172a', background: '#f8fafc' }}>
                    <button onClick={() => setActiveTab('general')} style={tabStyle(activeTab === 'general')}><MapPin size={16}/> Routing & General</button>
                    <button onClick={() => setActiveTab('parties')} style={tabStyle(activeTab === 'parties')}><Users size={16}/> Parties</button>
                    <button onClick={() => setActiveTab('cargo')} style={tabStyle(activeTab === 'cargo')}><Package size={16}/> Cargo & Containers</button>
                    <button onClick={() => setActiveTab('terms')} style={tabStyle(activeTab === 'terms')}><FileText size={16}/> Terms & Instructions</button>
                </div>

                {/* Form Body - Scrollable */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    
                    {activeTab === 'general' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                            <div>
                                <h4 style={{ margin: '0 0 16px 0', color: '#0369a1', borderBottom: '1px solid #e0f2fe', paddingBottom: '8px' }}>Booking Details</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    {/* 30-Oct-2026: this said "(Auto)" but nothing generated it - it was the fixed
                                        string BKG-2026-901 for every booking. It is typed, and a booking has to name
                                        the export job it belongs to, or there is nothing to attach it to later. */}
                                    <div><label style={labelStyle}>Booking Ref</label><input type="text" value={form.bookingNo} onChange={e => setForm({ ...form, bookingNo: e.target.value })} placeholder="BKG-2026-001" style={inputStyle} /></div>
                                    <div><label style={labelStyle}>Export Job No.</label>
                                        <input type="text" value={form.jobNo} onChange={e => setForm({ ...form, jobNo: e.target.value })} placeholder="the job this booking is for" style={inputStyle} />
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Create the job in Export Entry first; the booking is recorded against it.</div>
                                    </div>
                                    <div><label style={labelStyle}>Master B/L No.</label><input type="text" value={form.mblNo} onChange={e=>setForm({...form, mblNo: e.target.value})} style={inputStyle} /></div>
                                    <div><label style={labelStyle}>House B/L No.</label><input type="text" value={form.hblNo} onChange={e=>setForm({...form, hblNo: e.target.value})} style={inputStyle} /></div>
                                </div>
                                <h4 style={{ margin: '24px 0 16px 0', color: '#0369a1', borderBottom: '1px solid #e0f2fe', paddingBottom: '8px' }}>Vessel & Voyage</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div><label style={labelStyle}>Vessel Name</label><input type="text" value={form.vessel} onChange={e=>setForm({...form, vessel: e.target.value})} style={inputStyle} /></div>
                                    <div><label style={labelStyle}>Voyage No.</label><input type="text" value={form.voyage} onChange={e=>setForm({...form, voyage: e.target.value})} style={inputStyle} /></div>
                                    <div><label style={labelStyle}>Estimated Departure (ETD)</label><input type="date" value={form.etd} onChange={e=>setForm({...form, etd: e.target.value})} style={inputStyle} /></div>
                                    <div><label style={labelStyle}>Estimated Arrival (ETA)</label><input type="date" value={form.eta} onChange={e=>setForm({...form, eta: e.target.value})} style={inputStyle} /></div>
                                </div>
                            </div>
                            <div>
                                <h4 style={{ margin: '0 0 16px 0', color: '#0369a1', borderBottom: '1px solid #e0f2fe', paddingBottom: '8px' }}>Routing</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                    <div><label style={labelStyle}>Place of Receipt</label><input type="text" style={inputStyle} /></div>
                                    <div><label style={labelStyle}>Port of Loading (POL)</label><input type="text" value={form.pol} onChange={e=>setForm({...form, pol: e.target.value})} style={inputStyle} /></div>
                                    <div><label style={labelStyle}>Port of Discharge (POD)</label><input type="text" value={form.pod} onChange={e=>setForm({...form, pod: e.target.value})} style={inputStyle} /></div>
                                    <div><label style={labelStyle}>Place of Delivery (Final Dest.)</label><input type="text" value={form.finalDest} onChange={e=>setForm({...form, finalDest: e.target.value})} style={inputStyle} /></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'parties' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div><label style={labelStyle}>Shipper (Exporter)</label><textarea rows={4} value={form.shipper} onChange={e=>setForm({...form, shipper: e.target.value})} style={inputStyle} placeholder="Name and full address..."></textarea></div>
                            <div><label style={labelStyle}>Consignee</label><textarea rows={4} value={form.consignee} onChange={e=>setForm({...form, consignee: e.target.value})} style={inputStyle} placeholder="Name and full address..."></textarea></div>
                            <div><label style={labelStyle}>Notify Party</label><textarea rows={4} value={form.notifyParty} onChange={e=>setForm({...form, notifyParty: e.target.value})} style={inputStyle} placeholder="Leave blank if Same as Consignee"></textarea></div>
                            <div><label style={labelStyle}>Customs Broker (CHA)</label><textarea rows={4} value={form.cha} onChange={e=>setForm({...form, cha: e.target.value})} style={inputStyle} placeholder="Name and contact..."></textarea></div>
                        </div>
                    )}

                    {activeTab === 'cargo' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h4 style={{ margin: 0, color: '#0369a1' }}>Container & VGM Details</h4>
                                <button onClick={handleAddContainer} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                                    <Plus size={14}/> Add Container
                                </button>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
                                <thead>
                                    <tr>
                                        <th style={{...labelStyle, padding: '8px', borderBottom: '2px solid #e2e8f0'}}>Container No.</th>
                                        <th style={{...labelStyle, padding: '8px', borderBottom: '2px solid #e2e8f0'}}>Seal No.</th>
                                        <th style={{...labelStyle, padding: '8px', borderBottom: '2px solid #e2e8f0'}}>Size/Type</th>
                                        <th style={{...labelStyle, padding: '8px', borderBottom: '2px solid #e2e8f0'}}>Gross Wt. (Kgs)</th>
                                        <th style={{...labelStyle, padding: '8px', borderBottom: '2px solid #e2e8f0'}}>Volume (CBM)</th>
                                        <th style={{...labelStyle, padding: '8px', borderBottom: '2px solid #e2e8f0'}}>Pkgs</th>
                                        <th style={{...labelStyle, padding: '8px', borderBottom: '2px solid #e2e8f0'}}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {containers.map((c, i) => (
                                        <tr key={c.id}>
                                            <td style={{ padding: '8px' }}><input type="text" value={c.containerNo} onChange={e => updateContainer(c.id, 'containerNo', e.target.value.toUpperCase())} placeholder="ABCD1234567" style={inputStyle} /></td>
                                            <td style={{ padding: '8px' }}><input type="text" value={c.sealNo} onChange={e => updateContainer(c.id, 'sealNo', e.target.value)} placeholder="SEAL-998" style={inputStyle} /></td>
                                            <td style={{ padding: '8px' }}>
                                                <select value={c.sizeType} onChange={e => updateContainer(c.id, 'sizeType', e.target.value)} style={inputStyle}>
                                                    <option value="20GP">20&apos; GP</option><option value="40GP">40&apos; GP</option><option value="40HQ">40&apos; HQ</option>
                                                    <option value="20RF">20&apos; RF</option><option value="40RF">40&apos; RF</option><option value="LCL">LCL</option>
                                                </select>
                                            </td>
                                            <td style={{ padding: '8px' }}><input type="number" value={c.weight} onChange={e => updateContainer(c.id, 'weight', e.target.value)} placeholder="Kgs" style={inputStyle} /></td>
                                            <td style={{ padding: '8px' }}><input type="number" value={c.volume} onChange={e => updateContainer(c.id, 'volume', e.target.value)} placeholder="CBM" style={inputStyle} /></td>
                                            <td style={{ padding: '8px' }}><input type="number" value={c.pkgs} onChange={e => updateContainer(c.id, 'pkgs', e.target.value)} placeholder="Qty" style={inputStyle} /></td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                <button onClick={() => removeContainer(c.id)} title={containers.length > 1 ? 'Remove this line' : 'At least one line is needed'}
                                                    style={{ color: containers.length > 1 ? '#ef4444' : '#e5e7eb', background: 'none', border: 'none', cursor: containers.length > 1 ? 'pointer' : 'not-allowed' }}><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <h4 style={{ margin: '0 0 16px 0', color: '#0369a1' }}>Cargo Description (As printed on B/L)</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                                <div><label style={labelStyle}>Marks & Numbers</label><textarea rows={5} style={inputStyle} placeholder="e.g. As Addressed"></textarea></div>
                                <div><label style={labelStyle}>Description of Goods (Include HS Code)</label><textarea rows={5} style={inputStyle} placeholder="e.g. 500 Cartons of Cotton Garments. HS Code: 6205..."></textarea></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'terms' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                            <div>
                                <h4 style={{ margin: '0 0 16px 0', color: '#0369a1' }}>Bill of Lading Terms</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>Freight Terms</label>
                                        <select value={form.freightTerms} onChange={e=>setForm({...form, freightTerms: e.target.value})} style={inputStyle}>
                                            <option>Prepaid</option><option>Collect</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>B/L Type</label>
                                        <select value={form.blType} onChange={e=>setForm({...form, blType: e.target.value})} style={inputStyle}>
                                            <option>Original</option><option>Seaway Bill (Express Release)</option><option>Telex Release</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Movement Type</label>
                                        <select value={form.movementType} onChange={e=>setForm({...form, movementType: e.target.value})} style={inputStyle}>
                                            <option>CY/CY (FCL/FCL)</option><option>CFS/CFS (LCL/LCL)</option><option>CY/CFS (FCL/LCL)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 style={{ margin: '0 0 16px 0', color: '#0369a1' }}>Special Instructions</h4>
                                <div><label style={labelStyle}>Handling Instructions</label><textarea rows={4} style={inputStyle} placeholder="Temperature control, hazardous info, etc."></textarea></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer / Actions */}
                <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 8px 8px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button onClick={onClose} style={{ padding: '10px 24px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={saveBooking} disabled={saving} style={{ padding: '10px 24px', background: saving ? '#64748b' : '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Save size={16}/> Save Advanced Booking
                    </button>
                </div>

            </div>
        </div>
    );
}
