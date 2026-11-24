import React from 'react';
import { useNavigate } from 'react-router-dom';
import AirExportActionTabs from './AirExportActionTabs';
import { Search } from 'lucide-react';

export default function EcsdForm() {
  const navigate = useNavigate();

  const [ecsdData, setEcsdData] = React.useState({ awbPrefix: '001', awbSuffix: '34835161', dep: 'NRT-NARITA', dest: 'MIA-MIAMI', nature: 'MACHINE PARTS' });
  const [linkedHawbs, setLinkedHawbs] = React.useState([]);
  const [hawbLoading, setHawbLoading] = React.useState(false);
  // 30-Oct-2026: the AWB list was three invented numbers (001-34835161 ...) and the buttons below had no handler at
  // all. The list now comes from the AWBs in the database, and Save / Preview / Go to AWB / Void do what they say.
  const [awbs, setAwbs] = React.useState([]);
  const [awbId, setAwbId] = React.useState(null);
  const [docType, setDocType] = React.useState('AIR WAYBILL');
  const [pick, setPick] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const formRef = React.useRef(null);
  const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };
  const loadAwbs = React.useCallback(() => {
    fetch('/api/awb/list?limit=200', { headers: auth() })
      .then(r => r.json())
      .then(d => setAwbs(Array.isArray(d) ? d : (d && Array.isArray(d.data) ? d.data : [])))
      .catch(() => setAwbs([]));
  }, []);
  React.useEffect(() => { loadAwbs(); }, [loadAwbs]);
  const awbNoOf = (a) => String(a.awbNumber || [a.awbPrefix, a.awbSuffix].filter(Boolean).join('-') || '').trim();
  const loadHawbs = (mawbNo) => {
    if (!mawbNo) { setLinkedHawbs([]); return; }
    setHawbLoading(true);
    fetch(`/api/awb/linked-hawbs/${encodeURIComponent(mawbNo)}`, { headers: auth() })
      .then(r => r.json()).then(d => setLinkedHawbs(Array.isArray(d) ? d : []))
      .catch(() => setLinkedHawbs([])).finally(() => setHawbLoading(false));
  };
  // "Add": take the chosen AWB into the declaration and pull its house waybills
  const addAwb = () => {
    const a = awbs.find(x => awbNoOf(x) === pick);
    if (!a) { window.alert('Choose an AWB from the list first'); return; }
    const no = awbNoOf(a); const [pre, suf] = no.includes('-') ? no.split('-') : [no.slice(0, 3), no.slice(3)];
    setAwbId(a.id || null);
    setEcsdData(prev => ({ ...prev, awbPrefix: pre || '', awbSuffix: suf || '', awbNumber: no,
      dep: a.origin || a.departure || prev.dep, dest: a.destination || prev.dest, nature: a.natureOfGoods || prev.nature }));
    loadHawbs(no);
  };
  // the declaration is kept with its AWB (same place as the other AWB document windows)
  const saveEcsd = async () => {
    if (!awbId) { window.alert('Choose the AWB (Add) before saving - the declaration is kept with its AWB'); return; }
    setBusy(true);
    try {
      const fields = [];
      (formRef.current ? formRef.current.querySelectorAll('input, select, textarea') : []).forEach((el, i) => {
        if (['button', 'submit'].includes(String(el.type || ''))) return;
        fields.push({ i, s: `${el.tagName}:${el.type || ''}:${el.name || el.placeholder || ''}`, v: el.type === 'checkbox' || el.type === 'radio' ? !!el.checked : el.value });
      });
      const r = await fetch(`/api/awb/extra/AWB/${awbId}/ECSD`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ data: { fields, ecsdData, savedAt: new Date().toISOString() } }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      try { localStorage.setItem('ecsd_data', JSON.stringify(ecsdData)); } catch (e) { /* private window */ }
      window.alert('e-CSD saved with AWB ' + (ecsdData.awbNumber || ''));
    } catch (e) { window.alert('Could not save: ' + e.message); }
    setBusy(false);
  };
  const previewEcsd = () => {
    const node = formRef.current; if (!node) return;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { window.print(); return; }
    const css = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(n => n.outerHTML).join('');
    const clone = node.cloneNode(true);
    const src = node.querySelectorAll('input, textarea, select'); const dst = clone.querySelectorAll('input, textarea, select');
    dst.forEach((el, i) => { const o = src[i]; if (!o) return;
      if (o.type === 'checkbox' || o.type === 'radio') { if (o.checked) el.setAttribute('checked', 'checked'); else el.removeAttribute('checked'); }
      else el.setAttribute('value', o.value || ''); if (el.tagName === 'TEXTAREA') el.textContent = o.value || ''; });
    w.document.write('<html><head><title>e-CSD ' + (ecsdData.awbNumber || '') + '</title>' + css + '</head><body>' + clone.outerHTML + '</body></html>');
    w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 300);
  };
  const goToAwb = () => navigate(awbId ? `/freight/awb?id=${awbId}` : '/freight/awb');
  const voidEcsd = async () => {
    if (!awbId) { window.alert('Choose the AWB first'); return; }
    if (!window.confirm('Remove the e-CSD saved against AWB ' + (ecsdData.awbNumber || '') + '?')) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/awb/extra/AWB/${awbId}/ECSD`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth() }, body: JSON.stringify({ data: null }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      window.alert('e-CSD removed');
    } catch (e) { window.alert('Could not remove: ' + e.message); }
    setBusy(false);
  };

  React.useEffect(() => {
    try {
      const data = localStorage.getItem('ecsd_data');
      if (data) {
        const parsed = JSON.parse(data);
        setEcsdData(parsed);
        // Fetch linked HAWBs using MAWB number
        const mawbNo = (parsed.awbPrefix && parsed.awbSuffix)
          ? `${parsed.awbPrefix}-${parsed.awbSuffix}`
          : (parsed.awbNumber || '');
        if (mawbNo) {
          setHawbLoading(true);
          fetch(`/api/awb/linked-hawbs/${encodeURIComponent(mawbNo)}`)
            .then(r => r.json())
            .then(d => setLinkedHawbs(Array.isArray(d) ? d : []))
            .catch(() => setLinkedHawbs([]))
            .finally(() => setHawbLoading(false));
        }
      }
    } catch(e) {}
  }, []);


  const labelStyle = { fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #1e293b))', marginBottom: '2px' };
  const inputStyle = {
    padding: '2px 4px',
    border: '1px solid var(--border-color, #cbd5e1)',
    borderRadius: '4px',
    fontSize: '11px',
    width: '100%',
    color: 'var(--text-main, var(--text-main, #1e293b))',
    background: 'var(--bg-panel, var(--bg-panel, #ffffff))',
    outline: 'none',
  };
  const disabledInputStyle = {
    ...inputStyle,
    background: 'var(--bg-input, var(--bg-input, #f1f5f9))',
    color: '#94a3b8',
    borderColor: 'var(--primary-bg-light, #e0f2fe)'
  };

  const panelStyle = {
    border: '1px solid var(--text-muted, #64748b)',
    borderRadius: '4px',
    background: 'var(--bg-panel, var(--bg-panel, #ffffff))',
    padding: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    overflow: 'hidden'
  };
  
  const bluePanelStyle = {
    ...panelStyle
  };

  const headerStyle = {
    backgroundColor: '#e0f2fe',
    borderLeft: '6px solid #0284c7',
    color: 'var(--primary-text, #0369a1)',
    padding: '6px 12px',
    borderBottom: '1px solid var(--text-muted, #64748b)',
    fontSize: '13px',
    fontWeight: '800',
    marginBottom: '8px',
    marginLeft: '-6px',
    marginRight: '-6px',
    marginTop: '-6px',
    textTransform: 'uppercase'
  };

  const btnStyle = {
    background: 'var(--primary-color-end, #1d4ed8)',
    color: 'white',
    border: 'none',
    padding: '4px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '24px'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
      <AirExportActionTabs activeTab="create" />
      
      <div ref={formRef} style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
        <h2 style={{ fontSize: '16px', color: '#334155', margin: 0, fontWeight: 'normal' }}>e-CSD</h2>
        <div style={{ background: '#dcfce7', color: '#166534', padding: '6px 8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
          e-CSD saved successfully.
          <span style={{ cursor: 'pointer', opacity: 0.6 }}>×</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'white', padding: '8px', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '4px' }}>
          
          {/* Top Row */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ width: '120px' }}>
              <div style={labelStyle}>From Date</div>
              <input type="text" style={inputStyle} defaultValue="" />
            </div>
            <div style={{ width: '120px' }}>
              <div style={labelStyle}>To Date</div>
              <input type="text" style={inputStyle} defaultValue="" />
            </div>
            <div style={{ width: '200px' }}>
              <div style={labelStyle}>Air Waybill Type</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <select style={{ ...inputStyle, flex: 1 }} value={docType} onChange={e => setDocType(e.target.value)}>
                  <option value="AIR WAYBILL">AIR WAYBILL</option>
                  <option value="HOUSE WAYBILL">HOUSE WAYBILL</option>
                  <option value="MASTER AIR WAYBILL">MASTER AIR WAYBILL</option>
                </select>
                <button type="button" title="Reload the AWB list" style={btnStyle} onClick={loadAwbs}><Search size={14} /></button>
              </div>
            </div>
            <div style={{ width: '250px' }}>
              <div style={labelStyle}>Air Waybill Number</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <select style={{ ...inputStyle, flex: 1 }} value={pick} onChange={e => setPick(e.target.value)}>
                  <option value="">{awbs.length ? 'SELECT' : 'No AWB found'}</option>
                  {awbs.map(a => { const no = awbNoOf(a); return no ? <option key={a.id || no} value={no}>{no}{a.destination ? ' - ' + a.destination : ''}</option> : null; })}
                </select>
                <button type="button" style={btnStyle} onClick={addAwb}>Add</button>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color, #e2e8f0)', margin: '8px 0' }}></div>

          {/* Middle Panels */}
          <div style={{ display: 'flex', gap: '8px' }}>
            
            {/* Left Panel */}
            <div style={{ ...panelStyle, flex: 2 }}>
              <div style={headerStyle}>Regulated Entity Category and Identifier - Security Status Issuing Party</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ flex: 1 }}>
                  <div style={labelStyle}>Country Code</div>
                  <input type="text" style={disabledInputStyle} defaultValue="" disabled />
                </div>
                <div style={{ flex: 1.5 }}>
                  <div style={labelStyle}>Regulated Identifier Type</div>
                  <input type="text" style={disabledInputStyle} defaultValue="" disabled />
                </div>
                <div style={{ flex: 1.5 }}>
                  <div style={labelStyle}>Identifier Code</div>
                  <input type="text" style={disabledInputStyle} defaultValue="" disabled />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={labelStyle}>Expiry Date</div>
                  <input type="text" style={disabledInputStyle} disabled />
                </div>
              </div>
            </div>

            {/* Right Panel */}
            <div style={{ ...bluePanelStyle, flex: 1 }}>
              <div style={headerStyle}>Unique Consignment Identifier - Air waybill Number</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="text" style={{ ...disabledInputStyle, width: '40px' }} value={ecsdData.awbPrefix} onChange={(e) => setEcsdData({...ecsdData, awbPrefix: e.target.value})} disabled />
                <span style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>-</span>
                <input type="text" style={{ ...disabledInputStyle, flex: 1 }} value={ecsdData.awbSuffix} onChange={(e) => setEcsdData({...ecsdData, awbSuffix: e.target.value})} disabled />
              </div>
            </div>

          </div>

          {/* Contents of consignment */}
          <div style={panelStyle}>
            <div style={headerStyle}>Contents of the consignment</div>
            <textarea style={{ ...inputStyle, height: '40px', resize: 'none' }} value={ecsdData.nature} onChange={(e) => setEcsdData({...ecsdData, nature: e.target.value})}></textarea>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#334155' }}>
              <input type="checkbox" /> Consolidation
            </label>
          </div>

          {/* Linked HAWBs Panel */}
          <div style={{ border: '1px solid var(--text-muted, #64748b)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ ...headerStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
              <span>Linked House AWBs</span>
              <span style={{ fontSize: '11px', fontWeight: 'normal', color: hawbLoading ? '#94a3b8' : '#16a34a' }}>
                {hawbLoading ? 'Loading...' : `${linkedHawbs.length} HAWB(s) linked`}
              </span>
            </div>
            {linkedHawbs.length === 0 && !hawbLoading ? (
              <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
                No linked House AWBs found for this MAWB
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e0f2fe' }}>
                      {['HAWB No.', 'Shipper', 'Consignee', 'Origin', 'Dest', 'Pkgs', 'Gross Wt.', 'Goods Desc'].map(h => (
                        <th key={h} style={{ padding: '4px 6px', textAlign: 'left', borderBottom: '1px solid var(--text-muted, #64748b)', borderRight: '1px solid var(--border-color, #cbd5e1)', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linkedHawbs.map((h, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : 'var(--bg-app, var(--bg-app, #f8fafc))', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid var(--border-color, #e2e8f0)', fontWeight: 'bold', color: '#1e3a8a', whiteSpace: 'nowrap' }}>{h.awbNumber}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>{h.shipperName}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>{h.consigneeName}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid var(--border-color, #e2e8f0)', textAlign: 'center' }}>{h.origin}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid var(--border-color, #e2e8f0)', textAlign: 'center' }}>{h.destination}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid var(--border-color, #e2e8f0)', textAlign: 'center' }}>{h.totalPieces}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid var(--border-color, #e2e8f0)', textAlign: 'center' }}>{h.grossWeight ? Number(h.grossWeight).toFixed(2) : ''}</td>
                        <td style={{ padding: '4px 6px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.formData?.natureOfGoods || h.handlingInformation || ''}>
                          {h.formData?.natureOfGoods || h.handlingInformation || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Location Panel */}
          <div style={{ display: 'flex', gap: '8px', border: '1px solid var(--border-color, #e2e8f0)', padding: '6px', borderRadius: '4px' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Origin</div>
              <input type="text" style={disabledInputStyle} value={ecsdData.dep} onChange={(e) => setEcsdData({...ecsdData, dep: e.target.value})} disabled />
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Destination</div>
              <input type="text" style={disabledInputStyle} value={ecsdData.dest} onChange={(e) => setEcsdData({...ecsdData, dest: e.target.value})} disabled />
            </div>
            <div style={{ flex: 2 }}>
              <div style={labelStyle}>Transfer/Transit points</div>
              <input type="text" style={disabledInputStyle} disabled />
            </div>
          </div>

          {/* Security Status Panel */}
          <div style={{ ...panelStyle, display: 'flex', flexDirection: 'row', gap: '12px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <div style={labelStyle}>Security Status <span style={{color: 'red'}}>*</span></div>
                <select style={{ ...inputStyle, width: '150px' }}>
                  <option>SELECT</option>
                  <option>SPX</option>
                  <option>SCO</option>
                  <option>SHR</option>
                  <option>NSC</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#334155' }}><input type="radio" name="secMethod" defaultChecked /> Screening Method</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#334155' }}><input type="radio" name="secMethod" /> Grounds for exemptions</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#334155' }}><input type="radio" name="secMethod" /> Received From</label>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingLeft: '20px' }}>
                  {['PHS', 'VCK', 'XRY', 'EDS', 'AOM', 'EDD', 'ETD', 'CMD'].map(method => (
                    <label key={method} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#334155' }}>
                      <input type="checkbox" /> {method}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Other Screening Method(s)</div>
              <textarea style={{ ...inputStyle, height: '40px', resize: 'none', background: 'var(--bg-input, var(--bg-input, #f1f5f9))' }}></textarea>
            </div>
          </div>

          {/* Issued By and On Panels */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ ...panelStyle, flex: 1 }}>
              <div style={headerStyle}>Security Status Issued By</div>
              <div style={labelStyle}>Issuer name or Employee ID <span style={{color: 'red'}}>*</span></div>
              <input type="text" style={inputStyle} />
            </div>
            <div style={{ ...panelStyle, flex: 1 }}>
              <div style={headerStyle}>Security Status Issued On</div>
              <div style={labelStyle}>Issued Date & Time <span style={{color: 'red'}}>*</span></div>
              <input type="text" style={inputStyle} />
            </div>
          </div>

          {/* Additional Security Info */}
          <div style={panelStyle}>
            <div style={headerStyle}>Additional Security Information</div>
            <textarea style={{ ...inputStyle, height: '40px', resize: 'none' }}></textarea>
          </div>
          
          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--primary-color-end, #1d4ed8)', cursor: 'pointer' }}>Clear</span>
              <button type="button" style={{ ...btnStyle, background: '#2563eb' }} onClick={previewEcsd}>Preview</button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" style={btnStyle} onClick={goToAwb}>Go to AWB</button>
              <button type="button" style={btnStyle} disabled={busy} onClick={saveEcsd}>{busy ? 'Saving...' : 'Save'}</button>
              <button type="button" style={{ ...btnStyle, background: '#2563eb' }} disabled={busy} onClick={voidEcsd}>Void</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
