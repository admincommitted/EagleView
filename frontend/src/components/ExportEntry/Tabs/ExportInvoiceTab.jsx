import useExportInvoiceTab from './ExportInvoiceTabParts/useExportInvoiceTab';
import InvoiceListSection from './ExportInvoiceTabParts/sections/InvoiceListSection';
import InvoiceDetailsSection from './ExportInvoiceTabParts/sections/InvoiceDetailsSection';
import ChargesSection from './ExportInvoiceTabParts/sections/ChargesSection';
import InvoiceActionsBar from './ExportInvoiceTabParts/sections/InvoiceActionsBar';
import OtherDetailsModal from './ExportInvoiceTabParts/sections/OtherDetailsModal';
import BuyerDetailsModal from './ExportInvoiceTabParts/sections/BuyerDetailsModal';

export default function ExportInvoiceTab() {
  const ctx = useExportInvoiceTab();
  const touch = ctx.markInvTouched;
  return (
    <div
      className="tw:flex tw:h-full tw:min-w-0 tw:flex-col tw:gap-1.5 tw:overflow-y-auto tw:pr-2 tw:text-entry"
      onChangeCapture={touch} onInputCapture={touch} onClickCapture={touch} onPointerDownCapture={touch} onKeyDownCapture={touch}
    >
      <InvoiceListSection ctx={ctx} />
      <InvoiceDetailsSection ctx={ctx} />
      <ChargesSection ctx={ctx} />
      <InvoiceActionsBar ctx={ctx} />
      <OtherDetailsModal ctx={ctx} />
      <BuyerDetailsModal ctx={ctx} />
    </div>
  );
}
