import { BarChart2, PieChart as PieChartIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
const TOOLTIP_STYLE = { borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' };
const LEGEND_STYLE = { fontSize: '13px', paddingTop: '20px' };
const CHART_HEIGHT = 350;

const rupees = (value) => `₹${Number(value).toLocaleString('en-IN')}`;
const axisRupees = (value) => `₹${value >= 1000 ? `${value / 1000}k` : value}`;

function ChartCard({ title, icon, children }) {
  return (
    <Card>
      <CardHeader className="tw:mx-3 tw:mb-1.5 tw:justify-start tw:border-b tw:border-border tw:px-0 tw:pb-1">
        <CardTitle icon={icon}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="tw:h-[350px]">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>{children}</ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function MonthTrendChart({ months }) {
  return (
    <ChartCard title="Month-wise Trend" icon={<BarChart2 className="tw:text-primary" />}>
      <BarChart data={months} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="month" stroke="#94a3b8" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis stroke="#94a3b8" tickFormatter={axisRupees} axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
        <Tooltip formatter={(value) => [rupees(value), 'Spent']} cursor={{ fill: '#f8fafc' }} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="expense" radius={[6, 6, 0, 0]} barSize={36}>
          {months.map((month, index) => <Cell key={`${month.month}-${index}`} fill={COLORS[index % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ChartCard>
  );
}

export function CategorySpendChart({ categories }) {
  return (
    <ChartCard title="Spend by Category" icon={<PieChartIcon className="tw:text-primary" />}>
      <PieChart>
        <Pie data={categories} cx="50%" cy="45%" innerRadius={60} outerRadius={110} paddingAngle={2} dataKey="expense" nameKey="category" label={false}>
          {categories.map((category, index) => <Cell key={`${category.category}-${index}`} fill={COLORS[index % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(value) => [rupees(value), 'Amount']} contentStyle={TOOLTIP_STYLE} />
        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={LEGEND_STYLE} />
      </PieChart>
    </ChartCard>
  );
}
