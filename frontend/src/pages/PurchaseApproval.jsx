import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle, ShoppingCart, XCircle } from 'lucide-react';
import { askConfirm } from '../components/common/askConfirm';
import { Button, Card, CardContent, Field, Section, Textarea } from '@/components/ui';
import { purchaseApi } from './PurchaseParts/purchaseApi';
import ApprovalButtons from './PurchaseParts/ApprovalButtons';
import DetailList from './PurchaseParts/DetailList';
import Notice from './PurchaseParts/Notice';
import PageHeader from './PurchaseParts/PageHeader';
import StatusBadge from './PurchaseParts/StatusBadge';
import { ukDate } from './PurchaseParts/purchaseFormat';

const DECISION_ACTIONS = [
  { key: 'APPROVED', label: 'Approve Purchase', icon: CheckCircle, variant: 'success', className: 'tw:flex-1' },
  { key: 'REJECT', label: 'Reject Purchase', icon: XCircle, variant: 'destructive', className: 'tw:flex-1' },
];
const IMAGE_FILE = /\.(jpeg|jpg|gif|png)$/i;
const STATUS_TONES = { APPROVED: { variant: 'success' }, REJECTED: { variant: 'danger' } };

const requestDetails = (request) => [
  { label: 'Item Name', value: request.itemName },
  { label: 'Amount', value: `₹${request.amount}`, valueClassName: 'tw:text-sm tw:text-success' },
  { label: 'Intended User', value: request.intendedUser },
  { label: 'Designation', value: request.designation || '-' },
  { label: 'Department', value: request.department || '-' },
  { label: 'Last Purchased', value: request.lastPurchaseDate ? ukDate(request.lastPurchaseDate) : 'N/A' },
  { label: 'Status', value: <StatusBadge status={request.status} tones={STATUS_TONES} /> },
];

function TextBlock({ title, children }) {
  return (
    <Section title={title}>
      <div className="tw:rounded-sm tw:border tw:border-border tw:bg-page tw:p-2.5 tw:text-entry tw:normal-case">{children}</div>
    </Section>
  );
}

function Attachment({ url }) {
  return (
    <TextBlock title="Attached Photo / Document">
      <a href={url} target="_blank" rel="noreferrer" className="tw:text-primary tw:underline">View Attachment</a>
      {IMAGE_FILE.test(url) && (
        <img src={url} alt="Attached product" className="tw:mt-2.5 tw:block tw:max-h-[300px] tw:max-w-full tw:rounded-sm tw:border tw:border-input" />
      )}
    </TextBlock>
  );
}

export default function PurchaseApproval() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [askingReason, setAskingReason] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    const loadRequest = async () => {
      try {
        setRequest(await purchaseApi.purchaseRequest(id));
      } catch {
        setLoadError('Request not found or failed to load.');
      }
      setLoading(false);
    };
    loadRequest();
  }, [id]);

  const decide = async (status) => {
    if (status === 'REJECTED' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason.');
      return;
    }
    setSubmitting(true);
    try {
      setRequest(await purchaseApi.decidePurchaseRequest(id, { status, rejectionReason, approvedBy: 'Director' }));
      setSuccessMessage(`Request successfully ${status.toLowerCase()}!`);
      setAskingReason(false);
    } catch {
      toast.error('Action failed.');
    }
    setSubmitting(false);
  };

  const addToAssets = async () => {
    if (!(await askConfirm({ title: 'Add to assets', message: 'Add to Asset/Stock list?', okLabel: 'Add' }))) return;
    try {
      await purchaseApi.addAsset({
        assetName: request.itemName,
        description: request.itemDetails,
        assignedTo: request.intendedUser,
        assignedDepartment: request.department,
        purchaseValue: request.amount,
        sourcePurchaseId: request.id,
      });
      toast.success('Successfully added to Assets!');
      navigate('/asset-management');
    } catch {
      toast.error('Failed to add to assets');
    }
  };

  if (loading) return <div className="tw:p-12 tw:text-center">Loading...</div>;
  if (loadError) return <div className="tw:p-12 tw:text-center tw:text-destructive">{loadError}</div>;
  if (!request) return null;

  return (
    <div className="tw:flex tw:min-h-screen tw:justify-center tw:bg-page tw:p-3 tw:md:p-5">
      <Card className="tw:w-full tw:max-w-[600px] tw:self-start">
        <CardContent className="tw:gap-4 tw:p-4 tw:md:p-6">
          <PageHeader icon={ShoppingCart} title="Purchase Approval" subtitle={`Req #${request.id}`} className="tw:border-b-2 tw:border-border tw:pb-3" />

          {successMessage && <Notice tone="success" icon={CheckCircle} title={successMessage} />}

          <DetailList items={requestDetails(request)} />
          <TextBlock title="Item Details / Specifications">{request.itemDetails || 'No details provided.'}</TextBlock>
          <TextBlock title="Justification">{request.justification || 'No justification provided.'}</TextBlock>
          {request.productPhotoUrl && <Attachment url={request.productPhotoUrl} />}

          {request.status === 'REJECTED' && request.rejectionReason && (
            <Notice tone="danger" title="Rejection Reason" className="tw:border-dashed">{request.rejectionReason}</Notice>
          )}

          {request.status === 'PENDING' && !askingReason && (
            <ApprovalButtons actions={DECISION_ACTIONS} disabled={submitting} size="lg"
              onAction={(key) => (key === 'REJECT' ? setAskingReason(true) : decide(key))} />
          )}

          {request.status === 'PENDING' && askingReason && (
            <Notice tone="danger">
              <Field label="Please provide a reason for rejection:" layout="col">
                <Textarea rows={4} data-allow-text="" placeholder="Type reason here..." value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />
              </Field>
              <div className="tw:flex tw:flex-wrap tw:gap-2">
                <Button variant="destructive" disabled={submitting} onClick={() => decide('REJECTED')}>Confirm Rejection</Button>
                <Button disabled={submitting} onClick={() => setAskingReason(false)}>Cancel</Button>
              </div>
            </Notice>
          )}

          {request.status === 'APPROVED' && (
            <Notice tone="success" title="Post-Approval Action">
              <p className="tw:m-0">Has this item been physically purchased and received? Add it to the company asset register.</p>
              <div><Button variant="success" onClick={addToAssets}>Add to Assets / Stock</Button></div>
            </Notice>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
