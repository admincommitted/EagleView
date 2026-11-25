// iCAFFE Party Directory - exporters, consignees, sub agents, overseas agents, shipping lines, IATA agents and banks read
// from iCAFFE. Search here; "Add to Party Master" copies the party (with its addresses / AD codes) into the Party master
// so the job screens can use it.
import { useEffect, useState } from 'react';
import { CheckCircle2, Database, Search, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Card, DataTable, Input, SelectBox } from '@/components/ui';
import { mastersFormApi } from './masterKit/masterRecordsApi';

const TYPES = [
  { value: 'EXPORTER', label: 'Exporter / Importer' }, { value: 'CONSIGNEE', label: 'Consignee / Supplier' }, { value: 'SUBAGENT', label: 'Sub Agent' },
  { value: 'OVERSEAS_AGENT', label: 'Overseas Agent' }, { value: 'SHIPLINE', label: 'Shipline' }, { value: 'IATA_AGENT', label: 'IATA Agent' }, { value: 'BANK', label: 'Bank BRO' },
];
const TYPE_LABEL = Object.fromEntries(TYPES.map((type) => [type.value, type.label]));
const typeLabel = (partyType) => TYPE_LABEL[partyType] || partyType;
// IATA agents are kept in the IATA Agent Master (Masters > IATA Agent Master), not in the Party master
const IMPORTABLE = ['EXPORTER', 'CONSIGNEE', 'SUBAGENT', 'OVERSEAS_AGENT', 'SHIPLINE'];
const indianNumber = (value) => Number(value).toLocaleString('en-IN');
const joined = (values, separator = ', ') => values.filter(Boolean).join(separator);

function DirectoryStats({ stats }) {
  if (!stats) return null;
  if (stats.loaded === false) return <div className="tw:text-entry tw:text-warning">Not loaded yet - run load_icaffe_parties.bat.</div>;
  if (!stats.types?.length) return null;
  const total = stats.types.reduce((sum, type) => sum + type.n, 0);
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:text-[11px]">
      <span className="tw:font-bold">{total.toLocaleString('en-IN')} parties:</span>
      {stats.types.map((type) => (
        <Badge key={type.partyType} variant="neutral" className="tw:font-semibold">
          {typeLabel(type.partyType)} {indianNumber(type.n)}{type.imported ? ` (${type.imported} in Party Master)` : ''}
        </Badge>
      ))}
    </div>
  );
}

function PartyAddresses({ party }) {
  if (!party) return <div className="tw:text-muted-foreground">Select a party to see its addresses.</div>;
  return (
    <>
      <div className="tw:text-[13px] tw:font-bold">{party.name}</div>
      <div className="tw:mb-2 tw:text-muted-foreground">{party.code} - {typeLabel(party.partyType)}</div>
      {party.iec && <div><b>IEC:</b> {party.iec}</div>}
      {party.pan && <div><b>PAN:</b> {party.pan}</div>}
      {party.classType && <div><b>Class:</b> {party.classType}</div>}
      {(party.addresses || []).map((address, index) => (
        <div key={index} className="tw:mt-2 tw:rounded-md tw:border tw:border-border tw:p-2">
          <div className="tw:font-semibold">{address.branchName || `Address ${index + 1}`}{address.isDefault ? ' (default)' : ''}</div>
          <div>{joined([address.address1, address.address2])}</div>
          <div>{joined([address.city, address.state, address.pinCode, address.country])}</div>
          {address.gstin && <div>GSTIN: {address.gstin}</div>}
          {(address.phone || address.mobile) && <div>Phone: {joined([address.phone, address.mobile], ' / ')}</div>}
          {address.email1 && <div>Email: {address.email1}</div>}
          {address.contactPerson && <div>Contact: {address.contactPerson}</div>}
        </div>
      ))}
      {(party.adCodes || []).length > 0 && (
        <div className="tw:mt-2.5">
          <div className="tw:font-bold">AD codes</div>
          {party.adCodes.map((adCode, index) => (
            <div key={index}>{adCode.adCode} {adCode.bankName ? `- ${adCode.bankName}` : ''} {adCode.port ? `(${adCode.port})` : ''}</div>
          ))}
        </div>
      )}
    </>
  );
}

export default function IcaffePartyDirectoryForm() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadStats = async () => {
      try {
        setStats(await mastersFormApi.icaffePartyStats());
      } catch {
        setStats(null);
      }
    };
    loadStats();
  }, []);

  useEffect(() => {
    const text = query.trim();
    const search = async () => {
      setBusy(true);
      try {
        const found = await mastersFormApi.icaffeParties({ q: text, type, limit: 100 });
        setRows(Array.isArray(found) ? found : []);
      } catch {
        setRows([]);
      } finally {
        setBusy(false);
      }
    };
    const timer = setTimeout(search, text.length ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query, type]);

  const addToMaster = async (party) => {
    setMessage('');
    try {
      const imported = await mastersFormApi.importIcaffeParty(party.id);
      setMessage((imported.created ? 'Added to Party Master: ' : 'Already in Party Master, linked: ') + imported.name);
      const linked = { ...party, importedPartyId: imported.partyId };
      setRows((list) => list.map((row) => (row.id === party.id ? linked : row)));
      if (selected?.id === party.id) setSelected(linked);
    } catch (error) {
      const { response } = error;
      setMessage(`Not added: ${response ? (response.data?.error || `HTTP ${response.status}`) : error.message}`);
    }
  };

  const columns = [
    { key: 'code', header: 'Code', className: 'tw:font-semibold' },
    { key: 'name', header: 'Name', className: 'tw:whitespace-normal' },
    { key: 'partyType', header: 'Type', cell: (party) => typeLabel(party.partyType) },
    { key: 'iec', header: 'IEC / GSTIN', cell: (party) => party.iec || party.gstin || '' },
    { key: 'city', header: 'City', className: 'tw:whitespace-normal', cell: (party) => joined([party.city, party.state]) },
    {
      key: 'action', header: '', align: 'right',
      cell: (party) => IMPORTABLE.includes(party.partyType) && (party.importedPartyId
        ? <span className="tw:inline-flex tw:items-center tw:gap-1 tw:text-[11px] tw:text-success"><CheckCircle2 className="tw:size-3.5" /> In Party Master</span>
        : <Button variant="success" size="sm" onClick={(event) => { event.stopPropagation(); addToMaster(party); }}><UserPlus /> Add to Party Master</Button>),
    },
  ];

  return (
    <div className="tw:flex tw:flex-col tw:gap-4 tw:lg:h-full">
      <Card className="tw:gap-2.5 tw:px-5 tw:py-4">
        <h3 className="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:text-[15px] tw:font-bold tw:text-head tw:uppercase">
          <Database className="tw:size-[18px] tw:text-primary" /> iCAFFE Party Directory
        </h3>
        <DirectoryStats stats={stats} />
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <div className="tw:min-w-0 tw:flex-[1_1_260px]">
            <Input leftIcon={Search} data-allow-text="" placeholder="Name, iCAFFE code, IEC, PAN or GSTIN" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <SelectBox options={TYPES} value={type} onValueChange={setType} placeholder="All types" clearable clearLabel="All types" className="tw:w-full tw:sm:w-[180px]" />
          {busy && <span className="tw:text-[11px] tw:text-muted-foreground">Searching...</span>}
        </div>
        {message && <div className={cn('tw:text-entry tw:font-semibold', message.startsWith('Not') ? 'tw:text-destructive' : 'tw:text-success')}>{message}</div>}
      </Card>

      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:gap-4 tw:lg:flex-row">
        <Card className="tw:min-w-0 tw:overflow-hidden tw:p-0 tw:lg:flex-[2_1_480px]">
          <DataTable columns={columns} rows={rows} selectedKey={selected?.id} onRowClick={setSelected}
            emptyText={busy ? '' : (query ? 'No match.' : 'Type a name to search.')} containerClassName="tw:h-full" />
        </Card>
        <Card className="tw:min-w-0 tw:overflow-auto tw:p-4 tw:text-entry tw:lg:flex-[1_1_300px]">
          <PartyAddresses party={selected} />
        </Card>
      </div>
    </div>
  );
}
