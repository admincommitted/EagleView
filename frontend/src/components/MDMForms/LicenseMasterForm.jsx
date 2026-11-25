import { AlertTriangle, FileBadge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { activeColumn, masterActionsColumn } from './masterKit/masterColumns';
import { useMasterRecords } from './masterKit/useMasterRecords';
import { CheckField, DateField, SelectField, TextField } from './masterKit/masterFields';
import { ALL_ROWS, toDashDate } from './CustomsMasterParts/scheduleConfig';

const EMPTY_LICENSE = { id: '', licenseNumber: '', partyName: '', licenseType: 'EPCG', validUpTo: '', isActive: true };
const SEARCH_FIELDS = ['licenseNumber', 'partyName'];
const LICENSE_TYPES = ['EPCG', 'DEEC', 'ADVANCE AUTHORISATION', 'STPI', 'EOU'];

const validateLicense = (license) => {
  if (!license.licenseNumber || !license.partyName) return 'Please fill the required fields (*)';
  if (!license.validUpTo) return 'Valid up to date is required';
  return '';
};

const isExpired = (license) => Boolean(license.validUpTo) && new Date(license.validUpTo) < new Date();

const LIST = {
  title: 'Search License',
  searchPlaceholder: 'Search License No or Party...',
  primaryText: (license) => license.licenseNumber,
  secondaryText: (license) => (
    <>
      {license.partyName} · {license.licenseType} ·{' '}
      <span className={isExpired(license) ? 'tw:text-destructive' : 'tw:text-success'}>EXP: {toDashDate(license.validUpTo) || 'N/A'}</span>
    </>
  ),
};

export default function LicenseMasterForm() {
  const master = useMasterRecords({
    resource: 'licenses',
    emptyRecord: EMPTY_LICENSE,
    listParams: ALL_ROWS,
    searchFields: SEARCH_FIELDS,
    validate: validateLicense,
    describe: (license) => `license ${license.licenseNo || license.licenseNumber || ''}`,
  });

  const columns = [
    { key: 'licenseNumber', header: 'License No', cell: (license) => <Badge variant="info">{license.licenseNumber}</Badge> },
    { key: 'partyName', header: 'Importer Name', className: 'tw:font-semibold' },
    {
      key: 'validUpTo',
      header: 'Valid Till',
      cell: (license) => (
        <span className={cn('tw:font-semibold', isExpired(license) ? 'tw:text-destructive' : 'tw:text-success')}>
          {toDashDate(license.validUpTo)} {isExpired(license) ? '(EXPIRED)' : ''}
        </span>
      ),
    },
    activeColumn,
    masterActionsColumn({ onEdit: master.editRecord, onSwitch: master.switchActive }),
  ];

  return (
    <MasterPage master={master} list={LIST} icon={FileBadge} formTitle="Importer License Master" columns={columns} emptyText="No License records found.">
      <div className="tw:flex tw:flex-col tw:gap-4">
        <p className="tw:m-0 tw:rounded-md tw:border tw:border-primary tw:bg-primary/10 tw:p-3 tw:text-[11px] tw:leading-normal tw:text-head">
          <span className="tw:flex tw:items-center tw:gap-1 tw:font-bold"><AlertTriangle className="tw:size-3.5" /> LICENSE VALIDITY:</span>
          EXPIRED LICENSES ARE SHOWN IN RED IN THE LIST BELOW. NO REMINDER MAIL IS SENT FROM HERE - CHECK THE VALID TILL DATE BEFORE USING A LICENSE.
        </p>
        <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-4 tw:md:grid-cols-[1fr_2fr]">
          <TextField master={master} name="licenseNumber" label="License Number" required upper placeholder="e.g. 0510008432" />
          <TextField master={master} name="partyName" label="Importer Name" required upper placeholder="Select or Type Importer Name" />
          <SelectField master={master} name="licenseType" label="License Type" required options={LICENSE_TYPES} />
          <div className="tw:flex tw:flex-col tw:gap-4 tw:sm:flex-row tw:sm:items-end">
            <DateField master={master} name="validUpTo" label="Valid Up To" required className="tw:flex-1" />
            <CheckField master={master} />
          </div>
        </div>
      </div>
      <p className="tw:mt-4 tw:mb-0 tw:text-[11px] tw:text-muted-foreground">
        * LICENSE TRACKING RELIES ON ACCURATE EXPIRY DATES FOR PROACTIVE OPERATIONS MANAGEMENT.
      </p>
    </MasterPage>
  );
}
