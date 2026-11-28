// The lists of each master: group / ledger tree, voucher types, cost categories, cost centre tree, currencies, TDS natures
import { ChevronDown, ChevronRight, Edit2, FileText, Folder, FolderOpen, Receipt, ShieldCheck, Tags, Target, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, DataTable } from '@/components/ui';

const PANEL = 'tw:rounded-xl tw:border tw:border-border tw:bg-card';
const TREE_PANEL = cn(PANEL, 'tw:min-h-[400px] tw:p-5');
const CARD_GRID = 'tw:grid tw:grid-cols-1 tw:gap-5 tw:sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]';
// on a mouse screen the edit / delete buttons show when the row is pointed at; always shown on touch screens
const SHOW_ON_HOVER = 'tw:md:opacity-0 tw:md:transition-opacity tw:md:group-hover:opacity-100';
const SYSTEM_BADGE = 'tw:inline-flex tw:items-center tw:gap-1 tw:rounded-xl tw:bg-indigo-100 tw:font-bold tw:text-indigo-700';

const matches = (text, query) => text.toLowerCase().includes(query.toLowerCase());

export function RowActions({ kind, node, chart, className }) {
  if (node.isBuiltIn) return null;
  return (
    <div className={cn('tw:ml-auto tw:flex tw:gap-2 tw:pl-4', className)}>
      <Button variant="ghost" size="icon" title="Edit" onClick={(event) => chart.handleEdit(kind, node, event)} className="tw:text-muted-foreground"><Edit2 /></Button>
      <Button variant="ghost" size="icon" title="Delete" onClick={(event) => chart.handleDelete(kind, node, event)} className="tw:text-red-500"><Trash2 /></Button>
    </div>
  );
}

function TreeRow({ level, children }) {
  return (
    <div className="tw:group tw:relative tw:z-[1] tw:flex tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-sm tw:px-2 tw:py-1.5 tw:hover:bg-muted">
      {level > 0 && <div className="tw:absolute tw:top-1/2 tw:-left-5 tw:-z-[1] tw:w-5 tw:border-t tw:border-dashed tw:border-slate-400" />}
      {children}
    </div>
  );
}

function ExpandToggle({ canExpand, expanded, onToggle }) {
  if (!canExpand) return <div className="tw:w-5 tw:shrink-0" />;
  return (
    <div onClick={onToggle} className="tw:flex tw:size-5 tw:shrink-0 tw:items-center tw:justify-center">
      {expanded ? <ChevronDown className="tw:size-3.5 tw:text-muted-foreground" /> : <ChevronRight className="tw:size-3.5 tw:text-muted-foreground" />}
    </div>
  );
}

const TreeChildren = ({ children, className }) => (
  <div className={cn('tw:border-l tw:border-dashed tw:border-slate-400 tw:py-1 tw:pl-5', className)}>{children}</div>
);

function AccountNode({ node, level, chart }) {
  const { activeTab, searchQuery, expandedKeys, toggleExpand } = chart;
  const isGroup = node.type === 'group';
  if (activeTab === 'groups' && !isGroup) return null;
  const expanded = searchQuery ? true : expandedKeys.has(node.id);
  const opening = parseFloat(node.openingBalance);
  const credit = node.balanceType === 'Cr';
  const GroupIcon = expanded ? FolderOpen : Folder;
  return (
    <div className="tw:relative">
      <TreeRow level={level}>
        <ExpandToggle canExpand={isGroup} expanded={expanded} onToggle={(event) => toggleExpand(node.id, event)} />
        {isGroup ? <GroupIcon className="tw:size-4 tw:shrink-0 tw:text-amber-500" /> : <FileText className="tw:size-4 tw:shrink-0 tw:text-emerald-500" />}
        <span className={cn('tw:text-sm', isGroup ? 'tw:font-semibold tw:text-foreground' : 'tw:text-foreground/75')}>{node.name}</span>
        {!isGroup && opening > 0 && (
          <div className="tw:ml-auto tw:flex tw:items-center tw:gap-2">
            <span className={cn('tw:text-[13px] tw:font-bold', credit ? 'tw:text-red-500' : 'tw:text-emerald-500')}>₹ {opening.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span className={cn('tw:rounded-sm tw:px-1 tw:py-0.5 tw:text-[10px] tw:font-bold', credit ? 'tw:bg-red-100 tw:text-red-700' : 'tw:bg-emerald-100 tw:text-emerald-700')}>{node.balanceType}</span>
          </div>
        )}
        {!searchQuery && <RowActions kind={node.type} node={node} chart={chart} className={SHOW_ON_HOVER} />}
      </TreeRow>
      {isGroup && expanded && node.children?.length > 0 && (
        <TreeChildren className="tw:ml-[17px]">
          {node.children.map((child) => <AccountNode key={child.type + child.id} node={child} level={level + 1} chart={chart} />)}
        </TreeChildren>
      )}
    </div>
  );
}

export function AccountTree({ chart }) {
  const nodes = chart.filteredTreeData;
  return (
    <div className={TREE_PANEL}>
      {nodes.map((node) => <AccountNode key={node.type + node.id} node={node} level={0} chart={chart} />)}
      {nodes.length === 0 && <div className="tw:p-5 tw:text-center tw:text-slate-400">No results found</div>}
    </div>
  );
}

function CentreNode({ node, level, chart }) {
  const { searchQuery, expandedKeys, toggleExpand, masterData } = chart;
  const key = 'cc' + node.id;
  const expanded = searchQuery ? true : expandedKeys.has(key);
  const hasChildren = node.children?.length > 0;
  const category = masterData.costCategories.find((entry) => String(entry.id) === String(node.categoryId));
  return (
    <div className="tw:relative">
      <TreeRow level={level}>
        <ExpandToggle canExpand={hasChildren} expanded={expanded} onToggle={(event) => toggleExpand(key, event)} />
        <Target className="tw:size-4 tw:shrink-0 tw:text-blue-500" />
        <div className="tw:text-sm tw:font-medium tw:text-foreground">{node.name}</div>
        <div className="tw:ml-3 tw:text-[11px] tw:text-slate-400">[Cat: {category?.name || node.categoryId}]</div>
        {!searchQuery && <RowActions kind="centre" node={node} chart={chart} className={SHOW_ON_HOVER} />}
      </TreeRow>
      {hasChildren && expanded && (
        <TreeChildren className="tw:ml-[7px]">
          {node.children.map((child) => <CentreNode key={child.id} node={child} level={level + 1} chart={chart} />)}
        </TreeChildren>
      )}
    </div>
  );
}

export function CentreTree({ chart }) {
  return (
    <div className={TREE_PANEL}>
      {chart.filteredCentres.map((node) => <CentreNode key={node.id} node={node} level={0} chart={chart} />)}
    </div>
  );
}

const TABLE_HEAD = 'tw:px-5 tw:py-4 tw:text-[13px] tw:tracking-wider tw:uppercase';
const TABLE_CELL = 'tw:px-5 tw:py-4 tw:text-sm';
const actionColumn = (kind, chart) => ({
  key: 'actions', header: 'Actions', align: 'right', className: TABLE_CELL,
  cell: (row) => <RowActions kind={kind} node={row} chart={chart} className={SHOW_ON_HOVER} />,
});

function MasterTable({ columns, rows }) {
  return (
    <div className={cn(PANEL, 'tw:overflow-hidden')}>
      <DataTable columns={columns.map((column) => ({ ...column, header: <span className={TABLE_HEAD}>{column.header}</span> }))} rows={rows} rowClassName={() => 'tw:group'} emptyText="No results found" />
    </div>
  );
}

export function VoucherTypesTable({ chart }) {
  const rows = chart.masterData.voucherTypes.filter((voucherType) => matches(voucherType.name, chart.searchQuery));
  return (
    <MasterTable
      rows={rows}
      columns={[
        {
          key: 'name', header: 'Voucher Name', className: TABLE_CELL,
          cell: (voucherType) => (
            <div className="tw:flex tw:items-center tw:gap-2">
              <div className="tw:flex tw:size-8 tw:items-center tw:justify-center tw:rounded-md tw:bg-muted"><Receipt className="tw:size-4 tw:text-muted-foreground" /></div>
              <span className="tw:font-semibold tw:text-foreground">{voucherType.name}</span>
            </div>
          ),
        },
        {
          key: 'origin', header: 'Origin', className: TABLE_CELL,
          cell: (voucherType) => (voucherType.isBuiltIn
            ? <span className={cn(SYSTEM_BADGE, 'tw:px-2.5 tw:py-1 tw:text-[11px]')}><ShieldCheck className="tw:size-3" /> SYSTEM</span>
            : <span className="tw:inline-flex tw:items-center tw:rounded-xl tw:bg-muted tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-bold tw:text-muted-foreground">CUSTOM</span>),
        },
        { key: 'baseType', header: 'Base Type', className: cn(TABLE_CELL, 'tw:text-foreground/75') },
        {
          key: 'numberingMethod', header: 'Numbering', className: TABLE_CELL,
          cell: (voucherType) => (
            <span className={cn('tw:rounded-md tw:px-2.5 tw:py-1 tw:text-entry tw:font-semibold', voucherType.numberingMethod === 'Automatic' ? 'tw:bg-green-100 tw:text-green-800' : 'tw:bg-muted tw:text-foreground/75')}>
              {voucherType.numberingMethod}
            </span>
          ),
        },
        actionColumn('voucher', chart),
      ]}
    />
  );
}

export function TdsNaturesTable({ chart }) {
  const rows = chart.masterData.tdsNatures.filter((nature) => matches(nature.name, chart.searchQuery));
  return (
    <MasterTable
      rows={rows}
      columns={[
        { key: 'name', header: 'Nature of Payment', className: cn(TABLE_CELL, 'tw:font-semibold') },
        { key: 'section', header: 'Section', className: TABLE_CELL, cell: (nature) => <span className="tw:rounded-md tw:bg-indigo-100 tw:px-2.5 tw:py-1 tw:text-entry tw:font-semibold tw:text-indigo-700">Sec {nature.section}</span> },
        { key: 'rate', header: 'Rate', align: 'right', className: cn(TABLE_CELL, 'tw:font-bold tw:text-emerald-500'), cell: (nature) => `${nature.rate}%` },
        { key: 'exemptionLimit', header: 'Exemption Limit', align: 'right', className: cn(TABLE_CELL, 'tw:text-foreground/75'), cell: (nature) => `₹ ${nature.exemptionLimit}` },
        actionColumn('tds', chart),
      ]}
    />
  );
}

const MASTER_CARD = cn(PANEL, 'tw:group tw:relative tw:p-5');

export function CategoryCards({ chart }) {
  const categories = chart.masterData.costCategories.filter((category) => matches(category.name, chart.searchQuery));
  return (
    <div className={CARD_GRID}>
      {categories.map((category) => (
        <div key={category.id} className={MASTER_CARD}>
          <div className="tw:mb-4 tw:flex tw:items-start tw:justify-between">
            <div className="tw:flex tw:gap-3">
              <div className="tw:flex tw:size-10 tw:items-center tw:justify-center tw:rounded-lg tw:bg-red-50"><Tags className="tw:size-5 tw:text-red-500" /></div>
              <div>
                <h4 className="tw:m-0 tw:mb-1 tw:text-base tw:font-bold tw:text-foreground">{category.name}</h4>
                {category.isBuiltIn && <span className={cn(SYSTEM_BADGE, 'tw:px-1.5 tw:py-0.5 tw:text-[10px]')}><ShieldCheck className="tw:size-3" /> SYSTEM</span>}
              </div>
            </div>
            <RowActions kind="category" node={category} chart={chart} className={SHOW_ON_HOVER} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CurrencyCards({ chart }) {
  const currencies = chart.masterData.currencies.filter((currency) => matches(currency.formalName, chart.searchQuery));
  return (
    <div className={CARD_GRID}>
      {currencies.map((currency) => (
        <div key={currency.id} className={MASTER_CARD}>
          <RowActions kind="currency" node={currency} chart={chart} className={cn('tw:absolute tw:top-4 tw:right-4', SHOW_ON_HOVER)} />
          <div className="tw:mb-4 tw:flex tw:items-center tw:gap-4">
            <div className="tw:flex tw:size-12 tw:items-center tw:justify-center tw:rounded-full tw:bg-amber-100 tw:text-2xl tw:font-bold tw:text-amber-600">{currency.symbol}</div>
            <h4 className="tw:m-0 tw:mb-1 tw:text-lg tw:font-bold tw:text-foreground">{currency.formalName}</h4>
          </div>
        </div>
      ))}
    </div>
  );
}
