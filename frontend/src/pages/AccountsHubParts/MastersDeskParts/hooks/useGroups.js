import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { askConfirm } from '@/components/common/askConfirm';
import { lookup } from '../../ui';
import { accountsApi } from '../../accountsApi';
import { groupPath } from '../mastersData';

const GROUP_LEDGER_LIMIT = 500;

// the chart of accounts tree and the group form beside it
export default function useGroups() {
  const [groups, setGroups] = useState([]);
  const [open, setOpen] = useState({});
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', parentId: '', nature: 'Assets' });
  const [ledgers, setLedgers] = useState([]);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const tree = await accountsApi.mastersGroupsTree();
      setGroups(tree);
      // the primary groups start open
      setOpen((old) => (Object.keys(old).length ? old : Object.fromEntries(tree.filter((group) => !group.parentId).map((group) => [group.id, true]))));
    } catch (error) {
      setMsg('Not loaded: ' + errorMessage(error));
    }
  };
  useEffect(() => { load(); }, []);

  const byId = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const childrenOf = (id) => groups.filter((group) => (group.parentId || null) === id);
  const pathOf = (group) => groupPath(group, byId);
  const search = query.trim().toLowerCase();
  const matches = (group) => !search || group.name.toLowerCase().includes(search) || childrenOf(group.id).some(matches);
  const toggleOpen = (id) => setOpen((old) => ({ ...old, [id]: !old[id] }));
  const expandAll = () => setOpen(Object.fromEntries(groups.map((group) => [group.id, true])));
  const collapseAll = () => setOpen({});

  const pick = async (group) => {
    setSelected(group); setMsg('');
    setForm({ id: group.id, name: group.name, parentId: group.parentId || '', nature: group.nature });
    try { setLedgers((await accountsApi.mastersLedgers({ groupId: group.id, limit: GROUP_LEDGER_LIMIT })).rows || []); } catch { setLedgers([]); }
  };
  const clear = (parentId = '') => {
    setSelected(null); setLedgers([]); setMsg('');
    const parent = byId.get(Number(parentId));
    setForm({ name: '', parentId, nature: parent ? parent.nature : 'Assets' });
  };
  const changeParent = (parentId) => {
    const parent = byId.get(Number(parentId));
    setForm((old) => ({ ...old, parentId, nature: parent ? parent.nature : old.nature }));
  };

  const save = async () => {
    setMsg('');
    if (!form.name.trim()) { setMsg('Enter the group name'); return; }
    try {
      if (form.id) await accountsApi.mastersUpdateGroup(form.id, form); else await accountsApi.mastersCreateGroup(form);
      setMsg(form.id ? 'Updated' : 'Saved');
      lookup('groups', true); lookup('ledgers', true);
      await load();
      if (!form.id) clear(form.parentId);
    } catch (error) {
      setMsg('Not saved: ' + errorMessage(error));
    }
  };
  const remove = async () => {
    if (!form.id) return;
    if (!(await askConfirm({ title: 'Delete group', message: 'Delete group "' + form.name + '"?', okLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await accountsApi.mastersDeleteGroup(form.id);
      setMsg('Deleted'); lookup('groups', true);
      await load();
      clear();
    } catch (error) {
      setMsg('Not deleted: ' + errorMessage(error));
    }
  };

  return { groups, open, query, setQuery, selected, form, setForm, ledgers, msg, byId, childrenOf, pathOf, matches, search, toggleOpen, expandAll, collapseAll, pick, clear, changeParent, save, remove };
}
