import { MessageCircle } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, DataTable, Input, SelectBox } from '@/components/ui';
import { ROUTING_MODULES } from '../whatsappOptions';

const NO_NUMBERS_TEXT = 'No module-specific numbers configured. System will use default numbers from environment variables.';

export default function ModuleNumbersSection({ ctx }) {
  const { handleAddModuleNumber, handleDeleteModuleNumber, moduleMessage, moduleNumbers, newModuleName, newModulePhone, setNewModuleName, setNewModulePhone } = ctx;

  const columns = [
    { key: 'moduleName', header: 'Module Name', cell: (row) => <b>{row.moduleName}</b> },
    { key: 'phoneNumber', header: 'WhatsApp Number' },
    { key: 'action', header: 'Action', align: 'center', width: 80,
      cell: (row) => <Button size="sm" variant="destructive" onClick={() => handleDeleteModuleNumber(row.moduleName)}>Delete</Button> },
  ];

  return (
    <Card>
      <CardHeader className="tw:flex-col tw:items-start tw:gap-1.5 tw:border-b tw:border-border tw:pb-3">
        <CardTitle icon={<MessageCircle className="tw:text-primary" />} className="tw:text-[15px]">Module-wise WhatsApp Routing</CardTitle>
        <CardDescription className="tw:text-entry tw:leading-normal">
          Assign specific WhatsApp numbers for different system modules. When a module sends an alert (e.g., Purchase Order Approvals), it will send to the number configured here.
        </CardDescription>
      </CardHeader>
      <CardContent className="tw:gap-4 tw:pt-3">
        <div className="tw:flex tw:flex-col tw:gap-2.5 tw:md:flex-row tw:md:items-center">
          <SelectBox options={ROUTING_MODULES} value={newModuleName} onValueChange={setNewModuleName} placeholder="Select Module..." className="tw:w-full tw:md:flex-1" />
          <Input value={newModulePhone} onChange={(event) => setNewModulePhone(event.target.value)} placeholder="Phone Number (e.g. 919876543210)" className="tw:md:flex-1" />
          <Button variant="default" onClick={handleAddModuleNumber}>Add Number</Button>
        </div>
        {moduleMessage && (
          <div className="tw:rounded-md tw:border tw:border-success/30 tw:bg-success/10 tw:px-3.5 tw:py-2.5 tw:text-[13px] tw:font-bold tw:text-success">{moduleMessage}</div>
        )}
        <DataTable columns={columns} rows={moduleNumbers} rowKey={(row, index) => index} emptyText={NO_NUMBERS_TEXT} stickyHeader={false} />
      </CardContent>
    </Card>
  );
}
