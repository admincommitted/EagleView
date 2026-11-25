import { useState } from 'react';
import { FOREIGN_POS, emptyLine, num } from '../gstMath';

export const ALL_DOCKETS = '*ALL*';

// the charge being typed (or edited) above the grid, and Add / Update into the invoice lines
export default function useChargeLine({ head, kindId, meta, setLines, setMsg }) {
  const [line, setLine] = useState(emptyLine());
  const [editIndex, setEditIndex] = useState(-1);

  const setLineField = (key, value) => setLine((old) => ({ ...old, [key]: value }));
  const resetLine = () => { setLine(emptyLine()); setEditIndex(-1); };

  const pickCharge = (charge) => setLine((old) => ({
    ...old, charge: charge.name, sac: charge.sac || old.sac,
    gstRate: charge.exempt ? 0 : charge.gstRate != null && charge.gstRate !== '' ? Number(charge.gstRate) : old.gstRate,
  }));

  // export (overseas / foreign place of supply) invoices take the export rate of the currency
  const currencyRate = (code) => {
    const currency = meta && meta.currencies.find((entry) => entry.code === code);
    if (!currency) return 1;
    return (kindId === 'overseas' || head.pos === FOREIGN_POS ? currency.exportRate : currency.importRate) || 1;
  };
  const setLineCurrency = (code) => setLine((old) => ({ ...old, currency: code, exRate: code === 'INR' ? 1 : currencyRate(code) }));

  const addLine = () => {
    if (!String(line.charge).trim()) { setMsg({ bad: true, t: 'Choose the charge' }); return; }
    if (!(num(line.rate) * (num(line.qty) || 1))) { setMsg({ bad: true, t: 'Enter the rate' }); return; }
    if (head.bulk && !(line.jobNo && (line.jobNo === ALL_DOCKETS || head.dockets.includes(line.jobNo)))) {
      setMsg({ bad: true, t: 'Bulk invoice: choose the docket of this charge (or all dockets)' }); return;
    }
    const row = { ...line, jobNo: line.jobNo || head.jobNo, charge: String(line.charge).toUpperCase().trim() };
    if (head.bulk && line.jobNo === ALL_DOCKETS && editIndex < 0) setLines((lines) => [...lines, ...head.dockets.map((docketNo) => ({ ...row, jobNo: docketNo }))]);
    else if (editIndex >= 0) setLines((lines) => lines.map((old, index) => (index === editIndex ? { ...row, jobNo: row.jobNo === ALL_DOCKETS ? old.jobNo : row.jobNo } : old)));
    else setLines((lines) => [...lines, row]);
    setLine({ ...emptyLine(), currency: line.currency, exRate: line.exRate, jobNo: head.bulk ? line.jobNo : '' });
    setEditIndex(-1);
    setMsg(null);
  };

  const editLine = (row, index) => { setLine({ ...row }); setEditIndex(index); };
  const removeLine = (index) => {
    setLines((lines) => lines.filter((_, lineIndex) => lineIndex !== index));
    if (editIndex === index) resetLine();
  };

  return { line, setLine, setLineField, editIndex, resetLine, pickCharge, currencyRate, setLineCurrency, addLine, editLine, removeLine };
}
