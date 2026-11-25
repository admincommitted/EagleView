import { Button, Modal as UiModal } from '@/components/ui';

export default function Modal({ isOpen, onClose, title, children }) {
  return (
    <UiModal
      open={isOpen}
      onClose={onClose}
      title={title}
      width={600}
      footer={(
        <>
          <Button variant="default" onClick={onClose}>OK</Button>
          <Button onClick={onClose}>CANCEL</Button>
        </>
      )}
    >
      {children}
    </UiModal>
  );
}
