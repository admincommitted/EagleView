import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { askConfirm } from '@/components/common/askConfirm';
import { accountsApi } from '../../accountsApi';
import { printVoucher } from '../../printVoucher';

export function useVoucherView({ id, onDeleted }) {
  const [voucher, setVoucher] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [trail, setTrail] = useState(null);

  const load = async () => {
    try {
      setVoucher(await accountsApi.voucherDeskVoucher(id));
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  };
  useEffect(() => {
    setVoucher(null);
    setLoadError('');
    load();
  }, [id]);

  const remove = async () => {
    const goAhead = await askConfirm({
      title: 'Delete voucher', okLabel: 'Delete', tone: 'danger',
      message: 'Delete voucher ' + voucher.voucherNumber + '? It is removed from the books; the audit trail keeps a copy.',
    });
    if (!goAhead) return;
    try {
      await accountsApi.voucherDeskDelete(id);
      onDeleted();
    } catch (error) {
      setMessage('Not deleted: ' + errorMessage(error));
    }
  };

  const toggleTrail = async () => {
    if (trail) { setTrail(null); return; }
    try {
      setTrail(await accountsApi.voucherDeskAudit(id));
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const print = () => { if (!printVoucher(voucher)) setMessage('Allow pop-ups for this site to print'); };

  return { voucher, loadError, message, trail, setTrail, load, remove, toggleTrail, print };
}
