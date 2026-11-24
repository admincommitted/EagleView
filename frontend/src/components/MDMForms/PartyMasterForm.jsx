import React from 'react';
import usePartyMasterForm from './PartyMasterFormParts/usePartyMasterForm';
import SearchPartySection from './PartyMasterFormParts/sections/SearchPartySection';
import PartyDetailsSection from './PartyMasterFormParts/sections/PartyDetailsSection';
import PartyAddressSection from './PartyMasterFormParts/sections/PartyAddressSection';
import CustomClearanceAiSection from './PartyMasterFormParts/sections/CustomClearanceAiSection';
import CreatedBySection from './PartyMasterFormParts/sections/CreatedBySection';
import ConfirmDeletionSection from './PartyMasterFormParts/sections/ConfirmDeletionSection';

// PartyMasterForm: state/logic in ./PartyMasterFormParts/use*.jsx, screen sections in ./PartyMasterFormParts/sections/.
export default function PartyMasterForm({ defaultRole }) {
  const ctx = { defaultRole };
  Object.assign(ctx, usePartyMasterForm(ctx));
  const { activeTab, setActiveTab, tabStyle } = ctx;
  return <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      <SearchPartySection ctx={ctx} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingBottom: '1rem' }}>
        
        {/* Tabs Bar */}
        <div className="glass-panel" style={{ 
          display: 'flex', 
          background: 'var(--bg-panel, var(--bg-panel, #ffffff))', 
          padding: '0',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          flexShrink: 0,
          minHeight: '40px',
          marginBottom: '0.5rem'
        }}>
          <div style={tabStyle(activeTab === 'details')} onClick={() => setActiveTab('details')}>
            Primary Details & Branches
          </div>
          <div style={tabStyle(activeTab === 'adcode')} onClick={() => setActiveTab('adcode')}>
            Other Details
          </div>
          <div style={tabStyle(activeTab === 'ai_rules')} onClick={() => setActiveTab('ai_rules')}>
            AI Rules (Gemini)
          </div>
        </div>

        {activeTab === 'details' && (
          <>
            <PartyDetailsSection ctx={ctx} />
            <PartyAddressSection ctx={ctx} />
          </>
        )}

        
        <CustomClearanceAiSection ctx={ctx} />

        <CreatedBySection ctx={ctx} />
      </div>

      
      <ConfirmDeletionSection ctx={ctx} />
    </div>;
}
