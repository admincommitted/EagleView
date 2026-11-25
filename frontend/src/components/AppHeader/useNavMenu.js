import { useLocation } from 'react-router-dom';
import { canOpen, usePermissions } from '@/utils/permissions';
import { NAV_MENU } from './navMenu';
import { accountsColumns } from './accountsMenu';

const pathOf = (to) => to.split('?')[0];
const isAllowed = (link) => !link.to || canOpen(pathOf(link.to));

const allowedColumns = (columns) => columns
  .map((groups) => groups
    .map((group) => ({ ...group, links: group.links.filter(isAllowed) }))
    .filter((group) => group.links.length > 0))
  .filter((groups) => groups.length > 0);

const opensSomething = (columns) => columns.some((groups) => groups.some((group) => group.links.some((link) => link.to)));

export const dropdownLinks = (entry) => entry.columns.flat().flatMap((group) => group.links);

export function isCurrentLink(link, location) {
  if (!link.to) return false;
  const [path, query] = link.to.split('?');
  if (location.pathname !== path) return false;
  return !query || location.search === `?${query}`;
}

// The menu the user may open: links without the View right are left out, and a dropdown with nothing left is dropped.
export function useNavMenu(openAccountsSearch) {
  usePermissions();
  const location = useLocation();

  const menu = NAV_MENU
    .map((entry) => {
      if (entry.to) return isAllowed(entry) ? entry : null;
      const columns = allowedColumns(entry.accounts ? accountsColumns(openAccountsSearch) : entry.columns);
      return opensSomething(columns) ? { ...entry, columns } : null;
    })
    .filter(Boolean);

  const isEntryActive = (entry) => (entry.to
    ? location.pathname.startsWith(entry.to)
    : dropdownLinks(entry).some((link) => isCurrentLink(link, location)));

  return { menu, isEntryActive };
}
