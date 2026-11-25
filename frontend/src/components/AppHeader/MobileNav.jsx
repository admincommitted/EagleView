import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button, Sheet, SheetContent, SheetTrigger } from '@/components/ui';
import { MenuGroup } from './MenuGroup';
import { PageSearch } from './PageSearch';

const sectionTitleClass = 'tw:flex tw:items-center tw:gap-2 tw:[&_svg]:size-4 tw:[&_svg]:text-primary';

// The whole menu in a side drawer, for screens too narrow for the menu bar. `children` go above the menu (branch, users).
export function MobileNav({ menu, isEntryActive, className, children }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const openSection = menu.find((entry) => entry.columns && isEntryActive(entry))?.label;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="header" size="icon" aria-label="Open menu" className={cn('tw:size-8', className)}>
          <Menu className="tw:size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" title="EagleView 360" description="Main menu">
        <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border tw:p-3">
          <PageSearch menu={menu} onNavigate={close} className="tw:w-full" />
          {children}
        </div>
        <Accordion type="single" collapsible defaultValue={openSection}>
          {menu.map((entry) => {
            const Icon = entry.icon;
            const isActive = isEntryActive(entry);
            if (!entry.columns) {
              return (
                <Link key={entry.label} to={entry.to} onClick={close}
                  className={cn('tw:border-b tw:border-border tw:px-3 tw:py-2.5 tw:text-entry tw:font-semibold tw:text-foreground tw:no-underline tw:hover:bg-accent', sectionTitleClass, isActive && 'tw:bg-accent tw:text-primary')}>
                  <Icon />{entry.label}
                </Link>
              );
            }
            return (
              <AccordionItem key={entry.label} value={entry.label}>
                <AccordionTrigger className={cn(isActive && 'tw:text-primary')}>
                  <span className={sectionTitleClass}><Icon />{entry.label}</span>
                </AccordionTrigger>
                <AccordionContent className="tw:flex tw:flex-col tw:gap-3 tw:px-2">
                  {entry.columns.flat().map((group) => <MenuGroup key={group.heading} group={group} onNavigate={close} />)}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </SheetContent>
    </Sheet>
  );
}
