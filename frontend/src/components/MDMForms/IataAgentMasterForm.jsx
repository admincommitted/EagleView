import { useState } from 'react';
import { Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, Button, Checkbox, Field, NumberInput, Section, SelectBox } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { activeColumn, masterActionsColumn } from './masterKit/masterColumns';
import { useMasterRecords } from './masterKit/useMasterRecords';
import switchRow from './switchRow';
import BranchSection from './IataAgentMasterFormParts/BranchSection';
import CasedTextField from './IataAgentMasterFormParts/CasedTextField';

const EMPTY_BRANCH = {
  id: '', defaultAddress: false, contactPerson: '', branchName: '', address1: '', address2: '', city: '',
  state: '', country: '', pinCode: '', gstState: '', gstNo: '', fax: '', phone: '', mobile: '',
  website: '', email1: '', email2: '', gstExempted: false,
};
const EMPTY_AGENT = {
  id: '', name: '', iataCode: '', tdsRate: '', tdsRemarks: '', panNumber: '', isDefault: false,
  commission: '', commissionType: 'PERCENT', branches: [],
};
const LIST_PARAMS = { all: 1 };
const SEARCH_FIELDS = ['name', 'iataCode', 'panNumber', 'tdsRate', 'tdsRemarks', 'commission'];
const AGENT_FIELDS = [
  { key: 'name', label: 'Name', required: true, textCase: 'upper' },
  { key: 'iataCode', label: 'IATA Code', textCase: 'upper' },
  { key: 'tdsRate', label: 'TDS Rate', textCase: 'upper' },
  { key: 'tdsRemarks', label: 'TDS Remarks', textCase: 'upper' },
  { key: 'panNumber', label: 'PAN Number', textCase: 'upper' },
];
const COMMISSION_TYPES = [{ value: 'PERCENT', label: 'PERCENT (%)' }, { value: 'FLAT', label: 'FLAT RATE (₹)' }, { value: 'NIL', label: 'NIL / NA' }];

// an agent with no isActive value counts as switched on
const isOn = (agent) => !(agent.isActive === false || agent.isActive === 0);
const iataDigits = (code) => String(code || '').replace(/[\s/-]/g, '').toUpperCase();
const cleanText = (text) => String(text || '').trim().toUpperCase();

const parseBranches = (branches) => {
  if (Array.isArray(branches)) return branches;
  try {
    return JSON.parse(branches) || [];
  } catch {
    return [];
  }
};

const validateAgent = (agent, records) => {
  if (!agent.name) return 'Agent Name is mandatory!';
  const code = cleanText(agent.iataCode);
  const digits = iataDigits(code);
  // IATA code: 7 digits, or 11 with the CASS / branch part
  if (code && !/^\d{7}(\d{1,4})?$/.test(digits)) return 'ERROR: IATA code must be 7 digits (or 7 + CASS / branch digits, e.g. 1434567/0012)';
  const pan = cleanText(agent.panNumber);
  if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) return 'ERROR: PAN must be like ABCDE1234F';
  if (agent.tdsRate !== '' && agent.tdsRate != null && (isNaN(Number(agent.tdsRate)) || Number(agent.tdsRate) < 0 || Number(agent.tdsRate) > 100)) return 'ERROR: TDS rate must be a number 0 - 100';
  if (code && records.some((other) => other.id !== agent.id && iataDigits(other.iataCode) === digits)) return 'ERROR: Duplicate - another agent already has this IATA code';
  return '';
};

const agentBody = (agent) => {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = agent;
  const body = { ...rest, name: cleanText(agent.name), iataCode: cleanText(agent.iataCode), panNumber: cleanText(agent.panNumber), branches: JSON.stringify(agent.branches || []) };
  if (!body.id) delete body.id;
  return body;
};

const LIST = {
  title: 'Search IATA Agent',
  searchPlaceholder: 'ENTER NAME/CODE...',
  primaryText: (agent) => <>{agent.name} {!isOn(agent) && <Badge variant="danger">INACTIVE</Badge>}</>,
  secondaryText: (agent) => `CODE: ${agent.iataCode || 'N/A'}`,
};

export default function IataAgentMasterForm() {
  const master = useMasterRecords({
    resource: 'iataagents',
    emptyRecord: EMPTY_AGENT,
    listParams: LIST_PARAMS,
    searchFields: SEARCH_FIELDS,
    validate: (agent) => validateAgent(agent, master.records),
    prepareSave: agentBody,
  });
  const { form, setForm, setField, reload } = master;
  const [branch, setBranch] = useState(EMPTY_BRANCH);
  const [editBranchIndex, setEditBranchIndex] = useState(-1);

  const resetBranch = () => {
    setBranch(EMPTY_BRANCH);
    setEditBranchIndex(-1);
  };
  const setBranchField = (name) => (value) => setBranch((current) => ({ ...current, [name]: value }));

  const editAgent = (agent) => {
    master.editRecord({ ...agent, branches: parseBranches(agent.branches) });
    resetBranch();
  };

  const clearAgent = () => {
    master.clearForm();
    resetBranch();
  };

  const saveAgent = async () => {
    const savedForm = form;
    if (!(await master.save())) return;
    toast.success(`SUCCESS: Agent ${savedForm.id ? 'Updated' : 'Saved'}!`);
    if (savedForm.id) setForm(savedForm);
    else resetBranch();
  };

  const switchAgent = async () => {
    if (!form.id) return toast.error('Please select an Agent first.');
    const on = isOn(form);
    if (await switchRow('iataagents', { ...form, isActive: on }, `IATA agent ${form.name || ''}`)) {
      setForm((current) => ({ ...current, isActive: !on }));
      reload();
    }
  };

  const saveBranch = () => {
    if (!branch.branchName || !branch.address1) return toast.error('Branch Name and Address 1 are mandatory to add an address!');
    setForm((current) => {
      const branches = [...current.branches];
      if (editBranchIndex >= 0) branches[editBranchIndex] = { ...branch };
      else branches.push({ ...branch, id: Date.now() });
      return { ...current, branches };
    });
    resetBranch();
  };

  const editBranch = (picked, index) => {
    setBranch(picked);
    setEditBranchIndex(index);
  };

  const deleteBranch = (index) => setForm((current) => ({ ...current, branches: current.branches.filter((_, position) => position !== index) }));

  const rows = master.filtered.map((agent) => ({ ...agent, isActive: isOn(agent) }));
  const today = new Date().toISOString().split('T')[0];
  const auditLine = [['Entered By', 'ADMIN'], ['Entered Date', today], ['Modified By', 'ADMIN'], ['Modified Date', today]];

  const columns = [
    { key: 'name', header: 'Agent Name', className: 'tw:font-semibold' },
    { key: 'iataCode', header: 'IATA Code', cell: (agent) => agent.iataCode || 'N/A' },
    { key: 'panNumber', header: 'PAN' },
    { key: 'commission', header: 'Commission', cell: (agent) => (agent.commission ? `${agent.commission} ${agent.commissionType || ''}` : '') },
    activeColumn,
    masterActionsColumn({ onEdit: editAgent }),
  ];

  const switchButton = (
    <Button variant={isOn(form) ? 'warning' : 'success'} size="lg" onClick={switchAgent}
      title="The agent is not deleted: switched off, it stays in this master and is left out of the AWB screens' lists">
      {isOn(form) ? 'Switch off' : 'Switch on'}
    </Button>
  );

  return (
    <MasterPage master={{ ...master, filtered: rows, editRecord: editAgent, clearForm: clearAgent, save: saveAgent }} list={LIST} icon={Building2}
      formTitle="IATA Agent & Branches" columns={columns} actions={switchButton} emptyText="No IATA agents found.">
      <div className="tw:flex tw:flex-col tw:gap-4">
        <Section title="IATA Details">
          <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:md:grid-cols-2">
            {AGENT_FIELDS.map((field) => (
              <CasedTextField key={field.key} field={field} value={form[field.key]} onValueChange={setField(field.key)} />
            ))}
            <Field label="Commission %" labelWidth="110px">
              <NumberInput decimals={2} placeholder="E.G. 5.00" value={form.commission} onValueChange={setField('commission')} />
            </Field>
            <Field label="Comm. Type" labelWidth="110px">
              <SelectBox options={COMMISSION_TYPES} value={form.commissionType || 'PERCENT'} onValueChange={setField('commissionType')} />
            </Field>
            <Field label="Set as default IATA agent" labelClassName="tw:font-bold">
              <Checkbox checked={Boolean(form.isDefault)} onCheckedChange={(checked) => setField('isDefault')(checked === true)} />
            </Field>
          </div>
        </Section>

        <BranchSection branch={branch} setBranchField={setBranchField} editIndex={editBranchIndex} branches={form.branches || []}
          onSave={saveBranch} onEdit={editBranch} onDelete={deleteBranch} />

        <div className="tw:flex tw:flex-wrap tw:justify-between tw:gap-x-6 tw:gap-y-1 tw:rounded-md tw:border tw:border-border tw:bg-primary/10 tw:px-3 tw:py-1 tw:text-[11px]">
          {auditLine.map(([label, value]) => (
            <span key={label} className="tw:flex tw:gap-2"><span className="tw:font-semibold tw:text-muted-foreground">{label}</span><b>{value}</b></span>
          ))}
        </div>
      </div>
    </MasterPage>
  );
}
