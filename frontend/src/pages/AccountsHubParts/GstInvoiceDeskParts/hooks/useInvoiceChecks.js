import { useEffect, useState } from 'react';
import { accountsApi } from '../../accountsApi';

const PREVIEW_DELAY_MS = 500;
const DUPLICATE_CHECK_DELAY_MS = 600;

// what the screen works out while the invoice is typed: the next invoice no, the posting Save will make,
// and iCAFFE's warning when this kind of invoice is already made for the party and docket
export default function useInvoiceChecks({ head, lines, kind, kindId, myBranch, division, editId, setMsg }) {
  const [nextNo, setNextNo] = useState('');
  const [noNote, setNoNote] = useState('');
  const [posting, setPosting] = useState(null);

  useEffect(() => {
    if (editId) return;
    const loadNextNo = async () => {
      try {
        const result = await accountsApi.gstInvoiceNextNo({ kind: kindId, branch: head.branchCode || myBranch, date: head.date, division });
        setNextNo(result.no);
        setNoNote(result.note || '');
      } catch {
        setNextNo('');
      }
    };
    loadNextNo();
  }, [kindId, head.date, head.branchCode, editId, division]);

  useEffect(() => {
    if (!lines.length || !(head.partyName || head.ledgerId) || (!head.pos && kind.gst)) { setPosting(null); return undefined; }
    const timer = setTimeout(async () => {
      try { setPosting((await accountsApi.gstInvoicePreview({ ...head, kind: kindId, lines })).posting); } catch { setPosting(null); }
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [head, lines, kindId]);

  useEffect(() => {
    if (head.bulk || !head.jobNo || !head.partyName || kind.againstBill) return undefined;
    const timer = setTimeout(async () => {
      try {
        const existing = await accountsApi.gstInvoiceExisting({ kind: kindId, party: head.partyName, jobNo: head.jobNo, not: editId || 0 });
        if (existing && existing.length) setMsg({ bad: true, t: kind.label + ' Invoice already generated for this party and docket no. (' + existing.map((invoice) => invoice.invoiceNo).join(', ') + ')' });
      } catch { /* the warning is only a help */ }
    }, DUPLICATE_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [head.jobNo, head.partyName, head.bulk, kindId, editId]);

  return { nextNo, noNote, posting };
}
