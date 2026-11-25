import axiosInstance from '@/services/axiosInstance';

const getData = async (url, config) => (await axiosInstance.get(url, config)).data;
const postData = async (url, body, config) => (await axiosInstance.post(url, body, config)).data;
const putData = async (url, body, config) => (await axiosInstance.put(url, body, config)).data;
const deleteData = async (url, config) => (await axiosInstance.delete(url, config)).data;

export const exportEntryApi = {
  // append new calls at the end; several screens add to this object
  itemIcegateProfiles: () => getData('/icegate-profiles'),
  itemTariffHeaders: () => getData('/masters/tariffheaders/all'),
  itemDrawbacks: () => getData('/masters/drawbacks'),
  itemRodteps: () => getData('/masters/rodteps'),
  itemExportPolicies: () => getData('/masters/exportpolicies'),
  itemEsanchitMasters: () => getData('/masters/esanchits'),
  importJobsByBe: (beNo, beDate) => getData('/import-jobs/by-be', { params: { beNo, ...(beDate && { beDate }) } }),
  keepEsanchitPdf: (formData) => postData('/icegate/esanchit-archive', formData),
  uploadEsanchitPdf: (formData) => postData('/icegate/upload-esanchit', formData),
  exportJobList: (limit) => getData('/export-jobs', { params: { limit } }),
  exportJobById: (id) => getData(`/export-jobs/${id}`),
  queryJobs: (params) => getData('/export-jobs', { params }),
  queryJobLogs: (id) => getData(`/export-jobs/${id}/logs`),
  queryEsanchitArchive: (jobNo) => getData('/icegate/esanchit-archive', { params: { jobNo } }),
  // read even with an error status: ICEGATE's own message is in the answer
  querySbAck: (jobId) => postData('/icegate/sb-ack', { jobId }, { validateStatus: (status) => status !== 401 }),
  queryAddTimelineEntry: (entry) => postData('/timeline', entry),
  queryBulkZip: (files, zipName) => postData('/bulk-zip', { files, zipName }, { responseType: 'blob' }),
  headerChaMaster: () => getData('/masters/cha-master'),
  headerAirports: () => getData('/locations/airports'),
  headerVessels: () => getData('/masters/vessels'),
  headerWarehouses: () => getData('/masters/warehouses'),
  headerCities: (query) => getData('/locations/cities', { params: { q: query, limit: 50 } }),
  reportFavourites: () => getData('/user-prefs/export_report_favs'),
  saveReportFavourites: (ids) => putData('/user-prefs/export_report_favs', { value: ids }),
  reportSendMail: (mail) => postData('/email/send', mail),
  nextJobNo: (params) => getData('/export-jobs/next-sequence', { params }),
  saveJob: (job) => postData('/export-jobs', job),
  deleteJob: (id, force) => deleteData(`/export-jobs/${id}`, force ? { params: { force: 1 } } : undefined),
  previewSb: (sbRequest) => postData('/icegate/preview-sb', sbRequest),
  flatSbFile: (sbRequest) => postData('/icegate/flat-sb', sbRequest),
  signSbFile: (sbRequest) => postData('/icegate/sign-sb-file', sbRequest),
  submitSb: (sbRequest) => postData('/icegate/submit-sb', sbRequest),
  extractInvoicePdf: (formData) => postData('/ai-extractor/extract-invoice', formData),
  dashboardLiveTracking: (params) => getData('/export-dashboard/live-tracking', { params }),
  sendWhatsapp: (message) => postData('/notifications/whatsapp', message),
};

export { getData, postData, putData, deleteData };
