import useItemList from './ItemGridTabParts/hooks/useItemList';
import useSwPopups from './ItemGridTabParts/hooks/useSwPopups';
import useDutyPopups from './ItemGridTabParts/hooks/useDutyPopups';
import useLicenceDocsPopups from './ItemGridTabParts/hooks/useLicenceDocsPopups';
import useTariffLookup from './ItemGridTabParts/hooks/useTariffLookup';
import useItemTransfers from './ItemGridTabParts/hooks/useItemTransfers';
import useItemSave from './ItemGridTabParts/hooks/useItemSave';
import { ITEM_FORM_ID } from './ItemGridTabParts/hooks/itemForm';
import EditSection from './ItemGridTabParts/sections/EditSection';
import ItemSDetailsSection from './ItemGridTabParts/sections/ItemSDetailsSection';
import ItemSDutySection from './ItemGridTabParts/sections/ItemSDutySection';
import AdditionalDetailsSection from './ItemGridTabParts/sections/AdditionalDetailsSection';
import SearchSection from './ItemGridTabParts/sections/SearchSection';
import IgstDutySection from './ItemGridTabParts/sections/IgstDutySection';
import SchemeCodeCategorySection from './ItemGridTabParts/sections/SchemeCodeCategorySection';
import SwConstSection from './ItemGridTabParts/sections/SwConstSection';
import SingleWindowControlSection from './ItemGridTabParts/sections/SingleWindowControlSection';
import AntidumpingCustomDutySection from './ItemGridTabParts/sections/AntidumpingCustomDutySection';
import OtherDutySection from './ItemGridTabParts/sections/OtherDutySection';
import SearchSection2 from './ItemGridTabParts/sections/SearchSection2';
import LicenceSection from './ItemGridTabParts/sections/LicenceSection';

// Each hook adds its part to ctx and reads what the hooks before it put there. The boxes inside the item form are
// uncontrolled (name + defaultValue) and the form re-mounts per selected row - see ItemGridTabParts/hooks/itemForm.js.
export default function ItemGridTab({ transportMode, onSave, onValidate }) {
  const ctx = { onSave, transportMode, onValidate };
  Object.assign(ctx, useItemList());
  Object.assign(ctx, useSwPopups(ctx));
  Object.assign(ctx, useDutyPopups(ctx));
  Object.assign(ctx, useLicenceDocsPopups(ctx));
  Object.assign(ctx, useTariffLookup(ctx));
  Object.assign(ctx, useItemTransfers(ctx));
  Object.assign(ctx, useItemSave(ctx));
  const { selectedRowId } = ctx;

  return (
    <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-0 tw:text-[11px] tw:md:pr-2">
      <EditSection ctx={ctx} />
      <form id={ITEM_FORM_ID} key={selectedRowId || 'new'} className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2">
        <ItemSDetailsSection ctx={ctx} />
        <ItemSDutySection ctx={ctx} />
        <AdditionalDetailsSection ctx={ctx} />
      </form>
      <SearchSection ctx={ctx} />
      <IgstDutySection ctx={ctx} />
      <SchemeCodeCategorySection ctx={ctx} />
      <SwConstSection ctx={ctx} />
      <SingleWindowControlSection ctx={ctx} />
      <AntidumpingCustomDutySection ctx={ctx} />
      <OtherDutySection ctx={ctx} />
      <LicenceSection ctx={ctx} />
      <SearchSection2 ctx={ctx} />
    </div>
  );
}
