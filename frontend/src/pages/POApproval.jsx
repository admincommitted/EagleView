import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { Card, CardContent, Textarea } from '@/components/ui';
import { purchaseApi } from './PurchaseParts/purchaseApi';
import ApprovalButtons from './PurchaseParts/ApprovalButtons';
import DetailList from './PurchaseParts/DetailList';
import MaterialReceivedNote from './PurchaseParts/MaterialReceivedNote';
import POItemsTable from './PurchaseParts/POItemsTable';
import { canBeDecided, decisionActions } from './PurchaseParts/poDecisions';
import { actionTime, localDateTime, vendorName } from './PurchaseParts/purchaseFormat';

function poDetails(po) {
  const details = [
    { label: 'Vendor', value: vendorName(po) },
    { label: 'Branch', value: po.branch },
    { label: 'Priority', value: po.priority },
    { label: 'Status', value: po.status },
    { label: 'Submitted On', value: localDateTime(po.submittedAt || po.createdAt) },
    { label: 'Remarks', value: po.justification, wide: true },
  ];
  if (po.directorRemarks) {
    details.push({
      label: 'Director Remarks',
      wide: true,
      value: (
        <>
          <span className={po.status === 'Approved' ? 'tw:text-success' : 'tw:text-destructive'}>{po.directorRemarks}</span>
          <span className="tw:ml-1.5 tw:text-[11px] tw:font-normal tw:text-muted-foreground">(ON {localDateTime(actionTime(po))})</span>
        </>
      ),
    });
  }
  if (po.quoteFilePath) {
    details.push({ label: 'Quotation', wide: true, value: <a href={po.quoteFilePath} target="_blank" rel="noreferrer" className="tw:text-primary tw:underline">View Quotation</a> });
  }
  return details;
}

export default function POApproval() {
  const { id } = useParams();
  const [po, setPo] = useState(null);
  const [remarks, setRemarks] = useState('');

  const loadPurchaseOrder = async () => {
    try {
      setPo(await purchaseApi.purchaseOrder(id));
    } catch (error) {
      console.error(errorMessage(error));
    }
  };
  useEffect(() => { loadPurchaseOrder(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (status) => {
    try {
      await purchaseApi.decidePurchaseOrder(id, { status, remarks });
      toast.success(`PO ${status}`);
    } catch (error) {
      toast.error(`Not saved: ${errorMessage(error)}`);
    }
    loadPurchaseOrder();
  };

  if (!po) return <div>Loading...</div>;

  return (
    <div className="tw:mx-auto tw:flex tw:max-w-[800px] tw:flex-col tw:gap-5 tw:p-3 tw:md:p-5">
      <h2 className="tw:m-0 tw:text-lg tw:font-bold">PO Approval: {po.poNumber}</h2>

      <Card className="tw:bg-page">
        <CardContent className="tw:p-4"><DetailList items={poDetails(po)} /></CardContent>
      </Card>

      <POItemsTable items={po.items || []} grandTotal={po.totalAmount} />

      {canBeDecided(po) && (
        <Card>
          <CardContent className="tw:gap-2.5 tw:p-4">
            <Textarea rows={3} data-allow-text="" placeholder="Director Remarks..." value={remarks} onChange={(event) => setRemarks(event.target.value)} />
            <ApprovalButtons actions={decisionActions(po)} onAction={decide} size="lg" />
          </CardContent>
        </Card>
      )}

      {po.status === 'Approved' && <MaterialReceivedNote />}
    </div>
  );
}
