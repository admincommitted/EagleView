import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, DateInput, Field, Input } from '@/components/ui';
import PartyPicker from './PartyPicker';

const STATUS_CLASS = {
  Draft: 'tw:bg-muted tw:text-muted-foreground',
  Active: 'tw:bg-success/10 tw:text-success',
};

const chipTextClass = (contract) => {
  if (contract.expired) return 'tw:text-muted-foreground/60';
  return contract.status === 'Active' ? 'tw:text-success' : 'tw:text-muted-foreground';
};

function SavedContractChips({ contracts, openId, onOpen, onNewForCustomer }) {
  return (
    <div className="tw:mt-1.5 tw:flex tw:flex-wrap tw:items-center tw:gap-1 tw:text-[11px]">
      <span className="tw:text-muted-foreground">Saved:</span>
      {contracts.map((contract) => (
        <Button key={contract.id} size="sm" title={`Valid to ${contract.validTo || '-'}`} onClick={() => onOpen(contract.id)}
          className={cn('tw:rounded-full', chipTextClass(contract), String(contract.id) === String(openId) && 'tw:border-primary tw:bg-primary/10')}>
          {contract.contractNo} {'·'} {contract.expired ? 'Expired' : contract.status}
        </Button>
      ))}
      <Button size="sm" className="tw:rounded-full tw:border-dashed tw:text-primary" onClick={onNewForCustomer}>+ New for this customer</Button>
    </div>
  );
}

export default function ContractHeaderForm({ header, onHeaderChange, parties, onPartyPick, contracts, contractId, onOpenContract, onNewForCustomer }) {
  const customerContracts = header.customer ? contracts.filter((contract) => String(contract.partyId) === String(header.customer)) : [];

  return (
    <Card className="tw:grid tw:grid-cols-1 tw:gap-5 tw:p-5 tw:sm:grid-cols-2 tw:xl:grid-cols-4">
      <div>
        <Field layout="col" label="Customer / Party" required>
          <PartyPicker parties={parties} value={header.customer} onChange={onPartyPick} />
        </Field>
        {customerContracts.length > 0 && (
          <SavedContractChips contracts={customerContracts} openId={contractId} onOpen={onOpenContract} onNewForCustomer={onNewForCustomer} />
        )}
      </div>
      <Field layout="col" label="Contract Reference No">
        <Input className="tw:font-bold" value={header.contractNo} disabled />
      </Field>
      <Field layout="col" label="Validity Period" required>
        <div className="tw:flex tw:w-full tw:gap-2.5">
          <DateInput value={header.validFrom} onValueChange={(value) => onHeaderChange('validFrom', value)} />
          <DateInput value={header.validTo} onValueChange={(value) => onHeaderChange('validTo', value)} />
        </div>
      </Field>
      <Field layout="col" label="Status">
        <div className={cn('tw:flex tw:w-full tw:items-center tw:gap-1 tw:rounded-sm tw:border tw:border-black/10 tw:px-3 tw:py-1.5 tw:text-[13px] tw:font-bold',
          STATUS_CLASS[header.status] || 'tw:bg-warning/10 tw:text-warning')}>
          {header.status === 'Pending Approval' && <Clock className="tw:size-3.5" />}
          {header.status}
        </div>
      </Field>
    </Card>
  );
}
