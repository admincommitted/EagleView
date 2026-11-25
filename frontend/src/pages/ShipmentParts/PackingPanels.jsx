import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Input, NumberInput, SelectBox } from '@/components/ui';
import { FormGrid, GridField, Panel, RemovableChip } from './layout';
import { OPTIONS, toNumber } from './shipmentForm';

const CONTAINER_NO = /^[A-Z]{4}\d{7}$/;

function ChipList({ children }) {
  return <div className="tw:mt-1.5 tw:flex tw:flex-wrap tw:gap-1.5">{children}</div>;
}

const withoutIndex = (list, index) => list.filter((_, itemIndex) => itemIndex !== index);

export function DimensionsPanel({ form, volumeWeight, cubicMetres }) {
  const { shipment, setShipment, setMessage } = form;
  const [size, setSize] = useState({ l: '', w: '', h: '', p: '', unit: 'CM' });
  const setPart = (key) => (value) => setSize({ ...size, [key]: value });

  const add = () => {
    if (!(toNumber(size.l) && toNumber(size.w) && toNumber(size.h) && toNumber(size.p))) {
      setMessage({ tone: 'error', text: 'Length, width, height and pkgs are required' });
      return;
    }
    setShipment((current) => ({ ...current, dimensions: [...current.dimensions, size] }));
    setSize({ ...size, l: '', w: '', h: '', p: '' });
  };

  const title = 'Dimension Details' + (shipment.dimensions.length ? ' - volume weight ' + volumeWeight + ' kg, ' + cubicMetres + ' CBM' : '');
  return (
    <Panel title={title}>
      <FormGrid columns={7}>
        <GridField label="Length"><NumberInput value={size.l} onValueChange={setPart('l')} /></GridField>
        <GridField label="Width"><NumberInput value={size.w} onValueChange={setPart('w')} /></GridField>
        <GridField label="Height"><NumberInput value={size.h} onValueChange={setPart('h')} /></GridField>
        <GridField label="Pkgs"><NumberInput value={size.p} onValueChange={setPart('p')} /></GridField>
        <GridField label="Unit"><SelectBox value={size.unit} onValueChange={setPart('unit')} options={OPTIONS.dimensionUnit} /></GridField>
        <Button variant="default" onClick={add}><Plus className="tw:size-3" /> Add</Button>
      </FormGrid>
      {shipment.dimensions.length > 0 && (
        <ChipList>
          {shipment.dimensions.map((dimension, index) => (
            <RemovableChip key={index} onRemove={() => setShipment((current) => ({ ...current, dimensions: withoutIndex(current.dimensions, index) }))}>
              {dimension.l} x {dimension.w} x {dimension.h} {dimension.unit.toLowerCase()} x {dimension.p}
            </RemovableChip>
          ))}
        </ChipList>
      )}
    </Panel>
  );
}

export function ContainersPanel({ form }) {
  const { shipment, setShipment, setMessage } = form;
  const [container, setContainer] = useState({ no: '', size: '20', type: 'GP', seal: '', pkgs: '', weight: '' });
  const setPart = (key) => (value) => setContainer({ ...container, [key]: value });

  const add = () => {
    if (!CONTAINER_NO.test(container.no)) {
      setMessage({ tone: 'error', text: 'Container no should be 4 letters + 7 digits' });
      return;
    }
    if (shipment.containers.some((added) => added.no === container.no)) {
      setMessage({ tone: 'error', text: container.no + ' is already added' });
      return;
    }
    setShipment((current) => ({ ...current, containers: [...current.containers, container] }));
    setContainer({ ...container, no: '', seal: '', pkgs: '' });
  };

  return (
    <Panel title={'Container Details (' + shipment.containers.length + ')'}>
      <FormGrid columns={7}>
        <GridField label="Container No" span={2}>
          <Input data-allow-text value={container.no} onChange={(event) => setPart('no')(event.target.value.toUpperCase())} placeholder="ABCU1234567" />
        </GridField>
        <GridField label="Size"><SelectBox value={container.size} onValueChange={setPart('size')} options={OPTIONS.containerSize} /></GridField>
        <GridField label="Type"><SelectBox value={container.type} onValueChange={setPart('type')} options={OPTIONS.containerType} /></GridField>
        <GridField label="Seal No"><Input value={container.seal} onChange={(event) => setPart('seal')(event.target.value.toUpperCase())} /></GridField>
        <GridField label="Pkgs"><NumberInput value={container.pkgs} onValueChange={setPart('pkgs')} /></GridField>
        <Button variant="default" onClick={add}><Plus className="tw:size-3" /> Add</Button>
      </FormGrid>
      {shipment.containers.length > 0 && (
        <ChipList>
          {shipment.containers.map((added, index) => (
            <RemovableChip key={index} onRemove={() => setShipment((current) => ({ ...current, containers: withoutIndex(current.containers, index) }))}>
              <b>{added.no}</b> {added.size}{added.type} {added.seal ? 'seal ' + added.seal : ''} {added.pkgs ? added.pkgs + ' pkgs' : ''}
            </RemovableChip>
          ))}
        </ChipList>
      )}
    </Panel>
  );
}
