import { useEffect, useState } from 'react';
import { Landmark, Loader2, RefreshCw, Save, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, DataTable, Field, Input, Table, TableBody, TableCell, TableRow, Textarea } from '@/components/ui';
import { settingsApi } from '../settingsApi';
import { CheckboxField } from './SettingsParts/CheckboxField';
import { CornerToast } from './SettingsParts/Notices';
import { SettingsCard } from './SettingsParts/SettingsCard';
import { useTimedNotice } from './SettingsParts/useTimedNotice';

// New customs / trade updates are mailed with their PDF by the backend (utils/cbicCustomsWatch.js).
const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const PAGE_LINE_PATTERN = /^(.*\|\s*)?https?:\/\/[^\s|]+$/i;
const TOAST_MS = 6000;

const formatWhen = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  return isNaN(date) ? '' : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const entryTitle = (entry, length) => [entry.number, entry.title].filter(Boolean).join(' - ').slice(0, length);
const hasItems = (list) => Boolean(list && list.length);

const EXCHANGE_RATE_TITLE = 'Mails the newest CBIC exchange rates with the change from the notification before - the mail that comes when the rates change';

function SourcePages({ pages }) {
  return (
    <details className="tw:mt-1">
      <summary className="tw:cursor-pointer tw:text-muted-foreground">Each page ({pages.length})</summary>
      <Table className="tw:mt-0.5 tw:w-auto">
        <TableBody>
          {pages.map((page, index) => (
            <TableRow key={index} className="tw:even:bg-transparent">
              <TableCell className="tw:align-top">{String(page.label || '').replace(/^(ICEGATE advisories|DGFT) - /, '')}</TableCell>
              {page.error ? <TableCell colSpan={2} className="tw:text-destructive">{page.error}</TableCell> : (
                <>
                  <TableCell className="tw:align-top">{page.count}</TableCell>
                  <TableCell className="tw:whitespace-normal tw:align-top">
                    {page.newest ? (
                      <>
                        <a href={page.newest.view} target="_blank" rel="noreferrer">{entryTitle(page.newest, 90)}</a>
                        {page.newest.date ? ` (${page.newest.date})` : ''}
                      </>
                    ) : <span className="tw:text-muted-foreground/70">empty</span>}
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </details>
  );
}

function LastResult({ state }) {
  if (!state) return <span className="tw:text-muted-foreground/70">not checked yet</span>;
  const { newest } = state;
  return (
    <>
      <span className={state.ok ? 'tw:text-success' : 'tw:text-destructive'}>
        {formatWhen(state.at)}{state.ok ? ` - ${state.count} entries read` : ` - ${state.error}`}
      </span>
      {newest && (
        <div>
          Newest: <a href={newest.view} target="_blank" rel="noreferrer">{entryTitle(newest, 120)}</a>
          {newest.date ? ` (${newest.dateLabel ? `${newest.dateLabel.toLowerCase()} ` : ''}${newest.date})` : ''}
        </div>
      )}
      {Array.isArray(state.pages) && state.pages.length > 1 && <SourcePages pages={state.pages} />}
    </>
  );
}

function LastCheck({ last }) {
  if (!last) return <div>Not checked yet - the first check runs 2 minutes after EagleView starts.</div>;
  let outcome = 'nothing new';
  if (last.error) outcome = <span className="tw:text-destructive">{last.error}</span>;
  else if (hasItems(last.sent)) outcome = <b>mailed {last.sent.join(', ')}</b>;
  else if (hasItems(last.seeded)) outcome = 'present entries noted';
  else if (last.first) outcome = 'present notifications noted';
  return (
    <div>
      Last check {formatWhen(last.at)}{last.by && last.by !== 'Auto' ? ` (by ${last.by})` : ''}: {outcome}
      {hasItems(last.failed) && (
        <span className="tw:text-destructive"> - not mailed: {last.failed.map((failure) => `${failure.number} (${failure.error})`).join('; ')}</span>
      )}
    </div>
  );
}

const checkSummary = (result) => {
  const parts = [];
  if (hasItems(result.sent)) parts.push(`Mailed: ${result.sent.join(', ')}`);
  if (hasItems(result.seeded)) parts.push(`First look at ${result.seeded.length} page(s): what is there now is noted, new ones are mailed from now on`);
  if (hasItems(result.failed)) parts.push(`Not mailed: ${result.failed.map((failure) => failure.number).join(', ')}`);
  if (hasItems(result.errors)) parts.push(`${result.errors.length} page(s) could not be read`);
  const failed = hasItems(result.failed) || (hasItems(result.errors) && !hasItems(result.sent));
  return [parts.length ? parts.join('. ') : 'Nothing new.', failed ? 'error' : 'success'];
};

export default function CbicWatchCard() {
  const [sendTo, setSendTo] = useState('');
  const [mailNew, setMailNew] = useState(true);
  const [status, setStatus] = useState(null);
  const [offSources, setOffSources] = useState([]);
  const [pages, setPages] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, showNotice] = useTimedNotice(TOAST_MS);

  const takeStatus = (watch) => {
    setStatus(watch);
    setSendTo(watch.to || '');
    setMailNew(watch.on !== false);
    setOffSources((watch.sources || []).filter((source) => !source.on).map((source) => source.id));
    setPages(watch.pages || '');
  };

  const load = async () => {
    try {
      takeStatus(await settingsApi.cbicWatch());
    } catch {
      // backend not reachable: the card stays empty
    }
  };

  useEffect(() => { load(); }, []);

  const errorOf = (error, fallback) => error.response?.data?.error || fallback;

  const save = async (extra = {}) => {
    const emails = sendTo.split(/[,;\s]+/).map((email) => email.trim()).filter(Boolean);
    const badEmails = emails.filter((email) => !EMAIL_PATTERN.test(email));
    if (!emails.length) { showNotice('Enter at least one e-mail id', 'error'); return false; }
    if (badEmails.length) { showNotice(`Not an e-mail id: ${badEmails.join(', ')}`, 'error'); return false; }
    const badPages = pages.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !PAGE_LINE_PATTERN.test(line));
    if (badPages.length) { showNotice(`Not a page address (http:// or https://): ${badPages[0]}`, 'error'); return false; }
    setBusy('save');
    try {
      takeStatus(await settingsApi.saveCbicWatch({ to: emails.join(', '), on: mailNew, off: offSources, pages, ...extra }));
      showNotice('Customs and trade updates saved ✅');
      return true;
    } catch (error) {
      showNotice(errorOf(error, 'Could not save'), 'error');
      return false;
    } finally {
      setBusy('');
    }
  };

  const sendTest = async () => {
    if (!(await save())) return;
    setBusy('test');
    try {
      const result = await settingsApi.testCbicWatch();
      showNotice(`Test mail sent to ${result.to.join(', ')}${result.pdf ? ` with the PDF of ${result.number}` : ` (PDF not attached: ${result.pdfError})`}`);
    } catch (error) {
      showNotice(errorOf(error, 'Test mail failed'), 'error');
    } finally {
      setBusy('');
    }
  };

  const sendRatesTest = async () => {
    if (!(await save())) return;
    setBusy('testRates');
    try {
      const result = await settingsApi.testCbicWatch({ source: 'cbic_exrate' });
      showNotice(`Exchange-rate test mail sent to ${result.to.join(', ')} (notification ${result.number})`);
    } catch (error) {
      showNotice(errorOf(error, 'Test mail failed'), 'error');
    } finally {
      setBusy('');
    }
  };

  const checkNow = async () => {
    if (!(await save())) return;
    setBusy('check');
    try {
      const result = await settingsApi.checkCbicWatch();
      if (result.busy) { showNotice('A check is already running - try again in a minute.', 'error'); return; }
      if (result.error) { showNotice(result.error, 'error'); return; }
      showNotice(...checkSummary(result));
    } catch (error) {
      showNotice(errorOf(error, 'Check failed'), 'error');
    } finally {
      setBusy('');
      load();
    }
  };

  const toggleSource = (id, isOn) => setOffSources((current) => (isOn ? current.filter((sourceId) => sourceId !== id) : [...current, id]));

  const sourceColumns = [
    {
      key: 'label', header: 'Source', className: 'tw:whitespace-normal tw:align-top',
      cell: (source) => (
        <CheckboxField checked={!offSources.includes(source.id)} onCheckedChange={(isOn) => toggleSource(source.id, isOn)}
          label={source.label}
          note={<a href={source.site} target="_blank" rel="noreferrer">{String(source.site).replace(/^https?:\/\//, '').slice(0, 60)}</a>} />
      ),
    },
    { key: 'every', header: 'Checked', className: 'tw:align-top', cell: (source) => `every ${source.every}` },
    { key: 'state', header: 'Last result', className: 'tw:whitespace-normal tw:align-top', cell: (source) => <LastResult state={source.state} /> },
  ];

  const actions = [
    { id: 'save', label: 'Save', icon: Save, variant: 'default', onClick: () => save() },
    { id: 'test', label: 'Send a test mail', icon: Send, onClick: sendTest },
    { id: 'testRates', label: 'Exchange-rate test mail', icon: Send, onClick: sendRatesTest, title: EXCHANGE_RATE_TITLE },
    { id: 'check', label: 'Check now', icon: RefreshCw, onClick: checkNow },
  ];

  return (
    <SettingsCard icon={Landmark} title="Customs and trade updates" className="tw:normal-case"
      description="New notifications, circulars, advisories and public notices are mailed with their PDF. The first look at a source only notes what is there now; after that every new entry is mailed once.">
      <CornerToast notice={notice} />
      <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-end">
        <Field layout="col" label="Send to" className="tw:flex-1" note="More than one: separate with a comma. Sent with the SMTP set up above.">
          <Input className="tw:normal-case" data-allow-text="" value={sendTo} onChange={(event) => setSendTo(event.target.value)}
            placeholder="admin@committedcargo.com, impops@committedcargo.com" />
        </Field>
        <CheckboxField label="Mail new ones" checked={mailNew} onCheckedChange={setMailNew} className="tw:md:pb-5" />
      </div>

      <DataTable columns={sourceColumns} rows={(status && status.sources) || []} stickyHeader={false} emptyText="No sources"
        rowClassName={(source) => cn(offSources.includes(source.id) && 'tw:opacity-55')} />

      <Field layout="col" label="Other pages to watch (for example a Custom House public notice page)" labelClassName="tw:whitespace-normal"
        note="One page per line: a name, a bar ( | ), then the page address. Every PDF link that newly appears on the page is mailed. Up to 20 pages.">
        <Textarea className="tw:min-h-16 tw:normal-case" data-allow-text="" value={pages} onChange={(event) => setPages(event.target.value)}
          placeholder={'ACC Delhi public notices | https://...\nMumbai Customs Zone-I public notices | https://...'} />
      </Field>

      <div className="tw:flex tw:flex-wrap tw:gap-2">
        {actions.map(({ id, label, icon: Icon, variant, onClick, title }) => (
          <Button key={id} variant={variant} size="lg" disabled={Boolean(busy)} onClick={onClick} title={title}>
            {busy === id ? <Loader2 className="tw:animate-spin" /> : <Icon />}{label}
          </Button>
        ))}
      </div>

      <div className="tw:text-[11px] tw:text-muted-foreground"><LastCheck last={status && status.last} /></div>
    </SettingsCard>
  );
}
