import { useEffect, useState } from 'react';
import { accountsApi } from '../../accountsApi';
import { lookup } from '../../ui';

const orFallback = async (load, fallback) => {
  try {
    return await load();
  } catch {
    return fallback;
  }
};

// ledgers, vendors, expense ledgers, GST charges, TDS sections, the GST / TDS ledgers and the Debit Note type
export function usePurchaseLookups(typeId) {
  const [look, setLook] = useState({ all: [], creditors: [], expenses: [], charges: [], tds: [], tax: null });
  const [cnTypeId, setCnTypeId] = useState(null);
  useEffect(() => {
    const loadLookups = async () => {
      const [all, creditors, expenses, charges, tds, tax] = await Promise.all([
        lookup('ledgers'), lookup('ledgers-in?groups=Sundry Creditors'), lookup('ledgers-in?nature=Expenses'),
        orFallback(accountsApi.gstCharges, []), lookup('tdsnatures'), orFallback(accountsApi.voucherDeskTaxLedgers, null),
      ]);
      setLook({ all, creditors, expenses, charges, tds, tax });
    };
    const loadCreditNoteType = async () => {
      const types = await lookup('voucher-types');
      setCnTypeId((types || []).find((type) => type.baseType === 'Debit Note')?.id ?? null);
    };
    loadLookups();
    loadCreditNoteType();
  }, [typeId]);
  return { look, cnTypeId };
}
