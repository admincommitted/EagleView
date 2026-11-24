// Screen section: IGM Details
// Split out of JobHeaderTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import ModernDatePicker from '../../../../common/ModernDatePicker'; // 21-Nov-2026: DD-MM-YYYY date box like the invoice screens (same YYYY-MM-DD value)
import { Edit, PlusSquare, RefreshCw, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import React, { useState } from 'react';
import { Download } from 'lucide-react';
import IcegateIgmModal from './IcegateIgmModal';

const dmy = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : (v || ''); };

// 22-Nov-2026: the two port suggestion lists were built again on every key typed in the header; drawn once per port list
const PortLists = React.memo(function PortLists({ ports }) {
  return (<>
              <datalist id="port-list">
                  {ports.map(p => <option key={p.id} value={p.portName}>{p.portName} ({p.portCode})</option>)}
                </datalist>
                <datalist id="port-code-list">
                  {ports.map(p => <option key={p.id} value={p.portCode}>{p.portName}</option>)}
                </datalist>
  </>);
});

export default function IgmDetailsSection({ ctx }) {
  const { handleHeaderSave, handleClearForm, handleAddIgmRow, handleChange, handleClearIgmRow, handleEditIgmRow, handlePortSelect, handleRemoveIgmRow, igmEditIdx, igmRows, jobData, onSave, ports, setIsContainerModalOpen, setJobData, transportMode } = ctx;
  // 14-Nov-2026: IGM details from ICEGATE's public Air IGM / Console enquiry (air jobs)
  // 22-Nov-2026: an Ex-Bond BE carries no IGM / MAWB / HAWB (the goods are already in the warehouse) - these boxes are
  // not shown as "must fill" on it, and packages / weight are the quantity RELEASED by this ex-bond
  const isExBond = String(ctx.beType || '').toUpperCase() === 'X';
  const reqCls = isExBond ? 'input-field' : 'input-field mandatory-field';
  const reqBorder = isExBond ? '1px solid var(--primary-border)' : '1px solid #f87171';
  const [icgOpen, setIcgOpen] = useState(false);
  const fillFromIcegate = (r) => {
    if (!r) return;
    setJobData(prev => ({ ...prev,
      igmNumber: r.igmNo || prev.igmNumber || '', igmNo: r.igmNo || prev.igmNo || '',
      ...(r.igmDate ? { igmDate: r.igmDate, autoField_14: r.igmDate } : {}),
      ...(r.inwardDate ? { inwardDate: r.inwardDate, autoField_17: r.inwardDate } : {}),
      mawbNo: r.mawbNo || prev.mawbNo || '',
      ...(r.kind === 'HAWB' && r.hawbNo ? { hawbNo: r.hawbNo } : {}),
      ...(r.mawbDate ? { mawbDate: r.mawbDate, autoField_15: r.mawbDate } : {}),
      ...(r.kind === 'HAWB' && r.hawbDate ? { hawbDate: r.hawbDate, autoField_16: r.hawbDate } : {}),
      ...(r.pkgCode ? { pkg: r.pkgCode } : {}),
      ...(r.lineNo ? { lineNo: r.lineNo } : {}),
      ...(r.totalPkg ? { totalPkg: r.totalPkg } : {}),
      ...(r.grossWt ? { grossWt: r.grossWt, grossWtUnit: r.wtUnit || prev.grossWtUnit || 'KGS' } : {}) }));
    setIcgOpen(false);
    toast.success('IGM details filled from ICEGATE (' + (r.kind === 'HAWB' ? 'house ' + r.hawbNo : (transportMode === 'S' ? 'BL line' : 'MAWB line')) + '). Check them, then press Add.');
  };
  return (
    <>
    <div style={{ border: '1px solid var(--primary-border)', background: 'transparent', marginBottom: '4px' }}>
        <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>IGM Details</div>
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }}>IGM No</label>
              <input name="igmNumber" type="text" className={reqCls} placeholder="IGM NO"  style={{ flex: 1, color: '#0f172a', border: reqBorder, backgroundColor: '#fff' }} value={(jobData["igmNumber"] || jobData["igmNo"]) || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }}>IGM Date</label>
              <ModernDatePicker name="igmDate" className={reqCls}  style={{ flex: 1, color: '#0f172a', border: reqBorder, backgroundColor: '#fff' }}  value={(jobData["igmDate"] || (jobData["igmDate"] || jobData["autoField_14"])) || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }}>{transportMode === 'A' ? 'MAWB No.' : 'BL No.'}</label>
              <input name="mawbNo" type="text" className={reqCls} placeholder="MAWB/BL NO" style={{ flex: 1, color: '#0f172a', border: reqBorder }} value={(jobData["mawbNo"] || jobData["mawbblNo"]) || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }}>{transportMode === 'A' ? 'MAWB Date' : 'BL Date'}</label>
              <ModernDatePicker name="mawbDate" className={reqCls} style={{ flex: 1, color: '#0f172a', border: reqBorder }}  value={(jobData["mawbDate"] || (jobData["mawbDate"] || jobData["autoField_15"])) || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }}>{transportMode === 'A' ? 'HAWB No.' : 'HBL No.'}</label>
              <input name="hawbNo" type="text" className={reqCls} placeholder="HAWB/HBL NO" style={{ flex: 1, color: '#0f172a', border: reqBorder }} value={(jobData["hawbNo"] || jobData["hawbhblNo"]) || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }}>{transportMode === 'A' ? 'HAWB Date' : 'HBL Date'}</label>
              <ModernDatePicker name="hawbDate" className={reqCls} style={{ flex: 1, color: '#0f172a', border: reqBorder }}  value={(jobData["hawbDate"] || (jobData["hawbDate"] || jobData["autoField_16"])) || ""} onChange={handleChange} />
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }}>Inward Date</label>
              <ModernDatePicker name="inwardDate" className={reqCls}  style={{ flex: 1, color: '#0f172a', border: reqBorder, backgroundColor: '#fff' }}  value={(jobData["inwardDate"] || (jobData["inwardDate"] || jobData["autoField_17"])) || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }} title={isExBond ? 'Packages released from the warehouse by this Ex-Bond' : undefined}>{isExBond ? 'Pkg Released' : 'Total Pkg'}</label>
              <input name="totalPkg" type="number" className="input-field mandatory-field" placeholder="TOTAL PKG" style={{ flex: 1, color: '#0f172a', border: '1px solid #f87171' }} value={jobData.totalPkg || ""} onChange={(e) => setJobData(prev => ({ ...prev, totalPkg: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }}>Pkg Code</label>
              <input name="pkg" type="text" list="pkg-code-list" className="input-field mandatory-field" placeholder="PKG" style={{ flex: 1, color: '#0f172a', border: '1px solid #f87171' }} value={jobData.pkg || ""} onChange={(e) => setJobData(prev => ({ ...prev, pkg: e.target.value }))} />
            </div>
            {/* 30-Oct-2026: the Pkg Code box listed UQCs (KGS, NOS ...). These are the ICEGATE package codes. */}
            <datalist id="pkg-code-list"><option key="BDL" value="BDL">BUNDLE</option><option key="BLO" value="BLO">STEEL BLOCKS</option><option key="BLS" value="BLS">BAILS</option><option key="BOU" value="BOU">BILLIONS OF UNIT</option><option key="BOX" value="BOX">BOXES</option><option key="BRL" value="BRL">BARREL</option><option key="BUL" value="BUL">STEEL BULKS</option><option key="CAS" value="CAS">CASES</option><option key="CBY" value="CBY">CARBOYS</option><option key="CHT" value="CHT">CHEST</option><option key="CLS" value="CLS">COILS</option><option key="COL" value="COL">COLLIES</option><option key="CON" value="CON">CONTAINER</option><option key="CRT" value="CRT">CRATES</option><option key="CSK" value="CSK">WOODEN CASKS</option><option key="CTN" value="CTN">CARTONS</option><option key="DRM" value="DRM">DRUMS</option><option key="ENV" value="ENV">STEEL ENVELOPES</option><option key="FLK" value="FLK">FLASK</option><option key="HBK" value="HBK">HABBUCK</option><option key="JBL" value="JBL">JUMBLE BALE</option><option key="JTA" value="JTA">JOTTA</option><option key="KEG" value="KEG">KEGGS</option><option key="NGT" value="NGT">INGOT</option><option key="PAL" value="PAL">PALLS</option><option key="PCS" value="PCS">PIECES</option><option key="PKG" value="PKG">PACKAGES</option><option key="PLT" value="PLT">PALLETS</option><option key="QDS" value="QDS">QUADS</option><option key="REL" value="REL">REELS</option><option key="RLS" value="RLS">ROOLS</option><option key="SHT" value="SHT">SHEETS</option><option key="SKD" value="SKD">SKID & SKIDDED PKGS</option><option key="SLB" value="SLB">SLABS</option><option key="TBL" value="TBL">TABLE</option><option key="TRK" value="TRK">TRUNK</option><option key="UNT" value="UNT">UNITS</option><option key="VLS" value="VLS">VIALS</option></datalist>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }} title={isExBond ? 'Gross weight released from the warehouse by this Ex-Bond' : undefined}>{isExBond ? 'Wt Released' : 'Gross Wt.'}</label>
              <input name="grossWt" type="number" className="input-field mandatory-field" placeholder="GROSS WT" style={{ flex: 1, color: '#0f172a', border: '1px solid #f87171' }} value={jobData.grossWt || ""} onChange={(e) => setJobData(prev => ({ ...prev, grossWt: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }}>Wt. Unit</label>
              <input name="grossWtUnit" type="text" list="uqc-list" className="input-field mandatory-field" placeholder="KGS" style={{ flex: 1, color: '#0f172a', border: '1px solid #f87171' }} value={jobData.grossWtUnit || ""} onChange={(e) => setJobData(prev => ({ ...prev, grossWtUnit: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '90px', minWidth: '90px', whiteSpace: 'nowrap' }}>Bulk shipment</label>
              <input name="autoField_18" type="text" className="input-field" style={{ flex: 1, color: '#0f172a', border: '1px solid var(--primary-border)' }}  value={jobData["autoField_18"] || ""} onChange={handleChange} />
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 2 }}>
              <label style={{ width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }}>Marks & No.</label>
              <input name="marksAndNumbers1" type="text" className={reqCls} placeholder="MARKS & NO" style={{ flex: 1, color: '#0f172a', border: reqBorder }} value={(jobData["marksAndNumbers1"] || jobData["marks1"]) || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }}>Line No</label>
              <input name="lineNo" type="text" className="input-field" placeholder="LINE NO" style={{ flex: 1, color: '#0f172a', border: '1px solid var(--primary-border)' }} value={jobData["lineNo"] || ""} onChange={handleChange} />
            </div>
            <div style={{ flex: 3 }}></div>
          </div>
          
          
      {transportMode === 'S' && (
      <>
      {/* ICD Specification */}
      <div style={{ border: '1px solid var(--primary-border)', background: 'transparent', marginTop: '8px', marginBottom: '8px' }}>
        <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>ICD Specification</div>
        <div style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
            <label style={{ width: '110px', minWidth: '110px', whiteSpace: 'nowrap' }}>Gateway IGM No.</label>
            <input name="gatewayIgmNo" type="text" className="input-field" placeholder="NO." style={{ flex: 1, color: '#0f172a', border: '1px solid var(--primary-border)' }} value={jobData["gatewayIgmNo"] || ""} onChange={handleChange} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
            <label style={{ width: '120px', minWidth: '120px', whiteSpace: 'nowrap' }}>Gateway IGM Date</label>
            <ModernDatePicker name="gatewayIgmDate" className="input-field" style={{ flex: 1, color: '#0f172a', border: '1px solid var(--primary-border)' }}  value={(jobData["gatewayIgmDate"] || jobData["autoField_19"]) || ""} onChange={handleChange} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1.5 }}>
            <label style={{ width: '90px', minWidth: '90px', whiteSpace: 'nowrap' }}>Reporting Port</label>
            <input name="portName" list="port-list" type="text" className="input-field mandatory-field" placeholder="PORT NAME" style={{ flex: 2, color: '#0f172a', border: '1px solid #f87171' }} value={(jobData["gatewayPortName"] || jobData["portName"]) || ""} onChange={handlePortSelect} />
              <PortLists ports={ports} />
            <input name="gatewayPortCode" list="port-code-list" type="text" className="input-field" placeholder="CODE" style={{ flex: 1, color: '#0f172a', border: '1px solid var(--primary-border)' }} value={(jobData["gatewayPortCode"] || jobData["code"]) || ""} onChange={handleChange} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flex: 0.5 }}>
            <button className="btn btn-info" onClick={(e) => { e.preventDefault(); setIsContainerModalOpen(true); }} style={{ padding: '0.2rem 0.5rem', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px' }}>Container</button>
          </div>
        </div>
      </div>
      
            </>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '8px', paddingRight: '8px' }}>
        {(transportMode === 'A' || transportMode === 'S') && <button type="button" className="btn" onClick={() => setIcgOpen(true)} title="Reads ICEGATE's public IGM enquiry for this MAWB / BL and fills the IGM boxes" style={{ padding: '0.3rem 0.75rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', color: '#fff', border: 'none', background: 'linear-gradient(135deg, var(--primary-color-start, #0284c7), var(--primary-color-end, #075985))' }}><Download size={14} /> Fetch from ICEGATE</button>}
        <button type="button" className="btn btn-primary" onClick={handleAddIgmRow} style={{ padding: '0.3rem 0.75rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}><PlusSquare size={14} /> {igmEditIdx !== null ? 'Update' : 'Add'}</button>
        <button type="button" className="btn btn-secondary" onClick={handleClearIgmRow} style={{ padding: '0.3rem 0.75rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}><RefreshCw size={14} /> Clear</button>
      </div>

          <div style={{ overflowX: 'auto', borderTop: '1px solid var(--primary-border)', marginTop: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <tr>
                  <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #e2e8f0', width: '60px' }}>Edit</th>
                  <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #e2e8f0', width: '60px' }}>Remove</th>
                  <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Igm No.</th>
                  <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Igm Dt.</th>
                  <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Mawb No.</th>
                  <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Mawb Dt.</th>
                  <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #e2e8f0', width: '50px' }}>Track</th>
                  <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Hawb No.</th>
                  <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Hawb Dt.</th>
                  <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Inward Dt.</th>
                  <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Total Pkg.</th>
                  <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Pkg. Code</th>
                  <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Gross Wt.</th>
                  <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Unit Code</th>
                  <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Marks & No.1</th>
                  <th style={{ padding: '4px', textAlign: 'left' }}>Line No.</th>
                </tr>
              </thead>
              <tbody>
                {igmRows.length === 0 && <tr><td colSpan={16} style={{ padding: '8px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>No IGM rows - fill the IGM details and click Add</td></tr>}
                {igmRows.map((row, idx) => (
                  <tr key={row.id || idx} style={{ borderBottom: '1px solid #e2e8f0', background: igmEditIdx === idx ? '#fef9c3' : 'white' }}>
                    <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}><button type="button" onClick={() => handleEditIgmRow(idx)} style={{ padding: '2px 6px', fontSize: '10px', cursor: 'pointer', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '2px' }}>Edit</button></td>
                    <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}><button type="button" onClick={() => handleRemoveIgmRow(idx)} style={{ padding: '2px 6px', fontSize: '10px', cursor: 'pointer', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '2px', color: '#dc2626' }}>✕</button></td>
                    <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}>{row.igmNumber || row.igmNo}</td>
                    <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}>{dmy(row.igmDate)}</td>
                    <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}>{row.mawbNo}</td>
                    <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}>{dmy(row.mawbDate)}</td>
                    <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}></td>
                    <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}>{row.hawbNo}</td>
                    <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}>{dmy(row.hawbDate)}</td>
                    <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}>{dmy(row.inwardDate)}</td>
                    <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}>{row.totalPkg}</td>
                    <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}>{row.pkgCode}</td>
                    <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}>{row.grossWt}</td>
                    <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}>{row.wtUnit}</td>
                    <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}>{row.marks1}</td>
                    <td style={{ padding: '4px' }}>{row.lineNo}</td>
                  </tr>
                ))}
                </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div style={{ display: 'flex', flexWrap: 'wrap', padding: '0.75rem 1rem', background: 'transparent', marginTop: '0.5rem', border: '1px solid var(--primary-border)', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
        <button type="button" className="btn btn-success" title={jobData.id ? 'Save the changes to job ' + (jobData.jobNo || '') : 'Save as a new job'} onClick={() => handleHeaderSave('save')} style={{ padding: '0.4rem 1rem', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
          <Save size={14} /> Save
        </button>
        <button type="button" className="btn btn-success" disabled={!jobData.id} title={jobData.id ? 'Update job ' + (jobData.jobNo || '') : 'Open a saved job (1. Job Query) to modify it'} onClick={() => handleHeaderSave('modify')} style={{ padding: '0.4rem 1rem', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', cursor: jobData.id ? 'pointer' : 'not-allowed', opacity: jobData.id ? 1 : 0.55 }}>
          <Edit size={14} /> Modify
        </button>
        <button type="button" className="btn btn-info" onClick={(e) => { e.preventDefault(); handleClearForm(); }} style={{ padding: '0.4rem 1rem', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
          <RefreshCw size={14} /> Clear
        </button>
      </div>
    <IcegateIgmModal open={icgOpen} onClose={() => setIcgOpen(false)} mode={transportMode} location={(transportMode === 'S' && jobData.gatewayPortCode) || jobData.portCode || jobData.autoField_2 || ''} mawb={jobData.mawbNo || jobData.mawbblNo || ''} hawb={jobData.hawbNo || jobData.hawbhblNo || ''} onFill={fillFromIcegate} />
    </>
  );
}
