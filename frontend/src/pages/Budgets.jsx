import { useCallback, useEffect, useState } from 'react';
import { Download, Plus, Printer, Target, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { askConfirm } from '@/components/common/askConfirm';
import { Badge, Button, DataTable, DateInput, Field, Input, NumberInput, SearchSelect, SelectBox } from '@/components/ui';
import { accountsApi } from './AccountsHubParts/accountsApi';
import { ReportFrame, ReportMessage, ReportPage, ReportSheet } from './LedgerReportParts/ReportLayout';
import { dayFirst, financialYearEnd, financialYearStart, formatAmount, formatInr, todayIso } from './LedgerReportParts/format';
import { assertSuccess, emptyOnFailure, exportSheet } from './LedgerReportParts/reportData';

const BASIS_OPTIONS = [
  { value: 'LEDGER', label: 'One ledger' },
  { value: 'GROUP', label: 'A whole account group' },
  { value: 'COST_CENTRE', label: 'A cost centre' },
];

const TARGET_LISTS = { LEDGER: 'ledgers', GROUP: 'groups', COST_CENTRE: 'costCentres' };

const NO_TARGETS = { groups: [], ledgers: [], costCentres: [] };

const newBudget = () => ({
  name: '', basis: 'LEDGER', targetId: '', fromDate: financialYearStart(), toDate: financialYearEnd(), allocated: '', warnAtPct: 80, notes: '',
});

const targetLabel = (target) => `${target.name}${target.group ? `  (${target.group})` : ''}${target.nature ? `  [${target.nature}]` : ''}`;

const usageBadge = (budget) => {
  if (budget.variance < 0) return 'danger';
  if (budget.state === 'Near the limit') return 'warning';
  return budget.utilisedPct == null ? 'neutral' : 'success';
};

function BudgetForm({ form, setForm, targets, saving, onSave }) {
  const setField = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const targetList = targets[TARGET_LISTS[form.basis]];
  const labelClassName = 'tw:text-[11px] tw:font-bold tw:text-muted-foreground';

  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:rounded-md tw:border tw:border-warning/40 tw:bg-warning/5 tw:p-4 tw:print:hidden">
      <div className="tw:text-[13px] tw:font-bold tw:text-warning">
        New budget &mdash; it has to be set against something the ledger can total, so that &quot;utilised&quot; is a real number
      </div>
      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
        <Field label="Budget name" layout="col" labelClassName={labelClassName}>
          <Input data-allow-text="" value={form.name} onChange={(event) => setField('name')(event.target.value)} placeholder="e.g. Office overheads FY 26-27" />
        </Field>
        <Field label="Set against" layout="col" labelClassName={labelClassName}>
          <SelectBox options={BASIS_OPTIONS} value={form.basis} onValueChange={(basis) => setForm((current) => ({ ...current, basis, targetId: '' }))} />
        </Field>
        <Field
          label="Which one"
          layout="col"
          labelClassName={labelClassName}
          className="tw:sm:col-span-2"
          note={!targetList.length && <span className="tw:text-warning">Nothing to pick yet - create it in Chart of Accounts / Cost Centres first.</span>}
        >
          <SearchSelect
            options={targetList.map((target) => ({ value: String(target.id), label: targetLabel(target) }))}
            value={form.targetId}
            onValueChange={setField('targetId')}
            placeholder="-- pick one --"
          />
        </Field>
        <Field label="From" layout="col" labelClassName={labelClassName}>
          <DateInput value={form.fromDate} onValueChange={setField('fromDate')} />
        </Field>
        <Field label="To" layout="col" labelClassName={labelClassName}>
          <DateInput value={form.toDate} onValueChange={setField('toDate')} />
        </Field>
        <Field label="Allocated (₹)" layout="col" labelClassName={labelClassName}>
          <NumberInput value={form.allocated} onValueChange={setField('allocated')} placeholder="0.00" />
        </Field>
        <Field label="Warn at (%)" layout="col" labelClassName={labelClassName}>
          <NumberInput value={form.warnAtPct} onValueChange={setField('warnAtPct')} />
        </Field>
      </div>
      <div>
        <Button variant="default" size="lg" disabled={saving} onClick={onSave}>
          {saving ? 'Saving...' : 'Create budget'}
        </Button>
      </div>
    </div>
  );
}

const budgetColumns = (onDelete) => [
  {
    key: 'name',
    header: 'Budget Name',
    className: 'tw:font-semibold tw:whitespace-normal tw:text-foreground',
    cell: (budget) => (
      <>
        {budget.name}
        {budget.notes ? <div className="tw:text-[11px] tw:font-normal tw:text-muted-foreground">{budget.notes}</div> : null}
      </>
    ),
  },
  {
    key: 'target',
    header: 'Set against / period',
    width: 220,
    className: 'tw:whitespace-normal tw:text-muted-foreground',
    cell: (budget) => (
      <>
        <div>{budget.basis.replace('_', ' ').toLowerCase()}: <b>{budget.target}</b></div>
        <div className="tw:text-[11px]">{dayFirst(budget.fromDate)} to {dayFirst(budget.toDate)}{' · '}{budget.voucherLines} voucher line(s)</div>
      </>
    ),
  },
  { key: 'allocated', header: 'Allocated (₹)', align: 'right', width: 150, cell: (budget) => formatAmount(budget.allocated) },
  { key: 'utilized', header: 'Utilized (₹)', align: 'right', width: 150, cell: (budget) => formatAmount(budget.utilized) },
  {
    key: 'variance',
    header: 'Variance (₹)',
    align: 'right',
    width: 150,
    cell: (budget) => (
      <span className={cn('tw:font-bold', budget.variance < 0 ? 'tw:text-destructive' : 'tw:text-success')}>
        {formatAmount(Math.abs(budget.variance))} {budget.variance < 0 ? '(Over)' : ''}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    align: 'center',
    width: 130,
    cell: (budget) => (
      <div className="tw:flex tw:flex-col tw:items-center tw:gap-0.5">
        <Badge variant={usageBadge(budget)}>{budget.utilisedPct == null ? 'no allocation' : `${budget.utilisedPct}%`}</Badge>
        <span className="tw:text-[10px] tw:text-muted-foreground">{budget.state}</span>
      </div>
    ),
  },
  {
    key: 'delete',
    header: '',
    align: 'center',
    width: 50,
    cell: (budget) => (
      <Button variant="ghost" size="icon-sm" className="tw:text-destructive" title="Delete this budget" onClick={() => onDelete(budget)}><Trash2 /></Button>
    ),
  },
];

const budgetSummary = (budgets, meta) => {
  const totals = meta?.totals;
  return [
    budgets.length ? `${budgets.length} budget(s)` : 'No budget created yet',
    totals ? ` · allocated ₹ ${formatInr(totals.allocated)} · utilised ₹ ${formatInr(totals.utilized)}` : '',
    totals?.overBudget ? ` · ${totals.overBudget} over budget` : '',
  ].join('');
};

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [targets, setTargets] = useState(NO_TARGETS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(newBudget);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [budgetBody, targetBody] = await Promise.all([accountsApi.hubBudgets(), emptyOnFailure(accountsApi.ledgerReportBudgetTargets())]);
      assertSuccess(budgetBody);
      setBudgets(budgetBody.data || []);
      setMeta(budgetBody);
      setTargets({ groups: targetBody.groups || [], ledgers: targetBody.ledgers || [], costCentres: targetBody.costCentres || [] });
    } catch (loadError) {
      setBudgets([]);
      setMeta(null);
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createBudget = async () => {
    setSaving(true);
    try {
      assertSuccess(await accountsApi.ledgerReportCreateBudget(form));
      toast.success('Budget created');
      setShowForm(false);
      setForm(newBudget());
      await load();
    } catch (saveError) {
      toast.error(`Not created: ${errorMessage(saveError)}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteBudget = async (budget) => {
    const confirmed = await askConfirm({
      title: 'Delete budget',
      message: `Delete the budget "${budget.name}"? The vouchers it measured are not touched.`,
      okLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await accountsApi.ledgerReportDeleteBudget(budget.id);
      toast.success('Deleted');
      await load();
    } catch (deleteError) {
      toast.error(errorMessage(deleteError));
    }
  };

  const exportExcel = async () => {
    if (!budgets.length) return toast.error('Nothing to export');
    const rows = budgets.map((budget) => ({
      Budget: budget.name,
      'Set against': `${budget.basis.replace('_', ' ')}: ${budget.target}`,
      From: budget.fromDate,
      To: budget.toDate,
      'Allocated (INR)': budget.allocated,
      'Utilised (INR)': budget.utilized,
      'Variance (INR)': budget.variance,
      'Utilised %': budget.utilisedPct ?? '',
      Status: budget.state,
      'Voucher lines counted': budget.voucherLines,
      Notes: budget.notes,
    }));
    await exportSheet({
      rows,
      sheetName: 'Budgets',
      fileName: `budgets-${todayIso()}.xlsx`,
      columnWidths: [28, 34, 12, 12, 16, 16, 16, 12, 16, 20, 30],
    });
  };

  const actions = (
    <>
      <Button variant="default" className="tw:bg-warning tw:border-warning tw:hover:bg-warning/85" onClick={() => setShowForm((shown) => !shown)}>
        <Plus /> {showForm ? 'Cancel' : 'Create Budget'}
      </Button>
      <Button onClick={exportExcel}><Download /> Export</Button>
      <Button onClick={() => window.print()}><Printer /> Print</Button>
    </>
  );

  return (
    <ReportPage icon={Target} tone="warning" title="Budgets & Variance" subtitle="Budget Allocation and Utilization" actions={actions}>
      {showForm && <BudgetForm form={form} setForm={setForm} targets={targets} saving={saving} onSave={createBudget} />}
      <ReportFrame>
        {loading && <ReportMessage tone="loading">Loading Budgets...</ReportMessage>}
        {!loading && error && <ReportMessage tone="error">Could not load: {error}</ReportMessage>}
        {!loading && !error && (
          <ReportSheet title="Budget Analysis" subtitle={budgetSummary(budgets, meta)}>
            <DataTable
              columns={budgetColumns(deleteBudget)}
              rows={budgets}
              emptyText={meta?.note || 'No budget created yet.'}
              stickyHeader={false}
            />
            {meta && budgets.length > 0 && (
              <div className="tw:border-t tw:border-border tw:bg-page tw:px-4 tw:py-2.5 tw:text-[11px] tw:text-muted-foreground">{meta.note}</div>
            )}
          </ReportSheet>
        )}
      </ReportFrame>
    </ReportPage>
  );
}
