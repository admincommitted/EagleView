// a copy is a new, unfiled job
const FILING_FIELDS = ['sbNo', 'sbNumber', 'sbDate', 'icegateStatus', 'icegateUniqueId', 'uniqueId', 'isAmended', 'leoDate', 'leoNo'];
// the copy is made by whoever duplicates it, today - not the docket / iCAFFE record of the original
const ORIGINAL_RECORD_FIELDS = ['enteredBy', 'createdAt', 'updatedAt', 'docketNo', 'icaffeRowId', 'icaffeShipmentId', 'icaffeEnteredBy', 'icaffeFile', 'egmNo', 'egmDate'];
const CHILD_ROW_KEYS = [
  ['items', ['id', 'exportInvoiceId']],
  ['containers', ['id', 'exportJobId']],
  ['docs', ['id', 'exportJobId']],
  ['dbkItems', ['id', 'exportJobId']],
  ['licenseItems', ['id', 'exportJobId']],
];

const dropKeys = (row, keys) => keys.forEach((key) => { delete row[key]; });

// Turns a job read from the server into the copy "Duplicate" opens (changes and returns the same object).
export function makeDuplicateCopy(job) {
  dropKeys(job, ['id', 'jobNo', ...FILING_FIELDS, ...ORIGINAL_RECORD_FIELDS]);
  job.status = 'DRAFT';
  // e-Sanchit documents (IRN / DRN) belong to the shipment they were uploaded for; SW statements / SW info
  // (declarations, origin, RoDTEP) are about the goods and stay
  job.eSanchitList = [];
  (job.invoices || []).forEach((invoice) => {
    (invoice.items || []).forEach((item) => {
      item.eSanchitList = [];
      item.suppDocs = 'N';
      dropKeys(item, ['id', 'exportInvoiceId']);
    });
    dropKeys(invoice, ['id', 'exportJobId']);
  });
  job.jobDate = new Date().toISOString().split('T')[0];
  CHILD_ROW_KEYS.forEach(([listKey, keys]) => (job[listKey] || []).forEach((row) => dropKeys(row, keys)));
  return job;
}
