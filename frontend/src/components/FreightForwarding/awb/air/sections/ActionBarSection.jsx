// Form section: MODIFY
// Split out of CreateAirWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';
import MissingStrip from '../../MissingStrip';
import { showSuccessToast, showValidationErrorsModal } from '../../../printLogic';
import DocumentsMenu from '../../DocumentsMenu';
import { duplicateAwb, saveAsTemplate, sendAwbMessage } from '../../awbActions'; // real DUPLICATE / SAVE AS TEMPLATE / save-then-send (29-Oct-2026)

export default function ActionBarSection({ ctx }) {
  const { awbPrefix, awbSuffix, currentAwbId, depAirport, destAirport, handleClearForm, handleSaveToSQL, handleViewLogs, handleVoidAWB, isSaving, natureOfGoods, navigate, runIataValidation, setShowAvi, setShowBooking, setShowCca, setShowCoo, setShowDgd, setShowDo, setShowDocsMenu, setShowLabel, setShowLithium, setShowManifest, setShowModifyModal, setShowPrintOptions, setShowSli, setShowTemp, showDocsMenu, sphCodes } = ctx;
  return (
    <>
    {/* Action Buttons */}
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', backgroundColor: 'transparent', borderTop: '1px solid #94a3b8', marginTop: '10px' }}>
          <MissingStrip ctx={ctx} align="center" />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button disabled={isSaving} style={{ backgroundColor: isSaving ? '#94a3b8' : '#22c55e', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }} onClick={handleSaveToSQL}>{isSaving ? 'SAVING...' : 'SAVE'}</button>
            <button style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }} onClick={() => setShowModifyModal(true)}>MODIFY</button>
            <button style={{ backgroundColor: 'var(--primary-color-start, #0ea5e9)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }} onClick={() => { if (window.confirm('Clear the screen? Anything not saved is lost.')) handleClearForm(); }}>CLEAR</button>
            <button onClick={runIataValidation} style={{ backgroundColor: '#8b5cf6', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>VALIDATE EDI</button>
                          
              <button onClick={() => setShowPrintOptions(true)} style={{ backgroundColor: '#06b6d4', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>PRINT</button>
              <button style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }} onClick={() => duplicateAwb(ctx, 'AWB')}>DUPLICATE AWB</button>
            <button 
              style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }} 
              onClick={(e) => sendAwbMessage(ctx, 'xfwb', e.currentTarget, 'AWB')}
            >SEND XFWB</button>
            <DocumentsMenu ctx={ctx} type="AWB" /> {/* 11-Nov-2026: shared list, filled from the saved AWB */}
            <button style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }} onClick={handleVoidAWB}>VOID AWB</button>
              <button style={{ backgroundColor: 'var(--primary-color-end, #2563eb)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }} onClick={() => saveAsTemplate(ctx, 'AWB')}>SAVE AS TEMPLATE</button>
              <button type="button" onClick={handleViewLogs} style={{ padding: '6px 16px', fontSize: '12px', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#64748b', color: 'white', textTransform: 'uppercase' }}>VIEW LOGS</button>
          </div>
        </div>

          <div style={{ width: '100%', height: '2px', backgroundColor: '#94a3b8', margin: '4px 0', opacity: 0.8 }}></div>
    </>
  );
}
