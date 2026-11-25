import axios from 'axios';
import { authHeaders, branchHeaders } from './axiosInstance';
import { endSession, redirectToLogin, syncUploadsCookie } from './session';

// Older screens still call the global axios and window.fetch with '/api/...' paths. These hooks give them the same
// token, branch headers and 401 handling as axiosInstance. Remove once every screen uses axiosInstance.

const isApiUrl = (url) => typeof url === 'string' && url.startsWith('/api');

const logoutOnUnauthorized = (status, url) => {
  if (status === 401 && !String(url).includes('/api/auth/login')) {
    endSession();
    redirectToLogin();
  }
};

export function installLegacyHttpHooks() {
  axios.interceptors.request.use((config) => {
    Object.assign(config.headers, authHeaders(), isApiUrl(config.url) ? branchHeaders() : {});
    return config;
  });
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      logoutOnUnauthorized(error.response?.status, error.config?.url);
      return Promise.reject(error);
    }
  );

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (url, options = {}) => {
    const request = isApiUrl(url)
      ? { ...options, headers: { ...options.headers, ...authHeaders(), ...branchHeaders() } }
      : options;
    const response = await nativeFetch(url, request);
    if (isApiUrl(url)) logoutOnUnauthorized(response.status, url);
    return response;
  };

  syncUploadsCookie();
  window.addEventListener('storage', (event) => event.key === 'token' && syncUploadsCookie());
}
