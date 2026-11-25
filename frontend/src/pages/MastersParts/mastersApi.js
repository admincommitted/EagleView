import axiosInstance from '@/services/axiosInstance';

const getData = async (url, config) => (await axiosInstance.get(url, config)).data;
const postData = async (url, body, config) => (await axiosInstance.post(url, body, config)).data;
const putData = async (url, body, config) => (await axiosInstance.put(url, body, config)).data;
const deleteData = async (url, config) => (await axiosInstance.delete(url, config)).data;

/**
 * These routes answer { success, data, error }. A failed call (an error status or success: false) throws an Error
 * whose message is the server's `error`, else `fallback`; a network failure keeps the network message.
 */
export async function succeeded(request, fallback) {
  let body;
  try {
    body = await request();
  } catch (error) {
    throw new Error(error.response ? error.response.data?.error || fallback : error.message);
  }
  if (!body?.success) throw new Error(body?.error || fallback);
  return body;
}

const listOf = (body) => body?.data || [];

export const mastersApi = {
  contracts: (params) => getData('/contracts', { params }),
  contract: (id) => getData(`/contracts/${id}`),
  saveContract: (id, body) => (id ? putData(`/contracts/${id}`, body) : postData('/contracts', body)),
  setContractStatus: (id, status) => postData(`/contracts/${id}/status`, { status }),
  deleteContract: (id) => deleteData(`/contracts/${id}`),
  gstCharges: async () => listOf(await getData('/contracts/gst-charges')),

  documentSeries: () => getData('/document-series'),
  saveDocumentSeries: (id, body) => (id ? putData(`/document-series/${id}`, body) : postData('/document-series', body)),
  deleteDocumentSeries: (id) => deleteData(`/document-series/${id}`),
  companyBranches: async () => listOf(await getData('/masters/company-branches')),
  financialYears: async () => listOf(await getData('/masters/financial-years')),
};

export { getData, postData, putData, deleteData };
