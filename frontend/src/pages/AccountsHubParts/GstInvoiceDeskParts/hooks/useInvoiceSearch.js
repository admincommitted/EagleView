import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { todayIso } from '../../ui';
import { accountsApi } from '../../accountsApi';
import { financialYearStart, num } from '../gstMath';
import { downloadEInvoice, printInvoice } from '../invoicePrint';

const FILTER_KEYS = ['from', 'to', 'partyType', 'party', 'by', 'no', 'status', 'remarks'];
const PRINT_GAP_MS = 1800;
const blankFilter = () => ({ from: financialYearStart(), to: todayIso(), partyType: '', party: '', by: 'invoice', no: '', status: '', remarks: '', all: false });
const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

export default function useInvoiceSearch(kindId) {
  const [filter, setFilter] = useState(blankFilter);
  const [rows, setRows] = useState(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [ticked, setTicked] = useState({});
  const [note, setNote] = useState('');

  const setFilterField = (key, value) => setFilter((old) => ({ ...old, [key]: value }));
  const resetFilter = () => setFilter(blankFilter());
  const chosen = (rows || []).filter((row) => ticked[row.id]);

  const run = async () => {
    setError('');
    const params = {};
    if (!filter.all) params.kind = kindId;
    for (const key of FILTER_KEYS) if (filter[key]) params[key] = filter[key];
    try {
      const result = await accountsApi.gstInvoiceSearch(params);
      setRows(result.rows); setMore(result.more);
    } catch (searchError) {
      setError(errorMessage(searchError)); setRows([]);
    }
  };
  useEffect(() => { run(); }, [kindId]);

  const toggleRow = (id) => setTicked((old) => ({ ...old, [id]: !old[id] }));
  const toggleAll = () => setTicked(chosen.length === (rows || []).length ? {} : Object.fromEntries((rows || []).map((row) => [row.id, true])));

  const bulkJson = async () => {
    setNote('');
    try {
      const result = await downloadEInvoice(chosen.map((row) => row.id), 'einvoice_bulk_' + todayIso() + '.json');
      setNote((result.json.length ? result.json.length + ' invoice(s) in the JSON - upload on the IRP bulk tool' : 'Nothing to export') + (result.skipped.length ? '. Left out: ' + result.skipped.join('; ') : ''));
    } catch (jsonError) {
      setNote(errorMessage(jsonError));
    }
  };
  const postTicked = async () => {
    setNote('Posting ' + chosen.length + ' invoice(s) to the GST portal...');
    try {
      const { results } = await accountsApi.gstInvoicePostGstn(chosen.map((row) => row.id));
      const failed = results.filter((result) => !result.ok);
      setNote((results.length - failed.length) + ' of ' + results.length + ' got an IRN' + (failed.length ? '. Not posted: ' + failed.map((result) => result.invoiceNo + ' (' + result.error + ')').join('; ') : ''));
      run();
    } catch (postError) {
      setNote(errorMessage(postError));
    }
  };
  const printTicked = async () => {
    for (const row of chosen) {
      await printInvoice(row.id);
      await wait(PRINT_GAP_MS);
    }
  };

  const netTotal = (rows || []).filter((row) => row.status !== 'Void').reduce((total, row) => total + (row.kind === 'creditnote' ? -1 : 1) * num(row.total), 0);
  return { filter, setFilter, setFilterField, resetFilter, rows, more, error, ticked, chosen, note, netTotal, run, toggleRow, toggleAll, bulkJson, postTicked, printTicked };
}
