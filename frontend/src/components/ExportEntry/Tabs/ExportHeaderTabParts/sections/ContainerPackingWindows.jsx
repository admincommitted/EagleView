import { useEffect, useState } from 'react';
import { FileDown, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Button, FileButton } from '@/components/ui';
import { GridEntryModal } from '@/components/JobEntry/Tabs/JobHeaderTabParts/sections/GridEntryModal';
import { editColumn, removeColumn } from '@/components/JobEntry/Tabs/JobHeaderTabParts/sections/rowActionColumns';

// ICEGATE package code directory (Customs Online Directory)
const PACKAGE_CODES = [['BDL', 'BUNDLE'], ['BLO', 'STEEL BLOCKS'], ['BLS', 'BAILS'], ['BOU', 'BILLIONS OF UNIT'], ['BOX', 'BOXES'], ['BRL', 'BARREL'], ['BUL', 'STEEL BULKS'],
  ['CAS', 'CASES'], ['CBY', 'CARBOYS'], ['CHT', 'CHEST'], ['CLS', 'COILS'], ['COL', 'COLLIES'], ['CON', 'CONTAINER'], ['CRT', 'CRATES'], ['CSK', 'WOODEN CASKS'], ['CTN', 'CARTONS'],
  ['DRM', 'DRUMS'], ['ENV', 'STEEL ENVELOPES'], ['FLK', 'FLASK'], ['HBK', 'HABBUCK'], ['JBL', 'JUMBLE BALE'], ['JTA', 'JOTTA'], ['KEG', 'KEGGS'], ['NGT', 'INGOT'], ['PAL', 'PALLS'],
  ['PCS', 'PIECES'], ['PKG', 'PACKAGES'], ['PLT', 'PALLETS'], ['QDS', 'QUADS'], ['REL', 'REELS'], ['RLS', 'ROOLS'], ['SHT', 'SHEETS'], ['SKD', 'SKID & SKIDDED PKGS'], ['SLB', 'SLABS'],
  ['TBL', 'TABLE'], ['TRK', 'TRUNK'], ['UNT', 'UNITS'], ['VLS', 'VIALS']];
const packageName = (code) => PACKAGE_CODES.find(([packageCode]) => packageCode === code)?.[1];

const CONTAINER_NO_PATTERN = /^[A-Z]{4}\d{7}$/;
const ISO_CODE_LENGTH = 10;

// ISO 6346 check digit of a container number (4 letters + 6 digits + check digit); letter values skip 11, 22, 33
function isoCheckOk(containerNo) {
  const text = String(containerNo || '').toUpperCase();
  if (!CONTAINER_NO_PATTERN.test(text)) return false;
  const valueOf = (character) => {
    if (/\d/.test(character)) return Number(character);
    const letterValue = character.charCodeAt(0) - 55;
    return letterValue + Math.floor((letterValue - 1) / 10);
  };
  let sum = 0;
  for (let position = 0; position < ISO_CODE_LENGTH; position++) sum += valueOf(text[position]) * (2 ** position);
  return (sum % 11) % 10 === Number(text[ISO_CODE_LENGTH]);
}

const EMPTY_CONTAINER = {
  ContainerNumber: '', ContainerSize: '', ContainerType: '', ExciseSealNo: '', SealDate: '', SealTypeIndicator: '', SealDeviceID: '', NoOfPktsStuffed: '', VGM: '',
  MovementDocumentType: '', MovementDocumentNumber: '', EqmntType: '', EqmntQty: '', EqmntQtyCode: '',
};
const EXCEL_COLUMNS = [['Container No', 'ContainerNumber'], ['Size', 'ContainerSize'], ['Type', 'ContainerType'], ['Seal No', 'ExciseSealNo'], ['Seal Date', 'SealDate'], ['Seal Type', 'SealTypeIndicator'],
  ['Seal Device ID', 'SealDeviceID'], ['Pkts Stuffed', 'NoOfPktsStuffed'], ['VGM Kgs', 'VGM'], ['Doc Type', 'MovementDocumentType'], ['Doc No', 'MovementDocumentNumber'], ['Equipment Type', 'EqmntType'], ['Equipment Qty', 'EqmntQty'], ['Equipment Qty Code', 'EqmntQtyCode']];
const EXCEL_SAMPLE_ROW = ['CSQU3054383', '20', 'GP', 'SEAL123', '01-10-2026', 'RFID', 'DEV001', 10, 2500, '', '', 'CN', 1, 'NOS'];

// what may be typed in each box
const CONTAINER_BOX_RULES = {
  ContainerNumber: { upper: true, max: 15 }, ExciseSealNo: { upper: true, max: 35 }, SealTypeIndicator: { upper: true, max: 5 }, SealDeviceID: { upper: true, max: 35 },
  NoOfPktsStuffed: { max: 8 }, VGM: { max: 12 }, MovementDocumentType: { upper: true, max: 5 }, MovementDocumentNumber: { upper: true, max: 35 },
  EqmntQty: { pattern: /[^\d.]/g }, EqmntQtyCode: { upper: true, max: 3 },
};
const PACKING_BOX_RULES = { PackingNumberFrom: { pattern: /\D/g }, PackingNumberTo: { pattern: /\D/g } };

const cleanTyped = (rule, value) => {
  let text = String(value ?? '');
  if (!rule) return text;
  if (rule.pattern) text = text.replace(rule.pattern, '');
  if (rule.upper) text = text.toUpperCase();
  return rule.max ? text.slice(0, rule.max) : text;
};

const containerFieldRows = (isSea) => [
  [
    { name: 'ContainerNumber', label: isSea ? 'Container No' : 'ULD No', required: true, placeholder: isSea ? 'CSQU3054383' : 'AKE12345AI', className: 'tw:md:flex-[2]' },
    { name: 'ContainerSize', label: 'Size', kind: 'select', options: ['20', '40', '45'] },
    {
      name: 'ContainerType', label: 'Type', kind: 'select',
      options: [{ value: 'GP', label: 'GP - General' }, { value: 'HC', label: 'HC - High cube' }, { value: 'OT', label: 'OT - Open top' }, { value: 'RF', label: 'RF - Reefer' }, { value: 'FR', label: 'FR - Flat rack' }, { value: 'TK', label: 'TK - Tank' }],
    },
    { name: 'ExciseSealNo', label: 'Seal No' },
    { name: 'SealDate', label: 'Seal Date', kind: 'date' },
    { name: 'SealTypeIndicator', label: 'Seal Type', placeholder: 'e.g. RFID' },
    { name: 'SealDeviceID', label: 'Seal Device ID' },
  ],
  [
    { name: 'NoOfPktsStuffed', label: 'Pkts Stuffed' },
    { name: 'VGM', label: 'VGM (Kgs)' },
    { name: 'MovementDocumentType', label: 'Movement Doc Type' },
    { name: 'MovementDocumentNumber', label: 'Movement Doc No' },
    { name: 'EqmntType', label: 'Equipment Type', kind: 'select', options: [{ value: 'CN', label: 'CN - Container' }, { value: 'TE', label: 'TE - Trailer' }, { value: 'RO', label: 'RO - RoRo' }] },
    { name: 'EqmntQty', label: 'Eqp Qty' },
    { name: 'EqmntQtyCode', label: 'Qty Code' },
  ],
];

const excelDate = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  if (typeof value === 'number') return new Date(Math.round((value - 25569) * 86400000)).toISOString().slice(0, 10);
  const text = String(value).trim();
  const match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : text;
};

const plainHeader = (text) => String(text).toLowerCase().replace(/[^a-z]/g, '');

function containerFromExcel(line) {
  const container = { ...EMPTY_CONTAINER };
  Object.entries(line).forEach(([header, value]) => {
    const column = EXCEL_COLUMNS.find(([title]) => plainHeader(title) === plainHeader(header));
    if (column) container[column[1]] = column[1] === 'SealDate' ? excelDate(value) : String(value).trim();
  });
  container.ContainerNumber = container.ContainerNumber.toUpperCase();
  return container;
}

function downloadContainerSample() {
  const worksheet = XLSX.utils.aoa_to_sheet([EXCEL_COLUMNS.map(([title]) => title), EXCEL_SAMPLE_ROW]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Containers');
  XLSX.writeFile(workbook, 'Container_Sample.xlsx');
}

function containerErrors(container, index, rows, isSea) {
  const errors = [];
  const containerNo = String(container.ContainerNumber || '').trim().toUpperCase();
  if (!containerNo) errors.push(isSea ? 'Container No is empty' : 'ULD No is empty');
  else if (isSea && !CONTAINER_NO_PATTERN.test(containerNo)) errors.push(`${containerNo}: container No is 4 letters + 7 digits (e.g. CSQU3054383)`);
  if (containerNo && rows.some((row, rowIndex) => rowIndex !== index && String(row.ContainerNumber || '').toUpperCase() === containerNo)) errors.push(`${containerNo} is already in the list`);
  if (container.SealDate && new Date(container.SealDate) > new Date()) errors.push(`${containerNo}: seal date is in the future`);
  if (String(container.VGM || '').trim() && !(parseFloat(container.VGM) > 0)) errors.push(`${containerNo}: VGM must be a number`);
  if (String(container.NoOfPktsStuffed || '').trim() && !/^\d+$/.test(String(container.NoOfPktsStuffed).trim())) errors.push(`${containerNo}: packets stuffed must be a whole number`);
  return errors;
}

// the rows being edited: a copy of the saved list, taken each time the window opens (Cancel drops the changes)
function useRowEditor(open, list, emptyRow) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyRow);
  const [editIndex, setEditIndex] = useState(-1);

  useEffect(() => {
    if (!open) return;
    setRows((list || []).map((row) => ({ ...emptyRow, ...row })));
    setForm(emptyRow);
    setEditIndex(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a fresh copy only when the window opens
  }, [open]);

  const resetForm = () => { setForm(emptyRow); setEditIndex(-1); };
  const putRow = (row) => {
    setRows((current) => (editIndex >= 0 ? current.map((existing, index) => (index === editIndex ? row : existing)) : [...current, row]));
    resetForm();
  };
  const editRow = (index, row) => { setForm({ ...emptyRow, ...row }); setEditIndex(index); };
  const removeRow = (index) => {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
    if (editIndex === index) resetForm();
  };

  return { rows, setRows, form, setForm, editIndex, resetForm, putRow, editRow, removeRow };
}

function WindowFooter({ note, summary, extra, editing, onClearForm, onCancel, onOk }) {
  return (
    <div className="tw:flex tw:w-full tw:flex-wrap tw:items-center tw:gap-2">
      {extra}
      <div className="tw:mr-auto tw:flex tw:min-w-0 tw:flex-col tw:text-[11px] tw:text-muted-foreground">
        <span className="tw:font-semibold tw:text-foreground">{summary}</span>
        <span>{note}</span>
      </div>
      {editing && <Button onClick={onClearForm}>Clear</Button>}
      <Button onClick={onCancel}>Cancel</Button>
      <Button variant="success" onClick={onOk}>OK</Button>
    </div>
  );
}

const numberColumn = { key: 'number', header: '#', width: 40, cell: (_, index) => index + 1 };

export function ContainerWindow({ open, onClose, list, onSave, mode, totalPackages, factoryStuffed }) {
  const isSea = mode !== 'AIR';
  const editor = useRowEditor(open, list, EMPTY_CONTAINER);
  const { rows, setRows, form, setForm, editIndex } = editor;

  const addOrUpdate = () => {
    const container = { ...form, ContainerNumber: String(form.ContainerNumber || '').trim().toUpperCase(), ExciseSealNo: String(form.ExciseSealNo || '').trim().toUpperCase(), SealDeviceID: String(form.SealDeviceID || '').trim().toUpperCase() };
    const errors = containerErrors(container, editIndex, rows, isSea);
    if (errors.length) { toast.error(errors.join('\n')); return; }
    if (isSea && !isoCheckOk(container.ContainerNumber)) toast(`${container.ContainerNumber}: the check digit does not match (ISO 6346) - check the number`, { icon: '⚠️', duration: 5000 });
    editor.putRow(container);
  };

  const readExcel = async ([file]) => {
    if (!file) return;
    try {
      const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
      const lines = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
      const read = lines.map(containerFromExcel).filter((container) => container.ContainerNumber);
      if (!read.length) { toast.error('No container rows found - use the Sample file columns'); return; }
      const merged = [...rows];
      let added = 0;
      let updated = 0;
      read.forEach((container) => {
        const index = merged.findIndex((row) => String(row.ContainerNumber).toUpperCase() === container.ContainerNumber);
        if (index >= 0) { merged[index] = container; updated++; } else { merged.push(container); added++; }
      });
      setRows(merged);
      toast.success(`${added} added, ${updated} updated from Excel`);
    } catch {
      toast.error('Could not read the Excel file');
    }
  };

  const confirm = () => {
    const errors = rows.flatMap((row, index) => containerErrors(row, index, rows, isSea));
    if (errors.length) { toast.error(errors.slice(0, 4).join('\n')); return; }
    onSave(rows);
  };

  const unit = isSea ? 'container' : 'ULD';
  const stuffed = rows.reduce((sum, row) => sum + (parseInt(row.NoOfPktsStuffed, 10) || 0), 0);
  const summary = `${rows.length} ${unit}(s)${stuffed ? ` · ${stuffed} packets stuffed` : ''}${totalPackages ? ` · SB total packages ${totalPackages}` : ''}${factoryStuffed === 'Y' ? ' · factory stuffed: give the e-seal of each container' : ''}`;
  const note = stuffed && totalPackages && stuffed !== parseInt(totalPackages, 10)
    ? `Packets stuffed (${stuffed}) differ from the SB total packages (${totalPackages}).`
    : 'OK keeps the list, Cancel drops the changes.';
  const columns = [
    numberColumn,
    {
      key: 'ContainerNumber', header: isSea ? 'Container No' : 'ULD No', className: 'tw:font-bold',
      cell: (row) => <>{row.ContainerNumber}{isSea && !isoCheckOk(row.ContainerNumber) && <span title="ISO 6346 check digit does not match" className="tw:ml-1 tw:text-warning">⚠</span>}</>,
    },
    { key: 'ContainerSize', header: 'Size' },
    { key: 'ContainerType', header: 'Type' },
    { key: 'ExciseSealNo', header: 'Seal No' },
    { key: 'SealDate', header: 'Seal Date' },
    { key: 'SealTypeIndicator', header: 'Seal Type' },
    { key: 'SealDeviceID', header: 'Device ID' },
    { key: 'NoOfPktsStuffed', header: 'Pkts', align: 'right' },
    { key: 'VGM', header: 'VGM', align: 'right' },
    { key: 'document', header: 'Doc', cell: (row) => [row.MovementDocumentType, row.MovementDocumentNumber].filter(Boolean).join(' ') },
    editColumn(editor.editRow),
    removeColumn(editor.removeRow),
  ];
  const excelButtons = (
    <>
      <FileButton variant="default" accept=".xlsx,.xls,.csv" onFiles={readExcel}><Upload /> Read Excel</FileButton>
      <Button onClick={downloadContainerSample}><FileDown /> Sample</Button>
    </>
  );

  return (
    <GridEntryModal
      open={open} title={isSea ? 'Container Details' : 'ULD Details'} width={1080} onClose={onClose}
      footer={<WindowFooter summary={summary} note={note} extra={excelButtons} editing={editIndex >= 0} onClearForm={editor.resetForm} onCancel={onClose} onOk={confirm} />}
      fieldRows={containerFieldRows(isSea)} values={form}
      onFieldChange={(name, value) => setForm((current) => ({ ...current, [name]: cleanTyped(CONTAINER_BOX_RULES[name], value) }))}
      addLabel={editIndex >= 0 ? `Update row ${editIndex + 1}` : 'Add'} onAdd={addOrUpdate}
      columns={columns} rows={rows} selectedKey={editIndex >= 0 ? editIndex : undefined}
      emptyText={`No ${unit} yet.`} gridClassName="tw:min-h-[120px] tw:max-h-[260px]"
    />
  );
}

const EMPTY_PACKING = { PackingNumberFrom: '', PackingNumberTo: '', PackingCode: '' };

const packageCount = (row) => {
  const from = parseInt(row.PackingNumberFrom, 10);
  const to = parseInt(row.PackingNumberTo, 10);
  return from && to && to >= from ? to - from + 1 : 0;
};

const packingFieldRows = (savedCode) => [[
  { name: 'PackingNumberFrom', label: 'Package No From', required: true, className: 'tw:md:flex-1' },
  { name: 'PackingNumberTo', label: 'To', required: true, className: 'tw:md:flex-1' },
  {
    name: 'PackingCode', label: 'Type of packages', kind: 'select', required: true, className: 'tw:md:flex-[2]',
    // a code saved earlier that is not in the list stays visible
    options: [
      ...(savedCode && !packageName(savedCode) ? [savedCode] : []),
      ...PACKAGE_CODES.map(([code, name]) => ({ value: code, label: `${code} - ${name}` })),
    ],
  },
]];

const PACKING_COLUMNS = [
  numberColumn,
  { key: 'PackingNumberFrom', header: 'From' },
  { key: 'PackingNumberTo', header: 'To' },
  { key: 'packages', header: 'Packages', cell: packageCount },
  { key: 'PackingCode', header: 'Type', cell: (row) => `${row.PackingCode}${packageName(row.PackingCode) ? ` - ${packageName(row.PackingCode)}` : ''}` },
];

export function PackingWindow({ open, onClose, list, onSave, totalPackages }) {
  const editor = useRowEditor(open, list, EMPTY_PACKING);
  const { rows, form, setForm, editIndex } = editor;

  const addOrUpdate = () => {
    const from = parseInt(form.PackingNumberFrom, 10);
    const to = parseInt(form.PackingNumberTo, 10);
    if (!from || !to) { toast.error('Enter package number From and To'); return; }
    if (to < from) { toast.error('Package number To is below From'); return; }
    if (!form.PackingCode) { toast.error('Pick the package type'); return; }
    const clash = rows.find((row, index) => index !== editIndex && Math.max(from, parseInt(row.PackingNumberFrom, 10)) <= Math.min(to, parseInt(row.PackingNumberTo, 10)));
    if (clash) { toast.error(`Numbers ${from}-${to} overlap the row ${clash.PackingNumberFrom}-${clash.PackingNumberTo}`); return; }
    editor.putRow({ PackingNumberFrom: String(from), PackingNumberTo: String(to), PackingCode: form.PackingCode });
  };

  const total = rows.reduce((sum, row) => sum + packageCount(row), 0);
  const sbTotal = parseInt(totalPackages, 10) || 0;
  const summary = `${rows.length} row(s) · ${total} package(s)${sbTotal ? ` · SB total packages ${sbTotal}` : ''}`;
  const note = sbTotal && total && total !== sbTotal
    ? `Numbered packages (${total}) differ from the SB total packages (${sbTotal}).`
    : 'Package number ranges and the type of packages (ICEGATE package codes).';

  return (
    <GridEntryModal
      open={open} title="Packing Details" width={720} onClose={onClose}
      footer={<WindowFooter summary={summary} note={note} editing={editIndex >= 0} onClearForm={editor.resetForm} onCancel={onClose} onOk={() => onSave(rows)} />}
      fieldRows={packingFieldRows(form.PackingCode)} values={form}
      onFieldChange={(name, value) => setForm((current) => ({ ...current, [name]: cleanTyped(PACKING_BOX_RULES[name], value) }))}
      addLabel={editIndex >= 0 ? 'Update' : 'Add'} onAdd={addOrUpdate}
      columns={[...PACKING_COLUMNS, editColumn(editor.editRow), removeColumn(editor.removeRow)]} rows={rows} selectedKey={editIndex >= 0 ? editIndex : undefined}
      emptyText="No packing row yet." gridClassName="tw:min-h-[120px] tw:max-h-[260px]"
    />
  );
}
