import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { inr } from '../../ui';
import { accountsApi } from '../../accountsApi';
import { emptyLine, num, round2 } from '../gstMath';

const LEFT_TO_BILL = 0.009;
const blankSheetRow = () => ({ charge: '', sac: '', gstRate: 18, currency: 'INR', exRate: 1, qty: 1, buyRate: 0, sellRate: 0, buyInr: 0, sellInr: 0, actualCost: 0, billed: 0, toBill: 0, from: 'Added' });

const withAmounts = (row) => {
  const units = (num(row.qty) || 1) * (num(row.exRate) || 1);
  const sellInr = round2(num(row.sellRate) * units);
  return { ...row, sellInr, buyInr: round2(num(row.buyRate) * units), toBill: round2(sellInr - num(row.billed)) };
};

// a ticked line becomes an invoice line; a part-billed line brings only the balance
const invoiceLineOf = (row, jobNo) => {
  const partBilled = row.billed > LEFT_TO_BILL;
  const exRate = num(row.exRate) || 1;
  return {
    ...emptyLine(), jobNo, charge: row.charge, sac: row.sac || '', gstRate: row.gstRate, currency: row.currency || 'INR', exRate,
    qty: partBilled ? 1 : num(row.qty) || 1, rate: partBilled ? round2(row.toBill / exRate) : num(row.sellRate), narration: partBilled ? 'Balance of provisional ' + inr(row.sellInr) : '',
  };
};

// The cost sheet of a docket: proposed from the quotation / contract, charge rules and costs booked, or the sheet saved before
export default function useProvisionalSheet({ jobNo, partyName, onAdd }) {
  const [sheet, setSheet] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [ticked, setTicked] = useState({});

  const load = async (keepMessage) => {
    setError('');
    if (!keepMessage) setMsg('');
    try {
      const loaded = await accountsApi.gstInvoiceProvisional(jobNo);
      setSheet(loaded);
      setRows(loaded.lines.map((line) => ({ ...line })));
      // offered lines (cartage, costs outside the contract) come unticked
      setTicked(Object.fromEntries(loaded.lines.map((line, index) => [index, line.toBill > LEFT_TO_BILL && !line.optional])));
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  };
  useEffect(() => { if (jobNo) load(); }, [jobNo]);

  const changeRow = (index, key, value) => setRows((old) => old.map((row, rowIndex) => (rowIndex === index ? withAmounts({ ...row, [key]: value }) : row)));
  const removeRow = (index) => setRows((old) => old.filter((_, rowIndex) => rowIndex !== index));
  const addRow = () => setRows((old) => [...old, blankSheetRow()]);
  const toggleRow = (index, value) => setTicked((old) => ({ ...old, [index]: value }));

  const save = async () => {
    try {
      const result = await accountsApi.gstInvoiceSaveProvisional({ jobNo, partyName, lines: rows, remarks: sheet.remarks });
      setMsg('Sheet saved - ' + result.lines + ' charges');
      load(true);
    } catch (saveError) {
      setError(errorMessage(saveError));
    }
  };
  const addTicked = () => {
    const chosen = rows.filter((row, index) => ticked[index] && row.toBill > LEFT_TO_BILL);
    if (!chosen.length) { setError('Tick the charges to bill (with something left to bill)'); return; }
    onAdd(chosen.map((row) => invoiceLineOf(row, jobNo)));
  };

  const totals = rows.reduce((sum, row) => ({
    buy: sum.buy + num(row.buyInr), sell: sum.sell + num(row.sellInr), cost: sum.cost + num(row.actualCost), billed: sum.billed + num(row.billed), left: sum.left + Math.max(0, num(row.toBill)),
  }), { buy: 0, sell: 0, cost: 0, billed: 0, left: 0 });

  return { sheet, rows, error, msg, ticked, totals, changeRow, removeRow, addRow, toggleRow, save, addTicked };
}
