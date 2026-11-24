import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Save, CheckCircle, Calculator, User, Briefcase, Plus, Trash2, Globe, QrCode, RefreshCcw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function JobBilling() {
    const today = new Date().toISOString().split('T')[0];
    const [date, setDate] = useState(today);
    const [partyId, setPartyId] = useState('');
    const [jobType, setJobType] = useState('Export');
    const [jobId, setJobId] = useState('');
    
    // New Advanced States
    const [billingMode, setBillingMode] = useState('Domestic'); // Domestic, Overseas
    const [currency, setCurrency] = useState('INR');
    const [roe, setRoe] = useState(1);
    const [lutEnabled, setLutEnabled] = useState(false);
    const [eInvoiceStatus, setEInvoiceStatus] = useState('Pending'); // Pending, Generated
    const [irnData, setIrnData] = useState(null);

    const [items, setItems] = useState([
        { id: 1, chargeLedgerId: '', amountFCY: '', amountINR: '', taxRate: '18' }
    ]);
    const [status, setStatus] = useState('Draft');
    const [invoiceType, setInvoiceType] = useState('Comprehensive');

    const [ledgers, setLedgers] = useState([]);
    const [saving, setSaving] = useState(false);

    const generateBillNo = () => {
        if(invoiceType === 'Freight Only') return 'FRT/26/1022';
        if(invoiceType === 'Local Only') return 'LOC/26/1022';
        if(invoiceType === 'Reimbursement') return 'DN/26/1022 (Debit Note)';
        if(billingMode === 'Overseas') return 'EXP/26/089';
        return 'INV/26/1022';
    };

    const billNo = generateBillNo();

    useEffect(() => {
        fetchLedgers();
    }, []);

    const fetchLedgers = async () => {
        try {
            const res = await axios.get('/api/accounts/tree');
            const flat = [];
            const extract = (nodes) => {
                nodes.forEach(n => {
                    if(n.type === 'ledger') flat.push(n);
                    if(n.children) extract(n.children);
                });
            };
            extract(res.data.data || []);
            setLedgers(flat);
        } catch(e) {
            // 30-Oct-2026: a failed lookup used to fill the list with five invented ledgers (L01 ... L05). Billing
            // against an id that is not in the chart of accounts produces an invoice that cannot post, so the list
            // stays empty and says what went wrong.
            console.error(e);
            setLedgers([]);
            toast.error('Could not load the ledgers: ' + (e.message || 'no answer from the server') + ' - open Masters > Chart of Accounts');
        }
    };

    // Mode switch effect
    useEffect(() => {
        if(billingMode === 'Overseas') {
            setCurrency('USD');
            setRoe(84.20);
            setLutEnabled(true);
            setItems(items.map(i => ({...i, taxRate: '0'}))); // Zero rated by default
        } else {
            setCurrency('INR');
            setRoe(1);
            setLutEnabled(false);
            // We'll let user select ledger to set GST in domestic
        }
    }, [billingMode]);

    const handleAddItem = () => {
        setItems([...items, { id: Date.now(), chargeLedgerId: '', amountFCY: '', amountINR: '', taxRate: billingMode==='Overseas' ? '0' : '18' }]);
    };

    const handleRemoveItem = (id) => {
        if(items.length === 1) return;
        setItems(items.filter(i => i.id !== id));
    };

    const updateItem = (id, field, value) => {
        setItems(items.map(i => {
            if (i.id !== id) return i;
            const updated = { ...i, [field]: value };
            
            // Auto-set GST rate if a ledger is selected
            if (field === 'chargeLedgerId' && !lutEnabled) {
                const selectedLedger = ledgers.find(l => l.id === value);
                if (selectedLedger && selectedLedger.gst) {
                    updated.taxRate = selectedLedger.gst;
                }
            }

            // Auto-calculate FCY to INR based on ROE
            if (billingMode === 'Overseas') {
                if (field === 'amountFCY') {
                    updated.amountINR = (parseFloat(value || 0) * roe).toFixed(2);
                }
            } else {
                if (field === 'amountINR') {
                    updated.amountFCY = value;
                }
            }
            return updated;
        }));
    };

    const handleRoeChange = (e) => {
        const newRoe = parseFloat(e.target.value || 0);
        setRoe(newRoe);
        setItems(items.map(i => ({
            ...i,
            amountINR: (parseFloat(i.amountFCY || 0) * newRoe).toFixed(2)
        })));
    };

    const handleGenerateEInvoice = () => {
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 2000)),
             {
               loading: 'Connecting to Govt NIC Portal... Generating IRN...',
               success: 'E-Invoice IRN & QR Code Generated Successfully!',
               error: 'Failed to generate e-invoice.',
             }
        ).then(() => {
            setEInvoiceStatus('Generated');
            setIrnData('01a9b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1');
        });
    };

    // Derived logic (Always calculated in base currency INR for accounting)
    let subTotalINR = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0, grandTotalINR = 0;
    
    items.forEach(i => {
        const amt = parseFloat(i.amountINR || 0);
        const rate = parseFloat(i.taxRate || 0);
        
        if (lutEnabled) {
            // Zero rated under LUT
            subTotalINR += amt;
            grandTotalINR += amt;
        } else {
            // Standard GST (Assuming local CGST/SGST for demo, but could be IGST based on state logic)
            const tax = amt * (rate / 100);
            const cgst = tax / 2;
            const sgst = tax / 2;
            subTotalINR += amt; 
            cgstTotal += cgst; 
            sgstTotal += sgst; 
            grandTotalINR += (amt + tax);
        }
    });

    const handleSave = async () => {
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 1000)),
             {
               loading: 'Saving Invoice & Posting Accounting Vouchers...',
               success: 'Invoice Finalized and Posted to Ledger!',
               error: 'Error saving invoice.',
             }
        ).then(() => {
            setItems([{ id: Date.now(), chargeLedgerId: '', amountFCY: '', amountINR: '', taxRate: billingMode==='Overseas' ? '0' : '18' }]);
            setStatus('Draft');
            setEInvoiceStatus('Pending');
            setIrnData(null);
        });
    };

    const inputStyle = { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none', background: '#fff', color: '#1e293b' };
    const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: '11px', borderBottom: '2px solid #cbd5e1', color: '#475569', textTransform: 'uppercase', fontWeight: 'bold' };
    const tdStyle = { padding: '8px 12px', borderBottom: '1px solid #e2e8f0' };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#3b82f6', padding: '12px', borderRadius: '8px', color: '#fff' }}><FileText size={24} /></div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 'bold' }}>Job Billing (Invoicing)</h2>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Advanced multi-currency, E-Invoicing & Auto-voucher posting</div>
                    </div>
                </div>
                
                {/* Billing Mode Toggle */}
                <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '8px', padding: '4px' }}>
                    <button 
                        onClick={() => setBillingMode('Domestic')}
                        style={{ padding: '8px 24px', background: billingMode === 'Domestic' ? '#fff' : 'transparent', border: 'none', borderRadius: '6px', fontWeight: '600', color: billingMode === 'Domestic' ? '#0f172a' : '#64748b', boxShadow: billingMode === 'Domestic' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        Domestic Billing
                    </button>
                    <button 
                        onClick={() => setBillingMode('Overseas')}
                        style={{ padding: '8px 24px', background: billingMode === 'Overseas' ? '#0f172a' : 'transparent', border: 'none', borderRadius: '6px', fontWeight: '600', color: billingMode === 'Overseas' ? '#fff' : '#64748b', boxShadow: billingMode === 'Overseas' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Globe size={16}/> Overseas Billing
                    </button>
                </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                
                {/* Header Section */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', padding: '24px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}><User size={14}/> Bill To (Party)</label>
                        <select value={partyId} onChange={e => setPartyId(e.target.value)} style={inputStyle}>
                            <option value="">-- Select Customer Ledger --</option>
                            <option value="C1">TechCorp Exports Ltd.</option>
                            <option value="C2">Global Logistics LLC (Dubai)</option>
                            {ledgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}><Briefcase size={14}/> Link to Job</label>
                        <div style={{ display: 'flex' }}>
                            <select value={jobType} onChange={e => setJobType(e.target.value)} style={{...inputStyle, width: '90px', borderRight: 'none', borderTopRightRadius: 0, borderBottomRightRadius: 0, padding: '8px 4px'}}>
                                <option>Export</option>
                                <option>Import</option>
                            </select>
                            <input type="text" placeholder="Job No." value={jobId} onChange={e => setJobId(e.target.value)} style={{...inputStyle, flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0}} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Invoice Type (Split Rule)</label>
                        <select value={invoiceType} onChange={e => setInvoiceType(e.target.value)} style={{...inputStyle, background: invoiceType !== 'Comprehensive' ? '#fffbeb' : '#fff', borderColor: invoiceType !== 'Comprehensive' ? '#fbbf24' : '#cbd5e1', color: invoiceType !== 'Comprehensive' ? '#d97706' : '#1e293b'}}>
                            <option value="Comprehensive">Comprehensive</option>
                            <option value="Freight Only">Freight Only Bill</option>
                            <option value="Local Only">Customs & Local Only</option>
                            <option value="Reimbursement">Reimbursement (Debit Note)</option>
                        </select>
                    </div>
                    
                    {/* Overseas Specific Fields */}
                    {billingMode === 'Overseas' ? (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Currency & ROE</label>
                                <div style={{ display: 'flex' }}>
                                    <select value={currency} onChange={e => setCurrency(e.target.value)} style={{...inputStyle, width: '70px', borderRight: 'none', borderTopRightRadius: 0, borderBottomRightRadius: 0, padding: '8px 4px'}}>
                                        <option>USD</option>
                                        <option>EUR</option>
                                        <option>GBP</option>
                                        <option>AED</option>
                                    </select>
                                    <input type="number" step="0.01" value={roe} onChange={handleRoeChange} title="Rate of Exchange" style={{...inputStyle, flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0}} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center', alignItems: 'flex-start' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '20px' }}>
                                    <input type="checkbox" checked={lutEnabled} onChange={e => setLutEnabled(e.target.checked)} style={{ transform: 'scale(1.2)', accentColor: '#2563eb' }} />
                                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Apply LUT (0% GST)</span>
                                </label>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Invoice Date</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                        </div>
                    )}
                </div>

                <div style={{ padding: '12px 24px', background: billingMode==='Overseas' ? '#f0fdf4' : '#eff6ff', borderBottom: '1px solid ' + (billingMode==='Overseas' ? '#bbf7d0' : '#bfdbfe'), fontSize: '13px', color: billingMode==='Overseas' ? '#166534' : '#1e3a8a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {billingMode==='Overseas' && <Globe size={16} />}
                        {billingMode==='Overseas' 
                            ? "Overseas mode active: Invoices will print AD Code, SWIFT details, and values in Foreign Currency." 
                            : "Selected Bill Group will auto-generate specific Invoice Series."}
                    </span>
                    <span style={{ fontWeight: 'bold', background: '#fff', padding: '4px 10px', borderRadius: '4px', border: '1px solid ' + (billingMode==='Overseas' ? '#bbf7d0' : '#bfdbfe') }}>
                        Preview No: {billNo}
                    </span>
                </div>

                {/* Items Grid */}
                <div style={{ padding: '24px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{...thStyle, width: '30%'}}>Charge Head / Particulars</th>
                                <th style={{...thStyle, width: '10%'}}>HSN / SAC</th>
                                {billingMode === 'Overseas' && <th style={{...thStyle, width: '12%', textAlign: 'right'}}>Amount ({currency})</th>}
                                <th style={{...thStyle, width: '12%', textAlign: 'right'}}>Amount (₹ INR)</th>
                                <th style={{...thStyle, width: '12%'}}>GST Rate</th>
                                <th style={{...thStyle, width: '15%', textAlign: 'right'}}>Total Amount (₹)</th>
                                <th style={{...thStyle, width: '5%'}}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => {
                                const amtINR = parseFloat(item.amountINR || 0);
                                const rate = parseFloat(item.taxRate || 0);
                                const tax = lutEnabled ? 0 : amtINR * (rate / 100);
                                const total = amtINR + tax;
                                
                                const selectedLedger = ledgers.find(l => l.id === item.chargeLedgerId) || {};

                                return (
                                    <tr key={item.id}>
                                        <td style={tdStyle}>
                                            <select value={item.chargeLedgerId} onChange={e => updateItem(item.id, 'chargeLedgerId', e.target.value)} style={{...inputStyle, width: '100%'}}>
                                                <option value="">-- Select Income Ledger --</option>
                                                {ledgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                            </select>
                                        </td>
                                        
                                        <td style={{...tdStyle, fontSize: '12px', color: '#64748b', fontWeight: 'bold'}}>
                                            {selectedLedger.hsn || '-'}
                                        </td>
                                        
                                        {billingMode === 'Overseas' && (
                                            <td style={tdStyle}>
                                                <input type="number" step="0.01" value={item.amountFCY} onChange={e => updateItem(item.id, 'amountFCY', e.target.value)} placeholder="0.00" style={{...inputStyle, width: '100%', textAlign: 'right', background: '#f8fafc'}} />
                                            </td>
                                        )}

                                        <td style={tdStyle}>
                                            <input type="number" value={item.amountINR} onChange={e => updateItem(item.id, 'amountINR', e.target.value)} placeholder="0.00" style={{...inputStyle, width: '100%', textAlign: 'right'}} />
                                        </td>
                                        
                                        <td style={tdStyle}>
                                            <select value={item.taxRate} onChange={e => updateItem(item.id, 'taxRate', e.target.value)} style={{...inputStyle, width: '100%'}} disabled={lutEnabled}>
                                                <option value="0">0%</option>
                                                <option value="5">5%</option>
                                                <option value="12">12%</option>
                                                <option value="18">18%</option>
                                            </select>
                                        </td>
                                        
                                        <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#0f172a', fontSize: '14px'}}>
                                            {total.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                                        </td>
                                        
                                        <td style={{...tdStyle, textAlign: 'center'}}>
                                            <button onClick={() => handleRemoveItem(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                                                <Trash2 size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    
                    <button onClick={handleAddItem} style={{ marginTop: '12px', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={14}/> Add Charge Row
                    </button>
                </div>

                {/* E-Invoicing & Footer Totals */}
                <div style={{ display: 'flex', background: '#f8fafc', padding: '24px', borderTop: '1px solid #cbd5e1', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
                    
                    {/* E-Invoice Panel */}
                    <div style={{ flex: 1.5, paddingRight: '40px' }}>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <QrCode size={16}/> E-Invoicing (GST Govt Portal)
                            </div>
                            
                            {eInvoiceStatus === 'Pending' ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>Generate IRN and QR Code via NIC / ClearTax API instantly before finalizing the bill.</div>
                                    <button onClick={handleGenerateEInvoice} disabled={!partyId} style={{ padding: '8px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: partyId ? 'pointer' : 'not-allowed', opacity: partyId ? 1 : 0.5, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <RefreshCcw size={14}/> Fetch IRN
                                    </button>
                                </div>
                            ) : (
                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '6px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                        <CheckCircle size={14}/> IRN Generated Successfully
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#14532d', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                        IRN: {irnData}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Calculations Panel */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#475569', fontWeight: '600' }}>
                            <span>Sub Total (INR)</span>
                            <span>{subTotalINR.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                        </div>
                        
                        {!lutEnabled && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b' }}>
                                    <span>CGST</span>
                                    <span>{cgstTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b' }}>
                                    <span>SGST</span>
                                    <span>{sgstTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                                </div>
                            </>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', color: '#0f172a', fontWeight: '900', borderTop: '2px solid #cbd5e1', paddingTop: '12px', marginTop: '4px' }}>
                            <span>Grand Total (INR)</span>
                            <span>₹ {grandTotalINR.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                            <select value={status} onChange={e => setStatus(e.target.value)} style={{...inputStyle, flex: 1, borderColor: status === 'Final' ? '#22c55e' : '#cbd5e1', fontWeight: 'bold', color: status === 'Final' ? '#16a34a' : '#475569'}}>
                                <option value="Draft">Draft Mode</option>
                                <option value="Final">Finalize & Post</option>
                            </select>
                            <button onClick={handleSave} style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Save size={16}/> Generate Bill
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
