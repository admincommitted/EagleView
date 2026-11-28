import { useEffect, useState } from 'react';
import { Activity, AlertCircle, Briefcase, Clock, Crosshair, Plus, RefreshCw, ShieldCheck, Users, Wifi } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { fieldTrackingApi } from '../fieldTrackingApi';
import PhoneAccessModal from './PhoneAccessModal';

const PUBLIC_URL_POLL_MS = 30000;

const KPIS = [
  { label: 'TOTAL', icon: Users, iconClass: 'tw:text-primary', count: (agents) => agents.length },
  { label: 'IN TRANSIT', icon: Activity, iconClass: 'tw:text-success', count: (agents) => agents.filter((agent) => agent.status === 'In Transit').length },
  { label: 'IDLE', icon: Clock, iconClass: 'tw:text-warning', count: (agents) => agents.filter((agent) => agent.status === 'Idle').length },
  { label: 'OFFLINE', icon: AlertCircle, iconClass: 'tw:text-destructive', count: (agents) => agents.filter((agent) => agent.status === 'Offline').length },
];

// the field app's internet link while start_field_internet.bat is running
function usePublicUrl() {
  const [publicUrl, setPublicUrl] = useState(null);
  useEffect(() => {
    const load = async () => {
      try {
        const answer = await fieldTrackingApi.publicUrl();
        setPublicUrl(answer?.url ? answer.url + '/field-app' : null);
      } catch {
        // keeps the last link shown
      }
    };
    load();
    const timer = setInterval(load, PUBLIC_URL_POLL_MS);
    return () => clearInterval(timer);
  }, []);
  return publicUrl;
}

function PhoneLink({ publicUrl }) {
  if (!publicUrl) {
    return <span title="Run start_field_internet.bat to put the field app on the internet" className="tw:text-[10px] tw:text-muted-foreground tw:normal-case">Internet link off (office Wi-Fi only)</span>;
  }
  const copy = () => {
    navigator.clipboard?.writeText(publicUrl);
    toast.success('Link copied');
  };
  return (
    <span title="Field app on mobile data - send this link to field boys" className="tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-full tw:bg-primary/10 tw:px-2 tw:py-px tw:text-[10px] tw:text-primary tw:normal-case">
      <Wifi className="tw:size-2.5" /> Phone link: <b className="tw:break-all">{publicUrl}</b>
      <Button size="sm" variant="default" className="tw:h-4 tw:px-1.5 tw:text-[10px]" onClick={copy}>Copy</Button>
    </span>
  );
}

export default function DashboardHeader({ agents, loading, onRefresh, onOpenWindow }) {
  const publicUrl = usePublicUrl();
  const [showPhoneAccess, setShowPhoneAccess] = useState(false);

  return (
    <div className="tw:mb-3 tw:flex tw:shrink-0 tw:flex-col tw:gap-3 tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
      <div className="tw:flex tw:items-center tw:gap-3">
        <div className="tw:rounded-lg tw:bg-primary tw:p-2 tw:text-primary-foreground">
          <Crosshair className="tw:size-5" />
        </div>
        <div className="tw:mr-4 tw:min-w-0">
          <h2 className="tw:m-0 tw:text-[18px] tw:font-extrabold tw:tracking-tight tw:text-foreground">Field Operations</h2>
          <div className="tw:mt-0.5 tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:text-[11px] tw:font-medium tw:text-muted-foreground">
            Monitor fleet &amp; live tracking
            <span className="tw:inline-flex tw:items-center tw:gap-1 tw:rounded-full tw:bg-success/15 tw:px-1.5 tw:py-px tw:text-[10px] tw:font-bold tw:text-success">
              <span className="tw:inline-block tw:size-1.5 tw:animate-[ping_2s_infinite] tw:rounded-full tw:bg-success" />
              LIVE
            </span>
            <PhoneLink publicUrl={publicUrl} />
          </div>
        </div>
      </div>

      <div className="tw:flex tw:flex-1 tw:gap-2 tw:overflow-x-auto tw:lg:justify-center">
        {KPIS.map(({ label, icon: Icon, iconClass, count }) => (
          <div key={label} className="tw:flex tw:shrink-0 tw:items-center tw:gap-1.5 tw:rounded-full tw:border tw:border-border tw:bg-background tw:px-2.5 tw:py-1">
            <Icon className={cn('tw:size-3', iconClass)} />
            <span className="tw:text-[10px] tw:font-bold tw:text-muted-foreground tw:uppercase">{label}</span>
            <span className="tw:text-[13px] tw:font-extrabold tw:text-foreground">{loading ? '…' : count(agents)}</span>
          </div>
        ))}
      </div>

      <div className="tw:flex tw:flex-wrap tw:gap-2.5 tw:lg:ml-4">
        <Button size="lg" variant="secondary" title="Refresh" aria-label="Refresh" onClick={onRefresh}><RefreshCw /></Button>
        <Button size="lg" title="Office code for the field app, and which phones are registered" onClick={() => setShowPhoneAccess(true)}>
          <ShieldCheck /> Phone access
        </Button>
        <Button size="lg" variant="default" onClick={() => onOpenWindow('report')}>📊 Report</Button>
        <Button size="lg" onClick={() => onOpenWindow('dispatch')}><Briefcase /> Dispatch Task</Button>
        <Button size="lg" variant="default" onClick={() => onOpenWindow('addAgent')}><Plus /> Add Agent</Button>
      </div>

      {showPhoneAccess && <PhoneAccessModal onClose={() => setShowPhoneAccess(false)} />}
    </div>
  );
}
