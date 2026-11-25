// Sales > Dashboard: the logged-in sales person's own figures (a manager sees his team, admin everyone, and can pick a
// person). Billing this FY against the same days of last FY, this month, month by month, outstanding / overdue,
// customers to act on, reviews and birthdays, and person by person for a team.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle, BarChart3, CalendarClock, CalendarDays, ClipboardCheck, Gift, HeartPulse, Hourglass, Inbox, IndianRupee, Info,
  Landmark, Package, RefreshCw, Send, Target, TrendingUp, Trophy, Users, Wallet,
} from 'lucide-react';
import { Button, SelectBox } from '@/components/ui';
import { cn } from '@/lib/utils';
import { salesHubApi } from './salesApi';
import { crore, dmy, inr, monthName } from './salesFormat';
import { ActivityBadge, KpiCard, Muted, Notice, Panel } from './salesWidgets';
import { BillingChart, CustomerList, HealthBar, ProfileCompleteness, TeamTable, UpcomingEvents } from './DashboardPanels';
import { customerColumn, growthOf, lastBillColumn, moneyColumn } from './dashboardColumns';
import { Delta, Money } from './SalesMoney';
import CustomerForm from './CustomerForm';

const PERSON_STORAGE_KEY = 'sales.dash.person';

function savedPerson() {
  try {
    return localStorage.getItem(PERSON_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

const ATTENTION_NOTES = {
  falling: () => 'Billed Rs 1 lakh+ in the same days last year and 30% or more down now.',
  quiet: () => 'Billed last year, no bill for 60 days or more - call or visit.',
  overdue: (defaultCredit) => `Outstanding past the ledger credit days (${defaultCredit} days where the ledger has none).`,
};

function attentionColumns(kind, customer, defaultCredit) {
  const growth = { key: 'growth', header: 'Change', align: 'right', cell: (row) => <Delta growth={row.growth} /> };
  const columns = {
    falling: [customer, moneyColumn('lyTo', 'Same days LY'), moneyColumn('cy', 'This FY'), growth, lastBillColumn],
    quiet: [
      customer, moneyColumn('ly', 'Last FY'), moneyColumn('cy', 'This FY'),
      {
        key: 'last',
        header: 'Last bill',
        align: 'right',
        cell: (row) => (row.lastBill
          ? <>{dmy(row.lastBill)}<div className="tw:text-[10.5px] tw:text-destructive">{row.daysSince} days</div></>
          : <span className="tw:text-destructive">not this FY</span>),
      },
    ],
    overdue: [
      customer, moneyColumn('outstanding', 'Outstanding'),
      { key: 'overdue', header: 'Overdue', align: 'right', cell: (row) => <b className="tw:text-destructive">{crore(row.overdue)}</b> },
      { key: 'credit', header: 'Credit', align: 'right', cell: (row) => `${row.creditDays || defaultCredit} d` },
      lastBillColumn,
    ],
  };
  return columns[kind];
}

function DealFigures({ deals, goTab }) {
  return (
    <Panel title="Enquiries and quotations" icon={Inbox} tone="amber" actions={<Muted>Click a figure to open the list</Muted>}>
      <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] tw:gap-2.5">
        <KpiCard compact label="Open enquiries" value={deals.openEnquiries} icon={Inbox} tone={deals.lateEnquiries ? 'red' : 'blue'} alert={Boolean(deals.lateEnquiries)} onClick={() => goTab('enquiries')}>
          <span>{deals.lateEnquiries ? `${deals.lateEnquiries} past "quote by"` : 'to be quoted'}</span>
        </KpiCard>
        <KpiCard compact label="Draft quotations" value={deals.draftQuotes} icon={ClipboardCheck} tone="slate" onClick={() => goTab('quotes', 'DRAFT')}><span>not sent yet</span></KpiCard>
        <KpiCard compact label="Quotations sent" value={deals.sentQuotes} icon={Send} tone="violet" onClick={() => goTab('quotes', 'SENT')}><span>{crore(deals.sentValue)} awaiting reply</span></KpiCard>
        <KpiCard compact label="Expiring / expired" value={`${deals.expiringQuotes} / ${deals.expiredQuotes}`} icon={Hourglass} tone="amber" onClick={() => goTab('quotes', 'EXPIRED')}><span>in 7 days / past validity</span></KpiCard>
        <KpiCard compact label="Won this month" value={deals.wonMonth} icon={Trophy} tone="green" tint onClick={() => goTab('quotes', 'WON')}><span>{crore(deals.wonMonthValue)} · margin {crore(deals.wonMonthMargin)}</span></KpiCard>
        <KpiCard compact label="Win rate this FY" value={deals.winRate == null ? '-' : `${deals.winRate}%`} icon={Target} tone="cyan"><span>{deals.fyWon} won, {deals.fyLost} lost</span></KpiCard>
      </div>
    </Panel>
  );
}

function BillingFigures({ figures }) {
  const kpi = figures.kpi;
  const month = monthName(figures.curMonth);
  return (
    <div className="tw:mb-3.5 tw:grid tw:grid-cols-[repeat(auto-fill,minmax(min(210px,100%),1fr))] tw:gap-3">
      <KpiCard label={`Billed FY ${figures.fyLabel} so far`} value={<Money amount={kpi.billedCy} />} icon={IndianRupee} tone="blue">
        <span><Delta growth={growthOf(kpi.billedCy, kpi.billedLyTo)} suffix={`vs ${crore(kpi.billedLyTo)} same days LY`} /></span>
        <span>Full last FY {crore(kpi.billedLy)}</span>
      </KpiCard>
      <KpiCard label={`${month} so far`} value={<Money amount={kpi.thisMonth} />} icon={CalendarDays} tone="violet">
        <span><Delta growth={growthOf(kpi.thisMonth, kpi.sameMonthLy)} suffix={`vs ${crore(kpi.sameMonthLy)} same days LY`} /></span>
        <span>Last month {crore(kpi.prevMonth)}</span>
      </KpiCard>
      <KpiCard label="Outstanding" value={<Money amount={kpi.outstanding} />} icon={Wallet} tone={kpi.overdue > 0 ? 'red' : 'green'}>
        <span>
          Overdue <b className={kpi.overdue > 0 ? 'tw:text-destructive' : 'tw:text-success'}>{crore(kpi.overdue)}</b>
          {kpi.outstanding > 0 ? ` (${Math.round((kpi.overdue / kpi.outstanding) * 100)}%)` : ''}
        </span>
        <span>{kpi.advances > 0 ? `Advances held ${crore(kpi.advances)}` : 'Past the ledger credit days'}</span>
      </KpiCard>
      <KpiCard label="Customers" value={<>{kpi.active}<span className="tw:text-[13px] tw:font-semibold tw:text-muted-foreground"> billing of {kpi.customers}</span></>} icon={Users} tone="green" tint>
        <span>New this FY <b className="tw:text-foreground">{kpi.newThisFy}</b> ({crore(kpi.newThisFyBilled)})</span>
        <span>{kpi.prospects} prospect(s)</span>
      </KpiCard>
      <KpiCard label="Duty / DO billed this FY" value={<Money amount={kpi.reimbCy} />} icon={Landmark} tone="slate">
        <span>Recovered on the customers' duty / DO accounts - kept out of the billing above</span>
      </KpiCard>
      <KpiCard label="Dockets this FY" value={kpi.dockets ? inr(kpi.dockets) : '-'} icon={Package} tone="cyan">
        <span>{month}: {inr(kpi.docketsMonth) || 0}</span>
        <span>
          {!kpi.dockets ? 'No docket has his name as marketing person'
            : kpi.docketsLyTo ? <Delta growth={growthOf(kpi.dockets, kpi.docketsLyTo)} suffix="vs same days LY" />
              : 'By the marketing person on the docket'}
        </span>
      </KpiCard>
    </div>
  );
}

export default function DashboardTab({ meta, reloadMeta, goTab }) {
  const [person, setPerson] = useState(savedPerson);
  const [figures, setFigures] = useState(null);
  const [busy, setBusy] = useState(false);
  const [attention, setAttention] = useState('falling');
  const [openCustomerId, setOpenCustomerId] = useState(null);
  const [deals, setDeals] = useState(null);

  const loadDeals = async (forPerson) => {
    try {
      setDeals((await salesHubApi.dealsSummary(forPerson)).data);
    } catch {
      setDeals(null);
    }
  };

  const load = async (forPerson = person) => {
    setBusy(true);
    loadDeals(forPerson);
    try {
      setFigures(await salesHubApi.dashboard(forPerson));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pickPerson = (picked) => {
    setPerson(picked);
    try { localStorage.setItem(PERSON_STORAGE_KEY, picked); } catch { /* private window: not remembered */ }
    load(picked);
  };

  if (!figures) return <Muted className="tw:py-5 tw:text-entry">{busy ? 'Reading the books…' : 'No figures.'}</Muted>;

  const { kpi, scope } = figures;
  const month = monthName(figures.curMonth);
  const customer = customerColumn(!scope.person);
  const attentionRows = { falling: figures.falling, quiet: figures.quiet, overdue: figures.overdue }[attention];
  const attentionTabs = [['falling', `Falling (${figures.falling.length})`], ['quiet', `Gone quiet (${figures.quiet.length})`], ['overdue', `Overdue (${figures.overdue.length})`]];
  const canOpenPerson = (member) => member.id && scope.options.some((option) => option.value === String(member.id));

  return (
    <div>
      <div className="tw:mb-3 tw:flex tw:flex-wrap tw:items-center tw:gap-3">
        <div className="tw:min-w-0">
          <div className="tw:text-lg tw:font-extrabold tw:text-foreground">{scope.person ? scope.person.name : scope.label}</div>
          <Muted className="tw:text-[11.5px]">
            FY {figures.fyLabel} up to {dmy(figures.asOn)} · billing is sales less credit notes, incl. GST{scope.person ? ' · customers where he is the KAM, every branch' : ''}
          </Muted>
        </div>
        <div className="tw:flex tw:w-full tw:flex-wrap tw:items-center tw:gap-1.5 tw:sm:ml-auto tw:sm:w-auto">
          {scope.options.length > 1 && (
            <SelectBox className="tw:w-full tw:sm:w-[220px]" value={scope.sel} onValueChange={pickPerson} options={scope.options} placeholder="Whose dashboard" />
          )}
          <Button onClick={() => load()} disabled={busy}><RefreshCw /> {busy ? 'Reading…' : 'Refresh'}</Button>
        </div>
      </div>

      {figures.canManage && figures.noLogin > 0 && (
        <Notice className="tw:mb-3.5 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-[10px]">
          <Info className="tw:size-3.5" /> {figures.noLogin} sales person(s) have no EagleView login linked. Link it on the sales person (Sales persons tab) - then he sees only his own dashboard and customers.
          {goTab && <Button variant="ghost" className="tw:ml-auto" onClick={() => goTab('persons')}>Open sales persons</Button>}
        </Notice>
      )}

      <BillingFigures figures={figures} />

      {deals && goTab && <div className="tw:mb-3.5"><DealFigures deals={deals} goTab={goTab} /></div>}

      <div className="tw:mb-3.5 tw:grid tw:grid-cols-1 tw:gap-3 tw:lg:grid-cols-[minmax(0,2.2fr)_minmax(260px,1fr)]">
        <Panel title="Billing month by month" icon={BarChart3} tone="blue" actions={<Muted>Rs lakh</Muted>}>
          <BillingChart months={figures.months} fyLabel={figures.fyLabel} />
        </Panel>
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-3">
          <Panel title="How the customers are billing" icon={HeartPulse} tone="green"><HealthBar kpi={kpi} /></Panel>
          <Panel title="Profiles filled" icon={ClipboardCheck} tone="violet"><ProfileCompleteness profile={figures.profile} /></Panel>
        </div>
      </div>

      <div className="tw:mb-3.5 tw:grid tw:grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] tw:gap-3">
        <Panel title="Top customers this FY" icon={TrendingUp} tone="blue" flush>
          <CustomerList
            rows={figures.top}
            onOpen={setOpenCustomerId}
            emptyText="Nothing billed this FY yet."
            columns={[
              customer,
              moneyColumn('cy', 'This FY'),
              { key: 'growth', header: 'vs same days LY', align: 'right', cell: (row) => <Delta growth={row.growth} /> },
              moneyColumn('thisMonth', month),
              { key: 'activity', header: '', cell: (row) => <ActivityBadge activity={row.activity} lastBill={row.lastBill} /> },
            ]}
          />
        </Panel>
        <Panel
          title="Needs attention"
          icon={AlertTriangle}
          tone="amber"
          flush
          actions={attentionTabs.map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              aria-pressed={attention === key}
              onClick={() => setAttention(key)}
              className={cn('tw:rounded-full tw:font-bold', attention === key ? 'tw:border-warning tw:bg-warning/10 tw:text-warning' : 'tw:text-muted-foreground')}
            >
              {label}
            </Button>
          ))}
        >
          <Muted className="tw:px-3 tw:pt-1.5">{ATTENTION_NOTES[attention](figures.defaultCredit)}</Muted>
          <CustomerList rows={attentionRows} columns={attentionColumns(attention, customer, figures.defaultCredit)} onOpen={setOpenCustomerId} emptyText="Nothing here - good." />
        </Panel>
      </div>

      {figures.team.length > 0 && (
        <div className="tw:mb-3.5">
          <Panel title="Sales person by sales person" icon={Users} tone="violet" flush actions={<Muted>Click a name to open his dashboard</Muted>}>
            <TeamTable team={figures.team} billedTotal={kpi.billedCy} monthLabel={month} canOpen={canOpenPerson} onOpenPerson={pickPerson} />
          </Panel>
        </div>
      )}

      <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] tw:gap-3">
        <Panel title="Reviews due (next 7 days)" icon={CalendarClock} tone="cyan" flush>
          <CustomerList
            rows={figures.reviews}
            onOpen={setOpenCustomerId}
            emptyText="No account review due. Set 'Next review' on a customer to plan visits."
            columns={[
              customer,
              {
                key: 'review',
                header: 'Review',
                align: 'right',
                cell: (row) => <span className={cn('tw:font-bold', row.late ? 'tw:text-destructive' : 'tw:text-foreground')}>{dmy(row.nextReviewDate)}{row.late ? ' (late)' : ''}</span>,
              },
              moneyColumn('cy', 'This FY'),
            ]}
          />
        </Panel>
        <Panel title="Birthdays and anniversaries (next 15 days)" icon={Gift} tone="pink" flush>
          <UpcomingEvents events={figures.events} onOpen={setOpenCustomerId} />
        </Panel>
      </div>

      {openCustomerId && <CustomerForm id={openCustomerId} meta={meta} onClose={() => setOpenCustomerId(null)} onSaved={() => {}} reloadMeta={reloadMeta} />}
    </div>
  );
}
