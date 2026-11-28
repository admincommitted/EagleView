import { useState } from 'react';
import { AlertCircle, FileText, FileUp, Search, Send } from 'lucide-react';
import { Badge, Button, Checkbox, DataTable, Field, FileButton, Input, NumberInput, SelectBox, Textarea } from '@/components/ui';
import useExpenseRequest from './FreightOpsParts/useExpenseRequest';

const CURRENCIES = ['INR', 'USD'];
const URGENCIES = [{ value: 'Normal', label: 'Normal' }, { value: 'High', label: 'High (Immediate Payment)' }];

const ledgerOptions = (ledgers) => ledgers.map((ledger) => ({ value: String(ledger.id), label: ledger.name }));

const RECENT_COLUMNS = [
  { key: 'id', header: 'Req No' },
  { key: 'job', header: 'Job No', className: 'tw:font-medium tw:text-primary' },
  { key: 'amount', header: 'Amount', align: 'right', className: 'tw:font-semibold', cell: (request) => '₹' + request.amount.toLocaleString('en-IN') },
  {
    key: 'status',
    header: 'Status',
    cell: (request) => <Badge variant={request.status === 'Approved' ? 'success' : 'warning'} className="tw:uppercase">{request.status}</Badge>,
  },
];

function Card({ title, icon: Icon, children }) {
  return (
    <div className="tw:min-w-0 tw:rounded-lg tw:border tw:border-border tw:bg-card">
      <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-t-lg tw:border-b tw:border-border tw:bg-page tw:px-5 tw:py-4">
        {Icon && <Icon className="tw:size-[18px] tw:text-primary" />}
        <h3 className="tw:m-0 tw:text-[15px] tw:text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function JobExpenseRequest() {
  const [requestData, setRequestData] = useState({
    jobNo: '', vendor: '', expenseHead: '', amount: '', currency: 'INR', reimbursable: true, urgency: 'Normal', narration: '',
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const { recentRequests, payees, heads, submit } = useExpenseRequest();

  const setField = (key) => (value) => setRequestData({ ...requestData, [key]: value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    if (await submit(requestData)) {
      setRequestData({ ...requestData, amount: '', narration: '' });
      setFile(null);
    }
    setBusy(false);
  };

  return (
    <div className="tw:mx-auto tw:max-w-[1200px] tw:p-5">
      <div className="tw:mb-5">
        <h2 className="tw:m-0 tw:text-[22px] tw:font-bold tw:text-foreground">Operations: Job Expense & Payment Request</h2>
        <p className="tw:mt-1 tw:mb-0 tw:text-[13px] tw:text-muted-foreground">Request vendor payments or job expenses. Will be routed for approval automatically.</p>
      </div>

      <div className="tw:flex tw:flex-col tw:gap-5 tw:lg:flex-row tw:lg:items-start">
        <div className="tw:min-w-0 tw:lg:flex-[1.5]">
          <Card title="New Payment Requisition" icon={FileText}>
            <form onSubmit={handleSubmit} className="tw:flex tw:flex-col tw:gap-5 tw:p-5">
              <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:md:grid-cols-2">
                <Field layout="col" label="Link to Job / Shipment No *" note="Cost will be allocated to this job's P&L">
                  <Input data-allow-text leftIcon={Search} className="tw:bg-primary/5" placeholder="Search Job No. or AWB..." value={requestData.jobNo} onChange={(event) => setField('jobNo')(event.target.value)} />
                </Field>
                <Field layout="col" label="Vendor / Payee Name *">
                  <SelectBox
                    clearable
                    clearLabel={payees.length ? '-- Select Vendor --' : '-- No creditor ledgers yet --'}
                    placeholder={payees.length ? '-- Select Vendor --' : '-- No creditor ledgers yet --'}
                    value={requestData.vendor}
                    onValueChange={setField('vendor')}
                    options={ledgerOptions(payees)}
                  />
                </Field>
              </div>

              <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:md:grid-cols-3">
                <Field layout="col" label="Expense Head">
                  <SelectBox
                    clearable
                    clearLabel={heads.length ? '-- Select Charge --' : '-- No expense ledgers yet --'}
                    placeholder={heads.length ? '-- Select Charge --' : '-- No expense ledgers yet --'}
                    value={requestData.expenseHead}
                    onValueChange={setField('expenseHead')}
                    options={ledgerOptions(heads)}
                  />
                </Field>
                <Field layout="col" label="Amount *">
                  <div className="tw:flex tw:min-w-0 tw:flex-1">
                    <SelectBox className="tw:w-20 tw:shrink-0 tw:rounded-r-none tw:bg-page" value={requestData.currency} onValueChange={setField('currency')} options={CURRENCIES} />
                    <NumberInput className="tw:rounded-l-none tw:font-bold" placeholder="0.00" value={requestData.amount} onValueChange={setField('amount')} />
                  </div>
                </Field>
                <Field layout="col" label="Urgency">
                  <SelectBox value={requestData.urgency} onValueChange={setField('urgency')} options={URGENCIES} />
                </Field>
              </div>

              <div className="tw:flex tw:items-start tw:gap-2.5 tw:rounded-md tw:border tw:border-dashed tw:border-success/60 tw:bg-success/10 tw:p-3">
                <AlertCircle className="tw:mt-0.5 tw:size-[18px] tw:shrink-0 tw:text-success" />
                <div>
                  <label className="tw:m-0 tw:flex tw:cursor-pointer tw:items-center tw:gap-2 tw:text-[13px] tw:font-semibold tw:text-success">
                    <Checkbox checked={requestData.reimbursable} onCheckedChange={(checked) => setField('reimbursable')(checked === true)} />
                    Bill this to Customer (Reimbursable)
                  </label>
                  <p className="tw:mt-1 tw:mb-0 tw:text-[11px] tw:text-success">
                    If checked, system will warn Accounts to include this amount in the final Job Invoice to the client.
                  </p>
                </div>
              </div>

              <Field layout="col" label="Upload Vendor Bill / Receipt">
                <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-2.5">
                  <FileButton variant="secondary" onFiles={(files) => setFile(files[0] || null)}><FileUp /> Choose File</FileButton>
                  {file && <span className="tw:truncate tw:text-entry tw:text-primary">{file.name}</span>}
                </div>
              </Field>

              <Field layout="col" label="Remarks / Narration">
                <Textarea rows={3} placeholder="Why is this payment needed?" value={requestData.narration} onChange={(event) => setField('narration')(event.target.value)} />
              </Field>

              <Button type="submit" variant="default" size="lg" disabled={busy} className="tw:w-full">
                <Send /> Submit to Accounts for Approval
              </Button>
            </form>
          </Card>
        </div>

        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-5 tw:lg:flex-1">
          <Card title="My Recent Requests">
            <DataTable columns={RECENT_COLUMNS} rows={recentRequests} emptyText="No pending request" />
          </Card>

          <div className="tw:rounded-lg tw:border tw:border-warning/40 tw:bg-warning/10 tw:p-4">
            <h4 className="tw:mt-0 tw:mb-2 tw:flex tw:items-center tw:gap-1.5 tw:text-[14px] tw:text-warning"><AlertCircle className="tw:size-4" /> Important Note</h4>
            <p className="tw:m-0 tw:text-entry tw:leading-normal tw:text-warning">
              Only approved expenses will be processed for payment by accounts. Please upload valid vendor invoices for faster clearance. For High Urgency items, please inform the respective branch manager after submission.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
