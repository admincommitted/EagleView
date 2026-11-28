import { useNavigate } from 'react-router-dom';
import { BookmarkPlus, FileBadge, FileText, LayoutDashboard, Navigation, Package, PackageSearch, PlaneTakeoff } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui';

const WORKSPACE_LINKS = [
  { title: 'Dashboard', subtitle: 'Overview', icon: LayoutDashboard, colour: '#3b82f6', path: '/e-freight' },
  { title: 'E-AWB', subtitle: 'Air Waybill', icon: PlaneTakeoff, colour: '#0284c7', path: '/e-freight/create-awb' },
  { title: 'MAWB', subtitle: 'Master AWB', icon: FileBadge, colour: '#8b5cf6', path: '/freight/create-mawb' },
  { title: 'HAWB', subtitle: 'House AWB', icon: FileText, colour: '#10b981', path: '/freight/create-hawb' },
  { title: 'Booking', subtitle: 'Flight Booking', icon: BookmarkPlus, colour: '#f59e0b' },
  { title: 'Track', subtitle: 'Live Tracking', icon: Navigation, colour: '#ef4444', path: '/freight/track-shipments' },
];

function WorkspaceLink({ link, onOpen }) {
  const Icon = link.icon;
  return (
    <Button
      onClick={onOpen}
      style={{ '--link-colour': link.colour }}
      className="tw:h-auto tw:min-w-[130px] tw:flex-1 tw:justify-start tw:gap-2 tw:rounded-lg tw:border-input tw:bg-linear-to-b tw:from-white tw:to-page tw:px-3 tw:py-2 tw:transition-all tw:hover:border-(--link-colour) tw:sm:flex-none"
    >
      <Icon className="tw:size-[18px] tw:text-(--link-colour)" />
      <span className="tw:flex tw:flex-col tw:items-start">
        <span className="tw:text-xs tw:font-bold tw:text-foreground">{link.title}</span>
        <span className="tw:text-[10px] tw:font-normal tw:text-muted-foreground">{link.subtitle}</span>
      </span>
    </Button>
  );
}

export default function EFreightDashboard() {
  const navigate = useNavigate();
  const open = (link) => (link.path ? navigate(link.path) : toast('Booking module coming soon!'));

  return (
    <div className="tw:flex tw:min-h-screen tw:flex-col tw:bg-page">
      <div className="tw:flex tw:flex-col tw:gap-3 tw:border-b tw:border-border tw:bg-card tw:px-4 tw:py-3 tw:md:flex-row tw:md:items-center tw:md:justify-between tw:md:gap-5 tw:md:px-6">
        <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-3">
          <div className="tw:rounded-lg tw:bg-primary/10 tw:p-2 tw:text-primary"><Package className="tw:size-[22px]" /></div>
          <div>
            <h2 className="tw:m-0 tw:text-base tw:font-bold tw:tracking-[0.02em] tw:text-foreground tw:uppercase">E-Freight Workspace</h2>
            <div className="tw:text-[11px] tw:text-muted-foreground tw:uppercase">Manage Electronic Waybills</div>
          </div>
        </div>

        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:md:justify-end">
          {WORKSPACE_LINKS.map((link) => <WorkspaceLink key={link.title} link={link} onOpen={() => open(link)} />)}
        </div>
      </div>

      <div className="tw:flex-1 tw:p-4 tw:md:p-6">
        <div className="tw:flex tw:h-full tw:min-h-[400px] tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-dashed tw:border-input tw:bg-card tw:text-muted-foreground/70">
          <div className="tw:text-center">
            <PackageSearch className="tw:mx-auto tw:mb-4 tw:size-12 tw:text-muted-foreground/40" />
            <p>E-Freight Dashboard Content / Tables will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
