// Accounts dashboard (Accounts > Home): the whole books for a financial year - income / expense / profit, cash & bank,
// receivables and payables with ageing, GST & TDS position, monthly trend, money in vs out, top heads, control checks
// and recent vouchers; with the management view (mgmt) also margins, customers, collection, cash outlook and due dates.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, TrendingUp, TrendingDown, Landmark, ArrowDownLeft, ArrowUpRight, Percent, ShieldCheck, AlertTriangle, CheckCircle2, FileText, Scale } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { cn } from '@/lib/utils';
import { Button, SelectBox } from '@/components/ui';
import { accountsApi } from './accountsApi';
import { inr, fmtDate, lookup, Badge, statusTone } from './ui';
import { deskOf } from './CommandSearch';
import { Ageing } from './DashboardParts/Ageing';
import { MoneyFlowChart, TrendChart } from './DashboardParts/charts';
import { ManagementSections } from './DashboardParts/ManagementSections';
import { THREE_COLUMNS, TONE, monthName, shortAmount, subHeading } from './DashboardParts/format';
import { Check, DashCard, Delta, HeadBars, Kpi, MiniTable, Notice } from './DashboardParts/widgets';

const UPDATED_NOTE_MS = 4000;
const GRID = 'tw:grid tw:grid-cols-1 tw:items-stretch tw:gap-3';

const overdueText = (side) => (side.overdue ? 'Overdue ' + shortAmount(side.overdue) : 'Nothing overdue');

function useDashboard(fyId) {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [doneAt, setDoneAt] = useState(null);
  const [topBarYear, setTopBarYear] = useState('');

  const load = async () => {
    setBusy(true);
    setError('');
    setDoneAt(null);
    try {
      const loaded = await accountsApi.hubDashboard(fyId);
      setDashboard(loaded);
      setDoneAt(new Date());
      if (!fyId && loaded?.fy) setTopBarYear(loaded.fy.name);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { load(); }, [fyId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!doneAt) return undefined;
    const timer = setTimeout(() => setDoneAt(null), UPDATED_NOTE_MS);
    return () => clearTimeout(timer);
  }, [doneAt]);

  return { dashboard, error, busy, doneAt, topBarYear, load };
}

function useBudgets() {
  const [budgets, setBudgets] = useState(null);
  useEffect(() => {
    const loadBudgets = async () => {
      try {
        setBudgets(await accountsApi.hubBudgets());
      } catch {
        setBudgets(null);
      }
    };
    loadBudgets();
  }, []);
  return budgets;
}

// management figures per month win over the plain ledger figures when they are for the same month
function monthRows(dashboard, management) {
  return dashboard.months.map((month, index) => {
    const managed = management && management.months[index] && management.months[index].m === month.m ? management.months[index] : null;
    const lastYear = management && management.prev.has && management.prev.months[index] ? management.prev.months[index] : null;
    return {
      ...month,
      name: monthName(month.m),
      income: managed ? managed.income : month.income,
      expense: managed ? managed.expense : month.expense,
      profit: managed ? managed.profit : Math.round((month.income - month.expense) * 100) / 100,
      lyProfit: lastYear ? lastYear.profit : null,
    };
  });
}

function DashboardHeader({ dashboard, years, fyId, onYear, topBarYear, busy, doneAt, error, onRefresh }) {
  const yearOptions = years.filter((year) => (year.name || year.code) !== topBarYear).map((year) => ({ value: String(year.id), label: 'FY ' + (year.name || year.code) }));
  const topBarLabel = topBarYear ? 'FY ' + topBarYear + ' (top bar)' : 'Year in the top bar';
  const { fy, counts } = dashboard;
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5">
      <div className="tw:text-entry tw:text-muted-foreground">
        FY {fy.name} ({fmtDate(fy.startDate)} to {fmtDate(fy.endDate)}), figures as on {fmtDate(dashboard.asOn)}. {counts.ledgers} ledgers, {counts.parties} parties, {counts.vouchers} vouchers.
      </div>
      <div className="tw:ml-auto tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <SelectBox options={yearOptions} value={fyId} onValueChange={onYear} placeholder={topBarLabel} clearable clearLabel={topBarLabel} className="tw:w-[150px]" />
        {busy && <span className="tw:text-[11.5px] tw:text-muted-foreground">Fetching latest figures...</span>}
        {!busy && doneAt && <span className="tw:inline-flex tw:items-center tw:gap-1 tw:text-[11.5px] tw:font-bold tw:text-green-700"><CheckCircle2 className="tw:size-3.25" /> Updated {doneAt.toLocaleTimeString('en-IN')}</span>}
        {!busy && error && <span className="tw:text-[11.5px] tw:font-bold tw:text-destructive">Refresh failed: {error}</span>}
        <Button variant="default" size="lg" onClick={onRefresh} disabled={busy} aria-busy={busy} className="tw:min-w-[112px]">
          <RefreshCw className={cn('tw:size-3', busy && 'tw:animate-spin')} /> {busy ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
    </div>
  );
}

function KpiRow({ dashboard, management, go }) {
  const kpi = dashboard.kpi;
  const receivableSub = overdueText(dashboard.receivable) + (kpi.dso != null ? ', ' + kpi.dso + ' days' : '');
  const shared = [
    <Kpi key="cash" label="Cash & bank" icon={Landmark} value={kpi.cash} tone="blue" sub={dashboard.banks.length + ' accounts'} onClick={() => go.page('/trial-balance')} />,
    <Kpi key="receivable" label="Receivable" icon={ArrowDownLeft} value={kpi.receivable} tone="up" sub={receivableSub} onClick={() => go.report('partybal')} />,
    <Kpi key="payable" label="Payable" icon={ArrowUpRight} value={kpi.payable} tone="warn" sub={overdueText(dashboard.payable)} onClick={() => go.report('partybal')} />,
  ];
  if (!management) {
    return (
      <div className={cn(GRID, 'tw:grid-cols-[repeat(auto-fit,minmax(175px,1fr))]')}>
        <Kpi label="Income" icon={TrendingUp} value={kpi.income} tone="up" sub={'Sales incl. GST ' + shortAmount(kpi.sales)} onClick={() => go.report('salesreg')} />
        <Kpi label="Expenses" icon={TrendingDown} value={kpi.expense} tone="down" sub={'Purchases incl. GST ' + shortAmount(kpi.purchase)} onClick={() => go.report('purchasereg')} />
        <Kpi label="Net profit" icon={Percent} value={kpi.profit} tone={kpi.profit >= 0 ? 'blue' : 'down'} sub={kpi.margin == null ? 'Margin -' : 'Margin ' + kpi.margin + '%'} onClick={() => go.page('/profit-and-loss')} />
        {shared}
      </div>
    );
  }
  const { pl, prev, jobs } = management;
  const scrollToJobs = () => document.getElementById('acc-jobs')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return (
    <>
      <div className={cn(GRID, 'tw:sm:grid-cols-2 tw:xl:grid-cols-4')}>
        <Kpi label="Income" icon={TrendingUp} value={pl.income} tone="up" sub={<>Net revenue {shortAmount(pl.netRevenue)} {prev.has && <Delta value={prev.change.income} label="vs LY" />}</>} onClick={() => go.report('salesreg')} />
        <Kpi label="Gross margin" icon={Scale} value={pl.gross} tone="up" sub={<>{pl.grossPct != null && pl.grossPct + '% of net revenue '}{prev.has && <Delta value={prev.change.gross} label="vs LY" />}</>} onClick={() => go.page('/profit-and-loss')} />
        <Kpi label="Expenses" icon={TrendingDown} value={pl.expense} tone="down" sub={<>Indirect {shortAmount(pl.indirectExpense)} {prev.has && <Delta value={prev.change.expense} good="down" label="vs LY" />}</>} onClick={() => go.report('purchasereg')} />
        <Kpi label="Profit before tax" icon={Percent} value={pl.profit} tone={pl.profit >= 0 ? 'blue' : 'down'} sub={<>{pl.netPct != null && 'Margin ' + pl.netPct + '% '}{prev.has && <Delta value={prev.change.profit} label="vs LY" />}</>} onClick={() => go.page('/profit-and-loss')} />
        {shared}
        <Kpi label="Unbilled cost" icon={AlertTriangle} value={jobs.unbilled.cost} tone="warn" sub={jobs.unbilled.count + ' jobs with cost, no invoice'} onClick={scrollToJobs} />
      </div>
      {Math.abs(pl.approp) > 1 && (
        <Notice tone="info">
          Year-end entries of <b>₹ {inr(pl.approp, 0)}</b> to "Profit on Loss Account" (profit moved to reserves, income-tax provision, deferred tax) are not expenses of the year, so the profit above leaves them out. Profit after these entries, as it stands in the books: <b>₹ {inr(pl.bookProfit, 0)}</b>.
        </Notice>
      )}
    </>
  );
}

function TrendAndCash({ dashboard, management, months, go }) {
  const kpi = dashboard.kpi;
  return (
    <div className={cn(GRID, 'tw:md:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]')}>
      <DashCard
        title={management ? 'Income, expense and profit by month (before tax)' : 'Income, expense and profit by month'}
        icon={TrendingUp}
        right={<span>Working capital <b className={kpi.netWorking >= 0 ? TONE.income : TONE.expense}>₹ {shortAmount(kpi.netWorking)}</b></span>}
      >
        <TrendChart months={months} showLastYear={Boolean(management?.prev.has)} />
      </DashCard>
      <DashCard title="Cash & bank" icon={Landmark} right={<b className={TONE.brand}>₹ {inr(kpi.cash, 0)}</b>} padding="none">
        <MiniTable
          maxHeight={268}
          rows={dashboard.banks}
          rowKey={(bank) => bank.id}
          onRow={(bank) => go.ledger(bank.id)}
          empty="No bank or cash ledgers yet"
          columns={[
            { header: 'Account', cell: (bank) => <div className="tw:max-w-[150px] tw:truncate tw:font-semibold" title={bank.name}>{bank.name}<div className="tw:text-[9.5px] tw:font-normal tw:text-muted-foreground">{bank.group}</div></div> },
            { header: 'In (year)', right: true, cell: (bank) => shortAmount(bank.inflow), tone: () => TONE.receipt },
            { header: 'Out (year)', right: true, cell: (bank) => shortAmount(bank.outflow), tone: () => TONE.payment },
            { header: 'Balance', right: true, cell: (bank) => inr(bank.balance, 0), tone: (bank) => cn('tw:font-extrabold', bank.balance < 0 ? TONE.expense : TONE.text) },
          ]}
        />
      </DashCard>
    </div>
  );
}

function TaxPosition({ dashboard, go }) {
  const kpi = dashboard.kpi;
  const positions = [
    ['Output GST (on sales)', kpi.gstOut, TONE.expense],
    ['Input GST (on purchases)', kpi.gstIn, TONE.income],
    [kpi.gstNet >= 0 ? 'Net GST payable' : 'Net GST credit', Math.abs(kpi.gstNet), TONE.brand],
    ['TDS deducted (payable)', kpi.tds, TONE.warn],
  ];
  return (
    <DashCard title="GST & TDS position" icon={Percent} right={<span>this year</span>}>
      {positions.map(([label, value, tone], index) => (
        <div key={label} className={cn('tw:flex tw:justify-between tw:border-b tw:border-border/60 tw:px-0.5 tw:py-1.75 tw:text-entry', index === 2 ? 'tw:font-extrabold' : 'tw:font-semibold')}>
          <span>{label}</span><span className={cn('tw:tabular-nums', tone)}>{inr(value, 0)}</span>
        </div>
      ))}
      <div className={subHeading}>Tax ledger balances</div>
      <div className="tw:max-h-[110px] tw:overflow-y-auto">
        {dashboard.taxes.map((tax) => (
          <div key={tax.id} onClick={() => go.ledger(tax.id)} className="tw:flex tw:cursor-pointer tw:justify-between tw:px-0.5 tw:py-0.75 tw:text-[11px] tw:hover:bg-page">
            <span>{tax.name}</span><span className="tw:font-bold">{inr(Math.abs(tax.balance), 0)} {tax.balance < 0 ? 'Cr' : 'Dr'}</span>
          </div>
        ))}
        {!dashboard.taxes.length && <div className="tw:text-[11px] tw:text-muted-foreground">No tax balances</div>}
      </div>
    </DashCard>
  );
}

function ControlChecks({ dashboard, go }) {
  const control = dashboard.control;
  const overdue = dashboard.receivable.overdue;
  return (
    <DashCard title="Control & checks" icon={ShieldCheck}>
      <Check ok={!control.pending} label="Vouchers waiting for approval" value={control.pending ? control.pending + ' (' + shortAmount(control.pendingAmt) + ')' : 'None'} onClick={() => go.page('/expense-approvals')} />
      <Check ok={!control.rejected} label="Returned / rejected this year" value={control.rejected || 'None'} />
      <Check ok={!control.unbalanced} warn={Boolean(control.unbalanced)} label="Vouchers with Dr not equal to Cr" value={control.unbalanced || 'None'} />
      <Check ok={control.closedMonths > 0} label="Months closed this year" value={control.closedMonths + ' of 12'} onClick={() => go.report('monthclosing')} />
      <Check ok={!control.overLimit} warn={Boolean(control.overLimit)} label="Debtors over credit limit" value={control.overLimit || 'None'} />
      <Check ok={!control.noGstin} label="Parties without GSTIN" value={control.noGstin || 'None'} />
      <Check ok={!overdue} warn={overdue > 0} label="Overdue receivable" value={overdue ? '₹ ' + shortAmount(overdue) : 'None'} onClick={() => go.report('partybal')} />
    </DashCard>
  );
}

function RecentVouchers({ dashboard, go }) {
  return (
    <DashCard title="Recent vouchers" icon={FileText} padding="none" right={<span>{Object.entries(dashboard.byType).map(([type, count]) => type + ' ' + count.n).join(', ')}</span>}>
      <MiniTable
        showHeader={false}
        rows={dashboard.recent}
        rowKey={(voucher) => voucher.id}
        onRow={(voucher) => go.page('/accounts-hub?item=' + deskOf(voucher.baseType) + '&voucher=' + voucher.id)}
        empty="No vouchers yet"
        columns={[
          {
            cell: (voucher) => (
              <>
                <div className="tw:font-bold">{voucher.typeName} {voucher.voucherNumber}</div>
                <div className="tw:max-w-[170px] tw:truncate tw:text-[10px] tw:text-muted-foreground">{fmtDate(voucher.date)} {voucher.party || ''}</div>
              </>
            ),
          },
          { right: true, cell: (voucher) => <><div className="tw:font-bold">{inr(voucher.totalAmount, 0)}</div><Badge tone={statusTone(voucher.status)}>{voucher.status || 'Pending'}</Badge></> },
        ]}
      />
    </DashCard>
  );
}

export default function AccountsDashboard() {
  const navigate = useNavigate();
  const [years, setYears] = useState([]);
  const [fyId, setFyId] = useState('');
  const { dashboard, error, busy, doneAt, topBarYear, load } = useDashboard(fyId);
  const budgets = useBudgets();
  useEffect(() => {
    const loadYears = async () => setYears(await lookup('years'));
    loadYears();
  }, []);

  if (error && !dashboard) return <DashCard><div className="tw:text-entry tw:text-destructive">Dashboard could not load: {error}</div></DashCard>;
  if (!dashboard) {
    return (
      <DashCard>
        <div className="tw:flex tw:items-center tw:justify-center tw:gap-2 tw:p-5 tw:text-entry tw:text-muted-foreground">
          <RefreshCw className="tw:size-3.5 tw:animate-spin" /> Loading the accounts dashboard...
        </div>
      </DashCard>
    );
  }

  const go = {
    page: navigate,
    ledger: (id) => navigate('/accounts-hub?item=ledger&ledger=' + id),
    report: (id) => navigate('/accounts-hub?item=' + id),
    job: (jobNo) => navigate('/accounts-hub?item=expsheet&jobNo=' + encodeURIComponent(jobNo)),
  };
  const management = dashboard.mgmt && !dashboard.mgmt.error ? dashboard.mgmt : null;
  const months = monthRows(dashboard, management);
  const budgetRows = budgets?.data ? budgets.data.filter((row) => row.toDate >= dashboard.fy.startDate && row.fromDate <= dashboard.fy.endDate) : [];
  let running = 0;
  const flow = months.map((month) => { running += month.receipt - month.payment; return { ...month, net: Math.round(running) }; });
  const kpi = dashboard.kpi;

  return (
    <div className="tw:relative tw:flex tw:flex-col tw:gap-3" aria-busy={busy}>
      {busy && <div className="tw:absolute tw:inset-x-0 tw:-top-1.5 tw:z-[5] tw:h-0.75 tw:animate-pulse tw:rounded-xs tw:bg-violet-500" />}
      <DashboardHeader
        dashboard={dashboard} years={years} fyId={fyId} onYear={setFyId} topBarYear={topBarYear}
        busy={busy} doneAt={doneAt} error={error} onRefresh={load}
      />
      <div className={cn('tw:flex tw:flex-col tw:gap-3 tw:transition-opacity', busy && 'tw:pointer-events-none tw:opacity-50')}>
        {!dashboard.counts.vouchers && (
          <Notice>No vouchers in this year yet, so the figures are zero. They fill in as soon as vouchers are posted or the iCAFFE accounts are loaded.</Notice>
        )}
        <KpiRow dashboard={dashboard} management={management} go={go} />
        <TrendAndCash dashboard={dashboard} management={management} months={months} go={go} />
        {management && <ManagementSections management={management} budgetRows={budgetRows} go={go} />}
        {dashboard.mgmt?.error && <Notice>Management figures could not be worked out: {dashboard.mgmt.error}</Notice>}

        <div className={cn(GRID, 'tw:md:grid-cols-2')}>
          <DashCard title="Receivables ageing" icon={ArrowDownLeft} padding="roomy" right={<span>as on {fmtDate(dashboard.asOn)}</span>}>
            <Ageing side="Dr" data={dashboard.receivable} onParty={go.ledger} onReport={() => go.report('partybal')} />
          </DashCard>
          <DashCard title="Payables ageing" icon={ArrowUpRight} padding="roomy" right={<span>as on {fmtDate(dashboard.asOn)}</span>}>
            <Ageing side="Cr" data={dashboard.payable} onParty={go.ledger} onReport={() => go.report('partybal')} />
          </DashCard>
        </div>

        <div className={THREE_COLUMNS}>
          <DashCard title="Money in vs money out" icon={Landmark} right={<span>In {shortAmount(kpi.receipts)} / Out {shortAmount(kpi.payments)}</span>}>
            <MoneyFlowChart flow={flow} />
          </DashCard>
          <TaxPosition dashboard={dashboard} go={go} />
          <ControlChecks dashboard={dashboard} go={go} />
        </div>

        <div className={cn(GRID, 'tw:md:grid-cols-2 tw:xl:grid-cols-3')}>
          <DashCard title="Top expense heads" icon={TrendingDown}><HeadBars rows={dashboard.topExpenses} barClassName="tw:bg-rose-600" onRow={go.ledger} /></DashCard>
          <DashCard title="Top income heads" icon={TrendingUp}><HeadBars rows={dashboard.topIncome} barClassName="tw:bg-teal-600" onRow={go.ledger} /></DashCard>
          <RecentVouchers dashboard={dashboard} go={go} />
        </div>
      </div>
    </div>
  );
}
