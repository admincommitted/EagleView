import { useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { accountsApi } from '../../accountsApi';
import { inr } from '../../ui';
import { num } from '../../VoucherDeskParts/amounts';
import { GST_SLABS, addDays, blankCharge } from '../purchaseConfig';

const attachToDraft = async (file, draftKey) => {
  const formData = new FormData();
  formData.append('files', file);
  formData.append('draftKey', draftKey);
  formData.append('documentType', 'VENDOR BILL');
  try {
    await accountsApi.uploadVoucherDocuments(formData);
    window.dispatchEvent(new Event('acc-docs-changed'));
  } catch {
    // the bill can still be attached by hand
  }
};

const slabOf = (rate) => (GST_SLABS.includes(String(num(rate))) ? String(num(rate)) : '18');

// OCR: read the vendor bill (PDF or photo) and fill the form; the bill is attached to the voucher
export function usePurchaseOcr({ draftKey, header, setHeader, setVendor, setLines, setMessage }) {
  const [ocr, setOcr] = useState(null); // { busy, file, source, warnings, summary }

  const readBill = async (file) => {
    if (!file) return;
    setMessage('');
    setOcr({ busy: true, file: file.name });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await accountsApi.purchaseDeskReadBill(formData);
      const bill = result.data || {};
      if (result.vendor) setVendor(result.vendor.id);
      const gst = num(bill.igst) || num(bill.cgst) + num(bill.sgst);
      setHeader((current) => ({
        ...current, billNo: bill.invoiceNo || current.billNo, billDate: bill.invoiceDate || current.billDate,
        dueDate: bill.dueDate || (bill.invoiceDate ? addDays(bill.invoiceDate, 30) : current.dueDate),
        hblNo: bill.hblNo || current.hblNo, mblNo: bill.mblNo || current.mblNo, jobNo: current.jobNo || bill.jobNo || '',
        supply: num(bill.igst) ? 'inter' : num(bill.cgst) ? 'intra' : current.supply,
      }));
      const charges = (bill.lines || []).map((line) => ({
        ...blankCharge(), charge: line.charge || line.description, ledgerId: line.expenseLedgerId || '', sac: line.sac || '', qty: '1', rate: String(num(line.amount)),
        gstRate: slabOf(line.gstRate), currency: 'INR', roe: '1', jobNo: header.jobNo || bill.jobNo || '',
        remarks: line.description && line.description !== line.charge ? line.description : '',
      }));
      if (charges.length) setLines(charges);
      const noLedger = charges.filter((charge) => !charge.ledgerId).length;
      if (draftKey) attachToDraft(file, draftKey);
      const totalMismatch = bill.total && gst && Math.abs(num(bill.taxable) + gst - num(bill.total)) > 1;
      setOcr({
        file: file.name,
        source: result.source,
        warnings: [
          ...(result.warnings || []),
          ...(noLedger ? [noLedger + ' charge' + (noLedger === 1 ? ' has' : 's have') + ' no expense ledger - Edit and choose it'] : []),
          ...(totalMismatch ? ['Bill total ' + inr(bill.total) + ' is not taxable + GST - check round off / other charges'] : []),
        ],
        summary: [bill.vendorName, bill.invoiceNo, bill.invoiceDate, bill.total ? 'total ' + inr(bill.total) : ''].filter(Boolean).join(' / '),
      });
    } catch (error) {
      setOcr(null);
      setMessage('Could not read the bill: ' + errorMessage(error));
    }
  };

  return { ocr, readBill };
}
