import React from 'react';
import useExportHeaderTab from './ExportHeaderTabParts/useExportHeaderTab';
import ShipmentModeSection from './ExportHeaderTabParts/sections/ShipmentModeSection';
import ConsigneeDetailsSection from './ExportHeaderTabParts/sections/ConsigneeDetailsSection';
import Sb2DetailsSection from './ExportHeaderTabParts/sections/Sb2DetailsSection';
import PackingDetailsSection from './ExportHeaderTabParts/sections/PackingDetailsSection';
import EtpMasterDetailsSection from './ExportHeaderTabParts/sections/EtpMasterDetailsSection';

// Compact SB Header (29-Oct-2026): 26px boxes, narrower labels, thin section bands, tighter boxes - same fields and
// order, only the spacing (same look as the compact Items / Invoice tabs).
const SBH_CSS = `
.sbh .input-field, .sbh select.input-field { height: 26px !important; min-height: 26px !important; padding-top: 0 !important; padding-bottom: 0 !important; font-size: 12px; box-sizing: border-box; }
.sbh textarea.input-field { height: auto !important; padding-top: 3px !important; padding-bottom: 3px !important; }
.sbh .react-datepicker__input-container input { height: 26px !important; padding-top: 0 !important; padding-bottom: 0 !important; font-size: 12px; }
.sbh label { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; flex-shrink: 0; }
.sbh div[style*="font-size: 13px"][style*="font-weight: bold"] { padding: 3px 10px !important; font-size: 11.5px !important; letter-spacing: .03em; text-transform: uppercase; }
.sbh div[style*="padding: 8px"][style*="flex-direction: column"] { padding: 5px 8px !important; gap: 4px !important; }
.sbh div[style*="display: grid"] { row-gap: 4px !important; }
.sbh hr { margin: 4px 0 !important; }
/* more compact (29-Oct-2026): thinner section bodies and bands, no extra top margin on the SB2 rows */
.sbh > div[style*="margin-bottom: 4px"] { margin-bottom: 3px !important; }
.sbh div[style*="padding: 8px"][style*="flex-direction: column"] { padding: 3px 8px 4px !important; gap: 4px !important; }
.sbh div[style*="padding: 8px"][style*="align-items: center"] { padding: 3px 8px !important; }
.sbh div[style*="font-weight: bold"][style*="padding: 4px 8px"] { padding: 2px 8px !important; min-height: 0; }
.sbh div[style*="padding: 4px 8px"][style*="gap: 2rem"] { padding: 1px 8px !important; }
.sbh div[style*="padding: 4px 8px"][style*="gap: 1rem"] { padding: 2px 8px !important; }
.sbh div[style*="display: grid"][style*="margin-top: 4px"] { margin-top: 0 !important; }
.sbh div[style*="display: grid"][style*="padding-bottom"] { padding-bottom: 3px !important; }
.sbh .btn { height: 26px; padding-top: 0 !important; padding-bottom: 0 !important; font-size: 11px !important; display: inline-flex; align-items: center; gap: 4px; }
.sbh button:focus-visible, .sbh select:focus-visible { outline: 2px solid #0ea5e9; outline-offset: 1px; }
`;

// ExportHeaderTab: state/logic in ./ExportHeaderTabParts/use*.jsx, screen sections in ./ExportHeaderTabParts/sections/.
export default function ExportHeaderTab() {
  const ctx = {};
  Object.assign(ctx, useExportHeaderTab(ctx));
  return <div className="sbh" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', height: '100%', overflowY: 'auto', paddingRight: '0.5rem', fontSize: '10px' }}>
      <style>{SBH_CSS}</style>
      <ShipmentModeSection ctx={ctx} />
      <ConsigneeDetailsSection ctx={ctx} />
      <Sb2DetailsSection ctx={ctx} />

      <PackingDetailsSection ctx={ctx} />

      <EtpMasterDetailsSection ctx={ctx} />

    </div>;
}
