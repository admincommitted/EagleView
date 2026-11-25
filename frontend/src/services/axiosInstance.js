import axios from 'axios';
import { endSession, getToken, redirectToLogin } from './session';

export const API_BASE_URL = '/api';

// Branch and financial year picked in the top bar (GlobalContext keeps them on window.__acctx).
export const branchHeaders = () => {
  const { branch, fyId } = window.__acctx || {};
  return {
    ...(branch && { 'X-Branch': branch }),
    ...(fyId && { 'X-FY': String(fyId) }),
  };
};

export const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const axiosInstance = axios.create({ baseURL: API_BASE_URL });

axiosInstance.interceptors.request.use((config) => {
  Object.assign(config.headers, authHeaders(), branchHeaders());
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginCall = error.config?.url?.startsWith('/auth/login');
    if (error.response?.status === 401 && !isLoginCall) {
      endSession();
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);

// The server's own message ({ error } or { message }) when it sent one, else the network / axios text.
export const errorMessage = (error) =>
  error.response?.data?.error || error.response?.data?.message || error.message;

export default axiosInstance;
