import { useCallback, useEffect, useState } from 'react';
import { Building, CheckCircle, FileText, Image as ImageIcon, Landmark, Link, Mail, MapPin, Save, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button, Field, FileButton, Input, Separator, Textarea } from '@/components/ui';
import { replyOf, settingsApi } from '@/components/Settings/settingsApi';
import SettingsNotice from '@/components/Settings/SettingsNotice';

const BLANK = {
  companyName: '', legalName: '', tagline: '', email: '', phone: '', website: '',
  address1: '', address2: '', city: '', state: '', pincode: '', country: 'INDIA',
  pan: '', gstin: '', iec: '', lutNo: '', cin: '',
  bankName: '', accountName: '', accountNo: '', ifsc: '', swift: '',
  smtpHost: '', smtpPort: '', smtpUser: '', smtpPass: '',
  einvoiceUser: '', einvoicePass: '', einvoiceBaseUrl: '',
  fax: '', registeredOffice: '', invoiceNotes: '',
};
// saved with the company profile; the passwords (einvoicePass, smtpPass) only when typed - blank keeps the saved one
const COMPANY_KEYS = ['companyName', 'legalName', 'tagline', 'email', 'phone', 'website', 'address1', 'address2', 'city', 'state',
  'pincode', 'country', 'pan', 'gstin', 'iec', 'lutNo', 'cin', 'bankName', 'accountName', 'accountNo', 'ifsc',
  'swift', 'einvoiceUser', 'einvoiceBaseUrl', 'fax', 'registeredOffice', 'invoiceNotes'];

// what the GST invoice prints when these boxes are empty (as on the iCAFFE invoice)
const INVOICE_DEFAULT_REG = 'A-406, Road No. 4,Street No.8, Mahipalpur Extn. New Delhi - 110037, India Tel : +91 (11) 46151111 Email : contact@committedcargo.com';
const INVOICE_DEFAULT_NOTES = ['This Invoice System Generated Signature No Require.', 'E & O. E.,', 'We reserve the right to charge interest @ 18% p.a. on amount outstanding after the due date.', "All Cheques & Demand Drafts should be in favour of 'COMMITTED CARGO CARE LIMITED'", 'Cheques / Drafts are subject to realisation.', 'Any dispute, discrepany or any supporting documents required must be notified within 7 days, failing which the Invoice will be treated as true and correct.', 'All disputes are subject to NEW DELHI jurisdiction.'].join('\n');

// stored with the profile as a data URL and printed on every invoice
const MAX_LOGO_BYTES = 400 * 1024;

const TABS = [
  { id: 'general', label: 'General Profile', icon: Building },
  { id: 'address', label: 'Address & Contact', icon: MapPin },
  { id: 'tax', label: 'Tax & Compliance', icon: FileText },
  { id: 'bank', label: 'Bank Details', icon: Landmark },
  { id: 'invoice', label: 'Invoice Print', icon: FileText },
  { id: 'smtp', label: 'Email (SMTP) Setup', icon: Mail, separatorBefore: true },
  { id: 'api', label: 'API & E-Invoice', icon: Link },
];

const TWO_COLUMNS = 'tw:grid-cols-1 tw:md:grid-cols-2';

// field: { name, label, type: 'text' | 'email' | 'password' | 'textarea', maxLength, rows, placeholder (text or (smtpHasPassword) => text), wide }
const PANELS = {
  general: {
    title: 'General Profile', icon: Building,
    groups: [
      { fields: [{ name: 'companyName', label: 'Company Name (Printed on Invoices)' }, { name: 'tagline', label: 'Tagline / Slogan' }] },
      { columns: TWO_COLUMNS, fields: [{ name: 'email', label: 'Primary Email', type: 'email' }, { name: 'website', label: 'Website' }] },
    ],
  },
  address: {
    title: 'Registered Address', icon: MapPin,
    groups: [
      { fields: [{ name: 'address1', label: 'Address Line 1' }, { name: 'address2', label: 'Address Line 2 (Optional)' }] },
      {
        columns: TWO_COLUMNS,
        fields: [{ name: 'city', label: 'City' }, { name: 'state', label: 'State' }, { name: 'pincode', label: 'PIN Code / Zip' }, { name: 'country', label: 'Country' }],
      },
      { columns: TWO_COLUMNS, fields: [{ name: 'phone', label: 'Corporate Phone Number' }, { name: 'fax', label: 'Fax Number', placeholder: '011-46040343' }] },
    ],
  },
  tax: {
    title: 'Tax & Compliance (India)', icon: FileText,
    groups: [{
      columns: TWO_COLUMNS,
      fields: [
        { name: 'pan', label: 'Company PAN Number', maxLength: 10 },
        { name: 'gstin', label: 'GSTIN Number', maxLength: 15 },
        { name: 'lutNo', label: 'LUT No. (For Export without IGST)' },
        { name: 'cin', label: 'CIN (Corporate Identity Number)' },
        { name: 'iec', label: 'IEC (Importer Exporter Code)', maxLength: 10 },
        { name: 'legalName', label: 'Legal Name (as in the GST registration)' },
      ],
    }],
  },
  invoice: {
    title: 'Invoice Print', icon: FileText,
    intro: 'Printed at the foot of every GST invoice. Left empty, the invoice prints the text shown in grey (as on the iCAFFE invoice). The bank details on the invoice are fixed.',
    groups: [{
      fields: [
        { name: 'registeredOffice', label: 'Registered Office (one line)', type: 'textarea', rows: 2, placeholder: INVOICE_DEFAULT_REG },
        { name: 'invoiceNotes', label: 'Invoice Notes - "Spl. Note" (one note per line; the first prints in bold)', type: 'textarea', rows: 8, placeholder: INVOICE_DEFAULT_NOTES },
      ],
    }],
  },
  bank: {
    title: 'Bank Details (For Invoice Footer)', icon: Landmark,
    groups: [{
      columns: TWO_COLUMNS,
      fields: [
        { name: 'bankName', label: 'Bank Name' },
        { name: 'accountName', label: 'Account Name' },
        { name: 'accountNo', label: 'Account Number' },
        { name: 'ifsc', label: 'IFSC Code' },
        { name: 'swift', label: 'SWIFT Code (For Overseas Remittance)' },
      ],
    }],
  },
  smtp: {
    title: 'Email (SMTP) Setup', icon: Mail,
    intro: 'Configure these credentials to send Quotes, Invoices, and DSRs directly from the ERP.',
    groups: [{
      columns: TWO_COLUMNS,
      fields: [
        { name: 'smtpHost', label: 'SMTP Host' },
        { name: 'smtpPort', label: 'SMTP Port' },
        { name: 'smtpUser', label: 'SMTP Username (Email)' },
        {
          name: 'smtpPass', label: 'SMTP Password / App Password', type: 'password',
          placeholder: (smtpHasPassword) => (smtpHasPassword ? 'A password is saved - leave blank to keep it' : 'Not set yet'),
        },
      ],
    }],
  },
  api: {
    title: 'API & E-Invoice Integration', icon: Link,
    intro: 'API Credentials for Govt E-Invoice Portal and ICEGATE integrations.',
    groups: [{
      columns: TWO_COLUMNS,
      fields: [
        { name: 'einvoiceUser', label: 'E-Invoice API Username' },
        { name: 'einvoicePass', label: 'E-Invoice API Password', type: 'password', placeholder: 'Leave blank to keep the saved one' },
        { name: 'einvoiceBaseUrl', label: 'E-Invoice API URL (from your GSP / NIC)', placeholder: 'https://<gsp-host>/eivital/v1.04/auth', wide: true },
      ],
    }],
  },
};

// null when it saved, else the messages to show: the server's list, its error, or the HTTP status
async function saveProblems(request, what) {
  try {
    const reply = await request;
    return reply.success === false ? (reply.errors || [reply.error || `${what} did not save (HTTP 200)`]) : null;
  } catch (error) {
    if (!error.response) throw error;
    const reply = error.response.data || {};
    return reply.errors || [reply.error || `${what} did not save (HTTP ${error.response.status})`];
  }
}

const asText = (value) => (value != null ? String(value) : '');

function CompanyField({ field, value, onChange, smtpHasPassword }) {
  const placeholder = typeof field.placeholder === 'function' ? field.placeholder(smtpHasPassword) : field.placeholder;
  const common = { name: field.name, value, placeholder, onChange: (event) => onChange(field.name, event.target.value) };
  return (
    <Field label={field.label} layout="col" className={cn(field.wide && 'tw:md:col-span-2')} labelClassName="tw:mb-1 tw:whitespace-normal tw:text-xs tw:font-bold tw:text-slate-600">
      {field.type === 'textarea'
        ? <Textarea {...common} data-allow-text="" rows={field.rows} className="tw:h-auto tw:px-3.5 tw:py-2.5 tw:text-[13px]" />
        : <Input {...common} type={field.type || 'text'} data-allow-text="" maxLength={field.maxLength} className="tw:h-10 tw:px-3.5 tw:text-[13px]" />}
    </Field>
  );
}

function LogoPanel({ logo, defaultLogo, logoCleared, onFile, onRemove }) {
  const shownLogo = logo || defaultLogo;
  return (
    <div className="tw:flex tw:w-40 tw:shrink-0 tw:flex-col tw:gap-1.5 tw:self-center tw:md:self-start">
      <span className="tw:text-xs tw:font-bold tw:text-slate-600">Company Logo</span>
      <FileButton
        accept="image/*"
        onFiles={(files) => onFile(files[0])}
        variant="ghost"
        title="Upload new logo"
        className="tw:size-40 tw:flex-col tw:overflow-hidden tw:rounded-lg tw:border-2 tw:border-dashed tw:border-slate-300 tw:bg-slate-50 tw:p-0 tw:hover:bg-slate-50"
      >
        {shownLogo ? (
          <img src={shownLogo} alt="Company Logo" className="tw:size-full tw:object-contain" />
        ) : (
          <>
            <ImageIcon className="tw:mb-2 tw:size-8 tw:text-slate-400" />
            <span className="tw:text-xs tw:font-normal tw:text-slate-500">No Logo Uploaded</span>
          </>
        )}
      </FileButton>
      <div className={cn('tw:text-center tw:text-[11px]', logo ? 'tw:text-green-600' : 'tw:text-slate-500')}>
        {logo ? (logoCleared ? '' : 'Your logo - printed on invoices') : 'Default logo - printed on invoices'}
      </div>
      <div className="tw:flex tw:gap-1.5">
        <FileButton accept="image/png,image/jpeg,image/webp,image/svg+xml" onFiles={(files) => onFile(files[0])} variant="default" className="tw:h-7 tw:flex-1 tw:text-xs">
          Change Logo
        </FileButton>
        {logo && (
          <Button variant="destructive" className="tw:h-7 tw:flex-1 tw:text-xs" title="Remove your logo - the default logo prints again" onClick={onRemove}>Remove</Button>
        )}
      </div>
      <div className="tw:text-center tw:text-[11px] tw:text-slate-400">PNG / JPG, under 400 KB, square works best. Press Save to keep it.</div>
    </div>
  );
}

function FieldGroups({ groups, form, onChange, smtpHasPassword }) {
  return groups.map((group, index) => (
    <div key={index} className={cn('tw:grid tw:gap-4', group.columns || 'tw:grid-cols-1', index > 0 && 'tw:mt-4')}>
      {group.fields.map((field) => (
        <CompanyField key={field.name} field={field} value={form[field.name]} onChange={onChange} smtpHasPassword={smtpHasPassword} />
      ))}
    </div>
  ));
}

export default function CompanySettings() {
  const [activeTab, setActiveTab] = useState('general');
  const [logo, setLogo] = useState(null);
  const [defaultLogo, setDefaultLogo] = useState('');
  const [logoCleared, setLogoCleared] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [smtpHasPassword, setSmtpHasPassword] = useState(false);
  const [lastTest, setLastTest] = useState(null);

  const loadDefaultLogo = async () => {
    try {
      const { body } = await replyOf(settingsApi.defaultCompanyLogo());
      setDefaultLogo(body.dataUrl || '');
    } catch {
      // the box shows "No Logo Uploaded"
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [companyReply, emailReply] = await Promise.all([replyOf(settingsApi.companyProfile()), replyOf(settingsApi.emailConfig())]);
      const company = companyReply.body.data || {};
      const email = emailReply.body.data || {};
      setForm({
        ...BLANK,
        ...Object.fromEntries(Object.keys(BLANK).map((key) => [key, company[key] != null ? String(company[key]) : BLANK[key]])),
        smtpHost: email.smtpHost || '',
        smtpPort: asText(email.smtpPort),
        smtpUser: email.smtpUser || '',
        smtpPass: '',
      });
      setSmtpHasPassword(Boolean(email.hasPassword));
      setLogo(company.logoDataUrl || null);
      setLogoCleared(false);
      loadDefaultLogo();
      if (company.einvoiceLastTestAt) {
        setLastTest({ at: company.einvoiceLastTestAt, ok: company.einvoiceLastTestOk, message: company.einvoiceLastTestMessage });
      }
    } catch (error) {
      toast.error(`Could not load company settings: ${error.message}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const handleLogoFile = (file) => {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Logo must be under 400 KB - it is stored with the company profile and printed on every invoice.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setLogo(String(reader.result)); setLogoCleared(false); };
    reader.onerror = () => toast.error('Could not read that image');
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const company = Object.fromEntries(COMPANY_KEYS.map((key) => [key, form[key] || null]));
      if (form.einvoicePass) company.einvoicePass = form.einvoicePass;
      if (logo) company.logoDataUrl = logo;
      else if (logoCleared) company.logoDataUrl = null;

      const companyProblems = await saveProblems(settingsApi.saveCompanyProfile(company), 'Company profile');
      if (companyProblems) {
        setErrors(companyProblems);
        toast.error('Company profile not saved - see the messages on screen');
        setSaving(false);
        return;
      }

      const email = { smtpHost: form.smtpHost || null, smtpUser: form.smtpUser || null };
      if (form.smtpPort !== '') email.smtpPort = form.smtpPort;
      if (form.smtpPass) email.smtpPass = form.smtpPass;
      const emailProblems = await saveProblems(settingsApi.saveEmailConfig(email), 'Email settings');
      if (emailProblems) {
        setErrors(emailProblems);
        toast.error('Company profile saved, but the email settings did not');
        setSaving(false);
        await load();
        return;
      }
      toast.success('Saved');
      await load();
    } catch (error) {
      toast.error(`Save failed: ${error.message}`);
    }
    setSaving(false);
  };

  const handleTestEinvoice = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { status, body } = await replyOf(settingsApi.testEinvoice({ baseUrl: form.einvoiceBaseUrl || undefined, username: form.einvoiceUser || undefined }));
      setTestResult({ ok: Boolean(body.success), text: body.message || body.error || `HTTP ${status}` });
      if (body.success) toast.success('Endpoint reachable');
      else toast.error('Test failed');
    } catch (error) {
      setTestResult({ ok: false, text: `Could not run the test: ${error.message}` });
      toast.error('Test failed');
    }
    setTesting(false);
  };

  const panel = PANELS[activeTab];
  const PanelIcon = panel.icon;
  const busy = saving || loading;
  const card = 'tw:mb-6 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-card tw:shadow-sm';

  return (
    <div className="tw:mx-auto tw:max-w-[1200px] tw:p-3 tw:font-['Segoe_UI'] tw:md:p-6">
      <div className="tw:mb-6 tw:flex tw:flex-col tw:gap-4 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <div className="tw:flex tw:items-center tw:gap-3">
          <div className="tw:rounded-lg tw:bg-slate-600 tw:p-3 tw:text-white"><Settings className="tw:size-6" /></div>
          <div>
            <h2 className="tw:m-0 tw:text-2xl tw:font-bold tw:text-slate-900">Company Settings</h2>
            <div className="tw:mt-1 tw:text-[13px] tw:text-slate-500">Manage your branding, registered address, and compliance details</div>
          </div>
        </div>
        <Button variant="default" size="lg" className="tw:h-10 tw:self-start tw:px-6 tw:text-sm tw:font-bold tw:md:self-auto" disabled={busy} onClick={handleSave}>
          <Save className="tw:size-[18px]" /> {saving ? 'Saving...' : loading ? 'Loading...' : 'Save Settings'}
        </Button>
      </div>

      {errors.length > 0 && (
        <div className="tw:mb-5 tw:rounded-lg tw:border tw:border-red-200 tw:bg-red-50 tw:px-4.5 tw:py-3.5">
          <div className="tw:mb-1.5 tw:text-[13px] tw:font-bold tw:text-red-800">Nothing was saved. Fix these first:</div>
          <ul className="tw:m-0 tw:pl-5 tw:text-[13px] tw:text-red-700">
            {errors.map((error, index) => <li key={index}>{error}</li>)}
          </ul>
        </div>
      )}

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-[250px_1fr] tw:lg:gap-8">
        <nav className={cn(card, 'tw:flex tw:min-w-0 tw:overflow-x-auto tw:py-3 tw:lg:flex-col tw:lg:overflow-x-visible')}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <div key={tab.id} className="tw:contents">
                {tab.separatorBefore && <Separator className="tw:my-2 tw:hidden tw:lg:block" />}
                <Button
                  variant="ghost"
                  className={cn(
                    'tw:h-auto tw:w-auto tw:shrink-0 tw:justify-start tw:gap-2.5 tw:rounded-none tw:border-0 tw:border-l-[3px] tw:px-6 tw:py-3 tw:text-left tw:text-sm tw:lg:w-full',
                    active ? 'tw:border-l-blue-600 tw:bg-slate-100 tw:font-bold tw:text-slate-900' : 'tw:border-l-transparent tw:font-normal tw:text-slate-500'
                  )}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon className="tw:size-[18px]" /> {tab.label}
                </Button>
              </div>
            );
          })}
        </nav>

        <div className="tw:min-w-0">
          <div className={cn(card, 'tw:p-4 tw:md:p-6')}>
            <h3 className={cn('tw:mt-0 tw:flex tw:items-center tw:gap-2 tw:text-slate-900', activeTab === 'invoice' ? 'tw:mb-2' : 'tw:mb-6')}>
              <PanelIcon className="tw:size-5 tw:text-blue-600" /> {panel.title}
            </h3>
            {panel.intro && <div className={cn('tw:mb-5 tw:text-slate-500', activeTab === 'invoice' ? 'tw:text-xs' : 'tw:text-[13px]')}>{panel.intro}</div>}

            {activeTab === 'general' ? (
              <div className="tw:mb-8 tw:flex tw:flex-col tw:gap-6 tw:md:flex-row tw:md:gap-10">
                <LogoPanel
                  logo={logo}
                  defaultLogo={defaultLogo}
                  logoCleared={logoCleared}
                  onFile={handleLogoFile}
                  onRemove={() => { setLogo(null); setLogoCleared(true); }}
                />
                <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
                  <FieldGroups groups={panel.groups} form={form} onChange={setField} smtpHasPassword={smtpHasPassword} />
                </div>
              </div>
            ) : (
              <FieldGroups groups={panel.groups} form={form} onChange={setField} smtpHasPassword={smtpHasPassword} />
            )}

            {activeTab === 'tax' && (
              <div className="tw:mt-6 tw:flex tw:gap-3 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4">
                <CheckCircle className="tw:size-5 tw:shrink-0 tw:text-emerald-500" />
                <div className="tw:text-[13px] tw:text-slate-600">These details will be strictly used while generating standard PDF Tax Invoices, Debit Notes, and Quotations. Please ensure your GSTIN is accurate.</div>
              </div>
            )}

            {activeTab === 'api' && (
              <>
                <div className="tw:mt-6 tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-center">
                  <Button size="lg" className="tw:self-start tw:text-[13px] tw:font-bold" disabled={testing} onClick={handleTestEinvoice}>
                    {testing ? 'Contacting the endpoint...' : 'Test E-Invoice API Connection'}
                  </Button>
                  <span className="tw:text-xs tw:text-slate-500">Save first - the test uses the URL and username in the boxes above.</span>
                </div>
                {testResult && (
                  <SettingsNotice tone={testResult.ok ? 'success' : 'error'} className="tw:mt-4 tw:px-4 tw:py-3 tw:font-normal">{testResult.text}</SettingsNotice>
                )}
                {!testResult && lastTest && (
                  <div className="tw:mt-4 tw:text-xs tw:text-slate-500">
                    Last test {new Date(lastTest.at).toLocaleString('en-GB')} - {lastTest.ok ? 'reachable' : 'failed'}: {lastTest.message}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
