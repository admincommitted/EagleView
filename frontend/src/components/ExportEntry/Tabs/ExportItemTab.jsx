import useExportItemTab from './ExportItemTabParts/useExportItemTab';
import ItemListSection from './ExportItemTabParts/sections/ItemListSection';
import ItemFormSection from './ExportItemTabParts/sections/ItemFormSection';
import ItemPopups from './ExportItemTabParts/sections/ItemPopups';

export default function ExportItemTab() {
  const ctx = useExportItemTab();
  const touch = ctx.markFormTouched;
  return (
    <div
      className="tw:relative tw:flex tw:h-full tw:min-w-0 tw:flex-col tw:gap-2 tw:overflow-y-auto tw:pr-2"
      onChangeCapture={touch} onInputCapture={touch} onClickCapture={touch} onPointerDownCapture={touch} onKeyDownCapture={touch}
    >
      <ItemPopups ctx={ctx} />
      <ItemListSection ctx={ctx} />
      <ItemFormSection ctx={ctx} />
    </div>
  );
}
