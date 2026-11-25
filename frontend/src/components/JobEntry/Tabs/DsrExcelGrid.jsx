import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';

const COLUMNS = [
  { field: 'jobNo', label: 'Job No', readOnly: true, widthClass: 'tw:w-[120px] tw:max-w-[120px]' },
  { field: 'beNo', label: 'BE No', readOnly: true, widthClass: 'tw:w-[130px] tw:max-w-[130px]' },
  { field: 'importerName', label: 'Importer', readOnly: true, widthClass: 'tw:w-[200px] tw:max-w-[200px]' },
  { field: 'igmNo', label: 'IGM No', readOnly: true, widthClass: 'tw:w-[130px] tw:max-w-[130px]' },
  { field: 'status', label: 'Status', readOnly: false, widthClass: 'tw:w-[130px] tw:max-w-[130px]' },
  { field: 'doDate', label: 'DO Date', readOnly: false, widthClass: 'tw:w-[120px] tw:max-w-[120px]' },
  { field: 'clearanceDate', label: 'Clearance Date', readOnly: false, widthClass: 'tw:w-[120px] tw:max-w-[120px]' },
  { field: 'latestRemark', label: 'Latest Remark', readOnly: false, widthClass: 'tw:w-[250px] tw:max-w-[250px]' },
  { field: 'assignedTo', label: 'Assigned To', readOnly: true, widthClass: 'tw:w-[120px] tw:max-w-[120px]' },
];

const ARROW_MOVES = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] };

function withDsrFields(job) {
  let extended = {};
  try { extended = JSON.parse(job.extendedData || '{}'); } catch { extended = {}; }
  return { ...job, latestRemark: extended.latestRemark || '', doDate: extended.doDate || '', clearanceDate: extended.clearanceDate || '' };
}

/** Spreadsheet-like DSR view: arrows move between cells, Enter / typing / double-click edits a cell, leaving it saves. */
export default function DsrExcelGrid({ data, onSave }) {
  const [rows, setRows] = useState([]);
  const [editingCell, setEditingCell] = useState(null); // { rowIndex, field }
  const tableRef = useRef(null);

  useEffect(() => { setRows(data.map(withDsrFields)); }, [data]);

  const focusCell = (rowIndex, columnIndex) => {
    tableRef.current?.querySelector(`td[data-r="${rowIndex}"][data-c="${columnIndex}"]`)?.focus();
  };

  const handleCellKeyDown = (event, rowIndex, columnIndex) => {
    if (editingCell) return;
    const column = COLUMNS[columnIndex];
    if (event.key === 'Enter') {
      if (!column.readOnly) setEditingCell({ rowIndex, field: column.field });
      event.preventDefault();
      return;
    }
    const move = ARROW_MOVES[event.key];
    if (!move) {
      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !column.readOnly) setEditingCell({ rowIndex, field: column.field });
      return;
    }
    const nextRow = Math.max(0, Math.min(rows.length - 1, rowIndex + move[0]));
    const nextColumn = Math.max(0, Math.min(COLUMNS.length - 1, columnIndex + move[1]));
    if (nextRow === rowIndex && nextColumn === columnIndex) return;
    event.preventDefault();
    focusCell(nextRow, nextColumn);
  };

  const finishEdit = (rowIndex, field, value) => {
    setEditingCell(null);
    const row = rows[rowIndex];
    if (row[field] === value) return;
    setRows(rows.map((other, index) => (index === rowIndex ? { ...other, [field]: value } : other)));
    onSave?.(row.id, field, value);
  };

  const handleEditorKeyDown = (event, rowIndex, columnIndex) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.target.blur();
      setTimeout(() => focusCell(Math.min(rowIndex + 1, rows.length - 1), columnIndex), 50);
    }
    if (event.key === 'Escape') setEditingCell(null);
  };

  return (
    <Table
      ref={tableRef}
      className="tw:min-w-[1000px] tw:bg-background"
      containerClassName="tw:h-[calc(100vh-220px)] tw:rounded-sm tw:border tw:border-input"
    >
      <TableHeader sticky className="tw:z-10">
        <TableRow>
          {COLUMNS.map((column) => <TableHead key={column.field} className={cn('tw:select-none', column.widthClass)}>{column.label}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => (
          <TableRow key={row.id}>
            {COLUMNS.map((column, columnIndex) => {
              const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.field === column.field;
              const cellValue = row[column.field] || '';
              return (
                <TableCell
                  key={column.field}
                  data-r={rowIndex}
                  data-c={columnIndex}
                  tabIndex={column.readOnly ? -1 : 0}
                  onDoubleClick={() => !column.readOnly && setEditingCell({ rowIndex, field: column.field })}
                  onKeyDown={(event) => handleCellKeyDown(event, rowIndex, columnIndex)}
                  className={cn(
                    'tw:overflow-hidden tw:text-ellipsis tw:px-3 tw:py-1.5 tw:outline-none tw:focus:bg-primary/10 tw:focus:outline-2 tw:focus:-outline-offset-2 tw:focus:outline-primary',
                    column.widthClass,
                    column.readOnly ? 'tw:cursor-default tw:bg-muted tw:text-muted-foreground' : 'tw:cursor-cell tw:text-foreground',
                    isEditing && 'tw:p-0',
                  )}
                >
                  {isEditing ? (
                    <Input
                      autoFocus
                      defaultValue={cellValue}
                      onBlur={(event) => finishEdit(rowIndex, column.field, event.target.value)}
                      onKeyDown={(event) => handleEditorKeyDown(event, rowIndex, columnIndex)}
                      className="tw:h-full tw:rounded-none tw:border-2 tw:border-primary tw:px-2.5 tw:py-1"
                    />
                  ) : cellValue}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
