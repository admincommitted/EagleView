/**
 * HRMS API Service
 * All calls go to port 5050 (HRMS backend) via Vite proxy.
 * Token is auto-injected from localStorage.
 */

const BASE = '';  // Vite proxy handles routing

const getToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`,
});

const handleResponse = async (res) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
};

// ─── EMPLOYEES ────────────────────────────────────────────────
export const employeeApi = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${BASE}/api/employees?${q}`, { headers: headers() }).then(handleResponse);
  },
  getById: (id) =>
    fetch(`${BASE}/api/employees/${id}`, { headers: headers() }).then(handleResponse),
  create: (body) =>
    fetch(`${BASE}/api/employees`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handleResponse),
  update: (id, body) =>
    fetch(`${BASE}/api/employees/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(handleResponse),
  toggleStatus: (id, status) =>
    fetch(`${BASE}/api/employees/${id}/status`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ status }) }).then(handleResponse),
  getStats: () =>
    fetch(`${BASE}/api/employees/stats/summary`, { headers: headers() }).then(handleResponse),
};

// ─── ATTENDANCE ───────────────────────────────────────────────
export const attendanceApi = {
  getDaily: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${BASE}/api/attendance/daily?${q}`, { headers: headers() }).then(handleResponse);
  },
  getMonthly: (empId, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${BASE}/api/attendance/monthly/${empId}?${q}`, { headers: headers() }).then(handleResponse);
  },
  getMonthlyMatrix: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${BASE}/api/attendance/monthly-matrix?${q}`, { headers: headers() }).then(handleResponse);
  },
  getSummary: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${BASE}/api/attendance/summary?${q}`, { headers: headers() }).then(handleResponse);
  },
  getToday: () =>
    fetch(`${BASE}/api/attendance/today`, { headers: headers() }).then(handleResponse),
  punch: (body) =>
    fetch(`${BASE}/api/attendance/punch`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handleResponse),
  getRegularizations: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${BASE}/api/attendance/regularization?${q}`, { headers: headers() }).then(handleResponse);
  },
  submitRegularization: (body) =>
    fetch(`${BASE}/api/attendance/regularization`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handleResponse),
  approveRegularization: (id, body) =>
    fetch(`${BASE}/api/attendance/regularization/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(handleResponse),
  getReport: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${BASE}/api/attendance/report?${q}`, { headers: headers() }).then(handleResponse);
  },
};

// ─── LEAVE ────────────────────────────────────────────────────
export const leaveApi = {
  getBalance: (empId) =>
    fetch(`${BASE}/api/leave/balance/${empId}`, { headers: headers() }).then(handleResponse),
  getAllBalances: () =>
    fetch(`${BASE}/api/leave/balance`, { headers: headers() }).then(handleResponse),
  getAllRequests: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${BASE}/api/leave/requests?${q}`, { headers: headers() }).then(handleResponse);
  },
  getMyRequests: () =>
    fetch(`${BASE}/api/leave/requests/my`, { headers: headers() }).then(handleResponse),
  apply: (body) =>
    fetch(`${BASE}/api/leave/requests`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handleResponse),
  approve: (id) =>
    fetch(`${BASE}/api/leave/requests/${id}/approve`, { method: 'PUT', headers: headers() }).then(handleResponse),
  reject: (id, body = {}) =>
    fetch(`${BASE}/api/leave/requests/${id}/reject`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(handleResponse),
  cancel: (id) =>
    fetch(`${BASE}/api/leave/requests/${id}/cancel`, { method: 'PUT', headers: headers() }).then(handleResponse),
  getCalendar: (month, year) =>
    fetch(`${BASE}/api/leave/calendar/${month}/${year}`, { headers: headers() }).then(handleResponse),
  getLeaveTypes: () =>
    fetch(`${BASE}/api/hr-masters/leave-types`, { headers: headers() }).then(handleResponse),
};

// ─── PAYROLL ──────────────────────────────────────────────────
export const payrollApi = {
  getList: () =>
    fetch(`${BASE}/api/payroll`, { headers: headers() }).then(handleResponse),
  process: (body) =>
    fetch(`${BASE}/api/payroll/process`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handleResponse),
  getPayslip: (empId) =>
    fetch(`${BASE}/api/payroll/${empId}/payslip`, { headers: headers() }).then(handleResponse),
  getHistory: (empId) =>
    fetch(`${BASE}/api/payroll/${empId}/history`, { headers: headers() }).then(handleResponse),
  getSummary: () =>
    fetch(`${BASE}/api/payroll/summary`, { headers: headers() }).then(handleResponse),
  approve: (id) =>
    fetch(`${BASE}/api/payroll/${id}/approve`, { method: 'PUT', headers: headers() }).then(handleResponse),
};

// ─── OVERTIME ─────────────────────────────────────────────────
export const overtimeApi = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${BASE}/api/overtime?${q}`, { headers: headers() }).then(handleResponse);
  },
  getMy: () =>
    fetch(`${BASE}/api/overtime/my`, { headers: headers() }).then(handleResponse),
  request: (body) =>
    fetch(`${BASE}/api/overtime`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handleResponse),
  approve: (id) =>
    fetch(`${BASE}/api/overtime/${id}/approve`, { method: 'PUT', headers: headers() }).then(handleResponse),
  reject: (id, body = {}) =>
    fetch(`${BASE}/api/overtime/${id}/reject`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(handleResponse),
  getReport: () =>
    fetch(`${BASE}/api/overtime/report`, { headers: headers() }).then(handleResponse),
};

// ─── MASTERS ──────────────────────────────────────────────────
export const mastersApi = {
  getDepartments: () =>
    fetch(`${BASE}/api/hr-masters/departments`, { headers: headers() }).then(handleResponse),
  getDesignations: () =>
    fetch(`${BASE}/api/hr-masters/designations`, { headers: headers() }).then(handleResponse),
  getShifts: () =>
    fetch(`${BASE}/api/hr-masters/shifts`, { headers: headers() }).then(handleResponse),
  getHolidays: () =>
    fetch(`${BASE}/api/hr-masters/holidays`, { headers: headers() }).then(handleResponse),
};

// ─── ESS (Employee Self-Service) ──────────────────────────────
export const essApi = {
  getDashboard: () =>
    fetch(`${BASE}/api/ess/dashboard`, { headers: headers() }).then(handleResponse),
  getProfile: () =>
    fetch(`${BASE}/api/ess/profile`, { headers: headers() }).then(handleResponse),
  updateProfile: (body) =>
    fetch(`${BASE}/api/ess/profile`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(handleResponse),
  getAttendance: () =>
    fetch(`${BASE}/api/ess/attendance`, { headers: headers() }).then(handleResponse),
  getLeaveBalance: () =>
    fetch(`${BASE}/api/ess/leave-balance`, { headers: headers() }).then(handleResponse),
  applyLeave: (body) =>
    fetch(`${BASE}/api/ess/leave`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handleResponse),
  getPayslip: (month, year) =>
    fetch(`${BASE}/api/ess/payslip/${month}/${year}`, { headers: headers() }).then(handleResponse),
  getPayslips: () =>
    fetch(`${BASE}/api/ess/payslips`, { headers: headers() }).then(handleResponse),
  getNotifications: () =>
    fetch(`${BASE}/api/ess/notifications`, { headers: headers() }).then(handleResponse),
  markNotificationsRead: () =>
    fetch(`${BASE}/api/ess/notifications/read`, { method: 'PUT', headers: headers() }).then(handleResponse),
};


