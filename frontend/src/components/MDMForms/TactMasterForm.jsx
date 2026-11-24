import React from 'react';
import useTactMasterForm from './TactMasterFormParts/useTactMasterForm';
import TactAndIataSection from './TactMasterFormParts/sections/TactAndIataSection';
import Section7CountrySection from './TactMasterFormParts/sections/Section7CountrySection';
import SpecialHandlingCodeSection from './TactMasterFormParts/sections/SpecialHandlingCodeSection';

// TactMasterForm: state/logic in ./TactMasterFormParts/use*.jsx, screen sections in ./TactMasterFormParts/sections/.
export default function TactMasterForm() {
  const ctx = {};
  Object.assign(ctx, useTactMasterForm(ctx));
  return <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh', width: '100%' }}>
      <TactAndIataSection ctx={ctx} />

      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
        
        <Section7CountrySection ctx={ctx} />
          <SpecialHandlingCodeSection ctx={ctx} />
      </div>
    </div>;
}
