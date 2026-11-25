import { FileText, Plane } from 'lucide-react';
import { Button, Field, SelectBox } from '@/components/ui';
import MissingStrip from '../../MissingStrip';
import { TemplatePicker } from '../../awbActions';

const AWB_TYPES = {
  direct: { path: '/create-awb', route: '/freight/create-awb', label: 'DIRECT AWB' },
  master: { path: '/create-mawb', route: '/freight/create-mawb', label: 'MASTER (MAWB) — CON' },
  house: { path: '/create-hawb', route: '/freight/create-hawb', label: 'HOUSE (HAWB)' },
};

const PRODUCT_TYPES = [
  { value: 'GEN', label: 'GEN — General' },
  { value: 'EXC', label: 'EXC — Express' },
];

/** AWB type switch, product type, the "still to fill" line, DOCS and the template picker. */
export default function HeaderSection({ ctx, templateType, showProductType = true }) {
  const { navigate, productId, setProductId, setShowAwbVault } = ctx;
  const typeButton = (type) => {
    const active = window.location.pathname.includes(type.path);
    return (
      <Button key={type.path} variant={active ? 'default' : 'outline'} aria-pressed={active} onClick={() => navigate(type.route)}>
        {type.label}
      </Button>
    );
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border tw:px-2 tw:py-1 tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-6 tw:gap-y-2">
        <h2 className="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:text-[13px] tw:font-bold tw:text-head">
          <Plane className="tw:size-4" /> AWB TYPE
        </h2>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          {typeButton(AWB_TYPES.direct)}
          {showProductType && (
            <Field label="TYPE:" className="tw:border-r tw:border-border tw:pr-2">
              <SelectBox options={PRODUCT_TYPES} value={productId} onValueChange={setProductId} className="tw:w-full tw:font-semibold tw:md:w-[130px]" />
            </Field>
          )}
          {typeButton(AWB_TYPES.master)}
          {typeButton(AWB_TYPES.house)}
        </div>
      </div>

      <div className="tw:flex tw:flex-col tw:gap-2 tw:lg:items-end">
        <MissingStrip ctx={ctx} />
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
          <Button variant="default" onClick={() => setShowAwbVault(true)}><FileText /> DOCS</Button>
          <TemplatePicker ctx={ctx} type={templateType} />
        </div>
      </div>
    </div>
  );
}
