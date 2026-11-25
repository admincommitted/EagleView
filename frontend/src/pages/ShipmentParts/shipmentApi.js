import axiosInstance from '@/services/axiosInstance';

// The shipment routes answer the record itself; a refusal comes as an error status or { success: false, error }.
async function request(config) {
  let response;
  try {
    response = await axiosInstance.request({ ...config, url: '/shipments' + config.url });
  } catch (error) {
    if (!error.response) throw error;
    const answer = error.response.data || {};
    throw new Error(answer.error || answer.message || 'HTTP ' + error.response.status);
  }
  const answer = response.data;
  if (answer?.success === false) throw new Error(answer.error || answer.message || 'HTTP ' + response.status);
  return answer;
}

const getData = (url, params) => request({ method: 'get', url, params });
const postData = (url, data) => request({ method: 'post', url, data });
const putData = (url, data) => request({ method: 'put', url, data });
const deleteData = (url, data) => request({ method: 'delete', url, data });

export const shipmentApi = {
  meta: () => getData('/meta'),
  nextNo: (division, branch, date) => getData('/next-no', { division, branch, date }),
  byNo: (docketNo) => getData('/by-no', { no: docketNo }),
  shipment: (id) => getData(`/${id}`),
  list: (filters) => getData('', filters),
  create: (shipment) => postData('', shipment),
  update: (id, shipment) => putData(`/${id}`, shipment),
  remove: (id, reason) => deleteData(`/${id}`, { reason }),
  duplicate: (id) => postData(`/${id}/duplicate`, {}),
  syncCustoms: (id) => postData(`/${id}/sync-customs`, {}),
  setStage: (ids, stage, reason) => postData('/stage', { ids, stage, reason }),
  openDueDates: (division, branch) => getData('/due', { division, branch }),

  lookup: (what, query, type) => getData(`/lookup/${what}`, { q: query, ...(type && { type }) }),
  partyAddresses: (name) => getData('/lookup/branches', { name }),
  partyFromDirectory: (icaffeId) => postData('/party-from-directory', { icaffeId }),

  events: (id) => getData(`/${id}/events`),
  saveEvent: (id, event) => postData(`/${id}/events`, event),
  deleteEvent: (id, eventId) => deleteData(`/${id}/events/${eventId}`),
  saveDocList: (id, docs) => putData(`/${id}/doclist`, { docs }),
  statusMail: (id) => getData(`/${id}/mail`),
  sendStatusMail: (id, mail) => postData(`/${id}/mail`, mail),
  files: (id) => getData(`/${id}/files`),
  uploadFiles: (id, formData) => postData(`/${id}/files`, formData),
  deleteFile: (id, fileId) => deleteData(`/${id}/files/${fileId}`),
};
