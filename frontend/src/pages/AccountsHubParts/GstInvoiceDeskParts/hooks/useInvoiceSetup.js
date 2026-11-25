import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { accountsApi } from '../../accountsApi';

// the invoice set-up (kinds, states, currencies, branches, reasons, our GSTIN) and this screen's kind
export default function useInvoiceSetup(kindId) {
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');

  useEffect(() => {
    const load = async () => {
      try { setMeta(await accountsApi.gstInvoiceMeta()); } catch (error) { setMetaError(errorMessage(error)); }
    };
    load();
  }, []);

  const kind = useMemo(() => (meta ? meta.kinds.find((entry) => entry.id === kindId) : null) || { id: kindId, label: kindId, gst: true }, [meta, kindId]);
  return { meta, metaError, kind, our: meta ? meta.our : null };
}
