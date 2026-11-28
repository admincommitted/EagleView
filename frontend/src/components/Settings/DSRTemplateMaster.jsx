import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import useDSRTemplateMaster from './DSRTemplateMasterParts/useDSRTemplateMaster';
import TemplateConfigurationSection from './DSRTemplateMasterParts/sections/TemplateConfigurationSection';
import DatabaseFieldSelectorSection from './DSRTemplateMasterParts/sections/DatabaseFieldSelectorSection';

function TemplateList({ templates, activeId, onSelect, onAdd }) {
  return (
    <div className="tw:flex tw:w-full tw:shrink-0 tw:flex-col tw:gap-4 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-4 tw:lg:w-[250px]">
      <div className="tw:flex tw:items-center tw:justify-between">
        <h3 className="tw:m-0 tw:text-sm tw:text-slate-800">Templates</h3>
        <Button variant="default" size="icon" title="New template" onClick={onAdd}><Plus className="tw:size-4" /></Button>
      </div>
      <div className="tw:flex tw:max-h-60 tw:flex-col tw:gap-2 tw:overflow-auto tw:lg:max-h-none">
        {templates.map((template) => {
          const active = template.id === activeId;
          return (
            <Button
              key={template.id}
              size="block"
              className={cn(
                'tw:rounded-md tw:px-3 tw:text-xs',
                active ? 'tw:border-blue-200 tw:bg-blue-50 tw:font-semibold tw:text-blue-700 tw:hover:bg-blue-50' : 'tw:border-slate-200 tw:bg-slate-50 tw:text-slate-600'
              )}
              onClick={() => onSelect(template.id)}
            >
              {template.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export default function DSRTemplateMaster() {
  const dsr = useDSRTemplateMaster();

  return (
    <div className="tw:flex tw:h-full tw:flex-col tw:gap-4 tw:p-3 tw:lg:flex-row tw:lg:p-4">
      <TemplateList templates={dsr.templates} activeId={dsr.activeId} onSelect={dsr.setActiveId} onAdd={dsr.handleAddTemplate} />

      <TemplateConfigurationSection
        template={dsr.activeTemplate}
        onUpdate={dsr.handleUpdateActive}
        onDelete={dsr.handleDeleteTemplate}
        onSave={dsr.handleSaveTemplate}
        onOpenFieldSelector={() => dsr.setIsModalOpen(true)}
        columnHandlers={{
          onAddColumn: dsr.handleAddColumn,
          onMoveColumn: dsr.handleMoveColumn,
          onUpdateColumn: dsr.handleUpdateColumn,
          onRemoveColumn: dsr.handleRemoveColumn,
        }}
        colorRuleHandlers={{
          onAddColorRule: dsr.handleAddColorRule,
          onUpdateColorRule: dsr.handleUpdateColorRule,
          onRemoveColorRule: dsr.handleRemoveColorRule,
        }}
      />

      <DatabaseFieldSelectorSection
        open={dsr.isModalOpen}
        onClose={() => dsr.setIsModalOpen(false)}
        searchQuery={dsr.searchQuery}
        onSearchChange={dsr.setSearchQuery}
        selectedFieldIds={dsr.selectedFieldIds}
        onToggleField={dsr.handleToggleField}
      />
    </div>
  );
}
