import { useWorkspaceStore } from '@/store/workspaceStore';

const codeOf = (branch) => String(branch.branchCode || branch.branch_code || '').toUpperCase();

// Branch = the branch a voucher belongs to (the user's own branches from the top bar). It starts on the branch picked in
// the top bar; with "All branches" in the top bar it has to be chosen. The voucher no series, the branch reports and who
// may see / change the voucher all go by it.
export function useMyBranches() {
  const branches = useWorkspaceStore((state) => state.branches);
  const activeBranch = useWorkspaceStore((state) => state.activeBranch);
  const list = (branches || [])
    .filter((branch) => !branch.isAll && String(branch.status || 'Active') !== 'Inactive')
    .map((branch) => ({ code: codeOf(branch), name: branch.branchName || branch.branch_name || '' }));
  const mine = activeBranch && !activeBranch.isAll ? codeOf(activeBranch) : '';
  return { list, mine, all: !!activeBranch?.isAll };
}
