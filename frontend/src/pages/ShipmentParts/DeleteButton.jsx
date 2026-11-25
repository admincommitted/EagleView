import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';

export default function DeleteButton({ onClick, title = 'Remove' }) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={title} title={title} className="tw:text-destructive" onClick={onClick}>
      <Trash2 className="tw:size-3" />
    </Button>
  );
}
