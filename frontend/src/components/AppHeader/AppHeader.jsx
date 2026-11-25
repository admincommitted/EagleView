import { useCallback, useState } from 'react';
import CommandSearch from '@/pages/AccountsHubParts/CommandSearch';
import NewsTicker from './NewsTicker';
import { BrandLogo } from './BrandLogo';
import { BranchYearSwitcher } from './BranchYearSwitcher';
import { DesktopNav } from './DesktopNav';
import { MobileNav } from './MobileNav';
import { NotificationBell } from './NotificationBell';
import { OnlineUsers } from './OnlineUsers';
import { PageSearch } from './PageSearch';
import { ProfileMenu } from './ProfileMenu';
import { useNavMenu } from './useNavMenu';

export default function AppHeader({ ref }) {
  const [isAccountsSearchOpen, setIsAccountsSearchOpen] = useState(false);
  const openAccountsSearch = useCallback(() => setIsAccountsSearchOpen(true), []);
  const { menu, isEntryActive } = useNavMenu(openAccountsSearch);

  return (
    <header ref={ref} className="global-header tw:relative">
      <div className="tw:relative tw:z-50 tw:flex tw:h-10 tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-white/10 tw:px-2 tw:shadow-[0_2px_10px_rgba(0,0,0,0.1)] tw:md:gap-4 tw:md:px-6">
        <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-1">
          <MobileNav menu={menu} isEntryActive={isEntryActive} className="tw:md:hidden">
            <BranchYearSwitcher className="tw:self-start tw:bg-primary tw:sm:hidden" />
            <OnlineUsers className="tw:self-start tw:bg-primary tw:hover:bg-primary/85" />
          </MobileNav>
          <BrandLogo className="tw:text-[1.2rem] tw:md:text-[1.4rem]" />
        </div>

        <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-1 tw:md:gap-4 tw:lg:gap-6">
          <BranchYearSwitcher compact className="tw:hidden tw:sm:flex tw:lg:hidden" />
          <BranchYearSwitcher className="tw:hidden tw:lg:flex" />
          <OnlineUsers className="tw:hidden tw:md:inline-flex" />
          <NotificationBell />
          <ProfileMenu />
        </div>
      </div>

      <div className="tw:hidden tw:items-center tw:gap-2 tw:bg-black/10 tw:pr-4 tw:shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] tw:md:flex">
        <DesktopNav menu={menu} isEntryActive={isEntryActive} className="tw:min-w-0 tw:flex-1" />
        <PageSearch menu={menu} className="tw:w-44 tw:flex-none tw:lg:w-56" />
      </div>
      <NewsTicker />
      <CommandSearch open={isAccountsSearchOpen} onClose={() => setIsAccountsSearchOpen(false)} />
    </header>
  );
}
