import { useState } from 'react';
import { ChevronDown, LogOut, Settings, User } from 'lucide-react';
import axiosInstance from '@/services/axiosInstance';
import { LOGIN_PATH, endSession } from '@/services/session';
import askConfirm from '@/components/common/askConfirm';
import MyProfileModal from '@/components/common/MyProfileModal';
import SettingsModal from '@/components/common/SettingsModal';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui';
import { useUserProfile } from './useUserProfile';

const COMPANY_NAME = 'Committed Cargo Care Limited';

async function signOut() {
  const confirmed = await askConfirm({
    title: 'Sign out',
    message: 'Are you sure you want to sign out?',
    okLabel: 'Yes, sign out',
    cancelLabel: 'Cancel',
    tone: 'danger',
  });
  if (!confirmed) return;
  try {
    await axiosInstance.post('/auth/logout');
  } catch {
    // the token is dropped here anyway
  }
  endSession();
  window.location.href = LOGIN_PATH;
}

export function ProfileMenu() {
  const { firstName, lastName, email, displayName } = useUserProfile();
  const [openWindow, setOpenWindow] = useState(null);
  const closeWindow = () => setOpenWindow(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="header" aria-label="Account menu"
            className="tw:group tw:h-8 tw:gap-2 tw:rounded-full tw:border-white/20 tw:bg-white/10 tw:py-0.5 tw:pr-1 tw:pl-1 tw:md:pr-3">
            <span className="tw:flex tw:size-[26px] tw:items-center tw:justify-center tw:rounded-full tw:bg-[linear-gradient(135deg,#00f2fe_0%,#4facfe_100%)] tw:shadow-[0_0_10px_rgba(79,172,254,0.6)]">
              <User className="tw:size-3.5" strokeWidth={2.5} />
            </span>
            <span className="tw:hidden tw:flex-col tw:items-start tw:gap-0.5 tw:leading-none tw:md:flex">
              <span className="tw:text-[12px] tw:font-extrabold tw:tracking-[0.5px]">{displayName}</span>
              <span className="tw:text-[8px] tw:font-bold tw:tracking-[0.5px] tw:text-[#e0f2fe] tw:uppercase">{COMPANY_NAME}</span>
            </span>
            <ChevronDown className="tw:hidden tw:size-3 tw:opacity-70 tw:transition-transform tw:group-data-[state=open]:rotate-180 tw:md:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="tw:w-56 tw:p-0 tw:normal-case">
          <DropdownMenuLabel className="tw:border-b tw:border-border tw:bg-page tw:px-4 tw:py-3">
            <div className="tw:text-[11px] tw:font-semibold tw:tracking-[0.5px] tw:text-muted-foreground tw:uppercase">Welcome back,</div>
            <div className="tw:text-sm tw:font-extrabold tw:capitalize">{firstName} {lastName}</div>
            {email && <div className="tw:mt-0.5 tw:text-[11px] tw:font-normal tw:text-muted-foreground tw:lowercase">{email}</div>}
            <div className="tw:mt-0.5 tw:text-[10px] tw:font-semibold tw:text-muted-foreground tw:md:hidden">{COMPANY_NAME}</div>
          </DropdownMenuLabel>
          <div className="tw:p-1">
            <DropdownMenuItem onSelect={() => setOpenWindow('profile')}><User /> My Profile</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setOpenWindow('settings')}><Settings /> Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" className="tw:font-semibold" onSelect={signOut}><LogOut /> Log Out</DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      {openWindow === 'profile' && <MyProfileModal onClose={closeWindow} />}
      {openWindow === 'settings' && <SettingsModal onClose={closeWindow} />}
    </>
  );
}
