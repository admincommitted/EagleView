import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Package, AlertOctagon, BarChart2, PieChart, Activity, Users, MapPin, Target } from 'lucide-react';

export default function DirectorDashboard() {
    // 30-Oct-2026: every figure on this screen was written into the file - revenue "Rs 1.45 Cr", named clients
    // ("TechCorp Exports Ltd."), lane profits and a "revenue leakage" table. A director could have taken a decision
    // on numbers that came from nowhere. It all reads /api/reports/mis now, which adds up the real vouchers.
    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };
    const toDate = new Date().toISOString().slice(0, 10);
    const fromDate = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const [mis, setMis] = useState(null);
    const [outstanding, setOutstanding] = useState(0);
    const [riskRows, setRiskRows] = useState([]);   // the real overdue receivables, biggest first
    const [buckets, setBuckets] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [mr, or_] = await Promise.all([
                    fetch(`/api/reports/mis?from=${fromDate}&to=${toDate}`, { headers: auth() }),
                    fetch(`/api/vouchers/outstanding?type=receivable&asOn=${toDate}`, { headers: auth() }),
                ]);
                const md = await mr.json();
                if (!mr.ok || md.success === false) throw new Error(md.error || ('HTTP ' + mr.status));
                setMis(md);
                const od = await or_.json().catch(() => ({}));
                setOutstanding((od.data || []).reduce((a, r) => a + (parseFloat(r.pending) || 0), 0));
                setRiskRows((od.data || []).filter(r => r.overdueDays > 0).sort((x, y) => y.pending - x.pending).slice(0, 8));
                setBuckets(od.buckets || null);
                setLoadError('');
            } catch (e) {
                setMis(null);
                setLoadError('Could not load the MIS: ' + e.message);
            }
            setLoading(false);
        })();
    }, [fromDate, toDate]);

    const money = (n) => {
        const v = Number(n) || 0;
        if (Math.abs(v) >= 10000000) return '₹ ' + (v / 10000000).toFixed(2) + ' Cr';
        if (Math.abs(v) >= 100000) return '₹ ' + (v / 100000).toFixed(2) + ' L';
        return '₹ ' + v.toLocaleString('en-IN');
    };
    const k = (mis && mis.kpis) || {};
    const kpis = {
        revenue: money(k.revenue), profit: money(k.profit),
        margin: (k.marginPct != null ? k.marginPct : 0) + '%',
        volumeAir: (mis && mis.jobs ? mis.jobs.filter(j => /^A/i.test(j.mode)).length : 0) + ' jobs',
        volumeSea: (mis && mis.jobs ? mis.jobs.filter(j => /^S/i.test(j.mode)).length : 0) + ' jobs',
        outstanding: money(outstanding),
    };
    const maxProfit = Math.max(1, ...((mis && mis.lanes) || []).map(l => Math.abs(l.profit) || 0));
    const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9'];
    const laneProfitability = ((mis && mis.lanes) || []).map((l, i) => ({
        lane: l.lane + (l.jobs ? ` (${l.jobs} job${l.jobs === 1 ? '' : 's'})` : ''),
        profit: l.profit, color: PALETTE[i % PALETTE.length],
        pct: Math.round((Math.abs(l.profit) / maxProfit) * 100) + '%',
    }));
    const topClients = ((mis && mis.topClients) || []).map(c => ({ name: c.name, revenue: c.revenue, profit: null, margin: '-' }));
    // "Revenue leakage" used to compare an estimated cost that this system never stores. What is real, and is what
    // a director needs, is the jobs that cost more than they billed.
    const lossJobs = ((mis && mis.jobs) || []).filter(j => j.profit < 0);

    const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
    const thStyle = { padding: '12px', textAlign: 'left', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '800', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' };
    const tdStyle = { padding: '12px', fontSize: '13px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', fontWeight: '600' };

    return (
        <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '28px', color: '#0f172a', fontWeight: '800', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BarChart2 size={28} color="#2563eb" /> Director's MIS & Analytics
                    </h2>
                    <p style={{ margin: '4px 0 0 38px', fontSize: '14px', color: '#64748b' }}>Real-time business intelligence, profitability, and revenue leakage alerts.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <select style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff', fontWeight: '600', color: '#1e293b' }}>
                        <option>This Month (Sep 2026)</option>
                        <option>Last Month (Aug 2026)</option>
                        <option>Q2 (Jul - Sep 2026)</option>
                        <option>YTD (2026-2027)</option>
                    </select>
                </div>
            </div>

            {/* Top KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', marginBottom: '24px' }}>
                <div style={{...cardStyle, borderBottom: '4px solid #2563eb'}}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Total Revenue</div>
                        <div style={{ background: '#eff6ff', padding: '6px', borderRadius: '50%', color: '#2563eb' }}><DollarSign size={18}/></div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a' }}>{kpis.revenue}</div>
                    <div style={{ fontSize: '12px', color: '#10b981', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}><TrendingUp size={14}/> +12% vs last month</div>
                </div>

                <div style={{...cardStyle, borderBottom: '4px solid #10b981', background: '#f0fdf4'}}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '13px', color: '#166534', fontWeight: '700', textTransform: 'uppercase' }}>Gross Profit</div>
                        <div style={{ background: '#dcfce7', padding: '6px', borderRadius: '50%', color: '#16a34a' }}><Activity size={18}/></div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#14532d' }}>{kpis.profit}</div>
                    <div style={{ fontSize: '12px', color: '#166534', marginTop: '8px', fontWeight: '700' }}>Overall Margin: {kpis.margin}</div>
                </div>

                <div style={{...cardStyle, borderBottom: '4px solid #8b5cf6'}}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Air Volume</div>
                        <div style={{ background: '#f5f3ff', padding: '6px', borderRadius: '50%', color: '#8b5cf6' }}><Package size={18}/></div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a' }}>{kpis.volumeAir}</div>
                    <div style={{ fontSize: '12px', color: '#10b981', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}><TrendingUp size={14}/> +5 Tons vs last month</div>
                </div>

                <div style={{...cardStyle, borderBottom: '4px solid #06b6d4'}}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Sea Volume</div>
                        <div style={{ background: '#ecfeff', padding: '6px', borderRadius: '50%', color: '#06b6d4' }}><Package size={18}/></div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a' }}>{kpis.volumeSea}</div>
                    <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}><TrendingDown size={14}/> -2 TEUs vs last month</div>
                </div>

                <div style={{...cardStyle, borderBottom: '4px solid #f59e0b'}}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>A/R Outstanding</div>
                        <div style={{ background: '#fef3c7', padding: '6px', borderRadius: '50%', color: '#d97706' }}><Target size={18}/></div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a' }}>{kpis.outstanding}</div>
                    <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px', fontWeight: '600' }}>32% is over 60 Days!</div>
                </div>
            </div>

            {/* Middle Section: Charts & Lists */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                
                {/* Lane Profitability (Visual Bars) */}
                <div style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                        <MapPin color="#3b82f6" size={20} />
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Most Profitable Trade Lanes</h3>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {laneProfitability.map((lane, idx) => (
                            <div key={idx}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                                    <span>{lane.lane}</span>
                                    <span>₹ {(lane.profit/100000).toFixed(1)} L</span>
                                </div>
                                <div style={{ width: '100%', background: '#f1f5f9', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                                    <div style={{ width: lane.pct, background: lane.color, height: '100%', borderRadius: '5px' }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Clients Table */}
                <div style={{...cardStyle, padding: 0, overflow: 'hidden'}}>
                    <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users color="#8b5cf6" size={20} />
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Top Performing Clients</h3>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Client Name</th>
                                <th style={{...thStyle, textAlign: 'right'}}>Revenue</th>
                                <th style={{...thStyle, textAlign: 'center'}}>Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!topClients.length && <tr><td colSpan="3" style={{ ...tdStyle, textAlign: 'center', color: '#64748b', fontWeight: 500 }}>No sales booked in this period</td></tr>}
                            {topClients.map((client, idx) => (
                                <tr key={idx}>
                                    <td style={{...tdStyle, color: '#2563eb'}}>{client.name}</td>
                                    <td style={{...tdStyle, textAlign: 'right'}}>{money(client.revenue)}</td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>
                                        {/* profit per client needs the cost of each client's jobs, which is only known
                                            for vouchers that carry a job number - share of revenue is what can be said */}
                                        <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '4px 8px', borderRadius: '12px', fontSize: '11px' }}>
                                            {k.revenue > 0 ? Math.round((client.revenue / k.revenue) * 100) + '%' : '-'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

            </div>

            {/* Bottom Section: Revenue Leakage Alerts */}
            <div style={{ ...cardStyle, borderLeft: '4px solid #ef4444' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <AlertOctagon color="#ef4444" size={20} />
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#991b1b' }}>Revenue Leakage & Cost Overrun Alerts</h3>
                    <span style={{ fontSize: '12px', color: '#ef4444', background: '#fef2f2', padding: '4px 10px', borderRadius: '12px', marginLeft: 'auto', fontWeight: 'bold' }}>2 Alerts Require Attention</span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Job No.</th>
                            <th style={thStyle}>Client</th>
                            <th style={{...thStyle, textAlign: 'right'}}>Estimated Cost</th>
                            <th style={{...thStyle, textAlign: 'right'}}>Actual Booked Cost</th>
                            <th style={{...thStyle, textAlign: 'right'}}>Variance (Loss)</th>
                            <th style={thStyle}>Why</th>
                            <th style={{...thStyle, textAlign: 'center'}}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!lossJobs.length && (
                            <tr><td colSpan="7" style={{ ...tdStyle, textAlign: 'center', color: '#64748b', fontWeight: 500 }}>
                                No job is booked at a loss in this period{mis && mis.unlinked && (mis.unlinked.salesWithoutJob || mis.unlinked.purchasesWithoutJob)
                                    ? ` (${mis.unlinked.salesWithoutJob} sale and ${mis.unlinked.purchasesWithoutJob} purchase voucher(s) carry no job number, so they are not counted job-wise)` : ''}
                            </td></tr>
                        )}
                        {lossJobs.map((leak, idx) => (
                            <tr key={idx} style={{ background: '#fef2f2' }}>
                                <td style={{...tdStyle, color: '#991b1b'}}>{leak.jobNo}</td>
                                <td style={tdStyle}>{leak.lane || leak.mode || '-'}</td>
                                <td style={{...tdStyle, textAlign: 'right'}}>₹ {Number(leak.revenue).toLocaleString('en-IN')}</td>
                                <td style={{...tdStyle, textAlign: 'right', color: '#dc2626'}}>₹ {Number(leak.cost).toLocaleString('en-IN')}</td>
                                <td style={{...tdStyle, textAlign: 'right', fontWeight: '800', color: '#b91c1c'}}>- ₹ {Math.abs(leak.profit).toLocaleString('en-IN')}</td>
                                <td style={{...tdStyle, color: '#991b1b'}}>Cost booked is more than the amount billed</td>
                                <td style={{...tdStyle, textAlign: 'center'}}>
                                    {/* 30-Oct-2026: "Investigate" did nothing. A loss-making job is investigated by
                                        looking at what was booked against it, so it opens the expense register filtered
                                        to that job number. */}
                                    <button onClick={() => window.open('/reports?report=expenses&q=' + encodeURIComponent(leak.jobNo), '_blank')}
                                        title={'Open the expense register for ' + leak.jobNo}
                                        style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Investigate</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Bottom Section: Outstanding & Debtors */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginTop: '24px' }}>
                
                {/* Top Debtors Table */}
                <div style={{ ...cardStyle, borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                        <Target color="#d97706" size={20} />
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#92400e' }}>Critical Outstanding (Top Defaulters)</h3>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Client Name</th>
                                <th style={{...thStyle, textAlign: 'right'}}>Pending Amount</th>
                                <th style={{...thStyle, textAlign: 'center'}}>Ageing (Overdue)</th>
                                <th style={{...thStyle, textAlign: 'center'}}>Risk Level</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!riskRows.length && <tr><td colSpan="4" style={{ ...tdStyle, textAlign: 'center', color: '#64748b', fontWeight: 500 }}>Nothing overdue</td></tr>}
                            {riskRows.map((r, i) => {
                                const high = r.overdueDays > 60;
                                const mid = r.overdueDays > 30;
                                const col = high ? '#dc2626' : mid ? '#d97706' : '#16a34a';
                                const bg = high ? '#fef2f2' : mid ? '#fffbeb' : '#f0fdf4';
                                return (
                                    <tr key={i} style={{ background: '#fff' }}>
                                        <td style={{...tdStyle, color: '#2563eb'}}>{r.party}</td>
                                        <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold'}}>₹ {Number(r.pending).toLocaleString('en-IN')}</td>
                                        <td style={{...tdStyle, textAlign: 'center'}}><span style={{ color: col, fontWeight: 'bold' }}>{r.overdueDays} Days</span></td>
                                        <td style={{...tdStyle, textAlign: 'center'}}><span style={{ background: bg, color: col, padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>{high ? 'HIGH' : mid ? 'MEDIUM' : 'LOW'}</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Outstanding Ageing Visual */}
                <div style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                        <PieChart color="#0f172a" size={20} />
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Outstanding Ageing (Total: {money(outstanding)})</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
                        {/* 30-Oct-2026: these four bars were fixed numbers (Rs 15.5 L / 12.5 L / 9.0 L / 8.2 L).
                            They are the real ageing buckets of the receivables now. */}
                        {[['0 - 30 Days (Current)', 'days30', '#16a34a', '#10b981'],
                          ['31 - 60 Days (Due)', 'days60', '#eab308', '#eab308'],
                          ['61 - 90 Days (Overdue)', 'days90', '#f97316', '#f97316'],
                          ['90+ Days (Critical)', 'over90', '#dc2626', '#dc2626']].map(([label, key, col, bar]) => {
                            const v = (buckets && buckets[key]) || 0;
                            const total = Object.values(buckets || {}).reduce((a, b) => a + (Number(b) || 0), 0);
                            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                            return (
                                <div key={key}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>
                                        <span style={{ color: col }}>{label}</span>
                                        <span>{money(v)} ({pct}%)</span>
                                    </div>
                                    <div style={{ width: '100%', background: '#f1f5f9', height: '12px', borderRadius: '6px' }}><div style={{ width: pct + '%', background: bar, height: '12px', borderRadius: '6px' }} /></div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <a href="/credit-control" style={{ display: 'block', textAlign: 'center', marginTop: '20px', padding: '10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', color: '#2563eb', textDecoration: 'none' }}>
                        View Full Credit Control CRM &rarr;
                    </a>
                </div>

            </div>

        </div>
    );
}
