import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { accountsApi } from '../../accountsApi';
import { Empty, Grid, Money, Sheet, inr } from '../../ui';
import { Notice } from '../../VoucherDeskParts/sections/Notice';
import { sumOf } from '../../VoucherDeskParts/amounts';
import { IbList } from './IbList';
import { IbRaise } from './IbRaise';

const TABS = [{ id: 'list', label: 'Transfers' }, { id: 'raise', label: 'Raise transfer' }, { id: 'bal', label: 'Branch balances' }];

const balanceMeaning = (account) => {
  if (Math.abs(account.net) < 0.01) return 'Settled';
  return account.net > 0 ? account.branch + ' owes the other branches' : 'Other branches owe ' + account.branch;
};

function IbBalances() {
  const [rows, setRows] = useState(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const load = async () => {
      try {
        setRows(await accountsApi.otherDeskIbBalances());
      } catch (error) {
        setMessage(errorMessage(error));
      }
    };
    load();
  }, []);
  if (message) return <Empty title="Could not load">{message}</Empty>;
  if (!rows) return <div className="tw:p-3 tw:text-entry tw:text-muted-foreground">Loading</div>;
  const total = sumOf(rows, (account) => account.net);
  const settled = Math.abs(total) < 0.01;
  return (
    <>
      <Grid title="Branch accounts" maxHeight={400} rows={rows} rowKey={(account) => account.id} empty="No branch accounts yet - they are made with the first transfer"
        cols={[
          { label: 'Account', render: (account) => <b>{account.name}</b> },
          { label: 'Balance', right: true, render: (account) => <Money v={Math.abs(account.net)} side={account.net >= 0 ? 'Dr' : 'Cr'} strong /> },
          { label: 'Meaning', wrap: true, render: balanceMeaning },
        ]} />
      <div className={settled ? 'tw:text-[11.5px] tw:font-bold tw:text-success' : 'tw:text-[11.5px] tw:font-bold tw:text-warning'}>
        {settled ? 'All branch accounts net to nil - every transfer has both sides.' : 'Branch accounts differ by ' + inr(Math.abs(total)) + ' - some transfers are still waiting to be accepted.'}
      </div>
    </>
  );
}

// Inter Branch (iCAFFE: Bank Transfer / Journal / Cash Transfer). The sending branch raises; the receiving branch accepts
// or returns. Backend: /accounts-hub/ib.
export function InterBranchScreen({ startTab = 'list' }) {
  const activeBranch = useWorkspaceStore((state) => state.activeBranch);
  // 'All branches' in the top bar = pick one on the form
  const myBranch = (activeBranch && !activeBranch.isAll && (activeBranch.branchCode || activeBranch.branch_code)) || '';
  const [tab, setTab] = useState(startTab === 'raise' ? 'raise' : 'list');
  const [branches, setBranches] = useState([]);
  const [listKey, setListKey] = useState(1);
  useEffect(() => {
    const load = async () => {
      try {
        setBranches(await accountsApi.otherDeskIbBranches());
      } catch {
        setBranches([]);
      }
    };
    load();
  }, []);
  const raised = () => {
    setListKey((key) => key + 1);
    setTab('list');
  };
  return (
    <Sheet tabs={TABS} tab={tab} onTab={setTab}>
      {branches.length === 1 && (
        <Notice className="tw:text-[11.5px] tw:font-bold">
          Only one branch ({branches.map((branch) => branch.code).join(', ')}) is set up. Add the other branches in Settings, Branch Master, to transfer between them.
        </Notice>
      )}
      {tab === 'raise' && <IbRaise branches={branches} myBranch={myBranch} onDone={raised} />}
      {tab === 'list' && <IbList key={listKey} myBranch={myBranch} />}
      {tab === 'bal' && <IbBalances />}
    </Sheet>
  );
}
