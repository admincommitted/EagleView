import { useState } from 'react';
import { FileText, Plane, Settings } from 'lucide-react';
import { Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { MasterPage } from './masterKit/MasterPage';
import { masterActionsColumn } from './masterKit/masterColumns';
import { useAirlineMaster } from './AirlineMasterFormParts/useAirlineMaster';
import AirlineLogo from './AirlineMasterFormParts/sections/AirlineLogo';
import AirlineDetailsTab from './AirlineMasterFormParts/sections/AirlineDetailsTab';
import AirlineOtherTab from './AirlineMasterFormParts/sections/AirlineOtherTab';

const isInactive = (airline) => airline.status === 'INACTIVE';
const StatusBadge = ({ airline }) => <Badge variant={airline.status === 'ACTIVE' ? 'success' : 'danger'}>{airline.status}</Badge>;

const LIST = {
  title: 'Search Airline',
  searchPlaceholder: 'ENTER AIRLINE NAME...',
  primaryText: (airline) => <><Badge variant="neutral">{airline.prefix || 'N/A'}</Badge> {airline.name}</>,
  secondaryText: (airline) => <>CODE: {airline.code2} / {airline.code3} <StatusBadge airline={airline} /></>,
};

export default function AirlineMasterForm() {
  const airline = useAirlineMaster();
  const [tab, setTab] = useState('AirlineMaster');

  const columns = [
    { key: 'logo', header: '', width: 80, cell: (row) => <AirlineLogo airline={row} className="tw:h-[30px] tw:w-[60px]" /> },
    { key: 'prefix', header: 'Prefix', className: 'tw:font-bold', cell: (row) => row.prefix || 'N/A' },
    { key: 'name', header: 'Airline Name', className: 'tw:font-semibold' },
    { key: 'codes', header: 'Code', cell: (row) => `${row.code2 || ''} / ${row.code3 || ''}` },
    { key: 'status', header: 'Status', align: 'center', cell: (row) => <StatusBadge airline={row} /> },
    masterActionsColumn({ onEdit: airline.editRecord }),
  ];

  const switchButton = (
    <Button variant="warning" size="lg" onClick={airline.switchStatus}>{isInactive(airline.form) ? 'Switch on' : 'Switch off'}</Button>
  );

  return (
    <MasterPage master={airline} list={LIST} icon={Plane} formTitle="Airline Master" columns={columns} actions={switchButton} emptyText="No airlines found.">
      <Tabs value={tab} onValueChange={setTab} className="tw:gap-4">
        <TabsList>
          <TabsTrigger value="AirlineMaster"><FileText /> Airline Master Details</TabsTrigger>
          <TabsTrigger value="Other"><Settings /> Other Details</TabsTrigger>
        </TabsList>
        <TabsContent value="AirlineMaster"><AirlineDetailsTab airline={airline} /></TabsContent>
        <TabsContent value="Other"><AirlineOtherTab airline={airline} /></TabsContent>
      </Tabs>
    </MasterPage>
  );
}
