import useExportHeaderTab from './ExportHeaderTabParts/useExportHeaderTab';
import ShipmentModeSection from './ExportHeaderTabParts/sections/ShipmentModeSection';
import ExporterDetailsSection from './ExportHeaderTabParts/sections/ExporterDetailsSection';
import SubAgentSection from './ExportHeaderTabParts/sections/SubAgentSection';
import ConsigneeDetailsSection from './ExportHeaderTabParts/sections/ConsigneeDetailsSection';
import PortDetailsSection from './ExportHeaderTabParts/sections/PortDetailsSection';
import OtherDetailsSection from './ExportHeaderTabParts/sections/OtherDetailsSection';
import Sb2DetailsSection from './ExportHeaderTabParts/sections/Sb2DetailsSection';
import HeaderActionsSection from './ExportHeaderTabParts/sections/HeaderActionsSection';
import PackingDetailsSection from './ExportHeaderTabParts/sections/PackingDetailsSection';
import EtpMasterDetailsSection from './ExportHeaderTabParts/sections/EtpMasterDetailsSection';

const SECTIONS = [
  ShipmentModeSection, ExporterDetailsSection, SubAgentSection, ConsigneeDetailsSection, PortDetailsSection, OtherDetailsSection,
  Sb2DetailsSection, HeaderActionsSection, PackingDetailsSection, EtpMasterDetailsSection,
];

export default function ExportHeaderTab() {
  const ctx = useExportHeaderTab();
  return (
    <div className="tw:flex tw:h-full tw:flex-col tw:gap-1 tw:overflow-y-auto tw:pr-2 tw:normal-case">
      {SECTIONS.map((SectionComponent, position) => <SectionComponent key={position} ctx={ctx} />)}
    </div>
  );
}
