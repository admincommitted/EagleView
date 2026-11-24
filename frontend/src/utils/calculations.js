import { invoiceFobInr, invoiceRate, itemValueFc } from './exportFob';

/**
 * Item FOB for the save (fobValue in the invoice currency, fobValueInr in rupees).
 * 12-Nov-2026: this used to work FOB out again on its own - an INR insurance was taken as dollars, the discount was
 * ADDED and commission / other deductions were ignored. It now uses the invoice FOB of the Invoices tab
 * (utils/exportFob.js): each item gets its share of the invoice FOB in proportion to its value.
 * @param {Array} invoices - invoice objects, each with an `items` array.
 * @param {Array} [currencies] - Currency master (rates of charges in a third currency).
 */
export const apportionInvoiceCharges = (invoices, currencies) => {
  if (!invoices || !Array.isArray(invoices)) return [];
  return invoices.map(inv => {
    const items = inv.items || [];
    const ex = invoiceRate(inv);
    const value = parseFloat(inv.invoiceValue || inv.value) || items.reduce((s, it) => s + itemValueFc(it), 0);
    const invFob = parseFloat(inv.invFobInr) || invoiceFobInr({ ...inv, value }, currencies) || 0;
    const share = value > 0 && ex > 0 && invFob > 0 ? Math.min(1, invFob / (value * ex)) : 1;
    const updatedItems = items.map(item => {
      const fc = itemValueFc(item) * share;
      return { ...item, fobValue: parseFloat(fc.toFixed(2)), fobValueInr: parseFloat((fc * (ex || 1)).toFixed(2)) };
    });
    return { ...inv, items: updatedItems };
  });
};

/**
 * Validates a full export job data object (which includes invoices and containers inside it)
 */
export const validateFullJob = (jobData) => {
  const errors = [];
  const warnings = [];

  // 1. Check Mandatory Master Details
  // field names as the export screens store them (customsPortCode, no/value, ritc/qty/rate); DB names kept as fallback. 28-Oct-2026
  if (!jobData.customsPortCode && !jobData.customsPort) errors.push("Customs Port is missing.");
  if (!jobData.shipperId && !jobData.shipperName) errors.push("Shipper details are missing.");

  // 2. Cross-verify Totals
  const headerGrossWeight = parseFloat(jobData.grossWeight) || 0;
  const headerPackages = parseInt(jobData.totalPackages, 10) || 0;
  
  let totalItemPackages = 0;
  let totalItemWeight = 0;
  let totalInvValue = 0;

  const invoices = jobData.invoices || [];
  if (invoices.length === 0) {
    errors.push("At least one Invoice is required.");
  } else {
    invoices.forEach((inv, i) => {
      const invNo = inv.invoiceNo || inv.no;
      if (!invNo) errors.push(`Invoice ${i+1} is missing Invoice No.`);
      if (!inv.currency) errors.push(`Invoice ${invNo || i+1} is missing Currency.`);
      
      totalInvValue += parseFloat(inv.invoiceValue || inv.value) || 0;

      const items = inv.items || [];
      if (items.length === 0) {
        errors.push(`Invoice ${invNo || i+1} has no items.`);
      }

      items.forEach((item, j) => {
        const hs = String(item.ritc || item.hsCode || '').trim(); // the screen box first (18-Nov-2026: hsCode is a saved copy)
        if (!hs) errors.push(`Invoice ${invNo || i+1}, Item ${j+1} is missing HS Code.`);
        else if (!/^[0-9]{8}$/.test(hs)) errors.push(`Invoice ${invNo || i+1}, Item ${j+1}: HS Code must be 8 digits.`);
        
        if (!(parseFloat(item.qty || item.quantity) > 0)) errors.push(`Invoice ${invNo || i+1}, Item ${j+1} is missing Quantity.`);
        if (!(parseFloat(item.rate || item.price || item.unitPrice) > 0)) errors.push(`Invoice ${invNo || i+1}, Item ${j+1} is missing Unit Price.`);
        
        // Accumulate item weight if available (many systems track gross weight at item level)
        // totalItemWeight += parseFloat(item.grossWeight) || 0;
      });
    });
  }

  // 3. Optional checks / Warnings
  if (!jobData.adCode) warnings.push("AD Code (Bank) is missing. Required for Drawback/IGST.");
  if (!jobData.iecCode && !jobData.shipperIec && !jobData.panNo) warnings.push("IEC/PAN not found. Ensure Shipper Master is updated.");

  return { errors, warnings };
};
