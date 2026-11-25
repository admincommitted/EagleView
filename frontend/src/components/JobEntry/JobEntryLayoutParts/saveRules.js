function rowsOf(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

const hasRowWith = (value, key) => {
  const rows = rowsOf(value);
  return Array.isArray(rows) && rows.some((row) => row && row[key]);
};

export const itemTotalOf = (items) => {
  const total = items.reduce((sum, item) => sum + ((parseFloat(item.qty || item.quantity) * parseFloat(item.price || item.unitPrice)) || parseFloat(item.value) || 0), 0);
  return items.length ? total.toFixed(2) : '';
};

const invoiceSrNoOf = (item) => String(item.invSrNo || item.invoiceSrNo || '').trim();

// An item belongs to an invoice by its Inv Sr No: a number is the invoice's position, any other text is an old
// record that held the invoice number itself. Without either it goes by its saved invoice id, else invoice 1.
function belongsToInvoice(item, invoice, index) {
  const srNo = invoiceSrNoOf(item);
  if (srNo) return /^\d+$/.test(srNo) ? srNo === String(index + 1) : (!!invoice.invNo && srNo.toUpperCase() === String(invoice.invNo).trim().toUpperCase());
  if (item.importInvoiceId && invoice.id) return String(item.importInvoiceId) === String(invoice.id);
  return index === 0;
}

// -> { invoices } with their items, or { error: { message, duration } } when items cannot be placed under an invoice
// of this job (the server refuses that too)
export function itemsUnderInvoices(invoices, allItems, screenItems) {
  if (invoices?.length) {
    const withItems = invoices.map((invoice, index) => ({ ...invoice, items: allItems.filter((item) => belongsToInvoice(item, invoice, index)) }));
    const placed = new Set(withItems.flatMap((invoice) => invoice.items));
    const lost = allItems.filter((item) => !placed.has(item));
    if (lost.length) {
      const srNos = [...new Set(lost.map((item) => item.invSrNo || item.invoiceSrNo || '?'))].join(', ');
      return { error: { message: `${lost.length} item(s) point to an invoice that is not on this job (Inv Sr No ${srNos}) - open them in 4. Items, choose the invoice and Modify, then save`, duration: 8000 } };
    }
    return { invoices: withItems };
  }
  if (screenItems?.length) {
    return { error: { message: `${screenItems.length} item(s) have no invoice - enter the invoice in 3. Invoices first (Save), then save the job`, duration: 7000 } };
  }
  return { invoices };
}

// The first mandatory box missing for this BE type -> { message, needsWarehouseLink }, or null when the job can be saved.
// Bonds / certificates added with "Add" are in _bondRows / _certRows (the form boxes are cleared after adding).
export function saveProblem(job) {
  const problem = (message, needsWarehouseLink = false) => ({ message, needsWarehouseLink });
  if (!job.autoField_4) return problem('Validation Error: Importer Name is mandatory in Job Header.');
  if (!job.autoField_5) return problem('Validation Error: IEC Code is mandatory in Job Header.');
  if (!job.autoField_48) return problem('Validation Error: Branch Sr. No is mandatory in Job Header.');

  if (job.boeType === 'WAREHOUSE' && !hasRowWith(job._bondRows, 'bondNo')) {
    if (!job.autoField_24) return problem('Validation Error: Bond No is mandatory for WAREHOUSE jobs.');
    if (!job.autoField_26) return problem('Validation Error: Bond Code is mandatory for WAREHOUSE jobs.');
    if (!job.autoField_27) return problem('Validation Error: Bond Port is mandatory for WAREHOUSE jobs.');
  }

  if (job.boeType === 'EX_BOND') {
    const hasWarehouseBe = String(job.warehouseBENo || '').trim() && String(job.warehouseBEDate || '').trim();
    if (!job.inBondJobId && !hasWarehouseBe) return problem('Ex-Bond: click "Select WH BE" to link the warehouse BE, or enter the WH BE No and Date in Job Header.', true);
    if (!hasRowWith(job._certRows, 'certNo')) {
      if (!job.autoField_30) return problem('Validation Error: Cert. No is mandatory for EX-BOND jobs.');
      if (!job.autoField_31) return problem('Validation Error: Cert. Date is mandatory for EX-BOND jobs.');
      if (!job.autoField_32) return problem('Validation Error: Cert. Type is mandatory for EX-BOND jobs.');
    }
    if (!job.warehouseCode) return problem('Validation Error: Warehouse Code is mandatory for EX-BOND jobs.');
  }

  if (!job.boeType) return problem('Validation Error: Bill of Entry Type is mandatory.');
  return null;
}

export function savedProblemsMessage(problems) {
  const shown = problems.slice(0, 6).map((problem) => `- ${problem}`).join('\n');
  return `Not saved - fix these:\n${shown}${problems.length > 6 ? `\n...and ${problems.length - 6} more` : ''}`;
}
