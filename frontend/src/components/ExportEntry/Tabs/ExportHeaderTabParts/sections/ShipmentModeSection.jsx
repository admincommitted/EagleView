// Screen section: Shipment Mode:
// Split out of ExportHeaderTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import ModernDatePicker from '../../../../common/ModernDatePicker'; // 21-Nov-2026: DD-MM-YYYY date box like the invoice screens (same YYYY-MM-DD value)
import React from 'react';
import RichAutocomplete from '../../../../common/RichAutocomplete';
import { RichPartySelect, RichPortSelect } from '../helpers';

export default function ShipmentModeSection({ ctx }) {
  const { fromParty, selectedShipper } = ctx;
  const { searchCities, chas, cities, exportData, indianPorts, handleChange, handleShipperBranchSelect, parties, setExportData, setIsCategoryModalOpen, shipperAdCodes, shipperBranches, states, warehouses } = ctx;
  return (
    <>
    {/* TOP JOB DETAILS */}
      <div style={{ border: '1px solid var(--primary-border)', background: 'transparent', marginBottom: '4px' }}>
        <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'transparent', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--primary-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontWeight: 600 }}>Shipment Mode:</label>
              <select className="input-field" value={exportData['shipmentMode'] || 'AIR'} onChange={e => { setExportData(prev => ({...prev, shipmentMode: e.target.value})); }} style={{ width: '100px', background: 'var(--bg-input)', border: '1px solid #94a3b8', fontWeight: 'bold' }}>
                <option value="AIR">&#9992; AIR</option>
                <option value="SEA">&#9875; SEA</option>
                <option value="LAND">&#128666; LAND</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: 'span 2' }}>
              <label style={{ fontWeight: 600 }}>Ex-Bond Job</label>
              <select 
                className="input-field" 
                value={/^Y/i.test(String(exportData["exBondJob"] || '')) || exportData["exBondJob"] === true ? 'Y' : 'N'} 
                onChange={e => setExportData(prev => ({...prev, exBondJob: e.target.value}))} 
                style={{ width: '40px', border: '1px solid var(--primary-border)', textAlign: 'center', cursor: 'pointer' }}
              >
                <option value="N">N</option>
                <option value="Y">Y</option>
              </select>
              {(exportData["exBondJob"] === 'Y') && (
                <>
                  <label style={{ fontWeight: 600, marginLeft: '8px' }}>
                    WareHouse Code {warehouses && <span style={{fontSize:'10px', color:'#64748b', fontWeight:'normal'}}>(Total: {warehouses.length})</span>}
                  </label>
                  <RichAutocomplete 
                    options={warehouses}
                    value={exportData["warehousename"]}
                    onChange={v => setExportData({...exportData, warehousename: v})}
                    onSelect={w => setExportData({...exportData, warehousename: w.warehouseName, code: w.warehouseCode})}
                    searchFilter={(w, q) => w.warehouseName?.toLowerCase()?.includes(q?.toLowerCase()) || w.warehouseCode?.toLowerCase()?.includes(q?.toLowerCase())}
                    renderOption={w => (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--primary-color-start, #0ea5e9)' }}>{w.warehouseName}</span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>Code: {w.warehouseCode}</span>
                      </div>
                    )}
                    placeholder="WAREHOUSE_NAME"
                    inputStyle={{ width: '200px', background: '#f0fdf4', border: '1px solid var(--primary-border)' }}
                  />
                  
                  <RichAutocomplete 
                    options={warehouses}
                    value={exportData["code"]}
                    onChange={v => setExportData({...exportData, code: v})}
                    onSelect={w => setExportData({...exportData, warehousename: w.warehouseName, code: w.warehouseCode})}
                    searchFilter={(w, q) => w.warehouseCode?.toLowerCase()?.includes(q?.toLowerCase()) || w.warehouseName?.toLowerCase()?.includes(q?.toLowerCase())}
                    renderOption={w => (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--primary-color-start, #0ea5e9)' }}>{w.warehouseCode}</span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>{w.warehouseName}</span>
                      </div>
                    )}
                    placeholder="CODE"
                    inputStyle={{ width: '80px',  background: 'var(--bg-input)' }}
                  />
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: 'span 2' }}>
              <label style={{ fontWeight: 600 }}>Hand Carry</label>
              <input type="text" className="input-field" value={exportData["handCarry"] || 'N'} onChange={e => setExportData({...exportData, handCarry: e.target.value.toUpperCase()})} maxLength={1} style={{ width: '30px', border: '1px solid var(--primary-border)', textAlign: 'center' }} />
              {(exportData["handCarry"] === 'Y') && (
                <>
                  <label style={{ fontWeight: 600, marginLeft: '8px' }}>PNR</label>
                  <input name="pnr" type="text" className="input-field" placeholder="PNR" style={{ width: '120px', border: '1px solid var(--primary-border)' }} value={exportData["pnr"] || ""} onChange={handleChange} />
                  <label style={{ fontWeight: 600, marginLeft: '8px' }}>ETICKET</label>
                  <input name="eTicket" type="text" className="input-field" placeholder="ETICKET" style={{ width: '120px', border: '1px solid var(--primary-border)' }} value={exportData["eTicket"] || exportData["eticket"] || ""} onChange={handleChange} />
                  <label style={{ fontWeight: 600, marginLeft: '8px' }}>PASSPORT NO</label>
                  <input name="passportNo" type="text" className="input-field" placeholder="PASSPORTNO" style={{ width: '120px', border: '1px solid var(--primary-border)' }} value={exportData["passportNo"] || exportData["passportno"] || ""} onChange={handleChange} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
  
      {/* EXPORTER DETAILS */}
      <div style={{ border: '1px solid var(--primary-border)', background: 'transparent', marginBottom: '4px' }}>
        <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)' }}>Exporter Details</div>
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Left 50% */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '180px' }}>Location (Port)</label>
                <RichPortSelect ports={indianPorts} exportData={exportData} setExportData={setExportData} />
            </div>
            {/* Right 50% */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <label style={{ width: '100px' }}>Govt. IEC [Y/N]</label>
                <select className="input-field" value={exportData["govtIec"] || 'N'} onChange={e => setExportData({...exportData, govtIec: e.target.value})} style={{ width: '50px', background: 'var(--bg-input)' }}><option value="Y">Y</option><option value="N">N</option></select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '80px' }}>CHA No.</label>
                  <select className={"input-field " + (!exportData["chaNo"] ? "mandatory-missing" : "")} value={exportData["chaNo"] || ''} onChange={e => { const sel = chas.find(c => c.chaCode === e.target.value); setExportData({...exportData, chaNo: e.target.value, chaName: sel?.chaName || '', chaAddress: sel?.chaAddress || '', chaCity: sel?.chaCity || '', chaPin: sel?.chaPin || '', chaGstin: sel?.chaGstin || '', chaPhone: sel?.chaPhone || '', chaEmail: sel?.chaEmail || ''}); }} style={{ flex: 1, background: 'var(--bg-input)' }}>
                    <option value="">-- SELECT CHA --</option>
                    {chas.map(c => <option key={c.id} value={c.chaCode}>{c.chaCode} - {c.chaName}</option>)}
                    {/* CHA of the job not in the CHA master (e.g. read from a file): still shown */}
                    {exportData.chaNo && !chas.some(c => c.chaCode === exportData.chaNo) && <option value={exportData.chaNo}>{exportData.chaNo}{exportData.chaName ? ' - ' + exportData.chaName : ''} (not in CHA master)</option>}
                  </select>

              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <label style={{ width: '80px' }}>MOOWR [Y/N]</label>
                <select name="autoField_31" className="input-field" style={{ width: '60px', border: '1px solid var(--primary-border)' }} value={exportData["autoField_31"] || ""} onChange={(e) => { const val = e.target.value; setExportData(prev => ({...prev, autoField_31: val, ...(val === 'Yes' ? { exBondJob: 'Y' } : {})})); }}><option>No</option><option>Yes</option></select>
              </div>
            </div>
          </div>

          

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '180px' }}>Exporter (Master)</label>
              <RichPartySelect parties={parties} type="SHIPPER" exportData={exportData} setExportData={setExportData} />
              <button type="button" onClick={() => fromParty(true)} disabled={!selectedShipper} title={selectedShipper ? 'Take branch, address, GSTIN, Merchant / Manufacturer, Class, AD Code again from the Party Master' : 'Exporter not found in the Party Master'}
                style={{ height: '24px', padding: '0 8px', fontSize: '10px', whiteSpace: 'nowrap', border: '1px solid var(--primary-border)', background: selectedShipper ? 'var(--primary-bg-light, #e0f2fe)' : '#f1f5f9', color: selectedShipper ? 'var(--primary-text, #0369a1)' : '#94a3b8', borderRadius: '4px', cursor: selectedShipper ? 'pointer' : 'not-allowed', fontWeight: 600 }}>↻ Party Master</button>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1.5 }}>
                <label style={{ width: '100px' }}>IEC Code</label>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <input
                      type="text"
                      className="input-field"
                      maxLength={10}
                      value={exportData["shipperIec"] || ''}
                      onChange={e => {
                        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        setExportData({...exportData, shipperIec: val});
                      }}
                      // same font as the other boxes (was monospace, bold, letter-spaced). 29-Oct-2026
                      style={{
                        flex: 1,
                        background: 'var(--bg-input)',
                        textTransform: 'uppercase',
                        borderColor: (exportData["shipperIec"] || '').length === 10 ? '#16a34a' : undefined
                      }}
                      placeholder="e.g. AABCP1234Q"
                    />
                    {(exportData["shipperIec"] || '').length > 0 && (exportData["shipperIec"] || '').length !== 10 && (
                      <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700 }}>
                        ⚠ IEC must be exactly 10 characters ({(exportData["shipperIec"] || '').length}/10)
                      </span>
                    )}
                  </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '100px' }}>Branch Sr. No</label>
                  <select className="input-field" value={exportData["shipperBranchSrNo"] || ''} onChange={handleShipperBranchSelect} style={{ flex: 1, border: '1px solid var(--primary-border)' }}>
                    <option value="">{selectedShipper ? (shipperBranches.length ? '-- SELECT --' : '-- no branch in Party Master --') : '-- select exporter --'}</option>
                    {shipperBranches.map(b => (
                      <option key={b.id} value={b.branchSrNo}>{b.branchSrNo} - {b.branchName || [b.city, b.state].filter(Boolean).join(', ') || b.address1 || ''}{(b.gstin || b.regNo) ? ' (' + (b.gstin || b.regNo) + ')' : ''}</option>
                    ))}
                    {exportData.shipperBranchSrNo && !shipperBranches.some(b => String(b.branchSrNo) === String(exportData.shipperBranchSrNo)) && <option value={exportData.shipperBranchSrNo}>{exportData.shipperBranchSrNo}</option>}
                  </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '180px' }}>Address 1</label>
              <input type="text" className={"input-field " + (!exportData["shipperAddress1"] ? "mandatory-missing" : "")} maxLength={50} value={exportData["shipperAddress1"] || ''} onChange={e => setExportData({...exportData, shipperAddress1: e.target.value})} style={{ flex: 1, background: 'var(--bg-input)' }} />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '100px' }}>Address 2</label>
                <input type="text" className="input-field" maxLength={35} value={exportData["shipperAddress2"] || ''} onChange={e => setExportData({...exportData, shipperAddress2: e.target.value})} style={{ flex: 1, border: '1px solid var(--primary-border)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '180px' }}>City</label>
                  <RichAutocomplete
                  options={cities}
                  value={exportData["shipperCity"]}
                  onChange={v => { setExportData({...exportData, shipperCity: v}); searchCities(v); }}
                  onSelect={c => setExportData({...exportData, shipperCity: c.cityName})}
                  searchFilter={(c, q) => c.cityName?.toLowerCase()?.includes(q?.toLowerCase())}
                  renderOption={c => (
                    <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{c.cityName}</div>
                  )}
                  placeholder="CITY"
                  inputStyle={{ border: '1px solid var(--primary-border)' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '50px' }}>State</label>
                  <RichAutocomplete
                  options={states}
                  value={exportData["shipperState"]}
                  onChange={v => setExportData({...exportData, shipperState: v})}
                  onSelect={s => setExportData({...exportData, shipperState: s.stateCode})}
                  searchFilter={(s, q) => s.stateName?.toLowerCase()?.includes(q?.toLowerCase()) || s.stateCode?.toLowerCase()?.includes(q?.toLowerCase())}
                  renderOption={s => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{s.stateCode}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{s.stateName}</div>
                    </>
                  )}
                  placeholder="STATE"
                  inputStyle={{ background: 'var(--bg-input)' }}
                />
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '100px' }}>PinCode</label>
                  <input type="text" className={"input-field " + (!exportData["shipperPin"] ? "mandatory-missing" : "")} value={exportData["shipperPin"] || ''} onChange={e => setExportData({...exportData, shipperPin: e.target.value})} style={{ flex: 1, background: 'var(--bg-input)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '50px' }}>NFEI</label>
                <select className="input-field" value={exportData.nfeiFlag || 'No'} onChange={e => setExportData(prev => ({...prev, nfeiFlag: e.target.value}))} style={{ flex: 1, border: '1px solid var(--primary-border)' }}><option>No</option><option>Yes</option></select>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '180px' }}>GSTN Type</label>
                <select className="input-field" value={exportData["shipperGstinType"] || 'GSTIN'} onChange={e => setExportData({...exportData, shipperGstinType: e.target.value})} style={{ flex: 1, border: '1px solid var(--primary-border)' }}>
                  <option value="GSTIN">GSTIN</option>
                  <option value="GST GOVERNMENT">GST - Government</option>
                  <option value="GST DIPLOMAT">GST - Diplomatic</option>
                  <option value="PAN">PAN</option>
                  <option value="TAN">TAN</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="AADHAAR">AADHAAR</option>
                </select>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '100px' }}>GSTIN No</label>
                  {/* format check of the number for the chosen type (GSTIN 15, PAN 10); for GSTIN the PAN inside must be the IEC's PAN */}
                  {(() => { const v = String(exportData["shipperGstin"] || '').toUpperCase(); const t = exportData["shipperGstinType"] || 'GSTIN';
                    const bad = v && (/^GST/.test(t) ? !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(v) : t === 'PAN' ? !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v) : false);
                    const iec = String(exportData["shipperIec"] || '').toUpperCase();
                    const panMismatch = !bad && t === 'GSTIN' && v.length === 15 && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(iec) && v.slice(2, 12) !== iec;
                    return (<div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <input type="text" className={"input-field " + (!v ? "mandatory-missing" : "")} value={exportData["shipperGstin"] || ''} onChange={e => setExportData({...exportData, shipperGstin: e.target.value.toUpperCase().replace(/\s/g, '')})} maxLength={15} style={{ flex: 1, background: 'var(--bg-input)', borderColor: bad || panMismatch ? '#dc2626' : undefined }} />
                      {bad && <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700 }}>⚠ Not a valid {/^GST/.test(t) ? 'GSTIN (15 characters)' : 'PAN (10 characters)'}</span>}
                      {panMismatch && <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700 }}>⚠ PAN in GSTIN ({v.slice(2, 12)}) is not the IEC ({iec}) - ICEGATE rejects this</span>}
                    </div>); })()}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '180px' }}>Merchant / Manufacturer</label>
              <select className="input-field" value={exportData["mercManuf"] || 'M'} onChange={e => setExportData({...exportData, mercManuf: e.target.value})} style={{ flex: 1, border: '1px solid var(--primary-border)' }}>
                <option value="F">Manufacturer [F]</option>
                <option value="M">Merchant [M]</option>
                <option value="C">Merchant Exporter Courier [C]</option>
                <option value="D">Manufacturer Exporter Courier [D]</option>
              </select>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '100px' }}>Class</label>
                <select className="input-field" value={exportData["shipperClass"] || 'P'} onChange={e => setExportData({...exportData, shipperClass: e.target.value})} style={{ flex: 1, border: '1px solid var(--primary-border)' }}><option value="P">Private [P]</option><option value="G">Government [G]</option><option value="W">Warehouse Shipping Bill [W]</option></select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '80px' }}>AD Code</label>
                <RichAutocomplete
                  options={shipperAdCodes}
                  value={exportData["adCode"] || ''}
                  onChange={v => setExportData({...exportData, adCode: v})}
                  onSelect={ad => setExportData({...exportData, adCode: ad.adCode})}
                  searchFilter={(ad, q) => ad.adCode?.toLowerCase()?.includes(q?.toLowerCase()) || ad.bankName?.toLowerCase()?.includes(q?.toLowerCase())}
                  renderOption={ad => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{ad.adCode}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{ad.bankName}</div>
                    </>
                  )}
                  placeholder="AD CODE"
                  inputStyle={{ background: 'var(--bg-input)' }}
                />
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--primary-color-end, #2563eb)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>i</div>
              </div>
            </div>
          </div>
          {exportData.nfeiFlag === 'Yes' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '4px' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <label style={{ width: '180px' }}>Category</label>
                <input name="category" type="text" className={"input-field " + (!exportData["nfeiCategory"] ? "mandatory-missing" : "")} value={exportData.nfeiCategory || ''} readOnly style={{ flex: 1, background: 'var(--bg-input)', cursor: 'pointer' }} placeholder="CATEGORY" onChange={handleChange} onClick={() => setIsCategoryModalOpen(true)} />
                <div onClick={() => setIsCategoryModalOpen(true)} style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--primary-color-end, #2563eb)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>i</div>
                <label style={{ width: '60px', marginLeft: '10px' }}>RBI No</label>
                <input type="text" className="input-field" value={exportData["rbiNo"] || ''} onChange={e => setExportData({...exportData, rbiNo: e.target.value})} style={{ flex: 1, border: '1px solid var(--primary-border)' }} />
                {/* 30-Oct-2026: the SB carries rbiWaiverNo AND rbiWaiverDate - only the number could be typed */}
                <label style={{ width: '70px', marginLeft: '10px' }}>RBI Date</label>
                <ModernDatePicker className="input-field" title="Date of the RBI waiver" value={exportData.rbiWaiverDate || ''} onChange={e => setExportData({ ...exportData, rbiWaiverDate: e.target.value })} style={{ width: '140px', border: '1px solid var(--primary-border)' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              </div>
            </div>
          )}

      </div>
    </div>

    {/* SUBAGENT DETAILS */}
    <div style={{ border: '1px solid var(--primary-border)', background: 'transparent', marginBottom: '4px' }}>
      <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        SubAgent Details 
        <select className="input-field" value={exportData.subAgentFlag || 'Y'} onChange={e => setExportData(prev => ({...prev, subAgentFlag: e.target.value}))} style={{ width: '40px', textAlign: 'center', height: '20px', padding: 0, fontSize: '11px' }}><option value="Y">Y</option><option value="N">N</option></select>
      </div>
      <div style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {(exportData.subAgentFlag || 'Y') === 'Y' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '120px' }}>SubAgent Name</label>
                <RichPartySelect type="SUBAGENT" parties={parties} exportData={exportData} setExportData={setExportData} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '130px' }}>SubAgent Address</label>
                <input name="subagentAddress" type="text" className="input-field" placeholder="SUBAGENT ADDRESS" style={{ flex: 1, background: 'var(--bg-input)' }} value={exportData.subAgentAddress1 || ''} readOnly onChange={handleChange} />
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>i</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* CONSIGNEE DETAILS */}
    </>
  );
}
