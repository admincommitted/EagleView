import { Button, DateInput, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';

function Tile({ icon, value, label, valueClass, className }) {
  return (
    <div className={cn('tw:rounded-xl tw:border tw:border-border tw:p-3 tw:text-center', className)}>
      <div className="tw:mb-1 tw:text-[18px]">{icon}</div>
      <div className={cn('tw:text-[18px] tw:font-extrabold tw:text-foreground', valueClass)}>{value}</div>
      <div className="tw:text-[10px] tw:font-bold tw:text-muted-foreground tw:uppercase">{label}</div>
    </div>
  );
}

function AgentReport({ row }) {
  const active = row.totalPings > 0;
  const facts = [['📍', 'Pings', row.totalPings, ''], ['🛣️', 'Distance', row.distanceKm, ' km'], ['⏱️', 'Active', row.activeHours, ' hrs'], ['🏃', 'Avg Speed', row.avgSpeed, ' km/h']];
  return (
    <div className="tw:rounded-2xl tw:border tw:border-border tw:bg-page tw:p-4">
      <div className={cn('tw:flex tw:items-center tw:justify-between tw:gap-2', active && 'tw:mb-3')}>
        <div>
          <div className="tw:text-[16px] tw:font-extrabold tw:text-foreground">{row.agentName}</div>
          <div className="tw:mt-0.5 tw:text-entry tw:text-muted-foreground">{row.role} · {row.agentId}</div>
        </div>
        <div className={cn('tw:rounded-full tw:px-3 tw:py-1 tw:text-[11px] tw:font-bold', active ? 'tw:bg-success/10 tw:text-success' : 'tw:bg-muted tw:text-muted-foreground')}>
          {active ? '● Active' : '○ No Activity'}
        </div>
      </div>
      {active ? (
        <div className="tw:grid tw:grid-cols-2 tw:gap-2 tw:sm:grid-cols-4">
          {facts.map(([icon, label, value, unit]) => <Tile key={label} icon={icon} label={label} value={`${value}${unit}`} className="tw:bg-background" />)}
        </div>
      ) : (
        <div className="tw:pt-1 tw:text-[13px] tw:text-muted-foreground">No activity recorded on this day</div>
      )}
    </div>
  );
}

export default function DailyReportWindow({ reportDate, onDateChange, reportData, reportLoading, onGenerate, onClose }) {
  const totalDistance = (reportData || []).reduce((total, row) => total + (row.distanceKm || 0), 0).toFixed(1) + ' km';
  return (
    <Modal
      open
      width={680}
      onClose={onClose}
      closeOnOutside={false}
      title="📊 Daily Activity Report"
      description="Today's performance — details of every agent"
      className="tw:max-h-[85vh]"
    >
      <div className="tw:flex tw:gap-2.5">
        <DateInput wrapperClassName="tw:flex-1" value={reportDate} onValueChange={onDateChange} />
        <Button variant="default" onClick={onGenerate} disabled={reportLoading}>{reportLoading ? '⏳ Loading…' : '🔍 Generate'}</Button>
      </div>
      {!reportData && !reportLoading && (
        <div className="tw:py-10 tw:text-center tw:text-muted-foreground">
          <div className="tw:mb-3 tw:text-[40px]">📊</div>
          Date chunein aur Generate dabao
        </div>
      )}
      {reportData && (
        <div className="tw:flex tw:flex-col tw:gap-3">
          <div className="tw:mb-2 tw:grid tw:grid-cols-1 tw:gap-2.5 tw:sm:grid-cols-3">
            <Tile icon="👥" label="Total Agents" value={reportData.length} className="tw:bg-page" />
            <Tile icon="✅" label="Active Today" value={reportData.filter((row) => row.totalPings > 0).length} valueClass="tw:text-success" className="tw:bg-page" />
            <Tile icon="🛣️" label="Total Distance" value={totalDistance} valueClass="tw:text-primary" className="tw:bg-page" />
          </div>
          {reportData.map((row) => <AgentReport key={row.agentId} row={row} />)}
        </div>
      )}
    </Modal>
  );
}
