import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { freightOpsApi } from './freightOpsApi';

const RECENT_LIMIT = 10;

function flattenLedgers(nodes, groupName = '', flat = []) {
  (nodes || []).forEach((node) => {
    if (node.type === 'ledger') flat.push({ id: node.id, name: node.name, group: node.groupName || groupName || '' });
    if (node.children) flattenLedgers(node.children, node.type === 'group' ? node.name : groupName, flat);
  });
  return flat;
}

const ledgerNames = (voucher, side) => (voucher.details || []).filter((detail) => detail.dc === side).map((detail) => detail.ledger?.name || '').join(', ');

const toRecentRequest = (voucher) => ({
  id: voucher.voucherNumber,
  job: (String(voucher.narration || '').match(/Job\s+([^|]+)/) || [])[1] || '',
  head: ledgerNames(voucher, 'Dr'),
  vendor: ledgerNames(voucher, 'Cr'),
  amount: parseFloat(voucher.totalAmount) || 0,
  status: voucher.status === 'Pending' ? 'Pending Approval' : voucher.status,
  date: voucher.date,
});

// a fallback number when the voucher type gives none: REQ/yyyymmdd/last 4 digits of the clock
const fallbackVoucherNumber = () => 'REQ/' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '/' + Date.now().toString().slice(-4);

async function nextVoucherNumber(voucherTypeId) {
  try {
    const answer = await freightOpsApi.nextVoucherNumber(voucherTypeId);
    return answer?.nextNumber || fallbackVoucherNumber();
  } catch {
    return fallbackVoucherNumber();
  }
}

// a request is a Pending purchase voucher, which is what Manager Expense Approvals lists
export default function useExpenseRequest() {
  const [recentRequests, setRecentRequests] = useState([]);
  const [payees, setPayees] = useState([]);
  const [heads, setHeads] = useState([]);
  const [voucherTypes, setVoucherTypes] = useState([]);

  const loadAll = useCallback(async () => {
    try {
      const [tree, masters, pending] = await Promise.all([freightOpsApi.ledgerTree(), freightOpsApi.accountingMasters(), freightOpsApi.pendingApprovals()]);
      const ledgers = flattenLedgers(tree?.data || []);
      setPayees(ledgers.filter((ledger) => /creditor|payable/i.test(String(ledger.group || ''))));
      setHeads(ledgers.filter((ledger) => /expense|purchase/i.test(String(ledger.group || ''))));
      setVoucherTypes(masters?.data?.voucherTypes || []);
      setRecentRequests((Array.isArray(pending?.data) ? pending.data : []).slice(0, RECENT_LIMIT).map(toRecentRequest));
    } catch (error) {
      setPayees([]);
      setHeads([]);
      setRecentRequests([]);
      toast.error('Could not load the masters: ' + errorMessage(error));
    }
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  // resolves true when the request was sent
  const submit = async (request) => {
    if (!request.jobNo || !request.amount || !request.vendor) {
      toast.error('Job No, Vendor, and Amount are mandatory.');
      return false;
    }
    if (!request.expenseHead) {
      toast.error('Pick the expense head (ledger)');
      return false;
    }
    const voucherType = voucherTypes.find((type) => String(type.baseType) === 'Purchase') || voucherTypes.find((type) => String(type.baseType) === 'Journal');
    if (!voucherType) {
      toast.error('No Purchase / Journal voucher type - add one in Masters > Voucher Types');
      return false;
    }
    const amount = parseFloat(request.amount) || 0;
    if (amount <= 0) {
      toast.error('Enter an amount more than 0');
      return false;
    }

    const toastId = toast.loading('Submitting the request...');
    try {
      const voucherNumber = await nextVoucherNumber(voucherType.id);
      await freightOpsApi.createVoucher({
        voucherTypeId: voucherType.id,
        voucherNumber,
        date: new Date().toISOString().slice(0, 10),
        jobNo: request.jobNo || null,
        narration: ['Expense request', `Job ${request.jobNo}`, request.urgency && 'Urgency: ' + request.urgency, request.narration].filter(Boolean).join(' | '),
        details: [
          { ledgerId: request.expenseHead, dc: 'Dr', amount },
          { ledgerId: request.vendor, dc: 'Cr', amount },
        ],
      });
      toast.success('Request ' + voucherNumber + ' sent for approval', { id: toastId });
      loadAll();
      return true;
    } catch (error) {
      toast.error('Could not submit: ' + errorMessage(error), { id: toastId });
      return false;
    }
  };

  return { recentRequests, payees, heads, submit };
}
