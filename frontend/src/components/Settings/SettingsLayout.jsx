import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Building, Calendar, Cpu, Globe, Hash, Mail, MessageCircle, Network, Settings, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { usePermissions } from '../../utils/permissions';
import CHAMasterTab from './Tabs/CHAMasterTab';
import SequenceConfigTab from './Tabs/SequenceConfigTab';
import SystemSetupTab from './Tabs/SystemSetupTab';
import BranchMasterTab from './Tabs/BranchMasterTab';
import FinancialYearTab from './Tabs/FinancialYearTab';
import NetworkSettingsTab from './Tabs/NetworkSettingsTab';
import WhatsappSettingsTab from './Tabs/WhatsappSettingsTab';
import EmailSettingsTab from './Tabs/EmailSettingsTab';
import AiSettingsTab from './Tabs/AiSettingsTab';
import UlipSettingsTab from './Tabs/UlipSettingsTab';
import SecuritySettingsTab from './Tabs/SecuritySettingsTab';
import NumberSeriesTab from './Tabs/NumberSeriesTab';
import IcegateProfileSettings from './IcegateProfileSettings';

const ACTIVE_TONES = {
  sky: 'tw:border-l-sky-700 tw:bg-sky-50 tw:text-sky-700',
  violet: 'tw:border-l-violet-600 tw:bg-purple-50 tw:text-violet-600',
  blue: 'tw:border-l-blue-700 tw:bg-blue-50 tw:text-blue-700',
  amber: 'tw:border-l-amber-600 tw:bg-amber-50 tw:text-amber-600',
  rose: 'tw:border-l-rose-600 tw:bg-rose-50 tw:text-rose-600',
  green: 'tw:border-l-green-600 tw:bg-green-50 tw:text-green-600',
  cyan: 'tw:border-l-cyan-600 tw:bg-cyan-50 tw:text-cyan-600',
  teal: 'tw:border-l-teal-700 tw:bg-teal-50 tw:text-teal-700',
};

const TAB_GROUPS = [
  {
    title: 'General',
    tabs: [
      { id: 'system', label: 'System Setup', icon: Settings, tone: 'sky', Screen: SystemSetupTab },
      { id: 'branch', label: 'Branch Master', icon: Building, tone: 'sky', Screen: BranchMasterTab },
      { id: 'cha', label: 'CHA Master', icon: Building, tone: 'sky', Screen: CHAMasterTab },
      { id: 'fy', label: 'Financial Year', icon: Calendar, tone: 'sky', Screen: FinancialYearTab },
      { id: 'sequence', label: 'Sequence Config', icon: Hash, tone: 'sky', Screen: SequenceConfigTab },
      { id: 'numseries', label: 'Number Series (iCAFFE)', icon: Hash, tone: 'sky', Screen: NumberSeriesTab },
    ],
  },
  {
    title: 'Connectivity',
    tabs: [
      { id: 'network', label: 'Network / SFTP', icon: Network, tone: 'violet', Screen: NetworkSettingsTab },
      { id: 'icegate', label: 'ICEGATE Profiles', icon: Shield, tone: 'blue', Screen: IcegateProfileSettings },
      { id: 'ulip', label: 'ULIP Integration', icon: Globe, tone: 'amber', Screen: UlipSettingsTab },
      { id: 'ai', label: 'AI Configuration', icon: Cpu, tone: 'rose', Screen: AiSettingsTab },
      { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, tone: 'green', Screen: WhatsappSettingsTab },
      { id: 'email', label: 'Email', icon: Mail, tone: 'cyan', Screen: EmailSettingsTab },
      { id: 'security', label: 'Security', icon: Shield, tone: 'teal', Screen: SecuritySettingsTab },
    ],
  },
];

const ALL_TABS = TAB_GROUPS.flatMap((group) => group.tabs);
const TAB_IDS = ALL_TABS.map((tab) => tab.id);

// ?tab=<id> deep links; the retired Document Series (?tab=docseries, /document-series) now lives in Number Series,
// the old /settings/sftp and /settings/network pages in the Network tab
function tabFromUrl(tabParam, pathname) {
  if (tabParam === 'docseries') return 'numseries';
  if (tabParam && TAB_IDS.includes(tabParam)) return tabParam;
  if (pathname.includes('/document-series')) return 'numseries';
  if (pathname.includes('/sftp') || pathname.includes('/network')) return 'network';
  return null;
}

function SidebarTab({ tab, active, onSelect }) {
  const Icon = tab.icon;
  return (
    <Button
      variant="ghost"
      onClick={() => onSelect(tab.id)}
      className={cn(
        'tw:h-auto tw:w-auto tw:shrink-0 tw:justify-start tw:gap-2.5 tw:rounded-lg tw:border-0 tw:border-l-[3px] tw:border-l-transparent tw:px-4 tw:py-[9px] tw:text-left tw:text-[13px] tw:font-medium tw:text-muted-foreground tw:transition-all tw:lg:w-full',
        active && cn('tw:font-semibold', ACTIVE_TONES[tab.tone])
      )}
    >
      <Icon className="tw:size-4" /> {tab.label}
    </Button>
  );
}

export default function SettingsLayout() {
  const [activeTab, setActiveTab] = useState('system');
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const permissions = usePermissions();
  const tabAllowed = (id) => permissions.canOpen(`/settings?tab=${id}`);

  useEffect(() => {
    const tabInUrl = tabFromUrl(searchParams.get('tab'), location.pathname);
    if (tabInUrl) setActiveTab(tabInUrl);
  }, [searchParams, location.pathname]);

  useEffect(() => {
    if (tabAllowed(activeTab)) return;
    const firstAllowed = ALL_TABS.find((tab) => tabAllowed(tab.id));
    if (firstAllowed) setActiveTab(firstAllowed.id);
  }, [activeTab, permissions.restricted]); // eslint-disable-line react-hooks/exhaustive-deps -- tabAllowed reads the same permissions

  const ActiveScreen = ALL_TABS.find((tab) => tab.id === activeTab)?.Screen;

  return (
    <div className="tw:box-border tw:flex tw:h-full tw:flex-col tw:bg-(--bg-app) tw:p-3 tw:md:p-6">
      <div className="tw:mb-4 tw:flex tw:items-center tw:gap-3 tw:md:mb-6">
        <Settings className="tw:size-6 tw:text-foreground" />
        <h2 className="tw:m-0 tw:text-2xl tw:text-foreground">System Settings</h2>
      </div>

      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:gap-4 tw:overflow-hidden tw:lg:flex-row tw:lg:gap-8">
        <nav className="tw:flex tw:min-h-0 tw:shrink-0 tw:gap-0.5 tw:overflow-x-auto tw:pb-3 tw:lg:w-[220px] tw:lg:flex-col tw:lg:overflow-x-visible tw:lg:overflow-y-auto">
          {TAB_GROUPS.map((group, groupIndex) => {
            const visibleTabs = group.tabs.filter((tab) => tabAllowed(tab.id));
            return (
              <div key={group.title} className="tw:flex tw:shrink-0 tw:gap-0.5 tw:lg:flex-col">
                <div
                  className={cn(
                    'tw:hidden tw:px-4 tw:pb-1 tw:text-[10px] tw:font-bold tw:uppercase tw:tracking-[0.08em] tw:text-slate-400 tw:lg:block',
                    groupIndex === 0 ? 'tw:mt-1 tw:pt-2' : 'tw:mt-2 tw:border-t tw:border-border tw:pt-3'
                  )}
                >
                  {group.title}
                </div>
                {visibleTabs.map((tab) => (
                  <SidebarTab key={tab.id} tab={tab} active={activeTab === tab.id} onSelect={setActiveTab} />
                ))}
              </div>
            );
          })}
        </nav>

        <div className="tw:min-w-0 tw:flex-1 tw:overflow-y-auto tw:pb-4">
          {ActiveScreen && <ActiveScreen />}
        </div>
      </div>
    </div>
  );
}
