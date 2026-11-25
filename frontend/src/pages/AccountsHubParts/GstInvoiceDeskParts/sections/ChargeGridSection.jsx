import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { Grid, fmtDate, inr } from '../../ui';
import { num } from '../gstMath';

const gstRateText = (line) => (line.igstPct ? 'I ' + line.igstPct : line.cgstPct ? 'C+S ' + line.cgstPct * 2 : '0');

function LineButtons({ row, index, chargeLine }) {
  return (
    <span className="tw:inline-flex tw:gap-1">
      <Button variant="ghost" size="icon-sm" title="Edit" aria-label="Edit" onClick={() => chargeLine.editLine(row, index)}><Pencil className="tw:size-3" /></Button>
      <Button variant="ghost" size="icon-sm" title="Delete" aria-label="Delete" className="tw:text-destructive" onClick={() => chargeLine.removeLine(index)}><Trash2 className="tw:size-3" /></Button>
    </span>
  );
}

export default function ChargeGridSection({ desk }) {
  const { head, lines, calc, viewOnly, chargeLine } = desk;
  const figure = (index, key) => calc.lines[index] && calc.lines[index][key];
  const columns = [
    { label: '', render: (row, index) => (viewOnly ? null : <LineButtons row={row} index={index} chargeLine={chargeLine} />) },
    { label: 'Docket No', render: (row) => row.jobNo || head.jobNo },
    { label: 'Container', key: 'containerNo' },
    { label: 'Charge', render: (row) => <b>{row.charge}</b> },
    { label: 'SAC', key: 'sac' },
    { label: 'Unit', key: 'unit' },
    { label: 'Qty', right: true, key: 'qty' },
    { label: 'Rate', right: true, render: (row) => inr(row.rate) },
    { label: 'Amount', right: true, render: (row, index) => inr(figure(index, 'amount')) },
    { label: 'Disc.', right: true, render: (row) => (num(row.discount) ? inr(row.discount) : '') },
    { label: 'Cur / Ex', render: (row) => (row.currency && row.currency !== 'INR' ? row.currency + ' @ ' + row.exRate : 'INR') },
    { label: 'INR Amount', right: true, render: (row, index) => <b>{inr(figure(index, 'inrAmount'))}</b> },
    { label: 'GST %', right: true, render: (row, index) => calc.lines[index] && gstRateText(calc.lines[index]) },
    { label: 'IGST', right: true, render: (row, index) => inr(figure(index, 'igst')) },
    { label: 'CGST', right: true, render: (row, index) => inr(figure(index, 'cgst')) },
    { label: 'SGST', right: true, render: (row, index) => inr(figure(index, 'sgst')) },
    { label: 'Receipt', render: (row) => (row.receiptNo ? row.receiptNo + (row.receiptDate ? ' ' + fmtDate(row.receiptDate) : '') : '') },
    { label: 'Narration', key: 'narration', wrap: true },
  ];
  const foot = ['', 'Total', '', '', '', '', '', '', inr(calc.charge), '', '', inr(calc.gross), '', inr(calc.igst), inr(calc.cgst), inr(calc.sgst), '', ''];
  return (
    <Grid title={'Charge Information (' + lines.length + ')'} maxHeight={430} minHeight={230} empty="Add the charges above" activeKey={chargeLine.editIndex}
      rowKey={(row, index) => index} cols={columns} rows={lines} foot={foot} />
  );
}
