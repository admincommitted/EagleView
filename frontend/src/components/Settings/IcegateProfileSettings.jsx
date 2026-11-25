import { useEffect, useState } from 'react';
import { CheckCircle, Edit2, Plus, Save, Server, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Checkbox, Field, Input, Label, SelectBox, Textarea } from '@/components/ui';
import { askConfirm } from '@/components/common/askConfirm';
import { replyOf, settingsApi } from './settingsApi';
import SettingsNotice from './SettingsNotice';

const NEW_PROFILE = {
  profileName: '',
  loginId: '',
  password: '',
  apiKey: '',
  baseUrl: 'https://cisapi.icegate.gov.in',
  linkedChaCode: '',
};
// the backend keeps the saved password when it gets this mask back
const KEEP_SAVED_PASSWORD = '********';
const NO_MESSAGE = { text: '', type: '' };
const REQUIRED_FIELDS = [
  { name: 'profileName', label: 'Profile Name' },
  { name: 'loginId', label: 'ICEGATE Login ID' },
  { name: 'password', label: 'ICEGATE Password', onlyNew: true },
  { name: 'apiKey', label: 'ICEGATE API Key' },
];

const IMAP_LOGIN_FIELDS = [
  { name: 'imapEmail', label: 'Registered Email ID', placeholder: 'e.g. docs@company.com' },
  { name: 'imapAppPassword', label: 'Email App Password', placeholder: '16-digit App Password', type: 'password' },
];

const twoColumns = 'tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2';

// { text, type, time } for the result line next to a Test button
async function timedTest(request, describe) {
  const startedAt = Date.now();
  const seconds = () => ((Date.now() - startedAt) / 1000).toFixed(1);
  try {
    const { body } = await replyOf(request());
    return { ...describe(body), time: seconds() };
  } catch (error) {
    return { text: `❌ Error: ${error.message}`, type: 'error', time: seconds() };
  }
}

function TestRow({ label, busy, onTest, result }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-center">
      <Button variant="secondary" size="lg" className="tw:min-w-40 tw:self-start tw:md:self-auto" disabled={busy} onClick={onTest}>
        {busy ? 'Testing... ⏳' : label}
      </Button>
      {result && <SettingsNotice tone={result.type} seconds={result.time} className="tw:px-3 tw:py-1.5 tw:text-[12.5px]">{result.text}</SettingsNotice>}
    </div>
  );
}

function ProfileCard({ profile, testing, onTest, onEdit, onDelete }) {
  return (
    <div className={cn(
      'tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:bg-card tw:p-4 tw:shadow-sm tw:md:flex-row tw:md:items-center tw:md:justify-between',
      profile.isDefault ? 'tw:border-2 tw:border-indigo-300' : 'tw:border tw:border-border'
    )}>
      <div className="tw:min-w-0">
        <div className="tw:mb-1.5 tw:flex tw:items-center tw:gap-2">
          <h4 className="tw:m-0 tw:text-sm tw:text-foreground">{profile.profileName}</h4>
          {profile.isDefault && <Badge variant="info">DEFAULT</Badge>}
        </div>
        <div className="tw:flex tw:flex-wrap tw:gap-x-4 tw:gap-y-1 tw:text-xs tw:text-muted-foreground">
          <span><strong>ID:</strong> {profile.loginId}</span>
          {profile.linkedChaCode && (
            <span><strong>CHA:</strong> <span className="tw:rounded tw:bg-muted tw:px-1 tw:py-0.5 tw:font-mono">{profile.linkedChaCode}</span></span>
          )}
        </div>
      </div>
      <div className="tw:flex tw:gap-2">
        <Button variant="success" disabled={testing} onClick={onTest}>{testing ? 'Testing...' : 'Test Connection'}</Button>
        <Button size="icon" title="Edit" onClick={onEdit}><Edit2 /></Button>
        <Button variant="destructive" size="icon" title="Delete" onClick={onDelete}><Trash2 /></Button>
      </div>
    </div>
  );
}

export default function IcegateProfileSettings() {
  const [profiles, setProfiles] = useState([]);
  const [chaList, setChaList] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState(NO_MESSAGE);
  const [testingAuth, setTestingAuth] = useState(false);
  const [icegateResult, setIcegateResult] = useState(null);
  const [testingImap, setTestingImap] = useState(false);
  const [imapResult, setImapResult] = useState(null);

  const isNew = editingId === 'new';
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const loadProfiles = async () => {
    try {
      const { body } = await replyOf(settingsApi.icegateProfiles());
      if (body.success) setProfiles(body.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadChaList = async () => {
    try {
      const { body } = await replyOf(settingsApi.chaMaster());
      if (body.success) setChaList(body.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadProfiles();
    loadChaList();
  }, []);

  const handleAddNew = () => {
    setEditingId('new');
    setForm({ ...NEW_PROFILE, isDefault: profiles.length === 0 });
    setMessage(NO_MESSAGE);
  };

  const handleEdit = (profile) => {
    setEditingId(profile.id);
    setForm({ ...profile, password: '' });
    setMessage(NO_MESSAGE);
  };

  const handleTestAuth = async () => {
    if (!form.loginId || !form.apiKey) {
      setIcegateResult({ text: 'Please enter ICEGATE Login ID and API Key to test.', type: 'error' });
      return;
    }
    setTestingAuth(true);
    setIcegateResult(null);
    setIcegateResult(await timedTest(
      () => settingsApi.testIcegateAuth({ ...form, profileId: editingId }),
      (reply) => (reply.success
        ? { text: `✅ ICEGATE API Connected! Status: ${reply.status}`, type: 'success' }
        : { text: `❌ ICEGATE API Failed: ${reply.error || reply.message}`, type: 'error' }),
    ));
    setTestingAuth(false);
  };

  const handleTestImap = async () => {
    if (!form.imapEmail || !form.imapAppPassword) {
      setImapResult({ text: 'Please enter Email ID and App Password to test.', type: 'error' });
      return;
    }
    setTestingImap(true);
    setImapResult(null);
    setImapResult(await timedTest(
      () => settingsApi.testIcegateImap(form),
      (reply) => (reply.success
        ? { text: '✅ Connection Successful! System can read the emails.', type: 'success' }
        : { text: `❌ Connection Failed: ${reply.message}`, type: 'error' }),
    ));
    setTestingImap(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const missing = REQUIRED_FIELDS.find((field) => (field.onlyNew ? isNew : true) && !form[field.name]);
    if (missing) {
      setMessage({ text: `Please fill in ${missing.label}.`, type: 'error' });
      return;
    }
    setMessage(NO_MESSAGE);
    const profile = { ...form };
    if (!profile.password && !isNew) profile.password = KEEP_SAVED_PASSWORD;
    try {
      const { body } = await replyOf(isNew ? settingsApi.createIcegateProfile(profile) : settingsApi.updateIcegateProfile(editingId, profile));
      if (body.success) {
        setMessage({ text: 'Profile saved successfully!', type: 'success' });
        setEditingId(null);
        loadProfiles();
      } else {
        setMessage({ text: body.error || 'Failed to save', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Network error', type: 'error' });
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await askConfirm({ title: 'Delete profile', message: 'Are you sure you want to delete this profile?', okLabel: 'Delete', tone: 'danger' });
    if (!confirmed) return;
    try {
      await replyOf(settingsApi.deleteIcegateProfile(id));
      loadProfiles();
    } catch {
      // the list stays as it is
    }
  };

  const handleTestProfile = async (profileId) => {
    setTestingAuth(profileId);
    setMessage(NO_MESSAGE);
    try {
      const { body } = await replyOf(settingsApi.testIcegateAuth({ profileId }));
      setMessage(body.success
        ? { text: 'Test connection successful for Profile!', type: 'success' }
        : { text: body.error || 'Connection failed', type: 'error' });
    } catch {
      setMessage({ text: 'Network error', type: 'error' });
    } finally {
      setTestingAuth(null);
    }
  };

  const chaOptions = chaList.map((cha) => ({ value: cha.chaCode, label: `${cha.chaCode} - ${cha.chaName}` }));
  const savedKeyShown = form?.apiKeyHint && String(form.apiKey || '').startsWith('****');

  return (
    <div>
      <div className="tw:mb-5 tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <div>
          <h2 className="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:text-base tw:text-foreground">
            <Server className="tw:size-[18px] tw:text-indigo-500" /> ICEGATE Profiles
          </h2>
          <p className="tw:mt-1 tw:mb-0 tw:text-xs tw:text-muted-foreground">
            Manage multiple ICEGATE login credentials. You can link them to specific CHA codes.
          </p>
        </div>
        {!editingId && (
          <Button variant="default" size="lg" className="tw:self-start tw:md:self-auto" onClick={handleAddNew}>
            <Plus /> Add New Profile
          </Button>
        )}
      </div>

      {message.text && (
        <SettingsNotice tone={message.type} icon={message.type === 'success' ? CheckCircle : undefined} className="tw:mb-5">
          {message.text}
        </SettingsNotice>
      )}

      {editingId ? (
        <div className="tw:rounded-lg tw:border tw:border-border tw:bg-(--bg-app) tw:p-4 tw:md:p-5">
          <h3 className="tw:mt-0 tw:mb-4 tw:text-sm tw:text-foreground">{isNew ? 'Create New Profile' : 'Edit Profile'}</h3>
          <form onSubmit={handleSave} className="tw:flex tw:flex-col tw:gap-4">
            <div className={twoColumns}>
              <Field label="Profile Name *" layout="col">
                <Input required data-allow-text="" value={form.profileName} placeholder="e.g. Delhi Branch CHA" onChange={(event) => setField('profileName', event.target.value)} />
              </Field>
              <Field label="Linked CHA Code (Optional)" layout="col" note="Auto-selects this profile for this CHA">
                <SelectBox className="tw:w-full" options={chaOptions} value={form.linkedChaCode} clearable clearLabel="-- Select CHA --"
                  placeholder="-- Select CHA --" onValueChange={(code) => setField('linkedChaCode', code)} />
              </Field>
            </div>

            <div className={twoColumns}>
              <Field label="ICEGATE Login ID *" layout="col">
                <Input required data-allow-text="" value={form.loginId} placeholder="e.g. CCCPL1998" onChange={(event) => setField('loginId', event.target.value)} />
              </Field>
              <Field label="ICEGATE Password *" layout="col">
                <Input type="password" required={isNew} value={form.password} placeholder={isNew ? 'Password' : 'Leave blank to keep unchanged'}
                  onChange={(event) => setField('password', event.target.value)} />
              </Field>
            </div>

            <Field
              label={`ICEGATE API Key *${savedKeyShown ? ` (saved key ${form.apiKeyHint} - paste a new key to change it)` : ''}`}
              layout="col"
              labelClassName="tw:whitespace-normal"
            >
              <Textarea required className="tw:h-20 tw:font-mono" value={form.apiKey} placeholder="Paste your API key here..." onChange={(event) => setField('apiKey', event.target.value)} />
            </Field>

            <div className="tw:flex tw:items-center tw:gap-2">
              <Checkbox id="icegate-profile-default" checked={Boolean(form.isDefault)} onCheckedChange={(checked) => setField('isDefault', checked === true)} />
              <Label htmlFor="icegate-profile-default" className="tw:cursor-pointer tw:text-[13px] tw:text-muted-foreground">Set as Default Profile</Label>
            </div>

            <TestRow label="Test ICEGATE API" busy={testingAuth} onTest={handleTestAuth} result={icegateResult} />

            <h4 className="tw:mt-4 tw:mb-0 tw:border-b tw:border-slate-700 tw:pb-2 tw:text-slate-200">Automatic Document Fetch (Email/IMAP)</h4>
            <div className={twoColumns}>
              {IMAP_LOGIN_FIELDS.map((field) => (
                <Field key={field.name} label={field.label} layout="col">
                  <Input type={field.type} data-allow-text="" value={form[field.name] ?? ''} placeholder={field.placeholder} onChange={(event) => setField(field.name, event.target.value)} />
                </Field>
              ))}
            </div>
            <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-3">
              <Field label="IMAP Server" layout="col">
                <Input data-allow-text="" value={form.imapHost ?? ''} placeholder="e.g. imap.gmail.com" onChange={(event) => setField('imapHost', event.target.value)} />
              </Field>
              <Field label="IMAP Port" layout="col">
                <Input type="number" value={form.imapPort ?? ''} onChange={(event) => setField('imapPort', parseInt(event.target.value) || 993)} />
              </Field>
              <Field
                label="Scan Folder/Label"
                layout="col"
                note={<>Tip: Type <b>ALL</b> to scan every label, or use commas for multiple (e.g. <b>INBOX, Customs</b>).</>}
              >
                <Input data-allow-text="" value={form.imapFolder ?? ''} placeholder="e.g. INBOX or ICEGATE_DOCS" onChange={(event) => setField('imapFolder', event.target.value)} />
              </Field>
            </div>
            <TestRow label="Test IMAP Connection" busy={testingImap} onTest={handleTestImap} result={imapResult} />

            <div className="tw:mt-2.5 tw:flex tw:flex-wrap tw:gap-3">
              <Button size="lg" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button type="submit" variant="default" size="lg" className="tw:px-6"><Save /> Save Profile</Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="tw:flex tw:flex-col tw:gap-3">
          {profiles.length === 0 ? (
            <div className="tw:rounded-lg tw:border tw:border-dashed tw:border-border tw:bg-(--bg-app) tw:p-10 tw:text-center tw:text-[13px] tw:text-muted-foreground">
              No ICEGATE profiles configured yet. Add one to start filing!
            </div>
          ) : (
            profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                testing={testingAuth === profile.id}
                onTest={() => handleTestProfile(profile.id)}
                onEdit={() => handleEdit(profile)}
                onDelete={() => handleDelete(profile.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
