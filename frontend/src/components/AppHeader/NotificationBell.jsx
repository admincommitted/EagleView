import { useState } from 'react';
import { Bell, CheckCheck, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/dates';
import { isInAppLink } from '@/services/notificationsApi';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@/components/ui';
import { useNotifications } from './useNotifications';

const DOT_TONES = {
  error: 'tw:border-destructive tw:bg-destructive',
  success: 'tw:border-success tw:bg-success',
  warning: 'tw:border-warning tw:bg-warning',
  info: 'tw:border-primary tw:bg-primary',
};

const MAX_BADGE = 99;

function NotificationRow({ notification, onOpen, onRemove }) {
  const tone = DOT_TONES[notification.type] || DOT_TONES.info;
  const details = [timeAgo(notification.createdAt), notification.sentBy, notification.broadcast && 'to all'].filter(Boolean).join(' · ');
  return (
    <div role="button" tabIndex={0}
      onClick={() => onOpen(notification)}
      onKeyDown={(event) => { if (event.key === 'Enter') onOpen(notification); }}
      className={cn('tw:flex tw:cursor-pointer tw:items-start tw:gap-2 tw:border-b tw:border-border tw:px-3 tw:py-2.5 tw:hover:bg-page tw:focus-visible:bg-page tw:focus-visible:outline-none', !notification.isRead && 'tw:bg-accent/40')}>
      <span className={cn('tw:mt-1 tw:size-2 tw:shrink-0 tw:rounded-full tw:border', tone, notification.isRead && 'tw:bg-transparent')} />
      <div className="tw:min-w-0 tw:flex-1">
        <div className={cn('tw:text-entry tw:text-foreground', notification.isRead ? 'tw:font-medium' : 'tw:font-bold')}>{notification.title}</div>
        <div className="tw:mt-0.5 tw:text-entry tw:break-words tw:whitespace-pre-wrap tw:text-muted-foreground">{notification.message}</div>
        <div className="tw:mt-1 tw:text-[10px] tw:text-muted-foreground/80">{details}</div>
      </div>
      <Button variant="ghost" size="icon-sm" title="Remove" aria-label="Remove notification" className="tw:text-muted-foreground"
        onClick={(event) => { event.stopPropagation(); onRemove(notification); }}>
        <X />
      </Button>
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, refresh, markRead, markAllRead, remove, clearRead } = useNotifications();
  const hasRead = notifications.some((item) => item.isRead);

  const changeOpen = (isOpen) => {
    if (isOpen) refresh();
    setOpen(isOpen);
  };
  const openNotification = (notification) => {
    if (!notification.isRead) markRead(notification.id);
    if (isInAppLink(notification.link)) {
      setOpen(false);
      window.location.assign(notification.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button variant="header" size="icon" aria-label="Notifications" title={unreadCount ? `${unreadCount} unread` : 'Notifications'} className="tw:relative tw:size-8">
          <Bell className="tw:size-[18px]" />
          {unreadCount > 0 && (
            <span className="tw:absolute tw:-top-0.5 tw:-right-0.5 tw:flex tw:h-[15px] tw:min-w-[15px] tw:items-center tw:justify-center tw:rounded-full tw:bg-destructive tw:px-1 tw:text-[9px] tw:font-bold tw:text-white">
              {unreadCount > MAX_BADGE ? `${MAX_BADGE}+` : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="tw:w-[min(22rem,calc(100vw-1rem))] tw:overflow-hidden tw:p-0">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border tw:bg-page tw:px-3 tw:py-2">
          <span className="tw:text-entry tw:font-semibold">Notifications{unreadCount ? ` (${unreadCount} unread)` : ''}</span>
          <span className="tw:flex tw:items-center tw:gap-1">
            <Button variant="ghost" size="icon-sm" title="Refresh" aria-label="Refresh" onClick={refresh}><RefreshCw /></Button>
            {unreadCount > 0 && <Button variant="ghost" size="sm" title="Mark all as read" onClick={markAllRead}><CheckCheck /> All read</Button>}
            {hasRead && <Button variant="ghost" size="sm" title="Remove the read ones" className="tw:text-muted-foreground" onClick={clearRead}>Clear read</Button>}
          </span>
        </div>
        <div className="tw:max-h-[min(350px,60vh)] tw:overflow-y-auto tw:normal-case">
          {notifications.length === 0
            ? <div className="tw:p-4 tw:text-center tw:text-entry tw:text-muted-foreground">No notifications</div>
            : notifications.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} onOpen={openNotification} onRemove={remove} />
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
