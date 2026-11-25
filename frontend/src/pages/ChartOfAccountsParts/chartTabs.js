import { Coins, FileText, Folder, Receipt, Shield, Tags, Target } from 'lucide-react';

// kind: the entry type the tab lists; entryLabel: what one entry is called on the form ("Create ledger")
export const CHART_TABS = [
  { id: 'groups', label: 'Account Groups', kind: 'group', entryLabel: 'group', icon: Folder },
  { id: 'ledgers', label: 'Ledgers', kind: 'ledger', entryLabel: 'ledger', icon: FileText },
  { id: 'vouchers', label: 'Voucher Types', kind: 'voucher', entryLabel: 'voucher', icon: Receipt },
  { id: 'categories', label: 'Cost Categories', kind: 'category', entryLabel: 'category', icon: Tags },
  { id: 'centres', label: 'Cost Centres', kind: 'centre', entryLabel: 'centre', icon: Target },
  { id: 'currencies', label: 'Currencies', kind: 'currency', entryLabel: 'currency', icon: Coins },
  { id: 'tds', label: 'TDS Natures', kind: 'tds', entryLabel: 'TDS Nature', icon: Shield },
];

export const chartTabOf = (id) => CHART_TABS.find((tab) => tab.id === id) || CHART_TABS[0];

// a group picker's options, indented by level
export const groupOptions = (groups) => groups.map((group) => ({ value: String(group.id), label: '- '.repeat(group.level) + group.name }));
