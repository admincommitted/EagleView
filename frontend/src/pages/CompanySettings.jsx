import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Upload, Save, Building, MapPin, Landmark, FileText, CheckCircle, Image as ImageIcon, Mail, Link } from 'lucide-react';
import toast from 'react-hot-toast';

// 30-Oct-2026: this screen used to show an invented company (name, GSTIN, bank account, SMTP) and its Save
// button only printed "Settings updated successfully!" without sending anything anywhere. It now reads and
// writes the real CompanyProfile / EmailConfig rows, and the e-invoice test actually contacts the endpoint.
const BLANK = {
    companyName: '', legalName: '', tagline: '', email: '', phone: '', website: '',
    address1: '', address2: '', city: '', state: '', pincode: '', country: 'INDIA',
    pan: '', gstin: '', iec: '', lutNo: '', cin: '',
    bankName: '', accountName: '', accountNo: '', ifsc: '', swift: '',
    smtpHost: '', smtpPort: '', smtpUser: '', smtpPass: '',
    einvoiceUser: '', einvoicePass: '', einvoiceBaseUrl: '',
    fax: '', registeredOffice: '', invoiceNotes: '',
};
// 08-Nov-2026: what the GST invoice prints when these boxes are empty (as on the iCAFFE invoice)
const INVOICE_DEFAULT_REG = 'A-406, Road No. 4,Street No.8, Mahipalpur Extn. New Delhi - 110037, India Tel : +91 (11) 46151111 Email : contact@committedcargo.com';
const INVOICE_DEFAULT_NOTES = ['This Invoice System Generated Signature No Require.', 'E & O. E.,', 'We reserve the right to charge interest @ 18% p.a. on amount outstanding after the due date.', "All Cheques & Demand Drafts should be in favour of 'COMMITTED CARGO CARE LIMITED'", 'Cheques / Drafts are subject to realisation.', 'Any dispute, discrepany or any supporting documents required must be notified within 7 days, failing which the Invoice will be treated as true and correct.', 'All disputes are subject to NEW DELHI jurisdiction.'].join('\n');

export default function CompanySettings() {
    const [activeTab, setActiveTab] = useState('general');
    const [logo, setLogo] = useState(null);
    const [defaultLogo, setDefaultLogo] = useState('');   // 08-Nov-2026: printed when no logo is uploaded
    const [logoCleared, setLogoCleared] = useState(false);
    const [form, setForm] = useState(BLANK);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState([]);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [smtpHasPassword, setSmtpHasPassword] = useState(false);
    const [lastTest, setLastTest] = useState(null);

    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [cr, er] = await Promise.all([
                fetch('/api/settings/company', { headers: auth() }),
                fetch('/api/settings/email', { headers: auth() }),
            ]);
            const cj = await cr.json().catch(() => ({}));
            const ej = await er.json().catch(() => ({}));
            const c = (cj && cj.data) || {};
            const e = (ej && ej.data) || {};
            setForm({
                ...BLANK,
                ...Object.fromEntries(Object.keys(BLANK).map(k => [k, c[k] != null ? String(c[k]) : (BLANK[k] || '')])),
                smtpHost: e.smtpHost || '', smtpPort: e.smtpPort != null ? String(e.smtpPort) : '',
                smtpUser: e.smtpUser || '', smtpPass: '',
            });
            setSmtpHasPassword(!!e.hasPassword);
            if (c.logoDataUrl) setLogo(c.logoDataUrl); else setLogo(null);
            setLogoCleared(false);
            fetch('/api/settings/company/default-logo', { headers: auth() }).then(r => r.json()).then(j => setDefaultLogo((j && j.dataUrl) || '')).catch(() => {});
            if (c.einvoiceLastTestAt) {
                setLastTest({ at: c.einvoiceLastTestAt, ok: c.einvoiceLastTestOk, message: c.einvoiceLastTestMessage });
            }
        } catch (err) {
            toast.error('Could not load company settings: ' + err.message);
        }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleInputChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 400 * 1024) { toast.error('Logo must be under 400 KB - it is stored with the company profile and printed on every invoice.'); return; }
        const fr = new FileReader();
        fr.onload = () => { setLogo(String(fr.result)); setLogoCleared(false); };   // kept as a data URL so it saves with the profile
        fr.onerror = () => toast.error('Could not read that image');
        fr.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true); setErrors([]);
        try {
            const company = {};
            ['companyName', 'legalName', 'tagline', 'email', 'phone', 'website', 'address1', 'address2', 'city', 'state',
             'pincode', 'country', 'pan', 'gstin', 'iec', 'lutNo', 'cin', 'bankName', 'accountName', 'accountNo', 'ifsc',
             'swift', 'einvoiceUser', 'einvoiceBaseUrl', 'fax', 'registeredOffice', 'invoiceNotes'].forEach(k => { company[k] = form[k] || null; });
            if (form.einvoicePass) company.einvoicePass = form.einvoicePass;
            if (logo) company.logoDataUrl = logo; else if (logoCleared) company.logoDataUrl = null;

            const cr = await fetch('/api/settings/company', {
                method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth() }, body: JSON.stringify(company),
            });
            const cj = await cr.json().catch(() => ({}));
            if (!cr.ok || cj.success === false) {
                setErrors(cj.errors || [cj.error || ('Company profile did not save (HTTP ' + cr.status + ')')]);
                toast.error('Company profile not saved - see the messages on screen');
                setSaving(false);
                return;
            }

            const email = { smtpHost: form.smtpHost || null, smtpUser: form.smtpUser || null };
            if (form.smtpPort !== '') email.smtpPort = form.smtpPort;
            if (form.smtpPass) email.smtpPass = form.smtpPass;
            const er = await fetch('/api/settings/email', {
                method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth() }, body: JSON.stringify(email),
            });
            const ej = await er.json().catch(() => ({}));
            if (!er.ok || ej.success === false) {
                setErrors(ej.errors || [ej.error || ('Email settings did not save (HTTP ' + er.status + ')')]);
                toast.error('Company profile saved, but the email settings did not');
                setSaving(false);
                await load();
                return;
            }
            toast.success('Saved');
            await load();
        } catch (err) {
            toast.error('Save failed: ' + err.message);
        }
        setSaving(false);
    };

    const handleTestEinvoice = async () => {
        setTesting(true); setTestResult(null);
        try {
            const r = await fetch('/api/settings/test-einvoice', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ baseUrl: form.einvoiceBaseUrl || undefined, username: form.einvoiceUser || undefined }),
            });
            const j = await r.json().catch(() => ({}));
            setTestResult({ ok: !!j.success, text: j.message || j.error || ('HTTP ' + r.status) });
            if (j.success) toast.success('Endpoint reachable'); else toast.error('Test failed');
        } catch (err) {
            setTestResult({ ok: false, text: 'Could not run the test: ' + err.message });
            toast.error('Test failed');
        }
        setTesting(false);
    };

    const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '24px' };
    const inputStyle = { padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' };
    const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' };
    const tabStyle = (isActive) => ({
        padding: '12px 24px', background: isActive ? '#f1f5f9' : 'transparent', border: 'none', 
        borderLeft: isActive ? '3px solid #2563eb' : '3px solid transparent', 
        color: isActive ? '#0f172a' : '#64748b', fontWeight: isActive ? 'bold' : 'normal', 
        cursor: 'pointer', fontSize: '14px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', width: '100%'
    });

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Segoe UI' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#475569', padding: '12px', borderRadius: '8px', color: '#fff' }}><Settings size={24} /></div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 'bold' }}>Company Settings</h2>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Manage your branding, registered address, and compliance details</div>
                    </div>
                </div>
                <button onClick={handleSave} disabled={saving || loading} style={{ padding: '10px 24px', background: saving || loading ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: saving || loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Save size={18}/> {saving ? 'Saving...' : loading ? 'Loading...' : 'Save Settings'}
                </button>
            </div>

            {errors.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px' }}>
                    <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '13px', marginBottom: '6px' }}>Nothing was saved. Fix these first:</div>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#b91c1c', fontSize: '13px' }}>
                        {errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '32px' }}>
                
                {/* Left Sidebar Menu */}
                <div style={{ ...cardStyle, padding: '12px 0' }}>
                    <button onClick={() => setActiveTab('general')} style={tabStyle(activeTab === 'general')}><Building size={18}/> General Profile</button>
                    <button onClick={() => setActiveTab('address')} style={tabStyle(activeTab === 'address')}><MapPin size={18}/> Address & Contact</button>
                    <button onClick={() => setActiveTab('tax')} style={tabStyle(activeTab === 'tax')}><FileText size={18}/> Tax & Compliance</button>
                    <button onClick={() => setActiveTab('bank')} style={tabStyle(activeTab === 'bank')}><Landmark size={18}/> Bank Details</button>
                    <button onClick={() => setActiveTab('invoice')} style={tabStyle(activeTab === 'invoice')}><FileText size={18}/> Invoice Print</button>
                    <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
                    <button onClick={() => setActiveTab('smtp')} style={tabStyle(activeTab === 'smtp')}><Mail size={18}/> Email (SMTP) Setup</button>
                    <button onClick={() => setActiveTab('api')} style={tabStyle(activeTab === 'api')}><Link size={18}/> API & E-Invoice</button>
                </div>

                {/* Right Content Area */}
                <div>
                    {activeTab === 'general' && (
                        <div style={cardStyle}>
                            <h3 style={{ margin: '0 0 24px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Building size={20} color="#2563eb"/> General Profile
                            </h3>
                            
                            <div style={{ display: 'flex', gap: '40px', marginBottom: '32px' }}>
                                <div>
                                    <label style={labelStyle}>Company Logo</label>
                                    <div style={{ width: '160px', height: '160px', border: '2px dashed #cbd5e1', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
                                        {logo || defaultLogo ? (
                                            <img src={logo || defaultLogo} alt="Company Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                        ) : (
                                            <>
                                                <ImageIcon size={32} color="#94a3b8" style={{ marginBottom: '8px' }}/>
                                                <span style={{ fontSize: '12px', color: '#64748b' }}>No Logo Uploaded</span>
                                            </>
                                        )}
                                        <input type="file" onChange={handleLogoUpload} accept="image/*" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} title="Upload new logo" />
                                    </div>
                                    <div style={{ fontSize: '11px', color: logo ? '#16a34a' : '#64748b', marginTop: '6px', textAlign: 'center', width: '160px' }}>{logo ? (logoCleared ? '' : 'Your logo - printed on invoices') : 'Default logo - printed on invoices'}</div>
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', width: '160px' }}>
                                        <label style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: '12px', fontWeight: 600, color: '#fff', background: '#2563eb', borderRadius: '6px', cursor: 'pointer' }}>
                                            Change Logo
                                            <input type="file" onChange={handleLogoUpload} accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }} />
                                        </label>
                                        {logo && <button type="button" onClick={() => { setLogo(null); setLogoCleared(true); }} title="Remove your logo - the default logo prints again"
                                            style={{ flex: 1, padding: '6px 0', fontSize: '12px', fontWeight: 600, color: '#b91c1c', background: '#fff', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer' }}>Remove</button>}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', textAlign: 'center', width: '160px' }}>PNG / JPG, under 400 KB, square works best. Press Save to keep it.</div>
                                </div>
                                
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>Company Name (Printed on Invoices)</label>
                                        <input type="text" name="companyName" value={form.companyName} onChange={handleInputChange} style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Tagline / Slogan</label>
                                        <input type="text" name="tagline" value={form.tagline} onChange={handleInputChange} style={inputStyle} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <label style={labelStyle}>Primary Email</label>
                                            <input type="email" name="email" value={form.email} onChange={handleInputChange} style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Website</label>
                                            <input type="text" name="website" value={form.website} onChange={handleInputChange} style={inputStyle} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'address' && (
                        <div style={cardStyle}>
                            <h3 style={{ margin: '0 0 24px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <MapPin size={20} color="#2563eb"/> Registered Address
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                <div><label style={labelStyle}>Address Line 1</label><input type="text" name="address1" value={form.address1} onChange={handleInputChange} style={inputStyle} /></div>
                                <div><label style={labelStyle}>Address Line 2 (Optional)</label><input type="text" name="address2" value={form.address2} onChange={handleInputChange} style={inputStyle} /></div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                                <div><label style={labelStyle}>City</label><input type="text" name="city" value={form.city} onChange={handleInputChange} style={inputStyle} /></div>
                                <div><label style={labelStyle}>State</label><input type="text" name="state" value={form.state} onChange={handleInputChange} style={inputStyle} /></div>
                                <div><label style={labelStyle}>PIN Code / Zip</label><input type="text" name="pincode" value={form.pincode} onChange={handleInputChange} style={inputStyle} /></div>
                                <div><label style={labelStyle}>Country</label><input type="text" name="country" value={form.country} onChange={handleInputChange} style={inputStyle} /></div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                                <div><label style={labelStyle}>Corporate Phone Number</label><input type="text" name="phone" value={form.phone} onChange={handleInputChange} style={inputStyle} /></div>
                                <div><label style={labelStyle}>Fax Number</label><input type="text" name="fax" value={form.fax} onChange={handleInputChange} style={inputStyle} placeholder="011-46040343" /></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'tax' && (
                        <div style={cardStyle}>
                            <h3 style={{ margin: '0 0 24px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={20} color="#2563eb"/> Tax & Compliance (India)
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div><label style={labelStyle}>Company PAN Number</label><input type="text" name="pan" value={form.pan} onChange={handleInputChange} style={inputStyle} maxLength={10} /></div>
                                <div><label style={labelStyle}>GSTIN Number</label><input type="text" name="gstin" value={form.gstin} onChange={handleInputChange} style={inputStyle} maxLength={15} /></div>
                                <div><label style={labelStyle}>LUT No. (For Export without IGST)</label><input type="text" name="lutNo" value={form.lutNo} onChange={handleInputChange} style={inputStyle} /></div>
                                <div><label style={labelStyle}>CIN (Corporate Identity Number)</label><input type="text" name="cin" value={form.cin} onChange={handleInputChange} style={inputStyle} /></div>
                                <div><label style={labelStyle}>IEC (Importer Exporter Code)</label><input type="text" name="iec" value={form.iec} onChange={handleInputChange} style={inputStyle} maxLength={10} /></div>
                                <div><label style={labelStyle}>Legal Name (as in the GST registration)</label><input type="text" name="legalName" value={form.legalName} onChange={handleInputChange} style={inputStyle} /></div>
                            </div>
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '24px', display: 'flex', gap: '12px' }}>
                                <CheckCircle color="#10b981" size={20} style={{ flexShrink: 0 }}/>
                                <div style={{ fontSize: '13px', color: '#475569' }}>These details will be strictly used while generating standard PDF Tax Invoices, Debit Notes, and Quotations. Please ensure your GSTIN is accurate.</div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'invoice' && (
                        <div style={cardStyle}>
                            <h3 style={{ margin: '0 0 8px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={20} color="#2563eb"/> Invoice Print
                            </h3>
                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Printed at the foot of every GST invoice. Left empty, the invoice prints the text shown in grey (as on the iCAFFE invoice). The bank details on the invoice are fixed.</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                <div><label style={labelStyle}>Registered Office (one line)</label><textarea name="registeredOffice" value={form.registeredOffice} onChange={handleInputChange} rows={2} style={{ ...inputStyle, height: 'auto', resize: 'vertical' }} placeholder={INVOICE_DEFAULT_REG} /></div>
                                <div><label style={labelStyle}>Invoice Notes - "Spl. Note" (one note per line; the first prints in bold)</label><textarea name="invoiceNotes" value={form.invoiceNotes} onChange={handleInputChange} rows={8} style={{ ...inputStyle, height: 'auto', resize: 'vertical', fontFamily: 'inherit' }} placeholder={INVOICE_DEFAULT_NOTES} /></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'bank' && (
                        <div style={cardStyle}>
                            <h3 style={{ margin: '0 0 24px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Landmark size={20} color="#2563eb"/> Bank Details (For Invoice Footer)
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div><label style={labelStyle}>Bank Name</label><input type="text" name="bankName" value={form.bankName} onChange={handleInputChange} style={inputStyle} /></div>
                                <div><label style={labelStyle}>Account Name</label><input type="text" name="accountName" value={form.accountName} onChange={handleInputChange} style={inputStyle} /></div>
                                <div><label style={labelStyle}>Account Number</label><input type="text" name="accountNo" value={form.accountNo} onChange={handleInputChange} style={inputStyle} /></div>
                                <div><label style={labelStyle}>IFSC Code</label><input type="text" name="ifsc" value={form.ifsc} onChange={handleInputChange} style={inputStyle} /></div>
                                <div><label style={labelStyle}>SWIFT Code (For Overseas Remittance)</label><input type="text" name="swift" value={form.swift} onChange={handleInputChange} style={inputStyle} /></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'smtp' && (
                        <div style={cardStyle}>
                            <h3 style={{ margin: '0 0 24px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Mail size={20} color="#2563eb"/> Email (SMTP) Setup
                            </h3>
                            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Configure these credentials to send Quotes, Invoices, and DSRs directly from the ERP.</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div><label style={labelStyle}>SMTP Host</label><input type="text" name="smtpHost" value={form.smtpHost} onChange={handleInputChange} style={inputStyle} /></div>
                                <div><label style={labelStyle}>SMTP Port</label><input type="text" name="smtpPort" value={form.smtpPort} onChange={handleInputChange} style={inputStyle} /></div>
                                <div><label style={labelStyle}>SMTP Username (Email)</label><input type="text" name="smtpUser" value={form.smtpUser} onChange={handleInputChange} style={inputStyle} /></div>
                                <div><label style={labelStyle}>SMTP Password / App Password</label><input type="password" name="smtpPass" value={form.smtpPass} onChange={handleInputChange} style={inputStyle} placeholder={smtpHasPassword ? 'A password is saved - leave blank to keep it' : 'Not set yet'} /></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'api' && (
                        <div style={cardStyle}>
                            <h3 style={{ margin: '0 0 24px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Link size={20} color="#2563eb"/> API & E-Invoice Integration
                            </h3>
                            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>API Credentials for Govt E-Invoice Portal and ICEGATE integrations.</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div><label style={labelStyle}>E-Invoice API Username</label><input type="text" name="einvoiceUser" value={form.einvoiceUser} onChange={handleInputChange} style={inputStyle} /></div>
                                <div><label style={labelStyle}>E-Invoice API Password</label><input type="password" name="einvoicePass" value={form.einvoicePass} onChange={handleInputChange} style={inputStyle} placeholder="Leave blank to keep the saved one" /></div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={labelStyle}>E-Invoice API URL (from your GSP / NIC)</label>
                                    <input type="text" name="einvoiceBaseUrl" value={form.einvoiceBaseUrl} onChange={handleInputChange} style={inputStyle} placeholder="https://<gsp-host>/eivital/v1.04/auth" />
                                </div>
                            </div>
                            <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button onClick={handleTestEinvoice} disabled={testing} style={{ padding: '8px 16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold', color: '#0f172a', cursor: testing ? 'wait' : 'pointer' }}>
                                    {testing ? 'Contacting the endpoint...' : 'Test E-Invoice API Connection'}
                                </button>
                                <span style={{ fontSize: '12px', color: '#64748b' }}>Save first - the test uses the URL and username in the boxes above.</span>
                            </div>
                            {testResult && (
                                <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '6px', fontSize: '13px',
                                    background: testResult.ok ? '#ecfdf5' : '#fef2f2', border: '1px solid ' + (testResult.ok ? '#a7f3d0' : '#fecaca'),
                                    color: testResult.ok ? '#065f46' : '#991b1b' }}>
                                    {testResult.text}
                                </div>
                            )}
                            {!testResult && lastTest && (
                                <div style={{ marginTop: '16px', fontSize: '12px', color: '#64748b' }}>
                                    Last test {new Date(lastTest.at).toLocaleString('en-GB')} - {lastTest.ok ? 'reachable' : 'failed'}: {lastTest.message}
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
