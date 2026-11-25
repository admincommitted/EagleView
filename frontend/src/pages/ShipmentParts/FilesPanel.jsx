import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Upload } from 'lucide-react';
import { DataTable, FileButton, Input, SelectBox } from '@/components/ui';
import askConfirm from '@/components/common/askConfirm';
import { toDisplayDate } from '@/lib/dates';
import { FormGrid, GridCell, GridField, Panel, StatusMessage } from './layout';
import DeleteButton from './DeleteButton';
import { shipmentApi } from './shipmentApi';

const ACCEPTED_FILES = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.tif,.tiff,.doc,.docx,.xls,.xlsx,.csv,.txt,.eml,.msg';

// the papers of the docket, uploaded as files
export default function FilesPanel({ shipmentId, names }) {
  const [files, setFiles] = useState([]);
  const [docType, setDocType] = useState('');
  const [remarks, setRemarks] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setFiles(await shipmentApi.files(shipmentId));
    } catch {
      setFiles([]);
    }
  }, [shipmentId]);
  useEffect(() => { load(); }, [load]);

  const upload = async (picked) => {
    if (!picked.length) return;
    setBusy(true);
    setMessage(null);
    try {
      const formData = new FormData();
      picked.forEach((file) => formData.append('files', file));
      formData.append('docType', docType || 'OTHER');
      formData.append('remarks', remarks);
      const answer = await shipmentApi.uploadFiles(shipmentId, formData);
      setMessage({ tone: 'success', text: answer.count + ' file(s) uploaded' });
      setRemarks('');
      load();
    } catch (error) {
      setMessage({ tone: 'error', text: error.message });
    }
    setBusy(false);
  };

  const remove = async (file) => {
    const goAhead = await askConfirm({ title: 'Remove file', message: 'Remove ' + file.originalName + ' from this docket?', okLabel: 'Remove', tone: 'danger' });
    if (!goAhead) return;
    try {
      await shipmentApi.deleteFile(shipmentId, file.id);
      load();
    } catch (error) {
      setMessage({ tone: 'error', text: error.message });
    }
  };

  const columns = [
    { key: 'docType', header: 'Document Type', className: 'tw:font-bold' },
    {
      key: 'file',
      header: 'File',
      cell: (file) => (
        <a href={file.filePath} target="_blank" rel="noreferrer" className="tw:inline-flex tw:items-center tw:gap-1 tw:text-head">
          {file.originalName} <ExternalLink className="tw:size-2.5" />
        </a>
      ),
    },
    { key: 'size', header: 'Size', cell: (file) => Math.max(1, Math.round((file.size || 0) / 1024)) + ' KB' },
    { key: 'remarks', header: 'Remarks', cell: (file) => file.remarks || '' },
    { key: 'uploadedBy', header: 'Uploaded By', cell: (file) => file.uploadedBy || '' },
    { key: 'createdAt', header: 'Date', cell: (file) => toDisplayDate(String(file.createdAt || '').slice(0, 10)) },
    { key: 'delete', header: '', cell: (file) => <DeleteButton onClick={() => remove(file)} /> },
  ];

  return (
    <Panel title={'Uploaded Documents (' + files.length + ')'}>
      <FormGrid columns={8}>
        <GridField label="Document Type" span={2}>
          <SelectBox clearable clearLabel="Other" placeholder="Other" value={docType} onValueChange={setDocType} options={names} />
        </GridField>
        <GridField label="Remarks" span={3}><Input value={remarks} onChange={(event) => setRemarks(event.target.value)} /></GridField>
        <FileButton variant="default" multiple accept={ACCEPTED_FILES} disabled={busy} onFiles={upload}>
          <Upload /> {busy ? 'Uploading' : 'Upload Docs'}
        </FileButton>
        <GridCell span={2}><StatusMessage message={message} /></GridCell>
      </FormGrid>
      {files.length > 0 && <DataTable columns={columns} rows={files} />}
    </Panel>
  );
}
