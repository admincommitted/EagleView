import { crore, dmy, inr, MONTH_NAMES } from '../salesFormat';
import { FigureTile, FormSection, Muted } from '../salesWidgets';

const BAR_AREA_PX = 80;

export function CustomerTiles({ figures, balance }) {
  const dockets = figures.dockets || {};
  const tiles = [
    ['Billed this FY', crore(figures.billedCy), figures.billsCy ? `${figures.billsCy} bills` : ''],
    ['Billed last FY', crore(figures.billedLy), ''],
    ['Duty / DO this FY', crore(figures.reimbCy), figures.reimbLy ? `last FY ${crore(figures.reimbLy)}` : ''],
    ['Last bill', dmy(figures.lastBill) || '-', ''],
    ['Dockets this FY', dockets.cy || 0, Object.entries(dockets.byDivision || {}).map(([division, count]) => `${division} ${count}`).join(' · ')],
    ['Outstanding', balance ? `${inr(balance.balance)} ${balance.side || ''}` : '-', balance && balance.creditDays ? `credit ${balance.creditDays} days` : ''],
  ];
  return (
    <div className="tw:mb-2.5 tw:grid tw:grid-cols-[repeat(auto-fill,minmax(min(150px,100%),1fr))] tw:gap-2">
      {tiles.map(([label, value, note]) => <FigureTile key={label} label={label} value={value} note={note} />)}
    </div>
  );
}

// every month from the start of last FY to this month, the empty ones too
function monthsSinceLastFy(billedMonths) {
  const byMonth = new Map(billedMonths.map((month) => [month.month, month]));
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const fyStartYear = thisMonth < 4 ? thisYear - 1 : thisYear;
  const months = [];
  for (let year = fyStartYear - 1, month = 4; year < thisYear || (year === thisYear && month <= thisMonth);) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    months.push(byMonth.get(key) || { month: key, billed: 0, reimb: 0, bills: 0 });
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return months;
}

function monthLabel(key) {
  const month = key.slice(5, 7);
  return `${MONTH_NAMES[Number(month) - 1]}${month === '04' || month === '01' ? ` ${key.slice(2, 4)}` : ''}`;
}

export function MonthlyBilling({ billedMonths }) {
  const months = monthsSinceLastFy(billedMonths);
  const highest = Math.max(1, ...months.map((month) => Math.max(month.billed || 0, 0) + Math.max(month.reimb || 0, 0)));
  const barHeight = (amount) => `${(Math.max(amount, 0) / highest) * BAR_AREA_PX}px`;
  const legend = (
    <Muted className="tw:flex tw:items-center tw:gap-1">
      <span className="tw:inline-block tw:size-2.5 tw:bg-primary" /> service
      <span className="tw:ml-2 tw:inline-block tw:size-2.5 tw:bg-slate-400" /> duty / DO
    </Muted>
  );
  return (
    <FormSection title="Billing by month (last FY and this FY)" actions={legend}>
      <div className="tw:overflow-x-auto">
        <div className="tw:flex tw:h-[90px] tw:min-w-[480px] tw:items-end tw:gap-1">
          {months.map((month) => (
            <div
              key={month.month}
              title={`${month.month}: service ${inr(month.billed)}${month.reimb ? `, duty / DO ${inr(month.reimb)}` : ''}, ${month.bills} bills`}
              className="tw:flex tw:h-full tw:min-w-2.5 tw:flex-1 tw:flex-col tw:justify-end"
            >
              <div className="tw:h-(--bar-h) tw:bg-slate-400" style={{ '--bar-h': barHeight(month.reimb) }} />
              <div className="tw:h-(--bar-h) tw:bg-primary" style={{ '--bar-h': barHeight(month.billed) }} />
              <div className="tw:mt-0.5 tw:text-center tw:text-[9px] tw:text-muted-foreground">{monthLabel(month.month)}</div>
            </div>
          ))}
        </div>
      </div>
    </FormSection>
  );
}
