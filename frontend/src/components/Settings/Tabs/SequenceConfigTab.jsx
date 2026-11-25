import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Info, Plane, RotateCcw, Save, Settings2, Ship, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, DataTable, Input, SelectBox } from '@/components/ui';
import askConfirm from '@/components/common/askConfirm';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { settingsApi } from '../settingsApi';
import { StatusBanner } from './SettingsParts/Notices';
import { SettingsHeading } from './SettingsParts/SettingsCard';

// Job number = prefix + next number. The backend gives the next job no really free (used numbers are skipped) and
// refuses a start number whose job no already exists.
const MODES = [
  { id: 'AIR IMPORT', icon: Plane, short: 'AI' },
  { id: 'SEA IMPORT', icon: Ship, short: 'SI' },
  { id: 'LAND IMPORT', icon: Truck, short: 'LI' },
  { id: 'AIR EXPORT', icon: Plane, short: 'AE' },
  { id: 'SEA EXPORT', icon: Ship, short: 'SE' },
  { id: 'LAND EXPORT', icon: Truck, short: 'LE' },
];
const PREFIX_PATTERN = /^[A-Za-z0-9/\-_.{}]+$/;
const MAX_START_NUMBER = 99999999;

const serverMessage = (error) => error.response?.data?.message || error.response?.data?.error || error.message;

export default function SequenceConfigTab() {
  const activeYear = useWorkspaceStore((state) => state.activeYear);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [saved, setSaved] = useState({});
  const [edit, setEdit] = useState({});
  const [loaded, setLoaded] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const list = (await settingsApi.companyBranches())?.data || [];
        setBranches(list);
        if (list.length) setSelectedBranch((list.find((branch) => branch.isDefault) || list[0]).branchCode);
      } catch (error) {
        toast.error(`Could not load branches: ${error.message}`);
      }
    };
    loadBranches();
  }, []);

  const load = useCallback(async () => {
    if (!selectedBranch) return;
    setLoading(true);
    setServerError('');
    try {
      const result = await settingsApi.jobSequenceStatus({ branchCode: selectedBranch, financialYearId: activeYear && activeYear.id });
      const byMode = Object.fromEntries((result.data || []).map((sequence) => [sequence.jobMode, sequence]));
      setSaved(byMode);
      const typed = Object.fromEntries(MODES.map((mode) => {
        const sequence = byMode[mode.id] || {};
        return [mode.id, { prefix: sequence.prefix || `${selectedBranch}-${mode.short}-`, startNumber: String(sequence.startNumber || 1001) }];
      }));
      setEdit(typed);
      setLoaded(typed);
    } catch (error) {
      toast.error(`Could not load sequences: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, activeYear]);

  useEffect(() => { load(); }, [load]);

  const fyCode = (activeYear && (activeYear.code || activeYear.name)) || '';
  const yearDigits = activeYear && activeYear.startDate ? String(activeYear.startDate).slice(2, 4) : String(new Date().getFullYear()).slice(2);
  const jobNoOf = (prefix, number) => String(prefix || '').replace(/\{BR\}/gi, selectedBranch).replace(/\{FY\}/gi, fyCode).replace(/\{YY\}/gi, yearDigits) + number;

  const rowError = (modeId) => {
    const row = edit[modeId] || {};
    const prefix = String(row.prefix || '').trim();
    const startNumber = Number(row.startNumber);
    if (!prefix) return 'Prefix is empty';
    if (prefix.length > 20) return 'Max 20 characters';
    if (!PREFIX_PATTERN.test(prefix)) return 'Only letters, numbers, / - _ . and {BR} {FY} {YY}';
    if (!Number.isInteger(startNumber) || startNumber < 1 || startNumber > MAX_START_NUMBER) return 'Start number: whole number 1 - 99999999';
    const samePrefix = MODES.find((mode) => mode.id !== modeId && String((edit[mode.id] || {}).prefix || '').trim().toUpperCase() === prefix.toUpperCase());
    return samePrefix ? `Same prefix as ${samePrefix.id}` : '';
  };
  const isChanged = (modeId) => {
    const before = loaded[modeId] || {};
    const now = edit[modeId] || {};
    return String(before.prefix) !== String(now.prefix).trim() || String(before.startNumber) !== String(now.startNumber).trim();
  };
  const changedCount = MODES.filter((mode) => isChanged(mode.id)).length;
  const errorCount = MODES.filter((mode) => rowError(mode.id)).length;

  const changeRow = (modeId, field, text) => {
    const value = field === 'startNumber'
      ? text.replace(/[^0-9]/g, '').slice(0, 8)
      : text.toUpperCase().replace(/\s/g, '').replace(/\{(BR|FY|YY)\}/gi, (token) => token.toUpperCase());
    setEdit((current) => ({ ...current, [modeId]: { ...current[modeId], [field]: value } }));
    setServerError('');
  };

  const changeBranch = async (branchCode) => {
    if (changedCount && !(await askConfirm({ title: 'Change branch?', message: `Unsaved changes for ${selectedBranch} will be lost. Change branch?`, okLabel: 'Change branch', tone: 'warn' }))) return;
    setSelectedBranch(branchCode);
  };

  const save = async () => {
    if (!selectedBranch) { toast.error('Select a branch first'); return; }
    if (errorCount) { toast.error('Fix the rows marked in red first'); return; }
    setSaving(true);
    setServerError('');
    try {
      const sequences = MODES.map((mode) => ({
        branchCode: selectedBranch, jobMode: mode.id, prefix: String(edit[mode.id].prefix).trim(), startNumber: parseInt(edit[mode.id].startNumber, 10),
      }));
      await settingsApi.saveJobSequences(sequences, activeYear && activeYear.id);
      toast.success(`Sequences saved for ${selectedBranch}`);
      await load();
    } catch (error) {
      const message = serverMessage(error);
      setServerError(message);
      toast.error(`Not saved: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'mode', header: 'JOB MODE', className: 'tw:font-bold',
      cell: (mode) => {
        const Icon = mode.icon;
        return (
          <span className="tw:inline-flex tw:items-center tw:gap-2">
            <Icon className="tw:size-4 tw:text-primary" /> {mode.id}
            {!(saved[mode.id] || {}).configured && <Badge variant="warning" title="Not saved yet: the default is used">DEFAULT</Badge>}
            {isChanged(mode.id) && <Badge variant="info">CHANGED</Badge>}
          </span>
        );
      },
    },
    {
      key: 'prefix', header: 'PREFIX',
      cell: (mode) => {
        const error = rowError(mode.id);
        return (
          <Input className="tw:w-[170px]" data-allow-text="" maxLength={20} value={(edit[mode.id] || {}).prefix ?? ''}
            aria-invalid={Boolean(error) && !/Start/.test(error)} onChange={(event) => changeRow(mode.id, 'prefix', event.target.value)} />
        );
      },
    },
    {
      key: 'startNumber', header: 'NEXT NUMBER',
      cell: (mode) => {
        const sequence = saved[mode.id] || {};
        return (
          <>
            <Input className="tw:w-[110px]" inputMode="numeric" value={(edit[mode.id] || {}).startNumber ?? ''}
              aria-invalid={/Start/.test(rowError(mode.id))} onChange={(event) => changeRow(mode.id, 'startNumber', event.target.value)} />
            {sequence.configured && sequence.nextNumber > sequence.startNumber && !isChanged(mode.id) && (
              <div className="tw:mt-0.5 tw:text-[10px] tw:text-warning">{sequence.startNumber}..{sequence.nextNumber - 1} already used - skipped</div>
            )}
          </>
        );
      },
    },
    {
      key: 'nextJobNo', header: 'NEXT JOB NO', className: 'tw:font-bold',
      cell: (mode) => {
        const error = rowError(mode.id);
        if (error) return <span className="tw:inline-flex tw:items-center tw:gap-1 tw:font-semibold tw:text-destructive"><AlertTriangle className="tw:size-3.5" /> {error}</span>;
        const row = edit[mode.id] || { prefix: '', startNumber: '' };
        return isChanged(mode.id) ? jobNoOf(String(row.prefix).trim(), row.startNumber) : ((saved[mode.id] || {}).nextJobNo || jobNoOf(row.prefix, row.startNumber));
      },
    },
    { key: 'lastJobNo', header: 'LAST JOB NO', className: 'tw:text-muted-foreground', cell: (mode) => (saved[mode.id] || {}).lastJobNo || '-' },
  ];

  let saveState = 'All saved';
  if (changedCount) saveState = `${changedCount} row(s) changed - not saved`;
  else if (MODES.some((mode) => !(saved[mode.id] || {}).configured)) saveState = 'DEFAULT rows are not saved yet';

  return (
    <div className="tw:flex tw:min-h-[500px] tw:flex-col tw:gap-4 tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-4 tw:shadow-xs tw:md:p-6">
      <SettingsHeading icon={Settings2} title="Branch-Wise Sequence Config"
        description="Job number = prefix + next number. The next number moves on by one with every new job."
        actions={(
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-page tw:px-4 tw:py-2">
            <span className="tw:text-entry tw:font-bold tw:text-muted-foreground">SELECT BRANCH</span>
            <SelectBox className="tw:w-full tw:font-bold tw:sm:w-auto" value={selectedBranch} onValueChange={changeBranch}
              options={branches.map((branch) => ({ value: branch.branchCode, label: `${branch.branchCode} - ${branch.branchName}` }))} />
          </div>
        )} />

      <StatusBanner tone="neutral" icon={Info} className="tw:font-normal">
        Prefix tokens: <b>{'{BR}'}</b> branch ({selectedBranch || '-'}), <b>{'{FY}'}</b> financial year ({fyCode || '-'}), <b>{'{YY}'}</b> year ({yearDigits}).
        {' '}E.g. <code>{'{BR}/AI/{YY}/'}</code> gives {jobNoOf('{BR}/AI/{YY}/', 1001)}. A number already used as a job no is skipped, and cannot be saved as the start number.
      </StatusBanner>

      {!branches.length && <div className="tw:p-4 tw:text-entry tw:text-warning">No branch found. Add one in Branch Master first.</div>}

      <DataTable columns={columns} rows={MODES} className={cn('tw:min-w-[760px]', loading && 'tw:opacity-50')}
        rowClassName={(mode) => isChanged(mode.id) && 'tw:bg-primary/5'} containerClassName="tw:rounded-lg tw:border tw:border-border" />

      {serverError && <StatusBanner tone="error" icon={AlertTriangle} className="tw:font-normal">{serverError}</StatusBanner>}

      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-3">
        <span className="tw:text-entry tw:text-muted-foreground">{saveState}</span>
        <Button size="lg" onClick={load} disabled={loading || saving}><RotateCcw /> RESET</Button>
        <Button variant="default" size="lg" onClick={save} disabled={saving || loading || !selectedBranch} className={cn(errorCount && 'tw:opacity-70')}>
          <Save /> {saving ? 'SAVING...' : 'SAVE SEQUENCE CONFIG'}
        </Button>
      </div>
    </div>
  );
}
