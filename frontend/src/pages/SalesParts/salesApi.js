import axiosInstance, { errorMessage } from '@/services/axiosInstance';

const getData = async (url, config) => (await axiosInstance.get(url, config)).data;
const postData = async (url, body, config) => (await axiosInstance.post(url, body, config)).data;
const putData = async (url, body, config) => (await axiosInstance.put(url, body, config)).data;
const deleteData = async (url, config) => (await axiosInstance.delete(url, config)).data;

// The sales-hub refuses with { success: false, error, ...details }; the details (duplicate, askReplace, needsMove,
// errors) ride on the thrown error so the screens can ask the user what to do.
function hubFailure(error) {
  const { response } = error;
  if (!response) return new Error(errorMessage(error));
  const answer = response.data && typeof response.data === 'object' ? response.data : {};
  return Object.assign(new Error(answer.error || `Server answered ${response.status}`), answer, { status: response.status });
}

async function hubRequest(config) {
  let response;
  try {
    response = await axiosInstance({ ...config, url: `/sales-hub${config.url}` });
  } catch (error) {
    throw hubFailure(error);
  }
  if (response.data?.success === false) throw hubFailure({ response });
  return response.data;
}

const hubGet = (url, params) => hubRequest({ method: 'get', url, params });
const hubPost = (url, data = {}) => hubRequest({ method: 'post', url, data });
const hubPut = (url, data) => hubRequest({ method: 'put', url, data });
const hubDelete = (url) => hubRequest({ method: 'delete', url });

const filledOnly = (filters) => Object.fromEntries(Object.entries(filters).filter(([, value]) => value));

export const salesHubApi = {
  meta: () => hubGet('/meta'),
  dealMeta: () => hubGet('/deal-meta'),
  dashboard: (person) => hubGet('/dashboard', { person: person || undefined }),
  dealsSummary: (person) => hubGet('/deals/summary', { person: /^\d+$/.test(String(person || '')) ? person : undefined }),

  customers: (filters) => hubGet('/customers', filledOnly(filters)),
  customer: (id) => hubGet(`/customers/${id}`),
  createCustomer: (customer) => hubPost('/customers', customer),
  updateCustomer: (id, customer) => hubPut(`/customers/${id}`, customer),
  deleteCustomer: (id) => hubDelete(`/customers/${id}`),
  loadCustomersFromBooks: (options) => hubPost('/customers/load-from-books', options),
  ledgers: ({ query, keep, all }) => hubGet('/ledgers', { q: query, keep: keep || undefined, all: all ? 1 : undefined }),
  ledgerBalance: (ledgerId) => getData(`/accounts-hub/ledger-balance/${ledgerId}`),

  addLookup: (kind, value) => hubPost('/lookups', { kind, value }),
  updateLookup: (id, change) => hubPut(`/lookups/${id}`, change),

  persons: () => hubGet('/persons'),
  users: () => hubGet('/users'),
  createPerson: (person) => hubPost('/persons', person),
  updatePerson: (id, person) => hubPut(`/persons/${id}`, person),
  moveCustomers: (fromId, move) => hubPost(`/persons/${fromId}/move-customers`, move),
  unmatchedNames: () => hubGet('/persons/unmatched-names'),
  addPersonsFromNames: (names) => hubPost('/persons/from-names', { names }),

  enquiries: (filters) => hubGet('/enquiries', filledOnly(filters)),
  enquiry: (id) => hubGet(`/enquiries/${id}`),
  createEnquiry: (enquiry) => hubPost('/enquiries', enquiry),
  updateEnquiry: (id, enquiry) => hubPut(`/enquiries/${id}`, enquiry),
  setEnquiryStatus: (id, change) => hubPost(`/enquiries/${id}/status`, change),
  deleteEnquiry: (id) => hubDelete(`/enquiries/${id}`),

  quotes: (filters) => hubGet('/quotes', filledOnly(filters)),
  quote: (id) => hubGet(`/quotes/${id}`),
  createQuote: (enquiryId, copyFromId) => hubPost('/quotes', { enquiryId, copyFromId: copyFromId || null }),
  quotesToCopy: (match) => hubGet('/quotes-to-copy', match),
  updateQuote: (id, quote) => hubPut(`/quotes/${id}`, quote),
  deleteQuote: (id) => hubDelete(`/quotes/${id}`),
  quotePdf: (id, html) => postData(`/sales-hub/quotes/${id}/pdf`, { html }, { responseType: 'blob' }),
  mailQuote: (id, mail) => hubPost(`/quotes/${id}/mail`, mail),
  markQuoteSent: (id) => hubPost(`/quotes/${id}/sent`),
  reviseQuote: (id) => hubPost(`/quotes/${id}/revise`),
  quoteWon: (id, docketNo, replace) => hubPost(`/quotes/${id}/won`, { docketNo, replace }),
  quoteLost: (id, lost) => hubPost(`/quotes/${id}/lost`, lost),
  reopenQuote: (id) => hubPost(`/quotes/${id}/reopen`),
};

export const salesCrmApi = {
  leads: (filters) => getData('/sales/leads', { params: filters }),
  nextLeadNo: () => getData('/sales/leads/next-no'),
  createLead: (lead) => postData('/sales/leads', lead),
  updateLead: (id, change) => putData(`/sales/leads/${id}`, change),
  quotes: () => getData('/sales/quotes'),
  nextQuoteNo: () => getData('/sales/quotes/next-no'),
  saveQuote: (id, quote) => (id ? putData(`/sales/quotes/${id}`, quote) : postData('/sales/quotes', quote)),
  updateQuote: (id, change) => putData(`/sales/quotes/${id}`, change),
  deleteQuote: (id) => deleteData(`/sales/quotes/${id}`),
  convertQuote: (id, jobNo) => postData(`/sales/quotes/${id}/convert`, { jobNo }),
  markQuoteSent: (id, to) => postData(`/sales/quotes/${id}/send`, { to }),
  rates: () => getData('/sales/rates'),
  debtorLedgers: () => getData('/vouchers/ledgers-by-group', { params: { groups: 'Sundry Debtors' } }),
  sendEmail: (mail) => postData('/email/send', mail),
};

export { getData, postData, putData, deleteData };
