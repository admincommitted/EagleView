// Screen section: Consignee Details
// Split out of ExportHeaderTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';
import RichAutocomplete from '../../../../common/RichAutocomplete';
import { RichPartySelect } from '../helpers';

export default function ConsigneeDetailsSection({ ctx }) {
  const { countries, exportData, indianPorts, foreignPorts, hasDrawback, handleChange, parties, setExportData, states } = ctx;
  // port code boxes can be typed (6 letters, e.g. AEDXB) when the port is not in the list
  const codeInput = (field, width, mandatory) => (
    <input type="text" className={"input-field " + (mandatory && !exportData[field] ? "mandatory-missing" : "")} value={exportData[field] || ''} maxLength={6} title="Port code (can be typed)"
      onChange={e => setExportData(prev => ({ ...prev, [field]: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
      style={{ width, background: 'var(--bg-input)', borderColor: exportData[field] && String(exportData[field]).length !== 5 && String(exportData[field]).length !== 6 ? '#dc2626' : undefined }} />);
  return (
    <>
    <div style={{ border: '1px solid var(--primary-border)', background: 'transparent', marginBottom: '4px' }}>
        <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)' }}>Consignee Details</div>
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1.5 }}>
              <label style={{ width: '120px' }}>Consignee Name</label>
              <RichPartySelect type="CONSIGNEE" parties={parties} exportData={exportData} setExportData={setExportData} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '80px' }}>Address 1</label>
              <input type="text" className={"input-field " + (!exportData["consigneeAddress1"] ? "mandatory-missing" : "")} value={exportData["consigneeAddress1"] || ''} onChange={e => setExportData({...exportData, consigneeAddress1: e.target.value})} style={{ flex: 1, background: 'var(--bg-input)' }} />
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--primary-color-end, #2563eb)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>i</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '80px' }}>Address 2</label>
                <input type="text" className="input-field" value={exportData["consigneeAddress2"] || ''} onChange={e => setExportData({...exportData, consigneeAddress2: e.target.value})} style={{ flex: 1, background: 'var(--bg-input)' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1.5 }}>
              <label style={{ width: '120px' }}>Address 3</label>
              <input type="text" className="input-field" value={exportData["consigneeAddress3"] || ''} onChange={e => setExportData({...exportData, consigneeAddress3: e.target.value})} style={{ flex: 1, border: '1px solid var(--primary-border)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '80px' }}>Address 4</label>
              <input type="text" className="input-field" value={exportData["consigneeAddress4"] || ''} onChange={e => setExportData({...exportData, consigneeAddress4: e.target.value})} placeholder="ADDRESS LINE 4" style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '80px' }}>Country</label>
                  <RichAutocomplete 
                  options={countries}
                  value={exportData["consigneeCountry"]}
                  onChange={v => setExportData({...exportData, consigneeCountry: v})}
                  onSelect={c => setExportData({...exportData, consigneeCountry: c.name, consigneeCountryCode: c.code})}
                  searchFilter={(c, q) => c.name?.toLowerCase()?.includes(q?.toLowerCase()) || c.code?.toLowerCase()?.includes(q?.toLowerCase())}
                  renderOption={c => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{c.code}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{c.name}</div>
                    </>
                  )}
                  placeholder="Country"
                  inputStyle={{ border: '1px solid var(--primary-border)' }}
                />
                <input name="consigneeCountryCode" type="text" className="input-field" value={exportData["consigneeCountryCode"] || ''} readOnly title={String(exportData.consigneeCountryCode || '').toUpperCase() === 'IN' ? 'Consignee of an export is abroad - check the country' : ''} style={{ width: '40px', border: String(exportData.consigneeCountryCode || '').toUpperCase() === 'IN' ? '2px solid #dc2626' : '1px solid var(--primary-border)', background: 'var(--bg-input)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* PORT DETAILS */}
      <div style={{ border: '1px solid var(--primary-border)', background: 'transparent', marginBottom: '4px' }}>
        <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)' }}>Port Details</div>
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '100px' }}>Loading Port</label>
                <RichAutocomplete 
                  options={indianPorts}
                  value={exportData["loadingPortName"]}
                  onChange={v => setExportData({...exportData, loadingPortName: v})}
                  onSelect={p => setExportData({...exportData, loadingPortName: p.portName, loadingPortCode: p.portCode})}
                  searchFilter={(p, q) => p.portName?.toLowerCase()?.includes(q?.toLowerCase()) || p.portCode?.toLowerCase()?.includes(q?.toLowerCase())}
                  renderOption={p => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{p.portCode}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{p.portName} ({p.category})</div>
                    </>
                  )}
                  placeholder="Port Name"
                  inputStyle={{ background: 'var(--bg-input)' }}
                />
                {codeInput('loadingPortCode', '60px', true)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '160px' }}>Country Of Destination</label>
                <RichAutocomplete 
                  options={countries}
                  value={exportData["destCountryName"]}
                  onChange={v => setExportData({...exportData, destCountryName: v})}
                  onSelect={c => setExportData({...exportData, destCountryName: c.name, destCountryCode: c.code})}
                  searchFilter={(c, q) => c.name?.toLowerCase()?.includes(q?.toLowerCase()) || c.code?.toLowerCase()?.includes(q?.toLowerCase())}
                  renderOption={c => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{c.code}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{c.name}</div>
                    </>
                  )}
                  placeholder="Country Name"
                  inputStyle={{ background: 'var(--bg-input)' }}
                />
                <input type="text" className={"input-field " + (!exportData["destCountryCode"] ? "mandatory-missing" : "")} value={exportData["destCountryCode"] || ''} readOnly style={{ width: '40px', background: 'var(--bg-input)',  }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '120px' }}>Destination Port</label>
                <RichAutocomplete 
                  options={foreignPorts}
                  value={exportData["destPortName"]}
                  onChange={v => setExportData({...exportData, destPortName: v})}
                  onSelect={p => setExportData({...exportData, destPortName: p.portName, destPortCode: p.portCode, ...(!exportData.destCountryCode && p.countryCode ? { destCountryCode: p.countryCode, destCountryName: (countries.find(c => c.code === p.countryCode) || {}).name || p.countryCode } : {})})}
                  searchFilter={(p, q) => p.portName?.toLowerCase()?.includes(q?.toLowerCase()) || p.portCode?.toLowerCase()?.includes(q?.toLowerCase())}
                  renderOption={p => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{p.portCode}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{p.portName} ({p.category})</div>
                    </>
                  )}
                  placeholder="Port Name"
                  inputStyle={{ background: 'var(--bg-input)' }}
                />
                {codeInput('destPortCode', '60px', true)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '100px' }}>State Origin</label>
                <RichAutocomplete 
                  options={states}
                  value={exportData["stateOriginName"]}
                  onChange={v => setExportData({...exportData, stateOriginName: v})}
                  onSelect={s => setExportData({...exportData, stateOriginName: s.stateName, stateOriginCode: s.taxCode})}
                  searchFilter={(s, q) => s.stateName?.toLowerCase()?.includes(q?.toLowerCase()) || s.taxCode?.includes(q)}
                  renderOption={s => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{s.stateName}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Code: {s.taxCode}</div>
                    </>
                  )}
                  placeholder="State Name"
                  inputStyle={{ background: 'var(--bg-input)' }}
                />
                <input type="text" className={"input-field " + (!exportData["stateOriginCode"] ? "mandatory-missing" : "")} value={exportData["stateOriginCode"] || ''} readOnly style={{ width: '60px', background: 'var(--bg-input)',  }} />
            </div>
              
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '160px' }}>Country Of Discharge</label>
                <RichAutocomplete 
                  options={countries}
                  value={exportData["discCountryName"]}
                  onChange={v => setExportData({...exportData, discCountryName: v})}
                  onSelect={c => setExportData({...exportData, discCountryName: c.name, discCountryCode: c.code})}
                  searchFilter={(c, q) => c.name?.toLowerCase()?.includes(q?.toLowerCase()) || c.code?.toLowerCase()?.includes(q?.toLowerCase())}
                  renderOption={c => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{c.code}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{c.name}</div>
                    </>
                  )}
                  placeholder="Country Name"
                  inputStyle={{ background: 'var(--bg-input)' }}
                />
                <input type="text" className={"input-field " + (!exportData["discCountryCode"] ? "mandatory-missing" : "")} value={exportData["discCountryCode"] || ''} readOnly style={{ width: '40px', background: 'var(--bg-input)',  }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <label style={{ width: '120px' }}>Discharge Port</label>
                <RichAutocomplete 
                  options={foreignPorts}
                  value={exportData["discPortName"]}
                  onChange={v => setExportData({...exportData, discPortName: v})}
                  onSelect={p => setExportData({...exportData, discPortName: p.portName, discPortCode: p.portCode, ...(!exportData.discCountryCode && p.countryCode ? { discCountryCode: p.countryCode, discCountryName: (countries.find(c => c.code === p.countryCode) || {}).name || p.countryCode } : {})})}
                  searchFilter={(p, q) => p.portName?.toLowerCase()?.includes(q?.toLowerCase()) || p.portCode?.toLowerCase()?.includes(q?.toLowerCase())}
                  renderOption={p => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{p.portCode}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{p.portName} ({p.category})</div>
                    </>
                  )}
                  placeholder="Port Name"
                  inputStyle={{ border: '1px solid var(--primary-border)' }}
                />
                {codeInput('discPortCode', '60px', true)}
            </div>
          </div>
        </div>
      </div>

      {/* OTHER DETAILS */}
      <div style={{ border: '1px solid var(--primary-border)', background: 'transparent', marginBottom: '4px' }}>
        <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)' }}>Other Details</div>
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '100px' }}>EPZ/ICD</label>
              <input name="autoField_11" type="text" className="input-field" style={{ flex: 1, border: '1px solid var(--primary-border)' }}  value={exportData["autoField_11"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>Drawback A/C No</label>
              <input name="drawbackAcNo" type="text" title={hasDrawback ? 'Needed: the job has drawback items' : 'Needed only when an item claims drawback'} className={"input-field " + (hasDrawback && !exportData["drawbackAcNo"] ? "mandatory-missing" : "")} placeholder="DRAWBACK A/C NO" style={{ flex: 1, color: 'inherit', background: 'var(--bg-input)' }} value={exportData["drawbackAcNo"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>Fr Bank</label>
              <input name="forexCode" type="text" className="input-field" placeholder="FOREX CODE" style={{ flex: 1 }} value={exportData["forexCode"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>PAN No</label>
              <input name="autoField_12" type="text" className="input-field" maxLength={10} style={{ flex: 1, border: '1px solid var(--primary-border)' }}  value={exportData["autoField_12"] || exportData["panNo"] || ""} onChange={e => { const v = e.target.value.toUpperCase(); setExportData(prev => ({ ...prev, autoField_12: v, panNo: v })); }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>User Job No</label>
              <input name="autoField_13" type="text" className="input-field" style={{ flex: 1, border: '1px solid var(--primary-border)' }}  value={exportData["autoField_13"] || ""} onChange={handleChange} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '100px' }}>Excise Rs</label>
              <input name="exciseRs" type="text" className="input-field" placeholder="EXCISE RS" style={{ flex: 1 }} value={exportData["exciseRs"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>Custom Rs.</label>
              <input name="customRs" type="text" className="input-field" placeholder="CUSTOM RS" style={{ flex: 1 }} value={exportData["customRs"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>Cess Amount</label>
              <input name="cessAmt" type="text" className="input-field" placeholder="CESS AMT" style={{ flex: 1 }} value={exportData["cessAmt"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>Shipment Type</label>
              <select className="input-field" style={{ flex: 1, border: '1px solid var(--primary-border)' }} value={exportData["shipmentType"] || ''} onChange={e => setExportData({...exportData, shipmentType: e.target.value})}>
                <option value="">Select</option>
                <option value="FCL">FCL - Full Container Load</option>
                <option value="LCL">LCL - Less than Container Load</option>
                <option value="BULK">Bulk</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>Docket Owner</label>
              <input name="docketOwner" type="text" className="input-field" placeholder="DOCKET OWNER" style={{ flex: 1, border: '1px solid var(--primary-border)' }} value={exportData["docketOwner"] || ""} onChange={handleChange} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '100px' }}>DBK Rs.</label>
              <input name="dbkRs" type="text" className="input-field" placeholder="DBK RS" style={{ flex: 1 }} value={exportData["dbkRs"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>FOB Rs.</label>
              <input name="fobRs" type="text" className="input-field" placeholder="FOB RS" style={{ flex: 1 }} value={exportData["fobRs"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>IFSC Code</label>
              <input name="ifscCd" type="text" className="input-field" placeholder="IFSC CD" style={{ flex: 1 }} value={exportData["ifscCd"] || ""} onChange={handleChange} />
            </div>
          </div>
        </div>
      </div>

      {/* SB2 DETAILS */}
    </>
  );
}
