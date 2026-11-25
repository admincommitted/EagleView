import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { MasterPage } from './masterKit/MasterPage';
import { activeColumn, masterActionsColumn } from './masterKit/masterColumns';
import { useMasterRecords } from './masterKit/useMasterRecords';
import { CheckField, NumberField, SwitchFormButton, TextField } from './masterKit/masterFields';
import { ALL_ROWS, SCHEDULE_LIST, centeredColumn, withoutBlankId } from './CustomsMasterParts/scheduleConfig';

const EMPTY_DRAWBACK = {
  id: '', tariffItem: '', description: '', schemeCode: '', schemeDescription: '',
  drawbackRate: 0, drawbackRateSpec: 0, drawbackCap: 0, drawbackFlag: '', isActive: true, uqc: '',
};
const SEARCH_FIELDS = ['tariffItem', 'schemeCode', 'description'];

// the schedule reads by header (tariff item), then by drawback sr no
const byHeaderThenSrNo = (first, second) =>
  (first.tariffItem || '').localeCompare(second.tariffItem || '') || (first.schemeCode || '').localeCompare(second.schemeCode || '');

const headerOf = (drawback) => (drawback.schemeCode || drawback.tariffItem || '').substring(0, 2);

export default function DrawbackMasterForm() {
  const master = useMasterRecords({
    resource: 'drawbacks',
    emptyRecord: EMPTY_DRAWBACK,
    listParams: ALL_ROWS,
    searchFields: SEARCH_FIELDS,
    describe: (drawback) => `drawback entry ${drawback.dbkSrNo || drawback.tariffItem || ''}`,
    prepareSave: withoutBlankId,
  });
  const sorted = useMemo(() => [...master.filtered].sort(byHeaderThenSrNo), [master.filtered]);

  const columns = [
    { key: 'header', header: 'Header', align: 'center', className: 'tw:font-bold', cell: headerOf },
    { key: 'schemeCode', header: 'Sr. No.', className: 'tw:font-bold tw:text-primary', cell: (drawback) => drawback.schemeCode || drawback.tariffItem },
    { key: 'description', header: 'DBK Desc.', className: 'tw:font-semibold tw:text-muted-foreground tw:whitespace-normal' },
    centeredColumn('drawbackRate', 'Rate Adv.', (drawback) => <span className="tw:text-primary">{drawback.drawbackRate}</span>),
    centeredColumn('drawbackRateSpec', 'Rate Spec.', (drawback) => <span className="tw:text-success">{drawback.drawbackRateSpec || 0}</span>),
    centeredColumn('drawbackCap', 'Cap', (drawback) => drawback.drawbackCap || 0),
    centeredColumn('uqc', 'Unit', (drawback) => drawback.uqc || '-'),
    centeredColumn('drawbackFlag', 'Flag', (drawback) => drawback.drawbackFlag || ''),
    activeColumn,
    masterActionsColumn({ onEdit: master.editRecord, onSwitch: master.switchActive }),
  ];

  return (
    <MasterPage master={{ ...master, filtered: sorted }} list={SCHEDULE_LIST} icon={Activity} formTitle="Drawback Master" columns={columns}
      emptyText="NO SCHEDULE DATA FOUND" actions={<SwitchFormButton master={master} />}>
      <div className="tw:flex tw:flex-col tw:gap-4">
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-[1fr_1.5fr_2fr]">
          <TextField master={master} name="tariffItem" label="Header" placeholder="e.g. 6109" inputClassName="tw:font-bold" />
          <TextField master={master} name="schemeCode" label="DBK Sr No" required upper placeholder="e.g. 610901A" inputClassName="tw:font-bold" />
          <TextField master={master} name="description" label="Commodity Description" required upper placeholder="General description of goods..." />
        </div>
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-3 tw:lg:grid-cols-[1fr_1fr_1fr_100px_100px]">
          <NumberField master={master} name="drawbackRate" label="Rate Adv (%)" />
          <NumberField master={master} name="drawbackRateSpec" label="Rate Spec (Rs)" />
          <NumberField master={master} name="drawbackCap" label="Cap Limit (Rs)" />
          <TextField master={master} name="uqc" label="Unit (UQC)" upper placeholder="e.g. SQM" />
          <TextField master={master} name="drawbackFlag" label="Drawback Flag" upper placeholder="e.g. 5" />
        </div>
        <CheckField master={master} label="Schedule Active?" />
      </div>
    </MasterPage>
  );
}
