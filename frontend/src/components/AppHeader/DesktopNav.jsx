import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@/components/ui';
import { MenuGroup } from './MenuGroup';
import { useHoverOpen } from './useHoverOpen';

const COLUMN_GRID = {
  1: 'tw:grid-cols-1',
  2: 'tw:grid-cols-2',
  3: 'tw:grid-cols-3',
};

const navItemClass = (isActive) => cn(
  'tw:group/nav tw:relative tw:h-7 tw:shrink-0 tw:gap-1 tw:rounded-full tw:px-2 tw:xl:px-2.5 tw:text-[11px] tw:font-semibold tw:tracking-[0.3px] tw:no-underline tw:[text-shadow:0_1px_2px_rgba(0,0,0,0.25)] tw:hover:bg-white/15 tw:[&_svg:not([class*=size-])]:size-4',
  'tw:[&>svg:first-child]:transition-transform tw:hover:[&>svg:first-child]:scale-110',
  // below xl the words alone fit the menu on one line; the icons come back on a wider window
  'tw:max-xl:[&>svg:first-child]:hidden',
  isActive && 'tw:bg-white/25 tw:font-bold tw:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.25)] tw:hover:bg-white/25',
);

function NavDropdown({ entry, isActive }) {
  const { open, setOpen, hoverProps } = useHoverOpen();
  const Icon = entry.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="header"
          className={navItemClass(isActive)}
          {...hoverProps}
          onClick={(event) => { if (event.nativeEvent.pointerType === 'mouse' && open) event.preventDefault(); }}
        >
          <Icon />
          <span>{entry.label}</span>
          <ChevronDown className="tw:size-3 tw:opacity-70 tw:transition-transform tw:duration-200 tw:group-data-[state=open]/nav:rotate-180" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(event) => event.preventDefault()}
        {...hoverProps}
        className={cn(
          'tw:grid tw:w-auto tw:max-w-[calc(100vw-1rem)] tw:max-h-(--radix-popover-content-available-height) tw:gap-x-3 tw:gap-y-4 tw:divide-x tw:divide-border/60 tw:overflow-y-auto tw:rounded-xl tw:p-3 tw:shadow-popup',
          'tw:border-t-[3px] tw:border-t-primary',
          COLUMN_GRID[entry.columns.length],
        )}
      >
        {entry.columns.map((groups) => (
          <div key={groups[0].heading} className="tw:flex tw:min-w-[220px] tw:flex-col tw:gap-4 tw:pr-3 tw:last:pr-0">
            {groups.map((group) => <MenuGroup key={group.heading} group={group} onNavigate={() => setOpen(false)} />)}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// one line at every width: a menu wider than the window scrolls sideways (it wrapped to two lines at 100% zoom on a
// 125-150% Windows display, about 1280px wide)
export function DesktopNav({ menu, isEntryActive, className }) {
  return (
    <nav aria-label="Main menu" className={cn('tw:flex tw:flex-nowrap tw:items-center tw:gap-0.5 tw:overflow-x-auto tw:px-2 tw:py-1 tw:[scrollbar-width:none] tw:xl:gap-1 tw:xl:px-4', className)}>
      {menu.map((entry) => {
        const Icon = entry.icon;
        const isActive = isEntryActive(entry);
        if (entry.columns) return <NavDropdown key={entry.label} entry={entry} isActive={isActive} />;
        return (
          <Button key={entry.label} asChild variant="header" className={navItemClass(isActive)}>
            <Link to={entry.to} aria-current={isActive ? 'page' : undefined}>
              <Icon />
              <span>{entry.label}</span>
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
