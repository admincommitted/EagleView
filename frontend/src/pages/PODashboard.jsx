import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getUser } from '../utils/permissions';
import { askConfirm } from '../components/common/askConfirm';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Card, CardContent, DataTable } from '@/components/ui';
import { purchaseApi } from './PurchaseParts/purchaseApi';
import Pager from './PurchaseParts/Pager';
import { PAGE_SIZES } from './PurchaseParts/purchaseFormat';
import PoDecisionModal from './PurchaseParts/PoDecisionModal';
import { poDashboardColumns } from './PurchaseParts/poDashboardColumns';

const PAGE_SIZE_KEY = 'poDash.perPage';

function readPageSize() {
  try {
    const saved = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return PAGE_SIZES.includes(saved) ? saved : PAGE_SIZES[0];
  } catch {
    return PAGE_SIZES[0];
  }
}

function keepPageSize(size) {
  try {
    localStorage.setItem(PAGE_SIZE_KEY, String(size));
  } catch {
    // the size is then only kept until the page is left
  }
}

const matchesFilters = (po, searchTerm, statusFilter, branchFilter) => {
  const query = searchTerm.toLowerCase();
  const vendor = po.Vendor ? po.Vendor.vendorName.toLowerCase() : '';
  const poNumber = po.poNumber ? po.poNumber.toLowerCase() : '';
  return (vendor.includes(query) || poNumber.includes(query))
    && (statusFilter === 'All' || po.status === statusFilter)
    && (branchFilter === 'All' || po.branch === branchFilter);
};

export default function PODashboard({ externalSearchTerm = '', externalStatusFilter = 'All', externalBranchFilter = 'All' }) {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(readPageSize);
  const [deciding, setDeciding] = useState(null);

  // An admin or a Director (the PO approver) approves, rejects or holds a PO from this list.
  const role = String(getUser().role || '').toLowerCase();
  const canDecide = role === 'admin' || role === 'director';
  const isDirector = role === 'director';

  const loadPurchaseOrders = async () => {
    try {
      setPurchaseOrders(await purchaseApi.purchaseOrders());
    } catch (error) {
      console.error(errorMessage(error));
    }
    setLoading(false);
  };
  useEffect(() => { loadPurchaseOrders(); }, []);
  useEffect(() => { setCurrentPage(1); }, [externalSearchTerm, externalStatusFilter, externalBranchFilter]);

  const changePageSize = (size) => { setPageSize(size); setCurrentPage(1); keepPageSize(size); };

  const resendToDirector = async (po) => {
    if (!(await askConfirm({ title: 'Resend PO', message: 'Resend approval request to Director via Email & WhatsApp?', okLabel: 'Resend' }))) return;
    try {
      const reply = await purchaseApi.resendPurchaseOrder(po.id);
      toast.success(reply.message || 'Resent successfully!');
    } catch {
      toast.error('Error resending PO');
    }
  };

  const deletePurchaseOrder = async (po) => {
    if (!(await askConfirm({ title: 'Delete PO', message: 'Are you sure you want to delete this Purchase Order?', okLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await purchaseApi.deletePurchaseOrder(po.id);
      loadPurchaseOrders();
    } catch {
      toast.error('Error deleting PO');
    }
  };

  const filtered = purchaseOrders.filter((po) => matchesFilters(po, externalSearchTerm, externalStatusFilter, externalBranchFilter));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(currentPage, totalPages); // a delete can remove the last page
  const firstIndex = (page - 1) * pageSize;
  const pageRows = filtered.slice(firstIndex, firstIndex + pageSize);

  const columns = poDashboardColumns({
    firstRowNumber: firstIndex + 1,
    canDecide,
    isDirector,
    onDecide: (po, status) => setDeciding({ po, status }),
    onResend: resendToDirector,
    onDelete: deletePurchaseOrder,
  });

  return (
    <Card>
      <CardContent className="tw:gap-3 tw:p-3 tw:md:p-5">
        <span className="tw:text-entry tw:font-bold tw:text-muted-foreground">
          Total POs Found: <Badge variant="info" className="tw:text-[11px]">{filtered.length}</Badge>
        </span>

        {loading ? <p>Loading...</p> : (
          <DataTable columns={columns} rows={pageRows} emptyText="No Purchase Orders match your search." className="tw:text-entry" />
        )}
        {!loading && filtered.length > 0 && (
          <Pager page={page} totalPages={totalPages} pageSize={pageSize} total={filtered.length} onPage={setCurrentPage} onPageSize={changePageSize} />
        )}
      </CardContent>

      {deciding && (
        <PoDecisionModal po={deciding.po} status={deciding.status} onClose={() => setDeciding(null)}
          onDecided={() => { setDeciding(null); loadPurchaseOrders(); }} />
      )}
    </Card>
  );
}
