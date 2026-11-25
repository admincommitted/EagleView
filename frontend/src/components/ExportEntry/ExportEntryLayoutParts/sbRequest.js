// Each item goes under its own invoice (Inv Sr); an item whose Inv Sr is not an invoice of the job goes under invoice 1.
export function invoicesWithItems(invoices, items) {
  const invoiceCount = invoices.length;
  const invoiceIndexOf = (item) => {
    const serial = parseInt(item.invSr, 10);
    return serial >= 1 && serial <= invoiceCount ? serial - 1 : 0;
  };
  return invoices.map((invoice, index) => ({ ...invoice, items: (items || []).filter((item) => invoiceIndexOf(item) === index) }));
}

// The body of the ICEGATE SB calls (preview / flat file / sign / submit). The drawback / licence rows of the Scheme tab
// live outside exportData: the SB is built from the rows on the screen.
// screen = { exportData, items, dbkItems, licenseItems }
export const sbRequestOf = (screen, extra) => ({
  exportData: { ...screen.exportData, dbkItems: screen.dbkItems || [], licenseItems: screen.licenseItems || [] },
  items: screen.items,
  invoices: screen.exportData.invoices || [],
  ...extra,
});

// a job opened with Amend in the job list is sent as an amendment
export const amendmentFields = (exportData) => (exportData._amend
  ? { amendment: true, amendmentType: exportData._amend.amendmentType, amendReason: exportData._amend.amendReason }
  : {});
