import { errorMessage } from '@/services/axiosInstance';
import { accountsApi } from '../../accountsApi';
import { emptyLine } from '../gstMath';

const chargeKey = (docketNo, charge) => String(docketNo || '').toUpperCase() + '|' + String(charge).toUpperCase();

// Bulk invoice (one bill for several dockets) and charges brought in from the provisional / cost sheets
export default function useBulkDockets({ head, setHead, lines, setLines, setMsg, setPanel }) {
  // iCAFFE: Bulk Invoice needs the party (and its account) first, then opens the "Bulk invoice" popup
  const setBulk = (on) => {
    if (on && !String(head.partyName || '').trim()) { setMsg({ bad: true, t: 'Please Select Party' }); return; }
    if (on && !head.ledgerId) { setMsg({ bad: true, t: 'Party Account not created !' }); return; }
    setHead((old) => ({
      ...old, bulk: on,
      dockets: on ? (old.dockets.length ? old.dockets : old.jobNo ? [old.jobNo] : []) : [],
      jobNo: on ? '' : (old.dockets[0] || old.jobNo),
    }));
    setPanel(on ? 'dockets' : null);
  };

  const removeDocket = (docketNo) => setHead((old) => ({ ...old, dockets: old.dockets.filter((entry) => entry !== docketNo) }));

  // Ok on the popup: each ticked docket's cost sheet into the grid, docket-wise; a charge already there for that docket is skipped
  const addBulkDockets = async (dockets) => {
    if (!dockets.length) { setMsg({ bad: true, t: 'No docket records selected.' }); return false; }
    try {
      const sheets = await accountsApi.gstInvoiceBulkCost(dockets);
      const have = new Set(lines.map((line) => chargeKey(line.jobNo, line.charge)));
      const added = []; const duplicates = []; const withoutSheet = [];
      for (const sheet of sheets) {
        if (!sheet.lines.length) { withoutSheet.push(sheet.docketNo); continue; }
        const skipped = [];
        for (const line of sheet.lines) {
          const key = sheet.docketNo + '|' + line.charge;
          if (have.has(key)) { skipped.push(line.charge); continue; }
          have.add(key);
          added.push({ ...emptyLine(), ...line });
        }
        if (skipped.length) duplicates.push('The following charges already exist for docket ' + sheet.docketNo + ': ' + skipped.join(', '));
      }
      setLines((old) => [...old, ...added]);
      setHead((old) => ({ ...old, dockets: [...old.dockets, ...dockets.filter((docketNo) => !old.dockets.includes(docketNo))] }));
      setMsg({
        bad: !!(duplicates.length || withoutSheet.length),
        t: [added.length + ' charge(s) added from the cost sheet of ' + dockets.length + ' docket(s)', ...duplicates,
          withoutSheet.length ? 'No provisional cost sheet on ' + withoutSheet.join(', ') + ' - add its charges by hand or make the sheet' : ''].filter(Boolean).join('. '),
      });
      return true;
    } catch (error) {
      setMsg({ bad: true, t: errorMessage(error) });
      return false;
    }
  };

  const addFromSheet = (sheetLines) => {
    setLines((old) => [...old, ...sheetLines]);
    setMsg({ t: sheetLines.length + ' charge(s) added from the provisional sheet of ' + sheetLines[0].jobNo });
    setPanel(null);
  };

  return { setBulk, removeDocket, addBulkDockets, addFromSheet };
}
