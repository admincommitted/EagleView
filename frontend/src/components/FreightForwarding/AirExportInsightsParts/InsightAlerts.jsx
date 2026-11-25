import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, DataTable } from '@/components/ui';
import { useOpenAwb } from '../AirExportParts/airExport';
import { dateTimeOrDash, route } from './insights';

const TONES = {
  danger: { bar: 'tw:border-l-destructive', text: 'tw:text-destructive', ring: 'tw:ring-destructive' },
  warning: { bar: 'tw:border-l-warning', text: 'tw:text-warning', ring: 'tw:ring-warning' },
  primary: { bar: 'tw:border-l-primary', text: 'tw:text-primary', ring: 'tw:ring-primary' },
};

const DUE_CLASS = { MISSED: 'tw:text-destructive', TODAY: 'tw:text-warning' };

export function AlertBox({ alert, open, onToggle }) {
  const { icon: Icon, title, hint, count, tone } = alert;
  const colors = TONES[tone];
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => event.key === 'Enter' && onToggle()}
      className={cn(
        'tw:cursor-pointer tw:flex-row tw:items-center tw:gap-2.5 tw:border-l-4 tw:px-3.5 tw:py-3 tw:outline-none tw:hover:bg-accent/50',
        count ? colors.bar : 'tw:border-l-input',
        open && cn('tw:ring-2', colors.ring)
      )}
    >
      <Icon className={cn('tw:size-5.5 tw:shrink-0', count ? colors.text : 'tw:text-muted-foreground')} />
      <div className="tw:min-w-0 tw:flex-1">
        <div className="tw:text-[11px] tw:font-extrabold tw:text-foreground tw:uppercase">{title}</div>
        <div className="tw:mt-0.5 tw:text-[10px] tw:text-muted-foreground">{hint}</div>
      </div>
      <div className={cn('tw:text-[28px] tw:font-black', count ? colors.text : 'tw:text-muted-foreground/60')}>{count}</div>
      {open ? <ChevronDown className="tw:size-3.5" /> : <ChevronRight className="tw:size-3.5" />}
    </Card>
  );
}

const ALERT_TABLES = {
  due: (insights) => [{
    rows: insights.dueFlights,
    rowKey: (row) => row.type + row.id,
    open: (row) => [row.type, row.awbNumber],
    columns: [
      { key: 'due', header: 'When', cell: (row) => <span className={cn('tw:font-extrabold', DUE_CLASS[row.due] || 'tw:text-primary')}>{row.due}</span> },
      { key: 'awbNumber', header: 'AWB' },
      { key: 'type', header: 'Type' },
      { key: 'flight', header: 'Flight', cell: (row) => row.flight || '-' },
      { key: 'flightDate', header: 'Flight date', cell: (row) => dateTimeOrDash(row.flightDate) },
      { key: 'shipperName', header: 'Shipper' },
      { key: 'route', header: 'Route', cell: route },
      { key: 'problem', header: 'Problem', className: 'tw:font-bold tw:text-destructive' },
    ],
  }],
  stuck: (insights) => [{
    rows: insights.stuck,
    rowKey: (row) => row.type + row.id,
    open: (row) => [row.type, row.awbNumber],
    columns: [
      { key: 'awbNumber', header: 'AWB' },
      { key: 'type', header: 'Type' },
      { key: 'problem', header: 'Problem', className: 'tw:font-bold tw:text-warning' },
      { key: 'since', header: 'Since', cell: (row) => dateTimeOrDash(row.since) },
      { key: 'hours', header: 'Hours', className: 'tw:font-extrabold' },
      { key: 'shipperName', header: 'Shipper' },
      { key: 'route', header: 'Route', cell: route },
    ],
  }],
  fhl: (insights) => [{
    rows: insights.fhlPending,
    open: (row) => ['MAWB', row.awbNumber],
    columns: [
      { key: 'awbNumber', header: 'MAWB' },
      { key: 'houses', header: 'Houses' },
      { key: 'notSent', header: 'FHL not sent', className: 'tw:font-extrabold tw:text-warning' },
      { key: 'hawbs', header: 'HAWB numbers', cell: (row) => row.hawbs.join(', ') },
      { key: 'route', header: 'Route', cell: route },
    ],
  }],
  orphan: (insights) => [
    {
      rows: insights.orphanHawbs,
      emptyText: 'No HAWB without MAWB',
      open: (row) => ['HAWB', row.hawbNumber],
      columns: [
        { key: 'hawbNumber', header: 'HAWB' },
        { key: 'masterAwbNumber', header: 'MAWB given', cell: (row) => row.masterAwbNumber || '-' },
        { key: 'problem', header: 'Problem', className: 'tw:text-destructive' },
        { key: 'shipperName', header: 'Shipper' },
      ],
    },
    {
      rows: insights.emptyMawbs,
      emptyText: 'Every MAWB has houses',
      open: (row) => ['MAWB', row.awbNumber],
      columns: [
        { key: 'awbNumber', header: 'MAWB with no HAWB' },
        { key: 'route', header: 'Route', cell: route },
        { key: 'createdAt', header: 'Created', cell: (row) => dateTimeOrDash(row.createdAt) },
      ],
    },
  ],
};

export function AlertDetails({ alert, insights }) {
  const openAwb = useOpenAwb();
  const tables = ALERT_TABLES[alert.key](insights);

  return (
    <Card className="tw:gap-1.5 tw:p-2">
      {alert.count ? (
        <div className={cn('tw:grid tw:grid-cols-1 tw:gap-3', tables.length > 1 && 'tw:lg:grid-cols-2')}>
          {tables.map((table, index) => (
            <DataTable
              key={index}
              columns={table.columns}
              rows={table.rows}
              rowKey={table.rowKey || 'id'}
              emptyText={table.emptyText}
              onRowDoubleClick={(row) => openAwb(...table.open(row))}
            />
          ))}
        </div>
      ) : (
        <div className="tw:p-2.5 tw:text-entry tw:font-bold tw:text-success">Nothing here - all clear.</div>
      )}
      <div className="tw:px-1 tw:text-[10px] tw:text-muted-foreground">Double-click a row to open it.</div>
    </Card>
  );
}
