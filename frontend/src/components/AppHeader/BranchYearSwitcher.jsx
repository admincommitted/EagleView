import { ChevronDown, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '@/store/workspaceStore';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui';

const branchCode = (branch) => branch.branchCode || branch.branch_code;
const branchName = (branch) => branch.branchName || branch.branch_name;
const branchLabel = (branch) => (branch.isAll ? 'All branches' : `${branchCode(branch)} - ${branchName(branch)}`);

const pickerClass = 'tw:h-7 tw:gap-1 tw:rounded-full tw:px-2 tw:text-[11px] tw:font-bold';

function OptionList({ title, options, activeId, emptyText, labelOf, onPick }) {
  return (
    <DropdownMenuContent align="start" className="tw:min-w-48 tw:normal-case">
      <DropdownMenuLabel className="tw:text-[10px] tw:font-extrabold tw:tracking-wider tw:text-muted-foreground tw:uppercase">{title}</DropdownMenuLabel>
      {options.length === 0
        ? <DropdownMenuItem disabled>{emptyText}</DropdownMenuItem>
        : (
          <DropdownMenuRadioGroup value={String(activeId ?? '')}>
            {options.map((option) => (
              <DropdownMenuRadioItem key={option.id} value={String(option.id)} title={option.title} onSelect={() => onPick(option)}>
                {labelOf(option)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
    </DropdownMenuContent>
  );
}

// compact: the branch code only (phone width)
export function BranchYearSwitcher({ compact = false, className }) {
  const { activeBranch, activeYear, branches, fys } = useWorkspaceStore(useShallow((state) => ({
    activeBranch: state.activeBranch, activeYear: state.activeYear, branches: state.branches, fys: state.years,
  })));
  const { chooseBranch: setActiveBranch, chooseYear: setActiveYear } = useWorkspaceStore.getState();

  const pickBranch = (branch) => {
    if (activeBranch?.id === branch.id) return;
    setActiveBranch(branch);
    toast.success(`Branch: ${branchLabel(branch)}`);
  };
  const pickYear = (year) => {
    if (activeYear?.id === year.id) return;
    setActiveYear(year);
    if (year.isClosed) toast(`Year ${year.code} is closed`, { icon: '🔒' });
    else toast.success(`Financial year: ${year.code}`);
  };

  const branchText = activeBranch
    ? (compact && !activeBranch.isAll ? branchCode(activeBranch) : branchLabel(activeBranch))
    : 'No branch';
  const years = fys.map((year) => ({
    ...year,
    title: `${year.name || year.code}: ${year.startDate} to ${year.endDate}${year.isClosed ? ' (closed)' : ''}`,
  }));

  return (
    <div className={cn('tw:flex tw:min-w-0 tw:items-center tw:gap-1 tw:rounded-full tw:bg-black/15 tw:px-1 tw:py-0.5', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="header" className={cn(pickerClass, 'tw:min-w-0 tw:shrink', compact && 'tw:max-w-24')} title="Branch">
            <span className="tw:truncate">{branchText}</span>
            <ChevronDown className="tw:size-3 tw:opacity-80" />
          </Button>
        </DropdownMenuTrigger>
        <OptionList title="Branch" options={branches} activeId={activeBranch?.id} emptyText="No branch"
          labelOf={(branch) => `${branchLabel(branch)}${branch.isDefault ? ' ★' : ''}`} onPick={pickBranch} />
      </DropdownMenu>

      <span className="tw:h-3.5 tw:w-px tw:bg-white/20" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="header" className={cn(pickerClass, 'tw:border-white/30 tw:font-semibold')} title="Financial year">
            {activeYear ? activeYear.code : 'No FY'}
            {activeYear?.isClosed && <Lock className="tw:size-3" />}
            <ChevronDown className="tw:size-3 tw:opacity-80" />
          </Button>
        </DropdownMenuTrigger>
        <OptionList title="Financial year" options={years} activeId={activeYear?.id} emptyText="No FY"
          labelOf={(year) => `${year.code}${year.isDefault ? ' ★' : ''}${year.isClosed ? ' 🔒' : ''}`} onPick={pickYear} />
      </DropdownMenu>
    </div>
  );
}
