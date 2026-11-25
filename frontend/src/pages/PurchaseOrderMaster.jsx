import { useEffect, useState } from 'react';
import { FileText, Filter, Search, ShoppingCart } from 'lucide-react';
import { getUser } from '../utils/permissions';
import { errorMessage } from '@/services/axiosInstance';
import { Input, SelectBox, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import PODashboard from './PODashboard';
import AdvancedPO from './AdvancedPO';
import { purchaseApi } from './PurchaseParts/purchaseApi';
import PageHeader from './PurchaseParts/PageHeader';
import { branchRows, PO_STATUS_FILTERS, poBranches } from './PurchaseParts/purchaseFormat';

function DashboardFilters({ searchTerm, onSearchTerm, statusFilter, onStatusFilter, branchFilter, onBranchFilter, branches }) {
  const branchOptions = [{ value: 'All', label: 'ALL BRANCHES' }, ...branches.map((branch) => ({ value: branch.branchName, label: branch.branchName }))];
  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:py-2 tw:sm:flex-row tw:sm:flex-wrap tw:sm:items-center">
      <Input leftIcon={Search} data-allow-text="" className="tw:w-full tw:sm:w-[250px]" placeholder="SEARCH BY PO NUMBER OR VENDOR..."
        value={searchTerm} onChange={(event) => onSearchTerm(event.target.value)} />
      <div className="tw:flex tw:items-center tw:gap-2">
        <Filter className="tw:size-4 tw:shrink-0 tw:text-muted-foreground" />
        <SelectBox className="tw:w-full tw:sm:w-44" value={statusFilter} onValueChange={onStatusFilter} options={PO_STATUS_FILTERS} />
      </div>
      <SelectBox className="tw:w-full tw:sm:w-44" value={branchFilter} onValueChange={onBranchFilter} options={branchOptions} />
    </div>
  );
}

export default function PurchaseOrderMaster() {
  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [searchTerm, setSearchTerm] = useState('');
  // A Director (the PO approver) opens on the POs waiting for him and does not make POs.
  const isDirector = String(getUser().role || '').toLowerCase() === 'director';
  const [statusFilter, setStatusFilter] = useState(isDirector ? 'Pending Approval' : 'All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const body = await purchaseApi.companyBranches();
        if (body?.success) setBranches(poBranches(branchRows(body)));
      } catch (error) {
        console.error('Failed to fetch branches', errorMessage(error));
      }
    };
    loadBranches();
  }, []);

  return (
    <div className="tw:flex tw:min-h-screen tw:flex-col tw:gap-4 tw:bg-page tw:p-3 tw:md:p-5">
      <PageHeader icon={ShoppingCart} title="Purchase Management" />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="tw:gap-4">
        <div className="tw:flex tw:flex-col tw:gap-1 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:px-3 tw:pt-2 tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
          <TabsList variant="line">
            <TabsTrigger value="DASHBOARD" className="tw:font-bold tw:uppercase"><FileText /> PO Dashboard</TabsTrigger>
            {!isDirector && <TabsTrigger value="CREATE" className="tw:font-bold tw:uppercase"><ShoppingCart /> Create New PO</TabsTrigger>}
          </TabsList>
          {activeTab === 'DASHBOARD' && (
            <DashboardFilters
              searchTerm={searchTerm} onSearchTerm={setSearchTerm}
              statusFilter={statusFilter} onStatusFilter={setStatusFilter}
              branchFilter={branchFilter} onBranchFilter={setBranchFilter}
              branches={branches}
            />
          )}
        </div>

        <TabsContent value="DASHBOARD">
          <PODashboard externalSearchTerm={searchTerm} externalStatusFilter={statusFilter} externalBranchFilter={branchFilter} />
        </TabsContent>
        {!isDirector && <TabsContent value="CREATE"><AdvancedPO /></TabsContent>}
      </Tabs>
    </div>
  );
}
