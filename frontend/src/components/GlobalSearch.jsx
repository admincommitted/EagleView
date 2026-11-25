import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Command, CommandEmpty, CommandInput, CommandItem, CommandList,
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from '@/components/ui';
import axiosInstance from '@/services/axiosInstance';

// the server answers { parties, awbs }, or an array of remark hits that already have a title / description
const toSearchResults = (data) => {
  if (Array.isArray(data)) return data;
  const parties = data?.parties || [];
  const awbs = data?.awbs || [];
  return [
    ...awbs.map((awb) => ({ title: awb.no, description: awb.type, link: awb.type === 'HAWB' ? '/freight/create-hawb' : '/freight/search-awb' })),
    ...parties.map((party) => ({ title: party.name, description: 'Party' + (party.type ? ' • ' + party.type : ''), link: '/mdm' })),
  ];
};

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let isCurrent = true;
    const search = async () => {
      try {
        const { data } = await axiosInstance.get('/search/global-search', { params: { q: query } });
        if (isCurrent) setResults(toSearchResults(data));
      } catch (error) {
        console.error(error);
        if (isCurrent) setResults([]);
      }
    };
    search();
    return () => { isCurrent = false; };
  }, [query]);

  const openResult = (result) => {
    setIsOpen(false);
    if (result.link) navigate(result.link);
    else toast('Navigating to: ' + (result.title || result.jobNo));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="tw:top-[10vh] tw:max-h-[70vh] tw:w-[600px] tw:translate-y-0 tw:gap-0 tw:overflow-hidden tw:p-0 tw:sm:max-w-[calc(100%-2rem)]"
      >
        <DialogTitle className="tw:sr-only">Global search</DialogTitle>
        <DialogDescription className="tw:sr-only">Search jobs, items and parties</DialogDescription>
        <Command shouldFilter={false} className="tw:min-h-0 tw:flex-1 tw:rounded-none tw:**:data-[slot=command-input-wrapper]:h-11 tw:**:data-[slot=command-input-wrapper]:gap-3 tw:**:data-[slot=command-input-wrapper]:px-4 tw:**:data-[slot=command-input-wrapper]:pr-10">
          <CommandInput
            data-allow-text
            value={query}
            onValueChange={setQuery}
            placeholder="Search jobs, items, parties... (Global)"
            className="tw:h-11 tw:text-base"
          />
          <CommandList className="tw:max-h-none tw:min-h-0 tw:flex-1 tw:p-4">
            <CommandEmpty className="tw:py-6 tw:text-center tw:text-sm tw:text-muted-foreground">
              {query.trim() ? 'No results found' : 'Type something to search...'}
            </CommandEmpty>
            {results.map((result, index) => (
              <CommandItem
                key={index}
                value={String(index)}
                onSelect={() => openResult(result)}
                className="tw:mb-2 tw:cursor-pointer tw:flex-col tw:items-start tw:gap-1 tw:rounded-md tw:border tw:border-border tw:p-3"
              >
                <div className="tw:text-sm tw:font-semibold tw:text-foreground">{result.title || result.jobNo}</div>
                <div className="tw:text-entry tw:text-muted-foreground">{result.description || result.status}</div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
        <div className="tw:border-t tw:border-border tw:bg-page tw:px-4 tw:py-2 tw:text-right tw:text-[11px] tw:text-muted-foreground">
          Press Esc to close
        </div>
      </DialogContent>
    </Dialog>
  );
}
