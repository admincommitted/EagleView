import React from 'react';
import useItemGridTab1 from './ItemGridTabParts/useItemGridTab1';
import useItemGridTab2 from './ItemGridTabParts/useItemGridTab2';
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

// ItemGridTab: state/logic in ./ItemGridTabParts/use*.jsx, screen sections in ./ItemGridTabParts/sections/.
export default function ItemGridTab({ transportMode, onSave, onValidate }) {
  const ctx = { onSave, transportMode, onValidate };
  Object.assign(ctx, useItemGridTab1(ctx));
  Object.assign(ctx, useItemGridTab2(ctx));
  const { selectedRowId } = ctx;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '0', paddingRight: '0.5rem', fontSize: '11px' }}>
      
      <EditSection ctx={ctx} />
      <form id="item-form" key={selectedRowId || 'new'} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
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

    </div>;
}
