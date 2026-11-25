import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, DataTable, Field, Modal, Textarea } from '@/components/ui';
import { purchaseApi } from './purchaseApi';
import FilePicker from './FilePicker';
import FormFields from './FormFields';
import { ukDate } from './purchaseFormat';

const DIALOG_WIDTH = 350;

const UPLOADS = {
  photo: { title: 'Upload Asset Photo', accept: 'image/*', fileField: 'photo', okLabel: 'Upload', failText: 'Photo upload failed' },
  bill: { title: 'Upload Bill / Warranty', accept: 'image/*,application/pdf', fileField: 'bill', okLabel: 'Upload Bill', failText: 'Bill upload failed' },
};

const ASSIGN_FIELDS = [
  { name: 'assignedTo', label: 'Assign To (Name)', required: true, placeholder: 'Employee Name' },
  { name: 'assignedDepartment', label: 'Department', placeholder: 'IT, Sales, etc.' },
];

const HISTORY_COLUMNS = [
  { key: 'assignedTo', header: 'Assigned To', cell: (entry) => <b>{entry.assignedTo}</b> },
  { key: 'assignedDepartment', header: 'Department' },
  { key: 'assignedAt', header: 'Assigned Date', cell: (entry) => ukDate(entry.assignedAt) },
  {
    key: 'unassignedAt', header: 'Unassigned Date',
    cell: (entry) => (entry.unassignedAt ? ukDate(entry.unassignedAt) : <span className="tw:text-success">Currently Active</span>),
  },
];

function DialogButton({ variant, label, onClick, disabled }) {
  return <Button variant={variant} className="tw:w-full" disabled={disabled} onClick={onClick}>{label}</Button>;
}

const fileForm = (fieldName, file) => {
  const formData = new FormData();
  formData.append(fieldName, file);
  return formData;
};

function UploadDialog({ kind, asset, onClose, onSaved }) {
  const upload = UPLOADS[kind];
  const [file, setFile] = useState(null);
  const send = async () => {
    try {
      await purchaseApi.sendAssetForm(asset.id, kind, fileForm(upload.fileField, file));
      onSaved();
    } catch {
      toast.error(upload.failText);
    }
  };
  return (
    <Modal open title={upload.title} width={DIALOG_WIDTH} onClose={onClose}
      footer={<DialogButton variant="default" label={upload.okLabel} disabled={!file} onClick={send} />}>
      <FilePicker accept={upload.accept} file={file} onFile={setFile} />
    </Modal>
  );
}

function AssignDialog({ asset, onClose, onSaved }) {
  const [assignment, setAssignment] = useState({ assignedTo: asset.assignedTo || '', assignedDepartment: asset.assignedDepartment || '' });
  const assign = async () => {
    if (!assignment.assignedTo) { toast.error('Name is required'); return; }
    try {
      await purchaseApi.updateAsset(asset.id, { status: 'ASSIGNED', ...assignment });
      onSaved();
    } catch {
      toast.error('Failed to assign');
    }
  };
  return (
    <Modal open title="Update Asset / Assign" width={DIALOG_WIDTH} onClose={onClose}
      footer={<DialogButton variant="success" label="Confirm Assignment" onClick={assign} />}>
      <FormFields fields={ASSIGN_FIELDS} values={assignment} onChange={(name, value) => setAssignment((current) => ({ ...current, [name]: value }))} />
    </Modal>
  );
}

function DiscardDialog({ asset, onClose, onSaved }) {
  const [reason, setReason] = useState('');
  const [photo, setPhoto] = useState(null);
  const discard = async () => {
    if (!reason) { toast.error('Reason is required'); return; }
    try {
      const formData = new FormData();
      formData.append('reason', reason);
      if (photo) formData.append('photo', photo);
      await purchaseApi.sendAssetForm(asset.id, 'discard', formData);
      onSaved();
    } catch {
      toast.error('Failed to discard');
    }
  };
  return (
    <Modal open title="Discard / Scrap Asset" width={DIALOG_WIDTH} onClose={onClose}
      footer={<DialogButton variant="destructive" label="Discard Asset" onClick={discard} />}>
      <div className="tw:flex tw:flex-col tw:gap-3">
        <Field label="Reason for Discarding" required layout="col" labelClassName="tw:text-destructive">
          <Textarea required rows={4} data-allow-text="" placeholder="Damaged beyond repair, sold, etc." value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <Field label="Attach Photo for Record (Optional)" layout="col">
          <FilePicker accept="image/*,application/pdf" file={photo} onFile={setPhoto} />
        </Field>
      </div>
    </Modal>
  );
}

function HistoryDialog({ asset, onClose }) {
  const history = asset.assignments || [];
  return (
    <Modal open title={`Assignment History - ${asset.assetName}`} width={560} onClose={onClose}>
      {history.length === 0
        ? <p className="tw:p-5 tw:text-center tw:text-muted-foreground">No assignment history available for this asset.</p>
        : <DataTable columns={HISTORY_COLUMNS} rows={history} rowKey={(entry, index) => index} className="tw:text-entry" />}
    </Modal>
  );
}

/** dialog: { kind: 'photo' | 'bill' | 'assign' | 'discard' | 'history', asset } */
export default function AssetDialog({ dialog, onClose, onSaved }) {
  const { kind, asset } = dialog;
  if (UPLOADS[kind]) return <UploadDialog kind={kind} asset={asset} onClose={onClose} onSaved={onSaved} />;
  if (kind === 'assign') return <AssignDialog asset={asset} onClose={onClose} onSaved={onSaved} />;
  if (kind === 'discard') return <DiscardDialog asset={asset} onClose={onClose} onSaved={onSaved} />;
  return <HistoryDialog asset={asset} onClose={onClose} />;
}
