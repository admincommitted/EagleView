import { Plus, Trash2 } from 'lucide-react';
import { Button, ComboInput, DateInput, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { activeLookups } from '../salesFormat';
import { CheckLabel, FormField, FormSection, Muted } from '../salesWidgets';
import { FORM_GRID } from '../salesStyles';
import { isOn, NEW_CONTACT } from './customerModel';

const TEXT_FIELDS = [
  ['name', 'Name', { required: true }],
  ['designation', 'Designation'],
  ['department', 'Department', { lookup: 'DEPARTMENT' }],
  ['mobile', 'Mobile'],
  ['whatsapp', 'WhatsApp', { placeholder: 'if not the mobile' }],
  ['phone', 'Phone / ext'],
  ['email', 'E-mail'],
  ['birthday', 'Birthday', { date: true }],
  ['anniversary', 'Anniversary', { date: true }],
  ['linkedin', 'LinkedIn'],
  ['remarks', 'Remarks', { span: 2 }],
];

function ContactCard({ contact, departments, onChange, onMakePrimary, onRemove }) {
  const box = (field, options = {}) => {
    if (options.date) return <DateInput value={contact[field] || ''} onValueChange={(value) => onChange(field, value)} />;
    if (options.lookup) return <ComboInput options={departments} value={contact[field] || ''} onValueChange={(value) => onChange(field, value)} />;
    return <Input value={contact[field] || ''} placeholder={options.placeholder} onChange={(event) => onChange(field, event.target.value)} />;
  };
  return (
    <div className={cn('tw:mb-1.5 tw:rounded-md tw:border tw:border-border tw:p-2', isOn(contact.isActive) ? 'tw:bg-card' : 'tw:bg-muted')}>
      <div className={FORM_GRID.narrow}>
        {TEXT_FIELDS.map(([field, label, options = {}]) => (
          <FormField key={field} label={label} required={options.required} span={options.span}>{box(field, options)}</FormField>
        ))}
      </div>
      <div className="tw:mt-1.5 tw:flex tw:flex-wrap tw:items-center tw:gap-3.5">
        <CheckLabel checked={contact.isPrimary} onCheckedChange={onMakePrimary}>Primary</CheckLabel>
        <CheckLabel checked={contact.isDecisionMaker} onCheckedChange={(checked) => onChange('isDecisionMaker', checked)}>Decision maker</CheckLabel>
        <CheckLabel checked={isOn(contact.sendQuotes)} onCheckedChange={(checked) => onChange('sendQuotes', checked)}>Gets quotations</CheckLabel>
        <CheckLabel checked={isOn(contact.isActive)} onCheckedChange={(checked) => onChange('isActive', checked)}>Still there</CheckLabel>
        <Button variant="destructive" className="tw:ml-auto" onClick={onRemove}><Trash2 /> Remove</Button>
      </div>
    </div>
  );
}

export default function ContactsSection({ customer, meta, setRow, addRow, removeRow, makePrimary }) {
  const contacts = customer.contacts || [];
  const departments = activeLookups(meta, 'DEPARTMENT').map((lookup) => lookup.value);
  return (
    <FormSection
      title={`Contacts (${contacts.length})`}
      actions={<Button onClick={() => addRow('contacts', { ...NEW_CONTACT, isPrimary: !contacts.length })}><Plus /> Contact</Button>}
    >
      {contacts.length === 0 && <Muted className="tw:text-entry">No contact yet.</Muted>}
      {contacts.map((contact, index) => (
        <ContactCard
          key={index}
          contact={contact}
          departments={departments}
          onChange={(field, value) => setRow('contacts', index, field, value)}
          onMakePrimary={() => makePrimary(index)}
          onRemove={() => removeRow('contacts', index)}
        />
      ))}
    </FormSection>
  );
}
