import { Activity, IndianRupee, MapPin, Package, TrendingUp, Users, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Card, CardContent, CardHeader, CardTitle, DataTable, SelectBox } from '@/components/ui';
import { oneDecimal } from '../AirExportParts/airExport';
import { ACTION_LABEL, ago, airlineName, dateTimeOrDash, monthName, percentChange } from './insights';

const RESERVATION_HOURS = 4;
const STALE_AFTER_MS = 30 * 60000;

export function Panel({ icon, title, actions, className, contentClassName, children }) {
  return (
    <Card className={className}>
      <CardHeader className="tw:border-b tw:border-border tw:py-2.5">
        <CardTitle icon={icon} className="tw:font-extrabold tw:uppercase">{title}</CardTitle>
        {actions}
      </CardHeader>
      <CardContent className={cn('tw:pt-3', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

const Hint = ({ className, children }) => <div className={cn('tw:text-[10px] tw:text-muted-foreground', className)}>{children}</div>;

function Bar({ value, max, className = 'tw:bg-primary' }) {
  const width = max ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="tw:h-2 tw:w-full tw:rounded-[3px] tw:bg-muted">
      <div className={cn('tw:h-full tw:w-(--bar-w) tw:rounded-[3px]', className)} style={{ '--bar-w': `${width}%` }} />
    </div>
  );
}

export function StockPanel({ stock, lowStock, airlines }) {
  const columns = [
    { key: 'airline', header: 'Airline', className: 'tw:font-bold', cell: (row) => airlineName(row.prefix, airlines) },
    { key: 'available', header: 'Available', cell: (row) => <span className={cn('tw:font-black', row.low ? 'tw:text-destructive' : 'tw:text-success')}>{row.available}</span> },
    {
      key: 'reserved',
      header: 'Reserved',
      cell: (row) => (
        <>
          {row.reserved}
          {row.expiredReservations ? <span className="tw:text-warning"> ({row.expiredReservations} over {RESERVATION_HOURS}h)</span> : null}
        </>
      ),
    },
    { key: 'used', header: 'Used' },
    {
      key: 'flags',
      header: '',
      cell: (row) => (
        <span className="tw:flex tw:gap-1.5">
          {row.low && <Badge variant="danger">LOW STOCK</Badge>}
          {row.availableButUsed ? <Badge variant="warning" title="Shown as available in stock but already saved on an AWB">{row.availableButUsed} USED, NOT MARKED</Badge> : null}
        </span>
      ),
    },
  ];
  return (
    <Panel icon={<Package />} title="AWB stock by airline">
      <DataTable columns={columns} rows={stock} rowKey="prefix" emptyText="No AWB stock entered. Add it in Masters → AWB Stock." />
      <Hint>Low stock = fewer than {lowStock} numbers left.</Hint>
    </Panel>
  );
}

function ChangeTile({ label, value, previous, unit, previousMonth }) {
  const change = percentChange(value, previous);
  const changeClass = change === null ? 'tw:text-muted-foreground' : change >= 0 ? 'tw:text-success' : 'tw:text-destructive';
  return (
    <div className="tw:rounded tw:bg-page tw:p-2">
      <div className="tw:text-[10px] tw:font-extrabold tw:text-muted-foreground tw:uppercase">{label}</div>
      <div className="tw:text-lg tw:font-black">{oneDecimal(value)}{unit}</div>
      <div className={cn('tw:text-[10px]', changeClass)}>
        {change === null ? `${previousMonth}: ${oneDecimal(previous)}${unit}` : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}% vs ${previousMonth}`}
      </div>
    </div>
  );
}

export function TonnagePanel({ tonnage, airlines }) {
  const { thisMonth, lastMonth, byAirline } = tonnage;
  const change = percentChange(thisMonth.chargeableWeight, lastMonth.chargeableWeight);
  const maxWeight = Math.max(1, ...byAirline.map((airline) => airline.chargeableWeight));
  const tiles = [
    { label: 'AWBs', key: 'awbs', unit: '' },
    { label: 'Gross wt', key: 'grossWeight', unit: ' kg' },
    { label: 'Chargeable wt', key: 'chargeableWeight', unit: ' kg' },
  ];

  return (
    <Panel icon={<TrendingUp />} title={`Tonnage - ${monthName(thisMonth.month)} (airline AWB + MAWB)`} contentClassName="tw:gap-2.5">
      <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-3">
        {tiles.map((tile) => (
          <ChangeTile key={tile.key} label={tile.label} value={thisMonth[tile.key]} previous={lastMonth[tile.key]} unit={tile.unit} previousMonth={monthName(lastMonth.month)} />
        ))}
      </div>
      {byAirline.map((airline) => (
        <div key={airline.prefix} className="tw:grid tw:grid-cols-[minmax(0,150px)_1fr_90px] tw:items-center tw:gap-2 tw:text-[11px]">
          <span className="tw:truncate" title={airlineName(airline.prefix, airlines)}>{airlineName(airline.prefix, airlines)}</span>
          <Bar value={airline.chargeableWeight} max={maxWeight} />
          <span className="tw:text-right tw:font-bold">{oneDecimal(airline.chargeableWeight)} kg</span>
        </div>
      ))}
      {!byAirline.length && <div className="tw:text-[11px] tw:text-muted-foreground">No airline AWB this month yet.</div>}
      {change !== null && <Hint>Chargeable weight {change >= 0 ? 'up' : 'down'} {Math.abs(change)}% on last month.</Hint>}
    </Panel>
  );
}

const TOP_LISTS = [
  { key: 'topDestinations', title: 'Top destinations', icon: MapPin, barClass: 'tw:bg-primary' },
  { key: 'topCustomers', title: 'Top customers', icon: Users, barClass: 'tw:bg-head' },
];

export function TopListPanels({ insights }) {
  const month = monthName(insights.tonnage.thisMonth.month);
  return TOP_LISTS.map((list) => {
    const rows = insights[list.key];
    const max = Math.max(1, ...rows.map((row) => row.shipments));
    return (
      <Panel key={list.key} icon={<list.icon />} title={`${list.title} - ${month}`}>
        {rows.map((row) => (
          <div key={row.name} className="tw:text-[11px]">
            <div className="tw:mb-0.5 tw:flex tw:justify-between tw:gap-2">
              <span className="tw:max-w-[65%] tw:truncate tw:font-bold" title={row.name}>{row.name}</span>
              <span className="tw:text-muted-foreground">{row.shipments} shpt · {oneDecimal(row.grossWeight)} kg</span>
            </div>
            <Bar value={row.shipments} max={max} className={list.barClass} />
          </div>
        ))}
        {!rows.length && <div className="tw:text-[11px] tw:text-muted-foreground">No shipments this month yet.</div>}
      </Panel>
    );
  });
}

export function FreightValuePanel({ byCurrency, currency, onCurrencyChange }) {
  const shown = byCurrency.find((entry) => entry.currency === currency) || byCurrency[0];
  const max = shown ? Math.max(1, ...shown.months.map((month) => month.total)) : 1;
  const latest = shown?.months.at(-1);
  const currencyPicker = byCurrency.length > 1 && (
    <SelectBox size="sm" className="tw:w-20" value={currency} onValueChange={onCurrencyChange} options={byCurrency.map((entry) => entry.currency)} />
  );

  return (
    <Panel icon={<IndianRupee />} title="Airline freight - 6 months" actions={currencyPicker}>
      {shown ? (
        <>
          <div className="tw:flex tw:h-[110px] tw:items-end tw:gap-2">
            {shown.months.map((month) => (
              <div
                key={month.month}
                title={`${monthName(month.month)}: PP ${oneDecimal(month.prepaid)} / CC ${oneDecimal(month.collect)} ${shown.currency}`}
                className="tw:flex tw:h-full tw:flex-1 tw:flex-col tw:justify-end"
                style={{ '--collect-h': `${(month.collect / max) * 100}%`, '--prepaid-h': `${(month.prepaid / max) * 100}%` }}
              >
                <div className="tw:h-(--collect-h) tw:bg-warning" />
                <div className="tw:h-(--prepaid-h) tw:rounded-t-[3px] tw:bg-success" />
              </div>
            ))}
          </div>
          <div className="tw:flex tw:gap-2">
            {shown.months.map((month) => <div key={month.month} className="tw:flex-1 tw:text-center tw:text-[9px] tw:text-muted-foreground">{monthName(month.month)}</div>)}
          </div>
          <div className="tw:flex tw:justify-between tw:text-[11px]">
            <span><span className="tw:text-success">■</span> Prepaid <span className="tw:ml-1.5 tw:text-warning">■</span> Collect</span>
            <b>{monthName(latest.month)}: {oneDecimal(latest.total)} {shown.currency}</b>
          </div>
        </>
      ) : <div className="tw:text-[11px] tw:text-muted-foreground">No freight charges saved yet.</div>}
    </Panel>
  );
}

const ACTIVITY_COLUMNS = [
  { key: 'at', header: 'When', className: 'tw:text-muted-foreground', cell: (row) => <span title={dateTimeOrDash(row.at)}>{ago(row.at)}</span> },
  { key: 'awbNumber', header: 'AWB / HAWB', className: 'tw:font-bold' },
  { key: 'action', header: 'Action', cell: (row) => ACTION_LABEL[row.action] || row.action },
  { key: 'user', header: 'User' },
  { key: 'details', header: 'Details', className: 'tw:whitespace-normal tw:text-muted-foreground' },
];

export function ActivityPanel({ activity }) {
  return (
    <Panel icon={<Activity />} title="Recent activity">
      <DataTable columns={ACTIVITY_COLUMNS} rows={activity} rowKey={(row, index) => index} emptyText="No activity yet." containerClassName="tw:max-h-[260px]" />
    </Panel>
  );
}

const CONNECTION_TIMES = [
  { label: 'Last connected', key: 'lastConnectedAt' },
  { label: 'Last checked', key: 'lastCheckedAt' },
  { label: 'Last status (FSU) received', key: 'lastFsuAt' },
  { label: 'Last FWB / FHL sent', key: 'lastSentAt' },
];

export function ConnectionPanel({ connection }) {
  const stale = connection.lastCheckedAt && Date.now() - new Date(connection.lastCheckedAt) > STALE_AFTER_MS;
  const notSetUp = connection.configured === false;
  const online = connection.connected && !stale;
  const statusClass = notSetUp ? 'tw:text-warning' : online ? 'tw:text-success' : 'tw:text-destructive';
  const statusText = notSetUp ? 'NOT SET UP' : online ? 'CONNECTED' : 'OFFLINE';
  const icon = connection.connected ? <Wifi className="tw:text-success" /> : <WifiOff className="tw:text-destructive" />;

  return (
    <Panel icon={icon} title="Airline connection (SFTP / FSU)" contentClassName="tw:gap-1.5 tw:text-[11px]">
      <div className={cn('tw:text-[13px] tw:font-black', statusClass)}>
        {statusText}{connection.env ? ` · ${String(connection.env).toUpperCase()}` : ''}
      </div>
      {notSetUp && <div className="tw:text-muted-foreground">SFTP login is not filled in. Set it in Settings → SFTP.</div>}
      {CONNECTION_TIMES.map((time) => (
        <div key={time.key} className="tw:flex tw:justify-between tw:border-b tw:border-dashed tw:border-border tw:pb-1">
          <span className="tw:text-muted-foreground">{time.label}</span>
          <b title={dateTimeOrDash(connection[time.key])}>{ago(connection[time.key])}</b>
        </div>
      ))}
      {connection.lastSentAwb && <div className="tw:text-muted-foreground">Last sent: {connection.lastSentAwb}</div>}
      {connection.lastError && <div className="tw:break-words tw:text-destructive">Last error: {connection.lastError}</div>}
      {stale && <div className="tw:text-warning">No check for over 30 minutes - is the poller running?</div>}
    </Panel>
  );
}
