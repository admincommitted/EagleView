// Shipment Registration - iCAFFE's Operation > Shipment Registration for the four divisions (Import Air, Import Sea,
// Export Air, Export Sea), branch-wise. Route /freight/shipment/:div (ai, si, ae, se); backend routes/shipments.js.
import { Button, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { ProvisionalSheet } from './AccountsHubParts/GstInvoiceDesk';
import useShipment from './ShipmentParts/useShipment';
import { DIVISION_BY_ROUTE, TABS } from './ShipmentParts/shipmentForm';
import ShipmentTab from './ShipmentParts/ShipmentTab';
import SearchTab from './ShipmentParts/SearchTab';
import ReceivingTab from './ShipmentParts/ReceivingTab';
import StatusTab from './ShipmentParts/StatusTab';
import StageTab from './ShipmentParts/StageTab';
import ActivityTab from './ShipmentParts/ActivityTab';
import DueTab from './ShipmentParts/DueTab';
import DocListTab from './ShipmentParts/DocListTab';
import FilesPanel from './ShipmentParts/FilesPanel';

function NeedsDocket({ shipmentId, children }) {
  if (shipmentId) return children;
  return (
    <div className="tw:rounded-md tw:border tw:border-primary/20 tw:bg-primary/5 tw:p-3.5 tw:text-muted-foreground">
      Open a docket first - save a new one on the Shipment tab, or pick one on the Search tab.
    </div>
  );
}

export default function ShipmentRegistration() {
  const form = useShipment();
  const { division, meta, divisionInfo, isImport, labels, branch, tab, setTab, shipment, shipmentId, openShipment, refreshStage, setShipment } = form;
  const docList = meta ? meta.docList[divisionInfo.side] : [];

  return (
    <div className="tw:flex tw:flex-col tw:gap-[5px] tw:px-2.5 tw:py-1.5">
      <div className="tw:flex tw:flex-wrap tw:items-baseline tw:gap-3">
        <h2 className="tw:m-0 tw:text-[14px] tw:font-semibold">{divisionInfo.label || 'Shipment'} - Shipment Registration</h2>
        <div className="tw:flex tw:flex-wrap tw:gap-1">
          {Object.entries(DIVISION_BY_ROUTE).map(([routeKey, code]) => (
            <Button key={routeKey} size="sm" variant={code === division ? 'default' : 'ghost'} onClick={() => form.goToDivision(routeKey)}>
              {meta ? meta.divisions[code].label : code}
            </Button>
          ))}
        </div>
        <span className="tw:text-[11px] tw:text-muted-foreground tw:md:ml-auto">
          Branch {branch || '-'}{shipmentId ? ' - docket ' + shipment.docketNo : ''}
        </span>
      </div>

      <div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="entry" className="tw:overflow-x-auto">
            {TABS.map((sheetTab) => <TabsTrigger key={sheetTab.value} value={sheetTab.value}>{sheetTab.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <div className="tw:flex tw:flex-col tw:gap-2.5 tw:rounded-b-lg tw:border tw:border-t-0 tw:border-input tw:bg-background tw:p-3">
          {tab === 'shipment' && <ShipmentTab form={form} />}
          {tab === 'search' && (
            <SearchTab division={division} divisionInfo={divisionInfo} isImport={isImport} labels={labels} branch={branch} onOpen={(row) => openShipment(row.id)} />
          )}
          {tab === 'recv' && <NeedsDocket shipmentId={shipmentId}><ReceivingTab shipmentId={shipmentId} isImport={isImport} /></NeedsDocket>}
          {tab === 'status' && (
            <NeedsDocket shipmentId={shipmentId}>
              <StatusTab shipmentId={shipmentId} docketNo={shipment.docketNo} levels={meta ? meta.statusLevels[division] : []} onChanged={refreshStage} />
            </NeedsDocket>
          )}
          {tab === 'stage' && <StageTab division={division} labels={labels} branch={branch} stages={meta ? meta.stages : []} onChanged={refreshStage} />}
          {tab === 'activity' && <NeedsDocket shipmentId={shipmentId}><ActivityTab shipmentId={shipmentId} /></NeedsDocket>}
          {tab === 'cost' && (
            <NeedsDocket shipmentId={shipmentId}>
              <ProvisionalSheet key={shipment.docketNo} jobNo={shipment.docketNo} partyName={shipment.billingParty || shipment.mainParty} embedded />
            </NeedsDocket>
          )}
          {tab === 'due' && <DueTab shipmentId={shipmentId} docketNo={shipment.docketNo} division={division} branch={branch} types={meta ? meta.dueTypes : []} />}
          {tab === 'docs' && (
            <NeedsDocket shipmentId={shipmentId}>
              <FilesPanel shipmentId={shipmentId} names={docList} />
              <DocListTab shipmentId={shipmentId} list={docList} docs={shipment.docs} onSaved={(docs) => setShipment((current) => ({ ...current, docs }))} />
            </NeedsDocket>
          )}
        </div>
      </div>
    </div>
  );
}
