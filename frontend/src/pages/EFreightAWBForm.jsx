import './EFreightAWBForm.css';
import useEFreightAWBForm from './EFreightAWBFormParts/useEFreightAWBForm';
import CaptureAwbSection from './EFreightAWBFormParts/sections/CaptureAwbSection';
import ShipmentBasicsSection from './EFreightAWBFormParts/sections/ShipmentBasicsSection';
import ShipmentDescriptionSection from './EFreightAWBFormParts/sections/ShipmentDescriptionSection';
import RoutingSection from './EFreightAWBFormParts/sections/RoutingSection';
import { NotifySection, ShipperConsigneeSection } from './EFreightAWBFormParts/sections/PartiesSection';
import RateAndChargeSection from './EFreightAWBFormParts/sections/RateAndChargeSection';
import AdditionalInfoSection from './EFreightAWBFormParts/sections/AdditionalInfoSection';
import ActionBar from './EFreightAWBFormParts/sections/ActionBar';
import DimensionsDrawer from './EFreightAWBFormParts/sections/DimensionsDrawer';
import AwbDrawers from './EFreightAWBFormParts/sections/AwbDrawers';

const FORM_SECTIONS = [
  ShipmentBasicsSection,
  ShipmentDescriptionSection,
  RoutingSection,
  ShipperConsigneeSection,
  NotifySection,
  RateAndChargeSection,
  AdditionalInfoSection,
];

export default function EFreightAWBForm() {
  const ctx = useEFreightAWBForm();
  return (
    <div className="tw:flex tw:min-h-screen tw:flex-col tw:bg-linear-to-br tw:from-page tw:to-muted">
      <CaptureAwbSection ctx={ctx} />
      <div className="tw:relative tw:flex tw:flex-1 tw:flex-col tw:overflow-hidden">
        <div className="tw:flex-1 tw:overflow-y-auto tw:p-4 tw:md:p-6">
          {FORM_SECTIONS.map((FormSection, position) => <FormSection key={position} ctx={ctx} />)}
        </div>
        <ActionBar ctx={ctx} />
      </div>
      <DimensionsDrawer ctx={ctx} />
      <AwbDrawers ctx={ctx} />
    </div>
  );
}
