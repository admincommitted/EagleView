import { Field, Input, Section, SelectBox } from '@/components/ui';
import { PartySelect } from '../helpers';
import { FIELD_ROW } from '../headerLists';

export default function SubAgentSection({ ctx }) {
  const { exportData, setExportData, setField, parties } = ctx;
  const subAgentFlag = exportData.subAgentFlag || 'Y';
  const flagBox = <SelectBox size="sm" className="tw:w-[56px]" options={['Y', 'N']} value={subAgentFlag} onValueChange={setField('subAgentFlag')} />;

  return (
    <Section title="SubAgent Details" actions={flagBox}>
      {subAgentFlag === 'Y' && (
        <div className={FIELD_ROW}>
          <Field label="SubAgent Name" labelWidth="150px" className="tw:flex-1">
            <PartySelect type="SUBAGENT" parties={parties} exportData={exportData} setExportData={setExportData} />
          </Field>
          <Field label="SubAgent Address" labelWidth="120px" className="tw:flex-1">
            <Input name="subagentAddress" readOnly placeholder="SUBAGENT ADDRESS" value={exportData.subAgentAddress1 || ''} />
          </Field>
        </div>
      )}
    </Section>
  );
}
