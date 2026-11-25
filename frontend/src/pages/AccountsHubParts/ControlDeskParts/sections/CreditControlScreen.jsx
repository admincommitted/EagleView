import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, DateInput, Input, SelectBox, Button } from '@/components/ui';
import { ActionBar, Grid, Money, Sheet, fmtDate, inr, todayIso } from '../../ui';
import { accountsApi } from '../../accountsApi';
import { CheckField } from '../../GstInvoiceDeskParts/sections/formParts';
import { toExcel } from '../controlUtils';
import CreditPartyPanel from './CreditPartyPanel';
import Tiles from './Tiles';

const RISK_VARIANT = { High: 'danger', Medium: 'warning', Low: 'success', None: 'neutral' };
const HIGH_USE_PCT = 80;
const EXCEL_COLUMNS = [['name', 'Customer'], ['totalOut', 'Outstanding'], ['creditLimit', 'Limit'], ['utilisationPct', 'Use %'], ['creditDays', 'Credit days'],
  [(row) => row.buckets.notDue, 'Not due'], [(row) => row.buckets.b15, '1-15'], [(row) => row.buckets.b30, '16-30'], [(row) => row.buckets.b60, '31-60'], [(row) => row.buckets.b90, '60+'], ['risk', 'Risk'], ['riskWhy', 'Why']];

function LimitUse({ client }) {
  if (!client.creditLimit) return <span className="tw:text-[10.5px] tw:text-muted-foreground">No limit set</span>;
  const used = client.utilisationPct || 0;
  const barTone = client.overLimit ? 'tw:bg-destructive' : used > HIGH_USE_PCT ? 'tw:bg-warning' : 'tw:bg-success';
  return (
    <div title={inr(client.totalOut) + ' of ' + inr(client.creditLimit)}>
      <div className="tw:h-1.5 tw:overflow-hidden tw:rounded-sm tw:bg-slate-200">
        <div style={{ '--bar-w': Math.min(100, used) + '%' }} className={cn('tw:h-full tw:w-(--bar-w)', barTone)} />
      </div>
      <div className={cn('tw:text-[10px]', client.overLimit ? 'tw:font-extrabold tw:text-destructive' : 'tw:text-muted-foreground')}>{client.utilisationPct}% of {inr(client.creditLimit, 0)}</div>
    </div>
  );
}

const clientColumns = [
  { label: 'Customer', wrap: true, render: (client) => <div><b>{client.name}</b><div className="tw:text-[10px] tw:text-muted-foreground">{[client.contactPerson, client.phone].filter(Boolean).join(' - ')}</div></div> },
  { label: 'Outstanding', right: true, render: (client) => <Money v={client.totalOut} strong /> },
  { label: 'Limit use', w: 140, render: (client) => <LimitUse client={client} /> },
  { label: 'Not due', right: true, render: (client) => inr(client.buckets.notDue || 0) },
  { label: '1-15', right: true, render: (client) => inr(client.buckets.b15 || 0) },
  { label: '16-30', right: true, render: (client) => inr(client.buckets.b30 || 0) },
  { label: '31-60', right: true, render: (client) => <span className={client.buckets.b60 ? 'tw:text-orange-700' : ''}>{inr(client.buckets.b60 || 0)}</span> },
  { label: '60+', right: true, render: (client) => <span className={client.buckets.b90 ? 'tw:font-extrabold tw:text-destructive' : ''}>{inr(client.buckets.b90 || 0)}</span> },
  { label: 'Risk', render: (client) => <span title={client.riskWhy}><Badge variant={RISK_VARIANT[client.risk] || 'neutral'}>{client.risk}</Badge></span> },
  { label: 'Promise', render: (client) => (client.nextPromise ? <span className="tw:text-[11px]">{fmtDate(client.nextPromise.date)}{client.nextPromise.amount ? ' - ' + inr(client.nextPromise.amount, 0) : ''}</span> : '') },
];

function kpiTiles(kpis, clientCount) {
  return [
    { key: 'a', label: 'Total receivable', value: '₹ ' + inr(kpis.totalOutstanding, 0), sub: clientCount + ' customers' },
    { key: 'b', label: 'Not due', value: '₹ ' + inr(kpis.notDue, 0), tone: 'tw:text-success' },
    { key: 'c', label: 'Overdue 1-30', value: '₹ ' + inr(kpis.overdue1to30, 0), tone: 'tw:text-warning' },
    { key: 'd', label: 'Overdue 31-60', value: '₹ ' + inr(kpis.overdue31to60, 0), tone: 'tw:text-orange-700' },
    { key: 'e', label: 'Over 60 days', value: '₹ ' + inr(kpis.critical60plus, 0), tone: 'tw:text-red-700' },
    { key: 'f', label: 'Promised this week', value: '₹ ' + inr(kpis.expectedThisWeek, 0), sub: (kpis.promisesCounted || 0) + ' promises' },
    { key: 'g', label: 'Over limit / no limit', value: (kpis.partiesOverLimit || 0) + ' / ' + (kpis.partiesWithoutLimit || 0), tone: kpis.partiesOverLimit ? 'tw:text-red-700' : 'tw:text-head' },
  ];
}

// customers with limit use, ageing, risk and why; a click opens the customer's bills, follow-ups, limit and ledger match
export function CreditControlScreen() {
  const navigate = useNavigate();
  const [asOn, setAsOn] = useState(todayIso());
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState({ q: '', risk: '', over: false });
  const [selected, setSelected] = useState(null);
  const setFilterField = (key, value) => setFilter((old) => ({ ...old, [key]: value }));

  const load = async () => {
    setMsg('');
    try { setData(await accountsApi.controlCreditAgeing(asOn)); } catch (error) { setMsg('Not loaded: ' + errorMessage(error)); }
  };
  useEffect(() => { load(); }, [asOn]);

  const clients = (data && data.clients) || [];
  const shown = clients.filter((client) => (!filter.q || client.name.toLowerCase().includes(filter.q.toLowerCase())) && (!filter.risk || client.risk === filter.risk) && (!filter.over || client.overLimit));

  return (
    <Sheet tabs={[{ id: 'c', label: 'Credit Control' }]} tab="c" onTab={() => {}}>
      <ActionBar note={msg}>
        <span className="tw:text-[11px] tw:text-muted-foreground">As on</span>
        <DateInput value={asOn} onValueChange={setAsOn} wrapperClassName="tw:w-[140px]" />
        <Input data-allow-text leftIcon={Search} className="tw:w-full tw:sm:w-[200px]" value={filter.q} onChange={(event) => setFilterField('q', event.target.value)} placeholder="Customer" />
        <SelectBox className="tw:w-[130px]" value={filter.risk} onValueChange={(value) => setFilterField('risk', value)} options={['High', 'Medium', 'Low']} placeholder="All risk" clearable clearLabel="All risk" />
        <CheckField label="Over limit" checked={filter.over} onCheckedChange={(value) => setFilterField('over', value)} />
        <Button variant="default" size="lg" onClick={load}><RefreshCw /> Refresh</Button>
        <Button variant="secondary" size="lg" onClick={() => toExcel('credit_control_' + asOn, EXCEL_COLUMNS, shown)}><Download /> Excel</Button>
      </ActionBar>
      {data && <Tiles items={kpiTiles(data.kpis || {}, clients.length)} />}
      {!data && !msg && <div className="tw:p-3 tw:text-entry tw:text-muted-foreground">Loading</div>}
      {data && (
        <Grid title={'Customers (' + shown.length + ')'} maxHeight={selected ? 260 : 'calc(100vh - 420px)'} rows={shown} rowKey={(client) => client.ledgerId} activeKey={selected}
          onRow={(client) => setSelected(client.ledgerId === selected ? null : client.ledgerId)}
          empty={clients.length ? 'Nothing matches the filter' : 'No customer owes anything on this date'} cols={clientColumns} />
      )}
      {selected && (
        <CreditPartyPanel key={selected} ledgerId={selected} asOn={asOn} onChanged={load} onClose={() => setSelected(null)} onLedger={() => navigate('/accounts-hub?item=ledger&ledger=' + selected)} />
      )}
    </Sheet>
  );
}
