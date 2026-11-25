// Sales (logistics / freight forwarding): customers and prospects with KAM, contacts and lanes; enquiries and
// quotations; the sales team; the pick lists. The older Sales CRM screen at /sales-crm reads the same tables.
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, FileText, Inbox, LayoutDashboard, ListChecks, Users } from 'lucide-react';
import { Badge, Button, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { salesHubApi } from './SalesParts/salesApi';
import { Muted, Notice } from './SalesParts/salesWidgets';
import CustomersTab from './SalesParts/CustomersTab';
import PersonsTab from './SalesParts/PersonsTab';
import ListsTab from './SalesParts/ListsTab';
import DashboardTab from './SalesParts/DashboardTab';
import EnquiriesTab from './SalesParts/EnquiriesTab';
import QuotesTab from './SalesParts/QuotesTab';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'enquiries', label: 'Enquiries', icon: Inbox },
  { key: 'quotes', label: 'Quotations', icon: FileText },
  { key: 'customers', label: 'Customers & prospects', icon: Building2 },
  { key: 'persons', label: 'Sales persons', icon: Users, managersOnly: true },
  { key: 'lists', label: 'Lists', icon: ListChecks, managersOnly: true },
];
const DEAL_TABS = ['enquiries', 'quotes'];
const TAB_STORAGE_KEY = 'sales.tab';

function savedTab() {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return TABS.some((tab) => tab.key === saved) ? saved : 'dashboard';
  } catch {
    return 'dashboard';
  }
}

function LoadFailure({ reason, onRetry }) {
  return (
    <Notice role="alert" tone="danger" className="tw:max-w-[720px] tw:bg-card tw:text-foreground">
      <div className="tw:mb-1 tw:font-bold tw:text-destructive">This screen could not load.</div>
      <div className="tw:mb-1.5">{reason}</div>
      {/not found|restart the backend|failed to fetch|network/i.test(reason) && (
        <Muted className="tw:mb-2 tw:text-entry">Restart the EDI backend (it loads the new Sales screens on start), then click Retry.</Muted>
      )}
      <Button onClick={onRetry}>Retry</Button>
    </Notice>
  );
}

function whoAmI(meta) {
  if (meta.me) return `${meta.me.name} (${String(meta.me.role || '').toLowerCase()})`;
  return meta.isAdmin ? 'Admin' : '';
}

export default function Sales() {
  const [tab, setTab] = useState(savedTab);
  const [meta, setMeta] = useState(null);
  const [deal, setDeal] = useState(null);
  const [quoteStatus, setQuoteStatus] = useState('');
  const [loadError, setLoadError] = useState({ meta: '', deal: '' });

  const reloadMeta = useCallback(async () => {
    try {
      setMeta(await salesHubApi.meta());
      setLoadError((errors) => ({ ...errors, meta: '' }));
    } catch (error) {
      toast.error(error.message);
      setLoadError((errors) => ({ ...errors, meta: error.message || 'Could not load' }));
    }
  }, []);

  const loadDeal = useCallback(async () => {
    setLoadError((errors) => ({ ...errors, deal: '' }));
    try {
      setDeal(await salesHubApi.dealMeta());
    } catch (error) {
      toast.error(error.message);
      setLoadError((errors) => ({ ...errors, deal: error.message || 'Could not load' }));
    }
  }, []);

  useEffect(() => { reloadMeta(); loadDeal(); }, [reloadMeta, loadDeal]);

  const needsDeal = DEAL_TABS.includes(tab);
  const failure = !meta ? loadError.meta : (needsDeal && !deal ? loadError.deal : '');
  const retry = () => {
    if (!meta) { setLoadError((errors) => ({ ...errors, meta: '' })); reloadMeta(); }
    if (!deal) loadDeal();
  };
  const goTab = (key, status) => {
    setTab(key);
    if (key === 'quotes') setQuoteStatus(status || '');
    try { localStorage.setItem(TAB_STORAGE_KEY, key); } catch { /* private window: the tab is not remembered */ }
  };
  const shownTabs = TABS.filter((item) => !meta || meta.canManage || !item.managersOnly);

  const renderTab = () => {
    if (failure) return <LoadFailure reason={failure} onRetry={retry} />;
    if (!meta || (needsDeal && !deal)) return <Muted className="tw:text-entry">Loading…</Muted>;
    switch (tab) {
      case 'dashboard': return <DashboardTab meta={meta} reloadMeta={reloadMeta} goTab={goTab} />;
      case 'enquiries': return <EnquiriesTab meta={meta} deal={deal} goTab={goTab} />;
      case 'quotes': return <QuotesTab meta={meta} deal={deal} initialStatus={quoteStatus} />;
      case 'customers': return <CustomersTab meta={meta} reloadMeta={reloadMeta} />;
      case 'persons': return <PersonsTab meta={meta} reloadMeta={reloadMeta} />;
      default: return <ListsTab meta={meta} reloadMeta={reloadMeta} />;
    }
  };

  return (
    <div className="tw:min-h-[calc(100vh-60px)] tw:bg-page tw:px-2 tw:py-3 tw:sm:px-4">
      <div className="tw:mb-2.5 tw:flex tw:flex-wrap tw:items-baseline tw:gap-3">
        <h2 className="tw:m-0 tw:text-[22px] tw:font-extrabold tw:text-foreground">Sales</h2>
        {meta && whoAmI(meta) && <Badge variant="info" className="tw:text-[11.5px]">{whoAmI(meta)}</Badge>}
      </div>
      <Tabs value={tab} onValueChange={goTab} className="tw:mb-3">
        <TabsList variant="line" className="tw:w-full tw:flex-wrap tw:justify-start tw:border-b tw:border-border">
          {shownTabs.map(({ key, label, icon: Icon }) => (
            <TabsTrigger key={key} value={key} className="tw:font-bold"><Icon /> {label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {renderTab()}
    </div>
  );
}
