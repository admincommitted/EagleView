import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { errorMessage } from '@/services/axiosInstance';
import { fmtDate, inr } from '../../ui';
import { accountsApi } from '../../accountsApi';
import { FOREIGN_POS, calcInvoice, divisionOf, emptyHead, emptyLine, headFieldsOf, num } from '../gstMath';
import useInvoiceSetup from './useInvoiceSetup';
import useChargeLine from './useChargeLine';
import useInvoiceChecks from './useInvoiceChecks';
import useBulkDockets from './useBulkDockets';
import useInvoiceActions from './useInvoiceActions';

const URL_KEYS = ['voucher', 'inv', 'prev', 'job'];
const receivedNote = (invoice) => (invoice.received ? ' - ' + inr(invoice.received) + ' already received / credited against it' : '');

function openedMessage(invoice) {
  if (invoice.status === 'Void') return { bad: true, t: 'This invoice is VOID' + (invoice.voidReason ? ' - ' + invoice.voidReason : '') };
  if (invoice.createdBy === 'iCAFFE') return { t: 'Opened ' + invoice.invoiceNo + ' - loaded from iCAFFE, view only (print / mail work; for a change issue a credit / debit note)' + receivedNote(invoice) };
  return { t: 'Opened ' + invoice.invoiceNo + ' for Modify' + receivedNote(invoice) };
}

export default function useGstInvoiceDesk(kindId) {
  const [params, setParams] = useSearchParams();
  const activeBranch = useWorkspaceStore((state) => state.activeBranch);
  // 'All branches' in the top bar: the branch is picked on the form
  const myBranch = (activeBranch && !activeBranch.isAll && (activeBranch.branchCode || activeBranch.branch_code)) || '';
  const { meta, metaError, kind, our } = useInvoiceSetup(kindId);

  const [tab, setTab] = useState('entry');
  const [head, setHead] = useState(() => emptyHead(kindId, myBranch));
  const [lines, setLines] = useState([]);
  const [branches, setBranches] = useState([]);
  const [editId, setEditId] = useState(null);
  const [loaded, setLoaded] = useState(null);
  const [msg, setMsg] = useState(null);
  const [showPosting, setShowPosting] = useState(false);
  const [expenses, setExpenses] = useState(null);
  const [job, setJob] = useState(null);
  const [panel, setPanel] = useState(null);
  const [provisionalJob, setProvisionalJob] = useState('');

  const setField = (key, value) => setHead((old) => ({ ...old, [key]: value }));
  const chargeLine = useChargeLine({ head, kindId, meta, setLines, setMsg });

  const divisionAuto = divisionOf(head.jobNo) || divisionOf((head.dockets || [])[0]) || divisionOf((lines.find((line) => line.jobNo) || {}).jobNo);
  const division = head.division || divisionAuto;
  const checks = useInvoiceChecks({ head, lines, kind, kindId, myBranch, division, editId, setMsg });

  const reloadLoaded = async () => {
    if (!loaded) return;
    try { setLoaded(await accountsApi.gstInvoice(loaded.id)); } catch { /* keeps what is on the screen */ }
  };

  function openInvoice(invoice) {
    if (invoice.kind !== kindId) { setParams({ item: 'gst' + invoice.kind, inv: invoice.invoiceNo }); return; }
    setHead({ ...emptyHead(kindId, myBranch), ...headFieldsOf(invoice, kindId) });
    setLines(invoice.lines.map((line) => ({ ...line })));
    setEditId(invoice.id); setLoaded(invoice); setTab('entry'); chargeLine.resetLine();
    setMsg(openedMessage(invoice));
  }
  const openSearchResult = async (row) => {
    try { openInvoice(await accountsApi.gstInvoice(row.id)); } catch (error) { setMsg({ bad: true, t: errorMessage(error) }); }
  };

  function clear() {
    setHead(emptyHead(kindId, myBranch)); setLines([]); chargeLine.resetLine(); setEditId(null); setLoaded(null);
    setBranches([]); setJob(null); setExpenses(null); setMsg(null); setPanel(null);
    if (URL_KEYS.some((key) => params.get(key))) setParams({ item: 'gst' + kindId });
  }

  // switching kind from the menu = a fresh screen
  const firstKind = useRef(true);
  useEffect(() => {
    if (firstKind.current) { firstKind.current = false; return; }
    clear(); setTab('entry');
  }, [kindId]);

  // opened from a report / voucher (voucher=), from the search (inv=), "Credit Note" on an invoice (prev=),
  // or "GST Invoice" on the Shipment Registration docket (job=)
  const [voucherParam, invoiceParam, prevParam, jobParam] = URL_KEYS.map((key) => params.get(key));
  useEffect(() => {
    const openFromUrl = async () => {
      if (voucherParam) {
        try {
          const invoice = await accountsApi.gstInvoiceByVoucher(voucherParam);
          if (invoice) openInvoice(invoice);
          else setMsg({ bad: true, t: 'This voucher was not made from GST Invoice - open it from the voucher screens' });
        } catch (error) { setMsg({ bad: true, t: errorMessage(error) }); }
      } else if (invoiceParam) {
        try { const invoice = await accountsApi.gstInvoiceByNo(invoiceParam); if (invoice) openInvoice(invoice); } catch { /* nothing opens */ }
      } else if (prevParam) {
        try {
          const original = await accountsApi.gstInvoiceByNo(prevParam);
          if (!original) return;
          setHead({ ...emptyHead(kindId, myBranch), ...headFieldsOf({ ...original, kind: kindId }, kindId), prevInvoiceNo: original.invoiceNo, prevInvoiceDate: original.date, reason: '' });
          setLines(original.lines.map((line) => ({ ...line })));
          setMsg({ t: 'Copied from ' + original.invoiceNo + ' - change the lines to what is being ' + (kindId === 'creditnote' ? 'credited' : 'debited') });
        } catch { /* nothing is copied */ }
      } else if (jobParam) {
        try {
          const found = await accountsApi.gstInvoiceJob('docket', jobParam);
          setJob(found || null);
          setHead((old) => ({ ...old, jobNo: found ? found.jobNo : jobParam, hawbNo: (found && found.hawbNo) || old.hawbNo, mawbNo: (found && found.mawbNo) || old.mawbNo, branchCode: old.branchCode || (found && found.branchCode) || '' }));
          setMsg({ t: found ? 'Docket ' + found.jobNo + (found.party ? ' - ' + found.party : '') + (found.mawbNo ? ' - MAWB ' + found.mawbNo : '') + ' - pick the party and add the charges' : 'Docket ' + jobParam + ' not found' });
        } catch {
          setHead((old) => ({ ...old, jobNo: jobParam }));
        }
      }
    };
    openFromUrl();
  }, [voucherParam, invoiceParam, prevParam, jobParam]);

  // a bill loaded from iCAFFE opens for viewing only; its totals are the bill's own
  const viewOnly = !!(loaded && (loaded.viewOnly || loaded.createdBy === 'iCAFFE'));
  const calc = useMemo(() => {
    const figures = calcInvoice(head, lines, our, kind);
    if (!viewOnly || !loaded) return figures;
    return { ...figures, igst: num(loaded.igst), cgst: num(loaded.cgst), sgst: num(loaded.sgst), roundOff: num(loaded.roundOffAmt), total: num(loaded.total) };
  }, [head, lines, our, kind, viewOnly, loaded]);
  const lineCalc = useMemo(() => calcInvoice(head, chargeLine.line.charge ? [chargeLine.line] : [], our, kind).lines[0], [chargeLine.line, head, our, kind]);

  // ---- party
  const branchFields = (branch, old) => {
    const state = meta && branch.gstin ? meta.states.find((entry) => entry.code === String(branch.gstin).slice(0, 2))
      : meta && branch.state ? meta.states.find((entry) => entry.name.toUpperCase() === String(branch.state).toUpperCase()) : null;
    const foreign = branch.country && branch.country !== 'IN';
    const foreignSupply = foreign || kindId === 'overseas';
    return {
      address: branch.address || '', gstin: branch.gstin || '', stateName: state ? state.name : (branch.state || ''), stateCode: state ? state.code : '', email: branch.email || old.email || '',
      pos: foreignSupply ? FOREIGN_POS : state ? state.code : old.pos, posName: foreignSupply ? 'Foreign Country' : state ? state.name : old.posName,
      countryCode: foreign ? branch.country : old.countryCode, sez: branch.sez ? (old.sez || 'SEZ SUPPLIES WITH PAYMENT') : old.sez, gstExempt: branch.exempt || old.gstExempt,
    };
  };
  const pickBranch = (branchId) => {
    const branch = branches.find((entry) => String(entry.id) === branchId);
    if (branch) setHead((old) => ({ ...old, partyBranchId: branch.id, ...branchFields(branch, old) }));
  };
  const typeParty = (text) => setHead((old) => ({ ...old, partyName: text, partyId: null, ledgerId: null }));
  const pickParty = async (party) => {
    const branch = party.branches[0] || {};
    setBranches(party.branches);
    setHead((old) => ({ ...old, partyName: party.name, partyId: party.partyId || null, ledgerId: party.ledgerId || null, partyBranchId: branch.id || null, ...branchFields(branch, old) }));
    if (party.ledgerId) return;
    // iCAFFE: the invoice is made only on the party's account (ledger); look-alike accounts are never guessed
    try {
      const account = await accountsApi.gstInvoicePartyAccount({ partyId: party.partyId || '', name: party.name, gstin: branch.gstin || '' });
      if (account) setHead((old) => (old.partyName === party.name ? { ...old, ledgerId: account.ledgerId } : old));
      else setMsg({ bad: true, t: 'Party Account not created ! Make the ledger of ' + party.name + ' in Accounts > Masters > Ledger Account, then pick the party again.' });
    } catch (error) {
      setMsg({ bad: true, t: errorMessage(error) + ' (type the account name in Party and pick the ledger from the list)' });
    }
  };
  const changeGstin = (value) => {
    const gstin = String(value || '').toUpperCase();
    const state = meta && /^\d{2}/.test(gstin) ? meta.states.find((entry) => entry.code === gstin.slice(0, 2)) : null;
    setHead((old) => ({
      ...old, gstin,
      ...(state ? { stateName: state.name, stateCode: state.code, pos: old.pos === FOREIGN_POS ? old.pos : state.code, posName: old.pos === FOREIGN_POS ? old.posName : state.name } : {}),
    }));
  };
  const changePlaceOfSupply = (code) => {
    const state = meta.states.find((entry) => entry.code === code);
    setHead((old) => ({ ...old, pos: code, posName: code === FOREIGN_POS ? 'Foreign Country' : state ? state.name : '' }));
  };
  const changeCurrency = (code) => {
    const exRate = code === 'INR' ? 1 : chargeLine.currencyRate(code);
    setHead((old) => ({ ...old, currency: code, exRate }));
    chargeLine.setLine((old) => ({ ...old, currency: code, exRate }));
  };

  // ---- docket / house no
  const findJob = async () => {
    const docketNo = head.docketBy === 'hawb' ? head.hawbNo : head.jobNo;
    if (!String(docketNo || '').trim()) return;
    try {
      const found = await accountsApi.gstInvoiceJob(head.docketBy, docketNo.trim());
      setJob(found);
      if (!found) { setMsg({ bad: true, t: 'No job found for ' + docketNo + ' - the invoice can still be saved with this number' }); return; }
      setHead((old) => (old.bulk
        ? { ...old, dockets: old.dockets.includes(found.jobNo) ? old.dockets : [...old.dockets, found.jobNo], jobNo: '', hawbNo: '' }
        : { ...old, jobNo: found.jobNo, hawbNo: found.hawbNo || old.hawbNo, mawbNo: found.mawbNo || old.mawbNo, branchCode: old.branchCode || found.branchCode || '' }));
      setMsg({ t: found.dir + ' job ' + found.jobNo + (found.party ? ' - ' + found.party : '') + (found.mawbNo ? ' - MAWB ' + found.mawbNo : '') + (head.partyName ? '' : ' - type the party or pick "' + (found.party || '') + '"') });
    } catch (error) {
      setMsg({ bad: true, t: errorMessage(error) });
    }
  };
  const showExpenses = async () => {
    if (!head.jobNo) { setMsg({ bad: true, t: 'Enter the docket no first' }); return; }
    try { setExpenses(await accountsApi.gstInvoiceExpenses(head.jobNo)); } catch (error) { setMsg({ bad: true, t: errorMessage(error) }); }
  };
  const billExpense = (expense) => {
    chargeLine.setLine({ ...emptyLine(), charge: expense.charge, rate: expense.amount, jobNo: head.jobNo, currency: 'INR', exRate: 1, gstRate: kindId === 'reimbursable' ? 0 : 18 });
    setExpenses(null);
    setMsg({ t: 'Check the rate and GST % of ' + expense.charge + ', then Add' });
  };
  const openProvisional = (docketNo) => { setProvisionalJob(docketNo); setPanel('prov'); };
  const findPreviousInvoice = async () => {
    if (!head.prevInvoiceNo) return;
    let original = null;
    try { original = await accountsApi.gstInvoiceByNo(head.prevInvoiceNo); } catch { /* treated as not found */ }
    if (!original) { setMsg({ bad: true, t: 'Invoice ' + head.prevInvoiceNo + ' not found' }); return; }
    const partyFields = ['partyType', 'partyName', 'partyId', 'ledgerId', 'address', 'gstin', 'stateName', 'stateCode', 'pos', 'posName', 'jobNo', 'hawbNo', 'mawbNo', 'currency', 'exRate'];
    setHead((old) => ({
      ...old, prevInvoiceDate: original.date,
      ...(old.partyName ? {} : headFieldsOf(Object.fromEntries(partyFields.map((key) => [key, original[key]])), kindId)),
    }));
    setMsg({ t: 'Against ' + original.invoiceNo + ' of ' + fmtDate(original.date) + ' - ' + original.partyName + ' - ' + inr(original.total) });
  };

  const bulk = useBulkDockets({ head, setHead, lines, setLines, setMsg, setPanel });
  const actions = useInvoiceActions({ head, lines, division, kindId, myBranch, editId, setEditId, loaded, setLoaded, reloadLoaded, setMsg, setPanel, clear });

  const isVoid = !!(loaded && loaded.status === 'Void');
  const irnLive = !!(loaded && loaded.irn && loaded.irnStatus !== 'Cancelled');
  const togglePanel = (name) => setPanel((open) => (open === name ? null : name));
  const startNote = (item) => setParams({ item, prev: loaded.invoiceNo });

  return {
    kindId, kind, meta, metaError, our, myBranch, tab, setTab,
    head, setHead, setField, lines, branches, editId, loaded, msg, setMsg, job, expenses, setExpenses, panel, setPanel, togglePanel, provisionalJob,
    division, viewOnly, isVoid, irnLive, calc, lineCalc, showPosting, setShowPosting, ...checks,
    chargeLine, bulk, actions,
    openSearchResult, clear, reloadLoaded, pickBranch, typeParty, pickParty, changeGstin, changePlaceOfSupply, changeCurrency,
    findJob, showExpenses, billExpense, openProvisional, findPreviousInvoice, startNote,
  };
}
