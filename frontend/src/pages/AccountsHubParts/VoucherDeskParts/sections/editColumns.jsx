import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';

// the Edit / Delete columns of an entry grid
export const editColumns = ({ onEdit, onDelete, hidden = () => false }) => [
  { label: 'Edit', w: 40, render: (row, index) => (hidden(row) ? '' : <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => onEdit(row, index)}><Pencil /></Button>) },
  { label: 'Delete', w: 48, render: (row, index) => (hidden(row) ? '' : <Button variant="ghost" size="icon-sm" title="Delete" className="tw:text-destructive" onClick={() => onDelete(row, index)}><Trash2 /></Button>) },
];
