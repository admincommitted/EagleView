import axiosInstance from '@/services/axiosInstance';

const getData = async (url, config) => (await axiosInstance.get(url, config)).data;
const postData = async (url, body, config) => (await axiosInstance.post(url, body, config)).data;

// answers { success: false, error } on a refusal
const postChecked = async (url, body) => {
  const answer = await postData(url, body);
  if (answer?.success === false) throw new Error(answer.error || 'Request failed');
  return answer;
};

// the masters behind the expense request are read even when one of them answers with an error status
const evenOnError = { validateStatus: (status) => status !== 401 };

export const freightOpsApi = {
  findAwb: (number) => getData(`/awb/search/${encodeURIComponent(number)}`),
  awbTrackingEvents: (awbNumber) => getData('/awb/tracking/events', { params: { awbNumber } }),
  awbDocuments: (awbId, awbType) => getData('/awb/docs/none', { params: { awbId, awbType } }),

  recordFreightEvent: (event) => postChecked('/freight/events', event),

  ledgerTree: () => getData('/accounts/tree', evenOnError),
  accountingMasters: () => getData('/accounting-masters/all', evenOnError),
  pendingApprovals: () => getData('/vouchers/pending-approvals', evenOnError),
  nextVoucherNumber: (voucherTypeId) => getData(`/vouchers/next-number/${voucherTypeId}`),
  createVoucher: (voucher) => postChecked('/vouchers', voucher),
};

export { getData, postData };
