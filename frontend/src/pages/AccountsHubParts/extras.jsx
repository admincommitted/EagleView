// Voucher extras shared by the voucher screens:
//   AttachDocs - supporting documents on a voucher (before save they sit under a draft key and move to the voucher on save)
//   readExcel / ExcelButtons - "Read Excel" fills the grid from a sheet; "Sample" downloads the columns it expects
import { useEffect, useState } from 'react';
import { Paperclip, Upload, Trash2, FileSpreadsheet, Download, FileText, Image as ImageIcon } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { Button, FileButton, SelectBox } from '@/components/ui';
import { cn } from '@/lib/utils';
import { askConfirm } from '@/components/common/askConfirm';
import { accountsApi } from './accountsApi';
import { Box, Btn, fmtDate } from './ui';

export const newDraftKey = () => 'acc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
const fileSize = (bytes) => (bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB');

const DOCUMENT_TYPES = ['SUPPORTING', 'VENDOR BILL', 'BANK ADVICE', 'CHALLAN', 'APPROVAL', 'OTHER'];
const ATTACH_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.tif,.tiff,.doc,.docx,.xls,.xlsx,.csv,.txt';

// ------------------------------------------------------------------ attachments
function DocumentChip({ document, onRemove }) {
  const DocumentIcon = /^image\//.test(document.mimeType || '') ? ImageIcon : FileText;
  const details = (document.documentType !== 'SUPPORTING' ? document.documentType + ' - ' : '') + fileSize(document.size || 0)
    + (document.uploadedByName ? ' - ' + document.uploadedByName : '') + (document.createdAt ? ', ' + fmtDate(document.createdAt) : '');
  return (
    <div className="tw:inline-flex tw:max-w-[340px] tw:items-center tw:gap-1.5 tw:rounded-md tw:border tw:border-primary/30 tw:bg-card tw:px-2 tw:py-1 tw:text-[11.5px]">
      <DocumentIcon className="tw:size-3.5 tw:shrink-0 tw:text-head" />
      <a href={document.filePath} target="_blank" rel="noreferrer" title={document.originalName} className="tw:max-w-[190px] tw:truncate tw:font-bold tw:text-head">
        {document.originalName}
      </a>
      <span className="tw:text-[10px] tw:text-muted-foreground">{details}</span>
      <Button variant="ghost" size="icon-sm" title="Remove" onClick={() => onRemove(document)} className="tw:text-destructive">
        <Trash2 className="tw:size-3" />
      </Button>
    </div>
  );
}

export function AttachDocs({ voucherId, draftKey, compact }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [documentType, setDocumentType] = useState('SUPPORTING');
  const owner = voucherId ? { voucherId } : draftKey ? { draftKey } : null;
  const ownerKey = voucherId ? 'voucherId=' + voucherId : draftKey ? 'draftKey=' + draftKey : '';

  const load = async () => {
    if (!owner) return;
    try {
      const response = await accountsApi.voucherDocuments(owner);
      setRows(response.data || []);
    } catch {
      setRows([]);
    }
  };
  useEffect(() => { setRows([]); load(); }, [ownerKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // another part of the screen (e.g. OCR of the bill) attached a file
  useEffect(() => {
    const reload = () => load();
    window.addEventListener('acc-docs-changed', reload);
    return () => window.removeEventListener('acc-docs-changed', reload);
  }, [ownerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (files) => {
    if (!files || !files.length || !owner) return;
    setBusy(true);
    setMessage('');
    try {
      const formData = new FormData();
      [...files].forEach((file) => formData.append('files', file));
      if (voucherId) formData.append('voucherId', voucherId); else formData.append('draftKey', draftKey);
      formData.append('documentType', documentType);
      const response = await accountsApi.uploadVoucherDocuments(formData);
      if (response.success === false) throw new Error(response.error);
      const count = (response.data || []).length;
      setMessage(count + ' file' + (count === 1 ? '' : 's') + ' attached');
      load();
    } catch (error) {
      setMessage('Not attached: ' + errorMessage(error));
    }
    setBusy(false);
  };
  const remove = async (document) => {
    if (!(await askConfirm({ title: 'Remove document', message: 'Remove ' + document.originalName + '?', okLabel: 'Remove', tone: 'danger' }))) return;
    try {
      await accountsApi.hubDeleteVoucherDocument(document.id);
      load();
    } catch (error) {
      setMessage('Not removed: ' + errorMessage(error));
    }
  };

  if (!owner) return null;
  return (
    <Box
      title={<span className="tw:inline-flex tw:items-center tw:gap-1.5"><Paperclip className="tw:size-3" /> Attached documents ({rows.length})</span>}
      right={(
        <>
          <SelectBox options={DOCUMENT_TYPES} value={documentType} onValueChange={setDocumentType} size="sm" className="tw:h-6 tw:w-[130px] tw:bg-card tw:text-[11px] tw:text-head" />
          <FileButton multiple accept={ATTACH_ACCEPT} onFiles={upload} disabled={busy} variant="ghost" className="tw:border-dashed tw:border-primary/30 tw:font-bold">
            <Upload className="tw:size-3" /> {busy ? 'Attaching' : 'Attach files'}
          </FileButton>
        </>
      )}
    >
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); upload(event.dataTransfer.files); }}
        className={cn('tw:flex tw:flex-wrap tw:items-center tw:gap-2', !compact && 'tw:min-h-7')}
      >
        {rows.map((document) => <DocumentChip key={document.id} document={document} onRemove={remove} />)}
        {!rows.length && (
          <span className="tw:text-[11px] tw:text-muted-foreground">
            {voucherId ? 'No documents yet.' : 'Files attached now are kept with the voucher when you Save.'} Drop files here or use Attach files - PDF, image, Word, Excel, up to 10 MB each.
          </span>
        )}
        {message && <span className={cn('tw:text-[11px] tw:font-bold', /^Not/.test(message) ? 'tw:text-destructive' : 'tw:text-success')}>{message}</span>}
      </div>
    </Box>
  );
}

// files parked under a draft key move to the voucher once it is saved
export const claimDocs = async (draftKey, voucherId) => {
  if (!draftKey || !voucherId) return null;
  try {
    return await accountsApi.claimVoucherDocuments(draftKey, voucherId);
  } catch {
    return null;
  }
};

// ------------------------------------------------------------------ Read Excel
const columnKey = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9%]/g, '');
// Excel keeps a date as a day number (1 = 1-Jan-1900); converting it ourselves avoids the time-zone shift of JS dates
const isoOf = (value) => {
  if (typeof value === 'number' && value > 20000 && value < 80000) return new Date(Math.round((value - 25569) * 86400000)).toISOString().slice(0, 10);
  if (value instanceof Date && !isNaN(value)) return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const dayMonthYear = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dayMonthYear) {
    const [, day, month, year] = dayMonthYear;
    return `${year.length === 2 ? '20' + year : year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return text;
};

const HEADER_SEARCH_ROWS = 15;
// cols: [{ key, label, aliases: [], date: bool }] -> rows of { key: value } (first sheet, header row = first row with 2+ known columns)
export async function readExcel(file, cols) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
  const wanted = cols.map((column) => ({ ...column, keys: [column.label, column.key, ...(column.aliases || [])].map(columnKey) }));

  let headerRow = -1;
  let columnAt = {};
  for (let rowIndex = 0; rowIndex < Math.min(grid.length, HEADER_SEARCH_ROWS) && headerRow < 0; rowIndex++) {
    const found = {};
    (grid[rowIndex] || []).forEach((heading, columnIndex) => {
      const column = wanted.find((want) => want.keys.includes(columnKey(heading)));
      if (column && found[column.key] == null) found[column.key] = columnIndex;
    });
    if (Object.keys(found).length >= 2) { headerRow = rowIndex; columnAt = found; }
  }
  if (headerRow < 0) throw new Error('No header row found - the first row should have the column names of the sample (' + cols.map((column) => column.label).join(', ') + ')');

  const out = [];
  for (let rowIndex = headerRow + 1; rowIndex < grid.length; rowIndex++) {
    const cells = grid[rowIndex] || [];
    if (!cells.some((cell) => String(cell).trim() !== '')) continue;
    const row = { _row: rowIndex + 1 };
    wanted.forEach((column) => {
      const cell = columnAt[column.key] != null ? cells[columnAt[column.key]] : '';
      row[column.key] = column.date || cell instanceof Date ? isoOf(cell) : String(cell ?? '').trim();
    });
    out.push(row);
  }
  return out;
}
export async function sampleExcel(name, cols, example) {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet([cols.map((column) => column.label), ...(example || [])]);
  sheet['!cols'] = cols.map((column) => ({ wch: Math.max(12, column.label.length + 2) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Lines');
  XLSX.writeFile(workbook, name + '.xlsx');
}
// match a name in the sheet to a ledger: exact name (any case), then a unique "starts with"
export const ledgerByName = (list, name) => {
  const wanted = String(name || '').trim().toLowerCase();
  if (!wanted) return null;
  const exact = list.find((ledger) => String(ledger.name).trim().toLowerCase() === wanted);
  if (exact) return exact;
  const startsWith = list.filter((ledger) => String(ledger.name).trim().toLowerCase().startsWith(wanted));
  return startsWith.length === 1 ? startsWith[0] : null;
};
export function ExcelButtons({ onFile, onSample, label = 'Read Excel' }) {
  return (
    <>
      <FileButton accept=".xlsx,.xls,.csv" onFiles={(files) => files[0] && onFile(files[0])} variant="secondary" size="lg" className="tw:font-bold">
        <FileSpreadsheet className="tw:size-3.5" /> {label}
      </FileButton>
      <Btn kind="ghost" onClick={onSample} title="Download the Excel with the columns Read Excel expects"><Download className="tw:size-3" /> Sample</Btn>
    </>
  );
}
