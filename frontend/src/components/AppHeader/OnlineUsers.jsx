import { useState } from 'react';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Button, Popover, PopoverAnchor, PopoverContent } from '@/components/ui';
import BroadcastModal from '@/components/common/BroadcastModal';
import { useHoverOpen } from './useHoverOpen';

const userLabel = (user) => {
  const name = String(user.name || user.firstName || user.username || user.email || 'User').toUpperCase();
  const login = user.username && user.name && user.username.toLowerCase() !== String(user.name).toLowerCase() ? ` (${user.username})` : '';
  const tabs = user.sessions > 1 ? ` · ${user.sessions} tabs` : '';
  return `${name}${login}${tabs}`;
};

function OnlineDot({ className }) {
  return <span className={cn('tw:size-2 tw:shrink-0 tw:rounded-full tw:bg-[#4ade80] tw:shadow-[0_0_6px_#4ade80]', className)} />;
}

// Hover shows who is online; a click opens the broadcast message window.
export function OnlineUsers({ className }) {
  const onlineUsers = useWorkspaceStore((state) => state.onlineUsers);
  const { open: showList, setOpen: setShowList, hoverProps } = useHoverOpen();
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);

  const openBroadcast = () => {
    setShowList(false);
    setIsBroadcastOpen(true);
  };

  return (
    <>
      <Popover open={showList} onOpenChange={setShowList}>
        <PopoverAnchor asChild>
          <Button variant="header" title="Click to broadcast a message" className={cn('tw:h-8 tw:gap-1.5 tw:px-2 tw:text-[12px] tw:font-bold tw:tracking-[0.5px]', className)}
            {...hoverProps} onClick={openBroadcast}>
            <Users className="tw:size-[18px]" />
            <span>{onlineUsers.length} online</span>
            <OnlineDot className="tw:animate-pulse" />
          </Button>
        </PopoverAnchor>
        <PopoverContent align="center" sideOffset={8} onOpenAutoFocus={(event) => event.preventDefault()} className="tw:w-60 tw:p-3" {...hoverProps}>
          <div className="tw:mb-2 tw:flex tw:items-center tw:gap-1.5 tw:border-b tw:border-border tw:pb-2 tw:text-entry tw:font-bold tw:text-head">
            <Users className="tw:size-4 tw:text-primary" /> Active users
          </div>
          {onlineUsers.length > 0 ? (
            <div className="tw:flex tw:max-h-40 tw:flex-col tw:gap-1 tw:overflow-y-auto">
              {onlineUsers.map((user, index) => (
                <div key={user.id ?? index} className="tw:flex tw:items-center tw:gap-2 tw:rounded-sm tw:px-2 tw:py-1.5 tw:text-entry tw:font-semibold">
                  <OnlineDot className="tw:size-1.5" />
                  <span className="tw:truncate">{userLabel(user)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="tw:py-2 tw:text-center tw:text-entry tw:text-muted-foreground tw:italic">No other users online</div>
          )}
          <Button variant="default" className="tw:mt-3 tw:h-8 tw:w-full tw:tracking-[0.5px]" onClick={openBroadcast}>
            Broadcast a message
          </Button>
        </PopoverContent>
      </Popover>
      <BroadcastModal isOpen={isBroadcastOpen} onClose={() => setIsBroadcastOpen(false)} onlineUsers={onlineUsers} />
    </>
  );
}
