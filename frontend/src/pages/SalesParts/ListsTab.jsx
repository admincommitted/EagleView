// Sales > Lists: the pick lists used on customers and enquiries (industries, sources, competitors, lost reasons,
// departments, commodities). A value in use is switched off, not deleted.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { salesHubApi } from './salesApi';
import { Muted } from './salesWidgets';

const LIST_NAMES = {
  INDUSTRY: 'Industries', SOURCE: 'Lead sources', COMPETITOR: 'Competitors', LOST_REASON: 'Lost reasons', DEPARTMENT: 'Contact departments', COMMODITY: 'Commodities',
};

function LookupRow({ row, canManage, editing, onStartEdit, onEditText, onCancelEdit, onSave }) {
  return (
    <div className={cn('tw:flex tw:items-center tw:gap-1.5 tw:px-3 tw:py-0.5 tw:text-entry', !row.isActive && 'tw:opacity-50')}>
      {editing !== undefined ? (
        <Input
          autoFocus
          data-allow-text=""
          value={editing}
          onChange={(event) => onEditText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSave({ value: editing });
            if (event.key === 'Escape') onCancelEdit();
          }}
          onBlur={() => onSave({ value: editing })}
        />
      ) : (
        <span
          className={cn('tw:flex-1', canManage ? 'tw:cursor-text' : 'tw:cursor-default', !row.isActive && 'tw:line-through')}
          onClick={() => canManage && onStartEdit()}
          title={canManage ? 'Click to rename' : ''}
        >
          {row.value}
        </span>
      )}
      {canManage && editing === undefined && (
        <Button variant="ghost" size="sm" onClick={() => onSave({ isActive: !row.isActive })}>{row.isActive ? 'Switch off' : 'Switch on'}</Button>
      )}
    </div>
  );
}

function LookupList({ kind, rows, canManage, onChange }) {
  const [newValue, setNewValue] = useState('');
  const [edits, setEdits] = useState({});
  const setEdit = (id, text) => setEdits((current) => ({ ...current, [id]: text }));

  const add = async () => {
    try {
      await salesHubApi.addLookup(kind, newValue);
      setNewValue('');
      onChange();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const save = async (row, change) => {
    try {
      await salesHubApi.updateLookup(row.id, change);
      setEdit(row.id, undefined);
      onChange();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <Card className="tw:min-h-0">
      <CardHeader className="tw:justify-start tw:border-b tw:border-border tw:py-2">
        <CardTitle>{LIST_NAMES[kind] || kind}</CardTitle>
        <span className="tw:font-normal tw:text-muted-foreground">({rows.filter((row) => row.isActive).length})</span>
      </CardHeader>
      <CardContent className="tw:max-h-[320px] tw:gap-0 tw:overflow-auto tw:px-0 tw:py-1">
        {rows.length === 0 && <Muted className="tw:px-3 tw:py-1.5 tw:text-entry">Empty - add the first one below.</Muted>}
        {rows.map((row) => (
          <LookupRow
            key={row.id}
            row={row}
            canManage={canManage}
            editing={edits[row.id]}
            onStartEdit={() => setEdit(row.id, row.value)}
            onEditText={(text) => setEdit(row.id, text)}
            onCancelEdit={() => setEdit(row.id, undefined)}
            onSave={(change) => save(row, change)}
          />
        ))}
      </CardContent>
      {canManage && (
        <CardFooter className="tw:mt-auto tw:gap-1.5">
          <Input
            data-allow-text=""
            value={newValue}
            placeholder="New value"
            onChange={(event) => setNewValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && newValue.trim()) add(); }}
          />
          <Button disabled={!newValue.trim()} onClick={add}><Plus /> Add</Button>
        </CardFooter>
      )}
    </Card>
  );
}

export default function ListsTab({ meta, reloadMeta }) {
  const kinds = meta.lookupKinds || Object.keys(LIST_NAMES);
  return (
    <div>
      <Muted className="tw:mb-2.5 tw:text-entry">
        These lists fill the drop-downs on customers, contacts, lanes and (next) enquiries and quotations. Click a value to rename it; a value no longer used
        is switched off so old records keep it.
      </Muted>
      <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] tw:gap-2.5">
        {kinds.map((kind) => <LookupList key={kind} kind={kind} rows={(meta.lookups || {})[kind] || []} canManage={meta.canManage} onChange={reloadMeta} />)}
      </div>
    </div>
  );
}
