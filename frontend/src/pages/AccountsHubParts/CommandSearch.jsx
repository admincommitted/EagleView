// Accounts search: screens and reports, ledgers (name / GSTIN / PAN) and vouchers (number, bill / cheque ref, job no,
// narration or exact amount). Arrow keys + Enter to open.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookUser, CornerDownLeft, FileText, X } from 'lucide-react';
import {
  Button, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from '@/components/ui';
import axiosInstance from '@/services/axiosInstance';
import { canOpen } from '../../utils/permissions';
import { ALL_ITEMS, hrefOf } from './menu';
import { inr, fmtDate } from './ui';

const EMPTY_RESULTS = { ledgers: [], vouchers: [] };
const SEARCH_DELAY_MS = 220;
const MIN_SEARCH_LENGTH = 2;
const DEFAULT_SCREEN_IDS = ['receipt', 'payment', 'journal', 'trade', 'tb', 'ledger', 'partybal', 'monthclosing'];
const LEDGER_COLOUR = '#0369a1';
const VOUCHER_COLOUR = '#0d9488';

const RESULT_GROUPS = [
  { kind: 'screen', title: 'Screens and reports' },
  { kind: 'ledger', title: 'Ledgers' },
  { kind: 'voucher', title: 'Vouchers' },
];

const HINTS = ['Up / Down to move', 'Enter to open', 'Esc to close'];

const searchAccounts = async (text) => {
  const { data } = await axiosInstance.get('/accounts-hub/search', { params: { q: text } });
  if (data.success === false) throw new Error(data.error || data.message);
  return { ledgers: data.ledgers || [], vouchers: data.vouchers || [] };
};

const GROUP_HEADING_CLASS = 'tw:p-0 tw:[&_[cmdk-group-heading]]:border-y tw:[&_[cmdk-group-heading]]:border-border tw:[&_[cmdk-group-heading]]:bg-accent tw:[&_[cmdk-group-heading]]:px-4 tw:[&_[cmdk-group-heading]]:py-1 tw:[&_[cmdk-group-heading]]:text-[11px] tw:[&_[cmdk-group-heading]]:font-extrabold tw:[&_[cmdk-group-heading]]:text-head';

const SEARCH_BOX_CLASS = 'tw:**:data-[slot=command-input-wrapper]:h-8 tw:**:data-[slot=command-input-wrapper]:flex-1 tw:**:data-[slot=command-input-wrapper]:rounded-md tw:**:data-[slot=command-input-wrapper]:border tw:**:data-[slot=command-input-wrapper]:border-white/40 tw:**:data-[slot=command-input-wrapper]:bg-background tw:**:data-[slot=command-input-wrapper]:px-2.5 tw:**:data-[slot=command-input-wrapper]:text-foreground';

function ResultRow({ row, onOpen }) {
  const RowIcon = row.Icon;
  return (
    <CommandItem
      value={row.key}
      onSelect={() => onOpen(row)}
      style={{ '--row-color': row.color }}
      className="tw:group tw:cursor-pointer tw:gap-3 tw:rounded-none tw:border-l-3 tw:border-transparent tw:px-4 tw:py-2 tw:data-[selected=true]:border-(--row-color) tw:data-[selected=true]:text-foreground"
    >
      <span className="tw:flex tw:size-7 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-[7px] tw:bg-(--row-color)/10">
        <RowIcon className="tw:size-[15px] tw:text-(--row-color)" />
      </span>
      <div className="tw:min-w-0 tw:flex-1">
        <div className="tw:truncate tw:text-[12.5px] tw:font-bold tw:text-foreground">{row.title}</div>
        <div className="tw:truncate tw:text-[11px] tw:text-muted-foreground">{row.subtitle}</div>
      </div>
      {row.amount != null && <span className="tw:text-entry tw:font-bold tw:tabular-nums">{inr(row.amount)}</span>}
      <CornerDownLeft className="tw:hidden tw:size-3.5 tw:text-muted-foreground tw:group-data-[selected=true]:block" />
    </CommandItem>
  );
}

export default function CommandSearch({ open, onClose, initial = '' }) {
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) setQuery(initial);
  }, [open, initial]);

  useEffect(() => {
    const text = query.trim();
    if (!open || text.length < MIN_SEARCH_LENGTH) {
      setResults(EMPTY_RESULTS);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        setResults(await searchAccounts(text));
      } catch {
        setResults(EMPTY_RESULTS);
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, open]);

  const screens = useMemo(() => {
    const text = query.trim().toLowerCase();
    const allowed = ALL_ITEMS.filter((item) => canOpen(hrefOf(item).split('?')[0]));
    if (!text) return allowed.filter((item) => DEFAULT_SCREEN_IDS.includes(item.id));
    return allowed
      .filter((item) => (item.label + ' ' + (item.keywords || '') + ' ' + item.section.title + ' ' + item.desc).toLowerCase().includes(text))
      .slice(0, 8);
  }, [query]);

  const rows = useMemo(() => [
    ...screens.map((item) => ({
      kind: 'screen', key: 's' + item.id, title: item.label, subtitle: item.section.title + ' - ' + item.desc,
      color: item.section.color, Icon: item.section.icon, href: hrefOf(item),
    })),
    ...results.ledgers.map((ledger) => ({
      kind: 'ledger', key: 'l' + ledger.id, title: ledger.name, subtitle: [ledger.groupName, ledger.gstin].filter(Boolean).join(' - '),
      color: LEDGER_COLOUR, Icon: BookUser, href: '/accounts-hub?item=ledger&ledger=' + ledger.id,
    })),
    ...results.vouchers.map((voucher) => ({
      kind: 'voucher', key: 'v' + voucher.id, title: `${voucher.typeName} ${voucher.voucherNumber}`,
      subtitle: [fmtDate(voucher.date), voucher.refNo, voucher.jobNo].filter(Boolean).join(' - '), amount: voucher.totalAmount,
      color: VOUCHER_COLOUR, Icon: FileText, href: '/accounts-hub?item=' + deskOf(voucher.baseType) + '&voucher=' + voucher.id,
    })),
  ], [screens, results]);

  const openRow = (row) => {
    onClose();
    navigate(row.href);
  };

  const emptyText = query.trim().length < MIN_SEARCH_LENGTH ? 'Type at least 2 letters' : 'Nothing matches "' + query + '"';

  return (
    <Dialog open={Boolean(open)} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="tw:top-[9vh] tw:w-[640px] tw:max-w-[calc(100vw-24px)] tw:translate-y-0 tw:gap-0 tw:overflow-hidden tw:p-0 tw:shadow-2xl tw:sm:max-w-[calc(100vw-24px)]"
      >
        <DialogTitle className="tw:sr-only">Accounts search</DialogTitle>
        <DialogDescription className="tw:sr-only">Search a screen, ledger or voucher</DialogDescription>
        <Command shouldFilter={false} vimBindings={false} className="tw:min-h-0 tw:flex-1 tw:rounded-none tw:bg-background">
          <div className={`tw:flex tw:items-center tw:gap-2.5 tw:bg-primary tw:px-4 tw:py-2.5 tw:text-primary-foreground ${SEARCH_BOX_CLASS}`}>
            <CommandInput
              data-allow-text
              value={query}
              onValueChange={setQuery}
              placeholder="Search a screen, ledger, GSTIN, voucher no, bill no, job no or amount"
              className="tw:h-full tw:text-[13px] tw:text-foreground"
            />
            {isSearching && <span className="tw:text-[11px]">Searching</span>}
            <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}
              className="tw:text-primary-foreground tw:hover:bg-white/15">
              <X className="tw:size-4" />
            </Button>
          </div>
          <CommandList className="tw:max-h-[56vh] tw:py-1.5">
            <CommandEmpty className="tw:p-6 tw:text-center tw:text-[12.5px] tw:text-muted-foreground">{emptyText}</CommandEmpty>
            {RESULT_GROUPS.map((group) => {
              const groupRows = rows.filter((row) => row.kind === group.kind);
              if (!groupRows.length) return null;
              return (
                <CommandGroup key={group.kind} heading={group.title} className={GROUP_HEADING_CLASS}>
                  {groupRows.map((row) => <ResultRow key={row.key} row={row} onOpen={openRow} />)}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
        <div className="tw:flex tw:flex-wrap tw:gap-x-3.5 tw:gap-y-1 tw:border-t tw:border-border tw:bg-page tw:px-4 tw:py-2 tw:text-[10.5px] tw:text-muted-foreground">
          {HINTS.map((hint) => <span key={hint}>{hint}</span>)}
          <span className="tw:ml-auto">Ctrl + K opens this anywhere</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const deskOf = (base) => ({ Receipt: 'receipt', Payment: 'payment', Journal: 'journal', Contra: 'contra', Purchase: 'trade', 'Debit Note': 'trade', Sales: 'gstservice', 'Credit Note': 'gstservice' }[base] || 'journal');
