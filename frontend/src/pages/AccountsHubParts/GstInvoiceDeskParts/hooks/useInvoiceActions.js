import { useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { askConfirm, askText } from '@/components/common/askConfirm';
import { inr } from '../../ui';
import { accountsApi } from '../../accountsApi';

// Save (posts to the books), Void, Delete and Post To GSTN of the invoice on the screen
export default function useInvoiceActions({ head, lines, division, kindId, myBranch, editId, setEditId, loaded, setLoaded, reloadLoaded, setMsg, setPanel, clear }) {
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const body = { ...head, division, kind: kindId, branchCode: head.branchCode || myBranch, roundOff: Number(head.roundOff), lines };
      const saved = editId ? await accountsApi.gstInvoiceUpdate(editId, body) : await accountsApi.gstInvoiceCreate(body);
      setMsg({ ok: true, t: (editId ? 'Modified ' : 'Saved ') + saved.invoiceNo + ' - ' + inr(saved.total) + ' posted to accounts' });
      const full = await accountsApi.gstInvoice(saved.id);
      setEditId(saved.id); setLoaded(full);
    } catch (error) {
      setMsg({ bad: true, t: errorMessage(error) });
    }
    setBusy(false);
  };

  const voidInvoice = async () => {
    if (!loaded) return;
    const reason = await askText({ title: 'Void ' + loaded.invoiceNo, message: 'Void ' + loaded.invoiceNo + '? Its voucher leaves the books; the number stays.', label: 'Reason', okLabel: 'Void' });
    if (!reason) return;
    try {
      await accountsApi.gstInvoiceVoid(loaded.id, reason);
      setMsg({ ok: true, t: loaded.invoiceNo + ' is void' });
      setLoaded({ ...loaded, status: 'Void', voidReason: reason });
    } catch (error) {
      setMsg({ bad: true, t: errorMessage(error) });
    }
  };

  const deleteInvoice = async () => {
    if (!loaded) return;
    const sure = await askConfirm({ title: 'Delete invoice', message: 'Delete ' + loaded.invoiceNo + ' and its voucher? A copy is kept for audit. This cannot be undone from the screen.', okLabel: 'Delete', tone: 'danger' });
    if (!sure) return;
    try {
      await accountsApi.gstInvoiceDelete(loaded.id);
      const invoiceNo = loaded.invoiceNo;
      clear();
      setMsg({ ok: true, t: invoiceNo + ' deleted' });
    } catch (error) {
      setMsg({ bad: true, t: errorMessage(error) });
    }
  };

  const postToGstn = async () => {
    setBusy(true); setMsg({ t: 'Posting ' + loaded.invoiceNo + ' to the GST portal (IRP)...' });
    try {
      const result = (await accountsApi.gstInvoicePostGstn([loaded.id])).results[0] || {};
      setMsg(result.ok ? { ok: true, t: 'IRN generated - Ack No ' + (result.ackNo || '') + ' - it prints with the QR' } : { bad: true, t: 'Not posted: ' + (result.error || 'no reply') });
      reloadLoaded();
      if (!result.ok && /not set up/i.test(result.error || '')) setPanel('irn');
    } catch (error) {
      setMsg({ bad: true, t: errorMessage(error) });
    }
    setBusy(false);
  };

  return { busy, save, voidInvoice, deleteInvoice, postToGstn };
}
