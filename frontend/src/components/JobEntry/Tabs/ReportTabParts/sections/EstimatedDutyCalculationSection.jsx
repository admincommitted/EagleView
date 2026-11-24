// Screen section: Estimated Duty Calculation
// Split out of ReportTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';

export default function EstimatedDutyCalculationSection({ ctx }) {
  const { allItems, esanchitDocs, fmt, grandTotal, jobData, reportView, totalAdlCVD, totalAssessableValue, totalBCD, totalCVD, totalHealthCess, totalIGST, totalSAPTA, totalSWS } = ctx;
  return (
    <>
    {reportView === 'duty' && (
            <div style={{ background: '#fff', padding: '2rem', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', maxWidth: '600px', margin: '0 auto', color: '#000' }}>
              <h2 style={{ textAlign: 'center', margin: '0 0 1.5rem 0' }}>Estimated Duty Calculation</h2>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <tbody>
                  <tr>
                    <td style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', color: '#475569' }}>Total Assessable Value (INR)</td>
                    <td style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(totalAssessableValue)}</td>
                  </tr>
                  <tr>
                    <td style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', color: '#475569' }}>Basic Customs Duty (BCD)</td>
                    <td style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(totalBCD)}</td>
                  </tr>
                  <tr>
                    <td style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', color: '#475569' }}>Social Welfare Surcharge (SWS)</td>
                    <td style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(totalSWS)}</td>
                  </tr>
                  <tr>
                    <td style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', color: '#475569' }}>IGST</td>
                    <td style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: '#047857' }}>{fmt(totalIGST)}</td>
                  </tr>
                  <tr>
                    <td style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', color: '#475569' }}>CVD</td>
                    <td style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(totalCVD)}</td>
                  </tr>
                  <tr>
                    <td style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', color: '#475569' }}>Adl CVD</td>
                    <td style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(totalAdlCVD)}</td>
                  </tr>
                  <tr>
                    <td style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', color: '#475569' }}>Health Cess</td>
                    <td style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(totalHealthCess)}</td>
                  </tr>
                  <tr>
                    <td style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', color: '#475569' }}>SAPTA</td>
                    <td style={{ borderBottom: '1px solid #cbd5e1', padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(totalSAPTA)}</td>
                  </tr>
                  <tr style={{ background: '#f0fdf4' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 700, fontSize: '14px', color: '#065f46' }}>Total Estimated Duty Payable</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: '#065f46' }}>{fmt(grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: '1rem', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                *Note: This is an estimated duty. Final duty will be determined by ICEGATE system.
              </div>
            </div>
          )}

          {reportView === 'json' && <CachiPreview jobData={jobData} items={allItems} esanchitDocs={esanchitDocs} />}
    </>
  );
}

// Reports > CACHI01 Preview (22-Nov-2026). Before, this view printed the raw screen data (job + invoices + items, the
// items up to three times) and built that text again on every redraw - 3.5 MB on a 207-item job, and the page froze.
// Now it shows the real CACHI01 file, asked from the server once when the view opens (nothing is sent to ICEGATE).
const SHOW_MAX = 200000;
function CachiPreview({ jobData, items, esanchitDocs }) {
  const [st, setSt] = React.useState({ loading: true });
  const [all, setAll] = React.useState(false);
  const load = React.useCallback(async () => {
    setSt({ loading: true }); setAll(false);
    try {
      const res = await fetch('/api/icegate/preview-be', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobData: { ...(jobData || {}), esanchitDocs: esanchitDocs || [] }, items: items || [], invoices: (jobData && jobData.invoices) || [],
          beType: (jobData && jobData.autoField_51) || 'H', transportMode: (jobData && jobData.autoField_52) || 'S', forFiling: true }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) { setSt({ error: d.error || ('The file could not be built (HTTP ' + res.status + ')') }); return; }
      const m = (d.cachi01 && d.cachi01.master) || {};
      setSt({ text: JSON.stringify(d.cachi01, null, 2), errors: (d.validation && d.validation.errors) || [], warnings: (d.validation && d.validation.warnings) || [],
        counts: Object.entries(m).filter(([, v]) => Array.isArray(v) && v.length).map(([k, v]) => k.replace(/Model$/, '') + ' ' + v.length).join(' \u00b7 ') });
    } catch (e) { setSt({ error: 'The file could not be built: ' + e.message }); }
  }, [jobData, items, esanchitDocs]);
  React.useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps - once when the view opens; "Build again" re-reads
  const box = { background: '#1e293b', padding: '1rem', borderRadius: '4px', color: '#cbd5e1', fontFamily: 'monospace', fontSize: '12px', overflow: 'auto', maxHeight: '500px', textTransform: 'none' };
  if (st.loading) return <div style={box}>Building the CACHI01 file...</div>;
  if (st.error) return <div style={{ ...box, color: '#fecaca' }}>{st.error} <button type="button" className="btn btn-secondary" style={{ marginLeft: 10, fontSize: 11, padding: '2px 8px' }} onClick={load}>Try again</button></div>;
  const long = st.text.length > SHOW_MAX;
  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12px', marginBottom: '6px', textTransform: 'none' }}>
        <b style={{ color: st.errors.length ? '#dc2626' : '#15803d' }}>{st.errors.length} error(s)</b>
        <b style={{ color: st.warnings.length ? '#b45309' : '#15803d' }}>{st.warnings.length} warning(s)</b>
        <span style={{ color: '#475569' }}>{st.counts}</span>
        <span style={{ color: '#475569' }}>{Math.round(st.text.length / 1024).toLocaleString('en-IN')} KB</span>
        <button type="button" className="btn btn-secondary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={load} title="Build the file again from what is on the screen now">Build again</button>
      </div>
      {(st.errors.length > 0 || st.warnings.length > 0) && (
        <div style={{ fontSize: '12px', marginBottom: '6px', textTransform: 'none', maxHeight: '110px', overflowY: 'auto', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', padding: '4px 8px' }}>
          {st.errors.slice(0, 50).map((x, k) => <div key={'e' + k} style={{ color: '#b91c1c' }}>{x}</div>)}
          {st.warnings.slice(0, 50).map((x, k) => <div key={'w' + k} style={{ color: '#92400e' }}>{x}</div>)}
        </div>
      )}
      <div style={box}>
        <pre style={{ margin: 0 }}>{long && !all ? st.text.slice(0, SHOW_MAX) : st.text}</pre>
        {long && !all && <div style={{ marginTop: 8, color: '#fde68a', fontFamily: 'inherit' }}>First {Math.round(SHOW_MAX / 1024)} KB shown. <button type="button" className="btn btn-secondary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setAll(true)}>Show the whole file</button> (Export JSON gives the file itself)</div>}
      </div>
    </div>
  );
}
