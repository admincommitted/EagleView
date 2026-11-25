import { Activity } from 'lucide-react';
import { MasterPage } from './masterKit/MasterPage';
import { activeColumn, masterActionsColumn } from './masterKit/masterColumns';
import { useMasterRecords } from './masterKit/useMasterRecords';
import { CheckField, NumberField, SelectField, SwitchFormButton, TextField } from './masterKit/masterFields';
import {
  DGFT_POLICIES, SCHEDULE_LIST, SCHEDULE_SEARCH_FIELDS, centeredColumn, descriptionColumn, tariffItemColumn, withoutBlankId,
} from './CustomsMasterParts/scheduleConfig';

const EMPTY_POLICY = { id: '', tariffItem: '', description: '', exportDuty: 0, dgftPolicy: 'FREE', isActive: true, uqc: '' };

export default function ExportPolicyMasterForm() {
  const master = useMasterRecords({
    resource: 'exportpolicies',
    emptyRecord: EMPTY_POLICY,
    searchFields: SCHEDULE_SEARCH_FIELDS,
    describe: (policy) => `policy entry ${policy.tariffItem || ''}`,
    prepareSave: withoutBlankId,
  });

  const columns = [
    tariffItemColumn,
    descriptionColumn,
    centeredColumn('exportDuty', 'Duty %', (policy) => <span className="tw:text-destructive">{policy.exportDuty}%</span>),
    centeredColumn('dgftPolicy', 'Policy'),
    centeredColumn('uqc', 'Unit', (policy) => policy.uqc || '-'),
    activeColumn,
    masterActionsColumn({ onEdit: master.editRecord, onSwitch: master.switchActive }),
  ];

  return (
    <MasterPage master={master} list={SCHEDULE_LIST} icon={Activity} formTitle="Export Tariff & Policy Master" columns={columns}
      emptyText="NO SCHEDULE DATA FOUND" actions={<SwitchFormButton master={master} />}>
      <div className="tw:flex tw:flex-col tw:gap-4">
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-[1fr_2fr_100px]">
          <TextField master={master} name="tariffItem" label="Tariff Item (HSN)" required placeholder="e.g. 6109" inputClassName="tw:font-bold" />
          <TextField master={master} name="description" label="Commodity Description (HSN Desc)" required upper placeholder="General description of goods..." />
          <TextField master={master} name="uqc" label="Unit (UQC)" upper placeholder="e.g. SQM" />
        </div>
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2">
          <NumberField master={master} name="exportDuty" label="Export Duty (%)" />
          <SelectField master={master} name="dgftPolicy" label="DGFT Licence Policy" options={DGFT_POLICIES} />
        </div>
        <CheckField master={master} label="Schedule Active?" />
      </div>
    </MasterPage>
  );
}
