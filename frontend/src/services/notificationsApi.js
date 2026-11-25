import axiosInstance from '@/services/axiosInstance';

// the server answers { success: false, error } for a refused action
const checked = (body) => {
  if (body?.success === false) throw new Error(body.error || 'The server refused');
  return body;
};

export const notificationsApi = {
  list: async (params) => checked((await axiosInstance.get('/notifications', { params })).data),
  markRead: async (id) => checked((await axiosInstance.put(`/notifications/${id}/read`)).data),
  markAllRead: async () => checked((await axiosInstance.put('/notifications/read-all')).data),
  remove: async (id) => checked((await axiosInstance.delete(`/notifications/${id}`)).data),
  clearRead: async () => checked((await axiosInstance.delete('/notifications/clear-read')).data),
};

export const NOTIFICATIONS_REFRESH_MS = 2 * 60 * 1000;

// The bell and the Live Alerts ticker tell each other when alerts are read or removed.
const CHANGED_EVENT = 'notifications-changed';

export const announceNotificationsChanged = (source) => window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { source } }));

export function onNotificationsChangedElsewhere(source, handler) {
  const listener = (event) => { if (event.detail?.source !== source) handler(); };
  window.addEventListener(CHANGED_EVENT, listener);
  return () => window.removeEventListener(CHANGED_EVENT, listener);
}

export const isInAppLink = (link) => /^\/[^/]/.test(link || '');
