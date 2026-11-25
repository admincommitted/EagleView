import { useCallback, useEffect, useState } from 'react';
import { accountsApi } from '@/pages/AccountsHubParts/accountsApi';
import { EVEN_ON_ERROR } from './billingData';

/** The real next number of the chosen voucher type; a type on manual numbering leaves the box to the user. */
export default function useVoucherNumber(voucherType) {
  const [number, setNumber] = useState('');
  const [isAuto, setIsAuto] = useState(true);

  const reload = useCallback(async () => {
    if (!voucherType) { setNumber(''); return; }
    try {
      const body = await accountsApi.billingNextVoucherNumber(voucherType.id, EVEN_ON_ERROR);
      setIsAuto(body?.isAuto !== false);
      setNumber(body?.nextNumber || '');
    } catch {
      setIsAuto(false);
      setNumber('');
    }
  }, [voucherType]);

  useEffect(() => { reload(); }, [reload]);

  return { number, setNumber, isAuto, reload };
}
