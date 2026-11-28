import { Battery, Clock, Loader2, MapPin, Search, Users } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { batteryTextClass, statusBadgeClass, statusDotClass, statusTextClass } from '../agentStatus';

function AgentRow({ agent, selected, onSelect }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(agent)}
      onKeyDown={(event) => event.key === 'Enter' && onSelect(agent)}
      className={cn(
        'tw:cursor-pointer tw:border-b tw:border-l-4 tw:border-b-border/50 tw:p-3 tw:transition-colors',
        selected ? 'tw:border-l-primary tw:bg-primary/5' : 'tw:border-l-transparent tw:bg-background',
      )}
    >
      <div className="tw:mb-1.5 tw:flex tw:items-start tw:justify-between tw:gap-2">
        <div className="tw:min-w-0">
          <div className="tw:text-[14px] tw:font-bold tw:text-foreground">{agent.name}</div>
          <div className="tw:mt-0.5 tw:text-[11px] tw:font-medium tw:text-muted-foreground">{agent.role}</div>
        </div>
        <div className={cn('tw:flex tw:shrink-0 tw:items-center tw:gap-1 tw:rounded-full tw:px-1.5 tw:py-0.5 tw:text-[10px] tw:font-bold', statusBadgeClass(agent.status), statusTextClass(agent.status))}>
          <span className={cn('tw:size-1.5 tw:rounded-full', statusDotClass(agent.status))} />
          {agent.status}
        </div>
      </div>
      <div className="tw:mb-2 tw:flex tw:items-center tw:gap-1.5 tw:rounded-md tw:bg-page tw:p-1.5 tw:text-entry tw:text-muted-foreground">
        <MapPin className="tw:size-3 tw:shrink-0 tw:text-primary" />
        <span className="tw:truncate">{agent.location}</span>
      </div>
      <div className="tw:flex tw:justify-between tw:text-[11px] tw:font-medium tw:text-muted-foreground">
        <span className={cn('tw:flex tw:items-center tw:gap-1', batteryTextClass(agent.battery))}><Battery className="tw:size-3" /> {agent.battery}%</span>
        <span className="tw:flex tw:items-center tw:gap-1"><Clock className="tw:size-3" /> {agent.lastSeen}</span>
      </div>
    </div>
  );
}

function NoAgents({ onAddAgent }) {
  return (
    <div className="tw:flex tw:h-[200px] tw:flex-col tw:items-center tw:justify-center tw:gap-2 tw:px-3 tw:text-muted-foreground">
      <Users className="tw:size-8" />
      <span className="tw:text-[13px]">No field agents yet</span>
      <span className="tw:max-w-[240px] tw:text-center tw:text-[11px] tw:leading-normal tw:normal-case">
        Add an agent here, or the field boy opens <b>http://&lt;this PC's IP&gt;:5001/field-app</b> on his phone (office Wi-Fi) and registers with his name and mobile. His location shows here once he starts.
      </span>
      <Button variant="default" className="tw:mt-2" onClick={onAddAgent}>+ Add First Agent</Button>
    </div>
  );
}

export default function AgentSidebar({ loading, agents, selectedAgent, searchQuery, onSearch, onSelect, onAddAgent }) {
  return (
    <div className="tw:flex tw:max-h-[50vh] tw:min-h-0 tw:flex-col tw:overflow-hidden tw:rounded-xl tw:border tw:border-border tw:bg-card tw:lg:max-h-none">
      <div className="tw:border-b tw:border-border tw:bg-page tw:p-4 tw:lg:p-5">
        <div className="tw:mb-3 tw:text-[16px] tw:font-bold tw:text-foreground">Active Agents</div>
        <Input data-allow-text leftIcon={Search} className="tw:h-9 tw:rounded-lg tw:text-[13px]" placeholder="Search by name or role..." value={searchQuery} onChange={(event) => onSearch(event.target.value)} />
      </div>
      <div className="tw:flex-1 tw:overflow-y-auto">
        {loading && (
          <div className="tw:flex tw:h-[200px] tw:flex-col tw:items-center tw:justify-center tw:gap-3 tw:text-muted-foreground">
            <Loader2 className="tw:size-6 tw:animate-spin" />
            <span className="tw:text-[13px]">Loading agents...</span>
          </div>
        )}
        {!loading && agents.length === 0 && <NoAgents onAddAgent={onAddAgent} />}
        {!loading && agents.map((agent) => <AgentRow key={agent.id} agent={agent} selected={selectedAgent?.id === agent.id} onSelect={onSelect} />)}
      </div>
    </div>
  );
}
