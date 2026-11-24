import { Plus } from 'lucide-react';
import React from 'react';
import useDSRTemplateMaster from './DSRTemplateMasterParts/useDSRTemplateMaster';
import TemplateConfigurationSection from './DSRTemplateMasterParts/sections/TemplateConfigurationSection';
import DatabaseFieldSelectorSection from './DSRTemplateMasterParts/sections/DatabaseFieldSelectorSection';

// DSRTemplateMaster: state/logic in ./DSRTemplateMasterParts/use*.jsx, screen sections in ./DSRTemplateMasterParts/sections/.
export default function DSRTemplateMaster() {
  const ctx = {};
  Object.assign(ctx, useDSRTemplateMaster(ctx));
  const { activeId, handleAddTemplate, setActiveId, templates } = ctx;
  return <div style={{ display: 'flex', gap: '1rem', height: '100%', padding: '1rem' }}>
      
      {/* Sidebar List */}
      <div className="glass-panel" style={{ width: '250px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>Templates</h3>
          <button onClick={handleAddTemplate} className="btn btn-primary" style={{ padding: '4px', height: 'auto' }}>
            <Plus size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflow: 'auto' }}>
          {templates.map(t => (
            <div 
              key={t.id} 
              onClick={() => setActiveId(t.id)}
              style={{ 
                padding: '8px 12px', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                background: t.id === activeId ? '#eff6ff' : '#f8fafc',
                border: t.id === activeId ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                color: t.id === activeId ? '#1d4ed8' : '#475569',
                fontWeight: t.id === activeId ? 600 : 400,
                fontSize: '12px'
              }}
            >
              {t.name}
            </div>
          ))}
        </div>
      </div>

      {/* Editor Area */}
      <TemplateConfigurationSection ctx={ctx} />

      <DatabaseFieldSelectorSection ctx={ctx} />
    </div>;
}
