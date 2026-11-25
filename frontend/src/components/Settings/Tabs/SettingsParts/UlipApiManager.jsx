import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Play, Plus, RotateCcw, Save, Search, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Checkbox, DataTable, Field, Input, Modal, SelectBox } from '@/components/ui';
import askConfirm from '@/components/common/askConfirm';
import { replyOf, settingsApi } from '../../settingsApi';
import { SettingsCard } from './SettingsCard';
import { SettingsFields } from './SettingsFields';

// Each ULIP API (table UlipApi): after Save it shows in the list, where it can be edited, switched on / off, tested
// with sample values, or deleted. {name} in the request body is a value asked at run time.
const EMPTY_API = { apiCode: '', apiName: '', category: '', method: 'POST', path: '', requestTemplate: '{\n  \n}', description: '', isActive: true, sortOrder: 0 };
const CATEGORIES = ['DGFT', 'VAHAN', 'SARATHI', 'FASTAG', 'ICEGATE', 'LDB', 'PCS', 'ACMES', 'ENC', 'FOIS', 'GST', 'DIGILOCKER', 'OTHER'];
const PARAM_PATTERN = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

const ulipErrorText = (error) => {
  if (!error.response) return error.message;
  const data = error.response.data || {};
  return data.error || data.message || `HTTP ${error.response.status}`;
};
const paramsOf = (template) => [...new Set((String(template || '').match(PARAM_PATTERN) || []).map((tag) => tag.slice(1, -1)))];
const formatWhen = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return isNaN(date) ? '' : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const fullUrl = (base, path) => (/^https:\/\//.test(path) ? '' : base) + (path || '');

const apiFields = ({ base, categories, jsonError }) => [
  { name: 'apiCode', label: 'API code', required: true, maxLength: 60, placeholder: 'e.g. VAHAN/01', clean: (text) => text.toUpperCase().replace(/\s/g, '') },
  { name: 'apiName', label: 'API name', required: true, maxLength: 150, placeholder: 'e.g. Vehicle details', className: 'tw:sm:col-span-2' },
  { name: 'category', label: 'Category', kind: 'combo', upper: true, options: categories, placeholder: 'VAHAN' },
  { name: 'method', label: 'Method', kind: 'select', options: ['POST', 'GET', 'PUT'] },
  {
    name: 'path', label: 'Path', required: true, placeholder: '/VAHAN/01', clean: (text) => text.trim(), className: 'tw:sm:col-span-2',
    note: ({ path }) => `Full URL: ${fullUrl(base, path)}`, controlClassName: 'tw:normal-case',
  },
  { name: 'sortOrder', label: 'Order', kind: 'number' },
  { name: 'isActive', label: 'Active', kind: 'checkbox', className: 'tw:self-center tw:md:mt-4' },
  {
    name: 'requestTemplate', label: 'Request body (JSON) - write a value to fill at run time as {name}, e.g. {"vehiclenumber": "{vehicleNo}"}',
    kind: 'textarea', className: 'tw:col-span-full', controlClassName: 'tw:min-h-[90px] tw:font-mono tw:normal-case', invalid: () => Boolean(jsonError),
    note: ({ requestTemplate }) => {
      if (jsonError) return <span className="tw:text-destructive">Not valid JSON: {jsonError}</span>;
      const params = paramsOf(requestTemplate);
      return params.length ? `Values asked at run time: ${params.join(', ')}` : 'No run-time values';
    },
  },
  { name: 'description', label: 'Description / notes', placeholder: 'What this API returns, where it is used', className: 'tw:col-span-full' },
];

function UlipTestModal({ api, base, onClose, onTested }) {
  const [params, setParams] = useState(() => Object.fromEntries((api.params || []).map((name) => [name, ''])));
  const [testing, setTesting] = useState(false);
  const [outcome, setOutcome] = useState(null);

  const runTest = async () => {
    setTesting(true);
    setOutcome(null);
    try {
      const { status, body } = await replyOf(settingsApi.testUlipApi(api.id, params));
      setOutcome(body);
      if (body.success) toast.success(`${api.apiCode}: OK`);
      else toast.error(`${api.apiCode}: ${body.error || `HTTP ${body.httpStatus || status}`}`);
      onTested();
    } catch (error) {
      setOutcome({ success: false, error: error.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal open onClose={() => !testing && onClose()} title={`Test ${api.apiCode} - ${api.apiName}`} width={640} bodyClassName="tw:flex tw:flex-col tw:gap-2">
      <div className="tw:font-mono tw:text-[11px] tw:text-muted-foreground tw:normal-case">{api.method} {fullUrl(base, api.path)}</div>
      {(api.params || []).map((name) => (
        <Field key={name} layout="col" label={name}>
          <Input data-allow-text="" value={params[name] || ''} onChange={(event) => setParams((current) => ({ ...current, [name]: event.target.value }))} />
        </Field>
      ))}
      <div>
        <Button variant="success" size="lg" onClick={runTest} disabled={testing}><Play /> {testing ? 'CALLING ULIP...' : 'RUN TEST'}</Button>
      </div>
      {outcome && (
        <div className="tw:mt-1">
          <div className={cn('tw:text-entry tw:font-bold', outcome.success ? 'tw:text-success' : 'tw:text-destructive')}>
            {outcome.success ? 'Success' : 'Failed'}{outcome.httpStatus ? ` · HTTP ${outcome.httpStatus}` : ''}{outcome.ms ? ` · ${outcome.ms} ms` : ''}{outcome.error ? ` · ${outcome.error}` : ''}
          </div>
          {outcome.data !== undefined && (
            <pre className="tw:mt-1.5 tw:max-h-80 tw:overflow-auto tw:rounded-lg tw:bg-slate-900 tw:p-2.5 tw:text-[11px] tw:whitespace-pre-wrap tw:text-slate-200 tw:normal-case">
              {JSON.stringify(outcome.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Add / edit the ULIP APIs and the list of saved ones (search, switch on / off, test, delete). */
export function UlipApiManager() {
  const [apis, setApis] = useState([]);
  const [base, setBase] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_API);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [testApi, setTestApi] = useState(null);
  const formRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await settingsApi.ulipApis();
      setApis(result.data || []);
      setBase(result.baseUrl || '');
    } catch (error) {
      toast.error(`Could not load ULIP APIs: ${ulipErrorText(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const changeField = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const clearForm = () => {
    setForm(EMPTY_API);
    setEditId(null);
  };

  const jsonError = useMemo(() => {
    const template = String(form.requestTemplate || '').trim();
    if (!template) return '';
    try {
      JSON.parse(template.replace(PARAM_PATTERN, 'X'));
      return '';
    } catch (error) {
      return error.message;
    }
  }, [form.requestTemplate]);

  const save = async () => {
    if (!form.apiCode || !form.apiName || !form.path) { toast.error('API code, name and path are required'); return; }
    if (jsonError) { toast.error('Request body is not valid JSON'); return; }
    setSaving(true);
    try {
      if (editId) await settingsApi.updateUlipApi(editId, form);
      else await settingsApi.createUlipApi(form);
      toast.success(editId ? `${form.apiCode} updated` : `${form.apiCode} added`);
      clearForm();
      await load();
    } catch (error) {
      toast.error(`Not saved: ${ulipErrorText(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (api) => {
    setEditId(api.id);
    setForm({ ...EMPTY_API, ...api, requestTemplate: api.requestTemplate || '', description: api.description || '', category: api.category || '' });
    formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const remove = async (api) => {
    if (!(await askConfirm({ title: `Delete ULIP API ${api.apiCode}?`, okLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await settingsApi.deleteUlipApi(api.id);
      toast.success(`${api.apiCode} deleted`);
      if (editId === api.id) clearForm();
      load();
    } catch (error) {
      toast.error(`Not deleted: ${ulipErrorText(error)}`);
    }
  };

  const toggleActive = async (api) => {
    try {
      await settingsApi.updateUlipApi(api.id, { isActive: !api.isActive });
      load();
    } catch (error) {
      toast.error(ulipErrorText(error));
    }
  };

  const shown = apis.filter((api) => (!category || api.category === category)
    && (!search || `${api.apiCode} ${api.apiName} ${api.category || ''} ${api.path}`.toUpperCase().includes(search.toUpperCase())));
  const usedCategories = [...new Set(apis.map((api) => api.category).filter(Boolean))];
  const categoryChoices = [...new Set([...CATEGORIES, ...usedCategories])];

  const columns = [
    { key: 'number', header: '#', cell: (api, index) => index + 1 },
    { key: 'apiCode', header: 'CODE', className: 'tw:font-bold' },
    {
      key: 'apiName', header: 'NAME', className: 'tw:whitespace-normal tw:align-top',
      cell: (api) => <>{api.apiName}{api.description && <div className="tw:text-[11px] tw:text-muted-foreground">{api.description}</div>}</>,
    },
    { key: 'category', header: 'CATEGORY', cell: (api) => api.category || '-' },
    { key: 'path', header: 'METHOD / PATH', className: 'tw:font-mono tw:normal-case', cell: (api) => `${api.method} ${api.path}` },
    { key: 'params', header: 'VALUES', cell: (api) => (api.params || []).join(', ') || '-' },
    {
      key: 'lastTest', header: 'LAST TEST',
      cell: (api) => (api.lastTestAt ? (
        <span className={api.lastTestOk ? 'tw:text-success' : 'tw:text-destructive'}>
          {api.lastTestOk ? 'OK' : 'Failed'} · {formatWhen(api.lastTestAt)}<br /><span className="tw:text-muted-foreground">{api.lastTestMessage}</span>
        </span>
      ) : '-'),
    },
    {
      key: 'isActive', header: 'ACTIVE',
      cell: (api) => <Checkbox checked={Boolean(api.isActive)} onCheckedChange={() => toggleActive(api)} title="Switch this API on / off" />,
    },
    {
      key: 'actions', header: '',
      cell: (api) => (
        <span className="tw:inline-flex tw:gap-1">
          <Button variant="success" size="icon" title="Test" aria-label="Test" onClick={() => setTestApi(api)}><Play /></Button>
          <Button variant="warning" size="icon" title="Edit" aria-label="Edit" onClick={() => startEdit(api)}><Pencil /></Button>
          <Button variant="destructive" size="icon" title="Delete" aria-label="Delete" onClick={() => remove(api)}><Trash2 /></Button>
        </span>
      ),
    },
  ];

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <div ref={formRef}>
        <SettingsCard title={editId ? `Edit ULIP API: ${form.apiCode}` : 'Add ULIP API'} className={cn(editId && 'tw:border-warning')}
          actions={editId && <Button onClick={clearForm}><X /> Cancel edit</Button>}
          footer={(
            <div className="tw:flex tw:w-full tw:flex-wrap tw:justify-end tw:gap-2">
              <Button size="lg" onClick={clearForm} disabled={saving}><RotateCcw /> CLEAR</Button>
              <Button variant={editId ? 'warning' : 'default'} size="lg" onClick={save} disabled={saving}>
                {editId ? <Save /> : <Plus />} {saving ? 'SAVING...' : editId ? 'UPDATE API' : 'SAVE API'}
              </Button>
            </div>
          )}>
          <SettingsFields fields={apiFields({ base, categories: categoryChoices, jsonError })} values={form} onChange={changeField}
            className="tw:gap-2.5 tw:sm:grid-cols-2 tw:lg:grid-cols-4" />
        </SettingsCard>
      </div>

      <SettingsCard title={`Saved ULIP APIs (${apis.length}${shown.length !== apis.length ? `, showing ${shown.length}` : ''})`}
        actions={(
          <>
            <Input leftIcon={Search} data-allow-text="" className="tw:sm:w-[200px]" value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Search code / name / path" />
            <SelectBox className="tw:w-full tw:sm:w-[140px]" value={category} onValueChange={setCategory} clearable clearLabel="All categories"
              placeholder="All categories" options={usedCategories} />
          </>
        )}>
        <DataTable columns={columns} rows={shown} className={cn('tw:min-w-[760px]', loading && 'tw:opacity-50')}
          rowClassName={(api) => cn(editId === api.id && 'tw:bg-warning/10', !api.isActive && 'tw:opacity-55')}
          emptyText={apis.length ? 'No API matches the search' : 'No ULIP API saved yet - add the first one above'} />
      </SettingsCard>

      {testApi && <UlipTestModal key={testApi.id} api={testApi} base={base} onClose={() => setTestApi(null)} onTested={load} />}
    </div>
  );
}
