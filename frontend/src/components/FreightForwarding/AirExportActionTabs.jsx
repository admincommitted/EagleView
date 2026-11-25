import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button, Popover, PopoverContent, PopoverTrigger, Tabs, TabsList, TabsTrigger } from '@/components/ui';

const TABS = [
  { value: 'dashboard', label: 'DASHBOARD', path: '/freight/air-export' },
  { value: 'create', label: 'CREATE AWB', path: '/freight/create-awb' },
  { value: 'search', label: 'SEARCH', path: '/freight/search-awb' },
  { value: 'track', label: 'TRACK SHIPMENTS', path: '/freight/track-shipments' },
];

const MENU_GROUPS = [
  {
    title: 'Create',
    links: [
      { label: 'Air Waybill', path: '/freight/create-awb' },
      { label: 'House Waybill', path: '/freight/create-hawb' },
      { label: 'Master Air Waybill', path: '/freight/create-mawb' },
      { label: 'e-CSD', path: '/freight/ecsd' },
    ],
  },
  {
    title: 'Manage',
    links: [
      { label: 'Track Shipments', path: '/freight/track-shipments' },
      { label: 'Print' },
      { label: 'Search' },
      { label: 'Stock' },
    ],
  },
  {
    title: 'Data',
    links: [{ label: 'Export Data', path: '/reports/export-data' }],
  },
  {
    title: 'Report',
    links: [
      { label: 'Forwarder Transactions Report', path: '/reports/forwarder-transactions' },
      { label: 'Tonnage Report', path: '/freight/tonnage-report' },
      { label: 'CSR Statement (CASS)', path: '/freight/csr-statement' },
    ],
  },
];

export default function AirExportActionTabs({ activeTab }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <div className="tw:flex tw:min-w-0 tw:items-end tw:gap-1 tw:border-b-2 tw:border-primary">
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="tw:h-[30px] tw:w-10 tw:shrink-0 tw:rounded-b-none tw:border-b-0" aria-label="All air export screens">
            <Menu className="tw:size-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="tw:grid tw:w-[min(800px,calc(100vw-2rem))] tw:grid-cols-1 tw:gap-6 tw:p-6 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
          {MENU_GROUPS.map((group) => (
            <div key={group.title} className="tw:flex tw:flex-col">
              <h4 className="tw:m-0 tw:mb-2 tw:border-b-2 tw:border-primary tw:pb-1.5 tw:text-sm tw:font-semibold tw:text-primary tw:uppercase">{group.title}</h4>
              {group.links.map((link) => (
                <Button
                  key={link.label}
                  variant="ghost"
                  size="block"
                  disabled={!link.path}
                  className="tw:py-1.5 tw:text-[13px] tw:normal-case tw:hover:text-primary"
                  onClick={() => go(link.path)}
                >
                  {link.label}
                </Button>
              ))}
            </div>
          ))}
        </PopoverContent>
      </Popover>

      <Tabs value={activeTab} className="tw:min-w-0">
        <TabsList className="tw:overflow-x-auto tw:border-b-0">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="tw:font-bold" onClick={() => navigate(tab.path)}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
