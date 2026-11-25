import { Button, Modal } from '@/components/ui';

/** Frame of the small AWB windows: the ui Modal with a status text on the left of the footer and Close on the right. */
export default function ModalFrame({ title, width = 560, onClose, children, footer, open = true }) {
  const actions = (
    <>
      <span className="tw:mr-auto tw:text-[11px] tw:text-muted-foreground">{footer}</span>
      <Button onClick={onClose}>Close</Button>
    </>
  );
  return (
    <Modal open={open} onClose={onClose} title={title} width={width} closeOnOutside={false} footer={actions}>
      {children}
    </Modal>
  );
}

export function FormError({ children }) {
  return children ? <div className="tw:text-[11px] tw:text-destructive">{children}</div> : null;
}

export const ENTRY_ROW = 'tw:flex tw:flex-col tw:gap-2 tw:rounded-sm tw:border tw:border-border tw:bg-page tw:p-2 tw:md:flex-row tw:md:items-end';
export const GRID_BOX = 'tw:max-h-[240px] tw:rounded-sm tw:border tw:border-border';
