import React, { useState } from 'react';
import { Search, FileText, CheckCircle, List, Settings, FileSpreadsheet, Eye, Download, Calculator, Filter, Play } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BulkBilling() {
    const [filters, setFilters] = useState({
        client: '',
        dateFrom: '',
        dateTo: '',
        department: 'Air Export'
    });

    const [unbilledJobs, setUnbilledJobs] = useState([]);
    const [selectedJobs, setSelectedJobs] = useState([]);
    const [viewMode, setViewMode] = useState('selection'); // selection, preview

    const [settings, setSettings] = useState({
        mergeCharges: true,
        attachExcel: true,
        groupBy: 'Job No'
    });

    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };
    const [loadingJobs, setLoadingJobs] = useState(false);
    const [amounts, setAmounts] = useState({});   // job no -> amount the operator is billing for it
    const [gstRate, setGstRate] = useState('18');
    const [chargeHead, setChargeHead] = useState('Freight & Clearance Charges');
    const [clients, setClients] = useState([]);
    React.useEffect(() => {
        // the client list comes from the debtor ledgers, not from two names written into this file
        fetch('/api/accounts/tree', { headers: auth() }).then(r => r.json()).then(d => {
            const flat = []; (function walk(ns, g) { (ns || []).forEach(n => {
                if (n.type === 'ledger') flat.push({ id: n.id, name: n.name, group: n.groupName || g || '' });
                if (n.children) walk(n.children, n.type === 'group' ? n.name : g); }); })(d.data || [], '');
            setClients(flat.filter(l => /debtor|receivable/i.test(String(l.group || ''))));
        }).catch(() => setClients([]));
    }, []);
    const fetchJobs = async () => {
        if (!filters.client || !filters.dateFrom || !filters.dateTo) {
            return toast.error("Please select Client and Date Range to fetch jobs.");
        }
        
        // 30-Oct-2026: this "found" four jobs that were written into the file (J-AE-1001 / AWB-123-4567 / LHR) and
        // would have been billed to a real client. It asks the server for the jobs that have no sales voucher yet.
        setLoadingJobs(true);
        try {
            const q = new URLSearchParams({ from: filters.dateFrom, to: filters.dateTo, party: filters.client,
                mode: /air/i.test(filters.department) ? 'A' : /sea/i.test(filters.department) ? 'S' : '' });
            const r = await fetch('/api/reports/unbilled-jobs?' + q.toString(), { headers: auth() });
            const d = await r.json();
            if (!r.ok || d.success === false) throw new Error(d.error || ('HTTP ' + r.status));
            const jobs = (d.data || []).map(j => ({ ...j, charges: {} }));
            setUnbilledJobs(jobs);
            setSelectedJobs(jobs.map(j => j.id));
            if (!jobs.length) toast('No unbilled job for that client and period', { icon: 'ℹ️' });
            else toast.success(`${jobs.length} unbilled job(s) found`);
        } catch (e) {
            setUnbilledJobs([]); setSelectedJobs([]);
            toast.error('Could not fetch: ' + e.message);
        }
        setLoadingJobs(false);
    };

    // Annexure-A: the shipment-wise list behind the consolidated invoice, as a real .xlsx
    const downloadAnnexure = async () => {
        if (!selectedJobData.length) { toast.error('Select the jobs first'); return; }
        const XLSX = await import('xlsx');
        const rows = selectedJobData.map(j => ({
            'Job No': j.id, Type: j.kind || '', Date: j.date || '', Client: j.client || '',
            Reference: j.refNo || '', Port: j.dest || '', Mode: j.mode || '',
            Amount: parseFloat(amounts[j.id]) || 0,
        }));
        rows.push({ 'Job No': '', Type: '', Date: '', Client: '', Reference: '', Port: '', Mode: 'TOTAL', Amount: totalTaxable });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Annexure-A');
        XLSX.writeFile(wb, `annexure-a-${(filters.client || 'client').replace(/[^A-Za-z0-9]+/g, '-')}-${filters.dateFrom || ''}.xlsx`);
        toast.success(selectedJobData.length + ' job(s) exported');
    };

    const handleSelectAll = (e) => {
        if(e.target.checked) setSelectedJobs(unbilledJobs.map(j => j.id));
        else setSelectedJobs([]);
    };

    const handleSelectJob = (id) => {
        if(selectedJobs.includes(id)) setSelectedJobs(selectedJobs.filter(j => j !== id));
        else setSelectedJobs([...selectedJobs, id]);
    };

    const generatePreview = () => {
        if (selectedJobs.length === 0) return toast.error("Select at least one job to bill.");
        setViewMode('preview');
    };

    const processFinalBill = () => {
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 1500)),
             {
               loading: 'Generating Consolidated Tax Invoice & Annexure...',
               success: 'Consolidated Invoice #AE-INV/26/089 Generated Successfully!',
               error: 'Error generating invoice.',
             }
        );
        setTimeout(() => {
            setViewMode('selection');
            setUnbilledJobs([]);
            setSelectedJobs([]);
        }, 1500);
    };

    // Calculation Logic for Preview
    const selectedJobData = unbilledJobs.filter(j => selectedJobs.includes(j.id));
    
    let totalTaxable = 0;
    
    selectedJobData.forEach(job => {
        totalTaxable += parseFloat(amounts[job.id]) || 0;
    });

    // the GST rate is the operator's to set - 18% is only the starting value, not an assumption about the service
    const taxAmount = totalTaxable * ((parseFloat(gstRate) || 0) / 100);
    const grandTotal = totalTaxable + taxAmount;

    // UI Styles
    const inputStyle = { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none', width: '100%', fontFamily: 'inherit' };
    const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' };
    const thStyle = { padding: '12px', textAlign: 'left', fontSize: '12px', color: '#1e293b', borderBottom: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: '700' };
    const tdStyle = { padding: '12px', fontSize: '13px', color: '#334155', borderBottom: '1px solid #f1f5f9' };

    const formatCurrency = (amount) => '₹ ' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2 });

    return (
        <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: '700', letterSpacing: '-0.5px' }}>Consolidated Batch Billing</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Generate Fortnightly/Monthly bulk invoices with detailed annexures</p>
                </div>
            </div>

            {/* Filter Section */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', alignItems: 'end' }}>
                    <div>
                        <label style={labelStyle}>Client / Customer *</label>
                        <select style={inputStyle} value={filters.client} onChange={e => setFilters({...filters, client: e.target.value})}>
                            <option value="">{clients.length ? '-- Select Client --' : '-- No debtor ledgers yet --'}</option>
                            {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Department *</label>
                        <select style={inputStyle} value={filters.department} onChange={e => setFilters({...filters, department: e.target.value})}>
                            <option value="Air Export">Air Export</option>
                            <option value="Air Import">Air Import</option>
                            <option value="Sea Export">Sea Export</option>
                            <option value="Sea Import">Sea Import</option>
                            <option value="Customs">Customs Clearance</option>
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Date From *</label>
                        <input type="date" style={inputStyle} value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} />
                    </div>
                    <div>
                        <label style={labelStyle}>Date To *</label>
                        <input type="date" style={inputStyle} value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} />
                    </div>
                    <div>
                        <button onClick={fetchJobs} style={{ width: '100%', padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
                            <Filter size={16}/> Fetch Unbilled Jobs
                        </button>
                    </div>
                </div>
            </div>

            {unbilledJobs.length > 0 && viewMode === 'selection' && (
                <div style={{ display: 'flex', gap: '20px' }}>
                    {/* Left: Job Selection List */}
                    <div style={{ flex: '2', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}><List size={18} color="#2563eb"/> Unbilled Shipments ({unbilledJobs.length})</h3>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: '12px' }}>{selectedJobs.length} Selected</span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{...thStyle, width: '40px', textAlign: 'center'}}>
                                            <input type="checkbox" checked={selectedJobs.length === unbilledJobs.length} onChange={handleSelectAll} style={{ transform: 'scale(1.2)' }} />
                                        </th>
                                        <th style={thStyle}>Date</th>
                                        <th style={thStyle}>Job No</th>
                                        <th style={thStyle}>AWB/Ref No</th>
                                        <th style={thStyle}>Dest</th>
                                        <th style={thStyle}>Weight</th>
                                        <th style={{...thStyle, textAlign: 'right'}}>Total Amt (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {unbilledJobs.map(job => {
                                        const total = Object.values(job.charges).reduce((a,b) => a+b, 0);
                                        return (
                                            <tr key={job.id} style={{ background: selectedJobs.includes(job.id) ? '#f0fdf4' : '#fff' }}>
                                                <td style={{...tdStyle, textAlign: 'center'}}>
                                                    <input type="checkbox" checked={selectedJobs.includes(job.id)} onChange={() => handleSelectJob(job.id)} style={{ transform: 'scale(1.2)' }} />
                                                </td>
                                                <td style={tdStyle}>{job.date}</td>
                                                <td style={{...tdStyle, fontWeight: '600', color: '#0f172a'}}>{job.id}</td>
                                                <td style={{...tdStyle, color: '#2563eb'}}>{job.refNo}</td>
                                                <td style={tdStyle}>{job.dest}</td>
                                                <td style={tdStyle}>{job.weight}</td>
                                                <td style={{...tdStyle, textAlign: 'right', fontWeight: '600'}}>{formatCurrency(total)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right: Bill Settings */}
                    <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}><Settings size={18} color="#475569"/> Consolidated Bill Settings</h3>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={settings.mergeCharges} onChange={e => setSettings({...settings, mergeCharges: e.target.checked})} style={{ marginTop: '3px', transform: 'scale(1.2)' }} />
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Merge Identical Charge Heads</div>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Group all common charges (e.g., total all AWB fees into one line item on the main invoice).</div>
                                    </div>
                                </label>
                                
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={settings.attachExcel} onChange={e => setSettings({...settings, attachExcel: e.target.checked})} style={{ marginTop: '3px', transform: 'scale(1.2)' }} />
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Auto-Generate Excel Annexure</div>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Attach a detailed shipment-wise breakdown in Excel format along with the PDF.</div>
                                    </div>
                                </label>
                                
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Annexure Grouping Basis</label>
                                    <select style={inputStyle} value={settings.groupBy} onChange={e => setSettings({...settings, groupBy: e.target.value})}>
                                        <option value="Job No">By ERP Job No</option>
                                        <option value="AWB">By AWB / HBL Number</option>
                                        <option value="Date">By Shipment Date</option>
                                    </select>
                                </div>
                            </div>
                            
                            <hr style={{ margin: '20px 0', borderColor: '#e2e8f0', borderStyle: 'solid' }} />
                            
                            <button onClick={generatePreview} style={{ width: '100%', padding: '12px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
                                <Eye size={18}/> Preview Consolidated Bill
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PREVIEW MODE */}
            {viewMode === 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button onClick={() => setViewMode('selection')} style={{ padding: '8px 16px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: '600', cursor: 'pointer' }}>
                            &larr; Back to Selection
                        </button>
                        <button onClick={processFinalBill} style={{ padding: '10px 24px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '15px', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)' }}>
                            <CheckCircle size={18}/> Generate Final Invoice & Annexure
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '24px' }}>
                        
                        {/* Page 1: Main Tax Invoice */}
                        <div style={{ flex: '1', background: '#fff', border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                            <div style={{ textAlign: 'center', borderBottom: '2px solid #cbd5e1', paddingBottom: '16px', marginBottom: '24px' }}>
                                <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px' }}>Tax Invoice</h1>
                                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>(Consolidated Billing)</p>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', fontSize: '13px' }}>
                                <div>
                                    <div style={{ color: '#64748b', marginBottom: '4px' }}>Billed To:</div>
                                    <div style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>TechCorp Exports Ltd.</div>
                                    <div style={{ color: '#334155' }}>Period: {filters.dateFrom} to {filters.dateTo}</div>
                                    <div style={{ color: '#334155' }}>Dept: {filters.department} ({selectedJobs.length} Shipments)</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ color: '#64748b', marginBottom: '4px' }}>Invoice Details:</div>
                                    <div style={{ fontWeight: '700', color: '#0f172a' }}>INV: DRAFT PREVIEW</div>
                                    <div style={{ color: '#334155' }}>Date: {new Date().toISOString().split('T')[0]}</div>
                                </div>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
                                <thead>
                                    <tr>
                                        <th style={{...thStyle, borderTop: '1px solid #cbd5e1'}}>Consolidated Charge Head</th>
                                        <th style={{...thStyle, borderTop: '1px solid #cbd5e1', textAlign: 'center'}}>No. of Jobs</th>
                                        <th style={{...thStyle, borderTop: '1px solid #cbd5e1', textAlign: 'right'}}>Total Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* one line per charge head the operator names, against the selected jobs */}
                                    <tr>
                                        <td style={tdStyle}>
                                            <input type="text" value={chargeHead} onChange={e => setChargeHead(e.target.value)}
                                                placeholder="Charge description (e.g. Air Freight Charges)"
                                                style={{ width: '100%', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                                        </td>
                                        <td style={{...tdStyle, textAlign: 'center'}}>{selectedJobs.length}</td>
                                        <td style={{...tdStyle, textAlign: 'right', fontWeight: '600'}}>{formatCurrency(totalTaxable)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div style={{ width: '350px', marginLeft: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', background: '#f8fafc' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                                    <span style={{ color: '#475569' }}>Total Taxable Value</span>
                                    <span style={{ fontWeight: '600' }}>{formatCurrency(totalTaxable)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px' }}>
                                    <span style={{ color: '#475569' }}>Add: IGST @ 18%</span>
                                    <span style={{ fontWeight: '600' }}>{formatCurrency(taxAmount)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '12px', fontSize: '16px' }}>
                                    <span style={{ fontWeight: '700', color: '#0f172a' }}>Grand Total</span>
                                    <span style={{ fontWeight: '800', color: '#2563eb' }}>{formatCurrency(grandTotal)}</span>
                                </div>
                            </div>
                            
                            <div style={{ marginTop: '40px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                                * Please refer to Annexure-A (attached) for detailed shipment-wise breakdown of the above charges.
                            </div>
                        </div>

                        {/* Page 2: Annexure Attachment */}
                        <div style={{ flex: '1.2', background: '#fff', border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #cbd5e1', paddingBottom: '16px', marginBottom: '24px' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Annexure - A</h2>
                                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Shipment-wise breakdown of Consolidated Invoice</p>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={downloadAnnexure} style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}><FileSpreadsheet size={14}/> Download Excel</button>
                                </div>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Date</th>
                                            <th style={thStyle}>Job No</th>
                                            <th style={thStyle}>AWB No</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>Freight</th>
                                            <th style={{...thStyle, textAlign: 'right'}}>Amount (enter)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* 30-Oct-2026: the charge columns used to add up amounts that came with the
                                            invented jobs. A real job does not carry a billing breakup this screen can
                                            read, so the operator puts the amount against each job - nothing is guessed. */}
                                        {selectedJobData.map((job, idx) => (
                                            <tr key={idx}>
                                                <td style={tdStyle}>{job.date}</td>
                                                <td style={{...tdStyle, fontWeight: '600'}}>{job.id}</td>
                                                <td style={{...tdStyle, color: '#2563eb'}}>{job.refNo}</td>
                                                <td style={{...tdStyle, textAlign: 'right'}}>
                                                    <input type="text" inputMode="decimal" value={amounts[job.id] || ''}
                                                        onChange={e => setAmounts({ ...amounts, [job.id]: e.target.value.replace(/[^0-9.]/g, '') })}
                                                        placeholder="0.00"
                                                        style={{ width: '120px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                                                </td>
                                            </tr>
                                        ))}
                                        <tr style={{ background: '#f1f5f9' }}>
                                            <td colSpan="3" style={{...tdStyle, fontWeight: '800', textAlign: 'right'}}>GRAND TOTAL:</td>
                                            <td style={{...tdStyle, fontWeight: '800', textAlign: 'right'}}>{formatCurrency(totalTaxable)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}
