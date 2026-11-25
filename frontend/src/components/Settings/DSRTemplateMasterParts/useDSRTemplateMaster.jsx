import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { askConfirm } from '@/components/common/askConfirm';
import { replyOf, settingsApi } from '../settingsApi';

// templates not saved yet carry an id 'new_<time>'
const isUnsaved = (template) => String(template.id).startsWith('new_');
const newColumnId = () => Date.now() + Math.random();

const sampleTemplate = () => ({
  id: `new_${Date.now()}`,
  name: 'Default Template',
  module: 'IMPORT',
  client: 'ALL',
  clientRole: 'IMPORTER',
  columns: [
    { id: 11, header: 'Job No', field: 'Job.jobNo' },
    { id: 12, header: 'Importer', field: 'Job.importerName' },
    { id: 13, header: 'Status', field: 'Job.status' },
  ],
  colorRules: [],
});

// 'Job.importerName' -> 'IMPORTER NAME'
const headerFromField = (fieldKey) => fieldKey.split('.').pop().replace(/([A-Z])/g, ' $1').toUpperCase();

export default function useDSRTemplateMaster() {
  const [templates, setTemplates] = useState([]);
  const [activeId, setActiveId] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeTemplate = templates.find((template) => template.id === activeId) || null;
  const selectedFieldIds = activeTemplate ? activeTemplate.columns.map((column) => column.field) : [];

  const changeActive = (change) => setTemplates(templates.map((template) => (template.id === activeId ? change(template) : template)));
  const changeColumns = (change) => changeActive((template) => ({ ...template, columns: change(template.columns) }));
  const changeColorRules = (change) => changeActive((template) => ({ ...template, colorRules: change([...(template.colorRules || [])]) }));

  const fetchTemplates = async () => {
    try {
      const { status, body } = await replyOf(settingsApi.dsrTemplates());
      if (!body.success) {
        toast.error(`Could not load DSR templates: ${body.message || status}`);
        return;
      }
      if (body.data.length > 0) {
        setTemplates((current) => [...body.data, ...current.filter(isUnsaved)]);
        setActiveId((current) => (body.data.some((template) => template.id === current) || String(current).startsWith('new_') ? current : body.data[0].id));
      } else {
        setTemplates([sampleTemplate()]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSaveTemplate = async () => {
    if (!activeTemplate) return;
    try {
      const { body } = await replyOf(settingsApi.saveDsrTemplate(activeTemplate));
      if (body.success) {
        toast.success(body.message);
        setTemplates((current) => current.map((template) => (template.id === activeTemplate.id ? body.data : template)));
        setActiveId(body.data.id);
      } else {
        toast.error(`Failed to save: ${body.message}`);
      }
    } catch {
      toast.error('Error saving template');
    }
  };

  const handleDeleteTemplate = async () => {
    if (!activeTemplate) return;
    const confirmed = await askConfirm({ title: 'Delete DSR template', message: `Delete DSR template "${activeTemplate.name}"?`, okLabel: 'Delete', tone: 'danger' });
    if (!confirmed) return;
    if (!isUnsaved(activeTemplate)) {
      try {
        await settingsApi.deleteDsrTemplate(activeTemplate.id);
      } catch (error) {
        toast.error(`Not deleted (${error.response ? `HTTP ${error.response.status}` : error.message})`);
        return;
      }
    }
    const rest = templates.filter((template) => template.id !== activeTemplate.id);
    setTemplates(rest);
    setActiveId(rest.length ? rest[0].id : null);
    toast.success('Template deleted');
  };

  const handleAddTemplate = () => {
    const newId = `new_${Date.now()}`;
    setTemplates([...templates, { id: newId, name: 'New Template', client: '', columns: [] }]);
    setActiveId(newId);
  };

  const handleUpdateActive = (key, value) => changeActive((template) => ({ ...template, [key]: value }));

  const handleToggleField = (fieldKey) => {
    if (selectedFieldIds.includes(fieldKey)) {
      changeColumns((columns) => columns.filter((column) => column.field !== fieldKey));
    } else {
      changeColumns((columns) => [...columns, { id: newColumnId(), header: headerFromField(fieldKey), field: fieldKey }]);
    }
  };

  const handleMoveColumn = (index, step) => {
    const target = index + step;
    if (target < 0 || target >= activeTemplate.columns.length) return;
    changeColumns((columns) => {
      const moved = [...columns];
      [moved[index], moved[target]] = [moved[target], moved[index]];
      return moved;
    });
  };

  const handleAddColumn = () => changeColumns((columns) => [...columns, { id: newColumnId(), header: 'Custom Editable Field', field: `custom_${Date.now()}` }]);
  const handleUpdateColumn = (columnId, key, value) => changeColumns((columns) => columns.map((column) => (column.id === columnId ? { ...column, [key]: value } : column)));
  const handleRemoveColumn = (columnId) => changeColumns((columns) => columns.filter((column) => column.id !== columnId));

  const handleAddColorRule = () => changeColorRules((rules) => [...rules, { status: 'PENDING', color: '#fef08a' }]);
  const handleUpdateColorRule = (index, key, value) => changeColorRules((rules) => {
    rules[index] = { ...rules[index], [key]: value };
    return rules;
  });
  const handleRemoveColorRule = (index) => changeColorRules((rules) => rules.filter((_rule, ruleIndex) => ruleIndex !== index));

  return {
    templates, activeId, setActiveId, activeTemplate, selectedFieldIds,
    isModalOpen, setIsModalOpen, searchQuery, setSearchQuery,
    handleAddTemplate, handleSaveTemplate, handleDeleteTemplate, handleUpdateActive,
    handleToggleField, handleMoveColumn, handleAddColumn, handleUpdateColumn, handleRemoveColumn,
    handleAddColorRule, handleUpdateColorRule, handleRemoveColorRule,
  };
}
