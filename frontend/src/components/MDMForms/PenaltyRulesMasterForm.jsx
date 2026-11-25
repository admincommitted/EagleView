import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, DollarSign, Edit2, List, Plus, RefreshCw, Save, ShieldCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Button, Card, DataTable, Field, NumberInput, SelectBox } from '@/components/ui';
import { mastersFormApi } from './masterKit/masterRecordsApi';
import { askDelete } from './switchRow';

const EMPTY_RULE = { id: null, tradeType: 'IMPORT', type: 'DEMURRAGE', mode: 'SEA', basis: 'DISCHARGE_DATE', rateUom: 'PER_SHIPMENT_PER_DAY', freeDays: 0, slab1Rate: 0, slab2Rate: 0, slab3Rate: 0 };

const TRADE_TYPES = [{ value: 'IMPORT', label: 'Import' }, { value: 'EXPORT', label: 'Export' }, { value: 'BOTH', label: 'Both' }];
const MODES = [{ value: 'SEA', label: 'Sea Freight' }, { value: 'AIR', label: 'Air Freight' }, { value: 'ALL', label: 'All Modes (Global)' }];
const IMPORT_PENALTIES = [
  { value: 'DEMURRAGE', label: 'Port/CFS Demurrage (Import)' },
  { value: 'DETENTION', label: 'Shipping Line Detention (Import)' },
  { value: 'CUSTOMS_LATE_FEE', label: 'Customs Late Filing Fee (Sec 46)' },
];
const EXPORT_PENALTIES = [
  { value: 'GROUND_RENT', label: 'CFS Ground Rent (Export)' },
  { value: 'LATE_LEO_FEE', label: 'Late LEO Penalty' },
  { value: 'DETENTION', label: 'Container Detention (Export)' },
];
const IMPORT_BASES = [
  { value: 'DISCHARGE_DATE', label: 'Discharge Date' },
  { value: 'IGM_DATE', label: 'IGM Date' },
  { value: 'ARRIVAL_DATE', label: 'Vessel/Flight Arrival Date' },
  { value: 'ASSESSMENT_DATE', label: 'Duty Assessment Date' },
  { value: 'GATE_OUT_DATE', label: 'Gate Out Date' },
];
const EXPORT_BASES = [
  { value: 'GATE_IN_DATE', label: 'Factory / CFS Gate In Date' },
  { value: 'SHIPPING_BILL_DATE', label: 'Shipping Bill Date' },
  { value: 'LEO_DATE', label: 'LEO Date' },
  { value: 'SAILING_DATE', label: 'Vessel Sailing Date' },
];
const SLAB_RATES = [
  { key: 'slab1Rate', label: 'Slab 1 Daily Rate (₹)', className: 'tw:text-success' },
  { key: 'slab2Rate', label: 'Slab 2 Daily Rate (₹)', className: 'tw:text-warning' },
  { key: 'slab3Rate', label: 'Slab 3 Daily Rate (₹)', className: 'tw:text-destructive' },
];
const TRADE_FILTERS = [{ value: 'ALL', label: 'ALL' }, { value: 'IMPORT', label: 'IMPORT' }, { value: 'EXPORT', label: 'EXPORT' }];
const MODE_FILTERS = [{ value: 'ALL', label: 'All Rules' }, { value: 'SEA', label: 'Sea Freight Only' }, { value: 'AIR', label: 'Air Freight Only' }];
const MODE_BADGE = { SEA: 'info', AIR: 'warning' };

const spaced = (text) => String(text || '').replace(/_/g, ' ');

function FilterButtons({ label, options, value, onChange }) {
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
      <span className="tw:text-[13px] tw:font-bold tw:text-muted-foreground">{label}:</span>
      {options.map((option) => (
        <Button key={option.value} size="sm" variant={value === option.value ? 'default' : 'secondary'} onClick={() => onChange(option.value)}>
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export default function PenaltyRulesMasterForm() {
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('list');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [tradeFilter, setTradeFilter] = useState('ALL');
  const [rules, setRules] = useState([]);
  const [rule, setRule] = useState(EMPTY_RULE);

  const loadRules = async () => {
    try {
      const data = await mastersFormApi.listPenaltyRules();
      if (data.success) setRules(data.data || []);
      else toast.error(`API Error: ${data.message || data.error || 'Unknown'}`);
    } catch (error) {
      toast.error(error.response ? `API Error: ${errorMessage(error)}` : `Network Error: ${error.message}`);
    }
  };

  useEffect(() => { loadRules(); }, []);

  const setRuleField = (name) => (value) => setRule((current) => ({ ...current, [name]: value }));

  const editRule = (picked) => {
    setRule(picked);
    setView('form');
  };

  const newRule = () => {
    setRule(EMPTY_RULE);
    setView('form');
  };

  const saveRule = async (event) => {
    event.preventDefault();
    if (rule.freeDays === '' || Number(rule.freeDays) < 0) return toast.error('Free days must be 0 or more');
    if (SLAB_RATES.some((slab) => Number(rule[slab.key]) < 0)) return toast.error('Rates cannot be negative');
    setLoading(true);
    try {
      const { id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = rule;
      const body = { ...rest, freeDays: Number(rest.freeDays), slab1Rate: Number(rest.slab1Rate), slab2Rate: Number(rest.slab2Rate), slab3Rate: Number(rest.slab3Rate) };
      const data = id ? await mastersFormApi.updatePenaltyRule(id, body) : await mastersFormApi.createPenaltyRule(body);
      if (!data.success) throw new Error(data.message || data.error || 'Save failed');
      toast.success(data.message || 'Penalty Rule saved');
      await loadRules();
      setView('list');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const deleteRule = async (picked) => {
    if (!(await askDelete(`Delete ${picked.tradeType} ${spaced(picked.type)} (${picked.mode}) rule?`))) return;
    try {
      const data = await mastersFormApi.deletePenaltyRule(picked.id);
      if (!data.success) throw new Error(data.message || 'Delete failed');
      toast.success('Rule deleted');
      loadRules();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const shownRules = rules.filter((row) => (modeFilter === 'ALL' || row.mode === modeFilter || row.mode === 'ALL') && (tradeFilter === 'ALL' || row.tradeType === tradeFilter));
  const isExport = rule.tradeType === 'EXPORT';

  const columns = [
    { key: 'tradeType', header: 'Trade', cell: (row) => <Badge variant={row.tradeType === 'IMPORT' ? 'info' : 'success'}>{row.tradeType}</Badge> },
    { key: 'type', header: 'Penalty Type', className: 'tw:font-bold', cell: (row) => spaced(row.type) },
    { key: 'mode', header: 'Transport Mode', cell: (row) => <Badge variant={MODE_BADGE[row.mode] || 'neutral'}>{row.mode}</Badge> },
    { key: 'basis', header: 'Trigger Basis', className: 'tw:text-muted-foreground', cell: (row) => spaced(row.basis) },
    { key: 'rateUom', header: 'Rate UOM', cell: (row) => spaced(row.rateUom) },
    { key: 'freeDays', header: 'Free Days', className: 'tw:font-semibold' },
    { key: 'slab1Rate', header: 'Slab 1 Rate (₹)', className: 'tw:font-semibold tw:text-success', cell: (row) => `₹ ${row.slab1Rate}` },
    { key: 'slab2Rate', header: 'Slab 2 Rate (₹)', className: 'tw:font-semibold tw:text-warning', cell: (row) => `₹ ${row.slab2Rate}` },
    {
      key: 'actions',
      header: 'Action',
      cell: (row) => (
        <span className="tw:inline-flex tw:gap-1.5">
          <Button size="icon" title="Edit" onClick={() => editRule(row)}><Edit2 /></Button>
          <Button size="icon" variant="destructive" title="Delete" onClick={() => deleteRule(row)}><X /></Button>
        </span>
      ),
    },
  ];

  return (
    <div className="tw:flex tw:min-h-full tw:flex-col tw:gap-5 tw:rounded-xl tw:bg-page tw:p-3 tw:normal-case tw:md:p-6">
      <Card className="tw:flex tw:flex-col tw:gap-3 tw:px-5 tw:py-4 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <div className="tw:flex tw:items-center tw:gap-3">
          <span className="tw:rounded-lg tw:bg-destructive/10 tw:p-2"><AlertTriangle className="tw:size-6 tw:text-destructive" /></span>
          <div>
            <h2 className="tw:m-0 tw:text-lg tw:text-foreground">Penalty & Demurrage Config Master</h2>
            <p className="tw:m-0 tw:text-entry tw:text-muted-foreground">Configure Free Days and Slab Rates for Financial Calculations</p>
          </div>
        </div>
        <div className="tw:flex tw:gap-2 tw:rounded-lg tw:bg-muted tw:p-1">
          <Button size="lg" variant={view === 'list' ? 'outline' : 'ghost'} onClick={() => setView('list')}><List /> Directory</Button>
          <Button size="lg" variant={view === 'form' ? 'outline' : 'ghost'} onClick={newRule}><Plus /> New Rule</Button>
        </div>
      </Card>

      {view === 'list' && (
        <div className="tw:flex tw:flex-col tw:gap-4">
          <Card className="tw:flex tw:flex-col tw:gap-3 tw:px-4 tw:py-3 tw:lg:flex-row tw:lg:items-center tw:lg:gap-8">
            <FilterButtons label="Trade" options={TRADE_FILTERS} value={tradeFilter} onChange={setTradeFilter} />
            <FilterButtons label="Mode" options={MODE_FILTERS} value={modeFilter} onChange={setModeFilter} />
          </Card>
          <DataTable columns={columns} rows={shownRules} emptyText="No penalty rules" containerClassName="tw:rounded-lg tw:border tw:border-border tw:bg-card" />
        </div>
      )}

      {view === 'form' && (
        <Card className="tw:p-4 tw:md:p-6">
          <form onSubmit={saveRule} className="tw:flex tw:flex-col tw:gap-5">
            <div className="tw:rounded-lg tw:border-l-4 tw:border-destructive tw:bg-page tw:px-4 tw:py-3">
              <h3 className="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:text-sm tw:text-foreground">
                <ShieldCheck className="tw:size-4 tw:text-destructive" /> System Policy Engine
              </h3>
              <p className="tw:mt-1 tw:mb-0 tw:text-entry tw:text-muted-foreground">These rules will be directly applied to the Advance Calculator and Financial Radar. Please ensure they match standard tariff agreements.</p>
            </div>

            <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:md:grid-cols-2">
              <Field label="Trade Type" layout="col">
                <SelectBox options={TRADE_TYPES} value={rule.tradeType} onValueChange={setRuleField('tradeType')} />
              </Field>
              <Field label="Penalty Type" layout="col">
                <SelectBox options={isExport ? EXPORT_PENALTIES : IMPORT_PENALTIES} value={rule.type} onValueChange={setRuleField('type')} />
              </Field>
              <Field label="Transport Mode" layout="col">
                <SelectBox options={MODES} value={rule.mode} onValueChange={setRuleField('mode')} />
              </Field>
              <Field label="Calculation Trigger (Basis)" layout="col">
                <SelectBox options={isExport ? EXPORT_BASES : IMPORT_BASES} value={rule.basis} onValueChange={setRuleField('basis')} />
              </Field>
              <Field label={<span className="tw:inline-flex tw:items-center tw:gap-1.5"><Clock className="tw:size-3.5" /> Base Free Days</span>} layout="col">
                <NumberInput decimals={0} value={rule.freeDays} className="tw:bg-success/10" onValueChange={setRuleField('freeDays')} />
              </Field>
              {SLAB_RATES.map((slab) => (
                <Field key={slab.key} layout="col" labelClassName={slab.className}
                  label={<span className="tw:inline-flex tw:items-center tw:gap-1.5"><DollarSign className="tw:size-3.5" /> {slab.label}</span>}>
                  <NumberInput value={rule[slab.key]} onValueChange={setRuleField(slab.key)} />
                </Field>
              ))}
            </div>

            <div className="tw:mt-4 tw:flex tw:justify-end">
              <Button type="submit" variant="default" size="lg" disabled={loading}>
                {loading ? <RefreshCw className="tw:animate-spin" /> : <Save />} Save Configuration
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
