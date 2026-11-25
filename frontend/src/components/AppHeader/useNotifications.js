import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { NOTIFICATIONS_REFRESH_MS, announceNotificationsChanged, notificationsApi, onNotificationsChangedElsewhere } from '@/services/notificationsApi';
import { selectPopupsWanted, useThemeStore } from '@/store/themeStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

const SOURCE = 'bell';

const POPUP_ICONS = { error: '❌', success: '✅', warning: '⚠️' };
const POPUP_SHOW_MS = { error: 5000, success: 5000, warning: 5000 };

// App Settings > Push Notifications off: the alert is still listed under the bell, but no pop-up
const popupsWanted = () => selectPopupsWanted(useThemeStore.getState());

const showPopup = (notification) => {
  const text = `${notification.title} - ${notification.message}`;
  const options = { icon: POPUP_ICONS[notification.type] || '🔔', duration: POPUP_SHOW_MS[notification.type] || 4000 };
  if (notification.type === 'error') toast.error(text, options);
  else if (notification.type === 'success') toast.success(text, options);
  else toast(text, options);
};

const lessOne = (count) => (typeof count === 'number' ? Math.max(0, count - 1) : count);

export function useNotifications() {
  const socketInstance = useWorkspaceStore((state) => state.socket);
  const [notifications, setNotifications] = useState([]);
  const [serverUnread, setServerUnread] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const reply = await notificationsApi.list();
      setNotifications(reply.data || []);
      setServerUnread(typeof reply.unreadCount === 'number' ? reply.unreadCount : null);
    } catch {
      // offline: keep the list that is shown
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, NOTIFICATIONS_REFRESH_MS);
    const stopListening = onNotificationsChangedElsewhere(SOURCE, refresh);
    return () => { clearInterval(timer); stopListening(); };
  }, [refresh]);

  useEffect(() => {
    if (!socketInstance) return undefined;
    const receive = (notification) => {
      setNotifications((current) => [notification, ...current.filter((existing) => existing.id !== notification.id)]);
      setServerUnread((count) => (typeof count === 'number' ? count + 1 : count));
      if (popupsWanted()) showPopup(notification);
    };
    socketInstance.on('new_notification', receive);
    return () => socketInstance.off('new_notification', receive);
  }, [socketInstance]);

  const runAction = async (action, failureText) => {
    try {
      await action();
      announceNotificationsChanged(SOURCE);
    } catch (error) {
      toast.error(`${failureText}: ${errorMessage(error)}`);
    }
  };

  const markRead = (id) => runAction(async () => {
    await notificationsApi.markRead(id);
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setServerUnread(lessOne);
  }, 'Could not mark as read');

  const markAllRead = () => runAction(async () => {
    await notificationsApi.markAllRead();
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    setServerUnread(0);
  }, 'Could not mark all read');

  const remove = (notification) => runAction(async () => {
    await notificationsApi.remove(notification.id);
    setNotifications((current) => current.filter((item) => item.id !== notification.id));
    if (!notification.isRead) setServerUnread(lessOne);
  }, 'Could not remove');

  const clearRead = () => runAction(async () => {
    const reply = await notificationsApi.clearRead();
    setNotifications((current) => current.filter((item) => !item.isRead));
    if (reply.removed) toast.success(`${reply.removed} removed`);
  }, 'Could not clear');

  const unreadCount = Math.max(notifications.filter((item) => !item.isRead).length, serverUnread || 0);

  return { notifications, unreadCount, refresh, markRead, markAllRead, remove, clearRead };
}
