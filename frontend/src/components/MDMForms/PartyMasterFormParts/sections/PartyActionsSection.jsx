import { Clock, FileLock2, Save, ShieldCheck, ShieldX } from 'lucide-react';
import { Badge, Button } from '@/components/ui';

const STAMP_FORMAT = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
const stampText = (value) => new Date(value || Date.now()).toLocaleString('en-GB', STAMP_FORMAT).toUpperCase();

function KycStatus({ party }) {
  if (party?.kycStatus === 'APPROVED') return <Badge variant="success"><ShieldCheck /> KYC APPROVED</Badge>;
  if (party?.kycStatus === 'REJECTED') return <Badge variant="danger"><ShieldX /> KYC REJECTED</Badge>;
  if (party?.id && (!party.kycStatus || party.kycStatus === 'PENDING')) return <Badge variant="warning"><Clock /> KYC PENDING</Badge>;
  return null;
}

export default function PartyActionsSection({ ctx }) {
  const { selectedParty, setSelectedParty, deleteParty, openKycVault, saveParty, savingParty } = ctx;
  return (
    <div className="tw:mt-auto tw:flex tw:flex-col tw:gap-2 tw:border-t tw:border-border tw:bg-page tw:px-4 tw:py-3">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <KycStatus party={selectedParty} />
          {selectedParty?.kycLastSentAt && (
            <span className="tw:text-[10px] tw:whitespace-nowrap tw:text-muted-foreground">Sent for approval: {new Date(selectedParty.kycLastSentAt).toLocaleString()}</span>
          )}
        </div>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:md:pr-[70px]">
          <Button variant="secondary" onClick={() => setSelectedParty(null)}>New / Clear</Button>
          <Button variant="destructive" onClick={deleteParty}>Delete</Button>
          <Button variant="outline" onClick={openKycVault}><FileLock2 /> KYC Vault</Button>
          <Button variant="default" onClick={saveParty} disabled={savingParty} aria-busy={savingParty}>
            <Save /> {savingParty ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
      <div className="tw:flex tw:flex-wrap tw:gap-x-6 tw:gap-y-1 tw:text-[11px] tw:text-muted-foreground">
        {selectedParty ? (
          <>
            <span><b className="tw:text-foreground">Created By:</b> ADMIN ({stampText(selectedParty.createdAt)})</span>
            <span><b className="tw:text-foreground">Last Modified By:</b> ADMIN ({stampText(selectedParty.updatedAt)})</span>
          </>
        ) : (
          <span>New Record Mode</span>
        )}
      </div>
    </div>
  );
}
