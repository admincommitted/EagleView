import { Activity, Percent, ShieldAlert } from 'lucide-react';
import { Badge, Button, Section } from '@/components/ui';
import { askDelete } from './switchRow';
import { MasterPage } from './masterKit/MasterPage';
import { masterRecordsApi } from './masterKit/masterRecordsApi';
import { useMasterRecords } from './masterKit/useMasterRecords';
import { NumberField, SelectField, TextField } from './masterKit/masterFields';
import { ALL_ROWS, DGFT_POLICIES, SCHEDULE_SEARCH_FIELDS, centeredColumn, tariffItemColumn } from './CustomsMasterParts/scheduleConfig';

const EMPTY_SCHEDULE = {
  id: '', tariffItem: '', description: '', schemeDescription: '', schemeCode: '', drawbackRate: 0, drawbackCap: 0,
  rodtepRate: 0, rodtepCap: 0, rosctlRate: 0, rosctlCap: 0, exportDuty: 0, dgftPolicy: 'FREE', uqc: '',
};

const LIST = {
  title: 'Export Schedules',
  searchPlaceholder: 'Search Tariff Item or Desc...',
  primaryText: (row) => row.tariffItem,
  secondaryText: (row) => row.description,
};

function SchemeBlock({ title, icon: Icon = Percent, columnsClassName = 'tw:sm:grid-cols-2', children }) {
  return (
    <Section title={<span className="tw:flex tw:items-center tw:gap-2"><Icon className="tw:size-4 tw:text-primary" /> {title}</span>}
      className="tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-3">
      <div className={`tw:grid tw:grid-cols-1 tw:gap-4 ${columnsClassName}`}>{children}</div>
    </Section>
  );
}

export default function DrawbackRodtepMasterForm() {
  const master = useMasterRecords({ resource: 'drawbacks', emptyRecord: EMPTY_SCHEDULE, listParams: ALL_ROWS, searchFields: SCHEDULE_SEARCH_FIELDS });

  const deleteRecord = async (row) => {
    if (!(await askDelete('Delete this record?'))) return;
    try {
      await masterRecordsApi.remove('drawbacks', row.id);
      master.reload();
    } catch (error) {
      console.error(error);
    }
  };

  const columns = [
    tariffItemColumn,
    {
      key: 'description',
      header: 'Description',
      className: 'tw:whitespace-normal',
      cell: (row) => (
        <>
          <div className="tw:font-semibold tw:text-muted-foreground">{row.description}</div>
          {row.schemeDescription && <div className="tw:text-[10px] tw:font-bold tw:text-muted-foreground">{row.schemeDescription}</div>}
        </>
      ),
    },
    centeredColumn('drawbackRate', 'DBK %', (row) => `${row.drawbackRate}%`),
    centeredColumn('rodtepRate', 'RoDTEP %', (row) => `${row.rodtepRate}%`),
    centeredColumn('rosctlRate', 'RoSCTL %', (row) => `${row.rosctlRate || 0}%`),
    centeredColumn('dgftPolicy', 'Policy', (row) => <Badge variant={row.dgftPolicy === 'FREE' ? 'success' : 'danger'}>{row.dgftPolicy || 'FREE'}</Badge>),
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      width: 150,
      cell: (row) => (
        <span className="tw:inline-flex tw:gap-1">
          <Button variant="link" size="sm" onClick={(event) => { event.stopPropagation(); master.editRecord(row); }}>Edit</Button>
          <Button variant="link" size="sm" className="tw:text-destructive" onClick={(event) => { event.stopPropagation(); deleteRecord(row); }}>Delete</Button>
        </span>
      ),
    },
  ];

  return (
    <MasterPage master={master} list={LIST} icon={Activity} formTitle="Drawback / RoDTEP / Export Master" columns={columns} emptyText="NO SCHEDULE DATA FOUND">
      <div className="tw:flex tw:flex-col tw:gap-4">
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-[1fr_1.2fr_2fr]">
          <TextField master={master} name="tariffItem" label="Tariff Item (HSN)" required placeholder="e.g. 6109" inputClassName="tw:font-bold" />
          <TextField master={master} name="schemeCode" label="Scheme Code (Sr No)" upper placeholder="e.g. 610901A" inputClassName="tw:font-bold" />
          <TextField master={master} name="description" label="Commodity Description (HSN Desc)" required upper placeholder="General description of goods..." />
        </div>
        <TextField master={master} name="schemeDescription" label="Scheme Specific Description (Optional)" upper
          placeholder="Specific description exactly as per Drawback / RoDTEP schedule..." />

        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-2">
          <SchemeBlock title="Drawback (DBK)">
            <NumberField master={master} name="drawbackRate" label="Rate (%)" />
            <NumberField master={master} name="drawbackCap" label="Cap Limit (Rs)" />
          </SchemeBlock>
          <SchemeBlock title="RoDTEP Scheme" columnsClassName="tw:sm:grid-cols-3">
            <NumberField master={master} name="rodtepRate" label="Rate (%)" />
            <NumberField master={master} name="rodtepCap" label="Cap (Rs)" />
            <TextField master={master} name="uqc" label="UQC" upper placeholder="E.G. KGS" />
          </SchemeBlock>
          <SchemeBlock title="RoSCTL (Garments)">
            <NumberField master={master} name="rosctlRate" label="Rate (%)" />
            <NumberField master={master} name="rosctlCap" label="Cap (Rs)" />
          </SchemeBlock>
          <SchemeBlock title="Export Tariff & Licence" icon={ShieldAlert}>
            <NumberField master={master} name="exportDuty" label="Export Duty (%)" />
            <SelectField master={master} name="dgftPolicy" label="DGFT Licence Policy" options={DGFT_POLICIES} />
          </SchemeBlock>
        </div>
      </div>
    </MasterPage>
  );
}
