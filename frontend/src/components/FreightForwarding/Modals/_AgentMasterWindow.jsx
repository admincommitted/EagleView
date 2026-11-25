// Sub Agent / Overseas Agent master: the agents come from and are saved to the Party master (flag isSubAgent /
// isOverseasAgent, address in the party's default branch); "Use on this AWB" puts the agent into the AWB's
// Sub Agent / Overseas Agent party.
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Field, Input } from '@/components/ui';
import { getParties } from '../../../utils/partiesCache';
import { freightApi } from '../freightApi';
import ModalFrame from './_ModalFrame';

const EMPTY_AGENT = { id: null, name: '', marketingPerson1: '', panNumber: '', street: '', address2: '', city: '', state: '', country: 'IN', zip: '', email: '', mobile: '', phone: '', gstin: '' };
const AGENT_FIELDS = [
  { key: 'name', label: 'Name', required: true, wide: true },
  { key: 'marketingPerson1', label: 'Marketing Person' },
  { key: 'panNumber', label: 'PAN Number', maxLength: 10 },
  { key: 'street', label: 'Address Line 1', required: true, wide: true },
  { key: 'address2', label: 'Address Line 2', wide: true },
  { key: 'city', label: 'City', required: true },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country (2 letters)', required: true, maxLength: 2 },
  { key: 'zip', label: 'PIN / ZIP' },
  { key: 'email', label: 'Email' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'phone', label: 'Phone' },
  { key: 'gstin', label: 'GST No' },
];

const agentFromParty = (party) => {
  const branch = (party.branches || []).find((item) => item.isDefault) || (party.branches || [])[0] || {};
  return {
    ...EMPTY_AGENT, id: party.id, name: party.name || '', marketingPerson1: party.marketingPerson1 || '', panNumber: party.panNumber || '',
    street: branch.address1 || party.street || '', address2: branch.address2 || '', city: branch.city || party.city || '',
    state: branch.state || party.stateProvince || '', country: branch.country || party.countryCode || 'IN', zip: branch.pinCode || party.zipPostcode || '',
    email: branch.email1 || party.email || '', mobile: branch.mobile || party.phoneNumber || '', phone: branch.phone || '', gstin: branch.regNo || '',
  };
};

function validationError(agent) {
  if (!agent.name.trim()) return 'Name is required';
  if (!agent.street.trim() || !agent.city.trim()) return 'Address Line 1 and City are required';
  if (!/^[A-Za-z]{2}$/.test(agent.country.trim())) return 'Country must be a 2-letter code (IN, AE ...)';
  if (agent.panNumber && !/^[A-Z]{5}\d{4}[A-Z]$/i.test(agent.panNumber.trim())) return 'PAN must be like ABCDE1234F';
  if (agent.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(agent.email.trim())) return 'Email is not valid';
  return '';
}

function partyPayload(agent, flag) {
  const upper = (value) => value.trim().toUpperCase();
  const country = upper(agent.country);
  return {
    name: upper(agent.name), [flag]: true, partyType: 'MULTI', street: upper(agent.street).slice(0, 70), city: upper(agent.city).slice(0, 17), stateProvince: upper(agent.state),
    countryCode: country, zipPostcode: upper(agent.zip).slice(0, 9), phoneNumber: agent.mobile.trim(), email: agent.email.trim(), panNumber: upper(agent.panNumber),
    marketingPerson1: upper(agent.marketingPerson1), iecNoReqd: false,
    branches: [{
      branchSrNo: '1', branchName: 'HEAD OFFICE', isDefault: true, address1: upper(agent.street), address2: upper(agent.address2), city: upper(agent.city), state: upper(agent.state),
      country, pinCode: upper(agent.zip), email1: agent.email.trim(), mobile: agent.mobile.trim(), phone: agent.phone.trim(), regNo: upper(agent.gstin),
    }],
  };
}

const saveFailText = (error) => (error.response ? error.response.data?.message || error.response.data?.error || 'Save failed' : error.message);

export default function AgentMasterWindow({ isOpen, onClose, kind, setParties }) {
  const flag = kind === 'OVERSEAS' ? 'isOverseasAgent' : 'isSubAgent';
  const label = kind === 'OVERSEAS' ? 'Overseas Agent' : 'Sub Agent';
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState('');
  const [agent, setAgent] = useState(EMPTY_AGENT);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadAgents = async () => {
    try {
      const parties = await getParties();
      setAgents((Array.isArray(parties) ? parties : parties?.data || []).filter((party) => party[flag]));
    } catch {
      setAgents([]);
    }
  };
  useEffect(() => {
    if (!isOpen) return;
    loadAgents();
    setMessage(null);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!isOpen) return null;

  const pick = (party) => { setAgent(agentFromParty(party)); setMessage(null); };
  const startNew = () => { setAgent(EMPTY_AGENT); setMessage(null); };
  const setField = (key, value) => setAgent((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const problem = validationError(agent);
    if (problem) return setMessage({ error: true, text: problem });
    const payload = partyPayload(agent, flag);
    setBusy(true);
    try {
      const response = agent.id ? await freightApi.updateParty(agent.id, payload) : await freightApi.saveParty(payload);
      const saved = response?.data || response || {};
      setAgent((current) => ({ ...current, id: current.id || saved.id || null }));
      setMessage({ text: `${label} ${payload.name} saved in Party Master` });
      loadAgents();
    } catch (error) {
      setMessage({ error: true, text: saveFailText(error) });
    } finally {
      setBusy(false);
    }
  };

  const useOnAwb = () => {
    if (!agent.name.trim()) return setMessage({ error: true, text: 'Pick or enter an agent first' });
    const upper = (value) => value.trim().toUpperCase();
    setParties?.((parties) => ({
      ...parties,
      [label]: {
        name: upper(agent.name), street: upper([agent.street, agent.address2].filter(Boolean).join(' ')), city: upper(agent.city), state: upper(agent.state),
        country: upper(agent.country), zip: agent.zip.trim(), phone: agent.mobile.trim() || agent.phone.trim(), email: agent.email.trim(),
        gstin: upper(agent.gstin), panNumber: upper(agent.panNumber), partyId: agent.id || undefined,
      },
    }));
    onClose?.();
  };

  const shown = agents.filter((party) => !search || String(party.name || '').toUpperCase().includes(search.toUpperCase()));
  const footer = message
    ? <span className={cn('tw:font-bold', message.error ? 'tw:text-destructive' : 'tw:text-success')}>{message.text}</span>
    : 'Saved in Party Master';

  return (
    <ModalFrame title={`${label} Master`} width={860} onClose={onClose} footer={footer}>
      <div className="tw:flex tw:min-h-[360px] tw:flex-col tw:gap-2.5 tw:md:flex-row">
        <div className="tw:flex tw:w-full tw:flex-col tw:gap-1.5 tw:md:w-[250px]">
          <Input placeholder={`Search ${label.toLowerCase()}...`} value={search} onChange={(event) => setSearch(event.target.value)} />
          <Button onClick={startNew}><Plus /> New {label}</Button>
          <div className="tw:max-h-[300px] tw:overflow-y-auto tw:rounded-sm tw:border tw:border-border tw:bg-background tw:md:max-h-none tw:md:flex-1">
            {shown.map((party) => (
              <Button key={party.id} variant="ghost" size="block" onClick={() => pick(party)}
                className={cn('tw:flex-col tw:items-start tw:gap-0 tw:rounded-none tw:border-0 tw:border-b tw:border-border', party.id === agent.id && 'tw:bg-accent')}>
                <span className="tw:font-bold">{party.name}</span>
                <span className="tw:text-[10px] tw:text-muted-foreground">{[party.city, party.countryCode].filter(Boolean).join(', ')}</span>
              </Button>
            ))}
            {shown.length === 0 && <div className="tw:p-2 tw:text-[11px] tw:text-muted-foreground">No {label.toLowerCase()} in Party Master yet</div>}
          </div>
        </div>
        <div className="tw:grid tw:flex-1 tw:grid-cols-1 tw:content-start tw:gap-2 tw:sm:grid-cols-2">
          {AGENT_FIELDS.map((field) => (
            <Field key={field.key} label={field.label} required={field.required} layout="col" className={cn(field.wide && 'tw:sm:col-span-2')}>
              <Input value={agent[field.key]} maxLength={field.maxLength} onChange={(event) => setField(field.key, event.target.value)} />
            </Field>
          ))}
          <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2 tw:sm:col-span-2">
            <Button variant="default" disabled={busy} onClick={save}>{busy ? 'Saving...' : (agent.id ? 'Update' : 'Save')}</Button>
            <Button variant="success" onClick={useOnAwb}>Use on this AWB</Button>
          </div>
        </div>
      </div>
    </ModalFrame>
  );
}
