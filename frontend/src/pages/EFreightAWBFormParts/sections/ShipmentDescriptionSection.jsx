import { Box } from 'lucide-react';
import { Button, Field, Input, SelectBox } from '@/components/ui';
import { AwbCard, FormCombo, UnitInput } from '../awbParts';
import { codeOptions } from '../awbFormat';

const SHIPMENT_TYPES = ['Loose', 'ULD'];
const WEIGHT_UNITS = ['kg', 'lbs', 'ton'];
const VOLUME_UNITS = ['cbm', 'cc', 'cft', 'cin', 'cyd'];

function HeaderControls({ ctx }) {
  const { shipmentType, setShipmentType, weightUnit, setWeightUnit, volumeUnit, setVolumeUnit } = ctx;
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-4 tw:text-[13px] tw:font-normal">
      <div className="tw:flex tw:gap-1" role="radiogroup" aria-label="Shipment type">
        {SHIPMENT_TYPES.map((type) => (
          <Button key={type} role="radio" aria-checked={shipmentType === type} variant={shipmentType === type ? 'default' : 'outline'} onClick={() => setShipmentType(type)}>
            {type}
          </Button>
        ))}
      </div>
      <div className="tw:flex tw:items-center tw:gap-2 tw:text-primary">
        <span>Units:</span>
        <SelectBox options={WEIGHT_UNITS} value={weightUnit} onValueChange={setWeightUnit} className="tw:w-[70px] tw:normal-case" />
        <SelectBox options={VOLUME_UNITS} value={volumeUnit} onValueChange={setVolumeUnit} className="tw:w-[75px] tw:normal-case" />
      </div>
    </div>
  );
}

export default function ShipmentDescriptionSection({ ctx }) {
  const { register, sphList, weightUnit, volumeUnit, totalVolume, chargeableWeight, setShowDimsModal } = ctx;
  return (
    <AwbCard
      icon={Box}
      title={<>Shipment Description: <span className="tw:font-normal tw:text-foreground">General Cargo</span></>}
      actions={<HeaderControls ctx={ctx} />}
    >
      <div className="tw:mb-4 tw:grid tw:grid-cols-1 tw:gap-5 tw:md:grid-cols-[1fr_2fr_2fr]">
        <Field layout="col" label="SHC">
          <FormCombo ctx={ctx} name="natureOfGoodsSHC" options={codeOptions(sphList, 'description')} upper placeholder="--" className="tw:w-[80px] tw:flex-none" />
        </Field>
        <Field layout="col" label="Nature of Goods" required><Input data-allow-text required {...register('natureOfGoods')} /></Field>
        <Field layout="col" label="Harmonised Commodity Code"><Input data-allow-text /></Field>
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-[1fr_1fr_1fr_1fr_1.5fr_auto]">
        <Field layout="col" label="Pieces" required><Input required {...register('pieces')} /></Field>
        <Field layout="col" label="Weight" required><UnitInput unit={weightUnit} required {...register('weight')} /></Field>
        <Field layout="col" label="Volume">
          <UnitInput unit={volumeUnit} {...register('volume')} value={totalVolume ? totalVolume.toFixed(3) : ''} readOnly />
        </Field>
        <Field layout="col" label="SLAC Pieces"><Input /></Field>
        <Field layout="col" label="Chargeable Weight">
          <UnitInput unit={weightUnit} value={chargeableWeight || ''} readOnly title="Higher of weight and volumetric weight (IATA 6000 cm3/kg), rounded up to 0.5 kg" />
        </Field>
        <Button variant="link" className="tw:mb-1 tw:justify-start tw:font-bold tw:text-destructive" onClick={() => setShowDimsModal(true)}>View/Edit Dims.</Button>
      </div>
    </AwbCard>
  );
}
