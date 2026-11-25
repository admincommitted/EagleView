import { Briefcase, History, Navigation, Phone, ShieldAlert, Wifi } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

function AgentFact({ label, icon: Icon, iconClass, value }) {
  return (
    <div className="tw:min-w-0">
      <div className="tw:mb-1 tw:text-[10px] tw:font-bold tw:text-muted-foreground tw:uppercase">{label}</div>
      <div className="tw:flex tw:items-center tw:gap-1 tw:text-[13px] tw:font-bold tw:text-foreground">
        <Icon className={cn('tw:size-3.5 tw:shrink-0', iconClass)} /> <span className="tw:truncate">{value}</span>
      </div>
    </div>
  );
}

export default function SelectedAgentPanel({ agent, isReplaying, onHistory, onReplay, onAssignTask, onMarkDone, onSiren }) {
  return (
    <div className="tw:relative tw:z-[100] tw:border-t tw:border-border tw:bg-background tw:px-3 tw:py-2 tw:shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="tw:mb-2 tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <div className="tw:min-w-0">
          <div className="tw:mb-0.5 tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <h3 className="tw:m-0 tw:text-[16px] tw:font-extrabold tw:text-foreground">{agent.name}</h3>
            <span className="tw:rounded-full tw:bg-muted tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-semibold tw:text-muted-foreground">{agent.id}</span>
            {agent.isStale && (
              <span className="tw:rounded-full tw:border tw:border-warning/40 tw:bg-warning/15 tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-bold tw:text-warning">⚠️ No Ping</span>
            )}
          </div>
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5">
            <span className="tw:text-entry tw:font-medium tw:text-muted-foreground">{agent.role} · {agent.vehicleNumber}</span>
            {agent.phone && (
              <a href={`tel:${agent.phone}`} className="tw:inline-flex tw:items-center tw:gap-1 tw:rounded-lg tw:bg-success tw:px-2.5 tw:py-0.5 tw:text-entry tw:font-bold tw:text-white tw:no-underline">
                📞 {agent.phone}
              </a>
            )}
          </div>
        </div>

        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <Button size="lg" variant="secondary" onClick={onHistory}><History /> History</Button>
          <Button size="lg" variant="default" onClick={onReplay} disabled={isReplaying}>{isReplaying ? '⏳ Replaying…' : '▶️ Replay'}</Button>
          <Button size="lg" onClick={onAssignTask}>Assign Task</Button>
          {agent.taskStatus === 'Pending' && <Button size="lg" variant="success" onClick={onMarkDone}>✅ Mark Done</Button>}
          <Button size="lg" variant="destructive" onClick={onSiren}><ShieldAlert /> Siren</Button>
        </div>
      </div>

      <div className="tw:grid tw:grid-cols-2 tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-page tw:px-3 tw:py-2 tw:md:grid-cols-4">
        <AgentFact label="Current Speed" icon={Navigation} iconClass="tw:text-primary" value={agent.speed} />
        <AgentFact label="Contact" icon={Phone} iconClass="tw:text-success" value={agent.phone} />
        <AgentFact label="Active Task" icon={Briefcase} iconClass="tw:text-head" value={agent.task} />
        <AgentFact label="Last Synced" icon={Wifi} iconClass="tw:text-warning" value={agent.lastSeen} />
      </div>
    </div>
  );
}
