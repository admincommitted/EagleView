// Form section: SAVE
// Split out of CreateMasterWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';
import MissingStrip from '../../MissingStrip';
import { showSuccessToast, showValidationErrorsModal } from '../../../printLogic';
import DocumentsMenu from '../../DocumentsMenu';
import { duplicateAwb, saveAsTemplate, sendAwbMessage } from '../../awbActions'; // real DUPLICATE / SAVE AS TEMPLATE / save-then-send (29-Oct-2026)

export default function ActionBarSection({ ctx }) {
  const { awbPrefix, awbSuffix, currentAwbId, handleClearForm, handleSaveToSQL, runIataValidation, setShowModifyModal, setShowPrintOptions, setXfwbSent } = ctx;
  return (
    <>
    {/* Action Buttons */}
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', backgroundColor: 'transparent', borderTop: '1px solid #94a3b8', marginTop: '10px' }}>
          <MissingStrip ctx={ctx} align="center" />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }} onClick={handleSaveToSQL}>SAVE</button>
            <button style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }} onClick={() => setShowModifyModal(true)}>MODIFY</button>
            <button style={{ backgroundColor: 'var(--primary-color-start, #0ea5e9)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }} onClick={() => { if (window.confirm('Clear the screen? Anything not saved is lost.')) handleClearForm(); }}>CLEAR</button>
            <button onClick={runIataValidation} style={{ backgroundColor: '#8b5cf6', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>VALIDATE EDI</button>
                          
              <button onClick={() => setShowPrintOptions(true)} style={{ backgroundColor: '#06b6d4', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>PRINT</button>
              <button style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }} onClick={() => duplicateAwb(ctx, 'MAWB')}>DUPLICATE AWB</button>
            <button 
              style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }} 
              onClick={(e) => sendAwbMessage(ctx, 'xfwb', e.currentTarget, 'MAWB')}
            >SEND XFWB</button>
            

                          {/* SEND XFHL: house manifest of this consol (29-Oct-2026 - was only on the search screen) */}
              <button
                style={{ backgroundColor: '#0f766e', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                title="House manifest: every live HAWB of this master"
                onClick={(e) => sendAwbMessage(ctx, 'xfhl', e.currentTarget, 'MAWB')}
              >SEND XFHL</button>
              {/* 11-Nov-2026: the consol manifest window was there but no button opened it on the MAWB screen */}
              <button type="button" title="Air cargo manifest of this consol: every live HAWB" onClick={() => ctx.setShowManifest(true)}
                style={{ backgroundColor: '#0e7490', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>MANIFEST</button>
              <DocumentsMenu ctx={ctx} type="MAWB" /> {/* 11-Nov-2026: the MAWB screen had no documents menu */}
                          {/* SEND XFZB button */}
              <button
                style={{ backgroundColor: '#7c3aed', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                onClick={(e) => sendAwbMessage(ctx, 'xfzb', e.currentTarget, 'MAWB')}
              >SEND XFZB</button>
              {/* 29-Oct-2026: void / template / logs were coded for the MAWB screen but had no buttons */}
              <button type="button" style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }} onClick={ctx.handleVoidAWB}>VOID AWB</button>
              <button type="button" style={{ backgroundColor: 'var(--primary-color-end, #2563eb)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }} onClick={() => saveAsTemplate(ctx, 'MAWB')}>SAVE AS TEMPLATE</button>
              <button type="button" onClick={ctx.handleViewLogs} style={{ padding: '6px 16px', fontSize: '12px', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#64748b', color: 'white' }}>VIEW LOGS</button>
            </div>
          </div>
    </>
  );
}
