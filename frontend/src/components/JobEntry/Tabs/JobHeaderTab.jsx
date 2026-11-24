import React from 'react';
import useJobHeaderTab from './JobHeaderTabParts/useJobHeaderTab';
import ShipmentModeSection from './JobHeaderTabParts/sections/ShipmentModeSection';
import BillOfEntrySection from './JobHeaderTabParts/sections/BillOfEntrySection';
import IgmDetailsSection from './JobHeaderTabParts/sections/IgmDetailsSection';
import ContainerDetailsSection from './JobHeaderTabParts/sections/ContainerDetailsSection';
import CertificateDetailsSection from './JobHeaderTabParts/sections/CertificateDetailsSection';
import HighSeaSaleSection from './JobHeaderTabParts/sections/HighSeaSaleSection';
import BeFilingSection from './JobHeaderTabParts/sections/BeFilingSection';

// JobHeaderTab: state/logic in ./JobHeaderTabParts/use*.jsx, screen sections in ./JobHeaderTabParts/sections/.
export default function JobHeaderTab({ transportMode, setTransportMode, beType, setBeType, onSave }) {
  const ctx = { beType, onSave, setBeType, setTransportMode, transportMode };
  Object.assign(ctx, useJobHeaderTab(ctx));
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', height: '100%', overflowY: 'auto', paddingRight: '0.5rem', fontSize: '10px' }}>
      
      <ShipmentModeSection ctx={ctx} />
      <BillOfEntrySection ctx={ctx} />
      <BeFilingSection ctx={ctx} />
      <IgmDetailsSection ctx={ctx} />

      <ContainerDetailsSection ctx={ctx} />
      <CertificateDetailsSection ctx={ctx} />
      <HighSeaSaleSection ctx={ctx} />
    </div>;
}
