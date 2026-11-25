import { Activity } from 'lucide-react';
import { MasterPage } from '../masterKit/MasterPage';
import { activeColumn, masterActionsColumn } from '../masterKit/masterColumns';
import { useMasterRecords } from '../masterKit/useMasterRecords';
import { CheckField, NumberField, SwitchFormButton, TextField } from '../masterKit/masterFields';
import {
  ALL_ROWS, SCHEDULE_LIST, SCHEDULE_SEARCH_FIELDS, centeredColumn, descriptionColumn, tariffItemColumn, withoutBlankId,
} from './scheduleConfig';

const EMPTY_RATE_ROW = { id: '', tariffItem: '', description: '', rate: 0, cap: 0, uqc: '', isActive: true };

// A rate-and-cap schedule by tariff item (RoDTEP, RoSCTL)
export function RateScheduleMaster({ resource, formTitle, entryName }) {
  const master = useMasterRecords({
    resource,
    emptyRecord: EMPTY_RATE_ROW,
    listParams: ALL_ROWS,
    searchFields: SCHEDULE_SEARCH_FIELDS,
    describe: (row) => `${entryName} entry ${row.tariffItem || ''}`,
    prepareSave: withoutBlankId,
  });

  const columns = [
    tariffItemColumn,
    descriptionColumn,
    centeredColumn('rate', 'Rate %', (row) => <span className="tw:text-primary">{row.rate}%</span>),
    centeredColumn('cap', 'Cap', (row) => row.cap || 0),
    centeredColumn('uqc', 'Unit', (row) => row.uqc || '-'),
    activeColumn,
    masterActionsColumn({ onEdit: master.editRecord, onSwitch: master.switchActive }),
  ];

  return (
    <MasterPage master={master} list={SCHEDULE_LIST} icon={Activity} formTitle={formTitle} columns={columns}
      emptyText="NO SCHEDULE DATA FOUND" actions={<SwitchFormButton master={master} />}>
      <div className="tw:flex tw:flex-col tw:gap-4">
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-[1fr_2fr]">
          <TextField master={master} name="tariffItem" label="Tariff Item (HSN)" required placeholder="e.g. 6109" inputClassName="tw:font-bold" />
          <TextField master={master} name="description" label="Commodity Description (HSN Desc)" required upper placeholder="General description of goods..." />
        </div>
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-3">
          <NumberField master={master} name="rate" label="Rate (%)" />
          <NumberField master={master} name="cap" label="Cap Limit (Rs)" />
          <TextField master={master} name="uqc" label="UQC" upper placeholder="E.G. KGS" />
        </div>
        <CheckField master={master} label="Schedule Active?" />
      </div>
    </MasterPage>
  );
}
