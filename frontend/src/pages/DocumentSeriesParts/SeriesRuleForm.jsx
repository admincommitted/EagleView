import { Eye, Info, Save } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Field, Input, Label, NumberInput, SelectBox } from '@/components/ui';
import { FORMAT_TAGS, previewNumber } from './documentSeries';

export default function SeriesRuleForm({ rule, onChange, docTypes, branches, depts, years, saving, onSave }) {
  const setField = (name) => (value) => onChange(name, value);
  const branchOptions = [{ value: 'ALL', label: 'ALL' }, ...branches.map((branch) => ({ value: branch.branchCode, label: `${branch.branchCode} - ${branch.branchName}` }))];
  const yearOptions = years.map((year) => ({ value: year.code, label: `${year.name || year.code}${year.isClosed ? ' (closed)' : ''}` }));

  return (
    <Card>
      <CardHeader className="tw:px-6 tw:pt-5">
        <CardTitle className="tw:text-base">{rule.id ? 'Edit Series Rule' : 'New Series Rule'}</CardTitle>
      </CardHeader>
      <CardContent className="tw:gap-6 tw:px-6 tw:pb-6">
        <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
          <Field layout="col" label="Document Type" required>
            <SelectBox className="tw:w-full" value={rule.docType} onValueChange={setField('docType')} options={docTypes} placeholder="-- Select Doc Type --" />
          </Field>
          <Field layout="col" label="Branch Scope">
            <SelectBox className="tw:w-full" value={rule.branchCode} onValueChange={setField('branchCode')} options={branchOptions} />
          </Field>
          <Field layout="col" label="Department Scope">
            <SelectBox className="tw:w-full" value={rule.dept} onValueChange={setField('dept')} options={depts} />
          </Field>
          <Field layout="col" label="Financial Year" required>
            <SelectBox className="tw:w-full" value={rule.fyCode} onValueChange={setField('fyCode')} options={yearOptions} placeholder="-- Select --" />
          </Field>
        </div>

        <div className="tw:flex tw:flex-col tw:gap-6 tw:lg:flex-row">
          <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-page tw:p-5 tw:lg:flex-[2]">
            <h4 className="tw:m-0 tw:text-sm tw:normal-case tw:text-foreground">Format Builder (Prefix string)</h4>
            <Input data-allow-text="" className="tw:h-8 tw:text-base tw:font-bold tw:tracking-wider" value={rule.format} maxLength={60}
              onChange={(event) => onChange('format', event.target.value.toUpperCase().replace(/\s/g, ''))} />
            <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
              {FORMAT_TAGS.map((tag) => (
                <Button key={tag} size="sm" variant="secondary" className="tw:text-primary" onClick={() => onChange('format', (rule.format || '') + tag)}>
                  + {tag}
                </Button>
              ))}
              <span className="tw:ml-2 tw:flex tw:items-center tw:gap-1 tw:text-[11px] tw:normal-case tw:text-muted-foreground">
                <Info className="tw:size-3" /> Click dynamic tags to insert them
              </span>
            </div>
            <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:sm:grid-cols-2">
              <Field layout="col" label="Number Padding (Length)">
                <NumberInput decimals={0} value={rule.pad} onValueChange={setField('pad')} />
              </Field>
              <Field layout="col" label={rule.id ? 'Next Number' : 'Starting Sequence Number'}>
                <NumberInput decimals={0} value={rule.nextNumber} onValueChange={setField('nextNumber')} />
              </Field>
            </div>
            <div className="tw:flex tw:items-center tw:gap-2">
              <Checkbox id="series-rule-active" checked={rule.isActive !== false} onCheckedChange={(checked) => onChange('isActive', checked === true)} />
              <Label htmlFor="series-rule-active">Active</Label>
            </div>
          </div>

          <div className="tw:flex tw:min-w-0 tw:flex-col tw:justify-center tw:gap-5 tw:lg:flex-1">
            <div className="tw:relative tw:overflow-hidden tw:rounded-xl tw:bg-primary tw:p-6 tw:text-primary-foreground tw:shadow-lg">
              <Eye className="tw:absolute tw:-top-5 tw:-right-5 tw:size-[120px] tw:opacity-10" />
              <div className="tw:mb-2 tw:text-xs tw:tracking-widest tw:uppercase tw:opacity-70">Live Series Preview</div>
              <div className="tw:text-2xl tw:font-extrabold tw:tracking-widest tw:break-all">{previewNumber(rule, rule.nextNumber)}</div>
              <div className="tw:mt-4 tw:flex tw:text-[11px]">
                <span className="tw:rounded-full tw:bg-white/10 tw:px-2 tw:py-0.5">Then: {previewNumber(rule, (parseInt(rule.nextNumber, 10) || 1) + 1)}</span>
              </div>
            </div>
            <Button variant="success" size="lg" className="tw:w-full" disabled={saving} onClick={onSave}>
              <Save /> {saving ? 'Saving...' : 'Save & Activate Rule'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
