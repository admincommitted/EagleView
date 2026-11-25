import axiosInstance from '@/services/axiosInstance';

const getData = async (url, config) => (await axiosInstance.get(url, config)).data;
const postData = async (url, body, config) => (await axiosInstance.post(url, body, config)).data;
const deleteData = async (url, config) => (await axiosInstance.delete(url, config)).data;

// These screens read the server's answer even on an error status ({ success: false, error, duplicate ... });
// 401 is still left to axiosInstance (log out).
const keepErrorBody = { validateStatus: (status) => status !== 401 };

const jobFilesPath = (module, jobId) => `/job-files/${module === 'Export' ? 'export' : 'import'}/${jobId}`;

export const sharedWidgetsApi = {
  icegateProfiles: () => getData('/icegate-profiles'),
  importBeFile: (request) => postData('/import-jobs/import-json-direct', request, keepErrorBody),
  importSbFile: (request) => postData('/import-file/sb', request, keepErrorBody),
  sftpStatus: () => getData('/settings/sftp-status', keepErrorBody),

  jobFiles: (module, jobId) => getData(jobFilesPath(module, jobId)),
  removeJobFile: (module, jobId, kind, file) => deleteData(jobFilesPath(module, jobId), { params: { kind, file } }),
  uploadJobFile: (module, jobId, formData) => postData(`${jobFilesPath(module, jobId)}/other`, formData),

  shipmentMeta: () => getData('/shipments/meta'),
  docketFromJob: (request) => postData('/shipments/from-job', request),

  chatHistory: (before) => getData('/chatbot/history', { params: { limit: 50, before } }),
  sendChatMessage: (message) => postData('/chatbot/message', message),
  clearChatHistory: () => deleteData('/chatbot/history'),

  listFrom: (path) => getData(path),
  airports: () => getData('/locations/airports'),
};
