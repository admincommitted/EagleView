import axiosInstance from '@/services/axiosInstance';

export const getData = async (url, config) => (await axiosInstance.get(url, config)).data;
export const postData = async (url, body, config) => (await axiosInstance.post(url, body, config)).data;
export const putData = async (url, body, config) => (await axiosInstance.put(url, body, config)).data;
export const deleteData = async (url, config) => (await axiosInstance.delete(url, config)).data;

// Answers the way fetch did: an HTTP error status still gives { status, body } with the server's JSON body ({} when it
// sent none); only a network failure throws.
export const replyOf = async (request) => {
  try {
    return { status: 200, body: await request };
  } catch (error) {
    if (!error.response) throw error;
    const { status, data } = error.response;
    return { status, body: data && typeof data === 'object' ? data : {} };
  }
};

export const settingsApi = {
  settings: () => getData('/settings'),
  saveSettings: (settings) => postData('/settings/bulk', { settings }),
  testSftp: () => postData('/settings/test-sftp'),
  generateSshKey: (saveToDb) => postData('/settings/generate-ssh-key', { saveToDb }),

  icegateProfiles: () => getData('/icegate-profiles'),
  createIcegateProfile: (profile) => postData('/icegate-profiles', profile),
  updateIcegateProfile: (id, profile) => putData(`/icegate-profiles/${id}`, profile),
  deleteIcegateProfile: (id) => deleteData(`/icegate-profiles/${id}`),
  testIcegateAuth: (body) => postData('/icegate/test-auth', body),
  testIcegateImap: (profile) => postData('/icegate/test-imap', profile),
  chaMaster: () => getData('/masters/cha-master'),

  dsrTemplates: () => getData('/dsr-templates'),
  saveDsrTemplate: (template) => postData('/dsr-templates', template),
  deleteDsrTemplate: (id) => deleteData(`/dsr-templates/${id}`),

  companyProfile: () => getData('/settings/company'),
  saveCompanyProfile: (company) => putData('/settings/company', company),
  defaultCompanyLogo: () => getData('/settings/company/default-logo'),
  emailConfig: () => getData('/settings/email'),
  saveEmailConfig: (email) => putData('/settings/email', email),
  testEinvoice: (target) => postData('/settings/test-einvoice', target),

  testAiExtraction: (formData) => postData('/ai-extractor/test', formData),
  securityCheck: () => getData('/settings/security-check'),
  systemBackup: () => postData('/auth/system-backup'),
  sendTestEmail: (to, smtp) => postData('/email/test', { to, smtp }),
  whatsappModuleNumbers: () => getData('/whatsapp/module-numbers'),

  cbicWatch: () => getData('/settings/cbic-watch'),
  saveCbicWatch: (watch) => postData('/settings/cbic-watch', watch),
  testCbicWatch: (body) => postData('/settings/cbic-watch/test', body),
  checkCbicWatch: () => postData('/settings/cbic-watch/check'),

  companyBranches: () => getData('/masters/company-branches'),
  createCompanyBranch: (branch) => postData('/masters/company-branches', branch),
  updateCompanyBranch: (id, branch) => putData(`/masters/company-branches/${id}`, branch),
  deleteCompanyBranch: (id) => deleteData(`/masters/company-branches/${id}`),
  createChaMaster: (cha) => postData('/masters/cha-master', cha),
  updateChaMaster: (id, cha) => putData(`/masters/cha-master/${id}`, cha),
  deleteChaMaster: (id) => deleteData(`/masters/cha-master/${id}`),
  financialYears: () => getData('/masters/financial-years'),
  createFinancialYear: (year) => postData('/masters/financial-years', year),
  updateFinancialYear: (id, year) => putData(`/masters/financial-years/${id}`, year),
  deleteFinancialYear: (id) => deleteData(`/masters/financial-years/${id}`),

  jobSequenceStatus: (params) => getData('/masters/job-sequences/status', { params }),
  saveJobSequences: (sequences, financialYearId) => postData('/masters/job-sequences', sequences, { params: { financialYearId } }),
  numberSeries: () => getData('/number-series'),
  createNumberSeries: (series) => postData('/number-series', series),
  updateNumberSeries: (id, series) => putData(`/number-series/${id}`, series),

  ulipApis: () => getData('/ulip/apis'),
  createUlipApi: (api) => postData('/ulip/apis', api),
  updateUlipApi: (id, api) => putData(`/ulip/apis/${id}`, api),
  deleteUlipApi: (id) => deleteData(`/ulip/apis/${id}`),
  testUlipApi: (id, params) => postData(`/ulip/apis/${id}/test`, { params }),
  testUlipLogin: (login) => postData('/ulip/test-login', login),

  testSftpConnection: (connection) => postData('/settings/test-sftp', connection),
  exportSftpPrivateKey: () => postData('/settings/export-private-key'),
  exportSftpPublicKey: () => postData('/settings/export-public-key'),

  whatsappState: () => getData('/whatsapp/state'),
  whatsappQueueStats: () => getData('/whatsapp/queue-stats'),
  whatsappConnect: () => postData('/whatsapp/connect', { force: true }),
  whatsappDisconnect: () => postData('/whatsapp/disconnect'),
  whatsappTest: (toNumber, message) => postData('/whatsapp/test', { toNumber, message }),
  whatsappApiTest: (toNumber) => postData('/whatsapp/api-test', { toNumber }),
  whatsappRestartScheduler: () => postData('/whatsapp/restart-scheduler'),
  whatsappFlushQueue: () => postData('/whatsapp/flush-queue'),
  addWhatsappModuleNumber: (moduleName, phoneNumber) => postData('/whatsapp/module-numbers', { moduleName, phoneNumber }),
  deleteWhatsappModuleNumber: (moduleName) => deleteData(`/whatsapp/module-numbers/${encodeURIComponent(moduleName)}`),
};
