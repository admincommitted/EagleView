const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const FILING_RESULT_RESET = {
  id: undefined, jobNo: 'DRAFT', beNo: null, beDate: null, assessmentDate: null, dutyPaidDate: null, challanNo: null, oocDate: null,
  icegateStatus: null, icegateUniqueId: null, icegateAck: null, icegateAckAt: null, isAmended: null, filedAt: null, filedFileName: null,
  filedSigner: null, hasFiledJson: false, amendUnlockedAt: null, amendUnlockedBy: null, status: 'DRAFT',
};

// a copy is a new job of today - not the docket / iCAFFE record / amendment of the job it was copied from
const NOT_COPIED_KEYS = ['docketNo', 'icaffeRowId', 'icaffeShipmentId', 'icaffeEnteredBy', 'icaffeFile', '_amendmentId', '_amendOfJobId', '_amendOfJobNo',
  '_amendNo', '_amendDate', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt'];

const isGiven = (value) => value !== undefined && value !== null && String(value).trim() !== '' && Number(String(value).replace(/,/g, '')) !== 0;

// A fresh BE takes either the freight / insurance rate or the amount; jobs read from iCAFFE carry both, so the rate
// is kept and the amount worked out from it is cleared.
function keepRateOnly(invoice) {
  const copy = { ...invoice };
  let cleared = 0;
  if (isGiven(copy.insuranceRate) && (isGiven(copy.insuranceValue) || isGiven(copy.insuranceAmount))) {
    copy.insuranceValue = '';
    copy.insuranceAmount = '';
    cleared++;
  }
  if (isGiven(copy.freightRate) && (isGiven(copy.freightValue) || isGiven(copy.freightAmount))) {
    copy.freightValue = '';
    copy.freightAmount = '';
    cleared++;
  }
  return { copy, cleared };
}

export function duplicateJobCopy(job) {
  const copy = { ...job, ...FILING_RESULT_RESET, jobDate: new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10) };
  NOT_COPIED_KEYS.forEach((key) => { delete copy[key]; });
  let clearedRateLines = 0;
  copy.invoices = (copy.invoices || []).map((invoice) => {
    const { copy: invoiceCopy, cleared } = keepRateOnly(invoice);
    clearedRateLines += cleared;
    return invoiceCopy;
  });
  return { copy, clearedRateLines };
}
