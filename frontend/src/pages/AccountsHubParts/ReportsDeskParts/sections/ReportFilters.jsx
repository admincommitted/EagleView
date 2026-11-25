import { DateInput, Field, Input, NumberInput, SelectBox } from '@/components/ui';
import { Box, LedgerPicker } from '../../ui';
import { CheckLabel } from '../../VoucherDeskParts/sections/CheckLabel';
import { PeriodPicker } from './PeriodPicker';

const PARTY_TYPES = [{ value: 'debtors', label: 'Debtors' }, { value: 'creditors', label: 'Creditors' }];
const BILL_TYPES = [{ value: 'invoice', label: 'Invoice' }, { value: 'creditnote', label: 'Credit Note' }];
const REPORT_TYPES = [{ value: 'unbilled', label: 'UNBILLED' }, { value: 'short', label: 'BILLED / SHORT' }];
const VOUCHER_TYPES = [{ value: 'all', label: 'All' }, { value: 'bank', label: 'Bank' }, { value: 'cash', label: 'Cash' }, { value: 'journal', label: 'Journal' }];
const DETAIL_OPTIONS = [{ value: 'summary', label: 'Summary' }, { value: 'detail', label: 'Detailed (bill wise)' }];
const BUCKETS = [1, 2, 3, 4, 5];
const WIDE = 'tw:sm:col-span-2';

// the filters a report asks for (item.filters)
export function ReportFilters({ item, report }) {
  const { filters, params, setParam, look } = report;
  const has = (key) => filters.includes(key);
  const textInput = (key, extra) => <Input data-allow-text value={params[key]} onChange={(event) => setParam(key)(event.target.value)} {...extra} />;
  return (
    <Box title={item.label} right={<span className="tw:text-[10.5px] tw:font-semibold tw:text-muted-foreground tw:normal-case">{item.desc}</span>}>
      <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] tw:items-end tw:gap-2.5 tw:pb-0.5">
        {has('from') && <PeriodPicker from={params.from} to={params.to} onChange={report.setPeriod} />}
        {has('asOn') && <Field label="As On" layout="col"><DateInput value={params.asOn} onValueChange={setParam('asOn')} /></Field>}
        {has('partyType') && (
          <Field label="Account Type" layout="col">
            <SelectBox options={PARTY_TYPES} value={params.partyType} onValueChange={setParam('partyType')} placeholder="Both" clearable clearLabel="Both" />
          </Field>
        )}
        {has('billType') && (
          <Field label="Type" layout="col"><SelectBox options={BILL_TYPES} value={params.billType} onValueChange={setParam('billType')} placeholder="All" clearable clearLabel="All" /></Field>
        )}
        {has('search') && (
          <Field label="Search" layout="col" className={WIDE}>
            {textInput('search', { onKeyDown: (event) => event.key === 'Enter' && report.run(), placeholder: 'Voucher, invoice no, party, docket, MAWB / HAWB, narration or amount' })}
          </Field>
        )}
        {has('party') && <Field label="Party Name" layout="col" className={WIDE}>{textInput('party', { placeholder: 'All parties' })}</Field>}
        {has('jobNo') && <Field label="Docket No" layout="col">{textInput('jobNo', { placeholder: 'All dockets' })}</Field>}
        {has('cn') && (
          <Field label="Credit Note" layout="col"><CheckLabel className="tw:h-[22px]" checked={params.cn} onChange={setParam('cn')}>Credit notes only</CheckLabel></Field>
        )}
        {has('rtype') && <Field label="Report Type" layout="col"><SelectBox options={REPORT_TYPES} value={params.rtype} onValueChange={setParam('rtype')} /></Field>}
        {has('vtype') && <Field label="Type" layout="col"><SelectBox options={VOUCHER_TYPES} value={params.vtype} onValueChange={setParam('vtype')} /></Field>}
        {has('buckets') && (
          <Field label="Interval In Days (R1 - R5)" layout="col" className={WIDE}>
            <div className="tw:grid tw:w-full tw:grid-cols-5 tw:gap-1">
              {BUCKETS.map((bucket) => (
                <NumberInput key={bucket} decimals={0} align="right" title={'R' + bucket} value={String(params['r' + bucket] ?? '')} onValueChange={setParam('r' + bucket)} />
              ))}
            </div>
          </Field>
        )}
        {has('buckets') && (
          <Field label="Report" layout="col">
            <SelectBox options={DETAIL_OPTIONS} value={params.detail ? 'detail' : 'summary'} onValueChange={(value) => setParam('detail')(value === 'detail')} />
          </Field>
        )}
        {has('group') && (
          <Field label="Group" layout="col" className={WIDE}>
            <SelectBox options={look.groups.map((group) => ({ value: group.id, label: group.name }))} value={params.groupId} onValueChange={setParam('groupId')}
              placeholder="All groups" clearable clearLabel="All groups" />
          </Field>
        )}
        {has('fy') && (
          <Field label="Financial Year" layout="col">
            <SelectBox options={look.years.map((year) => ({ value: year.id, label: year.name || year.code }))} value={params.fyId} onValueChange={setParam('fyId')}
              placeholder="Current" clearable clearLabel="Current" />
          </Field>
        )}
        {has('ledger') && (
          <Field label="Account Name" required layout="col" className={WIDE}>
            <LedgerPicker id="repl" list={look.ledgers} value={params.ledgerId} onChange={setParam('ledgerId')} mandatory />
          </Field>
        )}
      </div>
    </Box>
  );
}
