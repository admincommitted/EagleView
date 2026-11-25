const EXPORT_COLUMNS = [
  { header: 'Status', width: 18, value: (record) => record.status },
  { header: 'Match basis', width: 30, value: (record) => record.matchedOn || '' },
  { header: 'Supplier', width: 28, value: (record) => record.vendor },
  { header: 'GSTIN', width: 17, value: (record) => record.gstin },
  { header: 'Document type', width: 18, value: (record) => record.docKind },
  { header: 'Invoice / note no', width: 20, value: (record) => record.invoice },
  { header: 'Portal date', width: 12, value: (record) => record.date },
  { header: 'Books date', width: 12, value: (record) => record.bookDate },
  { header: 'Voucher no', width: 14, value: (record) => (record.voucherId ? record.id : '') },
  { header: 'Portal value', width: 14, value: (record) => record.portalAmt },
  { header: 'Books value', width: 14, value: (record) => record.bookAmt },
  { header: 'Difference', width: 12, value: (record) => record.diff },
  { header: 'Taxable', width: 12, value: (record) => record.taxable },
  { header: 'IGST', width: 11, value: (record) => record.igst },
  { header: 'CGST', width: 11, value: (record) => record.cgst },
  { header: 'SGST', width: 11, value: (record) => record.sgst },
  { header: 'Cess', width: 10, value: (record) => record.cess },
  { header: 'ITC available on portal', width: 20, value: (record) => (record.itcAvailable ? 'Yes' : 'No') },
];

export async function exportReconciliation(records, period) {
  const XLSX = await import('xlsx');
  const rows = records.map((record) => Object.fromEntries(EXPORT_COLUMNS.map((column) => [column.header, column.value(record)])));
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = EXPORT_COLUMNS.map((column) => ({ wch: column.width }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'GSTR-2B reconciliation');
  XLSX.writeFile(workbook, `gstr2b-reco-${period || new Date().toISOString().slice(0, 10)}.xlsx`);
}
