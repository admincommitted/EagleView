import { Calculator, Zap } from 'lucide-react';
import { Badge } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { activeColumn, masterActionsColumn } from './masterKit/masterColumns';
import { useMasterRecords } from './masterKit/useMasterRecords';
import { CheckField, DateField, NumberField, TextField } from './masterKit/masterFields';

const EMPTY_RSP = { id: '', cethCode: '', description: '', notificationNo: '', serialNo: '', abatementRate: 0, effectiveDate: '', isActive: true };
const SEARCH_FIELDS = ['cethCode', 'description'];

const validateRsp = (rsp) => (!rsp.cethCode || !rsp.description ? 'Please fill the required fields (*)' : '');

const LIST = {
  title: 'Search RSP / Abatement',
  searchPlaceholder: 'Search CETH or Description...',
  primaryText: (rsp) => <>{rsp.cethCode} <Badge variant="info">{rsp.abatementRate}% ABATEMENT</Badge></>,
  secondaryText: (rsp) => rsp.description,
};

export default function RspMasterForm() {
  const master = useMasterRecords({
    resource: 'rspabatements',
    emptyRecord: EMPTY_RSP,
    searchFields: SEARCH_FIELDS,
    validate: validateRsp,
    describe: (rsp) => `RSP entry ${rsp.cethCode || ''}`,
  });

  const columns = [
    { key: 'cethCode', header: 'CETH Code', cell: (rsp) => <Badge variant="info">{rsp.cethCode}</Badge> },
    { key: 'description', header: 'Description', className: 'tw:max-w-[250px] tw:truncate tw:font-semibold' },
    { key: 'notificationNo', header: 'Notif/Sr No', align: 'center', className: 'tw:font-semibold tw:text-muted-foreground', cell: (rsp) => `${rsp.notificationNo} / ${rsp.serialNo}` },
    { key: 'abatementRate', header: 'Abatement', align: 'center', className: 'tw:font-bold tw:text-primary', cell: (rsp) => `${rsp.abatementRate}%` },
    activeColumn,
    masterActionsColumn({ onEdit: master.editRecord, onSwitch: master.switchActive }),
  ];

  return (
    <MasterPage master={master} list={LIST} icon={Calculator} formTitle="RSP & Abatement Master" columns={columns}>
      <div className="tw:flex tw:flex-col tw:gap-4">
        <p className="tw:m-0 tw:rounded-md tw:border tw:border-primary tw:bg-primary/10 tw:p-3 tw:text-[11px] tw:leading-normal tw:text-head">
          <span className="tw:flex tw:items-center tw:gap-1 tw:font-bold"><Zap className="tw:size-3.5" /> HOW THIS LIST IS USED:</span>
          THIS IS A REFERENCE LIST OF CETH CODES WITH THEIR RSP NOTIFICATION, SERIAL NO AND ABATEMENT %. THE ITEM SCREEN DOES NOT FILL FROM IT YET - ENTER THE RSP DETAILS ON THE ITEM YOURSELF.
        </p>
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-[1fr_2fr]">
          <TextField master={master} name="cethCode" label="CETH Code" required upper placeholder="E.G. 24031110" />
          <TextField master={master} name="description" label="Commodity Description" required upper placeholder="E.G. HUKKAH OR GUDAKU TOBACCO" />
        </div>
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-3">
          <TextField master={master} name="notificationNo" label="Notification No" required placeholder="E.G. 049/2008" />
          <TextField master={master} name="serialNo" label="Serial No" required placeholder="E.G. 21" />
          <NumberField master={master} name="abatementRate" label="Abatement Rate (%)" required placeholder="0.00" />
        </div>
        <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-4 tw:md:grid-cols-[1fr_2fr]">
          <DateField master={master} name="effectiveDate" label="Effective Date" />
          <CheckField master={master} />
        </div>
      </div>
      <p className="tw:mt-4 tw:mb-0 tw:text-[11px] tw:text-muted-foreground">* ENSURES ACCURATE MRP-BASED CUSTOMS ASSESSMENT FOR HIGH-VALUE GOODS.</p>
    </MasterPage>
  );
}
