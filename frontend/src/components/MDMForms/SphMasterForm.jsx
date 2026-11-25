import { useState } from 'react';
import { Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, Checkbox, Field, Input, SelectBox, StatCard } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { activeColumn, isActiveRecord, masterActionsColumn } from './masterKit/masterColumns';
import { useMasterRecords } from './masterKit/useMasterRecords';

const ALL_CATEGORIES = 'ALL';
const CATEGORIES = ['LIVE CARGO', 'TEMPERATURE SENSITIVE', 'HAZARDOUS', 'PERISHABLE', 'PHARMACEUTICAL', 'HIGH VALUE', 'BATTERY', 'MEDICAL', 'FINANCIAL', 'COURIER', 'SPECIAL', 'ROUTING', 'DIMENSIONS', 'OTHER'];
const CATEGORY_FILTERS = [ALL_CATEGORIES, ...CATEGORIES];
const EMPTY_SPH = { id: '', code: '', description: '', category: '', isActive: true };
const SEARCH_FIELDS = ['code', 'description'];

const validateSph = (sph) => {
  if (!sph.code || !sph.description) return 'Code and Description are mandatory!';
  if (!/^[A-Za-z]{3}$/.test(String(sph.code).trim())) return 'SPH code must be 3 letters (e.g. PER, DGR)';
  return '';
};

const sphBody = (sph) => ({
  code: String(sph.code).trim().toUpperCase(),
  description: String(sph.description).trim(),
  category: sph.category || '',
  isActive: sph.isActive !== false,
});

const LIST = {
  title: 'Search SPH',
  searchPlaceholder: 'Search code or description...',
  primaryText: (sph) => sph.code,
  secondaryText: (sph) => sph.description,
};

export default function SphMasterForm() {
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const master = useMasterRecords({
    resource: 'sph-master',
    emptyRecord: EMPTY_SPH,
    searchFields: SEARCH_FIELDS,
    validate: validateSph,
    describe: (sph) => `SPH code ${sph.code || ''}`,
    prepareSave: sphBody,
  });
  const { form, setField, records } = master;

  const saveSph = async () => {
    const wasEditing = Boolean(form.id);
    if (await master.save()) toast.success(wasEditing ? 'SPH Code updated successfully!' : 'SPH Code added successfully!');
  };

  const shown = master.filtered.filter((sph) => category === ALL_CATEGORIES || sph.category === category);
  const activeCount = records.filter(isActiveRecord).length;

  const columns = [
    { key: 'code', header: 'Code', cell: (sph) => <Badge variant="info" className="tw:font-mono tw:text-[12px]">{sph.code}</Badge> },
    { key: 'description', header: 'Description', className: 'tw:font-medium' },
    { key: 'category', header: 'Category', cell: (sph) => (sph.category ? <Badge variant="warning">{sph.category}</Badge> : <span className="tw:text-muted-foreground">—</span>) },
    activeColumn,
    masterActionsColumn({ onEdit: master.editRecord, onSwitch: master.switchActive }),
  ];

  return (
    <div className="tw:flex tw:flex-col tw:gap-4 tw:lg:h-full tw:lg:min-h-0">
      <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-end">
        <div className="tw:grid tw:grid-cols-3 tw:gap-3 tw:md:w-[420px]">
          <StatCard label="Total codes" value={records.length} tone="primary" />
          <StatCard label="Active" value={activeCount} tone="success" />
          <StatCard label="Inactive" value={records.length - activeCount} tone="danger" />
        </div>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:md:ml-auto">
          <Field label="Category" className="tw:md:w-[260px]">
            <SelectBox options={CATEGORY_FILTERS} value={category} onValueChange={setCategory} />
          </Field>
          <Badge variant="info">{shown.length} result{shown.length !== 1 ? 's' : ''}</Badge>
        </div>
      </div>

      <MasterPage master={{ ...master, filtered: shown, save: saveSph }} list={LIST} icon={Tag} className="tw:lg:h-auto tw:lg:flex-1"
        formTitle={form.id ? `Editing: ${form.code}` : 'Add new SPH code'} columns={columns} emptyText="No SPH codes found">
        <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-4 tw:md:grid-cols-[1fr_2fr_1.5fr_auto]">
          <Field label="Code" required layout="col" note="3–4 letters, e.g. AVI">
            <Input required maxLength={4} placeholder="E.G. AVI" data-allow-text="" className="tw:font-mono tw:font-extrabold tw:tracking-[1px] tw:uppercase"
              value={form.code} onChange={(event) => setField('code')(event.target.value.toUpperCase())} />
          </Field>
          <Field label="Description" required layout="col">
            <Input required placeholder="E.G. LIVE ANIMALS" data-allow-text="" className="tw:uppercase"
              value={form.description} onChange={(event) => setField('description')(event.target.value.toUpperCase())} />
          </Field>
          <Field label="Category" layout="col">
            <SelectBox options={CATEGORIES} value={form.category} onValueChange={setField('category')} placeholder="SELECT CATEGORY" clearable clearLabel="SELECT CATEGORY" />
          </Field>
          <Field label="Active (visible in dropdowns)" className="tw:pb-1">
            <Checkbox checked={form.isActive !== false} onCheckedChange={(checked) => setField('isActive')(checked === true)} />
          </Field>
        </div>
      </MasterPage>
    </div>
  );
}
