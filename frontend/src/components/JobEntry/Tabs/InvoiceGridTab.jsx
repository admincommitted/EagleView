import React from 'react';
import useInvoiceGridTab from './InvoiceGridTabParts/useInvoiceGridTab';
import EditSection from './InvoiceGridTabParts/sections/EditSection';
import InvoiceDetailsSection from './InvoiceGridTabParts/sections/InvoiceDetailsSection';
import ThirdPartyDetailsSection from './InvoiceGridTabParts/sections/ThirdPartyDetailsSection';
import InvoiceTermsSection from './InvoiceGridTabParts/sections/InvoiceTermsSection';
import SvbLoadingInvoiceSection from './InvoiceGridTabParts/sections/SvbLoadingInvoiceSection';
import ChargesSection from './InvoiceGridTabParts/sections/ChargesSection'; // freight / insurance / misc ... always on the form (30-Oct-2026)

// InvoiceGridTab: state/logic in ./InvoiceGridTabParts/use*.jsx, screen sections in ./InvoiceGridTabParts/sections/.
export default function InvoiceGridTab({ onSave }) {
  const ctx = { onSave };
  Object.assign(ctx, useInvoiceGridTab(ctx));
  const { selectedRowId } = ctx;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '0', paddingRight: '0.5rem', fontSize: '11px' }}>
      
      <EditSection ctx={ctx} />
      <form id="invoice-form" key={selectedRowId || 'new'} className="glass-panel" style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
        <InvoiceDetailsSection ctx={ctx} />
        <ChargesSection ctx={ctx} />
      <ThirdPartyDetailsSection ctx={ctx} />

      </form>

      <InvoiceTermsSection ctx={ctx} />
      <SvbLoadingInvoiceSection ctx={ctx} />
    </div>;
}
