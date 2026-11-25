import { Edit2, Plus, Save, Trash2 } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { StatusBanner } from './Notices';
import { SettingsHeading } from './SettingsCard';

/** Edit and (when onDelete is given) Delete buttons of a grid row. */
export function RecordActions({ onEdit, onDelete }) {
  return (
    <div className="tw:flex tw:justify-end tw:gap-2">
      <Button size="icon" title="Edit" aria-label="Edit" onClick={onEdit}><Edit2 /></Button>
      {onDelete && <Button variant="destructive" size="icon" title="Delete" aria-label="Delete" onClick={onDelete}><Trash2 /></Button>}
    </div>
  );
}

/**
 * A settings master screen: heading with the Add button, the add / edit form when open, then the grid (children).
 *   records   - what useSettingsRecords returns
 *   form      - the form fields; formNote - shown left of Cancel / Save
 *   saveLabel - "BRANCH" gives SAVE BRANCH / UPDATE BRANCH
 */
export function RecordsPanel({ records, icon, title, description, addLabel, formTitle, form, formNote, saveLabel, children }) {
  return (
    <Card className="tw:min-h-[500px] tw:gap-5 tw:p-4 tw:md:p-6">
      {records.notice && <StatusBanner tone="success" icon={false}>✓ {records.notice.msg}</StatusBanner>}

      <SettingsHeading icon={icon} title={title} description={description}
        actions={!records.isAdding && <Button variant="default" size="lg" onClick={records.startAdd}><Plus /> {addLabel}</Button>} />

      {records.isAdding && (
        <div className="tw:flex tw:flex-col tw:gap-4 tw:rounded-lg tw:border tw:border-border tw:bg-page tw:p-4 tw:md:p-5">
          <h4 className="tw:m-0 tw:text-entry tw:font-bold tw:text-head">{formTitle}</h4>
          {form}
          <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-center tw:md:justify-between">
            <div className="tw:min-w-0">{formNote}</div>
            <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-3">
              <Button size="lg" onClick={records.cancel}>CANCEL</Button>
              <Button variant="default" size="lg" onClick={records.save}>
                <Save /> {records.editingId ? 'UPDATE' : 'SAVE'} {saveLabel}
              </Button>
            </div>
          </div>
        </div>
      )}

      {children}
    </Card>
  );
}
