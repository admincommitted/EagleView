import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FileText, Send, ShoppingCart } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Card, CardContent, CardHeader, CardTitle, Field } from '@/components/ui';
import { purchaseApi } from './PurchaseParts/purchaseApi';
import FormFields from './PurchaseParts/FormFields';
import FilePicker from './PurchaseParts/FilePicker';
import Notice from './PurchaseParts/Notice';
import PageHeader from './PurchaseParts/PageHeader';
import PurchaseRequestCard from './PurchaseParts/PurchaseRequestCard';
import { BLANK_REQUEST, missingRequiredField, REQUEST_FIELDS } from './PurchaseParts/purchaseRequest';

export default function PurchaseManagement() {
  const [formData, setFormData] = useState(BLANK_REQUEST);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);

  const loadRequests = async () => {
    try {
      setRecentRequests(await purchaseApi.purchaseRequests());
    } catch (error) {
      console.error(errorMessage(error));
    }
  };
  useEffect(() => { loadRequests(); }, []);

  const changeField = (name, value) => setFormData((current) => ({ ...current, [name]: value }));

  const submitRequest = async (event) => {
    event.preventDefault();
    const missing = missingRequiredField(REQUEST_FIELDS, formData);
    if (missing) { toast.error(`${missing.label} is required`); return; }

    setSending(true);
    setMessage(null);
    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => data.append(key, value));
      if (photoFile) data.append('photo', photoFile);
      await purchaseApi.submitPurchaseRequest(data);
      setMessage({ tone: 'success', text: 'Purchase request sent to Director for approval!' });
      setFormData(BLANK_REQUEST);
      setPhotoFile(null);
      loadRequests();
    } catch {
      setMessage({ tone: 'danger', text: 'Failed to submit request' });
    }
    setSending(false);
  };

  return (
    <div className="tw:flex tw:min-h-screen tw:flex-col tw:gap-4 tw:bg-page tw:p-3 tw:md:p-5">
      <PageHeader icon={ShoppingCart} title="Purchase Management" subtitle="Admin Module - Submit purchase requests for approval" />

      <div className="tw:grid tw:grid-cols-1 tw:items-start tw:gap-4 tw:lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle icon={<FileText />}>New Purchase Request</CardTitle></CardHeader>
          <CardContent>
            {message && <Notice tone={message.tone}>{message.text}</Notice>}
            <form onSubmit={submitRequest} className="tw:flex tw:flex-col tw:gap-3">
              <FormFields fields={REQUEST_FIELDS} values={formData} onChange={changeField} className="tw:gap-3 tw:md:grid-cols-6" />
              <Field label="Attach Product Photo / Quotation (Optional)" layout="col">
                <FilePicker accept="image/*,.pdf" file={photoFile} onFile={setPhotoFile} />
              </Field>
              <Button type="submit" variant="default" size="lg" disabled={sending}>
                <Send /> {sending ? 'Sending to Director...' : 'Submit for Approval'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Requests</CardTitle></CardHeader>
          <CardContent className="tw:max-h-[550px] tw:overflow-y-auto">
            {recentRequests.map((request) => <PurchaseRequestCard key={request.id} request={request} />)}
            {recentRequests.length === 0 && (
              <p className="tw:mt-10 tw:text-center tw:text-muted-foreground">No recent purchase requests found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
