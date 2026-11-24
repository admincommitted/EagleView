// Screen section: Origin
// Split out of EFreightAWBForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Bell, Box, Calendar, ChevronDown, Edit2, MapPin, Plus, Trash2, Users } from 'lucide-react';
import React from 'react';
import { PartyAutosuggest, renderPartyDetails } from '../helpers';

export default function OriginSection({ ctx }) {
  const { inputStyle, labelStyle, register, routingStops, sectionHeaderStyle, sectionStyle, selectedConsignee, selectedNotify, selectedShipper, setRightSidebarMode, setRoutingStops, setSelectedConsignee, setSelectedNotify, setSelectedShipper, setShipmentType, setShowConsigneeDropdown, setShowDimsModal, setShowVolumeUnit, setShowWeightUnit, setVolumeUnit, setWeightUnit, shipmentType, showConsigneeDropdown, showVolumeUnit, showWeightUnit, theme, totalVolume, totalWeight, volWeight, volumeUnit, weightUnit } = ctx;
  return (
    <>
    {/* Main Form Section */}
          <div className='awb-card' style={sectionStyle}>
            
            {/* Row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Origin<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label>
                  <input {...register('origin')} list='airportsList'  className='mandatory-border' style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Destination<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label>
                  <input {...register('destination')} list='airportsList'  className='mandatory-border' style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Shipping Date<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input {...register('currency')} className='mandatory-border' style={inputStyle} list='currenciesList' />
                  <Calendar size={16} color={theme.primary} style={{ position: 'absolute', right: '10px', top: '9px' }} />
                </div>
              </div>
            </div>

            {/* Row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Commodity<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label>
                <input {...register('commodity')} className='mandatory-border' style={inputStyle} placeholder='Search Commodity...' />
              </div>
              <div>
                <label style={labelStyle}>Product<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label>
                <select className='mandatory-border' style={inputStyle}>
                    <option value="">Select</option>
                    <option value="ARP">ARP</option>
                    <option value="AIR">AIR</option>
                    <option value="AGC">AGC</option>
                  </select>
              </div>
              <div>
                <label style={labelStyle}>SCI</label>
                <select style={inputStyle}>
                  <option>Select the SCI</option>
                  <option>C</option>
                  <option>F</option>
                  <option>T1</option>
                  <option>T2</option>
                  <option>TD</option>
                  <option>TF</option>
                  <option>X</option>
                </select>
              </div>
            </div>

            {/* Row 3 - SHC */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '13px' }}>
              <span style={{ color: theme.textMuted }}>SHC <span style={{color:'#ef4444', marginLeft: '2px'}}>*</span> :</span>
              <input {...register('shc1')} list="sphList" style={{ border: '1px solid #d1d5db', padding: '2px 8px', borderRadius: '4px', width: '60px', textTransform: 'uppercase' }} placeholder="--" />
              <input {...register('shc2')} list="sphList" style={{ border: '1px solid #d1d5db', padding: '2px 8px', borderRadius: '4px', width: '60px', textTransform: 'uppercase' }} placeholder="--" />
              <span style={{ color: theme.primary, fontWeight: 'bold', cursor: 'pointer' }}>+Add More</span>
            </div>

            <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '0 -20px 20px -20px' }} />

            {/* Row 4 - Remarks & Handling */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
              <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{...labelStyle, margin:0, color: theme.textMain}}>Remarks</label>
                  <Edit2 size={14} color={theme.primary} style={{ cursor: 'pointer' }} onClick={() => setRightSidebarMode('remarks')} />
                </div>
                <div style={{ fontSize: '13px', color: theme.textMuted }}>GENERAL CARGO</div>
              </div>
              <div style={{ paddingLeft: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{...labelStyle, margin:0, color: theme.textMain}}>Handling Instructions</label>
                  <span style={{ color: theme.primary, fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setRightSidebarMode('remarks')}>+Add</span>
                </div>
              </div>
            </div>
            
          </div>

          {/* Shipment Description Section */}
            <div className='awb-card' style={sectionStyle}>
              
              <div style={sectionHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}><Box size={16} /> Shipment Description: <span style={{color: '#1f2937', fontWeight:'normal'}}>General Cargo</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="radio" name="shipmentType" checked={shipmentType === 'Loose'} onChange={() => setShipmentType('Loose')} style={{ accentColor: theme.primary }} /> Loose
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="radio" name="shipmentType" checked={shipmentType === 'ULD'} onChange={() => setShipmentType('ULD')} style={{ accentColor: theme.primary }} /> ULD
                  </label>
                  
                  {/* Units Dropdowns */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', fontSize: '14px', color: '#0284c7', gap: '8px', textTransform: 'uppercase' }}>
                    <span>Units:</span>
                    {(showWeightUnit || showVolumeUnit) && <div style={{ position: 'fixed', top: '70px', left: 0, right: 0, bottom: 0, zIndex: 90 }} onClick={() => { setShowWeightUnit(false); setShowVolumeUnit(false); }} />}
                    <div style={{ position: 'relative', zIndex: showWeightUnit ? 100 : 1 }}>
                      <div onClick={() => { setShowWeightUnit(!showWeightUnit); setShowVolumeUnit(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '65px', padding: '0 8px', height: '32px', background: 'white', border: '1px solid #0284c7', borderRadius: '4px', cursor: 'pointer', color: '#1f2937' }}>
                        {weightUnit} <ChevronDown size={14} color="#0284c7" />
                      </div>
                      {showWeightUnit && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, background: 'white', border: '1px solid #0284c7', borderRadius: '4px', width: '65px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', overflow: 'hidden', marginTop: '4px' }}>
                          {['kg', 'lbs', 'ton'].map(u => (
                            <div key={u} onClick={() => { setWeightUnit(u); setShowWeightUnit(false); }} style={{ padding: '6px 8px', cursor: 'pointer', background: weightUnit === u ? '#e11d48' : 'white', color: weightUnit === u ? 'white' : '#1f2937', fontSize: '13px' }}>{u}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ position: 'relative', zIndex: showVolumeUnit ? 100 : 1 }}>
                      <div onClick={() => { setShowVolumeUnit(!showVolumeUnit); setShowWeightUnit(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '70px', padding: '0 8px', height: '32px', background: 'white', border: '1px solid #0284c7', borderRadius: '4px', cursor: 'pointer', color: '#1f2937' }}>
                        {volumeUnit} <ChevronDown size={14} color="#0284c7" />
                      </div>
                      {showVolumeUnit && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, background: 'white', border: '1px solid #0284c7', borderRadius: '4px', width: '70px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', overflow: 'hidden', marginTop: '4px' }}>
                          {['cbm', 'cc', 'cft', 'cin', 'cyd'].map(u => (
                            <div key={u} onClick={() => { setVolumeUnit(u); setShowVolumeUnit(false); }} style={{ padding: '6px 8px', cursor: 'pointer', background: volumeUnit === u ? '#e11d48' : 'white', color: volumeUnit === u ? 'white' : '#1f2937', fontSize: '13px' }}>{u}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr', gap: '20px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>SHC</label>
                  <input {...register('natureOfGoodsSHC')} list="sphList" style={{ border: '1px solid #d1d5db', padding: '4px 12px', borderRadius: '4px', width: '80px', textTransform: 'uppercase', fontSize: '13px' }} placeholder="--" />
                </div>
                <div>
                  <label style={labelStyle}>Nature of Goods<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label>
                  <input {...register('natureOfGoods')}  className='mandatory-border' style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Harmonised Commodity Code</label>
                  <input style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1.5fr auto', gap: '16px', alignItems: 'end' }}>
                <div><label style={labelStyle}>Pieces<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label><input {...register('pieces')}  className='mandatory-border' style={inputStyle} /></div>
                <div><label style={labelStyle}>Weight<span style={{color:'#ef4444', marginLeft: '2px'}}>*</span></label><div style={{ position: 'relative' }}><input {...register('weight')}  className='mandatory-border' style={{...inputStyle, paddingRight:'30px'}} /><span style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af', fontSize:'12px' }}>{weightUnit}</span></div></div>
                <div><label style={labelStyle}>Volume</label><div style={{ position: 'relative' }}><input {...register('volume')} value={totalVolume ? totalVolume.toFixed(3) : ''} readOnly style={{...inputStyle, paddingRight:'30px', background: '#f9fafb'}} /><span style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af', fontSize:'12px' }}>{volumeUnit}</span></div></div>
                <div><label style={labelStyle}>SLAC Pieces</label><input style={inputStyle} /></div>
                <div><label style={labelStyle}>Chargeable Weight</label><div style={{ position: 'relative' }}><input style={{...inputStyle, background: '#e5e7eb', paddingRight:'30px'}} value={ctx.chargeableWeight || ''} readOnly title="Higher of weight and volumetric weight (IATA 6000 cm3/kg), rounded up to 0.5 kg" /><span style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af', fontSize:'12px' }}>{weightUnit}</span></div></div>
                <div style={{ color: '#e11d48', fontSize: '12px', cursor: 'pointer', marginBottom: '10px', fontWeight: 'bold' }} onClick={() => setShowDimsModal(true)}>View/Edit Dims.</div>
              </div>
            </div>

            {/* Routing Details */}
            <div className='awb-card' style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <div style={{display:'flex', alignItems:'center', gap:'8px'}}><MapPin size={18}/> Routing Details</div><ChevronDown size={18} color="#9ca3af" />
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                {routingStops.map((stop, index) => (
                  <React.Fragment key={index}>
                    <div><label style={labelStyle}>Carrier</label><input style={inputStyle} /></div>
                    <div><label style={labelStyle}>Destination</label><input style={{...inputStyle, background: '#f3f4f6'}} /></div>
                  </React.Fragment>
                ))}
                <div><label style={labelStyle}>Origin</label><input style={{...inputStyle, background: '#f3f4f6'}} /></div>
                <div><label style={labelStyle}>Carrier</label><input style={inputStyle} /></div>
                <div style={{ color: 'white', padding: '6px', borderRadius: '50%', cursor: 'pointer', marginTop: '14px', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setRoutingStops([...routingStops, {}])}><Plus size={16} /></div>
                <div><label style={labelStyle}>Destination</label><input style={{...inputStyle, background: '#f3f4f6'}} /></div>
              </div>
            </div>

            {/* Shipper/Consignee */}
          <div className='awb-card' style={{...sectionStyle, zIndex: 10}}>
            <div style={sectionHeaderStyle}>
              <div style={{display:'flex', alignItems:'center', gap:'8px'}}><Users size={18}/> Shipper/Consignee</div><ChevronDown size={18} color="#9ca3af" />
            </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                {/* Shipper */}
                <div>
                  <div style={{ color: '#0284c7', fontSize: '12px', marginBottom: '4px', textTransform: 'uppercase' }}>Shipper</div>
                  
                  {selectedShipper ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#1f2937', lineHeight: '1.4' }}>
                          {renderPartyDetails(selectedShipper)}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Edit2 size={16} color="#e11d48" style={{ cursor: 'pointer', border: '1px solid #e11d48', padding: '2px', borderRadius: '4px' }} onClick={() => setRightSidebarMode('shipper')} />
                          <Trash2 size={16} color="#e11d48" style={{ cursor: 'pointer', border: '1px solid #e11d48', padding: '2px', borderRadius: '4px' }} onClick={() => setSelectedShipper(null)} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                        <PartyAutosuggest type="SHIPPER" placeholder="Search Shipper by name..." onSelect={setSelectedShipper} />
                        <span style={{ color: '#0284c7', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '13px', marginTop: '6px', textTransform: 'uppercase', fontWeight: 'bold' }} onClick={() => setRightSidebarMode('shipper')}>+ New</span>
                      </div>
                    )}
                </div>

                {/* Consignee */}
                <div>
                  <div style={{ color: '#0284c7', fontSize: '12px', marginBottom: '4px', textTransform: 'uppercase' }}>Consignee</div>
                  
                  {selectedConsignee ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#1f2937', lineHeight: '1.4' }}>
                          {renderPartyDetails(selectedConsignee)}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Edit2 size={16} color="#e11d48" style={{ cursor: 'pointer', border: '1px solid #e11d48', padding: '2px', borderRadius: '4px' }} onClick={() => setRightSidebarMode('consignee')} />
                          <Trash2 size={16} color="#e11d48" style={{ cursor: 'pointer', border: '1px solid #e11d48', padding: '2px', borderRadius: '4px' }} onClick={() => setSelectedConsignee(null)} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                        <PartyAutosuggest type="CONSIGNEE" placeholder="Search Consignee by name..." onSelect={setSelectedConsignee} />
                        <span style={{ color: '#0284c7', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '13px', marginTop: '6px', textTransform: 'uppercase', fontWeight: 'bold' }} onClick={() => setRightSidebarMode('consignee')}>+ New</span>
                      </div>
                    )}
                </div>
              </div>
            </div>

            {/* Notify Details */}
            <div className='awb-card' style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <div style={{display:'flex', alignItems:'center', gap:'8px', textTransform: 'uppercase'}}><Bell size={18}/> Notify Details</div><ChevronDown size={18} color="#9ca3af" />
              </div>
              
              {selectedNotify ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '12px', color: '#1f2937', display: 'grid', gridTemplateColumns: '1.5fr 2fr 1.5fr', gap: '20px', width: '100%' }}>
                    <div>
                      <strong>ABDOS LAMITUBES MANUFACTURING LLC (C1001)</strong>
                    </div>
                    <div style={{ color: '#6b7280', textTransform: 'uppercase' }}>
                      INDUSTRIAL AREA, UMM AL QUWAIN PLOT NO.2, SHED 5 6, UAE, DUBAI, POSTAL CODE: 146
                    </div>
                    <div style={{ color: '#0284c7', textTransform: 'uppercase' }}>
                      PHONE: 971522653327
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginLeft: '20px' }}>
                    <Edit2 size={16} color="#e11d48" style={{ cursor: 'pointer', border: '1px solid #e11d48', padding: '2px', borderRadius: '4px' }} onClick={() => setRightSidebarMode('notify')} />
                    <Trash2 size={16} color="#e11d48" style={{ cursor: 'pointer', border: '1px solid #e11d48', padding: '2px', borderRadius: '4px' }} onClick={() => setSelectedNotify(false)} />
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '16px', width: '30%' }}>
                  <div style={{ color: '#1f2937', fontSize: '12px', marginBottom: '4px', textTransform: 'uppercase' }}>Notify</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <div 
                        onClick={() => setShowConsigneeDropdown(!showConsigneeDropdown)}
                        style={{ ...inputStyle, borderColor: '#d1d5db', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        Select <ChevronDown size={14} color="#6b7280" />
                      </div>
                      {showConsigneeDropdown && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d5db', borderRadius: '0 0 4px 4px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                          <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={() => { setShowConsigneeDropdown(false); setSelectedNotify(true); }}>
                            <div style={{ color: '#1f2937', fontSize: '13px', marginBottom: '4px' }}>ABDOS LAMITUBES MANUFACTURING LLC</div>
                            <div style={{ color: '#e11d48', fontSize: '12px' }}>C1001</div>
                          </div>
                        </div>
                      )}
                    </div>
                    <span style={{ color: '#0284c7', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '13px', textTransform: 'uppercase' }} onClick={() => setRightSidebarMode('notify')}>+ New</span>
                  </div>
                </div>
              )}
            </div>
    </>
  );
}
