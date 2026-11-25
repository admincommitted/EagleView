// Account group form
import { groupOptions } from '../chartTabs';
import { SelectField, TextField } from '../formFields';

const NATURES = ['Assets', 'Liabilities', 'Income', 'Expenses'];

export default function GroupNameSection({ chart }) {
  const { activeTab, flatGroups, groupForm, setGroupForm } = chart;
  if (activeTab !== 'groups') return null;
  const set = (key) => (value) => setGroupForm((form) => ({ ...form, [key]: value }));
  // a sub group always has the nature of its parent
  const changeParent = (parentId) => {
    const parent = flatGroups.find((group) => group.id === parseInt(parentId));
    setGroupForm((form) => ({ ...form, parentId, nature: parent ? parent.nature : 'Assets' }));
  };
  return (
    <>
      <TextField label="Group Name" required value={groupForm.name} onChange={set('name')} placeholder="e.g. Indirect Expenses" />
      <SelectField label="Under (Parent Group)" value={groupForm.parentId} onChange={changeParent} options={groupOptions(flatGroups)} emptyLabel="-- Primary (Root) --" />
      <SelectField label="Nature" value={groupForm.nature} onChange={set('nature')} options={NATURES} disabled={Boolean(groupForm.parentId)} />
    </>
  );
}
