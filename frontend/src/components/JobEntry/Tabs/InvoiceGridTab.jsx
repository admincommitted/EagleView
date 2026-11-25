import useInvoiceGridTab from './InvoiceGridTabParts/useInvoiceGridTab';
import EditSection from './InvoiceGridTabParts/sections/EditSection';
import InvoiceDetailsSection from './InvoiceGridTabParts/sections/InvoiceDetailsSection';
import ThirdPartyDetailsSection from './InvoiceGridTabParts/sections/ThirdPartyDetailsSection';
import InvoiceTermsSection from './InvoiceGridTabParts/sections/InvoiceTermsSection';
import SvbLoadingInvoiceSection from './InvoiceGridTabParts/sections/SvbLoadingInvoiceSection';
import ChargesSection from './InvoiceGridTabParts/sections/ChargesSection';

export default function InvoiceGridTab({ onSave }) {
  const ctx = useInvoiceGridTab({ onSave });
  const { selectedRowId } = ctx;
  return (
    <div className="tw:flex tw:min-w-0 tw:flex-col tw:pr-2 tw:text-[11px]">
      <EditSection ctx={ctx} />
      <form id="invoice-form" key={selectedRowId || 'new'} className="glass-panel tw:flex tw:min-w-0 tw:flex-col tw:gap-2 tw:p-2">
        <InvoiceDetailsSection ctx={ctx} />
        <ChargesSection ctx={ctx} />
        <ThirdPartyDetailsSection ctx={ctx} />
      </form>
      <InvoiceTermsSection ctx={ctx} />
      <SvbLoadingInvoiceSection ctx={ctx} />
    </div>
  );
}
