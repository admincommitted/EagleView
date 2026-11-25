import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Send } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Card, CardContent, Field, Label, Section, SelectBox, Textarea } from '@/components/ui';
import { purchaseApi } from './PurchaseParts/purchaseApi';
import FilePicker from './PurchaseParts/FilePicker';
import Notice from './PurchaseParts/Notice';
import POItemsEditor from './PurchaseParts/POItemsEditor';
import QuickVendorModal from './PurchaseParts/QuickVendorModal';
import { blankItem, branchRows, CATEGORY_OPTIONS, poBranches } from './PurchaseParts/purchaseFormat';

const DEFAULT_BRANCH = 'Head Office';
const PRIORITY_OPTIONS = ['Normal', 'Urgent'];

const PO_TERMS = [
  ['GST & INVOICING', 'VALID GSTIN AND PROPER HSN/SAC CODES ARE MANDATORY ON THE FINAL INVOICE.'],
  ['DELIVERY', 'MATERIALS MUST BE DELIVERED TO THE COMMITTED CARGO CARE LIMITED, MAHIPALPUR OFFICE DURING STANDARD WORKING HOURS.'],
  ['PAYMENT TERMS', 'PAYMENT WILL BE PROCESSED UPON SUCCESSFUL MATERIAL VERIFICATION AND INVOICE SUBMISSION, SUBJECT TO AGREED CREDIT TERMS.'],
  ['REJECTIONS', 'DEFECTIVE OR NON-COMPLIANT ITEMS WILL BE REJECTED; RETURN FREIGHT WILL BE BORNE BY THE VENDOR.'],
];

const isBlank = (value) => value === '' || value == null;

function itemProblem(item, line) {
  if (!item.itemName) return `Item ${line}: enter the item name`;
  if (isBlank(item.quantity) || Number(item.quantity) < 1) return `Item ${line}: the quantity must be at least 1`;
  if (isBlank(item.unitPrice)) return `Item ${line}: enter the unit price`;
  if (isBlank(item.gstRate) || Number(item.gstRate) > 100) return `Item ${line}: the GST rate must be 0 to 100`;
  return '';
}

function poProblem(formData, items) {
  if (!formData.vendorId) return 'Select the vendor';
  const itemMessage = items.map((item, index) => itemProblem(item, index + 1)).find(Boolean);
  if (itemMessage) return itemMessage;
  return formData.justification ? '' : 'Remarks are required';
}

function PoTerms() {
  return (
    <Notice tone="warning" title="TERMS & CONDITIONS" className="tw:text-foreground">
      <ul className="tw:m-0 tw:pl-5 tw:text-[11px] tw:leading-normal tw:text-muted-foreground">
        {PO_TERMS.map(([heading, text]) => <li key={heading}><b>{heading}:</b> {text}</li>)}
      </ul>
      <i className="tw:text-[11px] tw:font-medium tw:text-muted-foreground">* NOTE: ALL DISPUTES ARE SUBJECT TO DELHI JURISDICTION ONLY.</i>
    </Notice>
  );
}

export default function AdvancedPO() {
  const [vendors, setVendors] = useState([]);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [formData, setFormData] = useState({ vendorId: '', branch: DEFAULT_BRANCH, category: 'IT Assets', priority: 'Normal', justification: '' });
  const [items, setItems] = useState([blankItem()]);
  const [quoteFile, setQuoteFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState([]);

  const loadVendors = async () => {
    try {
      setVendors(await purchaseApi.vendors());
    } catch (error) {
      console.error(errorMessage(error));
    }
  };

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const list = poBranches(branchRows(await purchaseApi.companyBranches()));
        setBranches(list);
        if (list.length) setFormData((current) => (current.branch === DEFAULT_BRANCH ? { ...current, branch: list[0].branchName } : current));
      } catch (error) {
        console.error('Failed to fetch branches', errorMessage(error));
      }
    };
    loadVendors();
    loadBranches();
  }, []);

  const setField = (name) => (value) => setFormData((current) => ({ ...current, [name]: value }));

  const createPo = async (event) => {
    event.preventDefault();
    const problem = poProblem(formData, items);
    if (problem) { toast.error(problem); return; }

    setSaving(true);
    try {
      const data = new FormData();
      ['vendorId', 'branch', 'category', 'priority', 'justification'].forEach((key) => data.append(key, formData[key]));
      data.append('items', JSON.stringify(items));
      if (quoteFile) data.append('quote', quoteFile);
      await purchaseApi.createPurchaseOrder(data);
      toast.success('PO Created successfully and sent to Director!');
      setFormData((current) => ({ ...current, justification: '' }));
      setItems([blankItem()]);
      setQuoteFile(null);
    } catch {
      toast.error('Error creating PO');
    }
    setSaving(false);
  };

  const branchOptions = branches.length ? branches.map((branch) => branch.branchName) : [DEFAULT_BRANCH];
  const vendorOptions = vendors.map((vendor) => ({ value: vendor.id, label: vendor.vendorName }));

  return (
    <Card>
      <CardContent className="tw:p-3 tw:md:p-5">
        <form onSubmit={createPo} className="tw:flex tw:flex-col tw:gap-5">
          <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
            <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5">
              <div className="tw:flex tw:items-center tw:justify-between">
                <Label required>Select Vendor</Label>
                <Button variant="link" size="sm" onClick={() => setShowVendorModal(true)}><Plus /> Add New</Button>
              </div>
              <SelectBox required className="tw:w-full" placeholder="-- Select --" value={formData.vendorId} options={vendorOptions} onValueChange={setField('vendorId')} />
            </div>
            <Field label="Branch" layout="col"><SelectBox className="tw:w-full" value={formData.branch} options={branchOptions} onValueChange={setField('branch')} /></Field>
            <Field label="Category" layout="col"><SelectBox className="tw:w-full" value={formData.category} options={CATEGORY_OPTIONS} onValueChange={setField('category')} /></Field>
            <Field label="Priority" layout="col"><SelectBox className="tw:w-full" value={formData.priority} options={PRIORITY_OPTIONS} onValueChange={setField('priority')} /></Field>
          </div>

          <Section title="Items List *">
            <POItemsEditor items={items} onItemsChange={setItems} />
          </Section>

          <Field label="Quotation File (PDF/Image)" layout="col">
            <FilePicker file={quoteFile} onFile={setQuoteFile} />
          </Field>

          <Field label="REMARKS" layout="col" required>
            <Textarea required rows={3} data-allow-text="" value={formData.justification} onChange={(event) => setField('justification')(event.target.value)} />
          </Field>
          <PoTerms />

          <div className="tw:flex tw:justify-end">
            <Button type="submit" variant="default" size="lg" disabled={saving}><Send /> {saving ? 'Processing...' : 'GENERATE PO & SEND TO APPROVAL'}</Button>
          </div>
        </form>
      </CardContent>

      <QuickVendorModal open={showVendorModal} onClose={() => setShowVendorModal(false)}
        onAdded={() => { loadVendors(); setShowVendorModal(false); }} />
    </Card>
  );
}
