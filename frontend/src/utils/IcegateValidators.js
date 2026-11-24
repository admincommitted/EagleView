export const validateIcegateRules = (exportData, items, invoices) => {
  const errors = [];

  if (!exportData.jobNo) errors.push("Job No is required.");
  if (exportData.portOfReceipt && exportData.portOfReceipt.length > 6) errors.push("Port of Receipt code cannot exceed 6 characters.");
  if (exportData.portOfDischarge && exportData.portOfDischarge.length > 6) errors.push("Port of Discharge code cannot exceed 6 characters.");
  
  if (exportData.shipperPin && !/^[1-9][0-9]{5}$/.test(String(exportData.shipperPin).trim())) errors.push("Shipper PIN Code must be exactly 6 digits.");
  
  if (exportData.consigneeName && exportData.consigneeName.length > 35) errors.push("Consignee Name cannot exceed 35 characters.");
  if (exportData.consigneeAddress1 && exportData.consigneeAddress1.length > 35) errors.push("Consignee Address1 cannot exceed 35 characters.");
  
  if (!invoices || invoices.length === 0) {
    errors.push("At least one Invoice is required.");
  } else {
    invoices.forEach((inv, index) => {
      const invNo = inv.no || inv.invoiceNo;
      if (invNo && String(invNo).length > 17) errors.push("Invoice No '" + invNo + "' exceeds 17 characters.");
      if (!inv.value && !inv.invoiceValue) errors.push("Invoice '" + (invNo || (index + 1)) + "' is missing Invoice Value.");
      if (!inv.currency) errors.push("Invoice '" + (inv.no || (index + 1)) + "' is missing Currency.");
    });
  }

  if (!items || items.length === 0) {
    errors.push("At least one Item is required.");
  } else {
    items.forEach((itm, index) => {
      if (!itm.ritc) errors.push("Item " + (index + 1) + " is missing RITC (CTH/HS) Code.");
      if (itm.ritc && !/^[0-9]{8}$/.test(String(itm.ritc).trim())) errors.push("Item " + (index + 1) + " RITC Code must be exactly 8 digits.");
      if (!itm.qty) errors.push("Item " + (index + 1) + " is missing Quantity.");
    });
  }

  const headerFob = parseFloat(exportData.fobRs) || 0;
  let invFobTotal = 0;
  (invoices || []).forEach(i => invFobTotal += parseFloat(i.invFobInr) || 0);

  // only compare when the header FOB has been filled (an empty header gave a false error)
  if (headerFob > 0 && Math.abs(headerFob - invFobTotal) > 1) { 
    errors.push("FOB RS mismatch: Header FOB (" + headerFob + ") does not match Total Invoices FOB (" + invFobTotal + ").");
  }

  return errors;
};
