import { CheckCircle, Edit3, RefreshCcw, Trash2 } from 'lucide-react';
import { Badge, Button, Card, DataTable, SelectBox } from '@/components/ui';
import { previewNumber } from './documentSeries';

const ruleColumns = (onEdit, onDelete) => [
  { key: 'docType', header: 'Document Type', className: 'tw:font-semibold' },
  {
    key: 'scope',
    header: 'Applicability (Branch / Dept)',
    cell: (rule) => (
      <span className="tw:flex tw:gap-1.5">
        <Badge variant="neutral" className="tw:rounded-sm">{rule.branchCode}</Badge>
        <Badge variant="info" className="tw:rounded-sm">{rule.dept}</Badge>
      </span>
    ),
  },
  { key: 'fyCode', header: 'F.Y.' },
  {
    key: 'format',
    header: 'Format Definition',
    className: 'tw:font-mono tw:text-primary',
    cell: (rule) => <>{rule.format}<br />Pad: {rule.pad}</>,
  },
  { key: 'nextNumber', header: 'Next Number', className: 'tw:font-bold' },
  { key: 'example', header: 'Next Document No.', className: 'tw:font-bold tw:text-success', cell: (rule) => rule.example || previewNumber(rule, rule.nextNumber) },
  {
    key: 'isActive',
    header: 'Status',
    align: 'center',
    cell: (rule) => (
      <span title={rule.isActive ? 'Active' : 'Inactive'} className="tw:inline-flex">
        {rule.isActive ? <CheckCircle className="tw:size-4 tw:text-success" /> : <RefreshCcw className="tw:size-4 tw:text-muted-foreground" />}
      </span>
    ),
  },
  {
    key: 'actions',
    header: 'Actions',
    align: 'center',
    cell: (rule) => (
      <span className="tw:inline-flex tw:gap-1">
        <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => onEdit(rule)}><Edit3 /></Button>
        <Button variant="ghost" size="icon-sm" title="Delete" className="tw:text-destructive" onClick={() => onDelete(rule)}><Trash2 /></Button>
      </span>
    ),
  },
];

export default function SeriesRulesTable({ rules, branches, branchFilter, onBranchFilterChange, onEdit, onDelete }) {
  const filterOptions = [{ value: 'ALL', label: 'ALL (any branch)' }, ...branches.map((branch) => ({ value: branch.branchCode, label: branch.branchCode }))];

  return (
    <Card className="tw:overflow-hidden">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border tw:bg-page tw:px-5 tw:py-4">
        <h3 className="tw:m-0 tw:text-[15px] tw:normal-case tw:text-foreground">Numbering Rules ({rules.length})</h3>
        <SelectBox className="tw:w-full tw:sm:w-44" value={branchFilter} onValueChange={onBranchFilterChange} options={filterOptions}
          clearable clearLabel="All branches" placeholder="All branches" />
      </div>
      <DataTable
        columns={ruleColumns(onEdit, onDelete)}
        rows={rules}
        emptyText={'No numbering rules yet - click "New Series Rule".'}
      />
    </Card>
  );
}
