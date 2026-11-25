import { useEffect } from 'react';
import { perUnit } from '@/utils/cbicExchange';
import { FREIGHT_CONTRACTS, INSURANCE_CONTRACTS } from '../invoiceRules';

const PERCENT_CHARGES = ['packing', 'discount', 'other', 'commission'];

// rupees per ONE unit of a charge currency: the invoice currency uses the invoice rate, INR is 1, others the master
function rupeesPerUnitOf(currency, formData, currencies) {
  const code = String(currency || '').trim().toUpperCase();
  if (!code || code === String(formData.currency || '').toUpperCase()) return perUnit(formData.currency, formData.exchRate, formData.unitInRs);
  if (code === 'INR') return 1;
  const master = currencies.find((row) => String(row.currencyCode || '').toUpperCase() === code);
  return master ? (parseFloat(master.exportRate) || 0) : 0;
}

/**
 * Charges and FOB. A rate % gives the amount in the invoice currency. FOB (INR) = invoice value - freight - insurance,
 * each converted with its own currency's rate. Commission, discount and other deductions are not taken out of FOB
 * (as iCAFFE files them). Charges the nature of contract does not have are cleared.
 */
function chargeUpdates(formData, natureOfContract, currencies) {
  const value = parseFloat(formData.value) || 0;
  const updates = {};
  const amountFromRate = (charge) => {
    const rateKey = `${charge}Rate`;
    const rate = parseFloat(formData[rateKey]);
    if (isNaN(rate) || String(formData[rateKey]).trim() === '') return;
    const amount = (value * rate / 100).toFixed(2);
    if (amount !== String(formData[`${charge}Amount`] || '')) updates[`${charge}Amount`] = amount;
    if (!formData[`${charge}Curr`] && formData.currency) updates[`${charge}Curr`] = formData.currency;
  };
  const clearCharge = (charge) => ['Rate', 'Amount', 'Curr'].forEach((part) => { if (formData[charge + part]) updates[charge + part] = ''; });

  if (FREIGHT_CONTRACTS.includes(natureOfContract)) amountFromRate('freight');
  if (INSURANCE_CONTRACTS.includes(natureOfContract)) amountFromRate('insurance');
  PERCENT_CHARGES.forEach(amountFromRate);
  if (!FREIGHT_CONTRACTS.includes(natureOfContract)) clearCharge('freight');
  if (!INSURANCE_CONTRACTS.includes(natureOfContract)) clearCharge('insurance');

  const latest = (key) => (updates[key] !== undefined ? updates[key] : formData[key]);
  const inRupees = (charge) => (parseFloat(latest(`${charge}Amount`)) || 0) * rupeesPerUnitOf(latest(`${charge}Curr`), formData, currencies);
  const rupeesPerUnit = perUnit(formData.currency, formData.exchRate, formData.unitInRs);
  const fob = value * rupeesPerUnit - inRupees('freight') - inRupees('insurance');
  const fobText = value && rupeesPerUnit ? fob.toFixed(2) : '';
  if (fobText !== String(formData.invFobInr || '')) updates.invFobInr = fobText;
  return updates;
}

export default function useInvoiceCharges({ formData, setFormData, natureOfContract, currencies }) {
  useEffect(() => {
    const updates = chargeUpdates(formData, natureOfContract, currencies);
    if (Object.keys(updates).length > 0) setFormData((previous) => ({ ...previous, ...updates }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.value, formData.exchRate, formData.unitInRs, formData.currency, formData.freightRate, formData.insuranceRate, formData.packingRate, formData.discountRate, formData.otherRate, formData.commissionRate,
    formData.freightAmount, formData.insuranceAmount, formData.commissionAmount, formData.discountAmount, formData.otherAmount,
    formData.freightCurr, formData.insuranceCurr, formData.commissionCurr, formData.discountCurr, formData.otherCurr, natureOfContract, currencies.length]);

  return { rateOf: (currency) => rupeesPerUnitOf(currency, formData, currencies) };
}
