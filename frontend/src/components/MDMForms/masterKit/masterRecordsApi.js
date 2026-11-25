import axiosInstance from '@/services/axiosInstance';

const getData = async (url, config) => (await axiosInstance.get(url, config)).data;
const postData = async (url, body, config) => (await axiosInstance.post(url, body, config)).data;
const putData = async (url, body, config) => (await axiosInstance.put(url, body, config)).data;
const deleteData = async (url, config) => (await axiosInstance.delete(url, config)).data;

// The plain masters: GET / POST /masters/<resource>, PUT / DELETE /masters/<resource>/<id>.
export const masterRecordsApi = {
  list: (resource, params) => getData(`/masters/${resource}`, { params }),
  create: (resource, record) => postData(`/masters/${resource}`, record),
  update: (resource, id, record) => putData(`/masters/${resource}/${id}`, record),
  remove: (resource, id) => deleteData(`/masters/${resource}/${id}`),
  setActive: (resource, id, isActive) => putData(`/masters/${resource}/${id}`, { isActive }),
};

// a master form's other calls (lookups, imports ...) - append at the end; several forms add to this object
export const mastersFormApi = {
  listPenaltyRules: () => getData('/penalty-rules'),
  createPenaltyRule: (rule) => postData('/penalty-rules', rule),
  updatePenaltyRule: (id, rule) => putData(`/penalty-rules/${id}`, rule),
  deletePenaltyRule: (id) => deleteData(`/penalty-rules/${id}`),
  listStatuses: () => getData('/status-master'),
  createStatus: (status) => postData('/status-master', status),
  updateStatus: (code, status) => putData(`/status-master/${encodeURIComponent(code)}`, status),
  deleteStatus: (code) => deleteData(`/status-master/${encodeURIComponent(code)}`),
  listAwbStock: (params) => getData('/stock/list', { params }),
  listHawbStock: (params) => getData('/stock/hawb/list', { params }),
  generateAwbStock: (body) => postData('/stock/generate', body),
  generateHawbStock: (body) => postData('/stock/hawb/generate', body),
  changeStock: (action, body) => postData(`/stock/${action}`, body),
  verifyAwbStock: (awbDigits) => getData(`/stock/verify/${encodeURIComponent(awbDigits)}`),
  returnAwbStock: (body) => postData('/stock/return', body),
  // Party Master
  liteLocations: () => getData('/locations/lite', { params: { _t: Date.now() } }),
  findParties: (params) => getData('/masters/parties/find', { params }),
  activateParty: (id) => postData(`/masters/parties/${id}/activate`),
  dgftIecStart: () => postData('/dgft/iec/start', {}),
  dgftIecCaptchaRefresh: (sessionId) => postData('/dgft/iec/captcha-refresh', { sessionId }),
  dgftIecFetch: (body) => postData('/dgft/iec/fetch', body),
  partyKycDocs: (partyId) => getData(`/masters/party/${partyId}/kyc`),
  uploadPartyKycDocs: (partyId, formData) => postData(`/masters/party/${partyId}/kyc`, formData),
  deletePartyKycDoc: (docId) => deleteData(`/masters/party/kyc/${docId}`),
  // iCAFFE Party Directory
  icaffePartyStats: () => getData('/icaffe-parties/stats'),
  icaffeParties: (params) => getData('/icaffe-parties', { params }),
  importIcaffeParty: (id) => postData(`/icaffe-parties/${id}/import`),
  // User Management
  userList: () => getData('/users'),
  userCreate: (user) => postData('/users', user),
  userUpdate: (id, changes) => putData(`/users/${id}`, changes),
  userModuleCatalog: () => getData('/users/modules'),
  userCompanyBranches: () => getData('/masters/company-branches'),
  // TACT & IATA Compliance Masters
  tactRecords: (table) => getData(`/tact/${table}`),
  uploadTactCsv: (tab, file, mode) => {
    const formData = new FormData();
    formData.append('file', file);
    return postData(`/tact/upload/${tab}`, formData, { params: { mode } });
  },
  // Currency, CETH, Country / Location masters
  currencyCbicStatus: () => getData('/masters/currencies/cbic-status'),
  syncCurrencyCbic: () => postData('/masters/currencies/sync-cbic', { force: true }),
  setCurrencyCbicAuto: (enabled) => postData('/masters/currencies/cbic-auto', { enabled }),
  syncCurrencyLive: () => postData('/masters/currencies/sync-live'),
  tariffHeadersWithComponents: () => getData('/masters/tariffheaders/all'),
  addTariffComponent: (component) => postData('/masters/tariffcomponents', component),
  deleteTariffComponent: (id) => deleteData(`/masters/tariffcomponents/${id}`),
  locations: () => getData('/locations'),
  locationStats: () => getData('/locations/stats'),
  saveLocationState: (state) => (state.id ? putData(`/locations/states/${state.id}`, state) : postData('/locations/states', state)),
  deleteLocationState: (id) => deleteData(`/locations/states/${id}`),
  saveLocationCity: (city) => (city.id ? putData(`/locations/cities/${city.id}`, city) : postData('/locations/cities', city)),
  deleteLocationCity: (id) => deleteData(`/locations/cities/${id}`),
  // Customs schedules: duty notifications, HSN / RITC tariff, duty lists
  dutyNotifHeaders: () => getData('/masters/dutynotifs/all', { params: { lite: 1 } }),
  dutyNotifDetails: (headerId) => getData(`/masters/dutynotifs/${headerId}/details`),
  bulkUploadDutyNotifs: (rows) => postData('/masters/dutynotifs/bulk-upload', rows),
  searchTariffHeaders: (query) => getData('/masters/tariffheaders/all', { params: { limit: 300, q: query || undefined } }),
  dutyListCounts: () => getData('/tariff/dutylists'),
  dutyListRows: (kind, params) => getData(`/tariff/dutylists/${kind}`, { params }),
  saveDutyListRow: (kind, row) => (row.id ? putData(`/tariff/dutylists/${kind}/${row.id}`, row) : postData(`/tariff/dutylists/${kind}`, row)),
  setDutyListRowActive: (kind, id, isActive) => putData(`/tariff/dutylists/${kind}/${id}/active`, { isActive }),
};

export { getData, postData, putData, deleteData };
