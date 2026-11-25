import toast from 'react-hot-toast';
import { Badge, Button, Modal } from '@/components/ui';
import { downloadBlob } from '@/lib/download';
import askConfirm from '../../common/askConfirm';

const prettyJson = (value) => JSON.stringify(value, null, 2);

const sbJsonFileName = (json) => {
  const jobNo = String(json.headerField?.jobNumber || 'SB');
  const senderId = String(json.headerField?.senderID || '').replace(/[^\w-]+/g, '_');
  return `SB_${jobNo}${senderId ? `_${senderId}` : ''}_CACHE01.json`;
};

function ValidationSummary({ validation, onShow }) {
  if (!validation || !(validation.errors.length || validation.warnings.length)) {
    return <Badge variant="success">✓ no problems found</Badge>;
  }
  return (
    <Button size="sm" variant={validation.errors.length ? 'destructive' : 'warning'} className="tw:rounded-full" onClick={onShow}>
      {validation.errors.length} error(s), {validation.warnings.length} warning(s) - show
    </Button>
  );
}

// preview = { json, validation } - the CACHE01 JSON of the SB with the server's check of it
export default function SbJsonPreviewModal({ preview, onClose, onShowValidation, onSend }) {
  const { json, validation } = preview;

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(prettyJson(json));
      toast.success('JSON copied');
    } catch {
      toast.error('Copy not allowed by the browser');
    }
  };

  // the CACHE01 file itself, for signing (DSC) and upload on ICEGATE
  const downloadJson = async () => {
    const errorCount = validation?.errors.length || 0;
    if (errorCount) {
      const downloadAnyway = await askConfirm({ title: 'This SB has errors', message: `This SB has ${errorCount} error(s) - ICEGATE will reject it. Download the JSON anyway?`, okLabel: 'Download anyway', cancelLabel: 'Cancel', tone: 'danger' });
      if (!downloadAnyway) return;
    }
    const fileName = sbJsonFileName(json);
    downloadBlob(new Blob([prettyJson(json)], { type: 'application/json' }), fileName);
    toast.success(`${fileName} downloaded - sign it with your DSC before uploading on ICEGATE`, { duration: 6000 });
  };

  return (
    <Modal
      open
      onClose={onClose}
      width="80vw"
      title={(
        <span className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5">
          📄 CACHE01 JSON Preview (SB)
          <ValidationSummary validation={validation} onShow={() => onShowValidation({ ...validation, title: 'Shipping Bill - Pre-Validation' })} />
        </span>
      )}
      footer={(
        <>
          <Button variant="secondary" onClick={copyJson}>Copy JSON</Button>
          <Button variant="default" onClick={downloadJson}>Download JSON</Button>
          <Button variant="success" onClick={onSend}>✅ Send this SB to ICEGATE</Button>
        </>
      )}
    >
      <pre className="tw:m-0 tw:max-h-[65vh] tw:overflow-auto tw:rounded tw:bg-foreground tw:p-4 tw:font-mono tw:text-[11px] tw:leading-normal tw:text-success tw:normal-case">
        {prettyJson(json)}
      </pre>
    </Modal>
  );
}
