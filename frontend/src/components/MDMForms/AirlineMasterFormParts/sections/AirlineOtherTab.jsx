import { Fragment } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Button, DataTable, DateInput, Input, Section } from '@/components/ui';

// otherData keys: <group><Plus|Minus><Value|Rate|Percent>, e.g. incPlusValue, commMinusPercent
const PAYABLE_GROUPS = [
  { group: 'inc', title: 'Incentive Payable' },
  { group: 'comm', title: 'Commission Payable' },
];
const WEIGHT_SIDES = [
  { key: 'Plus', label: 'CHRG WT +' },
  { key: 'Minus', label: 'CHRG WT -' },
];
const PAYABLE_PARTS = [
  { key: 'Value', label: 'VALUE' },
  { key: 'Rate', label: 'RATE' },
  { key: 'Percent', label: '%' },
];

function PayableGrid({ title, group, otherData, setOtherData }) {
  return (
    <Section title={title}>
      <div className="tw:grid tw:grid-cols-[80px_1fr_1fr_1fr] tw:items-center tw:gap-3 tw:rounded-md tw:border tw:border-border tw:bg-page tw:p-4">
        <span />
        {PAYABLE_PARTS.map((part) => <span key={part.key} className="tw:text-center tw:text-[11px] tw:font-bold tw:text-muted-foreground">{part.label}</span>)}
        {WEIGHT_SIDES.map((side) => (
          <Fragment key={side.key}>
            <span className="tw:text-[11px] tw:font-semibold">{side.label}</span>
            {PAYABLE_PARTS.map((part) => {
              const name = `${group}${side.key}${part.key}`;
              return (
                <Input key={name} data-allow-text="" className="tw:text-right" aria-label={`${title} ${side.label} ${part.label}`}
                  value={otherData?.[name] || ''} onChange={(event) => setOtherData(name)(event.target.value)} />
              );
            })}
          </Fragment>
        ))}
      </div>
    </Section>
  );
}

export default function AirlineOtherTab({ airline }) {
  const { form, setOtherData, insuranceRules, addInsuranceRule, updateInsuranceRule, removeInsuranceRule } = airline;

  const columns = [
    { key: 'dateFrom', header: 'DATE FROM', cell: (rule, index) => <DateInput value={rule.dateFrom || ''} onValueChange={(ymd) => updateInsuranceRule(index, 'dateFrom', ymd)} /> },
    { key: 'dateTo', header: 'DATE TO', cell: (rule, index) => <DateInput value={rule.dateTo || ''} onValueChange={(ymd) => updateInsuranceRule(index, 'dateTo', ymd)} /> },
    {
      key: 'percent',
      header: 'PERCENT (%)',
      cell: (rule, index) => <Input placeholder="0.00" data-allow-text="" value={rule.percent || ''} onChange={(event) => updateInsuranceRule(index, 'percent', event.target.value)} />,
    },
    {
      key: 'actions',
      header: 'ACTIONS',
      align: 'center',
      width: 110,
      cell: (rule, index) => <Button variant="destructive" size="sm" onClick={() => removeInsuranceRule(index)}><Trash2 /> DELETE</Button>,
    },
  ];

  return (
    <div className="tw:flex tw:flex-col tw:gap-8">
      <div className="tw:grid tw:grid-cols-1 tw:gap-8 tw:lg:grid-cols-2">
        {PAYABLE_GROUPS.map((payable) => (
          <PayableGrid key={payable.group} title={payable.title} group={payable.group} otherData={form.otherData} setOtherData={setOtherData} />
        ))}
      </div>

      <Section title="Airline Insurance Details" actions={<Button variant="secondary" onClick={addInsuranceRule}><PlusCircle /> ADD RULE</Button>}>
        <DataTable columns={columns} rows={insuranceRules} rowKey={(rule, index) => index}
          emptyText='No insurance rules added. Click "ADD RULE" to create one.' containerClassName="tw:rounded-md tw:border tw:border-border tw:bg-card" />
      </Section>
    </div>
  );
}
