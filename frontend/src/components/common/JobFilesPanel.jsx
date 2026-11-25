// Files part of the job list's "Documents" window (Import and Export).
// - Extra e-Sanchit PDFs: PDFs that no document row uses (filed again by an Update, row removed); they can be removed.
// - Other documents: shipment documents uploaded by hand (PDF, picture, Excel, Word, mail ...) with a type and a remark.
// Removed files are moved to a _removed folder on the server, not erased.
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Paperclip, Trash2, Upload } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { Button, FileButton, Input, SelectBox } from '@/components/ui';
import { askConfirm } from './askConfirm';
import { sharedWidgetsApi } from './sharedWidgetsApi';

const UPLOAD_TYPES = '.pdf,.jpg,.jpeg,.png,.gif,.bmp,.tif,.tiff,.xls,.xlsx,.xlsm,.csv,.doc,.docx,.txt,.rtf,.odt,.ods,.zip,.rar,.7z,.eml,.msg';
const NO_FILES = { esanchit: [], other: [], docTypes: [], canEdit: false };

const fileSize = (bytes) => {
  if (!bytes) return '';
  return bytes / 1024 < 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
};
const savedTime = (when) => (when ? new Date(when).toLocaleString() : '');

function Heading({ children }) {
  return <div className="tw:mt-3 tw:mb-1.5 tw:flex tw:items-center tw:gap-2.5 tw:font-bold tw:text-head">{children}</div>;
}

function FileLink({ href, children }) {
  return <a href={href} target="_blank" rel="noreferrer" className="tw:break-all tw:text-primary">{children}</a>;
}

function FileRow({ link, details, size, savedAt, canRemove, removeTitle, busy, onRemove }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-1 tw:border-b tw:border-border/50 tw:py-1.5 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between tw:sm:gap-2.5">
      <div className="tw:min-w-0">
        {link}
        {details && <div className="tw:mt-0.5 tw:flex tw:flex-wrap tw:gap-x-3 tw:gap-y-1 tw:text-[11px] tw:text-muted-foreground">{details}</div>}
      </div>
      <span className="tw:inline-flex tw:items-center tw:gap-2 tw:whitespace-nowrap tw:text-muted-foreground">
        {fileSize(size)}{savedAt ? ` - ${savedTime(savedAt)}` : ''}
        {canRemove && (
          <Button variant="ghost" size="icon-sm" className="tw:text-destructive" disabled={busy} title={removeTitle} onClick={onRemove}>
            <Trash2 />
          </Button>
        )}
      </span>
    </div>
  );
}

function UploadForm({ form, docTypes, uploading, onChange, onSend, onCancel }) {
  return (
    <div className="tw:mb-1.5 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-md tw:border tw:border-input tw:bg-page tw:p-2">
      <FileButton accept={UPLOAD_TYPES} onFiles={(files) => onChange({ file: files[0] || null })}>
        <Paperclip /> Choose file
      </FileButton>
      <span className="tw:max-w-[260px] tw:truncate tw:text-[11px] tw:normal-case">{form.file ? form.file.name : 'No file chosen'}</span>
      <SelectBox
        options={docTypes.length ? docTypes : ['Other']}
        value={form.docType}
        onValueChange={(docType) => onChange({ docType })}
        className="tw:w-full tw:sm:w-auto"
      />
      <Input
        className="tw:flex-[1_1_160px] tw:normal-case"
        maxLength={200}
        placeholder="Remarks (optional)"
        value={form.remarks}
        onChange={(event) => onChange({ remarks: event.target.value })}
        data-allow-text=""
      />
      <Button variant="default" disabled={uploading} onClick={onSend}><Paperclip /> {uploading ? 'Uploading...' : 'Upload'}</Button>
      <Button disabled={uploading} onClick={onCancel}>Cancel</Button>
      <span className="tw:w-full tw:text-[10.5px] tw:text-muted-foreground">
        PDF, picture, Excel, Word, CSV, text, ZIP or mail (.eml / .msg), up to 25 MB. These are kept with the job only - they are not sent to ICEGATE.
      </span>
    </div>
  );
}

export default function JobFilesPanel({ module, jobId, finals = [] }) {
  const [files, setFiles] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const answer = await sharedWidgetsApi.jobFiles(module, jobId);
      if (!answer?.success) throw new Error(answer?.error || 'Could not read the files');
      setFiles(answer);
    } catch (error) {
      setLoadError(errorMessage(error));
      setFiles(NO_FILES);
    }
  }, [module, jobId]);

  useEffect(() => { if (jobId) load(); }, [jobId, load]);

  const remove = async (kind, fileName, label) => {
    const goAhead = await askConfirm({
      title: 'Remove file',
      message: `Remove ${label} from this job?`,
      note: "The file is moved to the job's _removed folder on the server (it can be brought back by the admin).",
      okLabel: 'Remove',
      tone: 'danger',
    });
    if (!goAhead) return;
    setBusy(kind + fileName);
    try {
      const answer = await sharedWidgetsApi.removeJobFile(module, jobId, kind, fileName);
      if (!answer?.success) throw new Error(answer?.error || 'Could not remove the file');
      toast.success(`Removed: ${label}`);
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
  };

  const send = async () => {
    if (!form?.file) { toast.error('Choose a file'); return; }
    setBusy('upload');
    try {
      const formData = new FormData();
      formData.append('docType', form.docType || 'Other');
      formData.append('remarks', form.remarks || '');
      formData.append('file', form.file);
      const answer = await sharedWidgetsApi.uploadJobFile(module, jobId, formData);
      if (!answer?.success) throw new Error(answer?.error || 'Upload failed');
      toast.success(`Uploaded: ${form.file.name}`);
      setForm(null);
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
  };

  if (!files) return <div className="tw:mt-2.5 tw:text-muted-foreground">Loading the files...</div>;
  const canEdit = Boolean(files.canEdit);
  const extraPdfs = (files.esanchit || []).filter((group) => !group.inUse);
  const others = files.other || [];

  return (
    <div>
      {loadError && <div className="tw:my-2 tw:text-destructive">{loadError}</div>}

      {extraPdfs.length > 0 && <Heading>Extra e-Sanchit PDFs - not on any document ({extraPdfs.length})</Heading>}
      {extraPdfs.map((group) => (
        <FileRow
          key={group.key}
          link={<FileLink href={group.main.fileUrl}>{group.main.fileName}</FileLink>}
          details={(
            <>
              {group.docCode && <span>Doc {group.docCode}</span>}
              {group.main.signed
                ? <span className="tw:font-semibold tw:text-success">Signed{group.main.signer ? ` - ${group.main.signer}` : ''}</span>
                : <span>Not signed</span>}
              {group.irn && <span className="tw:text-success">IRN {group.irn}</span>}
              {group.sameAs && <span className="tw:font-semibold tw:text-warning">Same file as {group.sameAs}</span>}
            </>
          )}
          size={group.main.size}
          savedAt={group.main.savedAt}
          canRemove={canEdit}
          removeTitle="Remove this PDF (not used by any document)"
          busy={Boolean(busy)}
          onRemove={() => remove('esanchit', group.main.fileName, group.main.fileName)}
        />
      ))}

      {finals.length > 0 && (
        <>
          <Heading>Final copies ({finals.length})</Heading>
          {finals.map((finalCopy, index) => (
            <div key={index} className="tw:flex tw:items-start tw:justify-between tw:gap-2.5 tw:border-b tw:border-border/50 tw:py-1.5">
              <FileLink href={finalCopy.fileUrl}>{finalCopy.fileName}</FileLink>
              <span className="tw:whitespace-nowrap tw:text-muted-foreground">final copy</span>
            </div>
          ))}
        </>
      )}

      <Heading>
        <span>Other documents ({others.length})</span>
        {canEdit && !form && (
          <Button variant="default" size="sm" onClick={() => setForm({ file: null, docType: 'Other', remarks: '' })}><Upload /> Upload document</Button>
        )}
      </Heading>
      {form && (
        <UploadForm
          form={form}
          docTypes={files.docTypes || []}
          uploading={busy === 'upload'}
          onChange={(change) => setForm((current) => ({ ...current, ...change }))}
          onSend={send}
          onCancel={() => setForm(null)}
        />
      )}
      {others.map((otherFile) => (
        <FileRow
          key={otherFile.fileName}
          link={<FileLink href={otherFile.fileUrl}>{otherFile.name}</FileLink>}
          details={(
            <>
              {otherFile.docType && <span className="tw:font-semibold tw:text-foreground">{otherFile.docType}</span>}
              {otherFile.remarks && <span>{otherFile.remarks}</span>}
              {otherFile.by && <span>by {otherFile.by}</span>}
            </>
          )}
          size={otherFile.size}
          savedAt={otherFile.savedAt}
          canRemove={canEdit}
          removeTitle="Remove this document"
          busy={Boolean(busy)}
          onRemove={() => remove('other', otherFile.fileName, otherFile.name)}
        />
      ))}
      {!others.length && !form && <div className="tw:text-muted-foreground">None yet.</div>}
    </div>
  );
}
