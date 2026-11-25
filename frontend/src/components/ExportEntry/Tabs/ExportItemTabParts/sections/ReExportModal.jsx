import { useState } from 'react';
import { Edit2, FileDown, Plus, RotateCcw, Search, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Button, DataTable, DateInput, Field, FileButton, Input, Modal, NumberInput, SelectBox } from '@/components/ui';
import { exportEntryApi } from '../../../exportEntryApi';
import { answerOf } from '../answerOf';

const number = (value) => {
  const parsed = parseFloat(String(value ?? '').replace(/,/g, ''));
  return isFinite(parsed) ? parsed : 0;
};
const EXCEL_DAY_ZERO = 25569;
const DAY_MS = 86400000;
const toIsoDate = (value) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number' && value > 20000 && value < 80000) return new Date(Math.round((value - EXCEL_DAY_ZERO) * DAY_MS)).toISOString().slice(0, 10);
  const text = String(value).trim();
  const yearFirst = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(text);
  if (yearFirst) return `${yearFirst[1]}-${yearFirst[2]}-${yearFirst[3]}`;
  const dayFirst = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  return dayFirst ? `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}` : text;
};
const showDate = (value) => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : (value || '');
};
const yesNo = (value) => (/^Y/i.test(String(value || '')) ? 'Y' : /^N/i.test(String(value || '')) ? 'N' : '');

// screen keys of the ICEGATE SB "Reexport" table (kept from the old window so rows saved with jobs still open)
const F = {
  site: 'reExpField2', beNo: 'reExpField3', beDate: 'reExpField4', inv: 'reExpField5', item: 'reExpField6', manual: 'reExpField7',
  used: 'reExpField8', desc: 'reExpField9', qty: 'reExpField10', uqc: 'reExpField11', assessed: 'reExpField12', duty: 'reExpField13',
  dutyDate: 'reExpField14', para: 'reExpField15', claim: 'reExpField16',
};
const DECLARATIONS = [
  ['reExpField17', 'BE item used'], ['reExpField18', 'Commissioner permission'], ['reExpField19', 'Input credit availed'],
  ['reExpField20', 'Personal use'], ['reExpField21', 'Modvat availed'], ['reExpField22', 'Modvat repaid'],
];
const EXCEL_COLUMNS = [
  ['BE Site', F.site], ['BE No', F.beNo], ['BE Date', F.beDate], ['BE Inv Sr', F.inv], ['BE Item Sr', F.item], ['Manual BE', F.manual],
  ['Qty Utilised', F.used], ['Description', F.desc], ['BE Qty', F.qty], ['BE UQC', F.uqc], ['Assessed Value', F.assessed], ['Duty Paid', F.duty],
  ['Duty Pay Date', F.dutyDate], ['Other Identifiable Para', F.para], ['Assessable Value Claimed', F.claim], ...DECLARATIONS.map(([key, label]) => [label, key]),
];
const SAMPLE_ROW = ['INDEL4', '1234567', '15-09-2026', 1, 1, 'N', 10, 'ITEM DESCRIPTION', 10, 'NOS', 50000, 9000, '16-09-2026', '', 50000, 'N', 'N', 'N', 'N', 'N', 'N'];
const DATE_KEYS = [F.beDate, F.dutyDate];
const YES_NO_KEYS = [F.manual, ...DECLARATIONS.map(([key]) => key)];
const YES_NO_OPTIONS = [{ value: 'Y', label: 'Y - Yes' }, { value: 'N', label: 'N - No' }];

const BE_FIELDS = [
  { label: 'BE SITE', key: F.site, max: 6, upper: true, required: true, placeholder: 'INDEL4' },
  { label: 'BE NO', key: F.beNo, max: 10, digits: true, required: true },
  { label: 'BE DATE', key: F.beDate, date: true, required: true },
  { label: 'BE INV SR NO', key: F.inv, max: 5, digits: true, required: true },
  { label: 'BE ITEM SR NO', key: F.item, max: 4, digits: true, required: true },
  { label: 'MANUAL BE', key: F.manual, yesNo: true },
  { label: 'DESCRIPTION (AS IN BE)', key: F.desc, max: 120, span: 6 },
];
const VALUE_FIELDS = [
  { label: 'BE QTY', key: F.qty, numeric: true },
  { label: 'BE UQC', key: F.uqc, max: 3, upper: true, placeholder: 'NOS' },
  { label: 'QTY UTILISED', key: F.used, numeric: true, required: true },
  { label: 'BE ASSESSED VALUE ₹', key: F.assessed, numeric: true },
  { label: 'ASS. VALUE CLAIMED ₹', key: F.claim, numeric: true },
  { label: 'BE DUTY PAID ₹', key: F.duty, numeric: true },
  { label: 'DUTY PAYMENT DATE', key: F.dutyDate, date: true },
  { label: 'OTHER IDENTIFIABLE PARAMETER', key: F.para, max: 120, span: 5 },
];
const DECLARATION_FIELDS = DECLARATIONS.map(([key, label]) => ({ label: label.toUpperCase(), key, yesNo: true }));
const SPAN_CLASSES = {
  5: 'tw:col-span-2 tw:md:col-span-3 tw:lg:col-span-5',
  6: 'tw:col-span-2 tw:md:col-span-3 tw:lg:col-span-6',
};
const CARD = 'tw:rounded-lg tw:border tw:border-border tw:bg-background tw:px-3 tw:py-2.5';
const CARD_TITLE = 'tw:mb-2 tw:text-[11px] tw:font-extrabold tw:tracking-wide tw:text-head';
const FIELD_GRID = 'tw:grid tw:grid-cols-2 tw:gap-x-2.5 tw:gap-y-2 tw:md:grid-cols-3 tw:lg:grid-cols-6';

const blankRow = () => ({ [F.manual]: 'N' });

const reExportErrors = (row) => {
  const errors = [];
  if (!/^[A-Z0-9]{6}$/.test(String(row[F.site] || '').trim().toUpperCase())) errors.push('BE Site must be the 6-character customs code (e.g. INDEL4)');
  if (!/^\d{1,10}$/.test(String(row[F.beNo] || '').trim())) errors.push('BE No must be numeric');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row[F.beDate] || ''))) errors.push('BE Date is mandatory');
  if (!(number(row[F.inv]) >= 1)) errors.push('BE Inv Sr No is mandatory');
  if (!(number(row[F.item]) >= 1)) errors.push('BE Item Sr No is mandatory');
  if (!(number(row[F.used]) > 0)) errors.push('Qty Utilised must be more than 0');
  if (number(row[F.qty]) > 0 && number(row[F.used]) > number(row[F.qty])) errors.push('Qty Utilised is more than the BE Qty');
  if (row[F.uqc] && !/^[A-Z]{3}$/.test(String(row[F.uqc]).toUpperCase())) errors.push('BE UQC must be 3 letters');
  return errors;
};

function savedRows(saved) {
  let list = saved;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  return (Array.isArray(list) ? list : []).map((row, index) => ({ ...row, id: row.id || `${Date.now()}-${index}` }));
}

function rowFromSheet(sheetRow, index) {
  const row = { id: `${Date.now()}-${index}` };
  EXCEL_COLUMNS.forEach(([header, key]) => {
    const value = sheetRow[header] ?? sheetRow[header.toUpperCase()];
    if (value !== undefined && value !== '') row[key] = DATE_KEYS.includes(key) ? toIsoDate(value) : String(value).trim();
  });
  [F.site, F.uqc].forEach((key) => { if (row[key]) row[key] = row[key].toUpperCase(); });
  YES_NO_KEYS.forEach((key) => { if (row[key] !== undefined) row[key] = yesNo(row[key]); });
  if (!row[F.manual]) row[F.manual] = 'N';
  return row;
}

function ReExportField({ field, row, onChange }) {
  const value = row[field.key];
  let control;
  if (field.date) control = <DateInput required={field.required} value={value || ''} onValueChange={onChange} />;
  else if (field.yesNo) control = <SelectBox clearable clearLabel="-" placeholder="-" options={YES_NO_OPTIONS} value={yesNo(value)} onValueChange={onChange} />;
  else if (field.numeric || field.digits) {
    control = (
      <NumberInput required={field.required} align={field.numeric ? 'right' : 'left'} decimals={field.digits ? 0 : undefined} maxLength={field.max}
        placeholder={field.placeholder} value={value || ''} onValueChange={onChange} />
    );
  } else {
    control = (
      <Input data-allow-text="" required={field.required} maxLength={field.max} placeholder={field.placeholder} value={value || ''}
        onChange={(event) => onChange(field.upper ? event.target.value.toUpperCase() : event.target.value)} />
    );
  }
  return <Field label={field.label} required={field.required} layout="col" className={cn(SPAN_CLASSES[field.span])}>{control}</Field>;
}

/**
 * Re-Export window of an item (ICEGATE SB "Reexport" table: the import BE each re-exported item came in on). "Find in
 * import jobs" fills the form from our own import job of that BE. OK keeps the rows and sets Re-Export = Y / N.
 */
export default function ReExportModal({ open, onClose, formData, handleFormChange }) {
  const [rows, setRows] = useState(() => savedRows(formData.reExports));
  const [form, setForm] = useState(blankRow);
  const [editId, setEditId] = useState(null);
  const [find, setFind] = useState({ beNo: '', beDate: '' });
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);

  const setValue = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const formUsed = Object.entries(form).some(([key, value]) => key !== F.manual && String(value || '').trim());
  const clearForm = () => {
    setForm(blankRow());
    setEditId(null);
  };

  const addOrUpdate = () => {
    const row = { ...form, [F.site]: String(form[F.site] || '').trim().toUpperCase(), [F.uqc]: String(form[F.uqc] || '').trim().toUpperCase(), [F.beNo]: String(form[F.beNo] || '').trim() };
    const errors = reExportErrors(row);
    if (errors.length) {
      toast.error(errors.join('\n'), { duration: 5000 });
      return;
    }
    const duplicate = rows.find((other) => other.id !== editId && String(other[F.beNo]) === row[F.beNo] && number(other[F.inv]) === number(row[F.inv]) && number(other[F.item]) === number(row[F.item]));
    if (duplicate) {
      toast.error('This BE invoice / item is already in the list.');
      return;
    }
    if (editId) setRows((previous) => previous.map((other) => (other.id === editId ? { ...row, id: editId } : other)));
    else setRows((previous) => [...previous, { ...row, id: `${Date.now()}` }]);
    toast.success(editId ? 'Row updated' : 'Row added');
    clearForm();
  };

  const findBe = async () => {
    const beNo = String(find.beNo || '').trim();
    if (!/^\d{1,10}$/.test(beNo)) {
      toast.error('Enter the BE No (numbers only).');
      return;
    }
    setBusy(true);
    setFound(null);
    try {
      const answer = await answerOf(exportEntryApi.importJobsByBe(beNo, find.beDate));
      const jobs = answer?.success && Array.isArray(answer.data) ? answer.data : [];
      if (!jobs.length) {
        toast('BE not found in the import jobs of this software - fill the details by hand.', { icon: 'ℹ️', duration: 5000 });
        setForm((previous) => ({ ...previous, [F.beNo]: beNo, ...(find.beDate ? { [F.beDate]: find.beDate } : {}) }));
        return;
      }
      setFound(jobs);
    } catch (error) {
      toast.error(`Could not search: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const pick = ({ job, item }) => {
    setForm((previous) => ({
      ...previous,
      [F.site]: job.beSite || previous[F.site] || '', [F.beNo]: job.beNo, [F.beDate]: job.beDate || previous[F.beDate] || '',
      [F.inv]: String(item.invSr), [F.item]: String(item.itemSr), [F.desc]: item.desc || '', [F.qty]: item.qty ? String(item.qty) : '',
      [F.uqc]: item.uqc || '', [F.assessed]: item.assessableValue ? String(item.assessableValue) : '',
      [F.duty]: item.dutyPaid ? String(Math.round(item.dutyPaid * 100) / 100) : '', [F.dutyDate]: job.dutyPaidDate || '', [F.manual]: 'N',
      [F.used]: previous[F.used] || (formData.qty ? String(Math.min(number(formData.qty), number(item.qty) || number(formData.qty))) : ''),
    }));
    setFound(null);
    toast.success(`Filled from import job ${job.jobNo || ''}, item ${item.invSr}/${item.itemSr}`);
  };

  const downloadSample = () => {
    const sheet = XLSX.utils.aoa_to_sheet([EXCEL_COLUMNS.map(([header]) => header), SAMPLE_ROW]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'ReExport');
    XLSX.writeFile(book, 'ReExport_Sample.xlsx');
  };

  const readExcel = async ([file]) => {
    if (!file) return;
    try {
      const book = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
      const sheetRows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '' });
      const read = [];
      const skipped = [];
      sheetRows.forEach((sheetRow, index) => {
        const row = rowFromSheet(sheetRow, index);
        const errors = reExportErrors(row);
        if (errors.length) skipped.push(`row ${index + 2}: ${errors[0]}`);
        else read.push(row);
      });
      if (read.length) {
        setRows((previous) => [...previous, ...read]);
        toast.success(`${read.length} row(s) read${skipped.length ? `; ${skipped.length} skipped (${skipped.slice(0, 2).join('; ')})` : ''}`, { duration: 6000 });
      } else {
        toast.error(skipped.length ? `No row read: ${skipped.slice(0, 3).join('; ')}` : 'The sheet has no rows.', { duration: 6000 });
      }
    } catch (error) {
      toast.error(`Could not read the Excel file: ${error.message}`);
    }
  };

  const confirm = () => {
    if (formUsed) {
      toast.error(editId ? 'Click Update (or Clear) for the row being edited first.' : 'Click Add (or Clear) for the details typed in the form first.');
      return;
    }
    handleFormChange('reExports', rows);
    handleFormChange('reExport', rows.length ? 'Y' : 'N');
    onClose();
  };

  const foundRows = (found || []).flatMap((job) => job.items.map((item) => ({ job, item })));
  const foundColumns = [
    { key: 'job', header: 'Job', cell: ({ job }) => job.jobNo },
    { key: 'beDate', header: 'BE date', cell: ({ job }) => showDate(job.beDate) },
    { key: 'invItem', header: 'Inv/Item', cell: ({ item }) => `${item.invSr}/${item.itemSr}` },
    { key: 'desc', header: 'Description', className: 'tw:max-w-[320px] tw:truncate', cell: ({ item }) => item.desc },
    { key: 'qty', header: 'Qty', cell: ({ item }) => `${item.qty} ${item.uqc}` },
    { key: 'assessable', header: 'Assessable', cell: ({ item }) => item.assessableValue || '-' },
    { key: 'duty', header: 'Duty', cell: ({ item }) => item.dutyPaid || '-' },
    { key: 'use', header: '', className: 'tw:font-bold tw:text-primary', cell: () => 'Use' },
  ];
  const listColumns = [
    { key: 'serial', header: '#', cell: (row, index) => index + 1 },
    { key: F.site, header: 'BE Site' },
    { key: F.beNo, header: 'BE No', className: 'tw:font-bold' },
    { key: F.beDate, header: 'BE Date', cell: (row) => showDate(row[F.beDate]) },
    { key: 'invItem', header: 'Inv/Item', cell: (row) => `${row[F.inv]}/${row[F.item]}` },
    { key: F.desc, header: 'Description', className: 'tw:max-w-[260px] tw:truncate', cell: (row) => <span title={row[F.desc]}>{row[F.desc] || '-'}</span> },
    { key: F.used, header: 'Qty Utilised', cell: (row) => `${row[F.used]} ${row[F.uqc] || ''}` },
    { key: F.qty, header: 'BE Qty', cell: (row) => row[F.qty] || '-' },
    { key: F.assessed, header: 'Assessed ₹', cell: (row) => row[F.assessed] || '-' },
    { key: F.duty, header: 'Duty ₹', cell: (row) => row[F.duty] || '-' },
    {
      key: 'actions', header: '', align: 'right',
      cell: (row) => (
        <span className="tw:inline-flex tw:gap-1">
          <Button variant="ghost" size="icon-sm" title="Edit" aria-label="Edit row" onClick={() => { const { id, ...values } = row; setForm({ ...blankRow(), ...values }); setEditId(id); }}><Edit2 /></Button>
          <Button variant="ghost" size="icon-sm" className="tw:text-destructive" title="Remove" aria-label="Remove row"
            onClick={() => { setRows((previous) => previous.filter((other) => other.id !== row.id)); if (editId === row.id) clearForm(); }}>
            <Trash2 />
          </Button>
        </span>
      ),
    },
  ];
  const fieldGrid = (fields) => (
    <div className={FIELD_GRID}>
      {fields.map((field) => <ReExportField key={field.key} field={field} row={form} onChange={(value) => setValue(field.key, value)} />)}
    </div>
  );

  return (
    <Modal
      open={open}
      title="Re-Export Details"
      description={`Item ${formData.invSr || 1}/${formData.itemSr || 1} · ${formData.desc || 'no description'} · Qty ${formData.qty || 0} ${formData.unit || ''} · the import BE the goods came in on`}
      width={1100}
      closeOnOutside={false}
      onClose={onClose}
      bodyClassName="tw:bg-page"
      footer={(
        <>
          <FileButton variant="default" accept=".xlsx,.xls" onFiles={readExcel}><Upload /> Read Excel</FileButton>
          <Button onClick={downloadSample}><FileDown /> Sample</Button>
          <span className="tw:ml-auto tw:text-[11px] tw:text-muted-foreground">{rows.length} BE row(s)</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="success" onClick={confirm}>OK - keep {rows.length} row(s)</Button>
        </>
      )}
    >
      <div className={cn(CARD, 'tw:flex tw:flex-wrap tw:items-end tw:gap-2.5 tw:bg-accent/40')}>
        <Field label="FIND BE - BE NO" layout="col" className="tw:w-[150px]">
          <NumberInput decimals={0} maxLength={10} value={find.beNo} onValueChange={(beNo) => setFind((previous) => ({ ...previous, beNo }))}
            onKeyDown={(event) => { if (event.key === 'Enter') findBe(); }} />
        </Field>
        <Field label="BE DATE (optional)" layout="col" className="tw:w-[150px]">
          <DateInput value={find.beDate} onValueChange={(beDate) => setFind((previous) => ({ ...previous, beDate }))} />
        </Field>
        <Button variant="success" disabled={busy} onClick={findBe}><Search /> {busy ? 'Searching…' : 'Find in import jobs'}</Button>
        <span className="tw:min-w-[200px] tw:flex-1 tw:text-[11px] tw:text-muted-foreground">
          Fills the form from our own import job of that BE. If the BE was not filed through this software, type the details below.
        </span>
        {found && (
          <DataTable columns={foundColumns} rows={foundRows} rowKey={({ job, item }) => `${job.jobId}-${item.invSr}-${item.itemSr}`} onRowClick={pick}
            containerClassName="tw:max-h-[170px] tw:w-full tw:rounded-md tw:border tw:border-border" />
        )}
      </div>

      <div className={CARD}>
        <div className={CARD_TITLE}>IMPORT BILL OF ENTRY {editId && <span className="tw:text-warning">· EDITING A ROW</span>}</div>
        {fieldGrid(BE_FIELDS)}
      </div>

      <div className={CARD}>
        <div className={CARD_TITLE}>QUANTITY, VALUE AND DUTY</div>
        {fieldGrid(VALUE_FIELDS)}
      </div>

      <div className={CARD}>
        <div className={CARD_TITLE}>DECLARATIONS</div>
        {fieldGrid(DECLARATION_FIELDS)}
        <div className="tw:mt-2.5 tw:flex tw:justify-end tw:gap-2">
          <Button onClick={clearForm}><RotateCcw /> Clear</Button>
          <Button variant={editId ? 'warning' : 'default'} onClick={addOrUpdate}><Plus /> {editId ? 'Update row' : 'Add to list'}</Button>
        </div>
      </div>

      <DataTable columns={listColumns} rows={rows} rowKey="id" selectedKey={editId} emptyText="No BE yet - fill the form and click Add to list, or Read Excel."
        containerClassName="tw:rounded-lg tw:border tw:border-border" />
    </Modal>
  );
}
