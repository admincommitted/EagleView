import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { downloadCsv } from '@/lib/download';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Button, Checkbox, DateInput, Field, Input, Label, NumberInput, SelectBox } from '@/components/ui';
import { askDelete, askYes } from './switchRow';
import { MasterPage } from './masterKit/MasterPage';
import { mastersFormApi, masterRecordsApi } from './masterKit/masterRecordsApi';
import { useMasterRecords } from './masterKit/useMasterRecords';
import { LogoUploadButton } from './masterFormExtras';

// Dates as the calendar day in India: the database returns 18-Nov midnight IST as "2026-11-17T18:30:00.000Z", so
// cutting at 'T' would show (and re-save) 17-Nov.
const ymdLocal = (value) => {
  if (!value) return '';
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = value instanceof Date ? value : new Date(text);
  if (isNaN(date)) return text.slice(0, 10);
  const twoDigits = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
};

const RESOURCE = 'currencies';
const EMPTY_CURRENCY = { id: '', currencyCode: '', currencyName: '', importRate: '', exportRate: '', standard: true, effectiveDate: '', notificationNo: '' };
const SEARCH_FIELDS = ['currencyCode', 'currencyName'];
const STANDARD_OPTIONS = [{ value: 'YES', label: 'Yes' }, { value: 'NO', label: 'No' }];
const CSV_HEADERS = ['Code', 'Currency Name', 'Import Rate', 'Export Rate', 'Standard', 'Effective Date', 'Notification No'];
const SEARCH_PLACEHOLDER = 'SEARCH...';

const validateCurrency = (currency) => {
  if (!currency.currencyCode || !currency.currencyName) return 'Currency code and name are required';
  if (!/^[A-Z]{3}$/.test(String(currency.currencyCode).trim())) return 'Currency code must be 3 letters (ISO 4217), e.g. USD';
  const badRate = ['importRate', 'exportRate'].some((key) => currency[key] !== '' && currency[key] != null && !(Number(currency[key]) > 0));
  return badRate ? 'Rates must be more than 0' : '';
};

const currencySymbol = (code) => {
  try {
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).formatToParts(1);
    return parts.find((part) => part.type === 'currency')?.value || '';
  } catch {
    return '';
  }
};

const FALLBACK_FLAG = 'https://flagcdn.com/w40/us.png';
const flagUrl = (currency) => currency.customLogo || `https://flagcdn.com/w40/${currency.currencyCode ? currency.currencyCode.substring(0, 2).toLowerCase() : 'us'}.png`;

function CurrencyFlag({ currency, className }) {
  return (
    <img src={flagUrl(currency)} alt="flag" className={cn('tw:rounded-sm tw:border tw:border-border tw:object-cover', className)}
      onError={(event) => { event.currentTarget.src = FALLBACK_FLAG; }} />
  );
}

const nextNotification = (next) => (next ? `\nNext: ${next.number} from ${next.effective} (applied on its own).` : '');

const cbicStatusLine = (cbic) => {
  if (!cbic) return '';
  const next = cbic.next ? ` Next: CBIC ${cbic.next.number} from ${cbic.next.effective} (applied on its own).` : '';
  if (cbic.last) {
    const today = cbic.current && !cbic.upToDate ? ` - in force today: ${cbic.current.number}, not yet applied` : cbic.upToDate ? ' - in force today' : '';
    return `Master has CBIC ${cbic.last.number} (effective ${cbic.last.effective || '-'})${today}${next}`;
  }
  if (cbic.current) return `Master has no CBIC rates yet - ICEGATE has ${cbic.current.number}`;
  return cbic.error ? `ICEGATE not reachable: ${cbic.error}` : '';
};

const LIST = {
  title: 'Search',
  searchPlaceholder: SEARCH_PLACEHOLDER,
  primaryText: (currency) => (
    <span className="tw:flex tw:items-center tw:gap-2"><CurrencyFlag currency={currency} className="tw:h-[15px] tw:w-5" /> {currency.currencyName}</span>
  ),
  secondaryText: (currency) => `${currency.currencyCode || ''} ${currencySymbol(currency.currencyCode) ? `(${currencySymbol(currency.currencyCode)})` : ''}`,
};

export default function CurrencyMasterForm() {
  const today = ymdLocal(new Date());
  const emptyCurrency = useMemo(() => ({ ...EMPTY_CURRENCY, effectiveDate: today }), [today]);
  const records = useMasterRecords({ resource: RESOURCE, emptyRecord: emptyCurrency, searchFields: SEARCH_FIELDS, validate: validateCurrency });
  const { form, setForm, setField, filtered, clearForm, reload } = records;

  const [cbic, setCbic] = useState(null);
  const [cbicBusy, setCbicBusy] = useState(false);
  const [liveSyncing, setLiveSyncing] = useState(false);

  // CBIC customs rates from ICEGATE (notified 1st / 3rd Thursday); the server also checks every 6 hours on its own
  const loadCbicStatus = async () => {
    try {
      setCbic(await mastersFormApi.currencyCbicStatus());
    } catch {
      // the status line just stays empty
    }
  };
  useEffect(() => { loadCbicStatus(); }, []);

  const editCurrency = useCallback((currency) => setForm({
    ...currency,
    effectiveDate: currency.effectiveDate ? ymdLocal(currency.effectiveDate) : '',
    notificationNo: currency.notificationNo || '',
  }), [setForm]);

  const syncCbic = async () => {
    // the notification IN FORCE today goes into the master; one that comes into force later stays in the rate history
    const inForce = cbic?.current ? `Notification ${cbic.current.number} (in force from ${cbic.current.effective || cbic.current.published})` : 'the notification in force today';
    if (!(await askYes(`Fetch the CBIC customs exchange rates from ICEGATE?\n\n${inForce} will be put into the Currency master (import and export rates, effective date). A notification that comes into force later is kept and applied on its date. (Admin only)`))) return;
    setCbicBusy(true);
    try {
      const result = await mastersFormApi.syncCurrencyCbic();
      if (!result.success) {
        toast.error(`Rates not updated: ${result.error || 'no answer from the server'}`);
        return;
      }
      toast.success(result.skipped
        ? `Currency master already has CBIC notification ${result.notification} (in force from ${result.effective}).${nextNotification(result.next)}`
        : `CBIC notification ${result.notification} (effective ${result.effective}) applied: ${result.updated} updated, ${result.created} new, ${result.unchanged} already current.${nextNotification(result.next)}`,
      { duration: 8000, className: 'tw:whitespace-pre-line' });
      reload();
      loadCbicStatus();
    } catch (error) {
      toast.error(`Rates not updated: ${errorMessage(error)}`);
    } finally {
      setCbicBusy(false);
    }
  };

  const toggleCbicAuto = async () => {
    try {
      await mastersFormApi.setCurrencyCbicAuto(!cbic?.auto);
    } catch (error) {
      toast.error(`Not changed: ${errorMessage(error)}`);
    }
    loadCbicStatus();
  };

  // market rates are not the CBIC-notified customs rates, so it asks first
  const syncLive = async () => {
    if (!(await askYes('Fetch live MARKET rates for all currencies?\n\nThese are not the CBIC-notified customs exchange rates. Use them only if no notification rate is available. (Admin only)'))) return;
    setLiveSyncing(true);
    try {
      const result = await mastersFormApi.syncCurrencyLive();
      if (!result.success) {
        toast.error(`Rates not updated: ${result.error || 'no answer from the server'}`);
        return;
      }
      toast.success(`${result.updatedCount} currency rate(s) updated from market rates.`);
      reload();
    } catch (error) {
      toast.error(`Rates not updated: ${errorMessage(error)}`);
    } finally {
      setLiveSyncing(false);
    }
  };

  const deleteCurrency = async (currency) => {
    if (!(await askDelete('Delete this currency?'))) return;
    try {
      await masterRecordsApi.remove(RESOURCE, currency.id);
      if (String(form.id) === String(currency.id)) clearForm();
      reload();
    } catch (error) {
      toast.error(`Not deleted: ${errorMessage(error)}`);
    }
  };

  const exportCsv = () => downloadCsv('customs_exchange_rates.csv', CSV_HEADERS, filtered.map((currency) => [
    currency.currencyCode, currency.currencyName, currency.importRate, currency.exportRate, currency.standard ? 'YES' : 'NO',
    currency.effectiveDate ? ymdLocal(currency.effectiveDate) : '', currency.notificationNo || '',
  ]));

  // Up / Down move through the list while the focus is not in a box (or is in the search box)
  useEffect(() => {
    const moveSelection = (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const focused = document.activeElement;
      if (['input', 'textarea', 'select'].includes(focused.tagName.toLowerCase()) && focused.placeholder !== SEARCH_PLACEHOLDER) return;
      event.preventDefault();
      const currentIndex = filtered.findIndex((currency) => currency.id === form.id);
      if (currentIndex === -1) return;
      const nextIndex = event.key === 'ArrowDown' ? Math.min(currentIndex + 1, filtered.length - 1) : Math.max(currentIndex - 1, 0);
      if (nextIndex !== currentIndex) editCurrency(filtered[nextIndex]);
    };
    window.addEventListener('keydown', moveSelection);
    return () => window.removeEventListener('keydown', moveSelection);
  }, [filtered, form.id, editCurrency]);

  const master = { ...records, editRecord: editCurrency };
  const statusLine = cbicStatusLine(cbic);

  const columns = [
    {
      key: 'currencyCode',
      header: 'Code',
      cell: (currency) => (
        <span className="tw:flex tw:items-center tw:gap-2">
          <CurrencyFlag currency={currency} className="tw:h-[15px] tw:w-5" />
          <Badge variant="success">{currency.currencyCode} {currencySymbol(currency.currencyCode) ? `- ${currencySymbol(currency.currencyCode)}` : ''}</Badge>
        </span>
      ),
    },
    { key: 'currencyName', header: 'Currency Name' },
    { key: 'importRate', header: 'Import Rate', align: 'right', className: 'tw:font-semibold', cell: (currency) => `₹ ${currency.importRate}` },
    { key: 'exportRate', header: 'Export Rate', align: 'right', className: 'tw:font-semibold tw:text-head', cell: (currency) => `₹ ${currency.exportRate}` },
    { key: 'effectiveDate', header: 'Effective Date', align: 'center', cell: (currency) => (currency.effectiveDate ? ymdLocal(currency.effectiveDate).split('-').reverse().join('-') : '') },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      width: 120,
      cell: (currency) => (
        <span className="tw:inline-flex tw:gap-1">
          <Button variant="link" size="sm" onClick={(event) => { event.stopPropagation(); editCurrency(currency); }}>Edit</Button>
          <Button variant="link" size="sm" className="tw:text-destructive" onClick={(event) => { event.stopPropagation(); deleteCurrency(currency); }}>Delete</Button>
        </span>
      ),
    },
  ];

  const actions = (
    <>
      <Button size="lg" disabled={cbicBusy} onClick={syncCbic} title={statusLine || 'Customs exchange rates notified by CBIC, from ICEGATE'}>
        <RefreshCw className={cn(cbicBusy && 'tw:animate-spin')} /> {cbicBusy ? 'Fetching...' : 'Sync CBIC Rates (ICEGATE)'}
      </Button>
      <Button size="lg" disabled={liveSyncing} onClick={syncLive}>
        <RefreshCw className={cn(liveSyncing && 'tw:animate-spin')} /> {liveSyncing ? 'Syncing...' : 'Sync Live Rates'}
      </Button>
      <Button variant="success" size="lg" onClick={exportCsv}><Download /> Export CSV</Button>
    </>
  );

  return (
    <MasterPage master={master} list={LIST} icon={Coins} formTitle="Update Exchange Rate" columns={columns} actions={actions}>
      <div className="tw:flex tw:flex-col tw:gap-4">
        <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-3 tw:sm:grid-cols-2 tw:xl:grid-cols-[1fr_2fr_1fr_1fr_0.8fr_1.25fr_1.4fr_1fr]">
          <Field label="Currency Code" layout="col">
            <Input placeholder="e.g. USD" maxLength={3} className="tw:uppercase" data-allow-text="" value={form.currencyCode || ''}
              onChange={(event) => setField('currencyCode')(event.target.value.toUpperCase())} />
          </Field>
          <Field label="Currency Name" layout="col">
            <Input placeholder="e.g. US Dollar" data-allow-text="" value={form.currencyName || ''}
              onChange={(event) => setField('currencyName')(event.target.value.toUpperCase())} />
          </Field>
          <Field label="Import Rate (₹)" layout="col">
            <NumberInput placeholder="0.00" value={form.importRate || ''} onValueChange={setField('importRate')} />
          </Field>
          <Field label="Export Rate (₹)" layout="col">
            <NumberInput placeholder="0.00" value={form.exportRate || ''} onValueChange={setField('exportRate')} />
          </Field>
          <Field label="Standard" layout="col">
            <SelectBox options={STANDARD_OPTIONS} value={form.standard ? 'YES' : 'NO'} onValueChange={(value) => setField('standard')(value === 'YES')} />
          </Field>
          <Field label="Effective Date" layout="col">
            <DateInput value={form.effectiveDate} onValueChange={setField('effectiveDate')} />
          </Field>
          <Field label="Notification No" layout="col">
            <Input placeholder="e.g. 75/2026-CUS(NT)" data-allow-text="" value={form.notificationNo || ''}
              onChange={(event) => setField('notificationNo')(event.target.value.toUpperCase())} />
          </Field>
          <Field label="Custom Flag" layout="col">
            <LogoUploadButton onLogo={setField('customLogo')}>{form.customLogo ? 'Change flag' : 'Choose image'}</LogoUploadButton>
          </Field>
        </div>

        {cbic && statusLine && (
          <div className={cn('tw:flex tw:flex-col tw:gap-2 tw:text-[11px] tw:md:flex-row tw:md:items-center', cbic.upToDate ? 'tw:text-success' : 'tw:text-warning')}>
            <span>{statusLine}</span>
            <Label className="tw:cursor-pointer tw:gap-1 tw:text-[11px] tw:text-muted-foreground tw:md:ml-auto" title="The server checks ICEGATE every 6 hours and applies a new notification on its own">
              <Checkbox checked={Boolean(cbic.auto)} onCheckedChange={toggleCbicAuto} /> Auto-update from ICEGATE
            </Label>
          </div>
        )}
      </div>
    </MasterPage>
  );
}
