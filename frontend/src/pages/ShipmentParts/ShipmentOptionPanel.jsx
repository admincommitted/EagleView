import { Badge, DateInput, Input, SelectBox } from '@/components/ui';
import { CheckField, FormGrid, GridCell, GridField, Panel } from './layout';
import { MasterLookup } from './MasterLookup';
import { blankable, valueProps } from './formBindings';
import { OPTIONS, stageVariant } from './shipmentForm';

export default function ShipmentOptionPanel({ form }) {
  const { shipment, shipmentId, nextNo, meta, isAir, branch, setValue } = form;
  const title = (
    <span className="tw:inline-flex tw:items-center tw:gap-1.5">
      Shipment Option
      {shipmentId && <Badge variant={stageVariant(shipment.stage)}>{shipment.stage || 'Register'}</Badge>}
      {shipment.currentStatus && <Badge variant="neutral">{shipment.currentStatus}</Badge>}
    </span>
  );
  const branchOptions = (meta?.branches || []).map((row) => ({ value: row.code, label: `${row.code} - ${row.name}` }));

  return (
    <Panel title={title}>
      <FormGrid columns={9}>
        <GridField label="Docket No"><Input readOnly value={shipmentId ? shipment.docketNo : nextNo ? nextNo + ' (on Save)' : ''} /></GridField>
        <GridField label="Docket Date" required><DateInput {...valueProps(form, 'docketDate')} /></GridField>
        <GridField label="Clearance Date"><DateInput {...valueProps(form, 'clearanceDate')} /></GridField>
        <GridField label="Job Type" required><SelectBox {...blankable} required={!shipment.jobType} {...valueProps(form, 'jobType')} options={OPTIONS.jobType} /></GridField>
        <GridField label="Shipment Type"><SelectBox {...valueProps(form, 'shipmentType')} options={OPTIONS.shipmentType} /></GridField>
        <GridField label="Type"><SelectBox {...valueProps(form, 'houseType')} options={OPTIONS.houseType} /></GridField>
        <GridField label="Cargo Type"><SelectBox {...valueProps(form, 'cargoType')} options={OPTIONS.cargoType} /></GridField>
        <GridField label={(isAir ? 'HAWB' : 'HBL') + ' Nature'}><SelectBox {...valueProps(form, 'freightTerm')} options={OPTIONS.freightTerm} /></GridField>
        <GridField label="Branch">
          <SelectBox value={branch} onValueChange={(value) => setValue('branchCode', value)} disabled={Boolean(shipmentId)} options={branchOptions} />
        </GridField>
        <GridField label="Mode"><SelectBox {...blankable} {...valueProps(form, 'nomination')} options={OPTIONS.nomination} /></GridField>
        <GridField label="Shipment Term"><SelectBox {...blankable} {...valueProps(form, 'shipmentTerm')} options={OPTIONS.shipmentTerm} /></GridField>
        <GridField label="EDI Job No (customs)" span={2}>
          <MasterLookup what="edijob" value={shipment.ediJobNo} onText={(text) => setValue('ediJobNo', text)} onPick={(job) => setValue('ediJobNo', job.code)} placeholder="map to the BE / SB job" />
        </GridField>
        <GridCell span={2}>
          <CheckField label="Customs Clearance Only" checked={shipment.customsOnly} onCheckedChange={(checked) => setValue('customsOnly', checked)} />
        </GridCell>
      </FormGrid>
    </Panel>
  );
}
