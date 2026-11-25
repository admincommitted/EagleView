import axiosInstance from '@/services/axiosInstance';

const getData = async (url, config) => (await axiosInstance.get(url, config)).data;
const postData = async (url, body, config) => (await axiosInstance.post(url, body, config)).data;
const putData = async (url, body, config) => (await axiosInstance.put(url, body, config)).data;
const deleteData = async (url, config) => (await axiosInstance.delete(url, config)).data;

/** Some services answer 200 with { success: false, error }; that is treated like an HTTP error. */
const refusedUnlessOk = (body) => {
  if (body?.success === false) {
    throw Object.assign(new Error(body.error || 'Request refused'), { response: { data: body } });
  }
  return body;
};

export const purchaseApi = {
  vendors: () => getData('/po/vendors'),
  addVendor: (vendor) => postData('/po/vendors', vendor),
  updateVendor: (id, vendor) => putData(`/po/vendors/${id}`, vendor),
  deleteVendor: (id) => deleteData(`/po/vendors/${id}`),

  purchaseOrders: () => getData('/po'),
  purchaseOrder: (id) => getData(`/po/${id}`),
  createPurchaseOrder: (formData) => postData('/po', formData),
  decidePurchaseOrder: (id, decision) => putData(`/po/${id}/action`, decision),
  resendPurchaseOrder: (id) => postData(`/po/${id}/resend`),
  deletePurchaseOrder: (id) => deleteData(`/po/${id}`),
  receivePoItem: (itemId) => putData(`/po/items/${itemId}/receive`),
  itemHistory: (query) => getData('/po/item-history/search', { params: { q: query } }),

  companyBranches: () => getData('/masters/company-branches'),
  companyProfile: () => getData('/settings/company'),

  purchaseRequests: () => getData('/purchase'),
  purchaseRequest: (id) => getData(`/purchase/${id}`),
  submitPurchaseRequest: (formData) => postData('/purchase', formData),
  decidePurchaseRequest: (id, decision) => putData(`/purchase/${id}/action`, decision),

  assets: () => getData('/assets'),
  addAsset: (asset) => postData('/assets', asset),
  updateAsset: (id, changes) => putData(`/assets/${id}`, changes),
  /** kind: 'photo' | 'bill' | 'discard' */
  sendAssetForm: (id, kind, formData) => postData(`/assets/${id}/${kind}`, formData),

  pendingVouchers: async () => refusedUnlessOk(await getData('/vouchers/pending-approvals')),
  setVoucherStatus: async (id, update) => refusedUnlessOk(await postData(`/vouchers/update-status/${id}`, update)),
};

export { getData, postData, putData, deleteData, refusedUnlessOk };
