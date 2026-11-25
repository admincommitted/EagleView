import { useMemo } from 'react';
import { FileUp, Zap } from 'lucide-react';
import {
  Badge, Field, Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { activeColumn, masterActionsColumn } from './masterKit/masterColumns';
import { useMasterRecords } from './masterKit/useMasterRecords';
import { CheckField, SelectField, TextField } from './masterKit/masterFields';

const EMPTY_DOCUMENT = { id: '', documentCode: '', description: '', documentType: 'MANDATORY', agency: 'CUSTOMS', isActive: true };
const SEARCH_FIELDS = ['documentCode', 'description'];
const DOCUMENT_TYPES = ['MANDATORY', 'CONDITIONAL', 'OPTIONAL'];

const AGENCY_GROUPS = [
  { heading: 'Customs / Govt', agencies: [['CUSTOMS'], ['DGFT']] },
  {
    heading: 'Food / Agriculture',
    agencies: [['FSSAI'], ['PQIS', 'PQIS (Plant Quarantine)'], ['AQCS', 'AQCS (Animal Quarantine)'], ['DADF', 'DADF (Veterinary)'],
      ['EIC', 'EIC (Fish / Marine)'], ['APEDA'], ['SPICE BOARD'], ['TEA BOARD'], ['COFFEE BOARD'], ['RUBBER BOARD'], ['TOBACCO BOARD']],
  },
  { heading: 'Quality / Standards', agencies: [['BIS'], ['EPC', 'EPC (Export Promotion Council)'], ['THIRD PARTY']] },
  { heading: 'Pharma / Chemical', agencies: [['CDSCO'], ['PESO'], ['NCB', 'NCB (Narcotics)']] },
  {
    heading: 'Gems / Special Sectors',
    agencies: [['GJEPC'], ['ASI', 'ASI (Archaeology)'], ['MOEF', 'MOEF (Wildlife)'], ['MINDEF', 'MINDEF (Defence)'], ['TEXTILE MINISTRY']],
  },
  { heading: 'Finance', agencies: [['BANK'], ['INSURANCE']] },
];

// an ICEGATE document type code is at most 6 characters; the old 7-digit codes are kept as inactive rows
const validateDocument = (document) => {
  if (!document.documentCode || !document.description) return 'Please fill the required fields (*)';
  if (String(document.documentCode).trim().length > 6) return 'ICEGATE document type code is at most 6 characters (e.g. 380000)';
  return '';
};

const isOn = (document) => document.isActive !== false && document.isActive !== 0;
const activeFirstByCode = (first, second) =>
  (isOn(second) ? 1 : 0) - (isOn(first) ? 1 : 0) || String(first.documentCode).localeCompare(String(second.documentCode));

const LIST = {
  title: 'E-Sanchit Codes',
  searchPlaceholder: 'Search Code or Document...',
  primaryText: (document) => (
    <>
      {document.documentCode}{' '}
      <Badge variant={isOn(document) ? 'danger' : 'neutral'}>{isOn(document) ? document.agency : 'INACTIVE'}</Badge>
    </>
  ),
  secondaryText: (document) => document.description,
};

function AgencySelect({ id, value, onValueChange }) {
  return (
    <Select value={value || ''} onValueChange={onValueChange}>
      <SelectTrigger id={id}><SelectValue placeholder="Select..." /></SelectTrigger>
      <SelectContent>
        {AGENCY_GROUPS.map((group) => (
          <SelectGroup key={group.heading}>
            <SelectLabel>── {group.heading} ──</SelectLabel>
            {group.agencies.map(([agency, label]) => <SelectItem key={agency} value={agency}>{label || agency}</SelectItem>)}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function ESanchitMasterForm() {
  const master = useMasterRecords({
    resource: 'esanchits',
    emptyRecord: EMPTY_DOCUMENT,
    searchFields: SEARCH_FIELDS,
    validate: validateDocument,
    describe: (document) => `document code ${document.documentCode || ''}`,
  });
  const { form, setField } = master;
  const sorted = useMemo(() => [...master.filtered].sort(activeFirstByCode), [master.filtered]);

  const columns = [
    { key: 'documentCode', header: 'Code', cell: (document) => <Badge variant="danger">{document.documentCode}</Badge> },
    { key: 'description', header: 'Document Name', className: 'tw:max-w-[250px] tw:truncate tw:font-semibold' },
    { key: 'documentType', header: 'Type', align: 'center', className: 'tw:font-semibold tw:text-muted-foreground' },
    { key: 'agency', header: 'Agency', align: 'center', className: 'tw:font-semibold tw:text-muted-foreground' },
    activeColumn,
    masterActionsColumn({ onEdit: master.editRecord, onSwitch: master.switchActive }),
  ];

  return (
    <MasterPage master={{ ...master, filtered: sorted }} list={LIST} icon={FileUp} formTitle="Add/Edit E-Sanchit Document Master" columns={columns}>
      <div className="tw:flex tw:flex-col tw:gap-4">
        <p className="tw:m-0 tw:rounded-md tw:border tw:border-destructive tw:bg-destructive/10 tw:p-3 tw:text-[11px] tw:leading-normal tw:text-destructive">
          <span className="tw:flex tw:items-center tw:gap-1 tw:font-bold"><Zap className="tw:size-3.5" /> ICEGATE VALIDATION:</span>
          THESE CODES ARE USED FOR SINGLE WINDOW (SWIFT) E-SANCHIT DOCUMENT UPLOADS. INCORRECT CODES WILL RESULT IN ICEGATE REJECTION DURING BILL OF ENTRY SUBMISSION.
        </p>
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-[1fr_2fr]">
          <TextField master={master} name="documentCode" label="Document Code" required upper maxLength={6} placeholder="E.G. 380000" />
          <TextField master={master} name="description" label="Document Description" required upper placeholder="E.G. COMMERCIAL INVOICE" />
        </div>
        <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-4 tw:md:grid-cols-3">
          <SelectField master={master} name="documentType" label="Type" options={DOCUMENT_TYPES} />
          <Field label="PGA / Agency" layout="col">
            <AgencySelect value={form.agency} onValueChange={setField('agency')} />
          </Field>
          <CheckField master={master} />
        </div>
        <p className="tw:m-0 tw:text-[11px] tw:font-semibold tw:text-muted-foreground">
          {master.search ? `${master.filtered.length} of ${master.records.length} records` : `Total: ${master.records.length} codes`}
        </p>
      </div>
    </MasterPage>
  );
}
