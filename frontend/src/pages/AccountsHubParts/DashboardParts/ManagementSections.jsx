// Management view: division / branch margin, top customers, reimbursable, collection, next 30 days, vendor dues, jobs,
// indirect expenses with budgets, GST / TDS due dates and bank reconciliation.
import { ArrowUpRight, Briefcase, Building2, CalendarClock, Landmark, Receipt, TrendingDown, Users, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inr, fmtDate } from '../ui';
import { CollectionChart } from './charts';
import { JobsCard } from './JobsCard';
import { THREE_COLUMNS, TONE, changeText, linkText, marginTone, percentText, shortAmount, smallNote, subHeading } from './format';
import { AmountLine, BarTrack, DashCard, Figure, MiniTable } from './widgets';

const BUDGETS_SHOWN = 5;
const sumOf = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
const lossTone = (value) => (value < 0 ? TONE.expense : TONE.text);
const diffTone = (value) => (value < 0 ? TONE.expense : TONE.good);
const dueTone = (days) => (days < 0 ? TONE.muted : days <= 5 ? TONE.expense : days <= 15 ? TONE.warn : TONE.text);
const dueText = (days) => (days < 0 ? Math.abs(days) + ' days ago' : days === 0 ? 'Today' : 'in ' + days + ' days');
const expenseChangeTone = (change) => (change == null ? TONE.muted : change > 10 ? TONE.expense : change < 0 ? TONE.good : TONE.text);
const budgetBar = (state) => (state === 'Over budget' ? 'tw:bg-rose-600' : state === 'Near the limit' ? 'tw:bg-amber-500' : 'tw:bg-teal-600');

const TWO_COLUMNS = 'tw:grid tw:grid-cols-1 tw:items-stretch tw:gap-3 tw:md:grid-cols-2';
const WIDE_AND_NARROW = 'tw:grid tw:grid-cols-1 tw:items-stretch tw:gap-3 tw:md:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]';

function MarginCards({ management }) {
  const { pl, branches } = management;
  return (
    <div className={TWO_COLUMNS}>
      <DashCard title="Business-wise margin" icon={Briefcase} right={<span>net revenue = without reimbursable</span>}>
        <MiniTable
          rows={management.divisions}
          columns={[
            { header: 'Division', cell: (division) => division.name, bold: true },
            { header: 'Billed', right: true, cell: (division) => shortAmount(division.income) },
            { header: 'Net revenue', right: true, cell: (division) => shortAmount(division.netRevenue) },
            { header: 'Gross margin', right: true, bold: true, cell: (division) => shortAmount(division.gross) },
            { header: 'GM %', right: true, cell: (division) => percentText(division.grossPct), tone: (division) => marginTone(division.grossPct) },
            { header: 'Share', right: true, cell: (division) => division.share + '%' },
          ]}
          foot={['Total', shortAmount(pl.income), shortAmount(pl.netRevenue), shortAmount(pl.gross), percentText(pl.grossPct), '100%']}
        />
        <div className={smallNote}>Gross margin = billing less direct costs (freight, duty, AAI, clearing...). Salary, rent and other indirect costs (₹ {shortAmount(pl.indirectExpense)}) are not split by division in the books, so they are counted only in the total profit.</div>
      </DashCard>
      <DashCard title="Branch-wise" icon={Building2} right={<span>all branches you can see</span>}>
        <MiniTable
          rows={branches}
          highlight={(branch) => branch.current}
          empty="No branch figures"
          columns={[
            { header: 'Branch', cell: (branch) => branch.name + (branch.name !== branch.code ? ' (' + branch.code + ')' : ''), bold: true },
            { header: 'Net revenue', right: true, cell: (branch) => shortAmount(branch.netRevenue) },
            { header: 'Gross margin', right: true, cell: (branch) => shortAmount(branch.gross) },
            { header: 'GM %', right: true, cell: (branch) => percentText(branch.grossPct), tone: (branch) => marginTone(branch.grossPct) },
            { header: 'Profit before tax', right: true, bold: true, cell: (branch) => shortAmount(branch.profit), tone: (branch) => lossTone(branch.profit) },
            { header: 'Net %', right: true, cell: (branch) => percentText(branch.netPct), tone: (branch) => marginTone(branch.netPct) },
          ]}
          foot={branches.length > 1 ? ['All', shortAmount(sumOf(branches, 'netRevenue')), shortAmount(sumOf(branches, 'gross')), '', shortAmount(sumOf(branches, 'profit')), ''] : null}
        />
        <div className={smallNote}>Shaded row = the branch picked at the top. Profit is before the year-end tax and reserve entries.</div>
      </DashCard>
    </div>
  );
}

function CustomerCards({ management, go }) {
  const { reimb } = management;
  return (
    <div className={WIDE_AND_NARROW}>
      <DashCard title="Top 10 customers" icon={Users} right={<span>{management.customerCount} customers billed this year</span>}>
        <MiniTable
          rows={management.customers}
          onRow={(customer) => go.ledger(customer.id)}
          empty="No sales this year"
          columns={[
            { header: '#', cell: (customer, index) => index + 1 },
            { header: 'Customer', cell: (customer) => customer.name, bold: true, maxWidth: 240 },
            { header: 'Revenue', right: true, cell: (customer) => shortAmount(customer.revenue) },
            { header: 'Share', right: true, cell: (customer) => customer.share + '%' },
            { header: 'Jobs', right: true, cell: (customer) => customer.jobs },
            { header: 'Job margin', right: true, cell: (customer) => shortAmount(customer.margin), tone: (customer) => lossTone(customer.margin) },
            { header: 'Margin %', right: true, cell: (customer) => percentText(customer.marginPct), tone: (customer) => marginTone(customer.marginPct) },
            { header: 'Outstanding', right: true, cell: (customer) => (customer.outstanding ? shortAmount(customer.outstanding) : '-') },
            { header: 'Overdue', right: true, cell: (customer) => (customer.overdue ? shortAmount(customer.overdue) : '-'), tone: (customer) => (customer.overdue ? TONE.expense : TONE.muted) },
          ]}
        />
        <div className={smallNote}>Revenue = billing on the customer's invoices (without GST). Job margin = that billing less the direct costs booked on the same jobs.</div>
      </DashCard>
      <DashCard title="Reimbursable (pass-through)" icon={Receipt} right={<span onClick={() => go.report('gstreimbursable')} className={linkText}>Register</span>}>
        <AmountLine label="Billed to customers" value={reimb.billed} />
        <AmountLine label="Paid out (same heads)" value={reimb.cost} />
        <AmountLine label={reimb.diff < 0 ? 'Paid more than billed' : 'Billed more than paid'} value={Math.abs(reimb.diff)} strong tone={diffTone(reimb.diff)} />
        <div className={subHeading}>By head</div>
        <MiniTable
          rows={reimb.heads}
          onRow={(head) => go.ledger(head.id)}
          empty="No reimbursable billing"
          columns={[
            { header: 'Head', cell: (head) => head.name, maxWidth: 150 },
            { header: 'Billed', right: true, cell: (head) => shortAmount(head.billed) },
            { header: 'Paid', right: true, cell: (head) => shortAmount(head.cost) },
            { header: 'Diff', right: true, bold: true, cell: (head) => shortAmount(head.diff), tone: (head) => diffTone(head.diff) },
          ]}
        />
        <div className={smallNote}>Import duty, DO, stamp duty and the like are billed at cost. They are kept out of net revenue, so margins are not watered down.</div>
      </DashCard>
    </div>
  );
}

function CashCards({ management, go }) {
  const { collection, next30 } = management;
  return (
    <div className={THREE_COLUMNS}>
      <DashCard title="Billing vs collection" icon={Wallet} right={<span>Collected <b>{collection.pct == null ? '-' : collection.pct + '%'}</b> of billed</span>}>
        <CollectionChart months={collection.months} />
        <div className="tw:text-[10.5px] tw:text-muted-foreground">Billed {shortAmount(collection.billed)}, collected {shortAmount(collection.collected)} this year. Collections include old bills and advances.</div>
      </DashCard>
      <DashCard title="Next 30 days" icon={CalendarClock} right={<span>by the party's credit days</span>}>
        <AmountLine label="Cash & bank now" value={next30.cash} />
        <AmountLine sign="+" label="Receivable falling due" value={next30.recDue} tone={TONE.income} />
        <AmountLine sign="-" label="Payable falling due" value={next30.payDue} tone={TONE.expense} />
        <AmountLine sign="-" label="Payable already overdue" value={next30.payOverdue} tone={TONE.expense} />
        <AmountLine label="Expected position" value={next30.expected} strong tone={next30.expected < 0 ? TONE.expense : TONE.brand} />
        <div className="tw:mt-2.5 tw:rounded-md tw:border tw:border-orange-200 tw:bg-orange-50 tw:px-2.25 tw:py-1.75 tw:text-[11.5px]">
          Overdue receivable to chase: <b className={TONE.expense}>₹ {inr(next30.recOverdue, 0)}</b> - not counted above.
        </div>
      </DashCard>
      <DashCard title="Vendor payments due" icon={ArrowUpRight} padding="none" right={<span>overdue + next 30 days</span>}>
        <MiniTable
          maxHeight={262}
          rows={next30.vendors}
          onRow={(vendor) => go.ledger(vendor.id)}
          empty="Nothing due"
          columns={[
            { header: 'Vendor', cell: (vendor) => vendor.name, maxWidth: 150, bold: true },
            { header: 'Overdue', right: true, cell: (vendor) => (vendor.overdue ? shortAmount(vendor.overdue) : '-'), tone: (vendor) => (vendor.overdue ? TONE.expense : TONE.muted) },
            { header: 'Due 30 d', right: true, cell: (vendor) => (vendor.due30 ? shortAmount(vendor.due30) : '-') },
          ]}
        />
      </DashCard>
    </div>
  );
}

function ExpenseCards({ management, budgetRows, go }) {
  const { budget, prev } = management;
  return (
    <div id="acc-jobs" className="tw:grid tw:grid-cols-1 tw:items-stretch tw:gap-3 tw:md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <JobsCard management={management} onJob={go.job} />
      <DashCard title="Indirect expenses vs last year" icon={TrendingDown} right={<span>{shortAmount(budget.indirect)} {prev.has && <>(LY {shortAmount(budget.indirectLY)})</>}</span>}>
        <MiniTable
          maxHeight={250}
          rows={budget.rows}
          onRow={(head) => go.ledger(head.id)}
          empty="No indirect expenses"
          columns={[
            { header: 'Head', cell: (head) => head.name, maxWidth: 190, bold: true },
            { header: 'This year', right: true, cell: (head) => shortAmount(head.actual) },
            { header: 'Last year', right: true, cell: (head) => shortAmount(head.lastYear) },
            { header: 'Change', right: true, cell: (head) => changeText(head.vsLastYear), tone: (head) => expenseChangeTone(head.vsLastYear) },
            ...(budget.budgetHeads ? [{ header: 'Budget', right: true, cell: (head) => (head.budget == null ? '-' : shortAmount(head.budget)) }] : []),
          ]}
        />
        <div className={cn(subHeading, 'tw:flex tw:justify-between')}>
          <span>Budgets</span><span onClick={() => go.page('/budgets')} className="tw:cursor-pointer tw:text-primary">Budgets & Variance</span>
        </div>
        {budgetRows.length ? budgetRows.slice(0, BUDGETS_SHOWN).map((row) => (
          <div key={row.id} className="tw:mb-1.5">
            <div className="tw:flex tw:justify-between tw:text-[11px]">
              <span className="tw:font-semibold">{row.name}</span>
              <span className={cn('tw:font-bold', row.state === 'Over budget' ? TONE.expense : TONE.text)}>{shortAmount(row.utilized)} / {shortAmount(row.allocated)}</span>
            </div>
            <BarTrack percent={Math.min(100, row.utilisedPct || 0)} barClassName={budgetBar(row.state)} />
          </div>
        )) : (
          <div className="tw:text-[11.5px] tw:text-muted-foreground">No budget set for this year. Set one in Budgets & Variance (against a ledger, a group or a cost centre) to see spending against it here.</div>
        )}
      </DashCard>
    </div>
  );
}

function ComplianceCards({ management, go }) {
  const { brs } = management;
  return (
    <div className={TWO_COLUMNS}>
      <DashCard title="GST & TDS due dates" icon={CalendarClock} right={<span>from today</span>}>
        <MiniTable
          rows={management.compliance}
          empty="No due date in the next 45 days"
          columns={[
            { header: 'Return / payment', cell: (due) => due.what, bold: true },
            { header: 'Period', cell: (due) => due.period },
            { header: 'Due', cell: (due) => fmtDate(due.due) },
            { header: 'Days', right: true, cell: (due) => dueText(due.days), tone: (due) => dueTone(due.days) },
            { header: 'Amount (books)', right: true, cell: (due) => (due.amount == null ? '-' : inr(due.amount, 0)) },
          ]}
        />
        <div className={smallNote}>Dates as per GST / Income-tax rules (holidays and extensions not counted). Amounts are from the books of the branch picked; filing status is not tracked here - past dates are for checking that the return went in.</div>
      </DashCard>
      <DashCard title="Bank reconciliation" icon={Landmark} right={<span onClick={() => go.report('brs')} className={linkText}>Open BRS</span>}>
        <div className="tw:mb-2 tw:flex tw:flex-wrap tw:gap-6">
          <Figure label="Entries not matched" className={brs.open ? TONE.expense : TONE.good}>{brs.open}</Figure>
          <Figure label="Amount">₹ {shortAmount(brs.amount)}</Figure>
          <Figure label="Banks never reconciled" className={brs.neverDone ? TONE.warn : TONE.good}>{brs.neverDone}</Figure>
        </div>
        <MiniTable
          maxHeight={180}
          rows={brs.rows}
          onRow={() => go.report('brs')}
          empty="All bank entries are matched"
          columns={[
            { header: 'Bank', cell: (bank) => bank.name, maxWidth: 190, bold: true },
            { header: 'Open', right: true, cell: (bank) => bank.open },
            { header: 'Amount', right: true, cell: (bank) => shortAmount(bank.amount) },
            { header: 'Last reconciled', cell: (bank) => (bank.lastReconciled ? fmtDate(bank.lastReconciled) : 'Never'), tone: (bank) => (bank.lastReconciled ? TONE.text : TONE.warn) },
          ]}
        />
        <div className={smallNote}>Bank entries of this year older than 15 days ({brs.asOf ? fmtDate(brs.asOf) : ''}) with no clearing date in BRS.</div>
      </DashCard>
    </div>
  );
}

export function ManagementSections({ management, budgetRows, go }) {
  return (
    <>
      <MarginCards management={management} />
      <CustomerCards management={management} go={go} />
      <CashCards management={management} go={go} />
      <ExpenseCards management={management} budgetRows={budgetRows} go={go} />
      <ComplianceCards management={management} go={go} />
    </>
  );
}
