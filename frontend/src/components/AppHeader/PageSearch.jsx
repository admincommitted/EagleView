import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ComboInput } from '@/components/ui';

const MAX_RESULTS = 30;

// every page the menu offers, with where it sits in the menu ("Masters › Core Masters")
const searchablePages = (menu) => menu.flatMap((entry) => {
  if (entry.to) return [{ label: entry.label, to: entry.to, place: 'Menu' }];
  return entry.columns.flat().flatMap((group) => group.links.map((link) => ({
    ...link,
    place: `${entry.label} › ${group.heading}`,
    searchText: [link.label, entry.label, group.heading, link.group, link.title, link.keywords].filter(Boolean).join(' ').toLowerCase(),
  })));
});

const matchesQuery = (page, words) => {
  const text = page.searchText || page.label.toLowerCase();
  return words.every((word) => text.includes(word));
};

// a page whose name starts with the text comes first, then names containing it, then other matches
const rankOf = (page, query) => {
  const label = page.label.toLowerCase();
  if (label.startsWith(query)) return 0;
  return label.includes(query) ? 1 : 2;
};

const matchingPages = (menu, typed) => {
  const query = typed.trim().toLowerCase();
  if (!query) return [];
  const words = query.split(/\s+/);
  return searchablePages(menu)
    .filter((page) => matchesQuery(page, words))
    .sort((first, second) => rankOf(first, query) - rankOf(second, query))
    .slice(0, MAX_RESULTS);
};

function PageOption({ page }) {
  return (
    <div className="tw:flex tw:min-w-0 tw:flex-col">
      <span className="tw:truncate tw:font-semibold tw:text-foreground">{page.label}</span>
      <span className="tw:truncate tw:text-[10px] tw:text-muted-foreground">{page.place}</span>
    </div>
  );
}

// Type part of a page name (or its menu, or a keyword) and pick it to open the page.
export function PageSearch({ menu, onNavigate, className }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const pages = matchingPages(menu, query);

  const openPage = (page) => {
    setQuery('');
    onNavigate?.();
    if (page.onSelect) page.onSelect();
    else navigate(page.to);
  };

  return (
    <ComboInput
      aria-label="Search pages"
      placeholder="Search pages..."
      leftIcon={Search}
      options={pages}
      filter={() => true}
      limit={MAX_RESULTS}
      getValue={(page) => page.label}
      renderOption={(page) => <PageOption page={page} />}
      value={query}
      onValueChange={setQuery}
      onSelect={openPage}
      className={cn('tw:normal-case', className)}
      listClassName="tw:min-w-72"
    />
  );
}
