// Form section: OK / DISMISS
// Split out of CreateMasterWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import PersistedDoc, { saveExtraDoc } from '../../PersistedDoc';
import AWBVaultModal from '../../../AWBVaultModal';
import AddPartyModal from '../../../Modals/AddPartyModal';
import BookingConfirmationModal from '../../../Modals/BookingConfirmationModal';
import CCAModal from '../../../Modals/CCAModal';
import CargoLabelModal from '../../../Modals/CargoLabelModal';
import CargoManifestModal from '../../../Modals/CargoManifestModal';
import CertificateOfOriginModal from '../../../Modals/CertificateOfOriginModal';
import CommodityModal from '../../../Modals/CommodityModal';
import DGDeclarationModal from '../../../Modals/DGDeclarationModal';
import DeliveryOrderModal from '../../../Modals/DeliveryOrderModal';
import DimensionModal from '../../../Modals/DimensionModal';
import DueAgentChargesModal from '../../../Modals/DueAgentChargesModal';
import DueCarrierChargesModal from '../../../Modals/DueCarrierChargesModal';
import HSCodeModal from '../../../Modals/HSCodeModal';
import HandlingCodeModal from '../../../Modals/HandlingCodeModal';
import LithiumBatteryModal from '../../../Modals/LithiumBatteryModal';
import LiveAnimalCertModal from '../../../Modals/LiveAnimalCertModal';
import ModifyPromptModal from '../../../Modals/ModifyPromptModal';
import OverseasAgentModal from '../../../Modals/OverseasAgentModal';
import PrintOptionsModal from '../../../Modals/PrintOptionsModal';
import RateLineModal from '../../../Modals/RateLineModal';
import React from 'react';
import SLIModal from '../../../Modals/SLIModal';
import SecurityDeclarationModal from '../../../Modals/SecurityDeclarationModal';
import SubAgentModal from '../../../Modals/SubAgentModal';
import TemperatureControlModal from '../../../Modals/TemperatureControlModal';

import { AwbLogsModal } from '../../awbActions';

export default function DialogsSection({ ctx }) {
  const { activeRowIndex, addPartyTitle, awbNo, currentAwbId, destAirport, draftConfirmOpen, executedDate, flightDate1, flightNumber1, flightTime1, handleAutoFill, handleDimensionSave, handleDiscardDraft, handleGridChange, handleLinkHawb, handleModifyAWB, handlePrintOptionsSubmit, handleRequestAddParty, handleRestoreDraft, hawbSearchText, hsCodeTargetIndex, linkedHawbs, natureOfGoods, rateLines, setHawbSearchText, setLinkedHawbs, setRateLines, setShowAddParty, setShowAvi, setShowAwbVault, setShowBooking, setShowCca, setShowCommodity, setShowCoo, setShowCsd, setShowDgd, setShowDimension, setShowDo, setShowDueAgent, setShowDueCarrier, setShowHSCode, setShowHandling, setShowLabel, setShowLinkHawb, setShowLithium, setShowManifest, setShowModifyModal, setShowOverseasMaster, setShowPrintOptions, setShowRateLine, setShowSli, setShowSubAgentMaster, setShowTemp, setUiModal, setVolume, showAddParty, showAvi, showAwbVault, showBooking, showCca, showCommodity, showCoo, showCsd, showDgd, showDimension, showDo, showDueAgent, showDueCarrier, showHSCode, showHandling, showLabel, showLinkHawb, showLithium, showManifest, showModifyModal, showOverseasMaster, showPrintOptions, showRateLine, showSli, showSubAgentMaster, showTemp, tempAwbId, uiModal } = ctx;
  return (
    <>
    <AwbLogsModal open={ctx.showLogsModal} logs={ctx.logsData} onClose={() => ctx.setShowLogsModal(false)} />
    <PersistedDoc docType="DGD" isOpen={showDgd} extraDocs={ctx.extraDocs} setExtraDocs={ctx.setExtraDocs} awbId={currentAwbId} awbType="MAWB"><DGDeclarationModal isOpen={showDgd} onClose={() => setShowDgd(false)} awbNumber={awbNo} awbId={currentAwbId} awbType="MAWB" /></PersistedDoc>
      <PersistedDoc docType="AVI" isOpen={showAvi} extraDocs={ctx.extraDocs} setExtraDocs={ctx.setExtraDocs} awbId={currentAwbId} awbType="MAWB"><LiveAnimalCertModal isOpen={showAvi} onClose={() => setShowAvi(false)} awbNumber={awbNo} awbId={currentAwbId} awbType="MAWB" /></PersistedDoc>
      <PersistedDoc docType="CSD" isOpen={showCsd} extraDocs={ctx.extraDocs} setExtraDocs={ctx.setExtraDocs} awbId={currentAwbId} awbType="MAWB"><SecurityDeclarationModal isOpen={showCsd} onClose={() => setShowCsd(false)} awbNumber={awbNo} awbId={currentAwbId} awbType="MAWB" /></PersistedDoc>
            <PersistedDoc docType="LITHIUM" isOpen={showLithium} extraDocs={ctx.extraDocs} setExtraDocs={ctx.setExtraDocs} awbId={currentAwbId} awbType="MAWB"><LithiumBatteryModal isOpen={showLithium} onClose={() => setShowLithium(false)} awbNumber={awbNo} awbId={currentAwbId} awbType="MAWB" /></PersistedDoc>
      <PersistedDoc docType="COO" isOpen={showCoo} extraDocs={ctx.extraDocs} setExtraDocs={ctx.setExtraDocs} awbId={currentAwbId} awbType="MAWB"><CertificateOfOriginModal isOpen={showCoo} onClose={() => setShowCoo(false)} awbNumber={awbNo} awbId={currentAwbId} awbType="MAWB" /></PersistedDoc>
      <PersistedDoc docType="LABEL" isOpen={showLabel} extraDocs={ctx.extraDocs} setExtraDocs={ctx.setExtraDocs} awbId={currentAwbId} awbType="MAWB"><CargoLabelModal isOpen={showLabel} onClose={() => setShowLabel(false)} awbNumber={awbNo} awbId={currentAwbId} awbType="MAWB" /></PersistedDoc>
      <PersistedDoc docType="BOOKING" isOpen={showBooking} extraDocs={ctx.extraDocs} setExtraDocs={ctx.setExtraDocs} awbId={currentAwbId} awbType="MAWB"><BookingConfirmationModal isOpen={showBooking} onClose={() => setShowBooking(false)} awbNumber={awbNo} awbId={currentAwbId} awbType="MAWB" /></PersistedDoc>
      <PersistedDoc docType="CCA" isOpen={showCca} extraDocs={ctx.extraDocs} setExtraDocs={ctx.setExtraDocs} awbId={currentAwbId} awbType="MAWB"><CCAModal isOpen={showCca} onClose={() => setShowCca(false)} awbNumber={awbNo} awbId={currentAwbId} awbType="MAWB" /></PersistedDoc>
      <PersistedDoc docType="TEMP" isOpen={showTemp} extraDocs={ctx.extraDocs} setExtraDocs={ctx.setExtraDocs} awbId={currentAwbId} awbType="MAWB"><TemperatureControlModal isOpen={showTemp} onClose={() => setShowTemp(false)} awbNumber={awbNo} awbId={currentAwbId} awbType="MAWB" /></PersistedDoc>
      <PersistedDoc docType="MANIFEST" isOpen={showManifest} extraDocs={ctx.extraDocs} setExtraDocs={ctx.setExtraDocs} awbId={currentAwbId} awbType="MAWB"><CargoManifestModal
        isOpen={showManifest}
        onClose={() => setShowManifest(false)}
        awbNumber={awbNo}
        mawbData={{
            consigneeName: '',
            destination: destAirport || '',
            flightNumber1: flightNumber1 || '',
            flightDate1: flightDate1 ? (flightTime1 ? flightDate1 + 'T' + flightTime1 : flightDate1 + 'T00:00:00') : '',
            status: 'ACTIVE',
            executedDate: executedDate || ''
          }}
      /></PersistedDoc>
      <PersistedDoc docType="SLI" isOpen={showSli} extraDocs={ctx.extraDocs} setExtraDocs={ctx.setExtraDocs} awbId={currentAwbId} awbType="MAWB"><SLIModal isOpen={showSli} onClose={() => setShowSli(false)} awbNumber={awbNo} awbId={currentAwbId} awbType="MAWB" /></PersistedDoc>
      <PersistedDoc docType="DO" isOpen={showDo} extraDocs={ctx.extraDocs} setExtraDocs={ctx.setExtraDocs} awbId={currentAwbId} awbType="MAWB"><DeliveryOrderModal isOpen={showDo} onClose={() => setShowDo(false)} awbNumber={awbNo} awbId={currentAwbId} awbType="MAWB" /></PersistedDoc>
    
      
    
      {uiModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '450px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '16px', backgroundColor: uiModal.type === 'error' ? '#ffffff' : '#f0fdf4', borderBottom: `1px solid ${uiModal.type === 'error' ? '#ffe4e6' : '#22c55e'}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: uiModal.type === 'error' ? '#e11d48' : '#16a34a', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>!</div>
              <h3 style={{ margin: 0, color: uiModal.type === 'error' ? '#9f1239' : '#166534', fontSize: '14px', fontWeight: 'bold' }}>{uiModal.title}</h3>
            </div>
            <div style={{ padding: '24px', textAlign: 'left', color: '#334155', fontSize: '13px', whiteSpace: 'pre-line', maxHeight: '60vh', overflowY: 'auto' }}>
              {uiModal.message}
            </div>
            <div style={{ padding: '12px 24px', backgroundColor: '#ffffff', borderTop: '1px solid #94a3b8', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setUiModal({ ...uiModal, isOpen: false })} style={{ padding: '8px 24px', backgroundColor: 'var(--text-main, var(--text-main, #0f172a))', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>OK / DISMISS</button>
            </div>
          </div>
        </div>
      )}

{draftConfirmOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '24px', width: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #1e293b))', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>📝</span> Draft Found
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '24px', lineHeight: '1.5' }}>
              An unsaved draft of an Airway Bill was found. Would you like to restore it and continue working, or discard it?
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={handleDiscardDraft} style={{ padding: '8px 16px', backgroundColor: 'var(--primary-bg-light, #fce7f3)', color: 'var(--text-muted, var(--text-muted, #475569))', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Discard</button>
              <button onClick={handleRestoreDraft} style={{ padding: '8px 16px', backgroundColor: 'var(--primary-color-end, #2563eb)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Restore Draft</button>
            </div>
          </div>
        </div>
      )}

      {showAwbVault && (
        <AWBVaultModal awbId={currentAwbId} awbType="MAWB" tempAwbId={tempAwbId} awbNumber={awbNo} onClose={() => setShowAwbVault(false)} onAutoFill={handleAutoFill} onRequestAddParty={handleRequestAddParty} />
      )}


      <PrintOptionsModal 
        isOpen={showPrintOptions} 
        onClose={() => setShowPrintOptions(false)} 
        onPrint={handlePrintOptionsSubmit} 
      />

      <ModifyPromptModal 
        isOpen={showModifyModal} 
        onClose={() => setShowModifyModal(false)} 
        onSubmit={handleModifyAWB} 
        type="MAWB" 
      />

      {showLinkHawb && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '700px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px' }}>Link / Manage House Waybills (HAWBs)</h3>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input 
                type="text" 
                value={hawbSearchText}
                onChange={(e) => setHawbSearchText(e.target.value)}
                placeholder="Enter HAWB Number to Link..." 
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #94a3b8', borderRadius: '4px' }}
              />
              <button 
                type="button"
                onClick={() => handleLinkHawb(ctx.awbPrefix && ctx.awbSuffix ? `${ctx.awbPrefix}-${ctx.awbSuffix}` : '')}
                style={{ padding: '8px 16px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                + LINK HAWB
              </button>
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>HAWB No</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>PCS / WT / VOL</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>Org-Dest</th>
                    <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #cbd5e1' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedHawbs.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No HAWBs linked to this MAWB yet.</td></tr>
                  ) : (
                    linkedHawbs.map((h, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{h.awb}</td>
                        <td style={{ padding: '8px' }}>{h.pcs} PCS / {h.wt} KG / {h.vol} MC</td>
                        <td style={{ padding: '8px' }}>{h.org} - {h.dest}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                           <button 
                             onClick={async () => {
                               // 29-Oct-2026: unlink in the database too (before only the list on screen changed)
                               // 11-Nov-2026: a house linked here and not saved yet only leaves the list (before, the server was asked
                               // to take it off ITS master, which failed); a saved one is unlinked in the database
                               if (h.id && currentAwbId && !h.local) {
                                 if (!window.confirm(`Unlink HAWB ${h.awb} from this MAWB?`)) return;
                                 try {
                                   const token = localStorage.getItem('token');
                                   const res = await fetch(`/api/awb/hawb/${h.id}/unlink`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ masterAwbNumber: ctx.awbPrefix && ctx.awbSuffix ? `${ctx.awbPrefix}-${ctx.awbSuffix}` : awbNo }) }); // with the dash, as saved (11-Nov-2026: "15720000050" never matched, every UNLINK failed)
                                   const d = await res.json().catch(() => ({}));
                                   if (!res.ok) { alert('Unlink failed: ' + (d.error || res.status)); return; }
                                 } catch (e) { alert('Unlink failed: ' + e.message); return; }
                               }
                               setLinkedHawbs(linkedHawbs.filter((_, idx) => idx !== i));
                             }}
                             style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                           >
                             UNLINK
                           </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
               <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>
                 Total: {linkedHawbs.length} HAWB(s)
               </div>
               <button onClick={() => setShowLinkHawb(false)} style={{ padding: '8px 24px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>DONE / CLOSE</button>
            </div>
          </div>
        </div>
      )}


<RateLineModal densityGroup={ctx.densityGroup} isOpen={showRateLine} onClose={() => setShowRateLine(false)} initialData={activeRowIndex !== null ? { ...rateLines[activeRowIndex], goodsDescription: rateLines[activeRowIndex].goodsDescription || (activeRowIndex === 0 && typeof natureOfGoods !== 'undefined' ? natureOfGoods : '') } : { goodsDescription: typeof natureOfGoods !== 'undefined' ? natureOfGoods : '' }} onSave={(data) => {
        let updatedLines;
        if (activeRowIndex !== null) {
          const newLines = [...rateLines];
          newLines[activeRowIndex] = { ...newLines[activeRowIndex], ...data, id: Date.now() };
          updatedLines = newLines;
          setRateLines(newLines);
        } else {
          updatedLines = [...rateLines.filter(r => r && (r.noOfPcs || r.pieces || r.grossWeight || r.chargeableWeight)), { id: Date.now(), ...data }]; // a new line goes under the others (it went on top) - 11-Nov-2026
          setRateLines(updatedLines);
        }
        // Update outer VOLUME field = sum of all rate lines' volume
        const totalVol = updatedLines.reduce((sum, r) => sum + (parseFloat(r.volume) || 0), 0);
        if (totalVol > 0) setVolume(totalVol.toFixed(3));
        setShowRateLine(false); 
      }} />


        <DimensionModal isOpen={showDimension} onClose={() => setShowDimension(false)} onSave={handleDimensionSave} initialDims={ctx.dimRows} densityGroup={ctx.densityGroup} />

      <HandlingCodeModal isOpen={showHandling} onClose={() => setShowHandling(false)} codes={ctx.sphCodes} setCodes={ctx.setSphCodes} masterSph={ctx.masterSph} />

      <DueCarrierChargesModal isOpen={showDueCarrier} onClose={() => setShowDueCarrier(false)} charges={ctx.otherCharges} setCharges={ctx.setOtherCharges} masterCharges={ctx.masterCharges} currency={ctx.currencyCode} />

      <DueAgentChargesModal isOpen={showDueAgent} onClose={() => setShowDueAgent(false)} charges={ctx.otherCharges} setCharges={ctx.setOtherCharges} masterCharges={ctx.masterCharges} currency={ctx.currencyCode} />

      <CommodityModal isOpen={showCommodity} onClose={() => setShowCommodity(false)} rows={(ctx.extraDocs && ctx.extraDocs.COMMODITY && ctx.extraDocs.COMMODITY.rows) || []} setRows={(rows) => saveExtraDoc(ctx, 'COMMODITY', rows.length ? { rows } : null, currentAwbId, 'MAWB')} />

      <HSCodeModal isOpen={showHSCode} onClose={() => setShowHSCode(false)} onSelect={(code) => { if (hsCodeTargetIndex !== null) { handleGridChange(hsCodeTargetIndex, 'harmonisedCode', code); } setShowHSCode(false); }} />

      <AddPartyModal isOpen={showAddParty === true || showAddParty?.isOpen} prefillData={showAddParty?.prefillData} onClose={() => setShowAddParty(false)} title={addPartyTitle} />

      <SubAgentModal isOpen={showSubAgentMaster} onClose={() => setShowSubAgentMaster(false)} setParties={ctx.setParties} />

      <OverseasAgentModal isOpen={showOverseasMaster} onClose={() => setShowOverseasMaster(false)} setParties={ctx.setParties} />

    </>
  );
}
