import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isCurrentLink } from './useNavMenu';

const LINK_TONES = {
  primary: 'tw:font-bold tw:text-primary',
  success: 'tw:font-bold tw:text-success',
  danger: 'tw:font-bold tw:text-destructive',
};

// a link slides a little to the right on hover and an arrow shows where it leads
const linkClass = cn(
  'tw:group/link tw:relative tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-md tw:border-0 tw:bg-transparent tw:py-1.5 tw:pr-6 tw:pl-3',
  'tw:text-left tw:text-[11px] tw:font-medium tw:text-foreground tw:no-underline tw:transition-[background-color,color,padding] tw:duration-150 tw:ease-out',
  'tw:hover:bg-accent tw:hover:pl-4 tw:hover:text-head tw:focus-visible:bg-accent tw:focus-visible:pl-4 tw:focus-visible:outline-none',
  'tw:[&_svg]:size-3.5 tw:[&_svg]:shrink-0',
);

const arrowClass = 'tw:absolute tw:right-1.5 tw:-translate-x-1 tw:opacity-0 tw:transition-[opacity,transform] tw:duration-150 tw:group-hover/link:translate-x-0 tw:group-hover/link:opacity-100 tw:group-focus-visible/link:translate-x-0 tw:group-focus-visible/link:opacity-100';

function LinkContent({ icon: Icon, label }) {
  return (
    <>
      {Icon && <Icon />}
      <span className="tw:min-w-0">{label}</span>
      <ChevronRight className={arrowClass} />
    </>
  );
}

function MenuLink({ link, onNavigate }) {
  const location = useLocation();
  const { tone, title } = link;
  const content = <LinkContent icon={link.icon} label={link.label} />;

  if (link.onSelect) {
    return (
      <span role="button" tabIndex={0} title={title} className={cn(linkClass, LINK_TONES[tone])}
        onClick={() => { onNavigate(); link.onSelect(); }}
        onKeyDown={(event) => { if (event.key === 'Enter') { onNavigate(); link.onSelect(); } }}>
        {content}
      </span>
    );
  }

  const isCurrent = isCurrentLink(link, location);
  return (
    <Link to={link.to} title={title} onClick={onNavigate} aria-current={isCurrent ? 'page' : undefined}
      className={cn(linkClass, isCurrent && 'tw:bg-accent tw:font-semibold tw:text-accent-foreground tw:before:absolute tw:before:inset-y-1 tw:before:left-0 tw:before:w-[3px] tw:before:rounded-full tw:before:bg-primary', LINK_TONES[tone])}>
      {content}
    </Link>
  );
}

export function MenuGroup({ group, onNavigate, className }) {
  return (
    <div className={cn('tw:flex tw:flex-col tw:gap-px', className)}>
      <div className="tw:mb-1 tw:flex tw:items-center tw:gap-2 tw:rounded-md tw:bg-linear-to-r tw:from-accent tw:to-transparent tw:px-3 tw:py-1.5 tw:text-[11px] tw:font-extrabold tw:tracking-wider tw:text-head tw:uppercase">
        <span className="tw:h-3 tw:w-[3px] tw:rounded-full tw:bg-primary" />
        {group.heading}
      </div>
      {group.links.map((link, index) => (
        <Fragment key={link.to || link.label}>
          {link.group && link.group !== group.links[index - 1]?.group && (
            <div className="tw:px-3 tw:pt-2 tw:pb-0.5 tw:text-[10px] tw:font-bold tw:tracking-wider tw:text-muted-foreground tw:uppercase">{link.group}</div>
          )}
          <MenuLink link={link} onNavigate={onNavigate} />
        </Fragment>
      ))}
    </div>
  );
}
