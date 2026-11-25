import { useState } from 'react';
import { Package } from 'lucide-react';
import { Button, DateInput, Input, NumberInput, SelectBox } from '@/components/ui';
import { cn } from '@/lib/utils';
import { CheckField, FormGrid, GridCell, GridField, Panel } from './layout';
import { MasterLookup } from './MasterLookup';
import SubPackages from './SubPackages';
import { blankable, textProps, valueProps } from './formBindings';
import { OPTIONS, toNumber } from './shipmentForm';

const codeAndName = (record) => record.code + ' - ' + record.name;

export function ShipmentDetailsPanel({ form }) {
  const { shipment, isImport, isAir, labels, setValue, setShipment } = form;
  const masterRequired = !shipment.customsOnly;
  const pickCarrier = (carrier) => setShipment((current) => ({
    ...current,
    carrier: carrier.name,
    ...(isAir && carrier.prefix && !current.mawbNo && { mawbNo: carrier.prefix + '-' }),
  }));

  return (
    <Panel title="Shipment Details">
      <FormGrid columns={4}>
        <GridField label={labels.master + ' No.'} required={masterRequired} span={2}>
          <Input {...textProps(form, 'mawbNo', { upper: true })} required={masterRequired && !shipment.mawbNo} placeholder={isAir ? '176-12345675' : 'MBL NO'} />
        </GridField>
        <GridField label={labels.master + ' Date'}><DateInput {...valueProps(form, 'mawbDate')} /></GridField>
        <GridField label="PO NO."><Input {...textProps(form, 'poNo')} /></GridField>
        <GridField label={labels.house + ' No'} span={2}><Input {...textProps(form, 'hawbNo', { upper: true })} /></GridField>
        <GridField label={labels.house + ' Date'}><DateInput {...valueProps(form, 'hawbDate')} /></GridField>
        <GridField label="Segment"><Input {...textProps(form, 'data.segment')} /></GridField>
        <GridField label={labels.carrier} span={2}>
          <MasterLookup what={isAir ? 'airline' : 'line'} value={shipment.carrier} onText={(name) => setValue('carrier', name)} onPick={pickCarrier} />
        </GridField>
        {isImport ? (
          <>
            <GridField label="DO No"><Input {...textProps(form, 'data.doNo')} /></GridField>
            <GridField label="DO Date"><DateInput {...valueProps(form, 'data.doDate')} /></GridField>
          </>
        ) : (
          <>
            <GridField label="Cut-off"><Input type="datetime-local" {...textProps(form, 'data.cutOff')} /></GridField>
            <GridField label="Stuffing At">
              <MasterLookup what="warehouse" value={shipment.data.stuffAt} upper onText={(text) => setValue('data.stuffAt', text)} onPick={(warehouse) => setValue('data.stuffAt', codeAndName(warehouse))} placeholder="CFS / warehouse" />
            </GridField>
          </>
        )}
        <GridField label="LR No."><Input {...textProps(form, 'data.lrNo')} /></GridField>
        <GridField label="LR No. Date"><DateInput {...valueProps(form, 'data.lrDate')} /></GridField>
        <GridField label="GRN No."><Input {...textProps(form, 'data.grnNo')} /></GridField>
        {isImport && (
          <CheckField label={'DO Collected ' + (isAir ? 'AirLine' : 'Line')} checked={shipment.data.doCollected} onCheckedChange={(checked) => setValue('data.doCollected', checked)} />
        )}
      </FormGrid>
    </Panel>
  );
}

export function GoodsPanel({ form, volumeWeight, cubicMetres }) {
  const { shipment, isAir, setValue, setShipment } = form;
  const [showSubPackages, setShowSubPackages] = useState(false);
  const subPackages = shipment.data.subPkgs || [];
  const subPackagesText = subPackages.length ? ' (' + subPackages.map((row) => row.pkgs + ' ' + row.unit).join(' + ') + ')' : '';

  const changeSubPackages = (rows) => setShipment((current) => ({
    ...current,
    data: { ...current.data, subPkgs: rows },
    ...(rows.length && {
      pkgs: String(rows.reduce((total, row) => total + toNumber(row.pkgs), 0)),
      pkgUnit: rows.length === 1 ? rows[0].unit : 'PKG',
    }),
  }));

  return (
    <Panel title="Goods Details">
      <FormGrid columns={6}>
        <GridField label="No. Of Pkgs.">
          <div className="tw:flex tw:min-w-0 tw:flex-1 tw:gap-0.5">
            <NumberInput {...valueProps(form, 'pkgs')} />
            <Button
              size="icon-sm"
              className={cn(subPackages.length && 'tw:bg-primary/10')}
              title={'Sub Pkgs - package break-up' + subPackagesText}
              onClick={() => setShowSubPackages((shown) => !shown)}
            >
              <Package className="tw:size-3" />
            </Button>
          </div>
        </GridField>
        <GridField label="Unit">
          <MasterLookup what="uqc" value={shipment.pkgUnit} upper onText={(text) => setValue('pkgUnit', text)} onPick={(unit) => setValue('pkgUnit', unit.code)} />
        </GridField>
        <GridField label="Gross Weight"><NumberInput {...valueProps(form, 'grossWeight')} /></GridField>
        <GridField label="Unit">
          <MasterLookup what="uqc" value={shipment.data.grossUnit} upper onText={(text) => setValue('data.grossUnit', text)} onPick={(unit) => setValue('data.grossUnit', unit.code)} />
        </GridField>
        <GridField label="Net Weight"><NumberInput {...valueProps(form, 'data.netWeight')} /></GridField>
        {isAir ? (
          <GridField label={'Chargable Wt.' + (volumeWeight ? ' (vol ' + volumeWeight + ')' : '')}>
            <NumberInput {...valueProps(form, 'chargeableWeight')} placeholder={volumeWeight ? String(Math.max(volumeWeight, toNumber(shipment.grossWeight))) : ''} />
          </GridField>
        ) : (
          <GridField label="Volume (CBM)"><NumberInput {...valueProps(form, 'volume')} placeholder={cubicMetres ? String(cubicMetres) : ''} /></GridField>
        )}
        <GridField label="Goods Type" span={2}><SelectBox {...blankable} {...valueProps(form, 'data.goodsType')} options={OPTIONS.goodsType} /></GridField>
        <GridField label="Goods Desc" span={4}><Input {...textProps(form, 'goodsDesc')} /></GridField>
        <GridField label="Marks & Nos" span={6}><Input {...textProps(form, 'data.marks')} /></GridField>
        {showSubPackages && (
          <GridCell span={6}>
            <SubPackages rows={subPackages} total={shipment.pkgs} onChange={changeSubPackages} onClose={() => setShowSubPackages(false)} />
          </GridCell>
        )}
      </FormGrid>
    </Panel>
  );
}

export function TransportPanel({ form }) {
  const { shipment, isImport, isAir, labels, setValue } = form;
  return (
    <Panel title={isAir ? 'Flight Details' : 'Vessel Details'}>
      <FormGrid columns={4}>
        <GridField label={labels.flightVessel} span={isAir ? 1 : 2}>
          {isAir
            ? <Input {...textProps(form, 'flightVessel', { upper: true })} placeholder="EK 512" />
            : <MasterLookup what="vessel" value={shipment.flightVessel} onText={(name) => setValue('flightVessel', name)} onPick={(vessel) => setValue('flightVessel', vessel.name)} />}
        </GridField>
        {isAir ? (
          <GridField label="2nd Carrier">
            <MasterLookup what="airline" value={shipment.data.carrier2} upper noAdd onText={(text) => setValue('data.carrier2', text)} onPick={(airline) => setValue('data.carrier2', airline.code || airline.name)} />
          </GridField>
        ) : (
          <GridField label="Voyage"><Input {...textProps(form, 'voyage', { upper: true })} /></GridField>
        )}
        <GridField label="ETD"><DateInput {...valueProps(form, 'etd')} /></GridField>
        <GridField label="ETA"><DateInput {...valueProps(form, 'eta')} /></GridField>
        <GridField label={labels.manifest + ' No.'}><Input {...textProps(form, 'igmNo', { upper: true })} /></GridField>
        <GridField label={labels.manifest + ' Date'}><DateInput {...valueProps(form, 'igmDate')} /></GridField>
        {isImport
          ? <GridField label="Inward Date"><DateInput {...valueProps(form, 'data.inwardDate')} /></GridField>
          : <GridField label="SOB Date"><DateInput {...valueProps(form, 'data.sobDate')} /></GridField>}
        <GridField label={isAir ? 'Rotation No' : 'Line / Rotation No'}><Input {...textProps(form, 'data.rotationNo')} /></GridField>
        <GridField label="ATD"><DateInput {...valueProps(form, 'data.atd')} /></GridField>
        <GridField label="ATA"><DateInput {...valueProps(form, 'data.ata')} /></GridField>
        {isImport && <GridField label="SOB Date"><DateInput {...valueProps(form, 'data.sobDate')} /></GridField>}
      </FormGrid>
    </Panel>
  );
}

function PortField({ form, label, path, what, span = 2, required, placeholder }) {
  const value = form.getValue(path);
  return (
    <GridField label={label} required={required} span={span}>
      <MasterLookup
        what={what}
        value={value}
        mandatory={required}
        upper
        placeholder={placeholder}
        onText={(text) => form.setValue(path, text)}
        onPick={(port) => form.setValue(path, codeAndName(port))}
      />
    </GridField>
  );
}

export function PortPanel({ form }) {
  const { shipment, isImport, isAir } = form;
  const portKind = isAir ? 'airport' : 'port';
  const required = !shipment.customsOnly;
  return (
    <Panel title="Port Details">
      <FormGrid columns={4}>
        <PortField form={form} label="Origin Port" path="originPort" what={portKind} required={required} />
        <PortField form={form} label="Destination Port" path="destinationPort" what={portKind} required={required} />
        <PortField form={form} label={isImport ? 'Discharge Port' : 'Port of Loading'} path="dischargePort" what={portKind} />
        <PortField form={form} label="Clearance At" path="clearanceAt" what="port" />
        {isImport && <PortField form={form} label="Destuffing At" path="data.destuffAt" what="warehouse" placeholder="CFS / warehouse" />}
      </FormGrid>
    </Panel>
  );
}
