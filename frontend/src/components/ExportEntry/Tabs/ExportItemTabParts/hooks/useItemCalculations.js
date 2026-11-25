import { useEffect } from 'react';
import { perUnit } from '@/utils/cbicExchange';

const roundTo2 = (value) => parseFloat(value.toFixed(2));
// IGST only for "Export Against Payment (P)"
const paysIgst = (status) => /\(P\)|^P$/.test(String(status || ''));

/**
 * Total FC, item FOB (INR), PMV and IGST of the item in the form, and its drawback amount.
 * Item FOB follows qty x rate; for a CIF / CF / CI invoice the item gets its share of the invoice FOB (freight and
 * insurance taken out in the same proportion). PMV % works on the INR FOB.
 */
export default function useItemCalculations({ formData, setFormData, exportData, drawbacksMaster }) {
  useEffect(() => {
    const qty = parseFloat(formData.qty) || 0;
    const rate = parseFloat(formData.rate) || 0;
    const per = parseFloat(formData.per) || 1;
    const totalFc = qty * rate / per;

    const invoice = exportData?.invoices?.[(parseInt(formData.invSr) || 1) - 1] || {};
    const rupeesPerUnit = perUnit(invoice.currency, invoice.exchRate || invoice.exchangeRate, invoice.unitInRs)
      || perUnit(invoice.currency || formData.currency, formData.exchRate, formData.unitInRs) || 1;
    const invoiceValue = parseFloat(invoice.value || invoice.invoiceValue) || 0;
    const invoiceFob = parseFloat(invoice.invFobInr) || 0;
    const fobShare = invoiceValue > 0 && invoiceFob > 0 ? invoiceFob / (invoiceValue * rupeesPerUnit) : 1;
    const fobInr = totalFc * rupeesPerUnit * (fobShare > 0 && fobShare <= 1 ? fobShare : 1);

    const updates = {};
    if (totalFc > 0 && parseFloat(formData.totalFc) !== roundTo2(totalFc)) updates.totalFc = totalFc.toFixed(2);
    if (fobInr > 0 && parseFloat(formData.itemFob) !== roundTo2(fobInr)) updates.itemFob = fobInr.toFixed(2);

    if (formData.pmvOption === 'Percentage') {
      const pmvPercent = parseFloat(formData.pmvPer) || 0;
      if (pmvPercent > 0 && fobInr > 0) {
        const totalPmv = roundTo2((fobInr * pmvPercent) / 100);
        if (parseFloat(formData.totalPmv) !== totalPmv) {
          updates.totalPmv = totalPmv;
          updates.pmv = roundTo2(totalPmv / (qty || 1));
        }
      }
    }

    const payingIgst = paysIgst(formData.igstPayStatus);
    if (!payingIgst && (parseFloat(formData.igstAmt) || 0) !== 0 && formData.igstPayStatus !== 'Select') {
      updates.igstAmt = '';
      updates.taxableValue = '';
    }
    if (payingIgst) {
      const igstRate = parseFloat(formData.igstRate) || 0;
      const taxableValue = parseFloat(formData.taxableValue) || fobInr;
      if (igstRate > 0 && taxableValue > 0) {
        const igstAmount = roundTo2((taxableValue * igstRate) / 100);
        if (parseFloat(formData.igstAmt) !== igstAmount) {
          updates.igstAmt = igstAmount;
          if (parseFloat(formData.taxableValue) !== taxableValue) updates.taxableValue = taxableValue;
        }
      }
    }

    if (Object.keys(updates).length) setFormData((previous) => ({ ...previous, ...updates }));
  }, [formData.itemFob, formData.qty, formData.rate, formData.per, formData.unitInRs, formData.pmvOption, formData.pmvPer, formData.igstPayStatus, formData.igstRate, formData.taxableValue, formData.invSr, exportData?.invoices]); // eslint-disable-line react-hooks/exhaustive-deps

  // drawback: rate % of the item FOB, capped at the cap per unit x qty
  useEffect(() => {
    let fob = parseFloat(formData.fobValueInr) || 0;
    if (!fob && formData.qty && formData.price) {
      fob = parseFloat(formData.qty) * parseFloat(formData.price) * (perUnit(exportData.currency, exportData.exchRate, exportData.unitInRs) || 1);
    }
    let drawback = 0;
    const master = formData.drawbackSrNo && fob > 0 ? drawbacksMaster.find((row) => row.tariffItem === formData.drawbackSrNo) : null;
    if (master) {
      const cap = parseFloat(master.drawbackCap) || 0;
      drawback = (fob * (parseFloat(master.drawbackRate) || 0)) / 100;
      if (cap > 0 && formData.qty) drawback = Math.min(drawback, cap * parseFloat(formData.qty));
    }
    if (drawback.toFixed(2) !== (formData.drawbackAmount || '')) {
      setFormData((previous) => ({ ...previous, drawbackAmount: drawback > 0 ? drawback.toFixed(2) : '' }));
    }
  }, [formData.drawbackSrNo, formData.qty, formData.price, formData.fobValueInr, drawbacksMaster]); // eslint-disable-line react-hooks/exhaustive-deps
}
