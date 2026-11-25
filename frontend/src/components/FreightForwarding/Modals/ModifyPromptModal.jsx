import { useEffect, useId, useState } from 'react';
import { Search } from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';

export default function ModifyPromptModal({ isOpen, onClose, onSubmit, type = 'MAWB' }) {
  const [awbNumber, setAwbNumber] = useState('');
  const formId = useId();

  useEffect(() => {
    if (isOpen) setAwbNumber('');
  }, [isOpen]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (awbNumber.trim()) onSubmit(awbNumber.trim());
  };

  const footer = (
    <>
      <Button onClick={onClose}>CANCEL</Button>
      <Button variant="default" type="submit" form={formId}><Search /> SEARCH</Button>
    </>
  );

  return (
    <Modal open={isOpen} onClose={onClose} title={`Modify ${type}`} width={400} footer={footer}
      description={`Enter ${type} Number to modify (e.g. ${type === 'HAWB' ? 'H123456' : '125-12345678'}):`}>
      <form id={formId} onSubmit={handleSubmit}>
        <Input autoFocus data-allow-text value={awbNumber} onChange={(event) => setAwbNumber(event.target.value)} placeholder={`${type} Number`} className="tw:h-8 tw:text-[14px]" />
      </form>
    </Modal>
  );
}
