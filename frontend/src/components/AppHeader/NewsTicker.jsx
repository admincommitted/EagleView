import { useCallback, useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import {
  NOTIFICATIONS_REFRESH_MS, announceNotificationsChanged, isInAppLink, notificationsApi, onNotificationsChangedElsewhere,
} from '@/services/notificationsApi';
import { Button } from '@/components/ui';

const SOURCE = 'ticker';
const MAX_ALERTS = 8;
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const CHARACTERS_PER_SECOND = 6;
const MIN_SCROLL_SECONDS = 15;
const MAX_SCROLL_SECONDS = 120;

const TITLE_TONES = {
  info: 'tw:text-[#93c5fd]',
  success: 'tw:text-[#86efac]',
  warning: 'tw:text-[#fcd34d]',
  error: 'tw:text-[#fca5a5]',
};

// Unread alerts of the last 3 days that were broadcast or sent by a person; system job alerts stay under the bell.
const isTickerAlert = (alert) => !alert.isRead
  && (alert.broadcast || alert.userId == null || (alert.sentBy && alert.sentBy !== 'SYSTEM'))
  && (!alert.createdAt || Date.now() - new Date(alert.createdAt).getTime() < MAX_AGE_MS);

const scrollSeconds = (alerts) => {
  const length = alerts.reduce((total, alert) => total + String(alert.title || '').length + String(alert.message || '').length, 0);
  return Math.min(MAX_SCROLL_SECONDS, Math.max(MIN_SCROLL_SECONDS, Math.round(length / CHARACTERS_PER_SECOND) + 10));
};

export default function NewsTicker() {
  const socketInstance = useWorkspaceStore((state) => state.socket);
  const [alerts, setAlerts] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const reply = await notificationsApi.list({ limit: 100 });
      setAlerts((reply.data || []).filter(isTickerAlert).slice(0, MAX_ALERTS));
    } catch {
      // offline: keep what is shown
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
    const receive = (alert) => {
      if (isTickerAlert({ ...alert, isRead: false })) setAlerts((current) => [alert, ...current.filter((shown) => shown.id !== alert.id)].slice(0, MAX_ALERTS));
    };
    socketInstance.on('new_notification', receive);
    return () => socketInstance.off('new_notification', receive);
  }, [socketInstance]);

  const markRead = async (ids) => {
    setAlerts((current) => current.filter((alert) => !ids.includes(alert.id)));
    const savedIds = ids.filter((id) => Number.isInteger(Number(id)));
    await Promise.allSettled(savedIds.map((id) => notificationsApi.markRead(id)));
    announceNotificationsChanged(SOURCE);
  };
  const openAlert = (alert) => {
    markRead([alert.id]);
    if (isInAppLink(alert.link)) window.location.assign(alert.link);
  };

  if (alerts.length === 0) return null;

  return (
    <div role="region" aria-label="Live alerts"
      className="tw:flex tw:h-[30px] tw:items-center tw:gap-2 tw:border-b tw:border-[#334155] tw:bg-[linear-gradient(90deg,#1e293b_0%,#0f172a_100%)] tw:px-2 tw:text-entry tw:font-semibold tw:text-[#f8fafc] tw:md:px-4">
      <div className="tw:z-10 tw:flex tw:shrink-0 tw:items-center tw:gap-1.5 tw:text-[#facc15] tw:shadow-[10px_0_10px_-5px_rgba(30,41,59,0.9)]">
        <Megaphone className="tw:size-3.5 tw:animate-pulse" />
        <span className="tw:hidden tw:sm:inline">Live alerts{alerts.length > 1 ? ` (${alerts.length})` : ''}:</span>
      </div>

      <div className="tw:relative tw:flex tw:h-full tw:min-w-0 tw:flex-1 tw:items-center tw:overflow-hidden tw:whitespace-nowrap">
        <div style={{ '--ticker-duration': `${scrollSeconds(alerts)}s` }}
          className="tw:inline-block tw:animate-ticker tw:will-change-transform tw:hover:[animation-play-state:paused] tw:motion-reduce:animate-none">
          {alerts.map((alert, index) => (
            <span key={alert.id || index} role="button" tabIndex={0} className="tw:mr-[60px] tw:cursor-pointer"
              title={`${alert.sentBy && alert.sentBy !== 'SYSTEM' ? `From ${alert.sentBy} - ` : ''}click to mark as read`}
              onClick={() => openAlert(alert)}
              onKeyDown={(event) => { if (event.key === 'Enter') openAlert(alert); }}>
              <span className={`tw:mr-1.5 ${TITLE_TONES[alert.type] || TITLE_TONES.info}`}>[{String(alert.title || 'Alert').toUpperCase()}]</span>
              <span className="tw:text-[#f1f5f9]">{alert.message}</span>
            </span>
          ))}
        </div>
      </div>

      <Button variant="header" size="icon-sm" title="Mark these alerts as read" aria-label="Dismiss alerts"
        className="tw:shrink-0 tw:rounded-full tw:bg-white/10 tw:text-[#cbd5e1]" onClick={() => markRead(alerts.map((alert) => alert.id))}>
        <X className="tw:size-3" />
      </Button>
    </div>
  );
}
