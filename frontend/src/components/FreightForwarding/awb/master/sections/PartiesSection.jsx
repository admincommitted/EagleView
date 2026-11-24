// Form section: Party Details
// Split out of CreateMasterWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import FieldAutocomplete from '../../../../FieldAutocomplete';
import React from 'react';
import { loadStockSuggest } from '../../awbStockSuggest';
import ReactDOM from 'react-dom';
import { showSuccessToast } from '../../../printLogic';
import PartyRow from '../PartyRow';

export default function PartiesSection({ ctx }) {
  const { accountingInfo, agentDetails, airlineCode, airlineName, awbDropList, awbDropdownRef, awbFocusedIndex, awbPrefix, awbSuffix, awbSuffixInputRef, linkedHawbs, parties, setAccountingInfo, setAddPartyTitle, setAgentDetails, setAwbDropList, setAwbFocusedIndex, setAwbPrefix, setAwbSuffix, setOciRows, setParties, setShowAddParty, setShowAwbDrop, setShowLinkHawb, setShowSubAgentMaster, showAwbDrop } = ctx;
  // 22-Nov-2026: the IATA agent (name, code, place, account) shows as a short card like Shipper; "Edit agent" opens
  // the four boxes. With no agent name the boxes are open. Docs and Accounting Info stay open. Screen only.
  const [agentEdit, setAgentEdit] = React.useState(false);
  const pName = (t) => String((parties && parties[t] && parties[t].name) || '').trim();
  // 22-Nov-2026: optional parties are not drawn until used; "+ Buyer" etc. in the "Other parties" line opens one
  const [openP, setOpenP] = React.useState({});
  const closeP = (t) => setOpenP(o => ({ ...o, [t]: false }));
  const freeP = ['Buyer', 'Sub Agent', 'Overseas Agent', 'Notify 1', 'Notify 2'].filter(t => !pName(t) && !openP[t] && (t !== 'Notify 2' || pName('Notify 1')));
  const agentHasName = String((agentDetails && agentDetails.name) || '').trim() !== '';
  const agentShowForm = agentEdit || !agentHasName;
  return (
    <>
    {/* Section Header */}

          <div style={{ backgroundColor: 'var(--primary-bg-light, #fce7f3)', borderLeft: '4px solid var(--primary-color-start, #ec4899)', color: '#334155', padding: '6px 12px', borderBottom: '1px solid #94a3b8', fontSize: '13px', fontWeight: '800' }}>

            Party Details

          </div>

          

          <div style={{ display: 'flex', flexDirection: 'column' }}>

            

            {/* Top row: AWB NO and HAWB NO */}
  
              <div style={{ display: 'grid', gridTemplateColumns: 'auto calc(50% - 91px) 99px 1fr', borderBottom: '1px solid var(--lg-line, #bae6fd)' }}>
  
                <div style={{ padding: '4px 10px 4px 2px', backgroundColor: 'transparent', fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center' }}>
                  MAWB NO<span style={{ color: '#dc2626', marginLeft: '2px' }}>*</span>
                </div>
  
                <div style={{ padding: '4px', borderRight: '1px solid #94a3b8', display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="text" autoComplete="off" value={awbPrefix} maxLength={3} onChange={(e) => setAwbPrefix(e.target.value.replace(/[^0-9]/g, ''))} className="premium-input" placeholder="prefix" style={{ width: '52px', height: '24px', boxSizing: 'border-box', padding: '0 6px', fontSize: '12px', fontWeight: 600, border: `1px solid ${awbPrefix ? '#64748b' : '#ef4444'}`, borderRadius: '4px', outline: 'none', backgroundColor: '#ffffff', textAlign: 'center', letterSpacing: '1px' }} />
                    <span style={{ fontWeight: 'bold', color: 'var(--text-main, #0f172a)', margin: '0 2px' }}>-</span>
                    {/* AWB Suffix with multiline autofill */}
                    <div style={{ position: 'relative' }}>
                      <input
                        ref={awbSuffixInputRef}
                        type="text" autoComplete="off"
                        value={awbSuffix} maxLength={8}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setAwbSuffix(val);
                          setAwbFocusedIndex(-1);
                          loadStockSuggest(awbPrefix, val, setAwbDropList, setShowAwbDrop); // only this airline's unused stock
                        }}
                        onKeyDown={(e) => {
                              if (!showAwbDrop || awbDropList.length === 0) return;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setAwbFocusedIndex(prev => (prev < awbDropList.length - 1 ? prev + 1 : prev));
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setAwbFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (awbFocusedIndex >= 0 && awbFocusedIndex < awbDropList.length) {
                                  const a = awbDropList[awbFocusedIndex];
                                  if (a.status === 'TRANSMITTED' || a.transmissionStatus === 'TRANSMITTED') {
                                     showSuccessToast('Error', 'AWB is already TRANSMITTED and cannot be selected/edited!', true);
                                  } else {
                                     const parts = (a.awbNumber || '').split('-');
                                     if (parts[0]) setAwbPrefix(parts[0]);
                                     if (parts[1]) setAwbSuffix(parts[1]);
                                     setShowAwbDrop(false);
                                     setAwbFocusedIndex(-1);
                                  }
                                }
                              }
                            }}
                        onFocus={() => { if (/^\d{3}$/.test(awbPrefix || '')) loadStockSuggest(awbPrefix, awbSuffix, setAwbDropList, setShowAwbDrop); else setShowAwbDrop(false); }}
                        onBlur={() => setTimeout(() => setShowAwbDrop(false), 200)}
                        className="premium-input"
                        placeholder="8-digit no."
                        style={{ width: '104px', height: '24px', boxSizing: 'border-box', padding: '0 8px', fontSize: '12px', fontWeight: 600, border: `1px solid ${awbSuffix ? '#64748b' : '#ef4444'}`, borderRadius: '4px', outline: 'none', backgroundColor: '#ffffff', letterSpacing: '1px' }}
                      />
                      {showAwbDrop && awbDropList.length > 0 && ReactDOM.createPortal(
                        <div ref={awbDropdownRef} style={{
                          position: 'fixed', top: 0, left: 0, width: 320,
                          zIndex: 99, backgroundColor: 'white',
                          border: '2px solid #1e3a8a', borderRadius: '6px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                          maxHeight: '200px', overflowY: 'auto'
                        }}>
                          {awbDropList.length > 0 ? awbDropList.map((a, idx) => {
                                const isActive = awbFocusedIndex === idx;
                                const isTrans = a.status === 'TRANSMITTED' || a.transmissionStatus === 'TRANSMITTED';
                                const displayStatus = a.status === 'AVAILABLE STOCK' ? 'AVAILABLE' : (a.status || 'ACTIVE');
                                const displayString = `${a.awbNumber || ''} - ${displayStatus} - ${a.shipperName || 'UNUSED'}`;
                              return (
                                    <div key={idx}
                                    style={{
                                      padding: '6px 8px', 
                                      cursor: isTrans ? 'not-allowed' : 'pointer', 
                                      opacity: isTrans ? 0.6 : 1,
                                      backgroundColor: isActive ? '#2563eb' : 'white',
                                      color: isActive ? 'white' : '#1e3a8a',
                                      fontSize: '12px',
                                      borderBottom: '1px solid #f1f5f9',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}
                                    onMouseEnter={() => setAwbFocusedIndex(idx)}
                                    onMouseLeave={() => setAwbFocusedIndex(-1)}
                                    onMouseDown={() => { 
                                      if (isTrans) { 
                                        showSuccessToast('Error', 'AWB is already TRANSMITTED!', true); 
                                      } else { 
                                        if (typeof selectAwb === 'function') {
                                          selectAwb(a);
                                        } else {
                                          const parts = (a.awbNumber || '').split('-');
                                          if (parts[0]) setAwbPrefix(parts[0]);
                                          if (parts[1]) setAwbSuffix(parts[1]);
                                          setShowAwbDrop(false);
                                        }
                                      } 
                                    }}
                                  >
                                    {displayString}
                                  </div>);
                                }) : <div style={{ padding: '8px 12px', fontSize: '12px', color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>No AWB numbers found</div>}
                          </div>,
                          document.body
                      )}
                    </div>
                    {airlineName && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        color: 'var(--text-muted, #475569)',
                        fontWeight: 600, fontSize: '11px',
                        marginLeft: '6px', whiteSpace: 'nowrap'
                      }}>
                        {airlineCode ? (
                          <img
                            src={`https://www.gstatic.com/flights/airline_logos/70px/${airlineCode}.png`}
                            alt={airlineName}
                            onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='inline'; }}
                            style={{ width: '18px', height: '18px', boxSizing: 'border-box', borderRadius: '2px', objectFit: 'contain', flexShrink: 0 }}
                          />
                        ) : null}
                        <span style={{ display: airlineCode ? 'none' : 'inline' }}>&#x2708;</span>
                        {airlineName}
                      </span>
                    )}
                  </div>
                </div>
  
                <div style={{ padding: '8px', backgroundColor: '#ffffff', borderRight: '1px solid #94a3b8', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center' }}>
                  HAWB NO
                </div>
  
                <div style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <button onClick={() => setShowLinkHawb(true)} style={{ background: 'var(--primary-color-start, #0284c7)', color: 'white', border: '1px solid #0369a1', borderRadius: '4px', padding: '0 16px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', height: '24px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}>
                      View / Link HAWBs ({linkedHawbs.length})
                  </button>
  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '8px', marginLeft: 'auto' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Reference Number:</label>
                    <input type="text" autoComplete="off" className="premium-input" style={{ width: '150px', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', borderRadius: '2px', outline: 'none', textTransform: 'uppercase' }} placeholder="Optional Info" />
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px 16px', padding: '14px 16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #94a3b8', alignItems: 'stretch' }}>

              <PartyRow title="Shipper" isMandatory={true} hasSelf={true} onAddClick={() => { setAddPartyTitle('Add Shipper Details'); setShowAddParty(true); }}  data={parties["Shipper"]} onChange={(d) => setParties(p => ({...p, "Shipper": d}))} />

              <PartyRow title="Consignee" isMandatory={true} onAddClick={() => { setAddPartyTitle('Add Consignee Details'); setShowAddParty(true); }}  data={parties["Consignee"]} onChange={(d) => setParties(p => ({...p, "Consignee": d}))} />

              <PartyRow title="Buyer" compact forceOpen={!!openP["Buyer"]} onClose={() => closeP("Buyer")} hasSameAsCnee={true} cneeData={parties["Consignee"]} onAddClick={() => { setAddPartyTitle('Add Buyer Details'); setShowAddParty(true); }}  data={parties["Buyer"]} onChange={(d) => setParties(p => ({...p, "Buyer": d}))} />

              <PartyRow title="Sub Agent" compact forceOpen={!!openP["Sub Agent"]} onClose={() => closeP("Sub Agent")} hasSelf={true} onAddClick={() => setShowSubAgentMaster(true)}  data={parties["Sub Agent"]} onChange={(d) => setParties(p => ({...p, "Sub Agent": d}))} />

              <PartyRow title="Overseas Agent" compact forceOpen={!!openP["Overseas Agent"]} onClose={() => closeP("Overseas Agent")} onAddClick={() => { setAddPartyTitle('Add Overseas Agent Details'); setShowAddParty(true); }}  data={parties["Overseas Agent"]} onChange={(d) => setParties(p => ({...p, "Overseas Agent": d}))} />

              <PartyRow title="Notify 1" compact forceOpen={!!openP["Notify 1"]} onClose={() => closeP("Notify 1")} hasSameAsCnee={true} cneeData={parties["Consignee"]} onAddClick={() => { setAddPartyTitle('Add Notify 1 Details'); setShowAddParty(true); }}  data={parties["Notify 1"]} onChange={(d) => setParties(p => ({...p, "Notify 1": d}))} />

              {/* 22-Nov-2026: Notify 2 shows only after Notify 1 is added (or when it already has a name) */}
              {(pName("Notify 1") || pName("Notify 2")) && <PartyRow title="Notify 2" compact forceOpen={!!openP["Notify 2"] && !!pName("Notify 1")} onClose={() => closeP("Notify 2")} hasSameAsCnee={true} cneeData={parties["Consignee"]} onAddClick={() => { setAddPartyTitle('Add Notify 2 Details'); setShowAddParty(true); }}  data={parties["Notify 2"]} onChange={(d) => setParties(p => ({...p, "Notify 2": d}))} />}

              

              {/* Agent Details Card (Next to Notify) */}
                <div style={{ minWidth: 0, border: '1px solid #94a3b8', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(15,23,42,0.08)' }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '38px', boxSizing: 'border-box' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>IATA Agent Details</span>
                    {agentHasName && <button type="button" tabIndex={-1} onClick={() => setAgentEdit(v => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--theme-base, #0284c7)', whiteSpace: 'nowrap' }}>{agentShowForm ? 'Done' : 'Edit'}</button>}
                  </div>
                  
                  <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {agentShowForm ? (
                    <div onFocus={() => setAgentEdit(true)} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* Name */}
                    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: '8px', alignItems: 'center' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>Name</label>
                      <FieldAutocomplete
  listType="iata-agent"
  value={agentDetails.name}
  onChange={e => setAgentDetails({...agentDetails, name: e.target.value})}
  onSelect={opt => {
      setAgentDetails(prev => ({...prev, name: opt.title, code: opt.iataCode || opt.title, place: opt.place || ''}));
      
      const agentEori = opt.taxId || opt.vat || opt.eori || opt.panNumber || '';
      if (agentEori) {
          const ccode = (opt.country || opt.countryCode || 'IN').substring(0,2).toUpperCase();
          setOciRows(prev => {
              const currentRows = [...(prev || [])];
              const existingAgt = currentRows.find(cr => cr.infoId === 'AGT' && cr.customsId === 'E');
              if (existingAgt) {
                  existingAgt.suppInfo = agentEori;
              } else {
                  currentRows.push({ id: Date.now() + 104, countryCode: ccode, infoId: 'AGT', customsId: 'E', suppInfo: agentEori });
              }
              return currentRows;
          });
      }
    }}
  placeholder="IATA AGENT NAME..."
  className="premium-input"
  style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px' }}
/>
                      
                    </div>
                    
                    {/* Code & Place */}
                    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr 40px 80px', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>Code</label>
                      <input type="text" value={agentDetails.code} onChange={e => setAgentDetails({...agentDetails, code: e.target.value.toUpperCase()})} autoComplete="off" className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', borderRadius: '2px', outline: 'none', textTransform: 'uppercase' }} />
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', textAlign: 'right' }}>Place</label>
                      <input type="text" value={agentDetails.place} onChange={e => setAgentDetails({...agentDetails, place: e.target.value.toUpperCase()})} autoComplete="off" className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', borderRadius: '2px', outline: 'none', textTransform: 'uppercase' }} />
                    </div>
                    
                    {/* Account Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>Account</label>
                      <input type="text" value={agentDetails.account} onChange={e => setAgentDetails({...agentDetails, account: e.target.value.toUpperCase()})} autoComplete="off" className="premium-input" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', borderRadius: '2px', outline: 'none', textTransform: 'uppercase' }} />
                    </div>
                    
                    </div>
                    ) : (
                    <div style={{ fontSize: '12px', lineHeight: 1.55 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>{agentDetails.name}</div>
                      <div style={{ color: 'var(--text-muted, #475569)' }}>{[agentDetails.code && ('IATA code ' + agentDetails.code), agentDetails.place && ('Place ' + agentDetails.place), agentDetails.account && ('Account ' + agentDetails.account)].filter(Boolean).join(' \u00b7 ') || 'IATA code not filled'}</div>
                    </div>
                    )}
                    {/* Docs */}
                    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>Docs</label>
                      <select value={agentDetails.docs} onChange={e => setAgentDetails({...agentDetails, docs: e.target.value})} className="premium-input" style={{ width: '100%', maxWidth: '280px', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', borderRadius: '2px', outline: 'none' }}>
                        <option>SHIPMENT WITH DOCUMENTS</option>
                        <option>SHIPMENT WITHOUT DOCUMENTS</option>
                      </select>
                    </div>



                    {/* Accounting Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: '8px', alignItems: 'flex-start', marginTop: '2px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', marginTop: '4px' }}>Accounting Info</label>
                      <div style={{ maxWidth: '280px' }}>
                        <textarea value={accountingInfo} onChange={e => setAccountingInfo(e.target.value.toUpperCase())} className="premium-input" placeholder="E.G. FREIGHT PREPAID" rows="2" style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: '1px solid #94a3b8', boxSizing: 'border-box', height: '24px', borderRadius: '2px', outline: 'none', resize: 'none', textTransform: 'uppercase', fontFamily: 'monospace', backgroundColor: '#ffffff' }} />
                        <div style={{ fontSize: '9px', color: 'var(--text-muted, var(--text-muted, #64748b))', textAlign: 'right', marginTop: '2px', fontWeight: 'bold' }}>
                          0/6 LINES (MAX 34 CHARS/LINE)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {freeP.length > 0 && (
                <div className="awb-more-parties" style={{ minWidth: 0, alignSelf: 'start', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 14px', minHeight: '26px', padding: '2px 8px', boxSizing: 'border-box', border: '1px solid var(--lg-line, #bae6fd)', borderRadius: '3px', backgroundColor: 'var(--bg-panel, #ffffff)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--lg-head, #0f4c6e)' }}>Other parties</span>
                  {freeP.map(t => <button key={t} type="button" onClick={() => setOpenP(o => ({ ...o, [t]: true }))} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--theme-base, #0284c7)', whiteSpace: 'nowrap' }}>+ {t}</button>)}
                </div>
                )}

            </div>

          </div>



      {/* Flight Bookings / Routing */}

      <div style={{ backgroundColor: 'var(--primary-bg-light, #fce7f3)', borderLeft: '4px solid var(--primary-color-start, #ec4899)', color: '#334155', padding: '6px 12px', borderBottom: '1px solid #94a3b8', fontSize: '13px', fontWeight: '800' }}>

            Flight Bookings / Routing and Charge Declarations

          </div>
    </>
  );
}
