import { useEffect, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Button, Checkbox, Input } from '@/components/ui';
import { ActionBar, Grid, LedgerPicker, lookup } from '../../ui';
import { accountsApi } from '../../accountsApi';
import { CheckField } from '../../GstInvoiceDeskParts/sections/formParts';
import { Stat } from './masterParts';

const isMapped = (charge) => charge.ledgerId && charge.expenseLedgerId;

function StatusBadge({ charge, edited }) {
  if (edited) return <Badge variant="warning">Changed</Badge>;
  return isMapped(charge) ? <Badge variant="success">OK</Badge> : <Badge variant="danger">Missing</Badge>;
}

// which income / expense ledger every billing charge posts to (CSR posting)
export function MapCsrScreen() {
  const [rows, setRows] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [edits, setEdits] = useState({});
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try { setRows(await accountsApi.gstCharges()); } catch (error) { setMsg('Not loaded: ' + errorMessage(error)); }
  };
  useEffect(() => {
    const loadLedgers = async () => setLedgers(await lookup('ledgers'));
    load();
    loadLedgers();
  }, []);

  const valueOf = (charge, key) => (edits[charge.id] && key in edits[charge.id] ? edits[charge.id][key] : charge[key]);
  const change = (charge, key, value) => setEdits((old) => ({ ...old, [charge.id]: { ...(old[charge.id] || {}), [key]: value } }));
  const editedCount = Object.keys(edits).length;

  const saveAll = async () => {
    const ids = Object.keys(edits);
    if (!ids.length) { setMsg('Nothing changed'); return; }
    try {
      for (const id of ids) {
        const charge = rows.find((row) => String(row.id) === id);
        await accountsApi.mastersUpdateGstCharge(id, { ...charge, ...edits[id] });
      }
      setEdits({});
      setMsg('Saved ' + ids.length + ' charges');
      load();
    } catch (error) {
      setMsg('Not saved: ' + errorMessage(error));
    }
  };

  const unmapped = rows.filter((charge) => !isMapped(charge)).length;
  const shown = rows.filter((charge) => (!onlyMissing || !valueOf(charge, 'ledgerId') || !valueOf(charge, 'expenseLedgerId')) && (!query || String(charge.chargeName).toLowerCase().includes(query.toLowerCase())));
  const columns = [
    { label: 'Charge', render: (charge) => <b>{charge.chargeName}</b> },
    { label: 'SAC', render: (charge) => charge.sacCode || '' },
    { label: 'GST %', right: true, render: (charge) => (charge.gstRate != null ? Number(charge.gstRate) : '') },
    { label: 'Income ledger (billing)', w: '28%', render: (charge) => <LedgerPicker id={'in' + charge.id} list={ledgers} value={valueOf(charge, 'ledgerId') || ''} onChange={(value) => change(charge, 'ledgerId', value)} placeholder="Income ledger" /> },
    { label: 'Expense ledger (vendor bills)', w: '28%', render: (charge) => <LedgerPicker id={'ex' + charge.id} list={ledgers} value={valueOf(charge, 'expenseLedgerId') || ''} onChange={(value) => change(charge, 'expenseLedgerId', value)} placeholder="Expense ledger" /> },
    { label: 'RCM', render: (charge) => <Checkbox aria-label="RCM" checked={!!Number(valueOf(charge, 'rcm'))} onCheckedChange={(value) => change(charge, 'rcm', value === true ? 1 : 0)} /> },
    { label: '', render: (charge) => <StatusBadge charge={charge} edited={!!edits[charge.id]} /> },
  ];

  return (
    <div className="tw:flex tw:flex-col tw:gap-2.5">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-6 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:px-3.5 tw:py-2.5">
        <Stat label="Charges">{rows.length}</Stat>
        <Stat label="Fully mapped">{rows.length - unmapped}</Stat>
        <Stat label="Need a ledger"><span className={unmapped ? 'tw:text-destructive' : 'tw:text-success'}>{unmapped}</span></Stat>
        <span className="tw:min-w-[220px] tw:flex-1 tw:text-[11.5px] tw:text-muted-foreground">When a job is billed (CSR posting) each charge posts to its income ledger; vendor bills for the same charge post to its expense ledger.</span>
      </div>
      <ActionBar note={msg}>
        <Button variant="success" size="lg" onClick={saveAll} disabled={!editedCount}><Save /> Save changes {editedCount ? '(' + editedCount + ')' : ''}</Button>
        <Button size="lg" onClick={() => { setEdits({}); setMsg(''); }}><RotateCcw /> Undo</Button>
        <CheckField label="Only charges without a ledger" checked={onlyMissing} onCheckedChange={setOnlyMissing} />
        <Input data-allow-text value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search charge" className="tw:w-full tw:sm:ml-auto tw:sm:w-[200px]" />
      </ActionBar>
      <Grid title="Charge to ledger mapping" maxHeight="calc(100vh - 380px)" rows={shown} rowKey={(charge) => charge.id}
        empty={rows.length ? 'No charge matches' : 'No charges yet - add them in Masters, GST Charges'} cols={columns} />
    </div>
  );
}
