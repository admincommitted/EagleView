import { NotebookPen } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button, DataTable, Input, Modal } from '@/components/ui';
import askConfirm from '@/components/common/askConfirm';
import { errorMessage } from '@/services/axiosInstance';
import { freightApi } from '../../../freightApi';
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
import SLIModal from '../../../Modals/SLIModal';
import SecurityDeclarationModal from '../../../Modals/SecurityDeclarationModal';
import SubAgentModal from '../../../Modals/SubAgentModal';
import TemperatureControlModal from '../../../Modals/TemperatureControlModal';

// documents saved with the AWB (extraDocs); MANIFEST is drawn on its own below
const EXTRA_DOCS = [
  { docType: 'DGD', open: 'showDgd', setOpen: 'setShowDgd', Window: DGDeclarationModal },
  { docType: 'AVI', open: 'showAvi', setOpen: 'setShowAvi', Window: LiveAnimalCertModal },
  { docType: 'CSD', open: 'showCsd', setOpen: 'setShowCsd', Window: SecurityDeclarationModal },
  { docType: 'LITHIUM', open: 'showLithium', setOpen: 'setShowLithium', Window: LithiumBatteryModal },
  { docType: 'COO', open: 'showCoo', setOpen: 'setShowCoo', Window: CertificateOfOriginModal },
  { docType: 'LABEL', open: 'showLabel', setOpen: 'setShowLabel', Window: CargoLabelModal },
  { docType: 'BOOKING', open: 'showBooking', setOpen: 'setShowBooking', Window: BookingConfirmationModal },
  { docType: 'CCA', open: 'showCca', setOpen: 'setShowCca', Window: CCAModal },
  { docType: 'TEMP', open: 'showTemp', setOpen: 'setShowTemp', Window: TemperatureControlModal },
  { docType: 'SLI', open: 'showSli', setOpen: 'setShowSli', Window: SLIModal },
  { docType: 'DO', open: 'showDo', setOpen: 'setShowDo', Window: DeliveryOrderModal },
];

const LOG_COLUMNS = [
  { key: 'createdAt', header: 'Date', cell: (log) => new Date(log.createdAt).toLocaleString('en-IN') },
  { key: 'action', header: 'Action', className: 'tw:font-bold' },
  { key: 'user', header: 'User' },
  { key: 'details', header: 'Details', className: 'tw:whitespace-normal' },
];

function LogsModal({ ctx }) {
  const { logsData, setShowLogsModal, showLogsModal } = ctx;
  return (
    <Modal open={showLogsModal} onClose={() => setShowLogsModal(false)} title="AWB Logs" width={600} bodyClassName="tw:max-h-[70vh] tw:overflow-y-auto">
      <DataTable columns={LOG_COLUMNS} rows={logsData || []} rowKey={(_, index) => index} emptyText="No logs found." />
    </Modal>
  );
}

function MessageModal({ ctx }) {
  const { setUiModal, uiModal } = ctx;
  const isError = uiModal.type === 'error';
  const dismiss = () => setUiModal({ ...uiModal, isOpen: false });
  return (
    <Modal
      open={uiModal.isOpen}
      onClose={dismiss}
      width={450}
      closeOnOutside={false}
      title={(
        <span className={cn('tw:flex tw:items-center tw:gap-3', isError ? 'tw:text-destructive' : 'tw:text-success')}>
          <span className={cn('tw:flex tw:size-6 tw:items-center tw:justify-center tw:rounded-full tw:font-bold tw:text-white', isError ? 'tw:bg-destructive' : 'tw:bg-success')}>!</span>
          {uiModal.title}
        </span>
      )}
      footer={<Button variant="default" onClick={dismiss}>OK / DISMISS</Button>}
      bodyClassName="tw:max-h-[60vh] tw:overflow-y-auto tw:whitespace-pre-line tw:text-[13px]"
    >
      {uiModal.message}
    </Modal>
  );
}

function DraftModal({ ctx }) {
  const { draftConfirmOpen, handleDiscardDraft, handleRestoreDraft } = ctx;
  return (
    <Modal
      open={draftConfirmOpen}
      width={400}
      closeOnOutside={false}
      showCloseButton={false}
      title={<span className="tw:flex tw:items-center tw:gap-2"><NotebookPen className="tw:size-5" /> Draft Found</span>}
      footer={(
        <>
          <Button variant="ghost" onClick={handleDiscardDraft}>Discard</Button>
          <Button variant="default" onClick={handleRestoreDraft}>Restore Draft</Button>
        </>
      )}
    >
      <p className="tw:m-0 tw:text-sm tw:leading-normal tw:normal-case tw:text-muted-foreground">
        An unsaved draft of an Airway Bill was found. Would you like to restore it and continue working, or discard it?
      </p>
    </Modal>
  );
}

function LinkHawbModal({ ctx }) {
  const { awbNo, awbPrefix, awbSuffix, currentAwbId, handleLinkHawb, hawbSearchText, linkedHawbs, setHawbSearchText, setLinkedHawbs, setShowLinkHawb, showLinkHawb } = ctx;
  const masterNumber = awbPrefix && awbSuffix ? `${awbPrefix}-${awbSuffix}` : '';
  const unlink = async (hawb, index) => {
    // a house linked here and not saved yet only leaves the list; a saved one is unlinked in the database too
    if (hawb.id && currentAwbId && !hawb.local) {
      const goAhead = await askConfirm({ title: 'Unlink HAWB', message: `Unlink HAWB ${hawb.awb} from this MAWB?`, okLabel: 'Unlink', tone: 'warn' });
      if (!goAhead) return;
      try {
        await freightApi.unlinkHawb(hawb.id, masterNumber || awbNo);
      } catch (error) {
        toast.error(`Unlink failed: ${errorMessage(error)}`);
        return;
      }
    }
    setLinkedHawbs(linkedHawbs.filter((_, rowIndex) => rowIndex !== index));
  };
  const columns = [
    { key: 'awb', header: 'HAWB No', className: 'tw:font-bold' },
    { key: 'size', header: 'PCS / WT / VOL', cell: (hawb) => `${hawb.pcs} PCS / ${hawb.wt} KG / ${hawb.vol} MC` },
    { key: 'route', header: 'Org-Dest', cell: (hawb) => `${hawb.org} - ${hawb.dest}` },
    {
      key: 'unlink', header: 'Action', align: 'center',
      cell: (hawb, index) => <Button variant="link" size="sm" className="tw:font-bold tw:text-destructive" onClick={() => unlink(hawb, index)}>UNLINK</Button>,
    },
  ];
  return (
    <Modal
      open={Boolean(showLinkHawb)}
      onClose={() => setShowLinkHawb(false)}
      title="Link / Manage House Waybills (HAWBs)"
      width={700}
      closeOnOutside={false}
      footer={(
        <div className="tw:flex tw:items-center tw:gap-4">
          <span className="tw:text-entry tw:font-bold tw:text-muted-foreground">Total: {linkedHawbs.length} HAWB(s)</span>
          <Button variant="default" onClick={() => setShowLinkHawb(false)}>DONE / CLOSE</Button>
        </div>
      )}
    >
      <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row">
        <Input value={hawbSearchText} onChange={(event) => setHawbSearchText(event.target.value)} placeholder="Enter HAWB Number to Link..." className="tw:flex-1" />
        <Button variant="default" onClick={() => handleLinkHawb(masterNumber)}>+ LINK HAWB</Button>
      </div>
      <DataTable columns={columns} rows={linkedHawbs} rowKey={(_, index) => index} emptyText="No HAWBs linked to this MAWB yet."
        containerClassName="tw:max-h-[300px] tw:rounded-sm tw:border tw:border-border" />
    </Modal>
  );
}

/**
 * Every window of the AWB screen. vaultAwbNumber: the number shown in the documents vault (default awbNo).
 * manifestMawbData: consol data for the cargo manifest (MAWB). linkHawbs: the Link / Manage HAWBs window (MAWB).
 */
export default function DialogsSection({ ctx, awbType, vaultAwbNumber, manifestMawbData, linkHawbs = false }) {
  const {
    activeRowIndex, addPartyTitle, awbNo, currentAwbId, handleAutoFill, handleDimensionSave, handleGridChange, handleModifyAWB,
    handlePrintOptionsSubmit, handleRequestAddParty, hsCodeTargetIndex, natureOfGoods, rateLines, setRateLines, setShowAddParty,
    setShowAwbVault, setShowCommodity, setShowDimension, setShowDueAgent, setShowDueCarrier, setShowHSCode, setShowHandling,
    setShowManifest, setShowModifyModal, setShowOverseasMaster, setShowPrintOptions, setShowRateLine, setShowSubAgentMaster,
    setVolume, showAddParty, showAwbVault, showCommodity, showDimension, showDueAgent, showDueCarrier, showHSCode, showHandling,
    showManifest, showModifyModal, showOverseasMaster, showPrintOptions, showRateLine, showSubAgentMaster, tempAwbId,
  } = ctx;
  const docProps = { extraDocs: ctx.extraDocs, setExtraDocs: ctx.setExtraDocs, awbId: currentAwbId, awbType };
  const editedLine = activeRowIndex !== null ? rateLines[activeRowIndex] : null;
  const rateLineStart = editedLine
    ? { ...editedLine, goodsDescription: editedLine.goodsDescription || (activeRowIndex === 0 ? natureOfGoods ?? '' : '') }
    : { goodsDescription: natureOfGoods ?? '' };

  const saveRateLine = (data) => {
    let updatedLines;
    if (activeRowIndex !== null) {
      updatedLines = [...rateLines];
      updatedLines[activeRowIndex] = { ...updatedLines[activeRowIndex], ...data, id: Date.now() };
    } else {
      updatedLines = [...rateLines.filter((line) => line && (line.noOfPcs || line.pieces || line.grossWeight || line.chargeableWeight)), { id: Date.now(), ...data }];
    }
    setRateLines(updatedLines);
    const totalVolume = updatedLines.reduce((sum, line) => sum + (parseFloat(line.volume) || 0), 0);
    if (totalVolume > 0) setVolume(totalVolume.toFixed(3));
    setShowRateLine(false);
  };

  return (
    <>
      <LogsModal ctx={ctx} />
      {linkHawbs && <LinkHawbModal ctx={ctx} />}

      <RateLineModal densityGroup={ctx.densityGroup} isOpen={showRateLine} onClose={() => setShowRateLine(false)} initialData={rateLineStart} onSave={saveRateLine} />
      <DimensionModal isOpen={showDimension} onClose={() => setShowDimension(false)} onSave={handleDimensionSave} initialDims={ctx.dimRows} densityGroup={ctx.densityGroup} />
      <HandlingCodeModal isOpen={showHandling} onClose={() => setShowHandling(false)} codes={ctx.sphCodes} setCodes={ctx.setSphCodes} masterSph={ctx.masterSph} />
      <DueCarrierChargesModal isOpen={showDueCarrier} onClose={() => setShowDueCarrier(false)} charges={ctx.otherCharges} setCharges={ctx.setOtherCharges} masterCharges={ctx.masterCharges} currency={ctx.currencyCode} />
      <DueAgentChargesModal isOpen={showDueAgent} onClose={() => setShowDueAgent(false)} charges={ctx.otherCharges} setCharges={ctx.setOtherCharges} masterCharges={ctx.masterCharges} currency={ctx.currencyCode} />
      <CommodityModal isOpen={showCommodity} onClose={() => setShowCommodity(false)} rows={ctx.extraDocs?.COMMODITY?.rows || []}
        setRows={(rows) => saveExtraDoc(ctx, 'COMMODITY', rows.length ? { rows } : null, currentAwbId, awbType)} />
      <HSCodeModal isOpen={showHSCode} onClose={() => setShowHSCode(false)}
        onSelect={(code) => { if (hsCodeTargetIndex !== null) handleGridChange(hsCodeTargetIndex, 'harmonisedCode', code); setShowHSCode(false); }} />
      <AddPartyModal isOpen={showAddParty === true || showAddParty?.isOpen} prefillData={showAddParty?.prefillData} onClose={() => setShowAddParty(false)} title={addPartyTitle} />
      <SubAgentModal isOpen={showSubAgentMaster} onClose={() => setShowSubAgentMaster(false)} setParties={ctx.setParties} />
      <OverseasAgentModal isOpen={showOverseasMaster} onClose={() => setShowOverseasMaster(false)} setParties={ctx.setParties} />

      {EXTRA_DOCS.map(({ docType, open, setOpen, Window }) => (
        <PersistedDoc key={docType} docType={docType} isOpen={ctx[open]} {...docProps}>
          <Window isOpen={ctx[open]} onClose={() => ctx[setOpen](false)} awbNumber={awbNo} awbId={currentAwbId} awbType={awbType} />
        </PersistedDoc>
      ))}
      <PersistedDoc docType="MANIFEST" isOpen={showManifest} {...docProps}>
        <CargoManifestModal isOpen={showManifest} onClose={() => setShowManifest(false)} awbNumber={awbNo} mawbData={manifestMawbData} />
      </PersistedDoc>

      <MessageModal ctx={ctx} />
      <DraftModal ctx={ctx} />

      {showAwbVault && (
        <AWBVaultModal awbId={currentAwbId} awbType={awbType} tempAwbId={tempAwbId} awbNumber={vaultAwbNumber ?? awbNo}
          onClose={() => setShowAwbVault(false)} onAutoFill={handleAutoFill} onRequestAddParty={handleRequestAddParty} />
      )}
      <PrintOptionsModal isOpen={showPrintOptions} onClose={() => setShowPrintOptions(false)} onPrint={handlePrintOptionsSubmit} />
      <ModifyPromptModal isOpen={showModifyModal} onClose={() => setShowModifyModal(false)} onSubmit={handleModifyAWB} type={awbType} />
    </>
  );
}
