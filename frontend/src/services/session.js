import { useAuthStore, writeUploadsCookie } from '@/store/authStore';

// Plain functions over the auth store, for code outside React (axios, guards, helpers).

export const getToken = () => useAuthStore.getState().token;

export const isLoggedIn = () => Boolean(getToken());

export const getUser = () => useAuthStore.getState().user || {};

export const syncUploadsCookie = () => writeUploadsCookie(getToken());

export const startSession = (token, user) => useAuthStore.getState().login(token, user);

export const endSession = () => useAuthStore.getState().logout();

export const LOGIN_PATH = '/login';

export const redirectToLogin = () => {
  if (window.location.pathname !== LOGIN_PATH) window.location.href = LOGIN_PATH;
};
