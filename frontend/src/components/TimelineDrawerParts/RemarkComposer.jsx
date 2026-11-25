import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button, ComboInput } from '@/components/ui';

// A text picked from the status list is sent as a STATUS; anything else is a plain remark.
export default function RemarkComposer({ statuses, disabled, isSaving, onAdd }) {
  const [remark, setRemark] = useState('');
  const text = remark.trim();
  const canAdd = !disabled && !isSaving && !!text;

  const add = async () => {
    if (!canAdd) return;
    const isStatus = statuses.some((status) => String(status).toUpperCase() === text.toUpperCase());
    if (await onAdd({ text, isStatus })) setRemark('');
  };

  const addOnEnter = (event) => {
    if (event.key !== 'Enter' || event.defaultPrevented) return;
    event.preventDefault();
    add();
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:border-t tw:border-border tw:bg-card tw:p-4">
      <ComboInput
        options={statuses}
        value={remark}
        onValueChange={setRemark}
        onKeyDown={addOnEnter}
        placeholder="Type status or remark..."
        disabled={disabled || isSaving}
        className="tw:flex-none"
        listClassName="tw:z-[1000000] tw:max-h-40"
      />
      <Button variant="default" size="lg" disabled={!canAdd} onClick={add}>
        <Send className="tw:size-4" /> Add Remark
      </Button>
    </div>
  );
}
