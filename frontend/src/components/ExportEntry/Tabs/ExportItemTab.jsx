import React from 'react';
import useExportItemTab from './ExportItemTabParts/useExportItemTab';
import SearchSchemeCodeSection from './ExportItemTabParts/sections/SearchSchemeCodeSection';
import ReExportDetailsSection from './ExportItemTabParts/sections/ReExportDetailsSection';
import SupportingDocumentConfigurationSection from './ExportItemTabParts/sections/SupportingDocumentConfigurationSection';
import ItemDetailsSection from './ExportItemTabParts/sections/ItemDetailsSection';
import IcegatePreValidationSection from './ExportItemTabParts/sections/IcegatePreValidationSection';

// ExportItemTab: state/logic in ./ExportItemTabParts/use*.jsx, screen sections in ./ExportItemTabParts/sections/.
export default function ExportItemTab() {
  const ctx = {};
  Object.assign(ctx, useExportItemTab(ctx));
  return <div onChangeCapture={ctx.markFormTouched} onInputCapture={ctx.markFormTouched} onClickCapture={ctx.markFormTouched} style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', overflowY: 'auto', paddingRight: '0.5rem', position: 'relative' }}>

      
      <SearchSchemeCodeSection ctx={ctx} />
      <ReExportDetailsSection ctx={ctx} />
      <SupportingDocumentConfigurationSection ctx={ctx} />
      <ItemDetailsSection ctx={ctx} />





      <IcegatePreValidationSection ctx={ctx} />

    </div>;
}
