import React from 'react';
import useExportInvoiceTab from './ExportInvoiceTabParts/useExportInvoiceTab';
import ActionsSection from './ExportInvoiceTabParts/sections/ActionsSection';
import ChargesSection from './ExportInvoiceTabParts/sections/ChargesSection';
import BuyerDetailsSection from './ExportInvoiceTabParts/sections/BuyerDetailsSection';
import { INV_CSS } from './ExportInvoiceTabParts/sections/invCompact';

// ExportInvoiceTab: state/logic in ./ExportInvoiceTabParts/use*.jsx, screen sections in ./ExportInvoiceTabParts/sections/.
export default function ExportInvoiceTab() {
  const ctx = {};
  Object.assign(ctx, useExportInvoiceTab(ctx));
  return <div className="ivd" onChangeCapture={ctx.markInvTouched} onInputCapture={ctx.markInvTouched} onClickCapture={ctx.markInvTouched} style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', overflowY: 'auto', paddingRight: '0.5rem' }}>
      <style>{INV_CSS}</style>
      
      <ActionsSection ctx={ctx} />

      <ChargesSection ctx={ctx} />
      <BuyerDetailsSection ctx={ctx} />
    </div>;
}
