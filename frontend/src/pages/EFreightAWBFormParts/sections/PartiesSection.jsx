import { Bell, ChevronDown, Edit2, Trash2, Users } from 'lucide-react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui';
import { AwbCard } from '../awbParts';
import { PartyDetails, PartySearch } from '../parties';

const SAMPLE_NOTIFY = {
  name: 'ABDOS LAMITUBES MANUFACTURING LLC',
  code: 'C1001',
  address: 'INDUSTRIAL AREA, UMM AL QUWAIN PLOT NO.2, SHED 5 6, UAE, DUBAI, POSTAL CODE: 146',
  phone: '971522653327',
};

const ColumnTitle = ({ children }) => <div className="tw:mb-1 tw:text-xs tw:text-primary tw:uppercase">{children}</div>;

const NewLink = ({ onClick }) => (
  <Button variant="link" className="tw:mt-0.5 tw:font-bold tw:whitespace-nowrap tw:uppercase" onClick={onClick}>+ New</Button>
);

function EditRemoveButtons({ label, onEdit, onRemove }) {
  return (
    <div className="tw:flex tw:shrink-0 tw:gap-2">
      <Button variant="destructive" size="icon-sm" aria-label={`Edit ${label}`} onClick={onEdit}><Edit2 /></Button>
      <Button variant="destructive" size="icon-sm" aria-label={`Remove ${label}`} onClick={onRemove}><Trash2 /></Button>
    </div>
  );
}

function PartyColumn({ label, party, onSelect, onRemove, onOpen }) {
  return (
    <div className="tw:min-w-0">
      <ColumnTitle>{label}</ColumnTitle>
      {party ? (
        <div className="tw:mb-4 tw:flex tw:items-start tw:justify-between tw:gap-3">
          <div className="tw:min-w-0 tw:text-xs tw:leading-[1.4] tw:text-foreground"><PartyDetails party={party} /></div>
          <EditRemoveButtons label={label} onEdit={onOpen} onRemove={onRemove} />
        </div>
      ) : (
        <div className="tw:flex tw:items-start tw:gap-4">
          <PartySearch placeholder={`Search ${label} by name...`} onSelect={onSelect} />
          <NewLink onClick={onOpen} />
        </div>
      )}
    </div>
  );
}

export function ShipperConsigneeSection({ ctx }) {
  const { selectedShipper, setSelectedShipper, selectedConsignee, setSelectedConsignee, openDrawer } = ctx;
  const columns = [
    { mode: 'shipper', label: 'Shipper', party: selectedShipper, setParty: setSelectedShipper },
    { mode: 'consignee', label: 'Consignee', party: selectedConsignee, setParty: setSelectedConsignee },
  ];
  return (
    <AwbCard icon={Users} title="Shipper/Consignee" className="tw:z-10">
      <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:md:grid-cols-2 tw:md:gap-10">
        {columns.map((column) => (
          <PartyColumn
            key={column.mode}
            label={column.label}
            party={column.party}
            onSelect={column.setParty}
            onRemove={() => column.setParty(null)}
            onOpen={() => openDrawer(column.mode)}
          />
        ))}
      </div>
    </AwbCard>
  );
}

export function NotifySection({ ctx }) {
  const { selectedNotify, setSelectedNotify, openDrawer } = ctx;
  return (
    <AwbCard icon={Bell} title="Notify Details">
      {selectedNotify ? (
        <div className="tw:flex tw:items-start tw:justify-between tw:gap-5">
          <div className="tw:grid tw:w-full tw:grid-cols-1 tw:gap-2 tw:text-xs tw:text-foreground tw:md:grid-cols-[1.5fr_2fr_1.5fr] tw:md:gap-5">
            <strong>{SAMPLE_NOTIFY.name} ({SAMPLE_NOTIFY.code})</strong>
            <div className="tw:text-muted-foreground tw:uppercase">{SAMPLE_NOTIFY.address}</div>
            <div className="tw:text-primary tw:uppercase">PHONE: {SAMPLE_NOTIFY.phone}</div>
          </div>
          <EditRemoveButtons label="notify" onEdit={() => openDrawer('notify')} onRemove={() => setSelectedNotify(false)} />
        </div>
      ) : (
        <div className="tw:mt-4 tw:w-full tw:md:w-[30%]">
          <div className="tw:mb-1 tw:text-xs tw:text-foreground tw:uppercase">Notify</div>
          <div className="tw:flex tw:items-center tw:gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="lg" className="tw:flex-1 tw:justify-between tw:font-normal tw:text-foreground">Select <ChevronDown /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="tw:w-(--radix-dropdown-menu-trigger-width)">
                <DropdownMenuItem onSelect={() => setSelectedNotify(true)} className="tw:flex-col tw:items-start">
                  <span className="tw:text-[13px] tw:text-foreground">{SAMPLE_NOTIFY.name}</span>
                  <span className="tw:text-xs tw:text-destructive">{SAMPLE_NOTIFY.code}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <NewLink onClick={() => openDrawer('notify')} />
          </div>
        </div>
      )}
    </AwbCard>
  );
}
