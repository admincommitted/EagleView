import { CheckCircle, Save, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import GroupedSelect from './GroupedSelect';

const NEW_CONTRACT = 'new';

const NEW_OPTION = [{ value: NEW_CONTRACT, label: '+ New contract' }];

const contractLabel = (contract) => `${contract.contractNo} - ${contract.partyName} (${contract.status}${contract.expired ? ', expired' : ''})`;

export default function ContractToolbar({ contracts, contractId, canApprove, saving, onOpen, onDelete, onSetStatus, onSave }) {
  const savedGroup = {
    label: contracts.length ? `Saved contracts (${contracts.length})` : 'No contract saved yet',
    options: contracts.map((contract) => ({ value: contract.id, label: contractLabel(contract) })),
  };

  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5 tw:sm:justify-end">
      <GroupedSelect
        className="tw:h-8 tw:w-full tw:sm:w-[280px]"
        title="Saved contracts - pick one to open it"
        options={NEW_OPTION}
        groups={[savedGroup]}
        value={contractId || NEW_CONTRACT}
        onValueChange={(value) => onOpen(value === NEW_CONTRACT ? '' : value)}
      />
      {contractId && <Button variant="destructive" size="lg" onClick={onDelete}><Trash2 /> Delete</Button>}
      {contractId && canApprove && (
        <>
          <Button variant="success" size="lg" onClick={() => onSetStatus('Active')}><CheckCircle /> Approve</Button>
          <Button variant="destructive" size="lg" onClick={() => onSetStatus('Rejected')}><XCircle /> Reject</Button>
        </>
      )}
      <Button size="lg" disabled={saving} onClick={() => onSave('Draft')}><Save /> Save as Draft</Button>
      <Button variant="default" size="lg" disabled={saving} onClick={() => onSave('Pending Approval')}><CheckCircle /> Submit for Approval</Button>
    </div>
  );
}
