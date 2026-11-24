// Screen section: SB2 Details
// Split out of ExportHeaderTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import ModernDatePicker from '../../../../common/ModernDatePicker'; // 21-Nov-2026: DD-MM-YYYY date box like the invoice screens (same YYYY-MM-DD value)
import { Edit, RefreshCw, Save } from 'lucide-react';
import React from 'react';
import toast from 'react-hot-toast';
import RichAutocomplete from '../../../../common/RichAutocomplete';

export default function Sb2DetailsSection({ ctx }) {
  const { setFactoryStuffed, setPackingList, setContainerList, setEtpDetails, setNfeiCategory, setNfeiCategoryCode, setFactoryAddress } = ctx;
  const { containerList, packingList } = ctx;
  const { airlines, containerFlag, etpFlag, exportData, factoryStuffed, indianPorts, handleChange, handleFactoryStuffedChange, handleFlagChange, packingFlag, setContainerFlag, setEtpFlag, setExportData, setIsContainerModalOpen, setIsEtpModalOpen, setIsMarksNoModalOpen, setIsPackingModalOpen, setPackingFlag, shipmentMode, uqcs, vessels } = ctx;
  return (
    <>
    <div style={{ border: '1px solid var(--primary-border)', background: 'transparent', marginBottom: '4px' }}>
        <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)' }}>SB2 Details</div>
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>Sample Accomp.</label>
              {/* goes to the SB JSON (stuffModel.sampleAccompanied); was always sent as N */}
              <select name="autoField_32" className="input-field" style={{ flex: 1, border: '1px solid var(--primary-border)' }} value={/^Y/i.test(String(exportData["autoField_32"] || '')) ? 'Yes' : 'No'} onChange={handleChange}><option>No</option><option>Yes</option></select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>Factory Stuffed</label>
              <select className="input-field" value={factoryStuffed} onChange={handleFactoryStuffedChange} style={{ flex: 1, border: '1px solid var(--primary-border)' }}><option>No</option><option>Yes</option></select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>Nature Of Cargo</label>
              {/* ICEGATE codes; an air SB takes only P */}
              <select name="natureOfCargo" className={"input-field " + (!exportData["natureOfCargo"] ? "mandatory-missing" : "")} style={{ flex: 1, border: '1px solid var(--primary-border)' }} value={exportData["natureOfCargo"] || ""} onChange={handleChange}>
                <option value="">Select</option>
                <option value="P">P - Packaged</option>
                {shipmentMode !== 'AIR' && <><option value="C">C - Containerised</option><option value="CP">CP - Containerised &amp; Packaged</option><option value="LB">LB - Liquid Bulk</option><option value="DB">DB - Dry Bulk</option></>}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>Total Packages</label>
              <input name="autoField_14" type="text" className="input-field" style={{ flex: 1, border: '1px solid var(--primary-border)' }}  value={exportData["autoField_14"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>Unit</label>
                <RichAutocomplete 
                  options={uqcs}
                  value={exportData["pkgsUnit"]}
                  onChange={v => setExportData({...exportData, pkgsUnit: v})}
                  onSelect={u => setExportData({...exportData, pkgsUnit: u.uqcCode})}
                  searchFilter={(u, q) => u.uqcCode?.toLowerCase()?.includes(q?.toLowerCase()) || (u.description || '')?.toLowerCase()?.includes(q?.toLowerCase())}
                  renderOption={u => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{u.uqcCode}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{u.description}</div>
                    </>
                  )}
                  placeholder="UQC"
                  inputStyle={{ background: 'var(--bg-input)' }}
                />
            </div>
          </div>

          {/* marks and the checklist-only text side by side (one row instead of two). 29-Oct-2026 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label style={{ width: '130px' }}>Marks No</label>
            <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '8px', flex: 1.4, minWidth: 0 }}>
                <input name="autoField_16" type="text" className="input-field" style={{ flex: 1, border: '1px solid var(--primary-border)' }}  value={exportData["autoField_16"] || ""} onChange={handleChange} />
                <button type="button" onClick={() => setIsMarksNoModalOpen(true)} className="btn btn-primary" style={{ background: 'var(--primary-color-end, #2563eb)', borderColor: 'var(--primary-border, #38bdf8)', color: '#fff', padding: '0 1rem', fontSize: '11px', whiteSpace: 'nowrap', cursor: 'pointer' }}>Show Marks No</button>
              </div>
              <input name="thisDisplayOnlyInChecklistNotInCustomFlatFile" type="text" className="input-field" placeholder="THIS DISPLAY ONLY IN CHECKLIST NOT IN CUSTOM FLAT FILE." style={{ color: '#94a3b8', flex: 1, minWidth: 0 }} title="Shown only on the checklist, not sent to Customs" value={exportData["thisDisplayOnlyInChecklistNotInCustomFlatFile"] || ""} onChange={handleChange} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', alignItems: 'center', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>Total Loose Pkgs</label>
              <input name="autoField_17" type="text" className="input-field" style={{ flex: 1, border: '1px solid var(--primary-border)' }}  value={exportData["autoField_17"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>Gross Wt.</label>
              <input name="autoField_18" type="text" className="input-field" style={{ flex: 1, border: '1px solid var(--primary-border)' }}  value={exportData["autoField_18"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>Net Wt.</label>
              <input name="autoField_19" type="text" className="input-field" style={{ flex: 1, border: '1px solid var(--primary-border)' }}  value={exportData["autoField_19"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>Unit</label>
                <RichAutocomplete 
                  options={uqcs}
                  value={exportData["grWtUnit"]}
                  onChange={v => setExportData({...exportData, grWtUnit: v})}
                  onSelect={u => setExportData({...exportData, grWtUnit: u.uqcCode})}
                  searchFilter={(u, q) => u.uqcCode?.toLowerCase()?.includes(q?.toLowerCase()) || (u.description || '')?.toLowerCase()?.includes(q?.toLowerCase())}
                  renderOption={u => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{u.uqcCode}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{u.description}</div>
                    </>
                  )}
                  placeholder="UQC"
                  inputStyle={{ background: 'var(--bg-input)' }}
                />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>Seal Type [A/S/W]</label>
              <select name="sealType" className="input-field" style={{ flex: 1 }} value={exportData["sealType"] || ""} onChange={handleChange}>
                <option value="">Select</option><option value="A">A</option><option value="S">S</option><option value="W">W</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', alignItems: 'center', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>{shipmentMode === 'SEA' ? 'No Of Containers' : 'No Of ULDs'}</label>
              <input name="autoField_20" type="text" className="input-field" style={{ flex: 1, border: '1px solid var(--primary-border)' }}  value={exportData["autoField_20"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>{shipmentMode === 'SEA' ? 'Total Pkgs in MBL' : 'Total Pkgs in MAWB'}</label>
              <input name="autoField_21" type="text" className="input-field" style={{ flex: 1, border: '1px solid var(--primary-border)' }}  value={exportData["autoField_21"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>TransShipper Cd</label>
              <input name="transshipperCode" type="text" className="input-field" placeholder="TRANSSHIPPER CODE" style={{ flex: 1, color: 'inherit', background: 'var(--bg-input)' }} value={exportData["transshipperCode"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>Gateway Port</label>
                <RichAutocomplete 
                  options={indianPorts}
                  value={exportData["gatewayPort"]}
                  onChange={v => setExportData({...exportData, gatewayPort: v})}
                  onSelect={p => setExportData({...exportData, gatewayPort: p.portCode})}
                  searchFilter={(p, q) => p.portName?.toLowerCase()?.includes(q?.toLowerCase()) || p.portCode?.toLowerCase()?.includes(q?.toLowerCase())}
                  renderOption={p => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{p.portCode}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{p.portName}</div>
                    </>
                  )}
                  placeholder="GATEWAY PORT"
                  inputStyle={{ background: 'var(--bg-input)' }}
                />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>Warehouse Code</label>
              <input name="warehouseCode" type="text" className="input-field" placeholder="WAREHOUSE CODE" style={{ flex: 1, color: 'inherit', background: 'var(--bg-input)' }} value={exportData["warehouseCode"] || ""} onChange={handleChange} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border-color, #cbd5e1)', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>{shipmentMode === 'SEA' ? 'MBL No' : shipmentMode === 'AIR' ? 'MAWB No' : 'LWB No'}</label>
              <input name="autoField_22" type="text" className="input-field" placeholder={shipmentMode === 'SEA' ? 'MBL NO' : shipmentMode === 'AIR' ? 'MAWB NO' : 'LWB NO'} style={{ flex: 1 }}  value={exportData["autoField_22"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>{shipmentMode === 'SEA' ? 'MBL Date' : shipmentMode === 'AIR' ? 'MAWB Date' : 'LWB Date'}</label>
              <ModernDatePicker name="autoField_23" className="input-field" style={{ flex: 1 }}  value={exportData["autoField_23"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>{shipmentMode === 'SEA' ? 'HBL No' : shipmentMode === 'AIR' ? 'HAWB No' : 'Truck No'}</label>
              <input name="autoField_24" type="text" className="input-field" placeholder={shipmentMode === 'SEA' ? 'HBL NO' : shipmentMode === 'AIR' ? 'HAWB NO' : 'TRUCK NO'} style={{ flex: 1 }}  value={exportData["autoField_24"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>{shipmentMode === 'SEA' ? 'HBL Date' : shipmentMode === 'AIR' ? 'HAWB Date' : 'Truck Date'}</label>
              <ModernDatePicker name="autoField_25" className="input-field" style={{ flex: 1 }}  value={exportData["autoField_25"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>{shipmentMode === 'SEA' ? 'Vessel Name' : shipmentMode === 'AIR' ? 'Airline Name' : 'Transporter Name'}</label>
                <RichAutocomplete 
                  options={shipmentMode === 'SEA' ? vessels : airlines}
                  value={exportData["carrierName"]}
                  onChange={v => setExportData({...exportData, carrierName: v})}
                  onSelect={c => setExportData({...exportData, carrierName: shipmentMode === 'SEA' ? c.vesselName : c.name})}
                  searchFilter={(c, q) => {
                    const name = shipmentMode === 'SEA' ? c.vesselName : c.name;
                    return name?.toLowerCase()?.includes(q?.toLowerCase());
                  }}
                  renderOption={c => (
                    <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>
                      {shipmentMode === 'SEA' ? c.vesselName : c.name}
                    </div>
                  )}
                  placeholder={shipmentMode === 'SEA' ? 'VESSEL NAME' : shipmentMode === 'AIR' ? 'AIRLINE NAME' : 'TRANSPORTER NAME'}
                  inputStyle={{ border: '1px solid var(--primary-border)' }}
                />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', alignItems: 'center', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>SB Number</label>
              {/* one SB No for the whole system: SB Track / ICEGATE fill sbNo, the job list and dashboard read it (this box wrote sbNumber only) */}
              <input name="sbNumber" type="text" className="input-field" placeholder="SB NUMBER" maxLength={10} style={{ flex: 1 }} value={exportData["sbNo"] || exportData["sbNumber"] || ""} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setExportData(prev => ({ ...prev, sbNo: v, sbNumber: v })); }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>SB Date</label>
              <ModernDatePicker name="autoField_26" className="input-field" style={{ flex: 1 }}  value={(() => { const v = String(exportData["autoField_26"] || exportData["sbDate"] || ''); const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(v); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; })()} onChange={e => { const v = e.target.value; setExportData(prev => ({ ...prev, autoField_26: v, sbDate: v })); }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>EP Copy No</label>
              <input name="epCopyNo" type="text" className="input-field" placeholder="EP COPY NO" style={{ flex: 1 }} value={exportData["epCopyNo"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>EP Copy Date</label>
              <ModernDatePicker name="autoField_27" className="input-field" style={{ flex: 1 }}  value={exportData["autoField_27"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>GRN No</label>
              <input name="grnNo" type="text" className="input-field" placeholder="GRN NO" style={{ flex: 1 }} value={exportData["grnNo"] || ""} onChange={handleChange} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', alignItems: 'center', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>PO No.</label>
              <input name="poNo" type="text" className="input-field" placeholder="PO NO." style={{ flex: 1 }} value={exportData["poNo"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>Service Type</label>
              <input name="serviceType" type="text" className="input-field" placeholder="SERVICE TYPE" style={{ flex: 1 }} value={exportData["serviceType"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>Head Desc</label>
              <input name="headDesc" type="text" className="input-field" placeholder="HEAD DESC" style={{ flex: 1 }} value={exportData["headDesc"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>Refernce No1</label>
              <input name="referenceNo1" type="text" className="input-field" placeholder="REFERENCE NO1" style={{ flex: 1 }} value={exportData["referenceNo1"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>Packing Details</label>
              {/* Y / N + button that opens the list (a typed "Y" was the only way to open it again). 29-Oct-2026 */}
              <select className="input-field" value={packingFlag === 'Y' ? 'Y' : 'N'} onChange={(e) => handleFlagChange('packingFlag', setPackingFlag, setIsPackingModalOpen, e.target.value)} style={{ width: '58px' }}><option value="N">N</option><option value="Y">Y</option></select>
              <button type="button" className="btn btn-secondary" style={{ height: '26px', padding: '0 8px', fontSize: '11px' }} title="Open packing details" onClick={() => setIsPackingModalOpen(true)}>{(packingList || []).length ? `${packingList.length} row(s)` : 'Open'}</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', alignItems: 'center', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>{shipmentMode === 'SEA' ? 'Container Details' : 'ULD Details'}</label>
              <select className="input-field" value={containerFlag === 'Y' ? 'Y' : 'N'} onChange={(e) => handleFlagChange('containerFlag', setContainerFlag, setIsContainerModalOpen, e.target.value)} style={{ width: '58px' }}><option value="N">N</option><option value="Y">Y</option></select>
              <button type="button" className="btn btn-secondary" style={{ height: '26px', padding: '0 8px', fontSize: '11px' }} title="Open the list" onClick={() => setIsContainerModalOpen(true)}>{(containerList || []).length ? `${containerList.length} ${shipmentMode === 'SEA' ? 'cont.' : 'ULD'}` : 'Open'}</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px' }}>Refernce No2</label>
              <input name="referenceNo2" type="text" className="input-field" placeholder="REFERENCE NO2" style={{ flex: 1 }} value={exportData["referenceNo2"] || ""} onChange={handleChange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '130px' }}>ETP Details</label>
              <input type="text" className="input-field" value={etpFlag} onChange={(e) => handleFlagChange('etpFlag', setEtpFlag, setIsEtpModalOpen, e.target.value)} style={{ width: '40px', border: '1px solid var(--primary-border)', textAlign: 'center' }} />
            </div>
          </div>

        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '6px 1rem', background: 'var(--bg-panel, #e0f2fe)', marginTop: '4px', borderTop: '1px solid var(--border-color, #bae6fd)', justifyContent: 'center' }}>
        {/* Save = a new job (or Ctrl+S); Modify = changes of a job already saved. Both did the same before, and a
            second Save of a new job while the first was running made another job. 29-Oct-2026 */}
        <button className="btn btn-success" title={exportData.id ? 'This job is already saved - use Modify to save changes' : 'Save the new job (Ctrl+S)'} style={{ padding: '0.4rem 1rem', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', opacity: exportData.id ? 0.6 : 1 }}
          onClick={() => {
            if (exportData.id) { toast(`Job ${exportData.jobNo || ''} is already saved - use Modify to save your changes`, { icon: 'ℹ️' }); return; }
            window.dispatchEvent(new Event('export-save'));
          }}>
          <Save size={14} /> Save
        </button>
        <button className="btn btn-success" title={exportData.id ? 'Save the changes of this job (Ctrl+S)' : 'Save the job first'} style={{ padding: '0.4rem 1rem', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', opacity: exportData.id ? 1 : 0.6 }}
          onClick={() => {
            if (!exportData.id) { toast('This is a new job - click Save first', { icon: 'ℹ️' }); return; }
            window.dispatchEvent(new Event('export-save'));
          }}>
          <Edit size={14} /> Modify
        </button>
        <button className="btn btn-info" style={{ padding: '0.4rem 1rem', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
          onClick={() => {
            if (window.confirm(exportData.id ? `Clear the SB Header fields of job ${exportData.jobNo || ''}? The job stays; nothing is saved until you click Modify.` : 'Clear all SB Header fields?')) {
              // the job itself stays (id, job no, branch, filing details); before, Clear also dropped the job id and
              // job number, so the next Save made a second job
              setExportData(prev => {
                const keep = {};
                // 12-Nov-2026: + the SB-level rows that are not header fields (SW statements / SW info / exchange rows /
                // e-Sanchit of a job read from a file, e.g. the RS001 declarations) - Clear removed them
                ['id', 'jobNo', 'jobDate', 'branchId', 'financialYearId', 'status', 'invoices', 'sbNo', 'sbNumber', 'sbDate', 'icegateStatus', 'icegateUniqueId', 'isAmended', 'leoDate', 'enteredBy', '_statements', '_infoTypes', '_exchangeRates', 'eSanchitList', 'docketNo', 'createdAt'].forEach(k => { if (prev[k] !== undefined) keep[k] = prev[k]; });
                const mode = prev.shipmentMode || 'AIR';
                // defaults the screen shows are kept as values (see useExportHeaderTab)
                return { ...keep, shipmentMode: mode, jobDate: prev.jobDate || new Date().toISOString().split('T')[0], shipperClass: 'P', mercManuf: 'M', shipperGstinType: 'GSTIN', ...(mode === 'AIR' ? { natureOfCargo: 'P' } : {}) };
              });
              // the windows of this tab are cleared too (packing / container lists, flags, factory stuffed ...)
              setFactoryStuffed('No'); setPackingList([]); setContainerList([]); setPackingFlag('N'); setContainerFlag('N'); setEtpFlag('N');
              setEtpDetails({ JobNo: '', JobDate: '', SiteId: '', GatewayPort: '', StuffPort: '', CarrierCode: '', PortOfDischarge: '', CarrierNumber: '', BondCode: '', BondNumber: '', BondDate: '', BondSite: '', ExpTransShippmentDate: '', ExpTransShippmentNo: '', AirWayBillNo: '' });
              setNfeiCategory(''); setNfeiCategoryCode(''); setFactoryAddress('');
              toast.success(exportData.id ? 'SB Header cleared - click Modify to save' : 'SB Header cleared');
            }
          }}>
          <RefreshCw size={14} /> Clear
        </button>
      </div>
    </>
  );
}
