import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Save, Plus, Trash2, Briefcase, Building, Calculator, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VendorBillEntry() {
    const [billType, setBillType] = useState('Trade'); // 'Trade' or 'Non-Trade'
    const [header, setHeader] = useState({
        vendorId: '',
        vendorInvoiceNo: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        remarks: ''
    });

    const [items, setItems] = useState([
        { id: 1, jobId: '', expenseLedgerId: '', amount: '', taxRate: '18', tdsRate: '0' }
    ]);

    const [saving, setSaving] = useState(false);

    // 30-Oct-2026: the vendor list and the expense ledgers were written into this file - "Maersk Line India Pvt
    // Ltd", ledger ids E01 ... A05 that exist nowhere. A bill raised against them could never post. Both lists come
    // from the real masters now: vendors from the party master, ledgers from the chart of accounts.
    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };
    const [vendors, setVendors] = useState([]);
    const [allLedgers, setAllLedgers] = useState([]);
    const [voucherTypes, setVoucherTypes] = useState([]);
    const [loadErr, setLoadErr] = useState('');

    const loadMasters = useCallback(async () => {
        try {
            const [lr, mr] = await Promise.all([
                fetch('/api/accounts/tree', { headers: auth() }),
                fetch('/api/accounting-masters/all', { headers: auth() }),
            ]);
            const ld = await lr.json().catch(() => ({}));
            const flat = [];
            (function walk(ns, group) { (ns || []).forEach(n => {
                if (n.type === 'ledger') flat.push({ id: n.id, name: n.name, group: n.groupName || group || '' });
                if (n.children) walk(n.children, n.type === 'group' ? n.name : group);
            }); })(ld.data || [], '');
            setAllLedgers(flat);
            // the vendor of a purchase voucher IS its creditor ledger - a bill cannot be booked against anything else
            setVendors(flat.filter(l => /creditor|payable/i.test(String(l.group || ''))).map(l => ({ id: l.id, name: l.name, ledgerId: l.id })));
            const md = await mr.json().catch(() => ({}));
            setVoucherTypes(((md.data || {}).voucherTypes) || []);
            setLoadErr(flat.length ? '' : 'No ledgers in the chart of accounts yet - open Masters > Chart of Accounts');
        } catch (e) {
            setVendors([]); setAllLedgers([]);
            setLoadErr('Could not load the masters: ' + e.message);
        }
    }, []);
    useEffect(() => { loadMasters(); }, [loadMasters]);

    // Trade bills are booked to direct-cost ledgers, non-trade to the rest; the operator can still pick any of them
    const ledgers = allLedgers.filter(l => {
        const g = String(l.group || '').toLowerCase();
        const direct = /direct expense|purchase/.test(g);
        return billType === 'Trade' ? (direct || !g) : !direct;
    });


    const handleAddItem = () => {
        setItems([...items, { id: Date.now(), jobId: '', expenseLedgerId: '', amount: '', taxRate: '18', tdsRate: '0' }]);
    };

    const handleRemoveItem = (id) => {
        if(items.length === 1) return;
        setItems(items.filter(i => i.id !== id));
    };

    const updateItem = (id, field, value) => {
        setItems(items.map(i => {
            if (i.id !== id) return i;
            const updated = { ...i, [field]: value };
            
            // Auto-fetch HSN, GST, and TDS based on Expense Ledger
            if (field === 'expenseLedgerId') {
                const selectedLedger = ledgers.find(l => l.id === value);
                if (selectedLedger) {
                    if (selectedLedger.gst) updated.taxRate = selectedLedger.gst;
                    if (selectedLedger.tds) updated.tdsRate = selectedLedger.tds;
                }
            }
            return updated;
        }));
    };

    const handleBillTypeChange = (type) => {
        setBillType(type);
        setItems([{ id: Date.now(), jobId: '', expenseLedgerId: '', amount: '', taxRate: '18', tdsRate: '0' }]);
    };

    // Calculations
    let subTotal = 0, taxTotal = 0, tdsTotal = 0, netPayable = 0;
    
    items.forEach(i => {
        const amt = parseFloat(i.amount || 0);
        const rate = parseFloat(i.taxRate || 0);
        const tdsRate = parseFloat(i.tdsRate || 0);
        
        const tax = amt * (rate / 100);
        const tds = amt * (tdsRate / 100); // Usually calculated on base amount without GST
        
        subTotal += amt;
        taxTotal += tax;
        tdsTotal += tds;
    });

    netPayable = (subTotal + taxTotal) - tdsTotal;

    const handleSave = () => {
        if(!header.vendorId) return toast.error("Please select a Vendor.");
        if(!header.vendorInvoiceNo) return toast.error("Vendor Invoice No is required.");
        
        // Validation
        if (billType === 'Trade') {
            const missingJob = items.find(i => !i.jobId);
            if(missingJob) return toast.error("Job Number is mandatory for Trade Bills!");
        }

        const missingAmount = items.find(i => !i.amount || parseFloat(i.amount) <= 0);
        if(missingAmount) return toast.error("Please enter a valid amount for all rows.");

        // 30-Oct-2026: this used to wait 1.2 seconds and then say "Vendor Bill Posted Successfully! (Job Costing
        // Updated)" without posting anything at all. It writes a real Purchase voucher now:
        //    Dr each expense ledger, Dr input GST, Cr the vendor (net of TDS), Cr TDS payable
        const vendor = vendors.find(v => String(v.id) === String(header.vendorId));
        const vendorLedgerId = vendor && vendor.ledgerId;
        if (!vendorLedgerId) return toast.error(`"${(vendor && vendor.name) || 'This vendor'}" has no ledger linked - open Masters > Vendors and link its ledger`);
        const byName = (re) => (allLedgers.find(l => re.test(String(l.name || '').toUpperCase())) || {}).id;
        const gstLedgerId = byName(/INPUT\s*(C?GST|IGST)|GST\s*INPUT/);
        const tdsLedgerId = byName(/TDS\s*PAYABLE|TDS\s*ON/);
        if (taxTotal > 0 && !gstLedgerId) return toast.error('No input GST ledger in the chart of accounts - add one (e.g. "Input CGST") before booking a bill with GST');
        if (tdsTotal > 0 && !tdsLedgerId) return toast.error('No TDS payable ledger in the chart of accounts - add one (e.g. "TDS Payable") before booking a bill with TDS');
        const purchaseType = voucherTypes.find(t => String(t.baseType) === 'Purchase');
        if (!purchaseType) return toast.error('No Purchase voucher type - add one in Masters > Voucher Types');

        const details = [];
        items.forEach(i => { const amt = parseFloat(i.amount) || 0; if (amt > 0 && i.expenseLedgerId) details.push({ ledgerId: i.expenseLedgerId, dc: 'Dr', amount: amt }); });
        if (taxTotal > 0) details.push({ ledgerId: gstLedgerId, dc: 'Dr', amount: Math.round(taxTotal * 100) / 100 });
        details.push({ ledgerId: vendorLedgerId, dc: 'Cr', amount: Math.round(netPayable * 100) / 100 });
        if (tdsTotal > 0) details.push({ ledgerId: tdsLedgerId, dc: 'Cr', amount: Math.round(tdsTotal * 100) / 100 });

        setSaving(true);
        const t = toast.loading('Posting the purchase voucher...');
        (async () => {
            try {
                let voucherNumber = header.vendorInvoiceNo;
                try {
                    const nr = await fetch('/api/vouchers/next-number/' + purchaseType.id, { headers: auth() });
                    const nd = await nr.json();
                    if (nd && nd.isAuto && nd.nextNumber) voucherNumber = nd.nextNumber;
                } catch (e) { /* keep the vendor's own number */ }
                const jobs = items.map(i => i.jobId).filter(Boolean).join(', ');
                const r = await fetch('/api/vouchers', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                    body: JSON.stringify({ voucherTypeId: purchaseType.id, voucherNumber, date: header.invoiceDate, jobNo: (items.find(i => i.jobId) || {}).jobId || null,
                        narration: [`${billType} bill ${header.vendorInvoiceNo}`, vendor.name, jobs && ('Job ' + jobs), header.remarks].filter(Boolean).join(' | '),
                        details }) });
                const d = await r.json().catch(() => ({}));
                if (!r.ok || d.success === false) throw new Error(d.error || ('HTTP ' + r.status));
                toast.success('Purchase voucher ' + voucherNumber + ' posted', { id: t });
                setHeader({ ...header, vendorInvoiceNo: '', remarks: '' });
                setItems([{ id: Date.now(), jobId: '', expenseLedgerId: '', amount: '', taxRate: '18', tdsRate: '0' }]);
            } catch (e) {
                toast.error('Could not post: ' + e.message, { id: t });
            }
            setSaving(false);
        })();
    };

    // Styles
    const inputStyle = { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none', background: '#fff', color: '#1e293b', width: '100%', fontFamily: 'inherit' };
    const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: '12px', borderBottom: '2px solid #cbd5e1', color: '#475569', textTransform: 'uppercase' };
    const tdStyle = { padding: '8px 12px', borderBottom: '1px solid #e2e8f0' };

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Segoe UI' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#f59e0b', padding: '12px', borderRadius: '8px', color: '#fff' }}><FileText size={24} /></div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 'bold' }}>Vendor Bill Entry (Purchase)</h2>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Book inward supplier invoices and manage TDS deductions</div>
                    </div>
                </div>

                {/* Mode Switcher */}
                <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '8px', padding: '4px' }}>
                    <button 
                        onClick={() => handleBillTypeChange('Trade')}
                        style={{ padding: '8px 20px', background: billType === 'Trade' ? '#2563eb' : 'transparent', border: 'none', borderRadius: '6px', fontWeight: '600', color: billType === 'Trade' ? '#fff' : '#64748b', boxShadow: billType === 'Trade' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Briefcase size={16}/> Trade (Job Related)
                    </button>
                    <button 
                        onClick={() => handleBillTypeChange('Non-Trade')}
                        style={{ padding: '8px 20px', background: billType === 'Non-Trade' ? '#6366f1' : 'transparent', border: 'none', borderRadius: '6px', fontWeight: '600', color: billType === 'Non-Trade' ? '#fff' : '#64748b', boxShadow: billType === 'Non-Trade' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Building size={16}/> Non-Trade (Admin)
                    </button>
                </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                
                {/* Header Section */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', padding: '24px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Select Vendor (Supplier) *</label>
                        <select value={header.vendorId} onChange={e => {
                            setHeader({...header, vendorId: e.target.value});
                            // Auto-set TDS if vendor has default
                            const v = vendors.find(v => v.id === e.target.value);
                            if(v) setItems(items.map(i => ({...i, tdsRate: v.defaultTds})));
                        }} style={inputStyle}>
                            <option value="">-- Choose Vendor --</option>
                            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Vendor Invoice No. *</label>
                        <input type="text" placeholder="e.g. INV-2026-99" value={header.vendorInvoiceNo} onChange={e => setHeader({...header, vendorInvoiceNo: e.target.value})} style={inputStyle} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Invoice Date</label>
                        <input type="date" value={header.invoiceDate} onChange={e => setHeader({...header, invoiceDate: e.target.value})} style={inputStyle} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Due Date</label>
                        <input type="date" value={header.dueDate} onChange={e => setHeader({...header, dueDate: e.target.value})} style={inputStyle} />
                    </div>
                </div>

                {/* Warning Banner */}
                <div style={{ padding: '12px 24px', background: billType === 'Trade' ? '#eff6ff' : '#eef2ff', borderBottom: '1px solid #cbd5e1', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', color: billType === 'Trade' ? '#1e3a8a' : '#3730a3', fontWeight: '600' }}>
                    {billType === 'Trade' 
                        ? <><CheckCircle size={16}/> Trade Mode: You must link a Job Number. This cost will hit the Job Profitability Sheet.</> 
                        : <><Building size={16}/> Non-Trade Mode: Admin expenses hit the central P&L. Job linkage is disabled.</>}
                </div>

                {/* Items Grid */}
                <div style={{ padding: '24px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                        <thead>
                            <tr>
                                {billType === 'Trade' && <th style={{...thStyle, width: '15%'}}>Job / File No. *</th>}
                                <th style={{...thStyle, width: '20%'}}>Expense / Cost Ledger</th>
                                <th style={{...thStyle, width: '10%'}}>HSN/SAC</th>
                                <th style={{...thStyle, width: '15%', textAlign: 'right'}}>Base Amt (₹)</th>
                                <th style={{...thStyle, width: '10%'}}>GST Rate</th>
                                <th style={{...thStyle, width: '10%'}}>TDS Rate</th>
                                <th style={{...thStyle, width: '15%', textAlign: 'right'}}>Net Pay (₹)</th>
                                <th style={{...thStyle, width: '5%'}}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => {
                                const amt = parseFloat(item.amount || 0);
                                const gst = amt * (parseFloat(item.taxRate || 0) / 100);
                                const tds = amt * (parseFloat(item.tdsRate || 0) / 100);
                                const netRow = (amt + gst) - tds;

                                const selectedLedger = ledgers.find(l => l.id === item.expenseLedgerId) || {};

                                return (
                                    <tr key={item.id}>
                                        {billType === 'Trade' && (
                                            <td style={tdStyle}>
                                                <input type="text" placeholder="Job No..." value={item.jobId} onChange={e => updateItem(item.id, 'jobId', e.target.value)} style={{...inputStyle, borderColor: !item.jobId ? '#f87171' : '#cbd5e1'}} />
                                            </td>
                                        )}
                                        <td style={tdStyle}>
                                            <select value={item.expenseLedgerId} onChange={e => updateItem(item.id, 'expenseLedgerId', e.target.value)} style={inputStyle}>
                                                <option value="">-- Select Expense --</option>
                                                {ledgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                            </select>
                                        </td>
                                        <td style={{...tdStyle, fontSize: '12px', color: '#64748b', fontWeight: 'bold'}}>
                                            {selectedLedger.hsn || '-'}
                                        </td>
                                        <td style={tdStyle}>
                                            <input type="number" value={item.amount} onChange={e => updateItem(item.id, 'amount', e.target.value)} placeholder="0.00" style={{...inputStyle, textAlign: 'right'}} />
                                        </td>
                                        <td style={tdStyle}>
                                            <select value={item.taxRate} onChange={e => updateItem(item.id, 'taxRate', e.target.value)} style={inputStyle}>
                                                <option value="0">0%</option>
                                                <option value="5">5%</option>
                                                <option value="12">12%</option>
                                                <option value="18">18%</option>
                                            </select>
                                        </td>
                                        <td style={tdStyle}>
                                            <select value={item.tdsRate} onChange={e => updateItem(item.id, 'tdsRate', e.target.value)} style={inputStyle}>
                                                <option value="0">No TDS</option>
                                                <option value="1">1% (194C)</option>
                                                <option value="2">2% (194C)</option>
                                                <option value="10">10% (194J/I)</option>
                                            </select>
                                        </td>
                                        <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#0f172a', fontSize: '14px'}}>
                                            {netRow.toLocaleString('en-IN', {minimumFractionDigits: 2})}
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
                    
                    <button onClick={handleAddItem} style={{ marginTop: '12px', background: 'transparent', border: '1px solid #2563eb', color: '#2563eb', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={14}/> Add New Row
                    </button>
                </div>

                {/* Footer Totals */}
                <div style={{ display: 'flex', background: '#f8fafc', padding: '24px', borderTop: '1px solid #cbd5e1', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '400px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Internal Remarks (Optional)</label>
                            <textarea 
                                rows="3"
                                placeholder="Enter narrative or justification..."
                                value={header.remarks} 
                                onChange={e => setHeader({...header, remarks: e.target.value})}
                                style={{...inputStyle, resize: 'vertical'}}
                            ></textarea>
                        </div>
                    </div>
                    
                    <div style={{ width: '350px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#475569', fontWeight: '600' }}>
                            <span>Base Taxable Value</span>
                            <span>{subTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b' }}>
                            <span>Add: GST Input</span>
                            <span>{taxTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#dc2626' }}>
                            <span>Less: TDS Deducted</span>
                            <span>- {tdsTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', color: '#0f172a', fontWeight: '900', borderTop: '2px solid #cbd5e1', paddingTop: '12px', marginTop: '4px' }}>
                            <span>Net Payable (₹)</span>
                            <span>₹ {netPayable.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                            <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', padding: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Save size={16}/> {saving ? 'Wait...' : 'Post Vendor Bill'}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
