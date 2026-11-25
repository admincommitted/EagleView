import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { accountsApi } from '../../accountsApi';
import { fmtDate, inr, lookup, todayIso, useBalance } from '../../ui';
import { ledgerByName, readExcel, sampleExcel } from '../../extras';
import { num, plural, r2, skippedNote, sumOf } from '../amounts';
import { BANK_GROUPS, divFrom, nextVoucherNo, sampleFileName, voucherIdFromSave } from '../voucherConfig';
import { useMyBranches } from './useMyBranches';
import { useNextVoucherNumber } from './useNextVoucherNumber';

const blankLine = () => ({
  ledgerId: '', amount: '', dc: 'Dr', refNo: '', refDate: '', refAmt: '', jobNo: '', costCentreId: '', remarks: '',
  isTds: false, tdsNatureId: '', tdsBase: '', isGst: false, gstRate: '18', gstKind: 'input', gstPlace: 'intra', sac: '',
});

// IS GST: GST lines are made from the line (input or output, CGST + SGST or IGST). They carry _parent so they follow
// their line on edit / delete.
let lineSeq = 1;
const nextLineKey = () => 'L' + (lineSeq++);
const gstSplit =(amount, rate, place) => {
  const gst = r2(num(amount) * num(rate) / 100);
  return place === 'inter' ? [['igst', gst]] : [['cgst', r2(gst / 2)], ['sgst', r2(gst - r2(gst / 2))]];
};

const EXCEL_COLUMNS = [
  { key: 'account', label: 'Account Name', aliases: ['account', 'ledger', 'party'] }, { key: 'debit', label: 'Debit', aliases: ['dr amount'] },
  { key: 'credit', label: 'Credit', aliases: ['cr amount'] }, { key: 'dc', label: 'Dr/Cr', aliases: ['drcr', 'type'] }, { key: 'amount', label: 'Amount' },
  { key: 'refNo', label: 'Ref No', aliases: ['reference', 'bill no'] }, { key: 'refDate', label: 'Ref Date', date: true },
  { key: 'refAmt', label: 'Ref Amount', aliases: ['ref amt'] }, { key: 'jobNo', label: 'Docket No', aliases: ['job no', 'job', 'docket'] },
  { key: 'remarks', label: 'Narration', aliases: ['remarks', 'line narration'] },
];
const EXCEL_EXAMPLE = [
  ['AIR FREIGHT EXPENSE', 10000, '', '', '', 'XYZ-55', '30/10/2026', 11800, 'AE/001', 'Freight Oct'],
  ['XYZ AIRLINES', '', 10000, '', '', 'XYZ-55', '', '', 'AE/001', ''],
];

const signedTotal = (lines) => r2(sumOf(lines, (line) => (line.dc === 'Dr' ? 1 : -1) * num(line.amount)));

const taxLedgersOrNull = async () => {
  try {
    return await accountsApi.voucherDeskTaxLedgers();
  } catch {
    return null;
  }
};

// a saved voucher (Modify / Copy as new) comes in as Dr / Cr lines in rupees, the foreign currency kept per line
const linesOf = (voucher) => (voucher.lines || []).map((line) => ({
  ledgerId: line.ledgerId, amount: String(line.amount), dc: line.dc, refNo: '', jobNo: voucher.jobNo || '', costCentreId: line.costCentreId || '', remarks: line.remarks || '',
  _fx: line.currency && line.currency !== 'INR' ? { currency: line.currency, amountFcy: line.amountFcy, roe: line.roe } : null,
}));

// journal / contra / inter branch: Account - Amount - Dr/Cr lines
export function useLinesForm({ cfg, typeId, initial, editId, onSaved }) {
  const editing = !!(initial && editId);
  const [header, setHeader] = useState(() => ({
    date: editing ? String(initial.date).slice(0, 10) : todayIso(), voucherNumber: editing ? initial.voucherNumber : '', narration: initial?.narration || '',
    branchCode: initial?.branchCode || '', currency: 'INR', roe: '1', refNo: initial?.refNo || '',
  }));
  const branches = useMyBranches();
  // own branch (the voucher's branch); for an inter-branch transfer header.branchCode is the branch it goes TO
  const [own, setOwn] = useState(() => (editing && !cfg.branch ? initial.branchCode || '' : ''));
  const [look, setLook] = useState({ all: [], banks: [], cc: [], tds: [], tax: null });
  const [line, setLine] = useState(blankLine);
  const [editAt, setEditAt] = useState(-1);
  const [lines, setLines] = useState(() => (initial ? linesOf(initial) : []));
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const balance = useBalance(line.ledgerId);

  useEffect(() => { if (!editId && !own && branches.mine) setOwn(branches.mine); }, [branches.mine]);
  useEffect(() => { if (!cfg.branch) setHeader((current) => ({ ...current, branchCode: own })); }, [own]);
  useEffect(() => {
    const loadLookups = async () => {
      const [all, banks, cc, tds, tax] = await Promise.all([
        lookup('ledgers'), lookup('ledgers-in?groups=' + encodeURIComponent(BANK_GROUPS)), lookup('costcentres'), lookup('tdsnatures'),
        cfg.banksOnly ? null : taxLedgersOrNull(),
      ]);
      setLook({ all, banks, cc, tds: tds || [], tax });
    };
    loadLookups();
  }, [typeId]);

  const division = header.division || divFrom(lines.find((item) => item.jobNo)?.jobNo);
  useNextVoucherNumber({
    enabled: !editId, keepTyped: true, setHeader,
    fetchNumber: () => nextVoucherNo(typeId, { division, branch: own, date: header.date, ledgers: lines.map((item) => item.ledgerId).filter(Boolean).join(',') }),
    deps: [typeId, division, own, header.date, lines.length],
  });

  const ledgerList = cfg.banksOnly && look.banks.length ? look.banks : look.all;
  const nameOf = (id) => look.all.find((ledger) => String(ledger.id) === String(id))?.name || '';
  const costCentreName = (id) => look.cc.find((centre) => String(centre.id) === String(id))?.name || '';
  const foreign = header.currency !== 'INR';
  const inrOf = (item) => r2(foreign ? num(item.amount) * num(header.roe) : num(item.amount));
  const dr = r2(sumOf(lines.filter((item) => item.dc === 'Dr'), inrOf));
  const cr = r2(sumOf(lines.filter((item) => item.dc === 'Cr'), inrOf));
  const tdsNature = (id) => look.tds.find((nature) => String(nature.id) === String(id));

  const setHeaderField = (key) => (value) => setHeader((current) => ({ ...current, [key]: value }));
  const setCurrency = (currency) => setHeader((current) => ({ ...current, currency, roe: currency === 'INR' ? '1' : current.roe }));
  const setLineField = (key) => (value) => setLine((current) => ({ ...current, [key]: value }));
  // IS TDS: amount = TDS on amount x section rate, posted to TDS Payable on the Cr side
  const setTds = (patch) => setLine((current) => {
    const next = { ...current, ...patch };
    if (next.isTds) {
      const nature = tdsNature(next.tdsNatureId);
      if (nature && num(next.tdsBase)) next.amount = String(Math.round(num(next.tdsBase) * num(nature.rate) / 100));
      if (!next.ledgerId && look.tax?.tdsPayable) next.ledgerId = look.tax.tdsPayable;
      if (patch.isTds) next.dc = 'Cr';
    }
    return next;
  });
  const toggleTds = (checked) => setTds({ isTds: checked, isGst: checked ? false : line.isGst });
  const toggleGst = (checked) => setLine((current) => ({ ...current, isGst: checked, isTds: checked ? false : current.isTds }));

  const gstPreview = line.isGst && num(line.amount) ? gstSplit(line.amount, line.gstRate, line.gstPlace) : [];
  const gstLinesOf = (parent, key) => {
    if (!parent.isGst || !num(parent.gstRate) || !look.tax) return [];
    const tax = look.tax;
    const input = parent.gstKind !== 'output';
    const ledgers = { igst: input ? tax.inputIgst : tax.outputIgst, cgst: input ? tax.inputCgst : tax.outputCgst, sgst: input ? tax.inputSgst : tax.outputSgst };
    const shownRate = parent.gstPlace === 'inter' ? parent.gstRate : num(parent.gstRate) / 2;
    return gstSplit(parent.amount, parent.gstRate, parent.gstPlace).filter(([, amount]) => amount > 0).map(([kind, amount]) => ({
      ...blankLine(), ledgerId: ledgers[kind], amount: String(amount), dc: parent.dc, jobNo: parent.jobNo, costCentreId: parent.costCentreId,
      remarks: (input ? 'Input ' : 'Output ') + kind.toUpperCase() + ' ' + shownRate + '% on ' + inr(num(parent.amount)) + (parent.sac ? ' SAC ' + parent.sac : ''), _parent: key,
    }));
  };

  const add = () => {
    setMessage('');
    if (!line.ledgerId) return setMessage('Choose the account');
    if (!num(line.amount)) return setMessage('Enter the amount');
    if (line.isTds && !line.tdsNatureId) return setMessage('Choose the TDS section');
    if (line.isTds && !num(line.tdsBase)) return setMessage('Enter the amount TDS is on');
    if (line.isGst && !look.tax) return setMessage('GST ledgers could not be set up - check the Duties & Taxes group');
    if (line.refAmt && !(num(line.refAmt) > 0)) return setMessage('Ref amount must be a number');
    const key = line._key || nextLineKey();
    const added = { ...line, _key: key };
    const gstLines = gstLinesOf(added, key);
    let next;
    if (editAt >= 0) {
      const oldKey = lines[editAt]._key;
      const isOldGst = (item) => oldKey && item._parent === oldKey;
      const rest = lines.filter((item, index) => index !== editAt && !isOldGst(item));
      const position = lines.slice(0, editAt).filter((item) => !isOldGst(item)).length;
      next = [...rest.slice(0, position), added, ...gstLines, ...rest.slice(position)];
    } else {
      next = [...lines, added, ...gstLines];
    }
    setLines(next);
    setEditAt(-1);
    // the next line starts with the difference on the other side
    const difference = signedTotal(next);
    setLine({ ...blankLine(), dc: difference > 0 ? 'Cr' : 'Dr', amount: difference ? String(Math.abs(difference)) : '', jobNo: line.jobNo, costCentreId: line.costCentreId });
  };
  const removeLine = (index) => {
    const key = lines[index]._key;
    setLines((list) => list.filter((item, position) => position !== index && !(key && item._parent === key)));
    if (editAt === index) { setEditAt(-1); setLine(blankLine()); }
  };
  const editLine = (item, index) => {
    if (item._parent) return setMessage('This GST line comes from the line above it - edit that line');
    setLine(item);
    setEditAt(index);
  };

  const readXl = async (file) => {
    setMessage('');
    try {
      const sheetRows = await readExcel(file, EXCEL_COLUMNS);
      const bad = [];
      const read = [];
      for (const row of sheetRows) {
        const ledger = ledgerByName(ledgerList, row.account);
        let dc = /^c/i.test(row.dc) ? 'Cr' : /^d/i.test(row.dc) ? 'Dr' : '';
        let amount = num(row.amount);
        if (num(row.debit)) { dc = 'Dr'; amount = num(row.debit); } else if (num(row.credit)) { dc = 'Cr'; amount = num(row.credit); }
        if (!ledger) { bad.push('row ' + row._row + ' ("' + row.account + '" not found)'); continue; }
        if (!(amount > 0)) { bad.push('row ' + row._row + ' (no amount)'); continue; }
        if (!dc) { bad.push('row ' + row._row + ' (Dr / Cr missing)'); continue; }
        read.push({ ...blankLine(), _key: nextLineKey(), ledgerId: ledger.id, dc, amount: String(amount), refNo: row.refNo, refDate: row.refDate, refAmt: row.refAmt ? String(num(row.refAmt)) : '', jobNo: row.jobNo, remarks: row.remarks });
      }
      if (read.length) setLines((list) => [...list, ...read]);
      const difference = signedTotal(read);
      const differs = difference ? ' - they differ by ' + inr(Math.abs(difference)) + ' ' + (difference > 0 ? 'Dr' : 'Cr') : '';
      setMessage((read.length ? 'Read ' + plural(read.length, 'line') + ' from Excel' + differs : 'Nothing read') + skippedNote(bad));
    } catch (error) {
      setMessage('Could not read the Excel: ' + error.message);
    }
  };
  const downloadSample = () => sampleExcel(sampleFileName(cfg.title), EXCEL_COLUMNS, EXCEL_EXAMPLE);

  // the remarks the TDS Payable report reads ("TDS 194C @2% on ...")
  const lineRemarks = (item) => {
    const nature = item.isTds ? tdsNature(item.tdsNatureId) : null;
    return [
      item.refNo && 'Ref ' + item.refNo, item.refDate && 'dt ' + fmtDate(item.refDate), num(item.refAmt) && 'amt ' + inr(num(item.refAmt)),
      nature && 'TDS ' + nature.section + ' @' + nature.rate + '% on ' + inr(num(item.tdsBase)),
      item.isGst && !item._parent && 'GST ' + item.gstRate + '% ' + (item.gstKind === 'output' ? 'output' : 'input') + (item.sac ? ' SAC ' + item.sac : ''),
      item.remarks,
    ].filter(Boolean).join(' ') || null;
  };

  const save = async () => {
    setMessage('');
    if (!header.voucherNumber) return setMessage('Enter the voucher no');
    if (!own) return setMessage('Choose the branch this voucher belongs to');
    if (cfg.branch && !header.branchCode) return setMessage('Choose the branch the transfer goes to');
    if (cfg.branch && header.branchCode === own) return setMessage('The transfer has to go to another branch');
    if (lines.length < 2) return setMessage('Add at least two accounts');
    if (Math.abs(dr - cr) > 0.01) return setMessage('Debit and credit must be equal before saving');
    const details = lines.map((item) => ({
      ledgerId: item.ledgerId, dc: item.dc, amount: inrOf(item), remarks: lineRemarks(item), costCentreId: item.costCentreId || null,
      ...(foreign ? { currency: header.currency, amountFcy: num(item.amount), roe: num(header.roe) } : (item._fx || {})),
    }));
    const narration = header.narration || (cfg.branch ? 'Inter branch transfer to ' + header.branchCode : '');
    setSaving(true);
    try {
      const body = {
        voucherTypeId: typeId, voucherNumber: header.voucherNumber, division: division || null, ownBranch: own || null, date: header.date, narration,
        refNo: header.refNo || null, jobNo: lines.find((item) => item.jobNo)?.jobNo || null, branchCode: header.branchCode || null, details,
      };
      if (editId) {
        await accountsApi.voucherDeskUpdate(editId, body);
        onSaved(editId);
      } else {
        onSaved(voucherIdFromSave(await accountsApi.postVoucher(body)));
      }
    } catch (error) {
      setMessage('Not saved: ' + errorMessage(error));
    }
    setSaving(false);
  };

  return {
    header, setHeaderField, setCurrency, branches, own, setOwn, look, ledgerList, division, foreign, balance,
    line, setLineField, setTds, toggleTds, toggleGst, gstPreview, tdsNature, editAt,
    lines, inrOf, dr, cr, nameOf, costCentreName, add, removeLine, editLine, readXl, downloadSample, message, saving, save,
  };
}
