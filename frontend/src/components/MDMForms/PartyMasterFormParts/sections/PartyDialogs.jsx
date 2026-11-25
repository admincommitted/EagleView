import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Modal } from '@/components/ui';
import KYCVaultModal from '../../KYCVaultModal';
import DgftIecModal from './DgftIecModal';

function MessageTitle({ title, isError }) {
  return (
    <span className="tw:flex tw:items-center tw:gap-3">
      <span className={cn('tw:flex tw:size-8 tw:items-center tw:justify-center tw:rounded-full tw:text-lg tw:font-bold tw:text-white', isError ? 'tw:bg-destructive' : 'tw:bg-success')}>
        {isError ? '!' : <Check className="tw:size-4" />}
      </span>
      <span className={cn('tw:text-base tw:font-bold tw:tracking-[0.5px]', isError ? 'tw:text-destructive' : 'tw:text-success')}>{title}</span>
    </span>
  );
}

export default function PartyDialogs({ ctx }) {
  const {
    uiModal, closeMessage, showKycVault, setShowKycVault, selectedParty, formData,
    dgftOpen, setDgftOpen, applyDgftName, addDgftBranches, fillPartyFromDgft,
  } = ctx;
  return (
    <>
      <DgftIecModal open={dgftOpen} onClose={() => setDgftOpen(false)} iec={formData.taxId} name={formData.name} merc={formData.mercManuf}
        onUseName={applyDgftName} addresses={selectedParty?.addresses || []} onAddBranches={addDgftBranches} onFillParty={fillPartyFromDgft} />

      {showKycVault && selectedParty && <KYCVaultModal party={selectedParty} onClose={() => setShowKycVault(false)} />}

      <Modal open={uiModal.isOpen} onClose={closeMessage} width={550} title={<MessageTitle title={uiModal.title} isError={uiModal.type === 'error'} />}
        bodyClassName="tw:py-6 tw:text-sm tw:leading-relaxed tw:font-medium"
        footer={<Button variant="default" size="lg" onClick={closeMessage}>OK / REVIEW</Button>}>
        {uiModal.message}
      </Modal>
    </>
  );
}
