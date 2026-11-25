import { useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Field, Modal, Textarea } from '@/components/ui';
import { purchaseApi } from './purchaseApi';
import DetailList from './DetailList';
import Notice from './Notice';
import { PO_DECISIONS } from './poDecisions';
import { rupeesGrouped, vendorName } from './purchaseFormat';

const poSummary = (po) => [
  { label: 'Vendor', value: vendorName(po) },
  { label: 'Amount', value: rupeesGrouped(po.totalAmount) },
  { label: 'Branch', value: po.branch },
  { label: 'Items', value: (po.items || []).map((item) => item.itemName).filter(Boolean).join(', ') || 'No items', wide: true },
];

/** Approve / reject / hold one PO with the approver's remarks; a reject or a hold needs a reason. */
export default function PoDecisionModal({ po, status, onClose, onDecided }) {
  const decision = PO_DECISIONS[status];
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const save = async () => {
    if (status !== 'Approved' && !remarks.trim()) {
      setSaveError(`Write a reason for ${decision.reasonVerb} this PO.`);
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await purchaseApi.decidePurchaseOrder(po.id, { status, remarks: remarks.trim() });
      onDecided();
    } catch (error) {
      setSaveError(errorMessage(error) || 'Not saved');
    }
    setSaving(false);
  };

  return (
    <Modal
      open
      width={440}
      title={`${decision.verb} ${po.poNumber}`}
      onClose={() => !saving && onClose()}
      footer={(
        <>
          <Button disabled={saving} onClick={onClose}>Cancel</Button>
          <Button variant={decision.variant} disabled={saving} onClick={save}>{saving ? 'Saving...' : `${decision.verb} PO`}</Button>
        </>
      )}
    >
      <div className="tw:flex tw:flex-col tw:gap-3">
        <DetailList items={poSummary(po)} />
        <Field label={`Remarks ${status === 'Approved' ? '(optional)' : '(required)'}`} layout="col" required={status !== 'Approved'}>
          <Textarea autoFocus rows={3} maxLength={500} data-allow-text="" className="tw:normal-case" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
        </Field>
        {saveError && <Notice tone="danger">{saveError}</Notice>}
      </div>
    </Modal>
  );
}
