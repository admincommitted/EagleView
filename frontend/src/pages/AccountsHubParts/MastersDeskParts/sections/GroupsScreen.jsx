import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Download, Pencil, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Input, SelectBox } from '@/components/ui';
import { ActionBar, Box, Empty, Grid, Money, inr } from '../../ui';
import { NATURES, downloadCsvFile } from '../mastersData';
import useGroups from '../hooks/useGroups';
import { FormField, GRID_3, ListPanel, Stat, TWO_PANE, listRowClass } from './masterParts';

const INDENT_PX = 16;
const BASE_INDENT_PX = 8;

function GroupNode({ group, depth, tree }) {
  if (!tree.matches(group)) return null;
  const children = tree.childrenOf(group.id);
  const isOpen = tree.open[group.id] || !!tree.search;
  const on = tree.selected && tree.selected.id === group.id;
  return (
    <>
      <div onClick={() => tree.pick(group)} style={{ '--indent': BASE_INDENT_PX + depth * INDENT_PX + 'px' }}
        className={cn(listRowClass(on), 'tw:flex tw:items-center tw:gap-1 tw:py-1.5 tw:pl-(--indent)')}>
        <span onClick={(event) => { event.stopPropagation(); tree.toggleOpen(group.id); }} className="tw:inline-flex tw:w-3.5 tw:text-muted-foreground">
          {children.length ? (isOpen ? <ChevronDown className="tw:size-3" /> : <ChevronRight className="tw:size-3" />) : null}
        </span>
        <span className={cn('tw:flex-1 tw:truncate tw:text-[11.5px]', depth ? 'tw:font-semibold tw:text-foreground' : 'tw:font-extrabold tw:text-head')}>{group.name}</span>
        {group.ledgers > 0 && <span className="tw:text-[9.5px] tw:text-muted-foreground">{group.ledgers}</span>}
      </div>
      {isOpen && children.map((child) => <GroupNode key={child.id} group={child} depth={depth + 1} tree={tree} />)}
    </>
  );
}

function GroupForm({ tree }) {
  const { form, setForm, selected, groups, pathOf } = tree;
  const builtIn = selected && selected.isBuiltIn;
  const parentOptions = groups.filter((group) => !form.id || group.id !== form.id).map((group) => ({ value: group.id, label: pathOf(group) }));
  const balance = selected && selected.balance;
  return (
    <Box title={form.id ? 'Group - ' + form.name : 'New group'} right={builtIn ? <Badge variant="info">Built-in</Badge> : null} className="tw:bg-card">
      <div className={GRID_3}>
        <FormField label="Group Name" required><Input data-allow-text required={!form.name} value={form.name} onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))} autoFocus /></FormField>
        <FormField label="Under Group" hint="Leave blank for a primary group">
          <SelectBox value={form.parentId || ''} disabled={builtIn} onValueChange={tree.changeParent} options={parentOptions} placeholder="Primary (no parent)" clearable clearLabel="Primary (no parent)" />
        </FormField>
        <FormField label="Nature" hint={form.parentId ? 'Same as the under group' : ' '}>
          <SelectBox disabled={!!form.parentId} value={form.nature} onValueChange={(value) => setForm((old) => ({ ...old, nature: value }))} options={NATURES} />
        </FormField>
      </div>
      {selected && (
        <div className="tw:mt-3.5 tw:grid tw:grid-cols-2 tw:gap-3 tw:border-t tw:border-border tw:pt-3 tw:lg:grid-cols-4">
          <Stat label="Path">{pathOf(selected)}</Stat>
          <Stat label="Sub-groups">{selected.subGroups}</Stat>
          <Stat label="Ledgers (incl. sub-groups)">{selected.ledgers}</Stat>
          <Stat label="Closing balance">
            <span className={!balance ? 'tw:text-foreground' : balance < 0 ? 'tw:text-success' : 'tw:text-destructive'}>{inr(Math.abs(balance))}{balance ? (balance < 0 ? ' Cr' : ' Dr') : ''}</span>
          </Stat>
        </div>
      )}
    </Box>
  );
}

const ledgerColumns = [
  { label: 'Ledger', render: (ledger) => <b>{ledger.name}</b> },
  { label: 'Group', render: (ledger) => ledger.groupName },
  { label: 'GSTIN', render: (ledger) => ledger.gstin || '' },
  { label: 'Balance', right: true, render: (ledger) => <Money v={ledger.balance} side={ledger.balance ? ledger.side : null} /> },
  { label: '', render: (ledger) => (ledger.balance ? ledger.side : '') },
];

// tree on the left (balance and ledgers of each group), group form + its ledgers on the right
export function GroupsScreen() {
  const navigate = useNavigate();
  const tree = useGroups();
  const { groups, form, selected, ledgers, msg } = tree;
  const roots = NATURES.map((nature) => ({ nature, list: groups.filter((group) => !group.parentId && group.nature === nature) }));
  const exportLedgers = () => downloadCsvFile('Ledgers_' + selected.name, [['name', 'Ledger'], ['groupName', 'Group'], ['gstin', 'GSTIN'], [(row) => inr(row.balance) + ' ' + row.side, 'Balance']], ledgers);

  return (
    <div className={TWO_PANE}>
      <ListPanel title="Chart of accounts" count={groups.length + ' groups'} search={tree.query} onSearch={tree.setQuery} placeholder="Search group"
        tools={<div className="tw:flex tw:gap-1.5"><Button variant="ghost" onClick={tree.expandAll}>Expand all</Button><Button variant="ghost" onClick={tree.collapseAll}>Collapse</Button></div>}>
        {roots.map(({ nature, list }) => list.length > 0 && (
          <div key={nature}>
            <div className="tw:border-b tw:border-border tw:bg-muted tw:px-2.5 tw:py-1.5 tw:text-[10px] tw:font-extrabold tw:text-muted-foreground tw:uppercase">{nature}</div>
            {list.map((group) => <GroupNode key={group.id} group={group} depth={0} tree={tree} />)}
          </div>
        ))}
      </ListPanel>

      <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2.5">
        <GroupForm tree={tree} />
        <ActionBar note={msg}>
          <Button variant="success" size="lg" onClick={tree.save} disabled={!!form.id}><Save /> Save</Button>
          <Button variant="success" size="lg" onClick={tree.save} disabled={!form.id}><Pencil /> Modify</Button>
          <Button variant="destructive" size="lg" onClick={tree.remove} disabled={!form.id || (selected && selected.isBuiltIn)}><Trash2 /> Delete</Button>
          <Button size="lg" onClick={() => tree.clear()}><RotateCcw /> Clear</Button>
          {selected && <Button variant="secondary" size="lg" onClick={() => tree.clear(String(selected.id))}><Plus /> Add sub-group</Button>}
          {selected && <Button variant="secondary" size="lg" onClick={() => navigate('/accounts-hub?item=ledgers&group=' + selected.id)}><Plus /> Add ledger here</Button>}
        </ActionBar>
        {selected && (
          <Grid title={'Ledgers under ' + selected.name + ' (' + ledgers.length + ')'} maxHeight="calc(100vh - 470px)" rows={ledgers} rowKey={(ledger) => ledger.id}
            onRow={(ledger) => navigate('/accounts-hub?item=ledgers&ledger=' + ledger.id)} empty="No ledgers in this group" cols={ledgerColumns}
            right={ledgers.length > 0 && <Button variant="ghost" onClick={exportLedgers}><Download /> Excel</Button>} />
        )}
        {!selected && <Empty title="Pick a group on the left to see or change it">Or fill the form above to add a new group.</Empty>}
      </div>
    </div>
  );
}
