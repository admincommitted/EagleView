import { Fragment } from 'react';
import { Layers, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Checkbox, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { ACTIONS, ACTION_HEADERS, anyRight, hasForms } from '../userFormData';

// partial = some of the rights below it are on
function TriStateCheckbox({ checked, partial, onChange, title }) {
  return (
    <Checkbox title={title} checked={checked ? true : partial ? 'indeterminate' : false} onCheckedChange={(value) => onChange(value === true)}
      className="tw:data-[state=indeterminate]:border-primary tw:data-[state=indeterminate]:bg-primary/40 tw:data-[state=indeterminate]:text-primary-foreground" />
  );
}

const CHECK_CELL = 'tw:w-[70px] tw:text-center';

function PermissionStatus({ ctx }) {
  const { formData, selectedUser, savedRows, permCount, moduleTotal } = ctx;
  if (formData.role === 'admin') return <Badge variant="warning">Admin: every module is allowed, this grid is not checked</Badge>;
  if (selectedUser && savedRows === 0 && permCount === 0) return <Badge variant="warning">No restrictions set: this user can open everything until you tick rights here</Badge>;
  return (
    <Badge variant={permCount ? 'info' : 'danger'}>
      {permCount} of {moduleTotal} modules allowed{permCount ? '' : ' - the user will not be able to open any module'}
    </Badge>
  );
}

function ModuleRows({ module, ctx }) {
  const { permissions, openModules, toggleOpen, moduleAllOn, moduleAnyOn, moduleFieldOn, moduleFieldAny, handleModuleAll, handleModuleField, handlePermChange, leafAllOn, handleLeafAll } = ctx;
  const withForms = hasForms(module);
  const open = withForms && !!openModules[module.key];
  const formsOn = withForms ? module.forms.filter((form) => anyRight(permissions[form.key])).length : 0;
  return (
    <>
      <TableRow>
        <TableCell className="tw:pl-6 tw:whitespace-normal">
          <div className="tw:flex tw:items-center tw:gap-1.5">
            {withForms
              ? <Button size="icon-sm" className="tw:size-4" onClick={() => toggleOpen(module.key)} title={open ? 'Hide forms' : 'Show forms'}>{open ? <Minus className="tw:size-2.5" /> : <Plus className="tw:size-2.5" />}</Button>
              : <span className="tw:inline-block tw:w-4" />}
            <div>
              <div className="tw:font-semibold">
                {module.key}
                {withForms && <span className={cn('tw:ml-1.5 tw:text-[10px] tw:font-medium', formsOn ? 'tw:text-primary' : 'tw:text-muted-foreground')}>{formsOn}/{module.forms.length} forms</span>}
              </div>
              {module.label && module.label !== module.key && <div className="tw:text-[10px] tw:text-muted-foreground">{module.label}</div>}
            </div>
          </div>
        </TableCell>
        <TableCell className={CHECK_CELL}>
          <TriStateCheckbox title={withForms ? 'All rights on every form of this module' : 'All rights of this module'} checked={moduleAllOn(module)} partial={moduleAnyOn(module)}
            onChange={(checked) => handleModuleAll(module, checked)} />
        </TableCell>
        {ACTIONS.map((action) => (
          <TableCell key={action} className={CHECK_CELL}>
            {withForms
              ? <TriStateCheckbox title={`${action.slice(3)} on every form of ${module.key}`} checked={moduleFieldOn(module, action)} partial={moduleFieldAny(module, action)}
                onChange={(checked) => handleModuleField(module, action, checked)} />
              : <Checkbox checked={Boolean(permissions[module.key]?.[action])} onCheckedChange={(checked) => handlePermChange(module.key, action, checked === true)} />}
          </TableCell>
        ))}
      </TableRow>
      {open && module.forms.map((form) => (
        <TableRow key={form.key} className="tw:border-dashed tw:bg-page">
          <TableCell className="tw:pl-[52px] tw:text-muted-foreground tw:whitespace-normal">
            <span className="tw:mr-1.5 tw:text-muted-foreground/60">└</span>{form.label || form.key}
          </TableCell>
          <TableCell className={CHECK_CELL}>
            <Checkbox title="All rights of this form" checked={leafAllOn(form.key)} onCheckedChange={(checked) => handleLeafAll(form.key, checked === true)} />
          </TableCell>
          {ACTIONS.map((action) => (
            <TableCell key={action} className={CHECK_CELL}>
              <Checkbox checked={Boolean(permissions[form.key]?.[action])} onCheckedChange={(checked) => handlePermChange(form.key, action, checked === true)} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export default function PermissionsSection({ ctx }) {
  const { catalog, loadCatalog, anyModuleOpen, toggleAllForms, allOn, handleSelectAll, columnAllOn, handleColumnSelectAll, groupAllOn, groupAnyOn, handleGroupAll } = ctx;
  return (
    <section className="tw:flex tw:flex-col tw:gap-1.5">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border tw:pb-px">
        <h4 className="tw:m-0 tw:flex tw:items-center tw:gap-1.5 tw:text-entry tw:font-semibold tw:normal-case tw:text-head">
          <Layers className="tw:size-3.5" /> Module-wise Permissions
        </h4>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <PermissionStatus ctx={ctx} />
          <Button size="sm" onClick={toggleAllForms}>{anyModuleOpen ? 'Collapse forms' : 'Expand all forms'}</Button>
          <label className="tw:m-0 tw:flex tw:cursor-pointer tw:items-center tw:gap-1 tw:rounded-sm tw:border tw:border-input tw:bg-secondary tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-semibold">
            <Checkbox checked={allOn} onCheckedChange={(checked) => handleSelectAll(checked === true)} /> Grant All
          </label>
        </div>
      </div>

      {!catalog.loaded && (
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5 tw:rounded tw:border tw:border-destructive/30 tw:bg-destructive/5 tw:px-3 tw:py-2 tw:text-[11px] tw:text-destructive">
          <span className="tw:font-bold">Module list not loaded from the server{catalog.error ? ` (${catalog.error})` : ''}.</span>
          <span>Showing a basic list only - restart the backend, then retry before saving rights.</span>
          <Button variant="destructive" size="sm" className="tw:ml-auto" onClick={loadCatalog}>Retry</Button>
        </div>
      )}

      <Table containerClassName="tw:rounded tw:border tw:border-input">
        <TableHeader sticky>
          <TableRow className="tw:hover:bg-transparent">
            <TableHead>MODULE NAME</TableHead>
            <TableHead className="tw:w-[56px] tw:text-center" title="All four rights of the module">ALL</TableHead>
            {ACTION_HEADERS.map(({ field, label }) => (
              <TableHead key={field} className={CHECK_CELL}>
                <div className="tw:flex tw:flex-col tw:items-center tw:gap-0.5">
                  <span className="tw:text-[10px]">{label}</span>
                  <Checkbox title={`${label} on every module`} checked={columnAllOn(field)} onCheckedChange={(checked) => handleColumnSelectAll(field, checked === true)} className="tw:border-white/80" />
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {catalog.groups.map((group) => (
            <Fragment key={group.name}>
              <TableRow className="tw:bg-secondary tw:even:bg-secondary tw:hover:bg-secondary">
                <TableCell className="tw:font-bold">
                  {group.name} <span className="tw:text-[10px] tw:font-medium tw:text-muted-foreground">({group.modules.length})</span>
                </TableCell>
                <TableCell className="tw:text-center">
                  <TriStateCheckbox title={`Whole ${group.name} group: all rights`} checked={groupAllOn(group)} partial={groupAnyOn(group)} onChange={(checked) => handleGroupAll(group, checked)} />
                </TableCell>
                <TableCell colSpan={4} />
              </TableRow>
              {group.modules.map((module) => <ModuleRows key={module.key} module={module} ctx={ctx} />)}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
