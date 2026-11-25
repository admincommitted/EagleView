import useJobHeaderTab from './JobHeaderTabParts/useJobHeaderTab';
import ShipmentModeSection from './JobHeaderTabParts/sections/ShipmentModeSection';
import BillOfEntrySection from './JobHeaderTabParts/sections/BillOfEntrySection';
import BeFilingSection from './JobHeaderTabParts/sections/BeFilingSection';
import IgmDetailsSection from './JobHeaderTabParts/sections/IgmDetailsSection';
import ContainerDetailsSection from './JobHeaderTabParts/sections/ContainerDetailsSection';
import CertificateDetailsSection from './JobHeaderTabParts/sections/CertificateDetailsSection';
import HighSeaSaleSection from './JobHeaderTabParts/sections/HighSeaSaleSection';

const SECTIONS = [ShipmentModeSection, BillOfEntrySection, BeFilingSection, IgmDetailsSection, ContainerDetailsSection, CertificateDetailsSection, HighSeaSaleSection];

export default function JobHeaderTab({ transportMode, setTransportMode, beType, setBeType, onSave }) {
  const ctx = { beType, setBeType, setTransportMode, transportMode, ...useJobHeaderTab({ onSave }) };
  return (
    <div className="tw:flex tw:h-full tw:flex-col tw:gap-1 tw:overflow-y-auto tw:pr-2 tw:normal-case">
      {SECTIONS.map((SectionComponent, position) => <SectionComponent key={position} ctx={ctx} />)}
    </div>
  );
}
