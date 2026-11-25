import { useMemo } from 'react';
import ShipmentOptionPanel from './ShipmentOptionPanel';
import PartyPanel from './PartyPanel';
import { GoodsPanel, PortPanel, ShipmentDetailsPanel, TransportPanel } from './CargoPanels';
import { ContainersPanel, DimensionsPanel } from './PackingPanels';
import OtherDetailsPanel from './OtherDetailsPanel';
import ShipmentActionBar from './ShipmentActionBar';
import { cubicMetres, volumeWeight } from './shipmentForm';

export default function ShipmentTab({ form }) {
  const { dimensions } = form.shipment;
  const weight = useMemo(() => volumeWeight(dimensions), [dimensions]);
  const volume = useMemo(() => cubicMetres(dimensions), [dimensions]);

  return (
    <>
      <ShipmentOptionPanel form={form} />
      <PartyPanel form={form} />
      <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:lg:grid-cols-2">
        <ShipmentDetailsPanel form={form} />
        <GoodsPanel form={form} volumeWeight={weight} cubicMetres={volume} />
        <TransportPanel form={form} />
        <PortPanel form={form} />
        {form.isAir ? <DimensionsPanel form={form} volumeWeight={weight} cubicMetres={volume} /> : <ContainersPanel form={form} />}
        <OtherDetailsPanel form={form} />
      </div>
      <ShipmentActionBar form={form} />
    </>
  );
}
