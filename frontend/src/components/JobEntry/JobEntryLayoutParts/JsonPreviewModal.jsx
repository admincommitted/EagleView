import toast from 'react-hot-toast';
import { Button, Modal } from '@/components/ui';
import { beJsonFileName, downloadJson, prettyJson } from './beFiles';

// preview = { json, listJobData } - listJobData is the job list's job whose file this is (null = the job on the screen)
export default function JsonPreviewModal({ preview, screenJobData, onClose, onSend }) {
  const { json, listJobData } = preview;
  const shownJob = listJobData || screenJobData;
  const isAmendedJob = !!shownJob._amendmentId;
  const isOtherJob = listJobData && String(listJobData.id) !== String(screenJobData.id || '');

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(prettyJson(json));
      toast.success('JSON copied');
    } catch {
      toast.error('Copy not allowed by the browser');
    }
  };

  const title = `CACHI01 JSON Preview — ${isAmendedJob ? 'amended job: for checking only (the file for ICEGATE is the amendment file, BE Amendment window)' : 'Ready to Submit'}`;

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      width="80vw"
      footer={(
        <>
          {!isAmendedJob && (
            <Button variant="secondary" onClick={() => downloadJson(json, beJsonFileName(shownJob.jobNo, json.headerField?.senderID))}>Download JSON</Button>
          )}
          <Button variant="secondary" onClick={copyJson}>Copy JSON</Button>
          <Button variant="success" onClick={onSend}>
            {isOtherJob ? `✅ Open job ${listJobData.jobNo || ''} and send to ICEGATE` : '✅ Send this to ICEGATE'}
          </Button>
        </>
      )}
    >
      <pre className="tw:m-0 tw:max-h-[65vh] tw:overflow-auto tw:rounded tw:bg-foreground tw:p-4 tw:font-mono tw:text-[11px] tw:leading-normal tw:text-success tw:normal-case">
        {prettyJson(json)}
      </pre>
    </Modal>
  );
}
