import { SECTIONS, hrefOf } from '@/pages/AccountsHubParts/menu';

// which Accounts sections stack in each column of the dropdown
const ACCOUNTS_COLUMNS = [['masters', 'gstinv'], ['voucher', 'purchase', 'other'], ['reports', 'books']];

const sectionGroup = (section) => ({
  heading: section.title,
  links: section.items.map((item) => ({ label: item.label, to: hrefOf(item), title: item.desc, group: item.group, keywords: item.keywords })),
});

export function accountsColumns(openAccountsSearch) {
  const groupsById = Object.fromEntries(SECTIONS.map((section) => [section.id, sectionGroup(section)]));
  const columns = ACCOUNTS_COLUMNS.map((ids) => ids.map((id) => groupsById[id]).filter(Boolean));
  const home = { heading: 'Home', links: [{ label: 'Accounts Dashboard', to: '/accounts-hub', end: true, tone: 'primary', title: 'Accounts dashboard' }] };
  const general = { heading: 'General', links: [{ label: 'Search Accounts', onSelect: openAccountsSearch }] };
  return [[home, ...columns[0]], ...columns.slice(1, -1), [...columns.at(-1), general]];
}
