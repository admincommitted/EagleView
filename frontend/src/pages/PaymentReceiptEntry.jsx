import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Landmark, FileText, Plus, Trash2, Save, IndianRupee, Search, ShieldCheck, Globe, Paperclip, Calculator, ArrowRightCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

// 30-Oct-2026: this screen posted nothing. The voucher number, the bank dropdown
// ("HDFC Bank - 5020001234"), the party, the "Current Balance: 1,71,100 Dr." line and the single
// allocation row were all hardcoded; Auto-FIFO and Save only printed toasts. It now loads the real
// ledgers and the party's real pending bills, allocates against them, and posts to /api/vouchers -
// and the allocation is stored, so outstanding figures stop having to guess with FIFO.
export default function PaymentReceiptEntry() {
    const [voucherType, setVoucherType] = useState('Receipt');
    const [currency, setCurrency] = useState('INR');
    const [roe, setRoe] = useState(1);
    const [enableForex, setEnableForex] = useState(false);
    const [currencies, setCurrencies] = useState([]);
    const [voucherTypes, setVoucherTypes] = useState([]);
    const [bankLedgers, setBankLedgers] = useState([]);
    const [parties, setParties] = useState([]);
    const [posting, setPosting] = useState(false);
    const [loadErr, setLoadErr] = useState('');
    const [numberIsAuto, setNumberIsAuto] = useState(true);
    const [partyInfo, setPartyInfo] = useState(null);
    const [allocations, setAllocations] = useState([]);
    const [docs, setDocs] = useState([]);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef(null);
    const draftKey = useRef('pr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));

    const [form, setForm] = useState({
        voucherNo: '', date: new Date().toISOString().split('T')[0],
        bankCashLedgerId: '', partyLedgerId: '',
        receivedAmountFCY: '', receivedAmountINR: '',
        bankCharges: '', tdsDeducted: '', forexGainLoss: '',
        tdsLedgerId: '', chargesLedgerId: '', forexLedgerId: '',
        instrumentType: 'NEFT/RTGS', instrumentNo: '', narration: '',
    });

    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };
    const isReceipt = voucherType === 'Receipt';
    const isContra = voucherType === 'Contra';
    const num = (x) => { const n = parseFloat(x); return Number.isFinite(n) ? n : 0; };

    // all ledgers, so the TDS / charges / forex heads can be picked rather than conjured
    const [allLedgers, setAllLedgers] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const [br, mr, cr, lr] = await Promise.all([
                    fetch('/api/vouchers/ledgers-by-group?groups=Bank Accounts,Cash-in-Hand', { headers: auth() }),
                    fetch('/api/accounting-masters/all', { headers: auth() }),
                    fetch('/api/accounting-masters/currencies', { headers: auth() }),
                    fetch('/api/accounts/tree', { headers: auth() }),
                ]);
                const bj = await br.json().catch(() => ({}));
                const mj = await mr.json().catch(() => ({}));
                const cj = await cr.json().catch(() => ({}));
                const lj = await lr.json().catch(() => ({}));
                setBankLedgers(bj.data || []);
                setVoucherTypes(((mj && mj.data) || {}).voucherTypes || []);
                setCurrencies(Array.isArray(cj) ? cj : (cj && cj.data) || []);
                const flat = [];
                const walk = (nodes, g) => (nodes || []).forEach(n => {
                    if (n.type === 'ledger') flat.push({ id: n.id, name: n.name, group: n.groupName || g || '' });
                    if (n.children) walk(n.children, n.name || g);
                });
                walk(lj.data || lj.tree || lj, '');
                flat.sort((a, b) => String(a.name).localeCompare(String(b.name)));
                setAllLedgers(flat);
                // sensible defaults for the deduction heads, by name - never created silently
                const byName = (re) => (flat.find(l => re.test(l.name)) || {}).id || '';
                setForm(f => ({ ...f,
                    tdsLedgerId: byName(/TDS\s*(Receivable|Recoverable)/i) || byName(/\bTDS\b/i),
                    chargesLedgerId: byName(/Bank\s*Charge/i),
                    forexLedgerId: byName(/(Forex|Exchange).*(Gain|Loss)/i),
                }));
                if (!(bj.data || []).length) setLoadErr((bj.note || 'No bank or cash ledger exists yet.') + ' Create your bank and cash ledgers under "Bank Accounts" / "Cash-in-Hand" in Chart of Accounts first.');
            } catch (err) {
                setLoadErr('Could not load the masters: ' + err.message);
            }
        })();
    }, []);

    // parties: debtors for a receipt, creditors for a payment, bank / cash for a contra
    useEffect(() => {
        (async () => {
            const groups = isContra ? 'Bank Accounts,Cash-in-Hand' : isReceipt ? 'Sundry Debtors' : 'Sundry Creditors';
            try {
                const r = await fetch('/api/vouchers/ledgers-by-group?groups=' + encodeURIComponent(groups), { headers: auth() });
                const j = await r.json().catch(() => ({}));
                setParties(j.data || []);
            } catch (err) { setParties([]); }
            setForm(f => ({ ...f, partyLedgerId: '' }));
            setPartyInfo(null); setAllocations([]);
        })();
    }, [voucherType, isContra, isReceipt]);

    const currentType = useMemo(
        () => voucherTypes.find(t => String(t.baseType) === voucherType) || null,
        [voucherTypes, voucherType]
    );

    const loadNumber = useCallback(async () => {
        if (!currentType) { setForm(f => ({ ...f, voucherNo: '' })); return; }
        try {
            const r = await fetch('/api/vouchers/next-number/' + currentType.id, { headers: auth() });
            const j = await r.json().catch(() => ({}));
            setNumberIsAuto(j.isAuto !== false);
            setForm(f => ({ ...f, voucherNo: j.nextNumber || '' }));
        } catch (err) { setNumberIsAuto(false); }
    }, [currentType]);
    useEffect(() => { loadNumber(); }, [loadNumber]);

    // the party's real pending bills
    const loadBills = useCallback(async (ledgerId) => {
        if (!ledgerId || isContra) { setPartyInfo(null); setAllocations([]); return; }
        try {
            const r = await fetch('/api/vouchers/pending-bills?ledgerId=' + ledgerId + '&type=' + (isReceipt ? 'receivable' : 'payable') + '&asOn=' + form.date, { headers: auth() });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            setPartyInfo(j);
            setAllocations((j.bills || []).map((b, i) => ({
                id: 'b' + i, refType: 'AGAINST', refNo: b.billNo || b.refNo, againstVoucherId: b.voucherId,
                date: b.date, pendingAmt: b.pending, allocatedAmt: '', fcyAmt: '',
                overdueDays: b.overdueDays,
            })));
        } catch (err) {
            setPartyInfo(null); setAllocations([]);
            toast.error('Could not load pending bills: ' + err.message);
        }
    }, [isContra, isReceipt, form.date]);

    useEffect(() => { loadBills(form.partyLedgerId); }, [form.partyLedgerId, loadBills]);

    const totalAllocated = useMemo(
        () => allocations.reduce((a, x) => a + num(x.allocatedAmt), 0),
        [allocations]
    );
    // what the party's account must be credited with: cash received + whatever they withheld
    const creditToParty = useMemo(
        () => num(form.receivedAmountINR) + num(form.tdsDeducted) + (enableForex ? num(form.forexGainLoss) : 0),
        [form.receivedAmountINR, form.tdsDeducted, form.forexGainLoss, enableForex]
    );

    const handleAddAllocation = () => {
        setAllocations([...allocations, { id: 'n' + Date.now(), refType: 'ON_ACCOUNT', refNo: '', againstVoucherId: null, date: '', pendingAmt: 0, allocatedAmt: '', fcyAmt: '' }]);
    };

    const handleAutoAllocate = () => {
        let left = creditToParty;
        if (left <= 0) { toast.error('Enter the amount received first'); return; }
        const open = allocations.filter(a => a.refType === 'AGAINST' && a.pendingAmt > 0)
            .slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
        const next = allocations.map(a => ({ ...a, allocatedAmt: '' }));
        open.forEach(o => {
            if (left <= 0.009) return;
            const give = Math.min(left, o.pendingAmt);
            left = Math.round((left - give) * 100) / 100;
            const row = next.find(x => x.id === o.id);
            if (row) row.allocatedAmt = give.toFixed(2);
        });
        setAllocations(next);
        if (left > 0.009) {
            toast.success('Oldest bills allocated. ' + left.toFixed(2) + ' is left over - add an On Account row for it.');
        } else {
            toast.success('Allocated oldest bills first');
        }
    };

    const handleAttach = async (e) => {
        const files = [...(e.target.files || [])];
        if (fileRef.current) fileRef.current.value = '';
        if (!files.length) return;
        setUploading(true);
        try {
            const fd = new FormData();
            files.forEach(f => fd.append('files', f));
            fd.append('draftKey', draftKey.current);
            fd.append('documentType', 'BANK_ADVICE');
            const r = await fetch('/api/vouchers/documents', { method: 'POST', headers: auth(), body: fd });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            setDocs([...docs, ...(j.data || [])]);
            toast.success('Attached');
        } catch (err) { toast.error('Attach failed: ' + err.message); }
        setUploading(false);
    };

    const handleSave = async () => {
        if (!currentType) return toast.error('There is no "' + voucherType + '" voucher type in Accounting Masters yet');
        if (!form.bankCashLedgerId) return toast.error('Pick the bank or cash ledger');
        if (!form.partyLedgerId) return toast.error(isContra ? 'Pick the other bank / cash ledger' : 'Pick the party');
        if (String(form.bankCashLedgerId) === String(form.partyLedgerId)) return toast.error('The two sides cannot be the same ledger');
        const cash = num(form.receivedAmountINR);
        if (cash <= 0) return toast.error('Enter the amount');
        if (!numberIsAuto && !form.voucherNo.trim()) return toast.error('This voucher type is on manual numbering - type a number');

        const tds = num(form.tdsDeducted), chg = num(form.bankCharges), fx = enableForex ? num(form.forexGainLoss) : 0;
        if (tds && !form.tdsLedgerId) return toast.error('Pick the ledger the TDS should go to');
        if (chg && !form.chargesLedgerId) return toast.error('Pick the ledger the bank charges should go to');
        if (fx && !form.forexLedgerId) return toast.error('Pick the ledger the exchange gain / loss should go to');
        if (!isContra && totalAllocated - creditToParty > 0.01) {
            return toast.error('Allocated ' + totalAllocated.toFixed(2) + ' but only ' + creditToParty.toFixed(2) + ' is being credited to the party');
        }

        // Receipt: bank Dr, party Cr (plus TDS Dr, which the party withheld)
        // Payment: party Dr, bank Cr (bank charges are an extra Dr with the bank Cr covering both)
        const details = [];
        if (isReceipt || isContra) {
            details.push({ ledgerId: form.bankCashLedgerId, dc: 'Dr', amount: cash, currency: enableForex ? currency : null, roe: enableForex ? roe : null, amountFcy: enableForex ? num(form.receivedAmountFCY) : null, remarks: form.instrumentNo || null });
            if (tds) details.push({ ledgerId: form.tdsLedgerId, dc: 'Dr', amount: tds, remarks: 'TDS withheld by the party' });
            if (fx > 0) details.push({ ledgerId: form.forexLedgerId, dc: 'Cr', amount: fx, remarks: 'Exchange gain' });
            if (fx < 0) details.push({ ledgerId: form.forexLedgerId, dc: 'Dr', amount: -fx, remarks: 'Exchange loss' });
            details.push({ ledgerId: form.partyLedgerId, dc: 'Cr', amount: cash + tds + (fx > 0 ? fx : 0) + (fx < 0 ? fx : 0), remarks: null });
            if (chg) {
                details.push({ ledgerId: form.chargesLedgerId, dc: 'Dr', amount: chg, remarks: 'Bank charges on this receipt' });
                details.push({ ledgerId: form.bankCashLedgerId, dc: 'Cr', amount: chg, remarks: 'Bank charges debited by the bank' });
            }
        } else {
            details.push({ ledgerId: form.partyLedgerId, dc: 'Dr', amount: cash, remarks: null });
            if (chg) details.push({ ledgerId: form.chargesLedgerId, dc: 'Dr', amount: chg, remarks: 'Bank charges on this payment' });
            if (tds) details.push({ ledgerId: form.tdsLedgerId, dc: 'Cr', amount: tds, remarks: 'TDS we deducted' });
            details.push({ ledgerId: form.bankCashLedgerId, dc: 'Cr', amount: cash + chg - tds, currency: enableForex ? currency : null, roe: enableForex ? roe : null, amountFcy: enableForex ? num(form.receivedAmountFCY) : null, remarks: form.instrumentNo || null });
        }

        const allocs = isContra ? [] : allocations
            .filter(a => num(a.allocatedAmt) > 0)
            .map(a => ({ ledgerId: form.partyLedgerId, refType: a.refType, refNo: a.refNo || null,
                againstVoucherId: a.refType === 'AGAINST' ? a.againstVoucherId : null,
                amount: num(a.allocatedAmt), amountFcy: enableForex ? num(a.fcyAmt) : null }));

        setPosting(true);
        try {
            const r = await fetch('/api/vouchers', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({
                    voucherTypeId: currentType.id, voucherNumber: form.voucherNo.trim(), date: form.date,
                    narration: [form.narration, form.instrumentType, form.instrumentNo].filter(Boolean).join(' | ') || null,
                    refNo: form.instrumentNo || null, details, allocations: allocs,
                }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
            const newId = (j.data && j.data.id) || j.id;
            if (newId && docs.length) {
                await fetch('/api/vouchers/documents/claim', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                    body: JSON.stringify({ draftKey: draftKey.current, voucherId: newId }),
                }).catch(() => toast.error('Posted, but the attachment did not link'));
            }
            toast.success(voucherType + ' ' + form.voucherNo + ' posted');
            setForm(f => ({ ...f, receivedAmountINR: '', receivedAmountFCY: '', bankCharges: '', tdsDeducted: '', forexGainLoss: '', instrumentNo: '', narration: '' }));
            setDocs([]); setAllocations([]); setPartyInfo(null);
            setForm(f => ({ ...f, partyLedgerId: '' }));
            draftKey.current = 'pr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
            await loadNumber();
        } catch (err) {
            toast.error('Not posted: ' + err.message);
        }
        setPosting(false);
    };

    const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '24px' };
    const inputStyle = { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' };
    const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' };

    return (
        <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', color: '#fff' }}>
                        {voucherType === 'Receipt' ? <IndianRupee size={24} /> : <Landmark size={24} />}
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 'bold' }}>{voucherType} Voucher</h2>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Multi-currency, TDS, bank charges, and bill-by-bill allocation</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <select value={voucherType} onChange={e=>setVoucherType(e.target.value)} style={{ padding: '10px 16px', borderRadius: '6px', border: '2px solid #cbd5e1', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}>
                        <option value="Receipt">Bank Receipt (F6)</option>
                        <option value="Payment">Bank Payment (F5)</option>
                        <option value="Contra">Contra Entry (F4)</option>
                    </select>
                    <button onClick={handleSave} disabled={posting} style={{ padding: '10px 24px', background: posting ? '#64748b' : '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: posting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Save size={18}/> {posting ? 'Posting...' : 'Post Voucher'}
                    </button>
                </div>
            </div>

            {loadErr && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px' }}>{loadErr}</div>
            )}
            {docs.length > 0 && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#475569' }}>Attached:</span>
                    {docs.map(d => (
                        <span key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <a href={d.filePath} target="_blank" rel="noreferrer" style={{ color: '#0369a1' }}>{d.originalName}</a>
                            <button onClick={() => setDocs(docs.filter(x => x.id !== d.id))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}><X size={12}/></button>
                        </span>
                    ))}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                
                {/* Left Column - Core Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={18} color="#2563eb" /> Voucher Profile
                            </h3>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#0369a1', cursor: 'pointer' }}>
                                <input type="checkbox" checked={enableForex} onChange={e => setEnableForex(e.target.checked)} />
                                <Globe size={16}/> Enable Multi-Currency (Forex)
                            </label>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '20px', marginBottom: '20px' }}>
                            <div><label style={labelStyle}>Voucher No.{numberIsAuto ? ' (Auto)' : ' (manual)'}</label>
                                <input type="text" value={form.voucherNo} onChange={e => setForm({ ...form, voucherNo: e.target.value })} readOnly={numberIsAuto}
                                    placeholder={currentType ? '' : 'No ' + voucherType + ' voucher type yet'}
                                    style={numberIsAuto ? {...inputStyle, background: '#f1f5f9'} : inputStyle} /></div>
                            <div><label style={labelStyle}>Date</label><input type="date" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} style={inputStyle} /></div>
                            <div>
                                <label style={labelStyle}>Bank / Cash Ledger ({isReceipt || isContra ? 'Dr.' : 'Cr.'})</label>
                                <select value={form.bankCashLedgerId} onChange={e=>setForm({...form, bankCashLedgerId: e.target.value})} style={inputStyle}>
                                    <option value="">-- pick a bank / cash ledger --</option>
                                    {bankLedgers.map(l => <option key={l.id} value={l.id}>{l.name}{l.bankAccount ? ' - ' + l.bankAccount : ''}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '20px' }}>
                            <div>
                                <label style={labelStyle}>{isContra ? 'Other Bank / Cash Ledger' : 'Party Ledger'} ({isReceipt || isContra ? 'Cr.' : 'Dr.'})</label>
                                {/* 30-Oct-2026: this was a free-text box with a magnifying glass that did nothing,
                                    under a painted-on "Current Balance: 1,71,100 Dr." The list and the balance are real now. */}
                                <select value={form.partyLedgerId} onChange={e=>setForm({...form, partyLedgerId: e.target.value})} style={inputStyle}>
                                    <option value="">-- pick {isContra ? 'the other account' : isReceipt ? 'a customer' : 'a vendor'} --</option>
                                    {parties.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                                {!isContra && partyInfo && (
                                    <div style={{ fontSize: '11px', marginTop: '4px', fontWeight: 'bold', color: partyInfo.balance > 0 ? '#dc2626' : '#16a34a' }}>
                                        Outstanding as on {form.date.split('-').reverse().join('-')}: &#8377; {partyInfo.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {partyInfo.balanceSide}
                                        {partyInfo.ledger && partyInfo.ledger.creditDays ? ' \u00b7 ' + partyInfo.ledger.creditDays + ' day terms' : ''}
                                    </div>
                                )}
                                {!isContra && form.partyLedgerId && partyInfo && !partyInfo.bills.length && (
                                    <div style={{ fontSize: '11px', marginTop: '4px', color: '#64748b' }}>No open bill for this party - the receipt will sit on account.</div>
                                )}
                                {!parties.length && <div style={{ fontSize: '11px', marginTop: '4px', color: '#b45309' }}>No ledger under {isContra ? 'Bank Accounts / Cash-in-Hand' : isReceipt ? 'Sundry Debtors' : 'Sundry Creditors'} yet.</div>}
                            </div>
                            
                            {enableForex ? (
                                <>
                                    <div>
                                        <label style={labelStyle}>Currency & ROE</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <select value={currency} onChange={e=>setCurrency(e.target.value)} style={{...inputStyle, width: '50%'}}>
                                                {currencies.filter(c => (c.code || c.currencyCode) !== 'INR').map(c => {
                                                    const code = c.code || c.currencyCode;
                                                    return <option key={code} value={code}>{code}</option>;
                                                })}
                                                {!currencies.length && <option value="USD">USD</option>}
                                            </select>
                                            <input type="number" value={roe} onChange={e=>setRoe(e.target.value)} placeholder="Rate" style={{...inputStyle, width: '50%'}} />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{...labelStyle, color: '#059669'}}>Receipt Amt (FCY)</label>
                                        <input type="number" value={form.receivedAmountFCY} onChange={e=>setForm({...form, receivedAmountFCY: e.target.value, receivedAmountINR: (num(e.target.value) * num(roe)).toFixed(2)})} style={{...inputStyle, fontWeight: 'bold', color: '#059669'}} />
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>= &#8377; {num(form.receivedAmountINR).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                </>
                            ) : (
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{...labelStyle, color: '#059669', fontSize: '14px'}}>Total Amount {isReceipt ? 'Received' : isContra ? 'Transferred' : 'Paid'} (₹)</label>
                                    <input type="number" value={form.receivedAmountINR} onChange={e=>setForm({...form, receivedAmountINR: e.target.value})} style={{...inputStyle, fontSize: '18px', fontWeight: 'bold', color: '#059669', padding: '10px'}} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={cardStyle}>
                        <h3 style={{ margin: '0 0 20px 0', color: '#0f172a', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                            <ShieldCheck size={18} color="#2563eb" /> Remittance & Instrument Details
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '20px' }}>
                            <div>
                                <label style={labelStyle}>Instrument Type</label>
                                <select value={form.instrumentType} onChange={e=>setForm({...form, instrumentType: e.target.value})} style={inputStyle}>
                                    <option>NEFT/RTGS</option><option>SWIFT Wire</option><option>Cheque</option><option>UPI</option>
                                </select>
                            </div>
                            <div><label style={labelStyle}>Instrument / UTR No.</label><input type="text" value={form.instrumentNo} onChange={e=>setForm({...form, instrumentNo: e.target.value})} style={inputStyle} /></div>
                            <div>
                                <label style={labelStyle}>Narration</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input type="text" value={form.narration} onChange={e=>setForm({...form, narration: e.target.value})} placeholder="Being payment received against..." style={inputStyle} />
                                    <input ref={fileRef} type="file" multiple onChange={handleAttach} style={{ display: 'none' }} accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.csv,.txt,.xlsx,.xls" />
                                    <button onClick={() => fileRef.current && fileRef.current.click()} disabled={uploading}
                                        style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0 12px', borderRadius: '4px', cursor: uploading ? 'wait' : 'pointer' }}
                                        title="Attach the SWIFT copy / cheque image / bank advice"><Paperclip size={16} color="#64748b"/></button>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Right Column - Deductions & Analytics */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ ...cardStyle, background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                        <h3 style={{ margin: '0 0 20px 0', color: '#0f172a', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calculator size={18} color="#ea580c" /> Deductions & Adjustments
                        </h3>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Record taxes and bank charges directly here to auto-route to respective ledgers.</div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                            {/* 30-Oct-2026: these said "Routes to TDS Receivable" / "Routes to Bank Charges Exp" but
                                nothing was routed anywhere. The head is picked, so the posting is explicit. */}
                            <div>
                                <label style={labelStyle}>TDS {isReceipt ? 'deducted by the client' : 'we deducted'} (₹)</label>
                                <input type="number" value={form.tdsDeducted} onChange={e=>setForm({...form, tdsDeducted: e.target.value})} style={{...inputStyle, borderColor: '#fca5a5'}} placeholder="0.00" />
                                {num(form.tdsDeducted) > 0 && (
                                    <select value={form.tdsLedgerId} onChange={e=>setForm({...form, tdsLedgerId: e.target.value})} style={{...inputStyle, marginTop: '6px', fontSize: '12px'}}>
                                        <option value="">-- which ledger does the TDS go to? --</option>
                                        {allLedgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                )}
                            </div>
                            <div>
                                <label style={labelStyle}>Bank Charges deducted (₹)</label>
                                <input type="number" value={form.bankCharges} onChange={e=>setForm({...form, bankCharges: e.target.value})} style={{...inputStyle, borderColor: '#fca5a5'}} placeholder="0.00" />
                                {num(form.bankCharges) > 0 && (
                                    <select value={form.chargesLedgerId} onChange={e=>setForm({...form, chargesLedgerId: e.target.value})} style={{...inputStyle, marginTop: '6px', fontSize: '12px'}}>
                                        <option value="">-- which ledger do the charges go to? --</option>
                                        {allLedgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                )}
                            </div>
                            {enableForex && (
                                <div>
                                    <label style={labelStyle}>Exchange Gain/Loss (₹)</label>
                                    <input type="number" value={form.forexGainLoss} onChange={e=>setForm({...form, forexGainLoss: e.target.value})} style={{...inputStyle, borderColor: '#fca5a5'}} placeholder="-ve for loss, +ve for gain" />
                                    {num(form.forexGainLoss) !== 0 && (
                                        <select value={form.forexLedgerId} onChange={e=>setForm({...form, forexLedgerId: e.target.value})} style={{...inputStyle, marginTop: '6px', fontSize: '12px'}}>
                                            <option value="">-- which ledger takes the gain / loss? --</option>
                                            {allLedgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                        </select>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <div style={{ marginTop: '24px', padding: '12px', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Total Credit to Party:</span>
                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>
                                ₹ {creditToParty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>

            </div>

            {/* Bill Allocation Table */}
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', borderTop: '4px solid #0f172a' }}>
                <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Bill-by-Bill Allocation (Knock-off)</h3>
                        <span style={{ fontSize: '12px', background: '#e2e8f0', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', color: '#475569' }}>
                            To allocate: ₹ {creditToParty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        {Math.abs(totalAllocated - creditToParty) > 0.009 && creditToParty > 0 && (
                            <span style={{ fontSize: '12px', background: totalAllocated > creditToParty ? '#fee2e2' : '#fef3c7', color: totalAllocated > creditToParty ? '#991b1b' : '#92400e', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                                {totalAllocated > creditToParty ? 'Over-allocated by ' : 'Unallocated: '}
                                ₹ {Math.abs(creditToParty - totalAllocated).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={handleAutoAllocate} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#0369a1' }}>
                            <ArrowRightCircle size={14} /> Auto-FIFO
                        </button>
                        <button onClick={handleAddAllocation} style={{ padding: '6px 12px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Plus size={14} /> Add Row
                        </button>
                    </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>Type of Ref</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>Name (Invoice No.)</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>Pending Amt</th>
                            {enableForex && <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: '#059669', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>Allocated ({currency})</th>}
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: '#059669', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>Allocated (INR)</th>
                            <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {allocations.map((row, idx) => (
                            <tr key={row.id} style={{ background: row.overdueDays > 60 ? '#fef2f2' : '#fff' }}>
                                <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                                    <select value={row.refType} style={inputStyle} onChange={e => {
                                        const next = [...allocations]; next[idx] = { ...next[idx], refType: e.target.value }; setAllocations(next);
                                    }}>
                                        <option value="AGAINST">Agst Ref</option>
                                        <option value="ADVANCE">Advance</option>
                                        <option value="ON_ACCOUNT">On Account</option>
                                    </select>
                                </td>
                                <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                                    <input type="text" value={row.refNo || ''} readOnly={row.refType === 'AGAINST' && !!row.againstVoucherId}
                                        onChange={e => { const next = [...allocations]; next[idx] = { ...next[idx], refNo: e.target.value }; setAllocations(next); }}
                                        placeholder={row.refType === 'AGAINST' ? '' : 'reference (optional)'}
                                        style={row.refType === 'AGAINST' && row.againstVoucherId ? {...inputStyle, background: '#f8fafc'} : inputStyle} />
                                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                                        {row.date ? 'Bill date: ' + row.date.split('-').reverse().join('-') : 'not against an existing bill'}
                                        {row.overdueDays > 0 ? ' \u00b7 ' + row.overdueDays + ' days overdue' : ''}
                                    </div>
                                </td>
                                <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', color: '#dc2626', fontWeight: 'bold' }}>
                                    {row.pendingAmt ? row.pendingAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '\u2014'}
                                </td>

                                {enableForex && (
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                                        <input type="number" value={row.fcyAmt} onChange={(e) => {
                                            const next = [...allocations];
                                            next[idx] = { ...next[idx], fcyAmt: e.target.value, allocatedAmt: (num(e.target.value) * num(roe)).toFixed(2) };
                                            setAllocations(next);
                                        }} style={{...inputStyle, textAlign: 'right', fontWeight: 'bold', color: '#059669', borderColor: '#10b981'}} />
                                    </td>
                                )}

                                <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                                    <input type="number" value={row.allocatedAmt} onChange={(e) => {
                                        const next = [...allocations]; next[idx] = { ...next[idx], allocatedAmt: e.target.value }; setAllocations(next);
                                    }} style={{...inputStyle, textAlign: 'right', fontWeight: 'bold',
                                        color: num(row.allocatedAmt) > row.pendingAmt && row.refType === 'AGAINST' ? '#dc2626' : '#059669',
                                        borderColor: num(row.allocatedAmt) > row.pendingAmt && row.refType === 'AGAINST' ? '#dc2626' : '#10b981'}} />
                                    {num(row.allocatedAmt) > row.pendingAmt && row.refType === 'AGAINST' && (
                                        <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '2px' }}>more than this bill's pending amount</div>
                                    )}
                                </td>
                                <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                                    <button onClick={() => setAllocations(allocations.filter(a => a.id !== row.id))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                        {!allocations.length && (
                            <tr><td colSpan={enableForex ? 6 : 5} style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                {isContra ? 'A contra entry moves money between your own accounts - there is nothing to allocate.'
                                 : form.partyLedgerId ? 'No open bill for this party. Add an On Account row if the money is an advance.'
                                 : 'Pick a party to load their pending bills.'}
                            </td></tr>
                        )}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={enableForex ? 4 : 3} style={{ padding: '16px', textAlign: 'right', fontWeight: 'bold', color: '#0f172a', borderTop: '2px solid #e2e8f0' }}>Total Allocated:</td>
                            <td style={{ padding: '16px', textAlign: 'right', fontWeight: 'bold', color: '#059669', fontSize: '16px', borderTop: '2px solid #e2e8f0' }}>
                                ₹ {totalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ borderTop: '2px solid #e2e8f0' }}></td>
                        </tr>
                    </tfoot>
                </table>
                {partyInfo && partyInfo.basis && (
                    <div style={{ padding: '10px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '11px', color: '#64748b' }}>
                        Pending amounts shown here: {partyInfo.basis}. What you allocate below is stored against the bill,
                        so from this voucher on, the outstanding report is exact for this party rather than FIFO.
                    </div>
                )}
            </div>

        </div>
    );
}
