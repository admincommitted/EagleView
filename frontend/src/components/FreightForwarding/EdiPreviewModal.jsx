import { Send } from 'lucide-react';
import { Button, Modal } from '@/components/ui';

const EdiPreviewModal = ({ isOpen, ediString, onClose, onConfirmTransmit, isLoading, type }) => {
  const footer = (
    <>
      <Button disabled={isLoading} onClick={onClose}>CANCEL</Button>
      <Button variant="default" disabled={isLoading} onClick={onConfirmTransmit}>
        <Send /> {isLoading ? 'TRANSMITTING VIA SFTP...' : 'CONFIRM & TRANSMIT TO AIRLINE'}
      </Button>
    </>
  );

  return (
    <Modal open={isOpen} onClose={onClose} title={`TERMINAL PREVIEW: ${type} MESSAGE`} width={800} footer={footer}
      bodyClassName="tw:max-h-[60vh] tw:bg-black tw:p-6">
      <pre className="tw:m-0 tw:font-mono tw:text-[15px] tw:leading-normal tw:break-all tw:whitespace-pre-wrap tw:text-[#4ade80]">
        {ediString || 'Generating standard IATA payload...'}
      </pre>
    </Modal>
  );
};

export default EdiPreviewModal;
