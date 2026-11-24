import './EFreightAWBForm.css';
import React from 'react';
import useEFreightAWBForm from './EFreightAWBFormParts/useEFreightAWBForm';
import CaptureAwbSection from './EFreightAWBFormParts/sections/CaptureAwbSection';
import OriginSection from './EFreightAWBFormParts/sections/OriginSection';
import RateAndChargeSection from './EFreightAWBFormParts/sections/RateAndChargeSection';
import AllMandatoryFieldsSection from './EFreightAWBFormParts/sections/AllMandatoryFieldsSection';

// EFreightAWBForm: state/logic in ./EFreightAWBFormParts/use*.jsx, screen sections in ./EFreightAWBFormParts/sections/.
export default function EFreightAWBForm() {
  const ctx = {};
  Object.assign(ctx, useEFreightAWBForm(ctx));
  return <div style={{ background: 'linear-gradient(to bottom right, #f1f5f9, #e2e8f0)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      
      
      
      <CaptureAwbSection ctx={ctx} />
        
<div style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', overflow: 'hidden' }}>
        
        {/* Left Main Content */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          
          <OriginSection ctx={ctx} />

            <RateAndChargeSection ctx={ctx} />

        </div>
        
        <AllMandatoryFieldsSection ctx={ctx} />

    </div>
    </div>;
}
