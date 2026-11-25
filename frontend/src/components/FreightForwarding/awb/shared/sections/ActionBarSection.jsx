import { Button } from '@/components/ui';
import askConfirm from '@/components/common/askConfirm';
import MissingStrip from '../../MissingStrip';
import DocumentsMenu from '../../DocumentsMenu';
import { duplicateAwb, saveAsTemplate, sendAwbMessage } from '../../awbActions';

/**
 * Save / modify / clear / validate / print / send / documents / void / template / logs.
 * sendXfwb: SEND XFWB button. consolTools: SEND XFHL, MANIFEST and SEND XFZB of a consol (MAWB).
 * showSaving: SAVE shows "SAVING..." while the save runs (e-AWB).
 */
export default function ActionBarSection({ ctx, awbType, sendXfwb = false, consolTools = false, showSaving = false, bottomRule = true }) {
  const { handleClearForm, handleSaveToSQL, handleViewLogs, handleVoidAWB, isSaving, runIataValidation, setShowManifest, setShowModifyModal, setShowPrintOptions } = ctx;
  const saving = showSaving && isSaving;
  const send = (kind) => (event) => sendAwbMessage(ctx, kind, event.currentTarget, awbType);
  const clearScreen = async () => {
    if (await askConfirm({ title: 'Clear the screen?', message: 'Anything not saved is lost.', okLabel: 'Clear', tone: 'warn' })) handleClearForm();
  };

  return (
    <>
      <div className="tw:mt-2.5 tw:flex tw:flex-col tw:items-center tw:gap-2 tw:border-t tw:border-border tw:p-2">
        <MissingStrip ctx={ctx} align="center" />
        <div className="tw:flex tw:flex-wrap tw:justify-center tw:gap-2">
          <Button variant="default" disabled={saving} onClick={() => handleSaveToSQL()}>{saving ? 'SAVING...' : 'SAVE'}</Button>
          <Button onClick={() => setShowModifyModal(true)}>MODIFY</Button>
          <Button onClick={clearScreen}>CLEAR</Button>
          <Button onClick={() => runIataValidation()}>VALIDATE EDI</Button>
          <Button onClick={() => setShowPrintOptions(true)}>PRINT</Button>
          <Button onClick={() => duplicateAwb(ctx, awbType)}>DUPLICATE AWB</Button>
          {sendXfwb && <Button onClick={send('xfwb')}>SEND XFWB</Button>}
          {consolTools && (
            <>
              <Button title="House manifest: every live HAWB of this master" onClick={send('xfhl')}>SEND XFHL</Button>
              <Button title="Air cargo manifest of this consol: every live HAWB" onClick={() => setShowManifest(true)}>MANIFEST</Button>
            </>
          )}
          <DocumentsMenu ctx={ctx} type={awbType} />
          {consolTools && <Button onClick={send('xfzb')}>SEND XFZB</Button>}
          <Button variant="destructive" onClick={() => handleVoidAWB()}>VOID AWB</Button>
          <Button onClick={() => saveAsTemplate(ctx, awbType)}>SAVE AS TEMPLATE</Button>
          <Button onClick={() => handleViewLogs()}>VIEW LOGS</Button>
        </div>
      </div>
      {bottomRule && <div className="tw:my-1 tw:h-0.5 tw:w-full tw:bg-border" />}
    </>
  );
}
