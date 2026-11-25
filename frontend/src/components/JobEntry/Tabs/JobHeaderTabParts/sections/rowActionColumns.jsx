import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';

export const editColumn = (onEdit) => ({
  key: 'edit', header: 'Edit', width: 60,
  cell: (row, index) => <Button variant="link" size="sm" onClick={() => onEdit(index, row)}><Pencil /> Edit</Button>,
});

export const removeColumn = (onRemove) => ({
  key: 'remove', header: 'Remove', width: 80,
  cell: (row, index) => <Button variant="link" size="sm" className="tw:text-destructive" onClick={() => onRemove(index, row)}><Trash2 /> Remove</Button>,
});
