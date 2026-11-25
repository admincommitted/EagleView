import { ResponsiveContainer, ComposedChart, BarChart, AreaChart, Bar, Line, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';
import { inr } from '../ui';
import { CHART, monthName, shortAmount } from './format';

const CHART_MARGIN = { top: 6, right: 8, left: 0, bottom: 0 };
const AXIS_TICK = { fontSize: 10 };
const LEGEND_TEXT = { fontSize: 11 };
const TOOLTIP_BOX = { fontSize: 11, borderRadius: 6, border: '1px solid #cbd5e1' };
const rupees = (value) => '₹ ' + inr(value);
const ROUNDED_TOP = [3, 3, 0, 0];
const HEIGHT_CLASS = { 220: 'tw:h-[220px]', 250: 'tw:h-[250px]' };

// grid, month axis, amount axis, tooltip and legend shared by every chart
const chartFrame = [
  <CartesianGrid key="grid" stroke={CHART.grid} vertical={false} />,
  <XAxis key="x" dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />,
  <YAxis key="y" tickFormatter={shortAmount} tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} />,
  <Tooltip key="tip" contentStyle={TOOLTIP_BOX} formatter={rupees} />,
  <Legend key="legend" wrapperStyle={LEGEND_TEXT} />,
];

function ChartBox({ height, children }) {
  return <div className={cn(HEIGHT_CLASS[height])}><ResponsiveContainer>{children}</ResponsiveContainer></div>;
}

export function TrendChart({ months, showLastYear }) {
  return (
    <ChartBox height={250}>
      <ComposedChart data={months} margin={CHART_MARGIN}>
        {chartFrame}
        <Bar dataKey="income" name="Income" fill={CHART.income} radius={ROUNDED_TOP} maxBarSize={22} />
        <Bar dataKey="expense" name="Expense" fill={CHART.expense} radius={ROUNDED_TOP} maxBarSize={22} />
        <Line dataKey="profit" name="Profit" stroke={CHART.profit} strokeWidth={2} dot={{ r: 2 }} />
        {showLastYear && <Line dataKey="lyProfit" name="Profit last year" stroke={CHART.lastYear} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />}
      </ComposedChart>
    </ChartBox>
  );
}

export function CollectionChart({ months }) {
  return (
    <ChartBox height={220}>
      <BarChart data={months.map((month) => ({ ...month, name: monthName(month.m) }))} margin={CHART_MARGIN}>
        {chartFrame}
        <Bar dataKey="billed" name="Billed (incl. GST)" fill={CHART.billed} radius={ROUNDED_TOP} maxBarSize={18} />
        <Bar dataKey="collected" name="Collected" fill={CHART.receipt} radius={ROUNDED_TOP} maxBarSize={18} />
      </BarChart>
    </ChartBox>
  );
}

export function MoneyFlowChart({ flow }) {
  return (
    <ChartBox height={220}>
      <AreaChart data={flow} margin={CHART_MARGIN}>
        {chartFrame}
        <Area dataKey="receipt" name="Received" stroke={CHART.receipt} fill={CHART.receipt} fillOpacity={0.15} strokeWidth={2} />
        <Area dataKey="payment" name="Paid" stroke={CHART.payment} fill={CHART.payment} fillOpacity={0.12} strokeWidth={2} />
        <Line dataKey="net" name="Net (running)" stroke={CHART.profit} strokeDasharray="4 3" dot={false} />
      </AreaChart>
    </ChartBox>
  );
}
